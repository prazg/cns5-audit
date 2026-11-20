/**
 * CNS5-Audit — Multi-Standard Neuro-Oncology Clinical Calculators
 *
 * Pure, zero-dependency, side-effect-free ES Module implementing:
 *   1. RANO 2.0 (Wen et al., J Clin Oncol 2023)
 *   2. RANO-BM  (Lin et al., Lancet Oncology 2015)
 *   3. RANO-Resect (Karschnia et al., Neuro-Oncology 2023)
 *
 * Research & Educational Use Only — Not a Certified Medical Device (Non-SaMD).
 */

const EPS = 1e-9;

const REFERENCES = {
  rano2: {
    citation:
      "Wen PY, van den Bent M, Youssef G, et al. RANO 2.0: Update to the Response Assessment in Neuro-Oncology Criteria for High- and Low-Grade Gliomas in Adults. J Clin Oncol. 2023;41(33):5187-5199.",
    doi: "10.1200/JCO.23.01059"
  },
  rano_bm: {
    citation:
      "Lin NU, Lee EQ, Aoyama H, et al. Response assessment criteria for brain metastases: proposal from the RANO group. Lancet Oncol. 2015;16(6):e270-e278.",
    doi: "10.1016/S1470-2045(15)70057-4"
  },
  rano_resect: {
    citation:
      "Karschnia P, Young JS, Dono A, et al. Prognostic validation of a new classification system for extent of resection in glioblastoma: A report of the RANO resect group. Neuro-Oncology. 2023;25(5):940-954.",
    doi: "10.1093/neuonc/noac193"
  }
};

const VALID_TUMOR_MODES = new Set(["enhancing_hgg", "non_enhancing_lgg"]);
const VALID_MEASUREMENT_TYPES = new Set(["2d_spd", "3d_volume"]);
const VALID_CORTICOSTEROIDS = new Set([
  "none_or_physiologic",
  "stable_or_decreased",
  "increased"
]);
const VALID_CLINICAL_STATUS = new Set(["stable_or_improved", "worse"]);
const VALID_NON_CNS_STATUS = new Set([
  "CR",
  "PR",
  "SD",
  "PD",
  "NE",
  "not_applicable"
]);

/**
 * Deterministically round a finite number to 1 decimal place (half-away-from-zero).
 * Used for percentage metrics. Preserves Infinity and maps null/undefined/NaN to null.
 */
function round1(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return value;
  }
  const sign = value < 0 ? -1 : 1;
  const rounded = sign * (Math.round((Math.abs(value) + Number.EPSILON) * 10) / 10);
  return Math.abs(rounded) < 1e-12 ? 0 : rounded;
}

/**
 * Strip IEEE-754 representation artifacts (up to 4 decimal places) while preserving
 * small clinically meaningful non-zero volumes/diameters (e.g., 0.04 cm³).
 */
function cleanNum(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return value;
  }
  const cleaned = Number(value.toFixed(4));
  return Math.abs(cleaned) < 1e-12 ? 0 : cleaned;
}

/**
 * Parse a required numeric input strictly (rejects booleans, empty strings, NaN, Infinity).
 */
function parseRequiredNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

/**
 * Parse an optional nullable numeric input. Returns null when omitted/blank, NaN when invalid.
 */
function parseOptionalNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  return parseRequiredNumber(value);
}

function normalizeCorticosteroids(value) {
  if (value === undefined || value === null || value === "") {
    return "none_or_physiologic";
  }
  if (value === "none") {
    return "none_or_physiologic";
  }
  return value;
}

function normalizeClinicalStatus(value) {
  if (value === undefined || value === null || value === "") {
    return "stable_or_improved";
  }
  if (value === "deteriorated") {
    return "worse";
  }
  return value;
}

function normalizeMeasurementType(value) {
  if (value === undefined || value === null || value === "") {
    return "2d_spd";
  }
  if (value === "spd_2d") {
    return "2d_spd";
  }
  if (value === "volume_3d") {
    return "3d_volume";
  }
  return value;
}

function formatSignedPct(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  if (!Number.isFinite(value)) {
    return value > 0 ? "+∞% (from nadir 0)" : "-∞%";
  }
  const rounded = round1(value);
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded.toFixed(1)}%`;
}

function formatSignedMm(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }
  const rounded = round1(value);
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded.toFixed(1)} mm`;
}

function formatSteroidLabel(steroidCode) {
  switch (steroidCode) {
    case "none_or_physiologic":
      return "None / Physiologic replacement only";
    case "stable_or_decreased":
      return "Stable or decreased therapeutic dose";
    case "increased":
      return "Increased therapeutic dose";
    default:
      return String(steroidCode || "Unspecified");
  }
}

function formatClinicalStatusLabel(statusCode) {
  switch (statusCode) {
    case "stable_or_improved":
      return "Stable or improved";
    case "worse":
      return "Unequivocal clinical / neurologic deterioration";
    default:
      return String(statusCode || "Unspecified");
  }
}

/**
 * Helper to compute 2D Sum of Products of Perpendicular Diameters (SPD, mm²)
 * from an array of target lesions [{ longMm, perpMm }].
 *
 * Per RANO 2.0 (Wen et al., JCO 2023):
 * - Measurable target lesions require >=10 mm x >=10 mm perpendicular diameters
 *   on >=2 axial slices.
 * - Up to 5 representative target lesions are summed into SPD.
 *
 * @param {Array<{ longMm: number, perpMm: number }>} lesions
 * @returns {{ valid: boolean, errors: string[], spdMm2: number, measurableCount: number, totalLesionsEvaluated: number, lesionProducts: Array<object>, warnings: string[] }}
 */
export function computeSpdFromLesions(lesions) {
  const errors = [];
  const warnings = [];
  const lesionProducts = [];

  if (!Array.isArray(lesions)) {
    return {
      valid: false,
      errors: ["Lesions input must be an array of { longMm, perpMm } objects."],
      spdMm2: 0,
      measurableCount: 0,
      totalLesionsEvaluated: 0,
      lesionProducts: [],
      warnings: []
    };
  }

  let evaluated = lesions;
  if (lesions.length > 5) {
    warnings.push(
      `Supplied ${lesions.length} lesions; RANO 2.0 limits target lesion summation to a maximum of 5 measurable lesions. Only the first 5 lesions are included in SPD.`
    );
    evaluated = lesions.slice(0, 5);
  }

  let rawSpd = 0;
  let measurableCount = 0;

  evaluated.forEach((lesion, idx) => {
    const label = lesion && lesion.label ? lesion.label : `Lesion #${idx + 1}`;
    if (!lesion || typeof lesion !== "object") {
      errors.push(`${label} must be an object containing longMm and perpMm.`);
      return;
    }

    const longMm = parseRequiredNumber(
      lesion.longMm !== undefined ? lesion.longMm : lesion.longAxisMm
    );
    const perpMm = parseRequiredNumber(
      lesion.perpMm !== undefined ? lesion.perpMm : lesion.shortAxisMm
    );

    if (Number.isNaN(longMm) || longMm < 0) {
      errors.push(`${label}: longMm must be a non-negative finite number.`);
    }
    if (Number.isNaN(perpMm) || perpMm < 0) {
      errors.push(`${label}: perpMm must be a non-negative finite number.`);
    }
    if (
      Number.isNaN(longMm) ||
      longMm < 0 ||
      Number.isNaN(perpMm) ||
      perpMm < 0
    ) {
      return;
    }

    const areaMm2 = longMm * perpMm;
    const isMeasurable = longMm >= 10 - EPS && perpMm >= 10 - EPS;

    if (isMeasurable) {
      measurableCount += 1;
    } else if (longMm > 0 || perpMm > 0) {
      warnings.push(
        `${label} (${cleanNum(longMm)} × ${cleanNum(perpMm)} mm) is below the RANO 2.0 ≥10 × 10 mm measurability criterion; confirm whether it should be tracked as non-measurable disease.`
      );
    }

    rawSpd += areaMm2;
    lesionProducts.push({
      index: idx + 1,
      label,
      longMm: cleanNum(longMm),
      perpMm: cleanNum(perpMm),
      areaMm2: cleanNum(areaMm2),
      measurable: isMeasurable
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    spdMm2: errors.length === 0 ? cleanNum(rawSpd) : 0,
    measurableCount,
    totalLesionsEvaluated: evaluated.length,
    lesionProducts,
    warnings
  };
}

/**
 * Calculate RANO 2.0 response assessment for adult high-grade (enhancing) and
 * low-grade (non-enhancing) gliomas (Wen et al., J Clin Oncol 2023).
 *
 * @param {object} params
 * @returns {object}
 */
export function calculateRano2(params) {
  const errors = [];
  const warnings = [];
  const rationale = [];

  const safeParams = params && typeof params === "object" ? params : {};

  const tumorMode =
    safeParams.tumorMode !== undefined
      ? safeParams.tumorMode
      : safeParams.tumorTrack !== undefined
        ? safeParams.tumorTrack
        : "enhancing_hgg";

  const measurementType = normalizeMeasurementType(
    safeParams.measurementType !== undefined
      ? safeParams.measurementType
      : safeParams.metricMode
  );

  const corticosteroids = normalizeCorticosteroids(
    safeParams.corticosteroids !== undefined
      ? safeParams.corticosteroids
      : safeParams.steroids
  );

  const clinicalStatus = normalizeClinicalStatus(safeParams.clinicalStatus);

  const newMeasurableLesion = Boolean(
    safeParams.newMeasurableLesion !== undefined
      ? safeParams.newMeasurableLesion
      : safeParams.newLesion
  );
  const nonMeasurablePresent = Boolean(safeParams.nonMeasurablePresent);
  const nonMeasurableProgression = Boolean(safeParams.nonMeasurableProgression);
  const within12WeeksPostRt = Boolean(
    safeParams.within12WeeksPostRt !== undefined
      ? safeParams.within12WeeksPostRt
      : safeParams.within12WeeksPostRT
  );
  const outsideRtField = Boolean(
    safeParams.outsideRtField !== undefined
      ? safeParams.outsideRtField
      : safeParams.outsideRTField
  );
  const sustained4Weeks = Boolean(safeParams.sustained4Weeks);

  const baselineValue = parseRequiredNumber(safeParams.baselineValue);
  const currentValue = parseRequiredNumber(safeParams.currentValue);
  const nadirInput = parseOptionalNumber(safeParams.nadirValue);

  if (!VALID_TUMOR_MODES.has(tumorMode)) {
    errors.push(
      `Invalid tumorMode "${String(tumorMode)}". Expected "enhancing_hgg" or "non_enhancing_lgg".`
    );
  }
  if (!VALID_MEASUREMENT_TYPES.has(measurementType)) {
    errors.push(
      `Invalid measurementType "${String(measurementType)}". Expected "2d_spd" or "3d_volume".`
    );
  }
  if (!VALID_CORTICOSTEROIDS.has(corticosteroids)) {
    errors.push(
      `Invalid corticosteroids "${String(corticosteroids)}". Expected "none_or_physiologic", "stable_or_decreased", or "increased".`
    );
  }
  if (!VALID_CLINICAL_STATUS.has(clinicalStatus)) {
    errors.push(
      `Invalid clinicalStatus "${String(clinicalStatus)}". Expected "stable_or_improved" or "worse".`
    );
  }
  if (Number.isNaN(baselineValue) || baselineValue < 0) {
    errors.push("baselineValue must be a finite number ≥ 0.");
  }
  if (Number.isNaN(currentValue) || currentValue < 0) {
    errors.push("currentValue must be a finite number ≥ 0.");
  }
  if (nadirInput !== null && (Number.isNaN(nadirInput) || nadirInput < 0)) {
    errors.push("nadirValue must be null/omitted or a finite number ≥ 0.");
  }

  const unit = measurementType === "3d_volume" ? "cm³" : "mm²";
  const prPct = measurementType === "3d_volume" ? -65 : -50;
  const mrPct =
    tumorMode === "non_enhancing_lgg"
      ? measurementType === "3d_volume"
        ? -40
        : -25
      : null;
  const pdPct = measurementType === "3d_volume" ? 40 : 25;

  const thresholds = { prPct, mrPct, pdPct };

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      standard: "RANO 2.0 (Wen et al., JCO 2023)",
      tumorMode: VALID_TUMOR_MODES.has(tumorMode) ? tumorMode : "enhancing_hgg",
      measurementType: VALID_MEASUREMENT_TYPES.has(measurementType)
        ? measurementType
        : "2d_spd",
      unit,
      responseCode: "INVALID",
      responseLabel: "Invalid Input Parameters",
      severityTier: "neutral",
      pctChangeFromBaseline: null,
      pctChangeFromNadir: null,
      nadirReference: 0,
      thresholds,
      baselineGuardTriggered: false,
      preliminaryPdRuleApplied: false,
      steroidDowngradeApplied: false,
      confirmationStatus: "Correct invalid input parameters to compute response.",
      rationale: [],
      warnings: [],
      reference: { ...REFERENCES.rano2 }
    };
  }

  // Compute nadir reference and unrounded percentage changes
  let nadirReference = baselineValue;
  if (nadirInput !== null) {
    if (nadirInput > baselineValue + EPS) {
      warnings.push(
        `Supplied nadir (${round1(nadirInput)} ${unit}) exceeds baseline (${round1(baselineValue)} ${unit}); per RANO 2.0, the smallest prior measurement (baseline = ${round1(baselineValue)} ${unit}) is used as the nadir reference.`
      );
      nadirReference = baselineValue;
    } else {
      nadirReference = nadirInput;
    }
  }

  const rawPctBaseline =
    baselineValue > EPS
      ? ((currentValue - baselineValue) / baselineValue) * 100
      : null;

  const rawPctNadir =
    nadirReference > EPS
      ? ((currentValue - nadirReference) / nadirReference) * 100
      : currentValue > EPS
        ? Infinity
        : 0;

  const pctChangeFromBaseline =
    rawPctBaseline !== null ? round1(rawPctBaseline) : null;
  const pctChangeFromNadir = Number.isFinite(rawPctNadir)
    ? round1(rawPctNadir)
    : rawPctNadir;

  // Contextual RANO 2.0 reminders
  if (tumorMode === "enhancing_hgg") {
    warnings.push(
      "RANO 2.0 baseline rule: For newly diagnosed glioblastoma / HGG, the post-radiotherapy MRI (not the post-operative pre-RT MRI) serves as the baseline scan."
    );
  }
  if (corticosteroids === "increased") {
    warnings.push(
      "Increased corticosteroids preclude CR, PR, and MR; however, steroid escalation alone without clinical deterioration or radiographic progression does not define PD under RANO 2.0."
    );
  }

  // Evaluate progression criteria (unrounded exact floating-point math with EPS guard)
  const sizePd =
    (nadirReference > EPS && rawPctNadir >= pdPct - EPS) ||
    (nadirReference <= EPS && currentValue > EPS);
  const radiographicPd =
    sizePd || newMeasurableLesion || nonMeasurableProgression;
  const clinicalPd = clinicalStatus === "worse";

  let responseCode = "SD";
  let responseLabel = "Stable Disease";
  let severityTier = "stable";
  let baselineGuardTriggered = false;
  let preliminaryPdRuleApplied = false;
  let steroidDowngradeApplied = false;
  let confirmationStatus =
    "Continue longitudinal surveillance according to protocol schedule.";

  // 1. Clinical PD takes absolute monotonic precedence over <=12w post-RT Prelim-PD
  if (clinicalPd) {
    responseCode = "PD";
    responseLabel = "Progressive Disease";
    severityTier = "progression";
    confirmationStatus =
      "Definite Progressive Disease established by unequivocal clinical deterioration.";

    rationale.push(
      "Unequivocal clinical deterioration not attributable to comorbid conditions or steroid taper meets RANO 2.0 criteria for Definite PD."
    );
    if (sizePd) {
      rationale.push(
        nadirReference > EPS
          ? `Concurrent radiographic progression from nadir (${formatSignedPct(rawPctNadir)}, threshold ≥+${pdPct}%).`
          : `Concurrent reappearance of measurable disease (${round1(currentValue)} ${unit}) from a nadir of 0 ${unit}.`
      );
    }
    if (newMeasurableLesion) {
      rationale.push("New measurable lesion identified.");
    }
    if (nonMeasurableProgression) {
      rationale.push("Unequivocal progression of non-measurable disease identified.");
    }
    if (within12WeeksPostRt && radiographicPd) {
      rationale.push(
        "Monotonicity guard: Even within ≤12 weeks post-radiotherapy, unequivocal clinical deterioration mandates Definite PD and is never downgraded to Preliminary PD."
      );
    }
  } else if (radiographicPd) {
    // 2. Radiographic PD (clinically stable/improved)
    const pdTriggers = [];
    if (sizePd) {
      pdTriggers.push(
        nadirReference > EPS
          ? `Target tumor burden increased ${formatSignedPct(rawPctNadir)} from nadir (threshold ≥+${pdPct}% for ${measurementType === "3d_volume" ? "3D volume" : "2D SPD"}).`
          : `Reappearance of measurable tumor (${round1(currentValue)} ${unit}) after prior nadir of 0 ${unit}.`
      );
    }
    if (newMeasurableLesion) {
      pdTriggers.push("Appearance of a new measurable lesion.");
    }
    if (nonMeasurableProgression) {
      pdTriggers.push("Unequivocal progression of non-measurable disease.");
    }
    rationale.push(...pdTriggers);

    if (within12WeeksPostRt && !outsideRtField) {
      responseCode = "Prelim-PD";
      responseLabel =
        "Preliminary Progressive Disease — Unconfirmed (≤12 wks post-RT)";
      severityTier = "warning";
      preliminaryPdRuleApplied = true;
      confirmationStatus =
        "Confirmatory MRI required ≥4 weeks later to rule out pseudoprogression. If confirmed, backdate PD to this scan.";
      rationale.push(
        "Scan is ≤12 weeks post-radiotherapy without progression outside the radiation field and without clinical deterioration: classified as Preliminary PD per RANO 2.0 pseudoprogression guard (confirm ≥4 weeks)."
      );
    } else {
      responseCode = "PD";
      responseLabel = "Progressive Disease";
      severityTier = "progression";
      confirmationStatus =
        "Definite Progressive Disease met based on radiographic progression.";
      if (within12WeeksPostRt && outsideRtField) {
        rationale.push(
          "Progression occurs outside the high-dose radiotherapy field; RANO 2.0 classifies out-of-field progression as Definite PD even within ≤12 weeks post-RT."
        );
      }
    }
  } else if (baselineValue <= EPS) {
    // 3. Baseline disease guard when not PD/Prelim-PD
    baselineGuardTriggered = true;
    if (!nonMeasurablePresent) {
      responseCode = "Non-PD";
      responseLabel = "No Measurable Baseline Disease (Non-PD — CR Not Applicable)";
      severityTier = "neutral";
      confirmationStatus =
        "No measurable or non-measurable baseline tumor present; CR/PR/MR are not applicable.";
      rationale.push(
        "Baseline measurable value is 0 with no non-measurable disease present; per RANO 2.0, CR/PR/MR cannot be assigned without evaluable baseline disease (classified as Non-PD)."
      );
    } else {
      responseCode = "SD";
      responseLabel =
        "Stable Disease (Non-Measurable Disease Only — CR Not Applicable)";
      severityTier = "stable";
      confirmationStatus =
        "Non-measurable disease persists with zero measurable baseline tumor; continue surveillance for progression or complete resolution.";
      rationale.push(
        "Baseline measurable value is 0 while non-measurable disease remains present without progression; classified as Stable Disease (CR/PR/MR not applicable)."
      );
    }
  } else {
    // 4. Non-PD with measurable baseline (> 0): evaluate CR, PR, MR, SD
    const radCr =
      currentValue <= EPS && !nonMeasurablePresent && !newMeasurableLesion;
    const radPr = rawPctBaseline <= prPct + EPS;
    const radMr =
      tumorMode === "non_enhancing_lgg" &&
      mrPct !== null &&
      rawPctBaseline <= mrPct + EPS &&
      rawPctBaseline > prPct + EPS;

    if (radCr) {
      if (corticosteroids === "none_or_physiologic") {
        responseCode = "CR";
        responseLabel = "Complete Response";
        severityTier = "favorable";
        confirmationStatus = sustained4Weeks
          ? "Confirmed Complete Response (sustained ≥4 weeks)."
          : "Unconfirmed CR — requires repeat MRI ≥4 weeks later confirming sustained disappearance.";
        rationale.push(
          `Complete disappearance of all measurable (baseline ${round1(baselineValue)} ${unit} → 0 ${unit}) and non-measurable disease, off therapeutic corticosteroids (none/physiologic), and clinically stable/improved.`
        );
      } else if (corticosteroids === "stable_or_decreased") {
        responseCode = "PR";
        responseLabel =
          "Partial Response (Downgraded from CR due to Corticosteroids)";
        severityTier = "favorable";
        steroidDowngradeApplied = true;
        confirmationStatus = sustained4Weeks
          ? "Confirmed Partial Response (sustained ≥4 weeks); taper to none/physiologic steroids to qualify for CR."
          : "Unconfirmed PR — requires confirmatory scan ≥4 weeks later; CR requires none/physiologic corticosteroids.";
        rationale.push(
          "Radiographic disappearance of all measurable and non-measurable disease achieved, but patient remains on stable/decreased therapeutic corticosteroids."
        );
        rationale.push(
          "Steroid downgrade rule: RANO 2.0 requires no corticosteroids (or physiologic replacement only) for CR; response is downgraded to PR."
        );
      } else {
        responseCode = "SD";
        responseLabel =
          "Stable Disease (Downgraded from CR due to Increased Corticosteroids)";
        severityTier = "stable";
        steroidDowngradeApplied = true;
        confirmationStatus =
          "Increased corticosteroids preclude CR, PR, and MR; classified as SD unless progression occurs.";
        rationale.push(
          "Radiographic disappearance of disease occurred, but corticosteroid dose was increased."
        );
        rationale.push(
          "Steroid downgrade rule: Increased corticosteroids prevent assignment of CR, PR, or MR; classified as SD."
        );
      }
    } else if (radPr) {
      if (corticosteroids === "increased") {
        responseCode = "SD";
        responseLabel =
          "Stable Disease (Downgraded from PR due to Increased Corticosteroids)";
        severityTier = "stable";
        steroidDowngradeApplied = true;
        confirmationStatus =
          "Increased corticosteroids preclude PR; classified as SD pending steroid stabilization.";
        rationale.push(
          `Target tumor decreased ${formatSignedPct(rawPctBaseline)} from baseline (meets ≤${prPct}% PR threshold), but corticosteroid dose was increased.`
        );
        rationale.push(
          "Steroid downgrade rule: Increased corticosteroids preclude PR/MR; downgraded to SD."
        );
      } else {
        responseCode = "PR";
        responseLabel = "Partial Response";
        severityTier = "favorable";
        confirmationStatus = sustained4Weeks
          ? "Confirmed Partial Response (sustained ≥4 weeks)."
          : "Unconfirmed PR — requires confirmatory MRI ≥4 weeks later.";
        rationale.push(
          `Target tumor decreased ${formatSignedPct(rawPctBaseline)} from baseline (meets RANO 2.0 PR threshold of ≤${prPct}% for ${measurementType === "3d_volume" ? "3D volume" : "2D SPD"}) with stable/decreased or no corticosteroids and stable/improved clinical status.`
        );
        if (currentValue <= EPS && nonMeasurablePresent) {
          rationale.push(
            "Measurable target disease resolved to 0, but persistent non-measurable disease precludes CR (classified as PR)."
          );
        }
      }
    } else if (radMr) {
      if (corticosteroids === "increased") {
        responseCode = "SD";
        responseLabel =
          "Stable Disease (Downgraded from MR due to Increased Corticosteroids)";
        severityTier = "stable";
        steroidDowngradeApplied = true;
        confirmationStatus =
          "Increased corticosteroids preclude MR; classified as SD.";
        rationale.push(
          `Non-enhancing LGG tumor decreased ${formatSignedPct(rawPctBaseline)} from baseline (within ${mrPct}% to >${prPct}% MR band), but corticosteroid dose was increased.`
        );
        rationale.push(
          "Steroid downgrade rule: Increased corticosteroids preclude MR; downgraded to SD."
        );
      } else {
        responseCode = "MR";
        responseLabel = "Minor Response (Non-Enhancing LGG)";
        severityTier = "favorable";
        confirmationStatus = sustained4Weeks
          ? "Confirmed Minor Response (sustained ≥4 weeks)."
          : "Unconfirmed MR — requires confirmatory MRI ≥4 weeks later.";
        rationale.push(
          `Non-enhancing LGG tumor decreased ${formatSignedPct(rawPctBaseline)} from baseline (meets RANO 2.0 LGG Minor Response band: ${mrPct}% to >${prPct}% for ${measurementType === "3d_volume" ? "3D volume" : "2D SPD"}) with non-increased corticosteroids and stable/improved clinical status.`
        );
      }
    } else {
      responseCode = "SD";
      responseLabel = "Stable Disease";
      severityTier = "stable";
      confirmationStatus =
        "Does not qualify for CR, PR, MR, or PD; continue surveillance imaging.";
      rationale.push(
        `Change from baseline is ${formatSignedPct(rawPctBaseline)} and change from nadir is ${formatSignedPct(rawPctNadir)}; neither response nor progression thresholds are met.`
      );

      // Educational note when HGG tumor shrinkage falls inside LGG MR range
      const lggMrThreshold = measurementType === "3d_volume" ? -40 : -25;
      if (
        tumorMode === "enhancing_hgg" &&
        rawPctBaseline <= lggMrThreshold + EPS &&
        rawPctBaseline > prPct + EPS
      ) {
        rationale.push(
          `Note: Reduction of ${formatSignedPct(rawPctBaseline)} falls in the ${lggMrThreshold}% to >${prPct}% band, but Minor Response (MR) applies only to non-enhancing / LGG tumors in RANO 2.0; enhancing HGG remains SD.`
        );
      }
    }
  }

  return {
    valid: true,
    errors: [],
    standard: "RANO 2.0 (Wen et al., JCO 2023)",
    tumorMode,
    measurementType,
    unit,
    responseCode,
    responseLabel,
    severityTier,
    pctChangeFromBaseline,
    pctChangeFromNadir,
    nadirReference: cleanNum(nadirReference),
    thresholds,
    baselineGuardTriggered,
    preliminaryPdRuleApplied,
    steroidDowngradeApplied,
    confirmationStatus,
    rationale,
    warnings,
    reference: { ...REFERENCES.rano2 }
  };
}

/**
 * Calculate RANO-BM bicompartmental response assessment for brain metastases
 * (Lin et al., Lancet Oncology 2015).
 *
 * @param {object} params
 * @returns {object}
 */
export function calculateRanoBm(params) {
  const errors = [];
  const warnings = [];
  const rationale = [];

  const safeParams = params && typeof params === "object" ? params : {};

  const corticosteroids = normalizeCorticosteroids(
    safeParams.corticosteroids !== undefined
      ? safeParams.corticosteroids
      : safeParams.steroids
  );

  const neurologicStatus = normalizeClinicalStatus(
    safeParams.neurologicStatus !== undefined
      ? safeParams.neurologicStatus
      : safeParams.clinicalStatus
  );

  const newCnsLesion = Boolean(safeParams.newCnsLesion);
  const nonTargetCnsPresent = Boolean(safeParams.nonTargetCnsPresent);
  const nonTargetCnsProgression = Boolean(
    safeParams.nonTargetCnsProgression !== undefined
      ? safeParams.nonTargetCnsProgression
      : safeParams.nonTargetProgression
  );
  const nonCnsResponseCode =
    safeParams.nonCnsStatus !== undefined &&
    safeParams.nonCnsStatus !== null &&
    safeParams.nonCnsStatus !== ""
      ? safeParams.nonCnsStatus
      : "not_applicable";
  const priorSrsWithin6Months = Boolean(safeParams.priorSrsWithin6Months);
  const sustained4Weeks = Boolean(safeParams.sustained4Weeks);

  if (!VALID_CORTICOSTEROIDS.has(corticosteroids)) {
    errors.push(
      `Invalid corticosteroids "${String(corticosteroids)}". Expected "none_or_physiologic", "stable_or_decreased", or "increased".`
    );
  }
  if (!VALID_CLINICAL_STATUS.has(neurologicStatus)) {
    errors.push(
      `Invalid neurologicStatus "${String(neurologicStatus)}". Expected "stable_or_improved" or "worse".`
    );
  }
  if (!VALID_NON_CNS_STATUS.has(nonCnsResponseCode)) {
    errors.push(
      `Invalid nonCnsStatus "${String(nonCnsResponseCode)}". Expected one of CR, PR, SD, PD, NE, or not_applicable.`
    );
  }

  let baselineSldMm = NaN;
  let currentSldMm = NaN;
  let rawNadirSldMm = null;
  let targetLesionCount = 0;

  const hasTargetLesionsArray =
    Array.isArray(safeParams.targetLesions) && safeParams.targetLesions.length > 0;
  const hasParallelDiameterArrays =
    !hasTargetLesionsArray &&
    Array.isArray(safeParams.baselineDiametersMm) &&
    safeParams.baselineDiametersMm.length > 0;

  if (hasTargetLesionsArray) {
    let lesions = safeParams.targetLesions;
    if (lesions.length > 5) {
      warnings.push(
        `Supplied ${lesions.length} target CNS lesions; RANO-BM caps target lesions at a maximum of 5 measurable lesions. Only the first 5 lesions are included in SLD.`
      );
      lesions = lesions.slice(0, 5);
    }

    targetLesionCount = lesions.length;
    let sumBaseline = 0;
    let sumCurrent = 0;
    let sumNadir = 0;
    let anyPerLesionNadir = false;

    lesions.forEach((lesion, idx) => {
      const label =
        lesion && lesion.label ? lesion.label : `CNS Target Lesion #${idx + 1}`;
      if (!lesion || typeof lesion !== "object") {
        errors.push(`${label} must be an object with baselineMm and currentMm.`);
        return;
      }

      const bMm = parseRequiredNumber(lesion.baselineMm);
      const cMm = parseRequiredNumber(lesion.currentMm);
      const nMm = parseOptionalNumber(lesion.nadirMm);

      if (Number.isNaN(bMm) || bMm < 0) {
        errors.push(`${label}: baselineMm must be a finite number ≥ 0.`);
      }
      if (Number.isNaN(cMm) || cMm < 0) {
        errors.push(`${label}: currentMm must be a finite number ≥ 0.`);
      }
      if (nMm !== null && (Number.isNaN(nMm) || nMm < 0)) {
        errors.push(`${label}: nadirMm must be null/omitted or a finite number ≥ 0.`);
      }

      if (
        Number.isNaN(bMm) ||
        bMm < 0 ||
        Number.isNaN(cMm) ||
        cMm < 0 ||
        (nMm !== null && (Number.isNaN(nMm) || nMm < 0))
      ) {
        return;
      }

      if (bMm > 0 && bMm < 10 - EPS) {
        warnings.push(
          `${label} baseline diameter (${round1(bMm)} mm) is <10 mm. Per Lin et al. (2015), RANO-BM measurable target lesions require ≥10 mm longest diameter (MRI slice thickness ≤5 mm, ideally ≤1.5 mm isotropic).`
        );
      }

      sumBaseline += bMm;
      sumCurrent += cMm;
      if (nMm !== null) {
        anyPerLesionNadir = true;
        sumNadir += nMm;
      } else {
        sumNadir += bMm;
      }
    });

    baselineSldMm = sumBaseline;
    currentSldMm = sumCurrent;

    if (anyPerLesionNadir) {
      rawNadirSldMm = sumNadir;
    } else {
      const scalarNadir = parseOptionalNumber(safeParams.nadirSldMm);
      if (scalarNadir !== null && (Number.isNaN(scalarNadir) || scalarNadir < 0)) {
        errors.push("nadirSldMm must be null/omitted or a finite number ≥ 0.");
      } else {
        rawNadirSldMm = scalarNadir;
      }
    }
  } else if (hasParallelDiameterArrays) {
    const baseArr = safeParams.baselineDiametersMm;
    const currArr = Array.isArray(safeParams.currentDiametersMm)
      ? safeParams.currentDiametersMm
      : [];
    if (baseArr.length !== currArr.length) {
      errors.push(
        "baselineDiametersMm and currentDiametersMm must have the same length."
      );
    } else {
      let count = baseArr.length;
      if (count > 5) {
        warnings.push(
          `Supplied ${count} target CNS lesions; RANO-BM limits target lesions to a maximum of 5. Only the first 5 lesions are included in SLD.`
        );
        count = 5;
      }
      targetLesionCount = count;
      let sumBaseline = 0;
      let sumCurrent = 0;
      for (let i = 0; i < count; i += 1) {
        const bMm = parseRequiredNumber(baseArr[i]);
        const cMm = parseRequiredNumber(currArr[i]);
        if (Number.isNaN(bMm) || bMm < 0) {
          errors.push(`baselineDiametersMm[${i}] must be a finite number ≥ 0.`);
        }
        if (Number.isNaN(cMm) || cMm < 0) {
          errors.push(`currentDiametersMm[${i}] must be a finite number ≥ 0.`);
        }
        if (!Number.isNaN(bMm) && bMm > 0 && bMm < 10 - EPS) {
          warnings.push(
            `CNS Target Lesion #${i + 1} baseline diameter (${round1(bMm)} mm) is <10 mm (below RANO-BM ≥10 mm measurability criterion).`
          );
        }
        sumBaseline += bMm;
        sumCurrent += cMm;
      }
      baselineSldMm = sumBaseline;
      currentSldMm = sumCurrent;
      const scalarNadir = parseOptionalNumber(safeParams.nadirSldMm);
      if (scalarNadir !== null && (Number.isNaN(scalarNadir) || scalarNadir < 0)) {
        errors.push("nadirSldMm must be null/omitted or a finite number ≥ 0.");
      } else {
        rawNadirSldMm = scalarNadir;
      }
    }
  } else {
    baselineSldMm = parseRequiredNumber(safeParams.baselineSldMm);
    currentSldMm = parseRequiredNumber(safeParams.currentSldMm);
    rawNadirSldMm = parseOptionalNumber(safeParams.nadirSldMm);
    targetLesionCount = 0;

    if (Number.isNaN(baselineSldMm) || baselineSldMm < 0) {
      errors.push("baselineSldMm must be a finite number ≥ 0.");
    }
    if (Number.isNaN(currentSldMm) || currentSldMm < 0) {
      errors.push("currentSldMm must be a finite number ≥ 0.");
    }
    if (
      rawNadirSldMm !== null &&
      (Number.isNaN(rawNadirSldMm) || rawNadirSldMm < 0)
    ) {
      errors.push("nadirSldMm must be null/omitted or a finite number ≥ 0.");
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      standard: "RANO-BM (Lin et al., Lancet Oncology 2015)",
      cnsResponseCode: "INVALID",
      cnsResponseLabel: "Invalid Input Parameters",
      nonCnsResponseCode: VALID_NON_CNS_STATUS.has(nonCnsResponseCode)
        ? nonCnsResponseCode
        : "not_applicable",
      bicompartmentalSummary: "Invalid input parameters.",
      compartmentDiscordance: false,
      severityTier: "neutral",
      targetLesionCount: 0,
      baselineSldMm: 0,
      nadirSldMm: 0,
      currentSldMm: 0,
      absChangeFromNadirMm: 0,
      pctChangeFromBaseline: null,
      pctChangeFromNadir: null,
      pdCriteriaMet: {
        pctGte20: false,
        absGte5mm: false,
        newLesion: false,
        nonTargetPd: false,
        neuroWorse: false
      },
      baselineGuardTriggered: false,
      steroidDowngradeApplied: false,
      confirmationStatus: "Correct invalid input parameters to compute response.",
      rationale: [],
      warnings: [],
      reference: { ...REFERENCES.rano_bm }
    };
  }

  let nadirRef = baselineSldMm;
  if (rawNadirSldMm !== null) {
    if (rawNadirSldMm > baselineSldMm + EPS) {
      warnings.push(
        `Supplied nadir SLD (${round1(rawNadirSldMm)} mm) exceeds baseline SLD (${round1(baselineSldMm)} mm); baseline SLD (${round1(baselineSldMm)} mm) is used as the nadir reference.`
      );
      nadirRef = baselineSldMm;
    } else {
      nadirRef = rawNadirSldMm;
    }
  }

  const rawAbsChangeMm = currentSldMm - nadirRef;
  const rawPctBaseline =
    baselineSldMm > 0
      ? ((currentSldMm - baselineSldMm) / baselineSldMm) * 100
      : null;
  const rawPctNadir =
    nadirRef > 0
      ? ((currentSldMm - nadirRef) / nadirRef) * 100
      : currentSldMm > 0
        ? Infinity
        : 0;

  const pctChangeFromBaseline =
    rawPctBaseline !== null ? round1(rawPctBaseline) : null;
  const pctChangeFromNadir = Number.isFinite(rawPctNadir)
    ? round1(rawPctNadir)
    : rawPctNadir;
  const absChangeFromNadirMm = cleanNum(rawAbsChangeMm);

  if (priorSrsWithin6Months) {
    warnings.push(
      "Prior stereotactic radiosurgery (SRS) within 6 months: radiographic enlargement may represent radiation necrosis or pseudoprogression rather than true CNS progression; consider short-interval repeat MRI, perfusion/MRS, PET, or multidisciplinary review."
    );
  }
  if (corticosteroids === "increased") {
    warnings.push(
      "Increased corticosteroids preclude CNS CR and PR; corticosteroid escalation alone without radiographic or neurologic progression does not define CNS PD."
    );
  }

  // Evaluate CNS PD criteria strictly independently of non-CNS disease
  const pctGte20 = nadirRef > 0 && rawPctNadir >= 20 - EPS;
  const absGte5mm = rawAbsChangeMm >= 5 - EPS;
  const reappearanceFromZero = nadirRef === 0 && currentSldMm > EPS;
  const neuroWorse = neurologicStatus === "worse";

  const pdCriteriaMet = {
    pctGte20,
    absGte5mm,
    newLesion: newCnsLesion,
    nonTargetPd: nonTargetCnsProgression,
    neuroWorse
  };

  const targetSizePd = (pctGte20 && absGte5mm) || reappearanceFromZero;
  const isCnsPd =
    targetSizePd || newCnsLesion || nonTargetCnsProgression || neuroWorse;

  let cnsResponseCode = "SD";
  let cnsResponseLabel = "CNS Stable Disease";
  let severityTier = "stable";
  let baselineGuardTriggered = false;
  let steroidDowngradeApplied = false;
  let confirmationStatus =
    "Continue longitudinal CNS and systemic staging per protocol.";

  if (isCnsPd) {
    cnsResponseCode = "PD";
    cnsResponseLabel = "CNS Progressive Disease";
    severityTier = "progression";
    confirmationStatus = priorSrsWithin6Months
      ? "CNS PD criteria met; however, given SRS within 6 months, verify against radiation necrosis before changing systemic therapy."
      : "Definite CNS Progressive Disease criteria met.";

    if (pctGte20 && absGte5mm) {
      rationale.push(
        `Target CNS SLD increased ${formatSignedPct(rawPctNadir)} (${formatSignedMm(rawAbsChangeMm)}) from nadir ${round1(nadirRef)} mm, satisfying BOTH RANO-BM thresholds (≥+20% AND ≥+5 mm).`
      );
    }
    if (reappearanceFromZero) {
      rationale.push(
        `Reappearance of measurable CNS target lesion(s) (${round1(currentSldMm)} mm) from a nadir SLD of 0 mm.`
      );
    }
    if (newCnsLesion) {
      rationale.push("Appearance of ≥1 new CNS lesion.");
    }
    if (nonTargetCnsProgression) {
      rationale.push("Unequivocal progression of non-target CNS lesion(s).");
    }
    if (neuroWorse) {
      rationale.push(
        "Unequivocal CNS neurological deterioration attributable to intracranial tumor."
      );
    }
  } else if (baselineSldMm === 0) {
    baselineGuardTriggered = true;
    if (!nonTargetCnsPresent) {
      cnsResponseCode = "Non-PD";
      cnsResponseLabel =
        "No Measurable Baseline CNS Disease (Non-PD — CR Not Applicable)";
      severityTier = "neutral";
      confirmationStatus =
        "No measurable or non-target baseline CNS disease present; CR/PR are not applicable.";
      rationale.push(
        "Baseline CNS target SLD is 0 mm with no non-target CNS lesions; CR/PR cannot be assigned without evaluable baseline CNS disease."
      );
    } else {
      cnsResponseCode = "SD";
      cnsResponseLabel =
        "CNS Stable Disease (Non-Target CNS Disease Only — CR Not Applicable)";
      severityTier = "stable";
      confirmationStatus =
        "Non-target CNS disease persists with 0 mm baseline target SLD; monitor for progression or complete resolution.";
      rationale.push(
        "Baseline CNS target SLD is 0 mm while non-target CNS disease persists without progression; classified as CNS SD."
      );
    }
  } else {
    const radCr =
      currentSldMm <= EPS && !nonTargetCnsPresent && !newCnsLesion;
    const radPr = rawPctBaseline <= -30 + EPS;

    if (radCr) {
      if (corticosteroids === "none_or_physiologic") {
        cnsResponseCode = "CR";
        cnsResponseLabel = "CNS Complete Response";
        severityTier = "favorable";
        confirmationStatus = sustained4Weeks
          ? "Confirmed CNS CR (sustained ≥4 weeks)."
          : "Unconfirmed CNS CR — requires confirmatory MRI ≥4 weeks later.";
        rationale.push(
          `Complete disappearance of all measurable CNS target (baseline SLD ${round1(baselineSldMm)} mm → 0 mm) and non-target CNS lesions, off corticosteroids, and neurologically stable/improved.`
        );
      } else if (corticosteroids === "stable_or_decreased") {
        cnsResponseCode = "PR";
        cnsResponseLabel =
          "CNS Partial Response (Downgraded from CR due to Corticosteroids)";
        severityTier = "favorable";
        steroidDowngradeApplied = true;
        confirmationStatus = sustained4Weeks
          ? "Confirmed CNS PR (sustained ≥4 weeks); discontinue therapeutic corticosteroids to meet CNS CR."
          : "Unconfirmed CNS PR — requires confirmatory MRI ≥4 weeks later; CNS CR requires no corticosteroids.";
        rationale.push(
          "Complete radiographic disappearance of CNS lesions achieved, but patient remains on stable/decreased corticosteroids."
        );
        rationale.push(
          "Steroid downgrade rule: RANO-BM requires off-steroid status (none/physiologic) for CNS CR; downgraded to CNS PR."
        );
      } else {
        cnsResponseCode = "SD";
        cnsResponseLabel =
          "CNS Stable Disease (Downgraded from CR due to Increased Corticosteroids)";
        severityTier = "stable";
        steroidDowngradeApplied = true;
        confirmationStatus =
          "Increased corticosteroids preclude CNS CR and PR; classified as CNS SD.";
        rationale.push(
          "Complete radiographic disappearance of CNS lesions occurred, but corticosteroid dose was increased."
        );
        rationale.push(
          "Steroid downgrade rule: Increased corticosteroids preclude CNS CR and PR; downgraded to CNS SD."
        );
      }
    } else if (radPr) {
      if (corticosteroids === "increased") {
        cnsResponseCode = "SD";
        cnsResponseLabel =
          "CNS Stable Disease (Downgraded from PR due to Increased Corticosteroids)";
        severityTier = "stable";
        steroidDowngradeApplied = true;
        confirmationStatus =
          "Increased corticosteroids preclude CNS PR; classified as CNS SD.";
        rationale.push(
          `CNS target SLD decreased ${formatSignedPct(rawPctBaseline)} from baseline (meets ≤-30% PR threshold), but corticosteroid dose was increased.`
        );
        rationale.push(
          "Steroid downgrade rule: Increased corticosteroids preclude CNS PR; downgraded to CNS SD."
        );
      } else {
        cnsResponseCode = "PR";
        cnsResponseLabel = "CNS Partial Response";
        severityTier = "favorable";
        confirmationStatus = sustained4Weeks
          ? "Confirmed CNS PR (sustained ≥4 weeks)."
          : "Unconfirmed CNS PR — requires confirmatory MRI ≥4 weeks later.";
        rationale.push(
          `CNS target SLD decreased ${formatSignedPct(rawPctBaseline)} from baseline (${round1(baselineSldMm)} mm → ${round1(currentSldMm)} mm, meeting RANO-BM PR threshold ≤-30%) with non-increased corticosteroids and stable/improved neurologic status.`
        );
        if (currentSldMm <= EPS && nonTargetCnsPresent) {
          rationale.push(
            "All target CNS lesions resolved to 0 mm, but persistent non-target CNS disease precludes CNS CR (classified as CNS PR)."
          );
        }
      }
    } else {
      cnsResponseCode = "SD";
      cnsResponseLabel = "CNS Stable Disease";
      severityTier = "stable";
      confirmationStatus =
        "Neither CNS PR (≤-30% vs baseline) nor CNS PD criteria met.";
      rationale.push(
        `CNS target SLD changed ${formatSignedPct(rawPctBaseline)} from baseline and ${formatSignedPct(rawPctNadir)} (${formatSignedMm(rawAbsChangeMm)}) from nadir.`
      );
      if (pctGte20 && !absGte5mm) {
        rationale.push(
          `Dual-threshold guard: Relative increase (${formatSignedPct(rawPctNadir)}) is ≥+20%, but absolute increase (${formatSignedMm(rawAbsChangeMm)}) is <+5.0 mm; RANO-BM requires BOTH ≥+20% AND ≥+5 mm from nadir for target-lesion CNS PD.`
        );
      } else if (!pctGte20 && absGte5mm) {
        rationale.push(
          `Dual-threshold guard: Absolute increase (${formatSignedMm(rawAbsChangeMm)}) is ≥+5.0 mm, but relative increase (${formatSignedPct(rawPctNadir)}) is <+20%; RANO-BM requires BOTH ≥+20% AND ≥+5 mm from nadir for target-lesion CNS PD.`
        );
      }
    }
  }

  // Bicompartmental assessment (CNS vs Non-CNS systemic RECIST 1.1)
  const controlledSet = new Set(["CR", "PR", "SD"]);
  const compartmentDiscordance =
    (cnsResponseCode === "PD" && controlledSet.has(nonCnsResponseCode)) ||
    (nonCnsResponseCode === "PD" && controlledSet.has(cnsResponseCode));

  const nonCnsDisplay =
    nonCnsResponseCode === "not_applicable"
      ? "Not Applicable"
      : nonCnsResponseCode;

  const bicompartmentalSummary = compartmentDiscordance
    ? `CNS: ${cnsResponseCode} | Non-CNS (Systemic): ${nonCnsDisplay} — Compartmental Discordance (manage CNS & systemic compartments independently per RANO-BM)`
    : `CNS: ${cnsResponseCode} | Non-CNS (Systemic): ${nonCnsDisplay}`;

  if (compartmentDiscordance) {
    rationale.push(
      `Bicompartmental discordance detected (CNS: ${cnsResponseCode} vs. Non-CNS systemic: ${nonCnsDisplay}). RANO-BM evaluates CNS and systemic compartments separately so discordant local vs. systemic progression informs targeted vs. systemic management.`
    );
  }

  return {
    valid: true,
    errors: [],
    standard: "RANO-BM (Lin et al., Lancet Oncology 2015)",
    cnsResponseCode,
    cnsResponseLabel,
    nonCnsResponseCode,
    bicompartmentalSummary,
    compartmentDiscordance,
    severityTier,
    targetLesionCount,
    baselineSldMm: cleanNum(baselineSldMm),
    nadirSldMm: cleanNum(nadirRef),
    currentSldMm: cleanNum(currentSldMm),
    absChangeFromNadirMm,
    pctChangeFromBaseline,
    pctChangeFromNadir,
    pdCriteriaMet,
    baselineGuardTriggered,
    steroidDowngradeApplied,
    confirmationStatus,
    rationale,
    warnings,
    reference: { ...REFERENCES.rano_bm }
  };
}

/**
 * Calculate RANO-Resect extent-of-resection classification for contrast-enhancing
 * glioblastoma (Karschnia et al., Neuro-Oncology 2023).
 *
 * Strict hierarchical evaluation order:
 *   1. Validation (reject negatives/NaN)
 *   2. Pre-Op CE == 0 -> N/A guard
 *   3. Class 4 (Biopsy): explicit biopsy flag OR <10% CE volume reduction
 *   4. Class 1 vs Class 2A (residual CE == 0): residual non-CE <= 5.0 cm³ -> Class 1; else Class 2A
 *   5. Class 2B: 0 < residual CE <= 1.0 cm³
 *   6. Class 3A: 1.0 < residual CE <= 5.0 cm³
 *   7. Class 3B: residual CE > 5.0 cm³
 *
 * @param {object} params
 * @returns {object}
 */
export function calculateRanoResect(params) {
  const errors = [];
  const warnings = [];
  const rationale = [];

  const safeParams = params && typeof params === "object" ? params : {};

  const preOpCeVolCm3 = parseRequiredNumber(
    safeParams.preOpCeVolCm3 !== undefined
      ? safeParams.preOpCeVolCm3
      : safeParams.preCeCm3
  );
  const postOpCeVolCm3 = parseRequiredNumber(
    safeParams.postOpCeVolCm3 !== undefined
      ? safeParams.postOpCeVolCm3
      : safeParams.residualCeCm3
  );
  const preOpNonCeVolCm3 = parseOptionalNumber(
    safeParams.preOpNonCeVolCm3 !== undefined
      ? safeParams.preOpNonCeVolCm3
      : safeParams.preNonCeCm3
  );
  const postOpNonCeVolCm3 = parseOptionalNumber(
    safeParams.postOpNonCeVolCm3 !== undefined
      ? safeParams.postOpNonCeVolCm3
      : safeParams.residualNonCeCm3
  );
  const isBiopsyProcedure = Boolean(
    safeParams.isBiopsyProcedure !== undefined
      ? safeParams.isBiopsyProcedure
      : safeParams.isBiopsy
  );
  const postOpMriTimingHours = parseOptionalNumber(
    safeParams.postOpMriTimingHours
  );

  if (Number.isNaN(preOpCeVolCm3) || preOpCeVolCm3 < 0) {
    errors.push("preOpCeVolCm3 must be a finite number ≥ 0.");
  }
  if (Number.isNaN(postOpCeVolCm3) || postOpCeVolCm3 < 0) {
    errors.push("postOpCeVolCm3 must be a finite number ≥ 0.");
  }
  if (
    preOpNonCeVolCm3 !== null &&
    (Number.isNaN(preOpNonCeVolCm3) || preOpNonCeVolCm3 < 0)
  ) {
    errors.push("preOpNonCeVolCm3 must be null/omitted or a finite number ≥ 0.");
  }
  if (
    postOpNonCeVolCm3 !== null &&
    (Number.isNaN(postOpNonCeVolCm3) || postOpNonCeVolCm3 < 0)
  ) {
    errors.push(
      "postOpNonCeVolCm3 must be null/omitted or a finite number ≥ 0."
    );
  }
  if (
    postOpMriTimingHours !== null &&
    (Number.isNaN(postOpMriTimingHours) || postOpMriTimingHours < 0)
  ) {
    errors.push(
      "postOpMriTimingHours must be null/omitted or a finite number ≥ 0."
    );
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      standard: "RANO-Resect (Karschnia et al., Neuro-Oncology 2023)",
      resectClass: "INVALID",
      className: "Invalid Input Parameters",
      categoryGroup: "Invalid",
      severityTier: "neutral",
      preOpCeVolCm3: 0,
      postOpCeVolCm3: 0,
      ceReductionPct: null,
      postOpNonCeVolCm3: null,
      nonCeReductionPct: null,
      naGuardTriggered: false,
      rationale: [],
      warnings: [],
      reference: { ...REFERENCES.rano_resect }
    };
  }

  if (postOpMriTimingHours !== null && postOpMriTimingHours > 72 + EPS) {
    warnings.push(
      `Post-operative MRI acquired at ${round1(postOpMriTimingHours)} hours (>72 h): reactive surgical enhancement may inflate apparent residual CE volume. Standard RANO-Resect volumetry requires early post-op MRI within 24–72 hours.`
    );
  }

  // Reference Non-CE volumetric EOR% when both pre- and post-op non-CE volumes are available
  const rawNonCeReductionPct =
    preOpNonCeVolCm3 !== null &&
    preOpNonCeVolCm3 > 0 &&
    postOpNonCeVolCm3 !== null
      ? ((preOpNonCeVolCm3 - postOpNonCeVolCm3) / preOpNonCeVolCm3) * 100
      : null;
  const nonCeReductionPct =
    rawNonCeReductionPct !== null ? round1(rawNonCeReductionPct) : null;

  // Step 2: Explicit N/A Guard when pre-op CE volume is 0
  if (preOpCeVolCm3 <= EPS) {
    if (postOpCeVolCm3 > EPS) {
      warnings.push(
        `Post-operative CE volume (${round1(postOpCeVolCm3)} cm³) is >0 despite 0 cm³ pre-operative CE volume; verify segmentation or post-operative blood products / reactive enhancement.`
      );
    }
    rationale.push(
      "Pre-operative contrast-enhancing (CE) tumor volume is 0 cm³; standard CE glioblastoma RANO-Resect classes (Karschnia et al., 2023) do not apply."
    );
    rationale.push(
      "For primarily non-enhancing / IDH-mutant diffuse gliomas, evaluate extent of resection using non-CE FLAIR/T2 volumetric frameworks (Karschnia et al., 2023/2024)."
    );

    return {
      valid: true,
      errors: [],
      standard: "RANO-Resect (Karschnia et al., Neuro-Oncology 2023)",
      resectClass: "N/A",
      className: "Not Applicable — No Pre-Op Contrast-Enhancing Tumor",
      categoryGroup: "Not Applicable",
      severityTier: "neutral",
      preOpCeVolCm3: cleanNum(preOpCeVolCm3),
      postOpCeVolCm3: cleanNum(postOpCeVolCm3),
      ceReductionPct: null,
      postOpNonCeVolCm3:
        postOpNonCeVolCm3 !== null ? cleanNum(postOpNonCeVolCm3) : null,
      nonCeReductionPct,
      naGuardTriggered: true,
      rationale,
      warnings,
      reference: { ...REFERENCES.rano_resect }
    };
  }

  // Step 3: Compute CE volumetric reduction %
  const rawCeReductionPct =
    ((preOpCeVolCm3 - postOpCeVolCm3) / preOpCeVolCm3) * 100;
  const ceReductionPct = round1(rawCeReductionPct);

  if (postOpCeVolCm3 > preOpCeVolCm3 + EPS) {
    warnings.push(
      `Post-operative residual CE volume (${round1(postOpCeVolCm3)} cm³) exceeds pre-operative CE volume (${round1(preOpCeVolCm3)} cm³); confirm segmentation accuracy or exclude acute post-op hemorrhage/ischemia.`
    );
  }

  let resectClass;
  let className;
  let categoryGroup;
  let severityTier;

  // Step 4: Class 4 (Biopsy) evaluated BEFORE absolute residual thresholds
  // Karschnia et al. (2023) defines Class 4 as biopsy only / no tumor volume reduction.
  // For large partial debulkings (residual CE > 5.0 cm³ with positive reduction and isBiopsyProcedure=false),
  // classify as Class 3B (Partial CE Resection) rather than unconditionally forcing Class 4 on <10% EOR.
  // An operational <10% guard is retained only when residual CE <= 5.0 cm³ so tiny biopsied lesions
  // (e.g., 3.0 -> 2.8 cm³) are not misclassified as Class 3A/2B subtotal/near-total resections.
  const noVolumeReduction = rawCeReductionPct <= EPS;
  const smallLesionMinimalReduction =
    postOpCeVolCm3 <= 5 + EPS && rawCeReductionPct < 10 - EPS;

  if (isBiopsyProcedure || noVolumeReduction || smallLesionMinimalReduction) {
    resectClass = "Class 4";
    className = "Biopsy";
    categoryGroup = "Biopsy";
    severityTier = "poor";

    if (isBiopsyProcedure) {
      rationale.push(
        "Procedure explicitly flagged as surgical biopsy → RANO-Resect Class 4 (Biopsy)."
      );
    }
    if (noVolumeReduction) {
      rationale.push(
        `No CE tumor volume reduction (${ceReductionPct.toFixed(1)}% EOR; pre-op ${cleanNum(preOpCeVolCm3)} cm³ → residual ${cleanNum(postOpCeVolCm3)} cm³), meeting Karschnia et al. (2023) RANO-Resect Class 4 (Biopsy / no volume reduction).`
      );
    } else if (smallLesionMinimalReduction && !isBiopsyProcedure) {
      rationale.push(
        `Small-lesion biopsy guard: CE volume reduction is ${ceReductionPct.toFixed(1)}% (<10%) with residual CE ${cleanNum(postOpCeVolCm3)} cm³ (≤5.0 cm³), operationally classified as RANO-Resect Class 4 (Biopsy) to avoid misclassifying a minimally sampled small tumor as Class 3A/2B.`
      );
      warnings.push(
        "Karschnia et al. (2023) formally defines Class 4 as biopsy only / no tumor volume reduction; the <10% rule is applied here operationally for small lesions (residual CE ≤5.0 cm³). Confirm operative intent (biopsy vs. cytoreductive resection)."
      );
    }
  } else if (postOpCeVolCm3 <= EPS) {
    // Step 5: 0 cm³ residual CE -> Class 1 vs Class 2A
    if (postOpNonCeVolCm3 !== null && postOpNonCeVolCm3 <= 5 + EPS) {
      resectClass = "Class 1";
      className = "Supramaximal CE Resection";
      categoryGroup = "Supramaximal";
      severityTier = "favorable";
      rationale.push(
        `Complete removal of contrast-enhancing tumor (0.0 cm³ residual CE; CE EOR ${ceReductionPct.toFixed(1)}%) AND residual non-CE (FLAIR) volume ≤5.0 cm³ (${cleanNum(postOpNonCeVolCm3)} cm³) → RANO-Resect Class 1.`
      );
      if (rawNonCeReductionPct !== null && rawNonCeReductionPct < 60 - EPS) {
        rationale.push(
          `Note: Non-CE volumetric reduction (${nonCeReductionPct.toFixed(1)}%) is below the supplemental ≥60% non-CE reduction criterion discussed in Karschnia et al. (2023), although absolute residual non-CE volume (≤5.0 cm³) meets the primary Class 1 threshold.`
        );
      }
    } else {
      resectClass = "Class 2A";
      className = "Complete CE Resection";
      categoryGroup = "Maximal";
      severityTier = "good";
      if (postOpNonCeVolCm3 === null) {
        rationale.push(
          `Complete removal of contrast-enhancing tumor (0.0 cm³ residual CE; CE EOR ${ceReductionPct.toFixed(1)}%) → RANO-Resect Class 2A (Maximal).`
        );
        rationale.push(
          "Residual non-CE (FLAIR) volume was not supplied, so Class 1 (Supramaximal CE Resection, requiring ≤5.0 cm³ residual non-CE) could not be verified."
        );
        warnings.push(
          "Residual non-CE volume omitted: provide post-op non-CE (FLAIR) volume to distinguish Class 1 (≤5.0 cm³) from Class 2A (>5.0 cm³)."
        );
      } else {
        rationale.push(
          `Complete removal of contrast-enhancing tumor (0.0 cm³ residual CE; CE EOR ${ceReductionPct.toFixed(1)}%) with residual non-CE volume ${cleanNum(postOpNonCeVolCm3)} cm³ (>5.0 cm³) → RANO-Resect Class 2A (Maximal).`
        );
      }
    }
  } else if (postOpCeVolCm3 <= 1 + EPS) {
    // Step 6: 0 < residual CE <= 1.0 cm³ -> Class 2B
    resectClass = "Class 2B";
    className = "Near-Total CE Resection";
    categoryGroup = "Maximal";
    severityTier = "good";
    rationale.push(
      `Residual CE volume is ${cleanNum(postOpCeVolCm3)} cm³ (0 < residual CE ≤ 1.0 cm³; CE EOR ${ceReductionPct.toFixed(1)}%) → RANO-Resect Class 2B (Maximal — Near-Total CE Resection).`
    );
  } else if (postOpCeVolCm3 <= 5 + EPS) {
    // Step 7: 1.0 < residual CE <= 5.0 cm³ -> Class 3A
    resectClass = "Class 3A";
    className = "Subtotal CE Resection";
    categoryGroup = "Submaximal";
    severityTier = "moderate";
    rationale.push(
      `Residual CE volume is ${cleanNum(postOpCeVolCm3)} cm³ (1.0 < residual CE ≤ 5.0 cm³; CE EOR ${ceReductionPct.toFixed(1)}%) → RANO-Resect Class 3A (Submaximal — Subtotal CE Resection).`
    );
  } else {
    // Step 8: residual CE > 5.0 cm³ -> Class 3B
    resectClass = "Class 3B";
    className = "Partial CE Resection";
    categoryGroup = "Submaximal";
    severityTier = "poor";
    rationale.push(
      `Residual CE volume is ${cleanNum(postOpCeVolCm3)} cm³ (>5.0 cm³; CE EOR ${ceReductionPct.toFixed(1)}%) → RANO-Resect Class 3B (Submaximal — Partial CE Resection).`
    );
    if (rawCeReductionPct < 10 - EPS) {
      warnings.push(
        `Low CE volumetric reduction (${ceReductionPct.toFixed(1)}%, <10%) with >5.0 cm³ residual CE: classified as Class 3B (Partial CE Resection) per Karschnia et al. (2023) because positive volume reduction occurred and biopsy was not flagged. If this procedure was a biopsy only without intended debulking, enable 'Explicit Surgical Biopsy Procedure' for Class 4.`
      );
    }
  }

  if (nonCeReductionPct !== null) {
    rationale.push(
      `Reference Non-CE (FLAIR) volumetric reduction: ${nonCeReductionPct.toFixed(1)}% (pre-op ${cleanNum(preOpNonCeVolCm3)} cm³ → residual ${cleanNum(postOpNonCeVolCm3)} cm³).`
    );
  }

  return {
    valid: true,
    errors: [],
    standard: "RANO-Resect (Karschnia et al., Neuro-Oncology 2023)",
    resectClass,
    className,
    categoryGroup,
    severityTier,
    preOpCeVolCm3: cleanNum(preOpCeVolCm3),
    postOpCeVolCm3: cleanNum(postOpCeVolCm3),
    ceReductionPct,
    postOpNonCeVolCm3:
      postOpNonCeVolCm3 !== null ? cleanNum(postOpNonCeVolCm3) : null,
    nonCeReductionPct,
    naGuardTriggered: false,
    rationale,
    warnings,
    reference: { ...REFERENCES.rano_resect }
  };
}

/**
 * Format a clean, structured plain-text clinical research / tumor-board summary note
 * stamped explicitly as Research & Educational Use Only (Non-SaMD).
 *
 * @param {"rano2" | "rano_bm" | "rano_resect"} calcType
 * @param {object} result
 * @param {object} [inputs]
 * @returns {string}
 */
export function formatClinicalSummary(calcType, result, inputs = {}) {
  const safeResult = result && typeof result === "object" ? result : {};
  const safeInputs = inputs && typeof inputs === "object" ? inputs : {};
  const lines = [];

  const disclaimer =
    "NOTICE: For Research & Educational Use Only — Not a Certified Medical Device (Non-SaMD). Do not include PHI.";

  lines.push("======================================================================");
  lines.push("CNS5-AUDIT CLINICAL RESEARCH SUMMARY");
  lines.push(disclaimer);
  lines.push("======================================================================");

  if (!safeResult.valid) {
    lines.push(`Calculator: ${String(calcType || "unknown")}`);
    lines.push("Status: INVALID INPUT");
    if (Array.isArray(safeResult.errors) && safeResult.errors.length > 0) {
      lines.push("Validation Errors:");
      safeResult.errors.forEach((err) => lines.push(`  - ${err}`));
    }
    lines.push("----------------------------------------------------------------------");
    lines.push("For Research & Educational Use Only — Not a Certified Medical Device.");
    return lines.join("\n");
  }

  if (calcType === "rano2") {
    const modeLabel =
      safeResult.tumorMode === "non_enhancing_lgg"
        ? "Non-Enhancing / Low-Grade Glioma (LGG)"
        : "Enhancing / High-Grade Glioma (HGG)";
    const metricLabel =
      safeResult.measurementType === "3d_volume"
        ? "3D Volume (cm³)"
        : "2D Sum of Products of Perpendicular Diameters — SPD (mm²)";
    const unit = safeResult.unit || "mm²";
    const hasSteroidInput =
      safeInputs.corticosteroids !== undefined || safeInputs.steroids !== undefined;
    const hasClinicalInput = safeInputs.clinicalStatus !== undefined;
    const hasRtInput =
      safeInputs.within12WeeksPostRt !== undefined ||
      safeInputs.within12WeeksPostRT !== undefined;
    const steroidVal = hasSteroidInput
      ? normalizeCorticosteroids(
          safeInputs.corticosteroids !== undefined
            ? safeInputs.corticosteroids
            : safeInputs.steroids
        )
      : null;
    const clinVal = hasClinicalInput
      ? normalizeClinicalStatus(safeInputs.clinicalStatus)
      : null;
    const within12w = hasRtInput
      ? Boolean(
          safeInputs.within12WeeksPostRt !== undefined
            ? safeInputs.within12WeeksPostRt
            : safeInputs.within12WeeksPostRT
        )
      : null;

    lines.push(`Standard: ${safeResult.standard}`);
    lines.push(`Track / Metric: ${modeLabel} | ${metricLabel}`);
    lines.push("----------------------------------------------------------------------");
    lines.push(
      `CLASSIFICATION: ${safeResult.responseCode} — ${safeResult.responseLabel}`
    );
    lines.push("----------------------------------------------------------------------");
    lines.push("Measurements:");
    if (safeInputs.baselineValue !== undefined) {
      lines.push(`  Baseline: ${cleanNum(parseRequiredNumber(safeInputs.baselineValue))} ${unit}`);
    }
    lines.push(`  Nadir Reference: ${safeResult.nadirReference} ${unit}`);
    if (safeInputs.currentValue !== undefined) {
      lines.push(`  Current: ${cleanNum(parseRequiredNumber(safeInputs.currentValue))} ${unit}`);
    }
    lines.push(
      `  Change vs. Baseline: ${formatSignedPct(safeResult.pctChangeFromBaseline)}`
    );
    lines.push(
      `  Change vs. Nadir: ${formatSignedPct(safeResult.pctChangeFromNadir)}`
    );
    lines.push("Clinical Modifiers:");
    if (steroidVal !== null) {
      lines.push(`  Corticosteroids: ${formatSteroidLabel(steroidVal)}`);
    }
    if (clinVal !== null) {
      lines.push(`  Clinical Status: ${formatClinicalStatusLabel(clinVal)}`);
    }
    if (within12w !== null) {
      lines.push(`  ≤12 Weeks Post-RT: ${within12w ? "Yes" : "No"}`);
    }
    if (safeResult.steroidDowngradeApplied) {
      lines.push("  Modifier Flag: Corticosteroid downgrade applied");
    }
    if (safeResult.preliminaryPdRuleApplied) {
      lines.push("  Modifier Flag: ≤12-week post-RT Preliminary PD guard applied");
    }
    if (safeResult.baselineGuardTriggered) {
      lines.push("  Modifier Flag: Baseline = 0 CR guard triggered");
    }
    lines.push(`Confirmation Guidance: ${safeResult.confirmationStatus}`);
  } else if (calcType === "rano_bm") {
    const hasSteroidInput =
      safeInputs.corticosteroids !== undefined || safeInputs.steroids !== undefined;
    const hasNeuroInput =
      safeInputs.neurologicStatus !== undefined ||
      safeInputs.clinicalStatus !== undefined;
    const steroidVal = hasSteroidInput
      ? normalizeCorticosteroids(
          safeInputs.corticosteroids !== undefined
            ? safeInputs.corticosteroids
            : safeInputs.steroids
        )
      : null;
    const neuroVal = hasNeuroInput
      ? normalizeClinicalStatus(
          safeInputs.neurologicStatus !== undefined
            ? safeInputs.neurologicStatus
            : safeInputs.clinicalStatus
        )
      : null;

    lines.push(`Standard: ${safeResult.standard}`);
    lines.push("----------------------------------------------------------------------");
    lines.push(
      `CNS CLASSIFICATION: ${safeResult.cnsResponseCode} — ${safeResult.cnsResponseLabel}`
    );
    lines.push(`BICOMPARTMENTAL SUMMARY: ${safeResult.bicompartmentalSummary}`);
    lines.push("----------------------------------------------------------------------");
    lines.push("CNS Target Measurements (SLD):");
    if (safeResult.targetLesionCount > 0) {
      lines.push(`  Target CNS Lesions Evaluated: ${safeResult.targetLesionCount}`);
    }
    lines.push(`  Baseline SLD: ${safeResult.baselineSldMm} mm`);
    lines.push(`  Nadir SLD: ${safeResult.nadirSldMm} mm`);
    lines.push(`  Current SLD: ${safeResult.currentSldMm} mm`);
    lines.push(
      `  Change vs. Baseline: ${formatSignedPct(safeResult.pctChangeFromBaseline)}`
    );
    lines.push(
      `  Change vs. Nadir: ${formatSignedPct(safeResult.pctChangeFromNadir)} (${formatSignedMm(safeResult.absChangeFromNadirMm)})`
    );
    lines.push("Clinical & Compartmental Modifiers:");
    if (steroidVal !== null) {
      lines.push(`  Corticosteroids: ${formatSteroidLabel(steroidVal)}`);
    }
    if (neuroVal !== null) {
      lines.push(`  Neurologic Status: ${formatClinicalStatusLabel(neuroVal)}`);
    }
    lines.push(`  Non-CNS (Systemic) Status: ${safeResult.nonCnsResponseCode}`);
    lines.push(
      `  Compartmental Discordance: ${safeResult.compartmentDiscordance ? "YES" : "No"}`
    );
    lines.push(`Confirmation Guidance: ${safeResult.confirmationStatus}`);
  } else if (calcType === "rano_resect") {
    lines.push(`Standard: ${safeResult.standard}`);
    lines.push("----------------------------------------------------------------------");
    lines.push(
      `CLASSIFICATION: ${safeResult.resectClass} — ${safeResult.className} (${safeResult.categoryGroup})`
    );
    lines.push("----------------------------------------------------------------------");
    lines.push("Volumetric Summary:");
    lines.push(`  Pre-Op CE Volume: ${safeResult.preOpCeVolCm3} cm³`);
    lines.push(`  Residual Post-Op CE Volume: ${safeResult.postOpCeVolCm3} cm³`);
    lines.push(
      `  CE Volumetric Reduction (EOR): ${
        safeResult.ceReductionPct !== null
          ? `${safeResult.ceReductionPct.toFixed(1)}%`
          : "N/A"
      }`
    );
    lines.push(
      `  Residual Non-CE (FLAIR) Volume: ${
        safeResult.postOpNonCeVolCm3 !== null
          ? `${safeResult.postOpNonCeVolCm3} cm³`
          : "Not supplied"
      }`
    );
    if (safeResult.nonCeReductionPct !== null) {
      lines.push(
        `  Non-CE Volumetric Reduction (Reference): ${safeResult.nonCeReductionPct.toFixed(1)}%`
      );
    }
  } else {
    lines.push(`Calculator: ${String(calcType || "unknown")}`);
    lines.push(`Standard: ${safeResult.standard || "Unspecified"}`);
  }

  if (Array.isArray(safeResult.rationale) && safeResult.rationale.length > 0) {
    lines.push("Decision Rationale:");
    safeResult.rationale.forEach((item) => lines.push(`  • ${item}`));
  }

  if (Array.isArray(safeResult.warnings) && safeResult.warnings.length > 0) {
    lines.push("Clinical & Methodological Notes / Warnings:");
    safeResult.warnings.forEach((warn) => lines.push(`  ! ${warn}`));
  }

  if (safeResult.reference && safeResult.reference.citation) {
    const doiSuffix = safeResult.reference.doi
      ? ` doi:${safeResult.reference.doi}`
      : "";
    lines.push(`Reference: ${safeResult.reference.citation}${doiSuffix}`);
  }

  lines.push("======================================================================");
  lines.push("For Research & Educational Use Only — Not a Certified Medical Device.");
  return lines.join("\n");
}
