/**
 * CNS5-Audit — Main Studio Orchestration & DOM Controller
 *
 * Pure native ES Module (zero external dependencies, zero build step, 100% browser-local).
 * Wires:
 *   1. WHO CNS5 (2021) Integrated Molecular-Histological Classifier
 *   2. Multi-Standard RANO Calculators (RANO 2.0, RANO-BM, RANO-Resect)
 *   3. Neuro-AI Leakage & Reporting Auditor (CLAIM 2024 + TRIPOD+AI)
 *
 * All dynamic/user-supplied strings are strictly HTML-escaped prior to DOM insertion.
 */

import {
  CNS5_FAMILIES,
  SAMPLE_CNS5_CASES,
  getDefaultCns5Input,
  getFamilyFormConfig,
  classifyCns5,
  formatCns5Report
} from "./cns5Engine.js";

import {
  computeSpdFromLesions,
  calculateRano2,
  calculateRanoBm,
  calculateRanoResect,
  formatClinicalSummary
} from "./ranoCalculators.js";

import {
  SEVERITY_WEIGHTS,
  CRITICAL_BLOCKER_SCORE_CAP,
  scoreAudit,
  exportAuditMarkdown,
  exportAuditLatex,
  exportAuditBadgeSvg,
  exportAuditJson,
  validateImportedAuditJson
} from "./auditEngine.js";

import {
  renderRadarChart,
  renderDecisionTrace,
  renderResectGauge,
  renderResponseGauge
} from "./visuals.js";

/* ==========================================================================
   Constants & Storage Keys
   ========================================================================== */

const STORAGE_KEYS = Object.freeze({
  theme: "cns5audit.v1.theme",
  activeTab: "cns5audit.v1.activeTab",
  cns5State: "cns5audit.v1.cns5State",
  ranoState: "cns5audit.v1.ranoState",
  auditState: "cns5audit.v1.auditState"
});

const CANONICAL_META_KEYS = [
  "title",
  "authors",
  "year",
  "taskType",
  "modality",
  "cohortSummary",
  "reviewer"
];

/* ==========================================================================
   Clinical Scenario Presets for RANO Calculators
   ========================================================================== */

const RANO_PRESETS = Object.freeze({
  rano2: [
    {
      id: "r2_prelim_pd",
      label: "≤12w Post-RT Rad PD (Prelim-PD)",
      tag: "Pseudoprogression Guard",
      description: "Enhancing HGG with +50% SPD increase inside RT field within 12 weeks post-RT and stable clinical status -> Preliminary PD requiring ≥4-week confirmation.",
      values: {
        tumorMode: "enhancing_hgg",
        measurementType: "2d_spd",
        baselineValue: 400,
        nadirValue: 400,
        currentValue: 600,
        corticosteroids: "stable_or_decreased",
        clinicalStatus: "stable_or_improved",
        newMeasurableLesion: false,
        nonMeasurablePresent: false,
        nonMeasurableProgression: false,
        within12WeeksPostRt: true,
        outsideRtField: false,
        sustained4Weeks: false
      }
    },
    {
      id: "r2_monotonic_pd",
      label: "≤12w Post-RT + Clinical Decline (PD)",
      tag: "Monotonicity",
      description: "Same ≤12-week post-RT imaging progression paired with unequivocal clinical deterioration -> Definite PD (monotonicity rule never downgrades clinical PD).",
      values: {
        tumorMode: "enhancing_hgg",
        measurementType: "2d_spd",
        baselineValue: 400,
        nadirValue: 400,
        currentValue: 600,
        corticosteroids: "stable_or_decreased",
        clinicalStatus: "worse",
        newMeasurableLesion: false,
        nonMeasurablePresent: false,
        nonMeasurableProgression: false,
        within12WeeksPostRt: true,
        outsideRtField: false,
        sustained4Weeks: false
      }
    },
    {
      id: "r2_lgg_mr_3d",
      label: "LGG 3D Minor Response (-50% Vol)",
      tag: "LGG 3D MR",
      description: "Non-enhancing IDH-mutant LGG with 50% 3D volume shrinkage (20 -> 10 cm³, between -40% and -65%) -> Minor Response (MR applies exclusively to LGG).",
      values: {
        tumorMode: "non_enhancing_lgg",
        measurementType: "3d_volume",
        baselineValue: 20,
        nadirValue: 20,
        currentValue: 10,
        corticosteroids: "stable_or_decreased",
        clinicalStatus: "stable_or_improved",
        newMeasurableLesion: false,
        nonMeasurablePresent: false,
        nonMeasurableProgression: false,
        within12WeeksPostRt: false,
        outsideRtField: false,
        sustained4Weeks: true
      }
    },
    {
      id: "r2_cr_steroid_downgrade",
      label: "Radiographic CR on Steroids -> PR",
      tag: "Steroid Downgrade",
      description: "Complete disappearance of enhancing disease (400 -> 0 mm²) while still on stable therapeutic dexamethasone -> downgraded from CR to PR.",
      values: {
        tumorMode: "enhancing_hgg",
        measurementType: "2d_spd",
        baselineValue: 400,
        nadirValue: 400,
        currentValue: 0,
        corticosteroids: "stable_or_decreased",
        clinicalStatus: "stable_or_improved",
        newMeasurableLesion: false,
        nonMeasurablePresent: false,
        nonMeasurableProgression: false,
        within12WeeksPostRt: false,
        outsideRtField: false,
        sustained4Weeks: true
      }
    },
    {
      id: "r2_base_zero_guard",
      label: "Baseline = 0 Post-GTR Guard (Non-PD)",
      tag: "CR Guard",
      description: "No measurable or non-measurable baseline enhancing disease post-GTR (0 -> 0 mm²) -> Non-PD (prevents invalid CR assignment without baseline tumor).",
      values: {
        tumorMode: "enhancing_hgg",
        measurementType: "2d_spd",
        baselineValue: 0,
        nadirValue: 0,
        currentValue: 0,
        corticosteroids: "none_or_physiologic",
        clinicalStatus: "stable_or_improved",
        newMeasurableLesion: false,
        nonMeasurablePresent: false,
        nonMeasurableProgression: false,
        within12WeeksPostRt: false,
        outsideRtField: false,
        sustained4Weeks: false
      }
    }
  ],
  rano_bm: [
    {
      id: "bm_discordance",
      label: "CNS PR + Systemic PD (Discordance)",
      tag: "Bicompartmental",
      description: "Two measurable brain metastases shrink -40% (30 -> 18 mm SLD -> CNS PR) while extracranial disease progresses (Non-CNS PD) -> Compartmental Discordance.",
      mode: "lesions",
      values: {
        targetLesions: [
          { label: "R Frontal Met", baselineMm: 16, nadirMm: null, currentMm: 10 },
          { label: "L Cerebellar Met", baselineMm: 14, nadirMm: null, currentMm: 8 }
        ],
        baselineSldMm: 30,
        nadirSldMm: null,
        currentSldMm: 18,
        corticosteroids: "stable_or_decreased",
        neurologicStatus: "stable_or_improved",
        newCnsLesion: false,
        nonTargetCnsPresent: false,
        nonTargetCnsProgression: false,
        nonCnsStatus: "PD",
        priorSrsWithin6Months: false,
        sustained4Weeks: true
      }
    },
    {
      id: "bm_dual_guard_sd",
      label: "+26.7% but +4mm (<5mm Guard -> SD)",
      tag: "Dual Threshold",
      description: "SLD grows from 15 mm to 19 mm (+26.7%, +4 mm). Because RANO-BM requires BOTH ≥+20% AND ≥+5 mm absolute increase from nadir, this remains CNS SD.",
      mode: "sld",
      values: {
        targetLesions: [
          { label: "L Parietal Met", baselineMm: 15, nadirMm: 15, currentMm: 19 }
        ],
        baselineSldMm: 15,
        nadirSldMm: 15,
        currentSldMm: 19,
        corticosteroids: "none_or_physiologic",
        neurologicStatus: "stable_or_improved",
        newCnsLesion: false,
        nonTargetCnsPresent: false,
        nonTargetCnsProgression: false,
        nonCnsStatus: "SD",
        priorSrsWithin6Months: false,
        sustained4Weeks: false
      }
    },
    {
      id: "bm_dual_pd_srs",
      label: "+33.3% & +5mm PD + Recent SRS Caution",
      tag: "SRS Necrosis",
      description: "SLD increases 15 -> 20 mm (+33.3% AND +5 mm) within 6 months of stereotactic radiosurgery -> CNS PD with radiation necrosis verification caution.",
      mode: "lesions",
      values: {
        targetLesions: [
          { label: "R Temporal SRS Cavity", baselineMm: 15, nadirMm: 15, currentMm: 20 }
        ],
        baselineSldMm: 15,
        nadirSldMm: 15,
        currentSldMm: 20,
        corticosteroids: "stable_or_decreased",
        neurologicStatus: "stable_or_improved",
        newCnsLesion: false,
        nonTargetCnsPresent: false,
        nonTargetCnsProgression: false,
        nonCnsStatus: "PR",
        priorSrsWithin6Months: true,
        sustained4Weeks: false
      }
    },
    {
      id: "bm_cns_cr",
      label: "Confirmed CNS CR (Off Steroids)",
      tag: "Complete Response",
      description: "Resolution of all target and non-target CNS metastases off corticosteroids with stable neurologic status sustained ≥4 weeks -> CNS CR.",
      mode: "lesions",
      values: {
        targetLesions: [
          { label: "R Occipital Met", baselineMm: 14, nadirMm: null, currentMm: 0 },
          { label: "L Frontal Met", baselineMm: 12, nadirMm: null, currentMm: 0 }
        ],
        baselineSldMm: 26,
        nadirSldMm: null,
        currentSldMm: 0,
        corticosteroids: "none_or_physiologic",
        neurologicStatus: "stable_or_improved",
        newCnsLesion: false,
        nonTargetCnsPresent: false,
        nonTargetCnsProgression: false,
        nonCnsStatus: "PR",
        priorSrsWithin6Months: false,
        sustained4Weeks: true
      }
    }
  ],
  rano_resect: [
    {
      id: "res_class1",
      label: "Class 1 — Supramaximal (0 CE, ≤5 nCE)",
      tag: "Class 1",
      description: "0 cm³ residual CE tumor AND 4.2 cm³ residual non-CE FLAIR (≤5.0 cm³) on 36h post-op MRI -> Class 1 Supramaximal CE Resection.",
      values: {
        preOpCeVolCm3: 25.0,
        postOpCeVolCm3: 0,
        preOpNonCeVolCm3: 32.0,
        postOpNonCeVolCm3: 4.2,
        postOpMriTimingHours: 36,
        isBiopsyProcedure: false
      }
    },
    {
      id: "res_class2a",
      label: "Class 2A — Complete CE (0 CE, >5 nCE)",
      tag: "Class 2A",
      description: "0 cm³ residual CE tumor with 8.5 cm³ residual non-CE FLAIR (>5.0 cm³) -> Class 2A Complete CE Resection (Maximal).",
      values: {
        preOpCeVolCm3: 25.0,
        postOpCeVolCm3: 0,
        preOpNonCeVolCm3: 30.0,
        postOpNonCeVolCm3: 8.5,
        postOpMriTimingHours: 48,
        isBiopsyProcedure: false
      }
    },
    {
      id: "res_class2b",
      label: "Class 2B — Near-Total (0.8 cm³ CE)",
      tag: "Class 2B",
      description: "Small residual CE rim (0.8 cm³, ≤1.0 cm³ threshold) -> Class 2B Near-Total CE Resection (Maximal).",
      values: {
        preOpCeVolCm3: 28.0,
        postOpCeVolCm3: 0.8,
        preOpNonCeVolCm3: 35.0,
        postOpNonCeVolCm3: 11.0,
        postOpMriTimingHours: 40,
        isBiopsyProcedure: false
      }
    },
    {
      id: "res_class4_small",
      label: "Class 4 — Small Biopsy (<10% EOR Guard)",
      tag: "Biopsy Priority",
      description: "Small deep lesion (3.0 -> 2.8 cm³, 6.7% reduction <10%). Operational small-lesion biopsy guard (residual CE ≤5 cm³ with <10% reduction) prevents misclassification as Class 3A, whereas large partial debulkings (>5 cm³ residual with positive volume reduction) classify as Class 3B.",
      values: {
        preOpCeVolCm3: 3.0,
        postOpCeVolCm3: 2.8,
        preOpNonCeVolCm3: null,
        postOpNonCeVolCm3: null,
        postOpMriTimingHours: 24,
        isBiopsyProcedure: false
      }
    },
    {
      id: "res_na_non_ce",
      label: "N/A Guard — Non-Enhancing Glioma (0 CE)",
      tag: "N/A Guard",
      description: "Pre-operative CE volume is 0 cm³ -> N/A Guard directs evaluation to non-CE FLAIR volumetric frameworks for IDH-mutant/non-enhancing glioma.",
      values: {
        preOpCeVolCm3: 0,
        postOpCeVolCm3: 0,
        preOpNonCeVolCm3: 22.0,
        postOpNonCeVolCm3: 3.5,
        postOpMriTimingHours: 48,
        isBiopsyProcedure: false
      }
    }
  ]
});

/* ==========================================================================
   Utility Helpers (Security, Storage, Clipboard, Downloads)
   ========================================================================== */

const HTML_ESCAPE_MAP = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
});

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

function readStorage(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (_err) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_err) {
    return false;
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (_err) {
    // Ignore storage access errors
  }
}

function slugifyFilename(text, fallback = "cns5-audit") {
  const slug = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}

function showToast(message, variant = "default") {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const el = document.createElement("div");
  el.className = `toast${variant === "warn" ? " toast--warn" : variant === "error" ? " toast--error" : ""}`;
  el.textContent = message;
  region.appendChild(el);
  window.setTimeout(() => {
    el.remove();
  }, 3200);
}

async function copyToClipboard(text, successLabel) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      showToast(successLabel || "Copied to clipboard.");
      return true;
    }
  } catch (_err) {
    // Fallback below
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (ok) {
      showToast(successLabel || "Copied to clipboard.");
      return true;
    }
  } catch (_err) {
    // Fall through
  }
  showToast("Clipboard copy blocked by browser settings.", "warn");
  return false;
}

function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function mountSanitizedSvgString(containerEl, svgString) {
  if (!containerEl) return;
  containerEl.textContent = "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const root = doc.documentElement;
    if (
      !root ||
      root.nodeName.toLowerCase() !== "svg" ||
      doc.querySelector("parsererror") ||
      root.querySelector("script")
    ) {
      return;
    }
    const imported = document.importNode(root, true);
    containerEl.appendChild(imported);
  } catch (_err) {
    // Leave empty on parse failure
  }
}

function formatSignedPctDisplay(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  if (!Number.isFinite(value)) return value > 0 ? "+∞%" : "-∞%";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

function parseNullableInputNumber(rawVal) {
  const s = String(rawVal ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function formatInputNum(val) {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number" && !Number.isFinite(val)) return "";
  return String(val);
}

/* ==========================================================================
   Application State Initialization
   ========================================================================== */

function createDefaultCns5State(rulesData) {
  const inputsByFamily = {};
  for (const fam of CNS5_FAMILIES) {
    inputsByFamily[fam] = getDefaultCns5Input(fam);
  }
  const vignettes = rulesData?.vignettes || SAMPLE_CNS5_CASES;
  const firstVig = vignettes[0] || null;
  let activeFamily = "adult_diffuse_glioma";
  let activeVignetteId = null;

  if (firstVig && firstVig.inputState) {
    activeFamily = firstVig.family || firstVig.inputState.family || "adult_diffuse_glioma";
    inputsByFamily[activeFamily] = {
      ...getDefaultCns5Input(activeFamily),
      ...firstVig.inputState,
      family: activeFamily
    };
    activeVignetteId = firstVig.id;
  }

  return {
    activeFamily,
    inputsByFamily,
    activeVignetteId
  };
}

function createDefaultRanoState() {
  return {
    activeSubTab: "rano2",
    activePresetIds: {
      rano2: RANO_PRESETS.rano2[0].id,
      rano_bm: RANO_PRESETS.rano_bm[0].id,
      rano_resect: RANO_PRESETS.rano_resect[0].id
    },
    rano2: { ...RANO_PRESETS.rano2[0].values },
    rano2Lesions: [
      { label: "Target #1", longMm: 20, perpMm: 15 },
      { label: "Target #2", longMm: 12, perpMm: 10 }
    ],
    ranoBmMode: "lesions",
    ranoBm: {
      ...RANO_PRESETS.rano_bm[0].values,
      targetLesions: RANO_PRESETS.rano_bm[0].values.targetLesions.map((l) => ({ ...l }))
    },
    ranoResect: { ...RANO_PRESETS.rano_resect[0].values }
  };
}

function createEmptyAuditMeta() {
  return {
    title: "",
    authors: "",
    year: "",
    taskType: "",
    modality: "",
    cohortSummary: "",
    reviewer: ""
  };
}

function createAuditStateFromPreset(checklistData, presetKey = "slice_leakage_pitfall") {
  const preset = checklistData?.presets?.[presetKey] || checklistData?.presets?.blank || null;
  const studyMeta = { ...createEmptyAuditMeta(), ...(preset?.studyMeta || {}) };
  const responses = {};
  const items = Array.isArray(checklistData?.items) ? checklistData.items : [];
  for (const item of items) {
    const src = preset?.responses?.[item.id];
    responses[item.id] = {
      status: src?.status || "unanswered",
      evidence: src?.evidence || ""
    };
  }
  return {
    activePresetId: preset ? presetKey : null,
    studyMeta,
    responses
  };
}

const appState = {
  activeTab: "cns5",
  cns5Rules: null,
  auditChecklist: null,
  cns5: null,
  rano: null,
  audit: null,
  auditFilters: {
    domainId: "all",
    severity: "all",
    status: "all",
    query: ""
  },
  auditPreviewFormat: "md",
  lastCns5Result: null,
  lastRanoResult: null,
  lastAuditScore: null
};

/* ==========================================================================
   Theme & Top-Level Tab Navigation
   ========================================================================== */

function getCurrentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme, persist = true) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalized;
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEYS.theme, normalized);
    } catch (_err) {
      // Ignore
    }
  }
  const btn = document.getElementById("theme-toggle-btn");
  const icon = document.getElementById("theme-toggle-icon");
  const label = document.getElementById("theme-toggle-label");
  if (btn && icon && label) {
    const isDark = normalized === "dark";
    btn.setAttribute("aria-pressed", String(isDark));
    icon.textContent = isDark ? "\u2600" : "\u263E";
    label.textContent = isDark ? "Light Mode" : "Dark Mode";
  }
}

function switchPrimaryTab(tabName, persist = true) {
  const validTabs = ["cns5", "rano", "audit"];
  const target = validTabs.includes(tabName) ? tabName : "cns5";
  appState.activeTab = target;
  if (persist) {
    writeStorage(STORAGE_KEYS.activeTab, target);
  }

  document.querySelectorAll(".studio-tab").forEach((btn) => {
    const active = btn.dataset.tab === target;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const active = panel.dataset.panel === target;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });

  updateMobileSummaryStrip();
}

function updateMobileSummaryStrip() {
  const strip = document.getElementById("mobile-summary-strip");
  if (!strip) return;

  let leftText = "";
  let badgeText = "";
  let badgeClass = "count-pill";

  if (appState.activeTab === "cns5" && appState.lastCns5Result) {
    const r = appState.lastCns5Result;
    leftText = r.diagnosis;
    badgeText = r.cnsWhoGrade === "Not assigned" ? "Grade N/A" : `WHO Grade ${r.cnsWhoGrade}`;
    badgeClass = `count-pill`;
  } else if (appState.activeTab === "rano" && appState.lastRanoResult) {
    const sub = appState.rano.activeSubTab;
    const r = appState.lastRanoResult;
    if (sub === "rano2") {
      leftText = `RANO 2.0: ${r.responseLabel}`;
      badgeText = r.responseCode;
    } else if (sub === "rano_bm") {
      leftText = `RANO-BM: ${r.bicompartmentalSummary}`;
      badgeText = `CNS ${r.cnsResponseCode}`;
    } else {
      leftText = `RANO-Resect: ${r.className}`;
      badgeText = r.resectClass;
    }
  } else if (appState.activeTab === "audit" && appState.lastAuditScore) {
    const s = appState.lastAuditScore;
    leftText = `Neuro-AI Rigor: ${s.leakageRiskLevel}${s.capApplied ? " (Capped)" : ""}`;
    badgeText = `${s.overallScore}/100`;
  }

  strip.innerHTML = `
    <div class="mobile-summary-strip__inner">
      <span class="mobile-summary-strip__label">${escapeHtml(leftText || "CNS5-Audit Studio")}</span>
      <span class="${badgeClass}">${escapeHtml(badgeText || "Ready")}</span>
    </div>
  `;
}

/* ==========================================================================
   TAB 1: WHO CNS5 (2021) INTEGRATED CLASSIFIER
   ========================================================================== */

function getCns5Vignettes() {
  if (Array.isArray(appState.cns5Rules?.vignettes) && appState.cns5Rules.vignettes.length > 0) {
    return appState.cns5Rules.vignettes;
  }
  return SAMPLE_CNS5_CASES;
}

function getCns5FamilyMeta(familyId) {
  const fromJson = Array.isArray(appState.cns5Rules?.families)
    ? appState.cns5Rules.families.find((f) => f.id === familyId)
    : null;
  const fromEngine = getFamilyFormConfig(familyId);
  return {
    id: familyId,
    label: fromJson?.label || fromEngine.label,
    shortLabel: fromJson?.shortLabel || fromEngine.shortLabel,
    categoryGroup: fromJson?.categoryGroup || fromEngine.label,
    description: fromJson?.description || fromEngine.description,
    entities: Array.isArray(fromJson?.entities) ? fromJson.entities : []
  };
}

function persistCns5State() {
  writeStorage(STORAGE_KEYS.cns5State, appState.cns5);
}

function renderCns5Vignettes() {
  const container = document.getElementById("cns5-vignette-chips");
  const countEl = document.getElementById("cns5-vignette-count");
  const descEl = document.getElementById("cns5-vignette-active-desc");
  if (!container) return;

  const vignettes = getCns5Vignettes();
  if (countEl) {
    countEl.textContent = `${vignettes.length} Cases`;
  }

  const activeVig = vignettes.find((v) => v.id === appState.cns5.activeVignetteId);
  if (descEl) {
    descEl.textContent = activeVig
      ? (activeVig.description || activeVig.clinicalVignette || activeVig.label)
      : "Select a curated teaching vignette or adjust biomarkers manually across any of the 7 WHO CNS5 families.";
  }

  container.innerHTML = vignettes.map((vig) => {
    const isActive = vig.id === appState.cns5.activeVignetteId;
    const famMeta = getCns5FamilyMeta(vig.family);
    return `
      <button
        type="button"
        class="preset-chip${isActive ? " is-active" : ""}"
        data-vignette-id="${escapeHtml(vig.id)}"
        aria-pressed="${String(isActive)}"
        title="${escapeHtml(vig.description || vig.clinicalVignette || vig.label)}"
      >
        <span>${escapeHtml(vig.label)}</span>
        <span class="preset-chip__tag">${escapeHtml(famMeta.shortLabel)}</span>
      </button>
    `;
  }).join("");
}

function renderCns5FamilySelector() {
  const container = document.getElementById("cns5-family-selector");
  if (!container) return;

  container.innerHTML = CNS5_FAMILIES.map((familyId) => {
    const meta = getCns5FamilyMeta(familyId);
    const isActive = familyId === appState.cns5.activeFamily;
    const entityCountLabel = meta.entities.length > 0
      ? `${meta.entities.length} ${meta.entities.length === 1 ? "entity" : "entities"}`
      : "WHO CNS5";
    return `
      <button
        type="button"
        class="family-card${isActive ? " is-active" : ""}"
        role="tab"
        aria-selected="${String(isActive)}"
        data-family-id="${escapeHtml(familyId)}"
      >
        <span class="family-card__title">${escapeHtml(meta.shortLabel)}</span>
        <span class="family-card__meta">${escapeHtml(entityCountLabel)}</span>
      </button>
    `;
  }).join("");
}

function getCns5FieldRelevance(familyId, fieldKey, inputState) {
  if (familyId === "adult_diffuse_glioma") {
    const idh = inputState.idh_status;
    if (idh === "mutant" && ["tert_promoter", "egfr_amplification", "chr7_gain_chr10_loss"].includes(fieldKey)) {
      return "muted";
    }
    if (idh === "wildtype" && ["codeletion_1p19q", "atrx_status", "tp53_status"].includes(fieldKey)) {
      return "muted";
    }
    if (idh === "wildtype" && ["tert_promoter", "egfr_amplification", "chr7_gain_chr10_loss"].includes(fieldKey)) {
      return "highlight";
    }
    if (idh === "mutant" && ["codeletion_1p19q", "atrx_status", "cdkn2ab_homdel"].includes(fieldKey)) {
      return "highlight";
    }
  }
  if (familyId === "ependymal_tumor") {
    const comp = inputState.compartment;
    if (inputState.histology_variant !== "classic_or_ependymoma" && ["st_fusion", "pf_methylation_h3k27me3", "mycn_amplification", "anaplastic_features"].includes(fieldKey)) {
      return "muted";
    }
    if (fieldKey === "st_fusion") return comp === "supratentorial" ? "highlight" : "muted";
    if (fieldKey === "pf_methylation_h3k27me3") return comp === "posterior_fossa" ? "highlight" : "muted";
    if (fieldKey === "mycn_amplification") return comp === "spinal" ? "highlight" : "muted";
  }
  if (familyId === "circumscribed_astrocytic" && fieldKey === "mitoses_per_10hpf") {
    return inputState.morphology_subtype === "pxa" ? "highlight" : "muted";
  }
  if (familyId === "medulloblastoma") {
    if (fieldKey === "tp53_status") return inputState.molecular_group === "shh" ? "highlight" : "muted";
    if (fieldKey === "non_wnt_subgroup") return inputState.molecular_group === "non_wnt_non_shh" ? "highlight" : "muted";
  }
  return "normal";
}

function updateCns5FieldHighlights() {
  const familyId = appState.cns5.activeFamily;
  const inputState = appState.cns5.inputsByFamily[familyId];
  const formEl = document.getElementById("cns5-form-container");
  if (!formEl) return;
  formEl.querySelectorAll("[data-cns5-field-wrap]").forEach((wrap) => {
    const key = wrap.dataset.cns5FieldWrap;
    const rel = getCns5FieldRelevance(familyId, key, inputState);
    wrap.classList.toggle("field--highlight", rel === "highlight");
    wrap.classList.toggle("field--muted", rel === "muted");
  });
}

function renderCns5Form() {
  const familyId = appState.cns5.activeFamily;
  const meta = getCns5FamilyMeta(familyId);
  const config = getFamilyFormConfig(familyId);
  const inputState = appState.cns5.inputsByFamily[familyId] || getDefaultCns5Input(familyId);
  appState.cns5.inputsByFamily[familyId] = inputState;

  const eyebrow = document.getElementById("cns5-family-eyebrow");
  const heading = document.getElementById("cns5-family-heading");
  const desc = document.getElementById("cns5-family-description");
  const idTag = document.getElementById("cns5-family-id-tag");
  if (eyebrow) eyebrow.textContent = meta.categoryGroup;
  if (heading) heading.textContent = meta.label;
  if (desc) desc.textContent = meta.description;
  if (idTag) idTag.textContent = familyId;

  // Group fields preserving definition order
  const groups = [];
  const groupMap = new Map();
  for (const field of config.fields) {
    const grpName = field.group || "Criteria";
    if (!groupMap.has(grpName)) {
      const entry = { name: grpName, fields: [] };
      groupMap.set(grpName, entry);
      groups.push(entry);
    }
    groupMap.get(grpName).fields.push(field);
  }

  const formContainer = document.getElementById("cns5-form-container");
  if (formContainer) {
    formContainer.innerHTML = groups.map((grp) => {
      const fieldsHtml = grp.fields.map((field) => {
        const val = inputState[field.key];
        const rel = getCns5FieldRelevance(familyId, field.key, inputState);
        const relClass = rel === "highlight" ? " field--highlight" : rel === "muted" ? " field--muted" : "";
        const inputId = `cns5-input-${familyId}-${field.key}`;

        if (field.type === "boolean") {
          const checked = Boolean(val) ? " checked" : "";
          return `
            <div class="field${relClass}" data-cns5-field-wrap="${escapeHtml(field.key)}">
              <label class="checkbox-row" for="${escapeHtml(inputId)}">
                <input type="checkbox" id="${escapeHtml(inputId)}" data-cns5-key="${escapeHtml(field.key)}" data-cns5-type="boolean"${checked}>
                <span>${escapeHtml(field.label)}</span>
              </label>
            </div>
          `;
        }

        if (field.type === "number") {
          const numVal = val === null || val === undefined ? "" : String(val);
          const minAttr = field.min !== undefined ? ` min="${escapeHtml(field.min)}"` : "";
          const maxAttr = field.max !== undefined ? ` max="${escapeHtml(field.max)}"` : "";
          return `
            <div class="field${relClass}" data-cns5-field-wrap="${escapeHtml(field.key)}">
              <label class="field__label" for="${escapeHtml(inputId)}">${escapeHtml(field.label)}</label>
              <input
                type="number"
                step="any"
                id="${escapeHtml(inputId)}"
                class="input input--mono"
                data-cns5-key="${escapeHtml(field.key)}"
                data-cns5-type="number"
                value="${escapeHtml(numVal)}"
                placeholder="Optional"
                ${minAttr}${maxAttr}
              >
            </div>
          `;
        }

        const optionsHtml = (field.options || []).map((opt) => {
          const selected = String(val) === String(opt.value) ? " selected" : "";
          return `<option value="${escapeHtml(opt.value)}"${selected}>${escapeHtml(opt.label)}</option>`;
        }).join("");

        return `
          <div class="field${relClass}" data-cns5-field-wrap="${escapeHtml(field.key)}">
            <label class="field__label" for="${escapeHtml(inputId)}">${escapeHtml(field.label)}</label>
            <select id="${escapeHtml(inputId)}" class="select" data-cns5-key="${escapeHtml(field.key)}" data-cns5-type="select">
              ${optionsHtml}
            </select>
          </div>
        `;
      }).join("");

      return `
        <div class="field-group">
          <h4 class="field-group__title">${escapeHtml(grp.name)}</h4>
          <div class="field-grid">${fieldsHtml}</div>
        </div>
      `;
    }).join("");
  }

  // Render reference entities drawer for active family
  const entitiesCountEl = document.getElementById("cns5-entities-count");
  const entitiesListEl = document.getElementById("cns5-entities-list");
  if (entitiesCountEl) {
    entitiesCountEl.textContent = `${meta.entities.length} ${meta.entities.length === 1 ? "entity" : "entities"}`;
  }
  if (entitiesListEl) {
    if (meta.entities.length === 0) {
      entitiesListEl.innerHTML = `<p class="card__subtitle">Entity catalog loads from <code>data/cns5_rules.json</code> when served over HTTP.</p>`;
    } else {
      entitiesListEl.innerHTML = meta.entities.map((ent) => {
        const gradesStr = (ent.gradesAllowed || [])
          .map((g) => (typeof g === "number" ? `Grade ${g}` : g))
          .join(", ");
        const mol = (ent.molecularHallmarks || []).slice(0, 3).join("; ");
        return `
          <div class="entity-ref-card">
            <div class="entity-ref-card__head">
              <span class="entity-ref-card__name">${escapeHtml(ent.name)}</span>
              <span class="mono-tag">CNS WHO: ${escapeHtml(gradesStr)}</span>
            </div>
            ${mol ? `<p class="entity-ref-card__hallmarks"><strong>Molecular hallmarks:</strong> ${escapeHtml(mol)}</p>` : ""}
          </div>
        `;
      }).join("");
    }
  }
}

function renderCns5Outputs() {
  const familyId = appState.cns5.activeFamily;
  const inputState = appState.cns5.inputsByFamily[familyId] || getDefaultCns5Input(familyId);
  const result = classifyCns5(inputState, appState.cns5Rules);
  appState.lastCns5Result = result;

  const famMeta = getCns5FamilyMeta(result.family);
  const diagCard = document.getElementById("cns5-diagnosis-card");
  const detailsCard = document.getElementById("cns5-details-card");
  const traceEl = document.getElementById("cns5-decision-trace");

  const gradeBadgeMod =
    result.cnsWhoGrade === 1 ? "grade-badge--1"
      : result.cnsWhoGrade === 2 ? "grade-badge--2"
        : result.cnsWhoGrade === 3 ? "grade-badge--3"
          : result.cnsWhoGrade === 4 ? "grade-badge--4"
            : "grade-badge--na";

  const gradeNumText =
    typeof result.cnsWhoGrade === "number" ? `Grade ${result.cnsWhoGrade}` : "Not Assigned";

  let upgradeAlertHtml = "";
  if (result.molecularUpgradeTriggered) {
    upgradeAlertHtml = `
      <div class="callout callout--upgrade" role="status">
        <div class="callout__title">Molecular Grade / Risk Upgrade Triggered</div>
        <p class="callout__body">
          A WHO CNS5 defining molecular hallmark elevated this diagnosis to <strong>${escapeHtml(result.gradeDisplay)}</strong>
          (or high-risk molecular entity) independent of low-grade histologic appearance.
        </p>
      </div>
    `;
  }

  let nosNecHtml = "";
  if (result.nosNecStatus === "NOS" || result.nosNecStatus === "NEC" || result.nosNecNote) {
    const statusKey = result.nosNecStatus === "NEC" ? "NEC" : "NOS";
    const guidance = appState.cns5Rules?.nosNecGuidance?.[statusKey];
    nosNecHtml = `
      <div class="callout callout--nos">
        <div class="callout__title">${escapeHtml(guidance?.label || `${statusKey} Designation`)}</div>
        ${result.nosNecNote ? `<p class="callout__body">${escapeHtml(result.nosNecNote)}</p>` : ""}
        ${guidance?.action ? `<p class="callout__body" style="margin-top:0.35rem"><strong>Recommended Action:</strong> ${escapeHtml(guidance.action)}</p>` : ""}
      </div>
    `;
  }

  let warningsHtml = "";
  if (Array.isArray(result.warnings) && result.warnings.length > 0) {
    warningsHtml = `
      <div class="callout callout--warn">
        <div class="callout__title">Discordance &amp; Pathology QA Alerts (${result.warnings.length})</div>
        <ul class="detail-list">
          ${result.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  if (diagCard) {
    diagCard.innerHTML = `
      <div class="diagnosis-hero">
        <div class="diagnosis-hero__top">
          <div>
            <span class="eyebrow">${escapeHtml(famMeta.label)}</span>
            <h3 class="diagnosis-hero__title">${escapeHtml(result.diagnosis)}</h3>
            <p class="card__subtitle">${escapeHtml(result.gradeDisplay)} &middot; ${result.nosNecStatus === "none" ? "Definitive WHO CNS5 Entity" : `${escapeHtml(result.nosNecStatus)} Classification`}</p>
          </div>
          <div class="grade-badge ${gradeBadgeMod}" aria-label="${escapeHtml(result.gradeDisplay)}">
            <span class="grade-badge__kicker">CNS WHO</span>
            <span class="grade-badge__num">${escapeHtml(gradeNumText)}</span>
          </div>
        </div>

        ${upgradeAlertHtml}
        ${nosNecHtml}
        ${warningsHtml}

        <div class="btn-group">
          <button type="button" id="cns5-copy-report-btn" class="btn btn--primary btn--sm">
            Copy Integrated Pathology Note
          </button>
          <button type="button" id="cns5-dl-report-btn" class="btn btn--secondary btn--sm">
            Download Note (.txt)
          </button>
        </div>
      </div>
    `;
  }

  if (traceEl) {
    renderDecisionTrace(traceEl, result);
  }

  if (detailsCard) {
    const criteriaItems = (result.criteriaMatched || [])
      .map((c) => `<li>${escapeHtml(c)}</li>`)
      .join("");

    const pearlsItems = (result.clinicalPearls || [])
      .map((p) => `<li>${escapeHtml(p)}</li>`)
      .join("");

    const refsItems = (result.references || [])
      .map((ref) => `
        <li>
          ${escapeHtml(ref.citation)}
          ${ref.doi ? `<span class="citation-doi">doi:${escapeHtml(ref.doi)}</span>` : ""}
        </li>
      `)
      .join("");

    detailsCard.innerHTML = `
      <div class="detail-section">
        <h4 class="detail-section__heading">Criteria Matched</h4>
        ${criteriaItems ? `<ul class="detail-list">${criteriaItems}</ul>` : `<p class="card__subtitle">No criteria matched.</p>`}
      </div>
      <div class="detail-section">
        <h4 class="detail-section__heading">Therapeutic &amp; Prognostic Clinical Pearls</h4>
        ${pearlsItems ? `<ul class="detail-list">${pearlsItems}</ul>` : `<p class="card__subtitle">No additional biomarker pearls for the current profile.</p>`}
      </div>
      <div class="detail-section">
        <h4 class="detail-section__heading">WHO CNS5 Literature Citations</h4>
        <ol class="citation-list">${refsItems}</ol>
      </div>
    `;
  }

  updateMobileSummaryStrip();
}

function wireCns5Events() {
  const vigContainer = document.getElementById("cns5-vignette-chips");
  if (vigContainer) {
    vigContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-vignette-id]");
      if (!btn) return;
      const vigId = btn.dataset.vignetteId;
      const vig = getCns5Vignettes().find((v) => v.id === vigId);
      if (!vig) return;

      const targetFamily = vig.family || vig.inputState?.family || "adult_diffuse_glioma";
      appState.cns5.activeFamily = targetFamily;
      appState.cns5.activeVignetteId = vig.id;
      appState.cns5.inputsByFamily[targetFamily] = {
        ...getDefaultCns5Input(targetFamily),
        ...(vig.inputState || {}),
        family: targetFamily
      };
      persistCns5State();
      renderCns5Vignettes();
      renderCns5FamilySelector();
      renderCns5Form();
      renderCns5Outputs();
      showToast(`Loaded vignette: ${vig.label}`);
    });
  }

  const famContainer = document.getElementById("cns5-family-selector");
  if (famContainer) {
    famContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-family-id]");
      if (!btn) return;
      const famId = btn.dataset.familyId;
      if (!CNS5_FAMILIES.includes(famId)) return;

      appState.cns5.activeFamily = famId;
      appState.cns5.activeVignetteId = null;
      if (!appState.cns5.inputsByFamily[famId]) {
        appState.cns5.inputsByFamily[famId] = getDefaultCns5Input(famId);
      }
      persistCns5State();
      renderCns5Vignettes();
      renderCns5FamilySelector();
      renderCns5Form();
      renderCns5Outputs();
    });
  }

  const formContainer = document.getElementById("cns5-form-container");
  if (formContainer) {
    const handleFieldUpdate = (e) => {
      const el = e.target.closest("[data-cns5-key]");
      if (!el) return;
      const key = el.dataset.cns5Key;
      const type = el.dataset.cns5Type;
      const famId = appState.cns5.activeFamily;
      const current = appState.cns5.inputsByFamily[famId] || getDefaultCns5Input(famId);

      if (type === "boolean") {
        current[key] = Boolean(el.checked);
      } else if (type === "number") {
        const raw = el.value.trim();
        current[key] = raw === "" ? null : Number(raw);
      } else {
        current[key] = el.value;
      }

      appState.cns5.inputsByFamily[famId] = current;
      if (appState.cns5.activeVignetteId !== null) {
        appState.cns5.activeVignetteId = null;
        renderCns5Vignettes();
      }
      persistCns5State();
      updateCns5FieldHighlights();
      renderCns5Outputs();
    };

    formContainer.addEventListener("change", handleFieldUpdate);
    formContainer.addEventListener("input", (e) => {
      if (e.target.matches('input[type="number"][data-cns5-key]')) {
        handleFieldUpdate(e);
      }
    });
  }

  const resetFamilyBtn = document.getElementById("cns5-reset-family-btn");
  if (resetFamilyBtn) {
    resetFamilyBtn.addEventListener("click", () => {
      const famId = appState.cns5.activeFamily;
      appState.cns5.inputsByFamily[famId] = getDefaultCns5Input(famId);
      appState.cns5.activeVignetteId = null;
      persistCns5State();
      renderCns5Vignettes();
      renderCns5Form();
      renderCns5Outputs();
      showToast("Reset active CNS5 family inputs to defaults.");
    });
  }

  const diagCard = document.getElementById("cns5-diagnosis-card");
  if (diagCard) {
    diagCard.addEventListener("click", (e) => {
      if (e.target.closest("#cns5-copy-report-btn")) {
        const famId = appState.cns5.activeFamily;
        const inputState = appState.cns5.inputsByFamily[famId];
        const report = formatCns5Report(appState.lastCns5Result, inputState);
        copyToClipboard(report, "Copied WHO CNS5 integrated pathology note.");
      } else if (e.target.closest("#cns5-dl-report-btn")) {
        const famId = appState.cns5.activeFamily;
        const inputState = appState.cns5.inputsByFamily[famId];
        const report = formatCns5Report(appState.lastCns5Result, inputState);
        const slug = slugifyFilename(appState.lastCns5Result?.diagnosis, "who-cns5-note");
        downloadTextFile(`${slug}.txt`, report, "text/plain;charset=utf-8");
        showToast("Downloaded WHO CNS5 pathology summary (.txt).");
      }
    });
  }
}

/* ==========================================================================
   TAB 2: MULTI-STANDARD RANO CALCULATORS
   ========================================================================== */

function persistRanoState() {
  writeStorage(STORAGE_KEYS.ranoState, appState.rano);
}

function renderRanoSubTabs() {
  const active = appState.rano.activeSubTab;
  document.querySelectorAll("[data-rano-tab]").forEach((btn) => {
    const isAct = btn.dataset.ranoTab === active;
    btn.classList.toggle("is-active", isAct);
    btn.setAttribute("aria-selected", String(isAct));
  });
}

function renderRanoPresets() {
  const sub = appState.rano.activeSubTab;
  const presets = RANO_PRESETS[sub] || [];
  const activeId = appState.rano.activePresetIds?.[sub] || null;
  const pill = document.getElementById("rano-standard-pill");
  const desc = document.getElementById("rano-preset-desc");
  const container = document.getElementById("rano-preset-chips");

  if (pill) {
    pill.textContent = sub === "rano2" ? "RANO 2.0" : sub === "rano_bm" ? "RANO-BM" : "RANO-Resect";
  }

  const activePreset = presets.find((p) => p.id === activeId);
  if (desc) {
    desc.textContent = activePreset
      ? activePreset.description
      : "Load canonical clinical edge cases to inspect thresholds, guards, and modifiers.";
  }

  if (container) {
    container.innerHTML = presets.map((preset) => {
      const isAct = preset.id === activeId;
      return `
        <button
          type="button"
          class="preset-chip${isAct ? " is-active" : ""}"
          data-rano-preset-id="${escapeHtml(preset.id)}"
          aria-pressed="${String(isAct)}"
          title="${escapeHtml(preset.description)}"
        >
          <span>${escapeHtml(preset.label)}</span>
          <span class="preset-chip__tag">${escapeHtml(preset.tag)}</span>
        </button>
      `;
    }).join("");
  }
}

function buildRano2SpdNoticesHtml(spdRes) {
  const parts = [];
  if (Array.isArray(spdRes.errors) && spdRes.errors.length > 0) {
    parts.push(
      `<div class="callout callout--upgrade"><p class="callout__body">${spdRes.errors.map((e) => escapeHtml(e)).join(" ")}</p></div>`
    );
  }
  if (Array.isArray(spdRes.warnings) && spdRes.warnings.length > 0) {
    parts.push(
      `<div class="callout callout--warn"><p class="callout__body">${spdRes.warnings.map((w) => escapeHtml(w)).join(" ")}</p></div>`
    );
  }
  return parts.join("");
}

function renderRano2SpdHelperInner() {
  const bodyEl = document.getElementById("rano2-spd-helper-body");
  if (!bodyEl) return;
  const lesions = appState.rano.rano2Lesions || [];
  const spdRes = computeSpdFromLesions(lesions);

  const rowsHtml = lesions.map((les, idx) => {
    const prod = spdRes.lesionProducts.find((p) => p.index === idx + 1);
    const areaTxt = prod ? `${prod.areaMm2} mm²` : "—";
    const measBadge = prod
      ? (prod.measurable
        ? `<span class="mono-tag" style="color:var(--status-pass)">≥10×10</span>`
        : `<span class="mono-tag" style="color:var(--status-warn)">&lt;10mm</span>`)
      : "";
    return `
      <tr>
        <td><input type="text" class="input" data-spd-idx="${idx}" data-spd-field="label" value="${escapeHtml(les.label || `Target #${idx + 1}`)}" aria-label="Lesion ${idx + 1} label"></td>
        <td><input type="number" step="any" min="0" class="input input--mono" data-spd-idx="${idx}" data-spd-field="longMm" value="${escapeHtml(formatInputNum(les.longMm))}" aria-label="Lesion ${idx + 1} longest diameter in mm"></td>
        <td><input type="number" step="any" min="0" class="input input--mono" data-spd-idx="${idx}" data-spd-field="perpMm" value="${escapeHtml(formatInputNum(les.perpMm))}" aria-label="Lesion ${idx + 1} perpendicular diameter in mm"></td>
        <td class="tabular">${escapeHtml(areaTxt)} ${measBadge}</td>
        <td><button type="button" class="btn btn--ghost btn--xs" data-spd-remove="${idx}" aria-label="Remove lesion ${idx + 1}">&times;</button></td>
      </tr>
    `;
  }).join("");

  const noticesHtml = buildRano2SpdNoticesHtml(spdRes);

  bodyEl.innerHTML = `
    <div class="lesion-table-wrap">
      <table class="lesion-table">
        <thead>
          <tr>
            <th>Lesion</th>
            <th>Long (mm)</th>
            <th>Perp (mm)</th>
            <th>Product</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    <div id="rano2-spd-warnings">${noticesHtml}</div>
    <div class="spd-helper__footer">
      <div>
        <strong class="tabular">Computed SPD: ${spdRes.valid ? `${escapeHtml(spdRes.spdMm2)} mm²` : "—"}</strong>
        <span class="card__subtitle"> (${spdRes.measurableCount}/${spdRes.totalLesionsEvaluated} measurable)</span>
      </div>
      <div class="btn-group">
        <button type="button" class="btn btn--secondary btn--xs" data-spd-action="add">+ Add Lesion</button>
        <button type="button" class="btn btn--secondary btn--xs" data-spd-apply="baselineValue">Apply to Baseline</button>
        <button type="button" class="btn btn--secondary btn--xs" data-spd-apply="nadirValue">Apply to Nadir</button>
        <button type="button" class="btn btn--primary btn--xs" data-spd-apply="currentValue">Apply to Current</button>
      </div>
    </div>
  `;
}

function updateRano2SpdReadoutOnly() {
  const spdRes = computeSpdFromLesions(appState.rano.rano2Lesions || []);
  const rows = document.querySelectorAll("#rano2-spd-helper-body tbody tr");
  rows.forEach((tr, idx) => {
    const cell = tr.children[3];
    if (!cell) return;
    const prod = spdRes.lesionProducts.find((p) => p.index === idx + 1);
    if (prod) {
      const badge = prod.measurable
        ? `<span class="mono-tag" style="color:var(--status-pass)">≥10×10</span>`
        : `<span class="mono-tag" style="color:var(--status-warn)">&lt;10mm</span>`;
      cell.innerHTML = `${escapeHtml(prod.areaMm2)} mm² ${badge}`;
    } else {
      cell.textContent = "—";
    }
  });
  const warningsEl = document.getElementById("rano2-spd-warnings");
  if (warningsEl) {
    warningsEl.innerHTML = buildRano2SpdNoticesHtml(spdRes);
  }
  const footer = document.querySelector("#rano2-spd-helper-body .spd-helper__footer strong");
  if (footer) {
    footer.textContent = `Computed SPD: ${spdRes.valid ? `${spdRes.spdMm2} mm²` : "—"}`;
  }
  const sub = document.querySelector("#rano2-spd-helper-body .spd-helper__footer .card__subtitle");
  if (sub) {
    sub.textContent = ` (${spdRes.measurableCount}/${spdRes.totalLesionsEvaluated} measurable)`;
  }
}

function renderRanoForm() {
  const container = document.getElementById("rano-form-card");
  if (!container) return;
  const sub = appState.rano.activeSubTab;

  if (sub === "rano2") {
    const p = appState.rano.rano2;
    const unit = p.measurementType === "3d_volume" ? "cm³" : "mm²";

    container.innerHTML = `
      <div class="card__header">
        <div>
          <span class="eyebrow">Wen et al., J Clin Oncol 2023</span>
          <h3 class="card__title">RANO 2.0 Glioma Response Parameters</h3>
          <p class="card__subtitle">Unified criteria for enhancing high-grade gliomas and non-enhancing low-grade gliomas across 2D SPD and 3D volumetry.</p>
        </div>
        <span class="mono-tag">${escapeHtml(unit)}</span>
      </div>

      <div class="rano-submode-bar">
        <div class="rano-toggle-group">
          <span class="field__label">Tumor Track</span>
          <div class="segmented-control" role="group" aria-label="RANO 2.0 tumor track">
            <button type="button" class="segmented-control__btn${p.tumorMode === "enhancing_hgg" ? " is-active" : ""}" data-r2-set="tumorMode" data-r2-val="enhancing_hgg">Enhancing / HGG</button>
            <button type="button" class="segmented-control__btn${p.tumorMode === "non_enhancing_lgg" ? " is-active" : ""}" data-r2-set="tumorMode" data-r2-val="non_enhancing_lgg">Non-Enhancing / LGG</button>
          </div>
        </div>
        <div class="rano-toggle-group">
          <span class="field__label">Measurement Modality</span>
          <div class="segmented-control" role="group" aria-label="RANO 2.0 measurement modality">
            <button type="button" class="segmented-control__btn${p.measurementType === "2d_spd" ? " is-active" : ""}" data-r2-set="measurementType" data-r2-val="2d_spd">2D SPD (mm²)</button>
            <button type="button" class="segmented-control__btn${p.measurementType === "3d_volume" ? " is-active" : ""}" data-r2-set="measurementType" data-r2-val="3d_volume">3D Volume (cm³)</button>
          </div>
        </div>
      </div>

      ${p.measurementType === "2d_spd" ? `
        <details class="spd-helper">
          <summary class="spd-helper__summary">
            <span>2D Target Lesion SPD Calculator (up to 5 lesions, ≥10×10 mm check)</span>
            <span class="mono-tag">Helper</span>
          </summary>
          <div id="rano2-spd-helper-body" class="spd-helper__body"></div>
        </details>
      ` : ""}

      <div class="field-group" style="margin-bottom:0.9rem">
        <h4 class="field-group__title">Target Tumor Burden (${escapeHtml(unit)})</h4>
        <div class="field-grid">
          <label class="field">
            <span class="field__label">Baseline ${escapeHtml(unit)} (Post-RT for new HGG)</span>
            <input type="number" step="any" min="0" class="input input--mono" data-r2-key="baselineValue" data-r2-type="number" value="${escapeHtml(formatInputNum(p.baselineValue))}">
          </label>
          <label class="field">
            <span class="field__label">Nadir ${escapeHtml(unit)} (optional; defaults to baseline)</span>
            <input type="number" step="any" min="0" class="input input--mono" data-r2-key="nadirValue" data-r2-type="nullable_number" value="${escapeHtml(formatInputNum(p.nadirValue))}" placeholder="Same as baseline">
          </label>
          <label class="field field--span-2">
            <span class="field__label">Current Scan ${escapeHtml(unit)}</span>
            <input type="number" step="any" min="0" class="input input--mono" data-r2-key="currentValue" data-r2-type="number" value="${escapeHtml(formatInputNum(p.currentValue))}">
          </label>
        </div>
      </div>

      <div class="field-group">
        <h4 class="field-group__title">Clinical, Steroid &amp; Post-RT Modifiers</h4>
        <div class="field-grid">
          <label class="field">
            <span class="field__label">Corticosteroid Status</span>
            <select class="select" data-r2-key="corticosteroids" data-r2-type="select">
              <option value="none_or_physiologic"${p.corticosteroids === "none_or_physiologic" ? " selected" : ""}>None / Physiologic replacement only</option>
              <option value="stable_or_decreased"${p.corticosteroids === "stable_or_decreased" ? " selected" : ""}>Stable or decreased therapeutic dose</option>
              <option value="increased"${p.corticosteroids === "increased" ? " selected" : ""}>Increased therapeutic dose</option>
            </select>
          </label>
          <label class="field">
            <span class="field__label">Clinical / Neurologic Status</span>
            <select class="select" data-r2-key="clinicalStatus" data-r2-type="select">
              <option value="stable_or_improved"${p.clinicalStatus === "stable_or_improved" ? " selected" : ""}>Stable or improved</option>
              <option value="worse"${p.clinicalStatus === "worse" ? " selected" : ""}>Unequivocal clinical deterioration (Definite PD)</option>
            </select>
          </label>

          <label class="checkbox-row">
            <input type="checkbox" data-r2-key="newMeasurableLesion" data-r2-type="boolean"${p.newMeasurableLesion ? " checked" : ""}>
            <span>New Measurable Lesion</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" data-r2-key="nonMeasurablePresent" data-r2-type="boolean"${p.nonMeasurablePresent ? " checked" : ""}>
            <span>Non-Measurable Disease Present</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" data-r2-key="nonMeasurableProgression" data-r2-type="boolean"${p.nonMeasurableProgression ? " checked" : ""}>
            <span>Unequivocal Non-Measurable Progression</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" data-r2-key="within12WeeksPostRt" data-r2-type="boolean"${p.within12WeeksPostRt ? " checked" : ""}>
            <span>Scan &le;12 Weeks Post-Radiotherapy<span class="checkbox-row__sub">Activates Prelim-PD guard unless clinical PD or out-of-field</span></span>
          </label>
          <label class="checkbox-row${p.within12WeeksPostRt ? "" : " field--muted"}">
            <input type="checkbox" data-r2-key="outsideRtField" data-r2-type="boolean"${p.outsideRtField ? " checked" : ""}>
            <span>Progression Outside High-Dose RT Field<span class="checkbox-row__sub">Definite PD even &le;12 weeks post-RT</span></span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" data-r2-key="sustained4Weeks" data-r2-type="boolean"${p.sustained4Weeks ? " checked" : ""}>
            <span>Response Confirmed / Sustained &ge;4 Weeks</span>
          </label>
        </div>
      </div>
    `;

    if (p.measurementType === "2d_spd") {
      renderRano2SpdHelperInner();
    }
    return;
  }

  if (sub === "rano_bm") {
    const p = appState.rano.ranoBm;
    const mode = appState.rano.ranoBmMode || "lesions";
    const lesions = Array.isArray(p.targetLesions) ? p.targetLesions : [];

    const lesionRows = lesions.map((les, idx) => {
      const sub10 = Number(les.baselineMm) > 0 && Number(les.baselineMm) < 10;
      return `
        <tr>
          <td><input type="text" class="input" data-bm-lesion-idx="${idx}" data-bm-lesion-field="label" value="${escapeHtml(les.label || `CNS Met #${idx + 1}`)}" aria-label="Lesion ${idx + 1} label"></td>
          <td>
            <input type="number" step="any" min="0" class="input input--mono" data-bm-lesion-idx="${idx}" data-bm-lesion-field="baselineMm" value="${escapeHtml(formatInputNum(les.baselineMm))}" aria-label="Lesion ${idx + 1} baseline diameter mm">
            ${sub10 ? `<span class="field__hint" style="color:var(--status-warn)">&lt;10mm</span>` : ""}
          </td>
          <td><input type="number" step="any" min="0" class="input input--mono" data-bm-lesion-idx="${idx}" data-bm-lesion-field="nadirMm" value="${escapeHtml(formatInputNum(les.nadirMm))}" placeholder="Base" aria-label="Lesion ${idx + 1} nadir diameter mm"></td>
          <td><input type="number" step="any" min="0" class="input input--mono" data-bm-lesion-idx="${idx}" data-bm-lesion-field="currentMm" value="${escapeHtml(formatInputNum(les.currentMm))}" aria-label="Lesion ${idx + 1} current diameter mm"></td>
          <td><button type="button" class="btn btn--ghost btn--xs" data-bm-remove-lesion="${idx}" aria-label="Remove lesion ${idx + 1}">&times;</button></td>
        </tr>
      `;
    }).join("");

    container.innerHTML = `
      <div class="card__header">
        <div>
          <span class="eyebrow">Lin et al., Lancet Oncology 2015</span>
          <h3 class="card__title">RANO-BM Brain Metastases Parameters</h3>
          <p class="card__subtitle">Bicompartmental assessment separating CNS target lesions (up to 5, ≥10 mm, dual ≥+20% &amp; ≥+5 mm PD rule) from systemic RECIST 1.1 status.</p>
        </div>
        <span class="mono-tag">1D SLD (mm)</span>
      </div>

      <div class="rano-submode-bar">
        <div class="rano-toggle-group">
          <span class="field__label">Target Lesion Entry Mode</span>
          <div class="segmented-control" role="group" aria-label="RANO-BM input mode">
            <button type="button" class="segmented-control__btn${mode === "lesions" ? " is-active" : ""}" data-bm-mode="lesions">Target Lesion Table (1–5)</button>
            <button type="button" class="segmented-control__btn${mode === "sld" ? " is-active" : ""}" data-bm-mode="sld">Direct SLD Entry (mm)</button>
          </div>
        </div>
      </div>

      ${mode === "lesions" ? `
        <div class="field-group" style="margin-bottom:0.9rem">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.55rem">
            <h4 class="field-group__title" style="margin:0">Measurable CNS Target Lesions (Max 5)</h4>
            <button type="button" class="btn btn--secondary btn--xs" data-bm-add-lesion>+ Add CNS Lesion</button>
          </div>
          <div class="lesion-table-wrap">
            <table class="lesion-table">
              <thead>
                <tr>
                  <th>Lesion Label</th>
                  <th>Baseline (mm)</th>
                  <th>Nadir (mm)</th>
                  <th>Current (mm)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>${lesionRows}</tbody>
            </table>
          </div>
        </div>
      ` : `
        <div class="field-group" style="margin-bottom:0.9rem">
          <h4 class="field-group__title">Sum of Longest Diameters — SLD (mm)</h4>
          <div class="field-grid">
            <label class="field">
              <span class="field__label">Baseline SLD (mm)</span>
              <input type="number" step="any" min="0" class="input input--mono" data-bm-key="baselineSldMm" data-bm-type="number" value="${escapeHtml(formatInputNum(p.baselineSldMm))}">
            </label>
            <label class="field">
              <span class="field__label">Nadir SLD (mm, optional)</span>
              <input type="number" step="any" min="0" class="input input--mono" data-bm-key="nadirSldMm" data-bm-type="nullable_number" value="${escapeHtml(formatInputNum(p.nadirSldMm))}" placeholder="Same as baseline">
            </label>
            <label class="field field--span-2">
              <span class="field__label">Current SLD (mm)</span>
              <input type="number" step="any" min="0" class="input input--mono" data-bm-key="currentSldMm" data-bm-type="number" value="${escapeHtml(formatInputNum(p.currentSldMm))}">
            </label>
          </div>
        </div>
      `}

      <div class="field-group">
        <h4 class="field-group__title">Clinical, Compartmental &amp; SRS Modifiers</h4>
        <div class="field-grid">
          <label class="field">
            <span class="field__label">Corticosteroid Status</span>
            <select class="select" data-bm-key="corticosteroids" data-bm-type="select">
              <option value="none_or_physiologic"${p.corticosteroids === "none_or_physiologic" ? " selected" : ""}>None / Physiologic replacement</option>
              <option value="stable_or_decreased"${p.corticosteroids === "stable_or_decreased" ? " selected" : ""}>Stable or decreased dose</option>
              <option value="increased"${p.corticosteroids === "increased" ? " selected" : ""}>Increased dose</option>
            </select>
          </label>
          <label class="field">
            <span class="field__label">CNS Neurologic Status</span>
            <select class="select" data-bm-key="neurologicStatus" data-bm-type="select">
              <option value="stable_or_improved"${p.neurologicStatus === "stable_or_improved" ? " selected" : ""}>Stable or improved</option>
              <option value="worse"${p.neurologicStatus === "worse" ? " selected" : ""}>Unequivocal CNS deterioration (CNS PD)</option>
            </select>
          </label>
          <label class="field field--span-2">
            <span class="field__label">Non-CNS (Extracranial Systemic) Compartment — RECIST 1.1</span>
            <select class="select" data-bm-key="nonCnsStatus" data-bm-type="select">
              <option value="not_applicable"${p.nonCnsStatus === "not_applicable" ? " selected" : ""}>Not Applicable / CNS-Only Disease</option>
              <option value="CR"${p.nonCnsStatus === "CR" ? " selected" : ""}>CR — Systemic Complete Response</option>
              <option value="PR"${p.nonCnsStatus === "PR" ? " selected" : ""}>PR — Systemic Partial Response</option>
              <option value="SD"${p.nonCnsStatus === "SD" ? " selected" : ""}>SD — Systemic Stable Disease</option>
              <option value="PD"${p.nonCnsStatus === "PD" ? " selected" : ""}>PD — Systemic Progressive Disease</option>
              <option value="NE"${p.nonCnsStatus === "NE" ? " selected" : ""}>NE — Non-Evaluable</option>
            </select>
          </label>

          <label class="checkbox-row">
            <input type="checkbox" data-bm-key="newCnsLesion" data-bm-type="boolean"${p.newCnsLesion ? " checked" : ""}>
            <span>New CNS Lesion (&ge;1 new metastasis)</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" data-bm-key="nonTargetCnsPresent" data-bm-type="boolean"${p.nonTargetCnsPresent ? " checked" : ""}>
            <span>Non-Target CNS Disease Present</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" data-bm-key="nonTargetCnsProgression" data-bm-type="boolean"${p.nonTargetCnsProgression ? " checked" : ""}>
            <span>Unequivocal Non-Target CNS Progression</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" data-bm-key="priorSrsWithin6Months" data-bm-type="boolean"${p.priorSrsWithin6Months ? " checked" : ""}>
            <span>Prior SRS Within 6 Months<span class="checkbox-row__sub">Flags radiation necrosis / pseudoprogression caution</span></span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" data-bm-key="sustained4Weeks" data-bm-type="boolean"${p.sustained4Weeks ? " checked" : ""}>
            <span>CNS Response Confirmed / Sustained &ge;4 Weeks</span>
          </label>
        </div>
      </div>
    `;
    return;
  }

  // RANO-Resect
  const p = appState.rano.ranoResect;
  container.innerHTML = `
    <div class="card__header">
      <div>
        <span class="eyebrow">Karschnia et al., Neuro-Oncology 2023</span>
        <h3 class="card__title">RANO-Resect Volumetric Extent-of-Resection Inputs</h3>
        <p class="card__subtitle">Strict hierarchical classification (Classes 1–4) for contrast-enhancing glioblastoma with explicit Pre-Op CE = 0 N/A guard.</p>
      </div>
      <span class="mono-tag">cm³ Volumetry</span>
    </div>

    <div class="field-group" style="margin-bottom:0.9rem">
      <h4 class="field-group__title">Contrast-Enhancing (CE) Tumor Volumes</h4>
      <div class="field-grid">
        <label class="field">
          <span class="field__label">Pre-Op CE Volume (cm³)</span>
          <input type="number" step="any" min="0" class="input input--mono" data-res-key="preOpCeVolCm3" data-res-type="number" value="${escapeHtml(formatInputNum(p.preOpCeVolCm3))}">
          <span class="field__hint">Set to 0 cm³ to trigger non-enhancing N/A guard</span>
        </label>
        <label class="field">
          <span class="field__label">Post-Op Residual CE Volume (cm³)</span>
          <input type="number" step="any" min="0" class="input input--mono" data-res-key="postOpCeVolCm3" data-res-type="number" value="${escapeHtml(formatInputNum(p.postOpCeVolCm3))}">
          <span class="field__hint">Class 1/2A: 0 · Class 2B: &le;1 · Class 3A: &le;5 · Class 3B: &gt;5</span>
        </label>
      </div>
    </div>

    <div class="field-group">
      <h4 class="field-group__title">Non-Enhancing (FLAIR/T2) Volumes &amp; Surgical QA</h4>
      <div class="field-grid">
        <label class="field">
          <span class="field__label">Pre-Op Non-CE / FLAIR Volume (cm³, optional)</span>
          <input type="number" step="any" min="0" class="input input--mono" data-res-key="preOpNonCeVolCm3" data-res-type="nullable_number" value="${escapeHtml(formatInputNum(p.preOpNonCeVolCm3))}" placeholder="Optional">
        </label>
        <label class="field">
          <span class="field__label">Post-Op Residual Non-CE Volume (cm³, unlocks Class 1)</span>
          <input type="number" step="any" min="0" class="input input--mono" data-res-key="postOpNonCeVolCm3" data-res-type="nullable_number" value="${escapeHtml(formatInputNum(p.postOpNonCeVolCm3))}" placeholder="Required (≤5 cm³) for Class 1">
        </label>
        <label class="field">
          <span class="field__label">Post-Op MRI Timing (hours post-op, optional)</span>
          <input type="number" step="any" min="0" class="input input--mono" data-res-key="postOpMriTimingHours" data-res-type="nullable_number" value="${escapeHtml(formatInputNum(p.postOpMriTimingHours))}" placeholder="Ideal: 24–72 hours">
          <span class="field__hint">Values &gt;72 hours flag reactive enhancement caution</span>
        </label>
        <div class="field" style="justify-content:flex-end">
          <label class="checkbox-row">
            <input type="checkbox" data-res-key="isBiopsyProcedure" data-res-type="boolean"${p.isBiopsyProcedure ? " checked" : ""}>
            <span>Explicit Surgical Biopsy Procedure<span class="checkbox-row__sub">Forces Class 4 (Biopsy) regardless of residual volume</span></span>
          </label>
        </div>
      </div>
    </div>
  `;
}

function getActiveRanoInputPayload() {
  const sub = appState.rano.activeSubTab;
  if (sub === "rano2") return appState.rano.rano2;
  if (sub === "rano_resect") return appState.rano.ranoResect;

  // RANO-BM: pass either targetLesions or direct SLD
  const bm = appState.rano.ranoBm;
  if (appState.rano.ranoBmMode === "lesions" && Array.isArray(bm.targetLesions) && bm.targetLesions.length > 0) {
    return {
      targetLesions: bm.targetLesions,
      corticosteroids: bm.corticosteroids,
      neurologicStatus: bm.neurologicStatus,
      newCnsLesion: bm.newCnsLesion,
      nonTargetCnsPresent: bm.nonTargetCnsPresent,
      nonTargetCnsProgression: bm.nonTargetCnsProgression,
      nonCnsStatus: bm.nonCnsStatus,
      priorSrsWithin6Months: bm.priorSrsWithin6Months,
      sustained4Weeks: bm.sustained4Weeks
    };
  }
  return {
    baselineSldMm: bm.baselineSldMm,
    nadirSldMm: bm.nadirSldMm,
    currentSldMm: bm.currentSldMm,
    corticosteroids: bm.corticosteroids,
    neurologicStatus: bm.neurologicStatus,
    newCnsLesion: bm.newCnsLesion,
    nonTargetCnsPresent: bm.nonTargetCnsPresent,
    nonTargetCnsProgression: bm.nonTargetCnsProgression,
    nonCnsStatus: bm.nonCnsStatus,
    priorSrsWithin6Months: bm.priorSrsWithin6Months,
    sustained4Weeks: bm.sustained4Weeks
  };
}

function renderRanoOutputs() {
  const sub = appState.rano.activeSubTab;
  const payload = getActiveRanoInputPayload();
  let result;

  if (sub === "rano2") {
    result = calculateRano2(payload);
  } else if (sub === "rano_bm") {
    result = calculateRanoBm(payload);
  } else {
    result = calculateRanoResect(payload);
  }
  appState.lastRanoResult = result;

  const resultCard = document.getElementById("rano-result-card");
  const gaugeEyebrow = document.getElementById("rano-gauge-eyebrow");
  const gaugeTitle = document.getElementById("rano-gauge-title");
  const gaugeTag = document.getElementById("rano-gauge-tag");
  const gaugeStage = document.getElementById("rano-gauge-stage");
  const rationaleCard = document.getElementById("rano-rationale-card");

  const tierClass = `tier--${escapeHtml(result.severityTier || "neutral")}`;

  if (resultCard) {
    if (sub === "rano2") {
      const th = result.thresholds || {};
      const thSummary = th.mrPct !== null
        ? `PR ≤${th.prPct}% · MR ≤${th.mrPct}% · PD ≥+${th.pdPct}%`
        : `PR ≤${th.prPct}% · PD ≥+${th.pdPct}%`;
      resultCard.innerHTML = `
        <div class="response-hero__top">
          <div>
            <span class="eyebrow">${escapeHtml(result.standard)}</span>
            <h3 class="diagnosis-hero__title">${escapeHtml(result.responseLabel)}</h3>
            <p class="card__subtitle">${escapeHtml(thSummary)}</p>
          </div>
          <span class="response-pill ${tierClass}">${escapeHtml(result.responseCode)}</span>
        </div>

        <div class="metrics-grid">
          <div class="metric-tile">
            <span class="metric-tile__label">vs. Baseline</span>
            <span class="metric-tile__value">${escapeHtml(formatSignedPctDisplay(result.pctChangeFromBaseline))}</span>
          </div>
          <div class="metric-tile">
            <span class="metric-tile__label">vs. Nadir</span>
            <span class="metric-tile__value">${escapeHtml(formatSignedPctDisplay(result.pctChangeFromNadir))}</span>
          </div>
          <div class="metric-tile">
            <span class="metric-tile__label">Nadir Ref</span>
            <span class="metric-tile__value">${escapeHtml(result.nadirReference)} ${escapeHtml(result.unit)}</span>
          </div>
        </div>

        <div class="callout callout--info" style="margin-top:0.75rem">
          <div class="callout__title">Confirmation &amp; Surveillance Guidance</div>
          <p class="callout__body">${escapeHtml(result.confirmationStatus)}</p>
        </div>

        <div class="btn-group" style="margin-top:0.8rem">
          <button type="button" id="rano-copy-summary-btn" class="btn btn--primary btn--sm">Copy Clinical Summary</button>
        </div>
      `;
    } else if (sub === "rano_bm") {
      const nonCnsDisp = result.nonCnsResponseCode === "not_applicable" ? "N/A" : result.nonCnsResponseCode;
      resultCard.innerHTML = `
        <div class="response-hero__top">
          <div>
            <span class="eyebrow">${escapeHtml(result.standard)}</span>
            <h3 class="diagnosis-hero__title">${escapeHtml(result.cnsResponseLabel)}</h3>
            <p class="card__subtitle">PR ≤-30% vs. baseline · PD ≥+20% AND ≥+5 mm vs. nadir</p>
          </div>
          <span class="response-pill ${tierClass}">${escapeHtml(result.cnsResponseCode)}</span>
        </div>

        <div class="bicompartment-strip">
          <div class="compartment-box">
            <span class="compartment-box__label">CNS Compartment</span>
            <span class="compartment-box__code">${escapeHtml(result.cnsResponseCode)}</span>
          </div>
          <div class="compartment-box">
            <span class="compartment-box__label">Non-CNS (RECIST 1.1)</span>
            <span class="compartment-box__code">${escapeHtml(nonCnsDisp)}</span>
          </div>
        </div>

        ${result.compartmentDiscordance ? `
          <div class="callout callout--warn" style="margin-top:0.7rem">
            <div class="callout__title">Bicompartmental Discordance Detected</div>
            <p class="callout__body">${escapeHtml(result.bicompartmentalSummary)}</p>
          </div>
        ` : ""}

        <div class="metrics-grid">
          <div class="metric-tile">
            <span class="metric-tile__label">SLD (Base → Now)</span>
            <span class="metric-tile__value">${escapeHtml(result.baselineSldMm)} → ${escapeHtml(result.currentSldMm)} mm</span>
            <span class="metric-tile__sub">Nadir: ${escapeHtml(result.nadirSldMm)} mm</span>
          </div>
          <div class="metric-tile">
            <span class="metric-tile__label">vs. Baseline</span>
            <span class="metric-tile__value">${escapeHtml(formatSignedPctDisplay(result.pctChangeFromBaseline))}</span>
          </div>
          <div class="metric-tile">
            <span class="metric-tile__label">vs. Nadir</span>
            <span class="metric-tile__value">${escapeHtml(formatSignedPctDisplay(result.pctChangeFromNadir))}</span>
            <span class="metric-tile__sub">Abs Δ: ${result.absChangeFromNadirMm > 0 ? "+" : ""}${escapeHtml(result.absChangeFromNadirMm)} mm</span>
          </div>
        </div>

        <div class="callout callout--info" style="margin-top:0.75rem">
          <div class="callout__title">Confirmation Guidance</div>
          <p class="callout__body">${escapeHtml(result.confirmationStatus)}</p>
        </div>

        <div class="btn-group" style="margin-top:0.8rem">
          <button type="button" id="rano-copy-summary-btn" class="btn btn--primary btn--sm">Copy Clinical Summary</button>
        </div>
      `;
    } else {
      resultCard.innerHTML = `
        <div class="response-hero__top">
          <div>
            <span class="eyebrow">${escapeHtml(result.standard)}</span>
            <h3 class="diagnosis-hero__title">${escapeHtml(result.className)}</h3>
            <p class="card__subtitle">Category Group: <strong>${escapeHtml(result.categoryGroup)}</strong></p>
          </div>
          <span class="response-pill ${tierClass}">${escapeHtml(result.resectClass)}</span>
        </div>

        <div class="metrics-grid">
          <div class="metric-tile">
            <span class="metric-tile__label">Residual CE</span>
            <span class="metric-tile__value">${escapeHtml(result.postOpCeVolCm3)} cm³</span>
            <span class="metric-tile__sub">Pre-Op: ${escapeHtml(result.preOpCeVolCm3)} cm³</span>
          </div>
          <div class="metric-tile">
            <span class="metric-tile__label">CE Reduction (EOR)</span>
            <span class="metric-tile__value">${result.ceReductionPct !== null ? `${escapeHtml(result.ceReductionPct.toFixed(1))}%` : "N/A"}</span>
          </div>
          <div class="metric-tile">
            <span class="metric-tile__label">Residual Non-CE</span>
            <span class="metric-tile__value">${result.postOpNonCeVolCm3 !== null ? `${escapeHtml(result.postOpNonCeVolCm3)} cm³` : "Not supplied"}</span>
            ${result.nonCeReductionPct !== null ? `<span class="metric-tile__sub">FLAIR EOR: ${escapeHtml(result.nonCeReductionPct.toFixed(1))}%</span>` : ""}
          </div>
        </div>

        <div class="btn-group" style="margin-top:0.8rem">
          <button type="button" id="rano-copy-summary-btn" class="btn btn--primary btn--sm">Copy Clinical Summary</button>
        </div>
      `;
    }
  }

  // Render SVG Gauge
  if (gaugeStage) {
    if (sub === "rano_resect") {
      if (gaugeEyebrow) gaugeEyebrow.textContent = "Karschnia et al., 2023 Hierarchy";
      if (gaugeTitle) gaugeTitle.textContent = "6-Tier Extent-of-Resection Gauge";
      if (gaugeTag) gaugeTag.textContent = result.resectClass;
      renderResectGauge(gaugeStage, result);
    } else {
      if (gaugeEyebrow) gaugeEyebrow.textContent = sub === "rano_bm" ? "CNS Target SLD Scale" : "Bidirectional Threshold Scale";
      if (gaugeTitle) gaugeTitle.textContent = sub === "rano_bm" ? "RANO-BM Response Threshold Gauge" : "RANO 2.0 Response Threshold Gauge";
      if (gaugeTag) gaugeTag.textContent = sub === "rano_bm" ? result.cnsResponseCode : result.responseCode;
      renderResponseGauge(gaugeStage, sub, result);
    }
  }

  // Rationale, Errors, Warnings & Citation
  if (rationaleCard) {
    const errorsHtml = !result.valid && Array.isArray(result.errors) && result.errors.length > 0
      ? `
        <div class="callout callout--upgrade" style="margin-bottom:0.75rem">
          <div class="callout__title">Validation Errors</div>
          <ul class="detail-list">${result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>
        </div>
      `
      : "";

    const rationaleHtml = Array.isArray(result.rationale) && result.rationale.length > 0
      ? `
        <div class="detail-section">
          <h4 class="detail-section__heading">Decision Rationale</h4>
          <ul class="detail-list">${result.rationale.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
        </div>
      `
      : "";

    const warningsHtml = Array.isArray(result.warnings) && result.warnings.length > 0
      ? `
        <div class="detail-section">
          <div class="callout callout--warn">
            <div class="callout__title">Clinical &amp; Methodological Warnings</div>
            <ul class="detail-list">${result.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>
          </div>
        </div>
      `
      : "";

    const refHtml = result.reference?.citation
      ? `
        <div class="detail-section">
          <h4 class="detail-section__heading">Reference Standard</h4>
          <p class="card__subtitle" style="margin:0">
            ${escapeHtml(result.reference.citation)}
            ${result.reference.doi ? `<span class="citation-doi">doi:${escapeHtml(result.reference.doi)}</span>` : ""}
          </p>
        </div>
      `
      : "";

    rationaleCard.innerHTML = errorsHtml + rationaleHtml + warningsHtml + refHtml;
  }

  updateMobileSummaryStrip();
}

function wireRanoEvents() {
  // Sub-tab switcher
  document.querySelectorAll("[data-rano-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      appState.rano.activeSubTab = btn.dataset.ranoTab;
      persistRanoState();
      renderRanoSubTabs();
      renderRanoPresets();
      renderRanoForm();
      renderRanoOutputs();
    });
  });

  // Scenario presets
  const presetChips = document.getElementById("rano-preset-chips");
  if (presetChips) {
    presetChips.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-rano-preset-id]");
      if (!btn) return;
      const sub = appState.rano.activeSubTab;
      const preset = (RANO_PRESETS[sub] || []).find((p) => p.id === btn.dataset.ranoPresetId);
      if (!preset) return;

      appState.rano.activePresetIds[sub] = preset.id;
      if (sub === "rano2") {
        appState.rano.rano2 = { ...preset.values };
      } else if (sub === "rano_bm") {
        appState.rano.ranoBmMode = preset.mode || "lesions";
        appState.rano.ranoBm = {
          ...preset.values,
          targetLesions: (preset.values.targetLesions || []).map((l) => ({ ...l }))
        };
      } else {
        appState.rano.ranoResect = { ...preset.values };
      }
      persistRanoState();
      renderRanoPresets();
      renderRanoForm();
      renderRanoOutputs();
      showToast(`Loaded scenario: ${preset.label}`);
    });
  }

  // Form events (delegated cleanly to preserve input focus!)
  const formCard = document.getElementById("rano-form-card");
  if (formCard) {
    formCard.addEventListener("click", (e) => {
      // RANO 2.0 track/metric segmented toggles
      const r2Toggle = e.target.closest("[data-r2-set]");
      if (r2Toggle) {
        const key = r2Toggle.dataset.r2Set;
        const val = r2Toggle.dataset.r2Val;
        appState.rano.rano2[key] = val;
        appState.rano.activePresetIds.rano2 = null;
        persistRanoState();
        renderRanoPresets();
        renderRanoForm();
        renderRanoOutputs();
        return;
      }

      // SPD helper add/remove/apply
      const spdRemove = e.target.closest("[data-spd-remove]");
      if (spdRemove) {
        const idx = Number(spdRemove.dataset.spdRemove);
        appState.rano.rano2Lesions.splice(idx, 1);
        persistRanoState();
        renderRano2SpdHelperInner();
        return;
      }

      const spdAction = e.target.closest("[data-spd-action='add']");
      if (spdAction) {
        appState.rano.rano2Lesions.push({
          label: `Target #${appState.rano.rano2Lesions.length + 1}`,
          longMm: 12,
          perpMm: 10
        });
        persistRanoState();
        renderRano2SpdHelperInner();
        return;
      }

      const spdApply = e.target.closest("[data-spd-apply]");
      if (spdApply) {
        const targetField = spdApply.dataset.spdApply;
        const spdRes = computeSpdFromLesions(appState.rano.rano2Lesions || []);
        if (!spdRes.valid) {
          showToast("Fix invalid lesion diameters before applying SPD.", "warn");
          return;
        }
        appState.rano.rano2[targetField] = spdRes.spdMm2;
        appState.rano.activePresetIds.rano2 = null;
        persistRanoState();
        const inputEl = formCard.querySelector(`[data-r2-key="${targetField}"]`);
        if (inputEl) inputEl.value = String(spdRes.spdMm2);
        renderRanoPresets();
        renderRanoOutputs();
        showToast(`Applied SPD (${spdRes.spdMm2} mm²) to ${targetField.replace("Value", "")}.`);
        return;
      }

      // RANO-BM mode toggle
      const bmModeBtn = e.target.closest("[data-bm-mode]");
      if (bmModeBtn) {
        appState.rano.ranoBmMode = bmModeBtn.dataset.bmMode;
        persistRanoState();
        renderRanoForm();
        renderRanoOutputs();
        return;
      }

      // RANO-BM add/remove lesion
      if (e.target.closest("[data-bm-add-lesion]")) {
        const arr = appState.rano.ranoBm.targetLesions || [];
        arr.push({
          label: `CNS Met #${arr.length + 1}`,
          baselineMm: 12,
          nadirMm: null,
          currentMm: 12
        });
        appState.rano.ranoBm.targetLesions = arr;
        appState.rano.activePresetIds.rano_bm = null;
        persistRanoState();
        renderRanoPresets();
        renderRanoForm();
        renderRanoOutputs();
        return;
      }

      const bmRemove = e.target.closest("[data-bm-remove-lesion]");
      if (bmRemove) {
        const idx = Number(bmRemove.dataset.bmRemoveLesion);
        const arr = appState.rano.ranoBm.targetLesions || [];
        if (arr.length <= 1) {
          showToast("Keep at least 1 lesion or switch to Direct SLD Entry.", "warn");
          return;
        }
        arr.splice(idx, 1);
        appState.rano.activePresetIds.rano_bm = null;
        persistRanoState();
        renderRanoPresets();
        renderRanoForm();
        renderRanoOutputs();
      }
    });

    const handleRanoInput = (e) => {
      const target = e.target;

      // SPD helper edits
      if (target.dataset.spdIdx !== undefined) {
        const idx = Number(target.dataset.spdIdx);
        const field = target.dataset.spdField;
        const item = appState.rano.rano2Lesions[idx];
        if (!item) return;
        item[field] = field === "label" ? target.value : parseNullableInputNumber(target.value);
        persistRanoState();
        updateRano2SpdReadoutOnly();
        return;
      }

      // RANO 2.0 direct fields
      if (target.dataset.r2Key) {
        const key = target.dataset.r2Key;
        const type = target.dataset.r2Type;
        if (type === "boolean") {
          appState.rano.rano2[key] = Boolean(target.checked);
          if (key === "within12WeeksPostRt") {
            const outRow = formCard.querySelector('[data-r2-key="outsideRtField"]')?.closest(".checkbox-row");
            if (outRow) outRow.classList.toggle("field--muted", !target.checked);
          }
        } else if (type === "nullable_number") {
          appState.rano.rano2[key] = parseNullableInputNumber(target.value);
        } else if (type === "number") {
          appState.rano.rano2[key] = target.value.trim() === "" ? NaN : Number(target.value);
        } else {
          appState.rano.rano2[key] = target.value;
        }
        if (appState.rano.activePresetIds.rano2 !== null) {
          appState.rano.activePresetIds.rano2 = null;
          renderRanoPresets();
        }
        persistRanoState();
        renderRanoOutputs();
        return;
      }

      // RANO-BM lesion table edits
      if (target.dataset.bmLesionIdx !== undefined) {
        const idx = Number(target.dataset.bmLesionIdx);
        const field = target.dataset.bmLesionField;
        const lesion = appState.rano.ranoBm.targetLesions?.[idx];
        if (!lesion) return;
        if (field === "label") {
          lesion.label = target.value;
        } else if (field === "nadirMm") {
          lesion.nadirMm = parseNullableInputNumber(target.value);
        } else {
          lesion[field] = target.value.trim() === "" ? NaN : Number(target.value);
        }
        if (appState.rano.activePresetIds.rano_bm !== null) {
          appState.rano.activePresetIds.rano_bm = null;
          renderRanoPresets();
        }
        persistRanoState();
        renderRanoOutputs();
        return;
      }

      // RANO-BM scalar fields
      if (target.dataset.bmKey) {
        const key = target.dataset.bmKey;
        const type = target.dataset.bmType;
        if (type === "boolean") {
          appState.rano.ranoBm[key] = Boolean(target.checked);
        } else if (type === "nullable_number") {
          appState.rano.ranoBm[key] = parseNullableInputNumber(target.value);
        } else if (type === "number") {
          appState.rano.ranoBm[key] = target.value.trim() === "" ? NaN : Number(target.value);
        } else {
          appState.rano.ranoBm[key] = target.value;
        }
        if (appState.rano.activePresetIds.rano_bm !== null) {
          appState.rano.activePresetIds.rano_bm = null;
          renderRanoPresets();
        }
        persistRanoState();
        renderRanoOutputs();
        return;
      }

      // RANO-Resect fields
      if (target.dataset.resKey) {
        const key = target.dataset.resKey;
        const type = target.dataset.resType;
        if (type === "boolean") {
          appState.rano.ranoResect[key] = Boolean(target.checked);
        } else if (type === "nullable_number") {
          appState.rano.ranoResect[key] = parseNullableInputNumber(target.value);
        } else if (type === "number") {
          appState.rano.ranoResect[key] = target.value.trim() === "" ? NaN : Number(target.value);
        }
        if (appState.rano.activePresetIds.rano_resect !== null) {
          appState.rano.activePresetIds.rano_resect = null;
          renderRanoPresets();
        }
        persistRanoState();
        renderRanoOutputs();
      }
    };

    formCard.addEventListener("input", handleRanoInput);
    formCard.addEventListener("change", handleRanoInput);
  }

  // Copy Clinical Summary
  const resultCard = document.getElementById("rano-result-card");
  if (resultCard) {
    resultCard.addEventListener("click", (e) => {
      if (e.target.closest("#rano-copy-summary-btn")) {
        const sub = appState.rano.activeSubTab;
        const summary = formatClinicalSummary(sub, appState.lastRanoResult, getActiveRanoInputPayload());
        copyToClipboard(summary, `Copied ${sub.toUpperCase().replace("_", "-")} clinical summary.`);
      }
    });
  }
}

/* ==========================================================================
   TAB 3: NEURO-AI LEAKAGE & REPORTING AUDITOR (CLAIM 2024 + TRIPOD+AI)
   ========================================================================== */

function persistAuditState() {
  const saved = writeStorage(STORAGE_KEYS.auditState, appState.audit);
  const pill = document.getElementById("audit-autosave-indicator");
  if (pill) {
    pill.textContent = saved ? "Autosaved locally" : "Local storage unavailable";
  }
}

function syncAuditMetaInputs() {
  const meta = appState.audit?.studyMeta || createEmptyAuditMeta();
  for (const key of CANONICAL_META_KEYS) {
    const input = document.getElementById(`meta-${key}`);
    if (input) {
      input.value = meta[key] || "";
    }
  }
}

function renderAuditPresetButtons() {
  const container = document.getElementById("audit-preset-buttons");
  const descEl = document.getElementById("audit-preset-description");
  if (!container || !appState.auditChecklist?.presets) return;

  const order = ["gold_standard", "slice_leakage_pitfall", "blank"];
  const activeId = appState.audit?.activePresetId;
  const activePreset = activeId ? appState.auditChecklist.presets[activeId] : null;

  if (descEl) {
    descEl.textContent = activePreset
      ? activePreset.description
      : "Custom peer-review workspace (autosaved locally in your browser; zero data uploaded).";
  }

  container.innerHTML = order
    .filter((k) => Boolean(appState.auditChecklist.presets[k]))
    .map((key) => {
      const preset = appState.auditChecklist.presets[key];
      const isAct = key === activeId;
      return `
        <button
          type="button"
          class="btn btn--secondary btn--sm${isAct ? " is-active-preset" : ""}"
          data-audit-preset="${escapeHtml(key)}"
          aria-pressed="${String(isAct)}"
        >
          ${escapeHtml(preset.label)}
        </button>
      `;
    })
    .join("");
}

function syncAuditSeverityFilterCounts() {
  const sevSel = document.getElementById("audit-severity-filter");
  const items = Array.isArray(appState.auditChecklist?.items) ? appState.auditChecklist.items : [];
  if (!sevSel || items.length === 0) return;

  const counts = { all: items.length, critical: 0, major: 0, recommended: 0 };
  for (const item of items) {
    if (item.severity in counts) {
      counts[item.severity] += 1;
    }
  }

  const labels = {
    all: `All Severities (${counts.all})`,
    critical: `Critical Blockers Only (${counts.critical})`,
    major: `Major (${counts.major})`,
    recommended: `Recommended (${counts.recommended})`
  };

  Array.from(sevSel.options).forEach((opt) => {
    if (opt.value in labels) {
      opt.textContent = labels[opt.value];
    }
  });
}

function renderAuditDomainPills(scoreResult) {
  const container = document.getElementById("audit-domain-pills");
  if (!container || !appState.auditChecklist) return;

  const activeDom = appState.auditFilters.domainId;
  const totalBlockers = scoreResult?.criticalBlockersFailedCount || 0;
  const totalItems = Array.isArray(appState.auditChecklist.items) ? appState.auditChecklist.items.length : 36;
  const allBtn = `
    <button
      type="button"
      class="domain-pill${activeDom === "all" ? " is-active" : ""}"
      role="tab"
      aria-selected="${String(activeDom === "all")}"
      data-domain-filter="all"
    >
      <span>All Domains</span>
      <span class="domain-pill__score">${totalItems}</span>
      ${totalBlockers > 0 ? `<span class="domain-pill__dot" title="${totalBlockers} failed critical blocker(s)"></span>` : ""}
    </button>
  `;

  const domainBtns = (scoreResult?.domainScores || []).map((ds) => {
    const isAct = activeDom === ds.domainId;
    const dot = ds.criticalFailedCount > 0
      ? `<span class="domain-pill__dot" title="${ds.criticalFailedCount} failed critical blocker(s)"></span>`
      : "";
    return `
      <button
        type="button"
        class="domain-pill${isAct ? " is-active" : ""}"
        role="tab"
        aria-selected="${String(isAct)}"
        data-domain-filter="${escapeHtml(ds.domainId)}"
      >
        <span>${escapeHtml(ds.shortTitle)}</span>
        <span class="domain-pill__score">${ds.score}%</span>
        ${dot}
      </button>
    `;
  }).join("");

  container.innerHTML = allBtn + domainBtns;
}

function buildAuditItemCardHtml(item, resp) {
  const status = resp?.status || "unanswered";
  const evidence = resp?.evidence || "";
  const isBlockerFail = item.severity === "critical" && status === "fail";
  const statusMod = isBlockerFail
    ? "audit-item--blocker-fail"
    : status !== "unanswered"
      ? `audit-item--${status}`
      : "";

  const weight = SEVERITY_WEIGHTS[item.severity] || 1;
  const sevLabel =
    item.severity === "critical"
      ? `Critical Blocker · ${weight}×`
      : item.severity === "major"
        ? `Major · ${weight}×`
        : `Recommended · ${weight}×`;

  const refChips = [
    ...(item.claim2024Refs || []),
    ...(item.tripodAiRefs || [])
  ]
    .map((ref) => `<span class="ref-chip">${escapeHtml(ref)}</span>`)
    .join("");

  const statusButtons = [
    { key: "pass", label: "Pass" },
    { key: "partial", label: "Partial" },
    { key: "fail", label: "Fail" },
    { key: "na", label: "N/A" }
  ]
    .map((btn) => {
      const sel = status === btn.key;
      return `
        <button
          type="button"
          class="status-btn${sel ? " is-selected" : ""}"
          data-item-id="${escapeHtml(item.id)}"
          data-status="${btn.key}"
          aria-pressed="${String(sel)}"
          title="Set ${escapeHtml(item.id)} to ${btn.label} (click again to clear)"
        >
          ${btn.label}
        </button>
      `;
    })
    .join("");

  return `
    <article
      id="audit-item-${escapeHtml(item.id)}"
      class="audit-item ${statusMod}"
      data-audit-card="${escapeHtml(item.id)}"
      data-severity="${escapeHtml(item.severity)}"
    >
      <div class="audit-item__top">
        <div class="audit-item__meta">
          <span class="item-id-badge">${escapeHtml(item.id)}</span>
          <span class="sev-badge sev-badge--${escapeHtml(item.severity)}">${escapeHtml(sevLabel)}</span>
          ${item.neuroImagingRedFlag ? `<span class="redflag-tag">Neuro-MRI Red Flag</span>` : ""}
          ${refChips}
        </div>
        <div class="status-toggle-group" role="group" aria-label="Status for ${escapeHtml(item.id)}">
          ${statusButtons}
        </div>
      </div>

      <h4 class="audit-item__title">${escapeHtml(item.title)}</h4>
      <p class="audit-item__question">${escapeHtml(item.question)}</p>

      <details class="guidance-disclosure">
        <summary class="guidance-disclosure__summary">Leakage Trap &amp; Concrete Remediation Guidance</summary>
        <div class="guidance-disclosure__body">
          <div class="guidance-box">
            <span class="guidance-box__label guidance-box__label--trap">Leakage Trap / Failure Mode</span>
            <p>${escapeHtml(item.failureMode)}</p>
          </div>
          <div class="guidance-box">
            <span class="guidance-box__label guidance-box__label--fix">Concrete Remediation</span>
            <p>${escapeHtml(item.remediation)}</p>
          </div>
        </div>
      </details>

      <div class="evidence-field">
        <label class="sr-only" for="evidence-${escapeHtml(item.id)}">Manuscript evidence or reviewer notes for ${escapeHtml(item.id)}</label>
        <textarea
          id="evidence-${escapeHtml(item.id)}"
          class="textarea"
          rows="2"
          data-evidence-item="${escapeHtml(item.id)}"
          placeholder="Manuscript page/section evidence or reviewer notes for ${escapeHtml(item.id)}..."
        >${escapeHtml(evidence)}</textarea>
      </div>
    </article>
  `;
}

function renderAuditChecklist() {
  const container = document.getElementById("audit-checklist-container");
  const countEl = document.getElementById("audit-visible-count");
  if (!container) return;

  if (!appState.auditChecklist) {
    container.innerHTML = `<div class="empty-state">Unable to load <code>data/audit_checklist.json</code>. Serve this directory with <code>python -m http.server 8000</code>.</div>`;
    return;
  }

  const { domainId, severity, status, query } = appState.auditFilters;
  const q = query.trim().toLowerCase();
  const responses = appState.audit.responses || {};
  const domains = appState.auditChecklist.domains || [];
  const items = appState.auditChecklist.items || [];

  const filtered = items.filter((item) => {
    if (domainId !== "all" && item.domainId !== domainId) return false;
    if (severity !== "all" && item.severity !== severity) return false;
    const respStatus = responses[item.id]?.status || "unanswered";
    if (status !== "all" && respStatus !== status) return false;
    if (q) {
      const hay = [
        item.id,
        item.title,
        item.question,
        ...(item.claim2024Refs || []),
        ...(item.tripodAiRefs || []),
        responses[item.id]?.evidence || ""
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} / ${items.length}`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">No checklist items match the active domain, severity, status, or search filters.</div>`;
    return;
  }

  const htmlParts = [];
  for (const dom of domains) {
    const domItems = filtered.filter((it) => it.domainId === dom.id);
    if (domItems.length === 0) continue;
    htmlParts.push(`
      <div class="domain-section-head">
        <h3 class="domain-section-head__title">${escapeHtml(dom.title)}</h3>
        <span class="mono-tag">${domItems.length} ${domItems.length === 1 ? "item" : "items"}</span>
      </div>
    `);
    for (const item of domItems) {
      htmlParts.push(buildAuditItemCardHtml(item, responses[item.id]));
    }
  }

  container.innerHTML = htmlParts.join("");
}

function updateAuditExportPreview() {
  const disclosure = document.getElementById("audit-export-preview-disclosure");
  const codeEl = document.getElementById("audit-export-preview-code");
  if (!disclosure || !codeEl || !disclosure.open || !appState.auditChecklist) return;

  const text =
    appState.auditPreviewFormat === "tex"
      ? exportAuditLatex(appState.auditChecklist, appState.audit.responses, appState.audit.studyMeta, appState.lastAuditScore)
      : exportAuditMarkdown(appState.auditChecklist, appState.audit.responses, appState.audit.studyMeta, appState.lastAuditScore);

  codeEl.textContent = text;
}

function renderAuditOutputs() {
  if (!appState.auditChecklist || !appState.audit) return;

  const score = scoreAudit(appState.auditChecklist, appState.audit.responses);
  appState.lastAuditScore = score;

  renderAuditDomainPills(score);

  // Critical Blocker Warning Banner
  const blockerBanner = document.getElementById("audit-blocker-banner");
  if (blockerBanner) {
    if (score.blockerTriggered) {
      const jumpButtons = score.criticalBlockersFailed
        .map((b) => `
          <button type="button" class="blocker-jump-btn" data-jump-item="${escapeHtml(b.id)}" title="Jump to ${escapeHtml(b.id)}: ${escapeHtml(b.title)}">
            <span>${escapeHtml(b.id)}</span>
            <span>&rarr;</span>
          </button>
        `)
        .join("");

      blockerBanner.hidden = false;
      blockerBanner.innerHTML = `
        <div class="blocker-banner__head">
          <h3 class="blocker-banner__title">
            CRITICAL LEAKAGE BLOCKER ALERT — ${score.criticalBlockersFailedCount} Failed Critical ${score.criticalBlockersFailedCount === 1 ? "Item" : "Items"}
          </h3>
          <span class="sev-badge sev-badge--critical">SCORE CAP &le; ${CRITICAL_BLOCKER_SCORE_CAP}/100</span>
        </div>
        <p class="blocker-banner__text">${escapeHtml(score.capReason || "")}</p>
        <div class="blocker-links">${jumpButtons}</div>
      `;
    } else {
      blockerBanner.hidden = true;
      blockerBanner.innerHTML = "";
    }
  }

  // Sticky Rigor Scorecard
  const scorecard = document.getElementById("audit-scorecard");
  if (scorecard) {
    const riskTierClass =
      score.leakageRiskLevel === "Low" ? "tier--favorable"
        : score.leakageRiskLevel === "Moderate" ? "tier--moderate"
          : score.leakageRiskLevel === "High" ? "tier--high"
            : score.leakageRiskLevel === "Critical Blocker" ? "tier--critical"
              : "tier--neutral";

    const claimCov = score.guidelineCoverage.claim2024;
    const tripodCov = score.guidelineCoverage.tripodAi;

    scorecard.innerHTML = `
      <div class="card__header card__header--tight">
        <div>
          <span class="eyebrow">Methodological Rigor Scorecard</span>
          <h3 class="card__title">Effective Audit Score</h3>
        </div>
        <span class="sev-badge ${riskTierClass}">${escapeHtml(score.leakageRiskLevel)}</span>
      </div>

      <div class="score-hero">
        <div class="score-hero__left">
          <span class="score-hero__number">${score.overallScore}</span>
          <span class="score-hero__denom">/ 100</span>
        </div>
        <div style="text-align:right">
          <div class="mono-tag">${score.completionPct}% Complete</div>
          <div class="card__subtitle" style="margin-top:0.2rem">${score.counts.answered}/${score.counts.applicable} applicable</div>
        </div>
      </div>

      ${score.capApplied ? `
        <div class="score-cap-note">
          Raw weighted score ${score.rawOverallScore}/100 clamped to ${CRITICAL_BLOCKER_SCORE_CAP}/100 due to ${score.criticalBlockersFailedCount} failed Critical Blocker(s).
        </div>
      ` : score.blockerTriggered ? `
        <div class="score-cap-note">
          Ceiling locked at ${CRITICAL_BLOCKER_SCORE_CAP}/100 (${score.criticalBlockersFailedCount} failed Critical Blocker(s)).
        </div>
      ` : score.criticalUnansweredWarning ? `
        <div class="callout callout--warn" style="margin-bottom:0.7rem">
          <div class="callout__title">Unverified Critical Blockers</div>
          <p class="callout__body">${escapeHtml(score.criticalUnansweredWarning)}</p>
        </div>
      ` : ""}

      <div class="progress-track" aria-label="Audit completion ${score.completionPct}%">
        <div class="progress-track__fill" style="width:${score.completionPct}%"></div>
      </div>

      <div class="tally-row">
        <span class="tally-chip" style="color:var(--status-pass)">Pass: ${score.counts.pass}</span>
        <span class="tally-chip" style="color:var(--status-warn)">Partial: ${score.counts.partial}</span>
        <span class="tally-chip" style="color:var(--status-critical)">Fail: ${score.counts.fail}</span>
        <span class="tally-chip">N/A: ${score.counts.na}</span>
        <span class="tally-chip">Unanswered: ${score.counts.unanswered}</span>
      </div>

      <div class="guideline-bars">
        <div>
          <div class="guideline-bar__head">
            <span>CLAIM 2024</span>
            <span class="tabular">${claimCov.compliancePct}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-track__fill" style="width:${claimCov.compliancePct}%"></div>
          </div>
          <div class="guideline-bar__meta">${claimCov.uniqueRefCount} mapped refs &middot; ${claimCov.passCount}P/${claimCov.partialCount}Pt/${claimCov.failCount}F</div>
        </div>

        <div>
          <div class="guideline-bar__head">
            <span>TRIPOD+AI</span>
            <span class="tabular">${tripodCov.compliancePct}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-track__fill" style="width:${tripodCov.compliancePct}%"></div>
          </div>
          <div class="guideline-bar__meta">${tripodCov.uniqueRefCount} mapped refs &middot; ${tripodCov.passCount}P/${tripodCov.partialCount}Pt/${tripodCov.failCount}F</div>
        </div>
      </div>
    `;
  }

  // 6-Axis Radar Chart
  const radarEl = document.getElementById("audit-radar-chart");
  if (radarEl) {
    renderRadarChart(radarEl, score.domainScores, {
      riskLevel: score.leakageRiskLevel,
      overallScore: score.overallScore,
      capApplied: score.capApplied
    });
  }

  // Live Standalone SVG Badge Preview
  const badgePreviewEl = document.getElementById("audit-badge-preview");
  if (badgePreviewEl) {
    const svgStr = exportAuditBadgeSvg(score, appState.audit.studyMeta);
    mountSanitizedSvgString(badgePreviewEl, svgStr);
  }

  // Standards Citations Card
  const stdCard = document.getElementById("audit-standards-card");
  if (stdCard && appState.auditChecklist?.standards) {
    const { claim2024, tripodAi } = appState.auditChecklist.standards;
    stdCard.innerHTML = `
      <h4 class="detail-section__heading">Reporting Guideline Anchors</h4>
      <p><strong>${escapeHtml(claim2024.name)}:</strong> ${escapeHtml(claim2024.citation)} <span class="citation-doi">doi:${escapeHtml(claim2024.doi)}</span></p>
      <p><strong>${escapeHtml(tripodAi.name)}:</strong> ${escapeHtml(tripodAi.citation)} <span class="citation-doi">doi:${escapeHtml(tripodAi.doi)}</span></p>
    `;
  }

  updateAuditExportPreview();
  updateMobileSummaryStrip();
}

function showImportFeedback(isSuccess, title, messages = []) {
  const el = document.getElementById("audit-import-feedback");
  if (!el) return;
  el.hidden = false;
  el.className = `inline-feedback ${isSuccess ? "inline-feedback--success" : "inline-feedback--error"}`;
  const listHtml = messages.length > 0
    ? `<ul class="detail-list" style="margin-top:0.35rem">${messages.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>`
    : "";
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">
      <strong>${escapeHtml(title)}</strong>
      <button type="button" class="btn btn--ghost btn--xs" id="audit-dismiss-feedback-btn">Dismiss</button>
    </div>
    ${listHtml}
  `;
}

function wireAuditEvents() {
  // Preset loading
  const presetBtns = document.getElementById("audit-preset-buttons");
  if (presetBtns) {
    presetBtns.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-audit-preset]");
      if (!btn || !appState.auditChecklist) return;
      const key = btn.dataset.auditPreset;
      appState.audit = createAuditStateFromPreset(appState.auditChecklist, key);
      persistAuditState();
      syncAuditMetaInputs();
      renderAuditPresetButtons();
      renderAuditChecklist();
      renderAuditOutputs();
      showToast(`Loaded audit preset: ${appState.auditChecklist.presets[key]?.label || key}`);
    });
  }

  // Study metadata live autosave
  const metaForm = document.getElementById("audit-meta-form");
  if (metaForm) {
    metaForm.addEventListener("input", (e) => {
      const input = e.target.closest("[data-meta-key]");
      if (!input || !appState.audit) return;
      const key = input.dataset.metaKey;
      appState.audit.studyMeta[key] = input.value;
      if (appState.audit.activePresetId !== null) {
        appState.audit.activePresetId = null;
        renderAuditPresetButtons();
      }
      persistAuditState();
      // Refresh badge aria/title and export preview cleanly without re-rendering inputs
      const badgePreviewEl = document.getElementById("audit-badge-preview");
      if (badgePreviewEl && appState.lastAuditScore) {
        mountSanitizedSvgString(badgePreviewEl, exportAuditBadgeSvg(appState.lastAuditScore, appState.audit.studyMeta));
      }
      updateAuditExportPreview();
    });
  }

  // Critical blocker jump buttons
  const blockerBanner = document.getElementById("audit-blocker-banner");
  if (blockerBanner) {
    blockerBanner.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-jump-item]");
      if (!btn) return;
      const itemId = btn.dataset.jumpItem;
      // Ensure filters don't hide the target item
      let el = document.getElementById(`audit-item-${itemId}`);
      if (!el) {
        appState.auditFilters = { domainId: "all", severity: "all", status: "all", query: "" };
        const sevSel = document.getElementById("audit-severity-filter");
        const stSel = document.getElementById("audit-status-filter");
        const searchIn = document.getElementById("audit-search-input");
        if (sevSel) sevSel.value = "all";
        if (stSel) stSel.value = "all";
        if (searchIn) searchIn.value = "";
        renderAuditChecklist();
        renderAuditDomainPills(appState.lastAuditScore);
        el = document.getElementById(`audit-item-${itemId}`);
      }
      if (el) {
        const details = el.querySelector("details");
        if (details) details.open = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("is-flash");
        void el.offsetWidth;
        el.classList.add("is-flash");
      }
    });
  }

  // Domain pills filter
  const domainPills = document.getElementById("audit-domain-pills");
  if (domainPills) {
    domainPills.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-domain-filter]");
      if (!btn) return;
      appState.auditFilters.domainId = btn.dataset.domainFilter;
      renderAuditDomainPills(appState.lastAuditScore);
      renderAuditChecklist();
    });
  }

  // Secondary filters
  const sevFilter = document.getElementById("audit-severity-filter");
  if (sevFilter) {
    sevFilter.addEventListener("change", () => {
      appState.auditFilters.severity = sevFilter.value;
      renderAuditChecklist();
    });
  }

  const stFilter = document.getElementById("audit-status-filter");
  if (stFilter) {
    stFilter.addEventListener("change", () => {
      appState.auditFilters.status = stFilter.value;
      renderAuditChecklist();
    });
  }

  const searchInput = document.getElementById("audit-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      appState.auditFilters.query = searchInput.value;
      renderAuditChecklist();
    });
  }

  // Checklist status buttons & evidence notes (in-place DOM update to keep scroll & focus!)
  const listEl = document.getElementById("audit-checklist-container");
  if (listEl) {
    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".status-btn[data-item-id]");
      if (!btn || !appState.audit) return;
      const itemId = btn.dataset.itemId;
      const clickedStatus = btn.dataset.status;
      const prev = appState.audit.responses[itemId] || { status: "unanswered", evidence: "" };
      const nextStatus = prev.status === clickedStatus ? "unanswered" : clickedStatus;

      appState.audit.responses[itemId] = { ...prev, status: nextStatus };
      if (appState.audit.activePresetId !== null) {
        appState.audit.activePresetId = null;
        renderAuditPresetButtons();
      }
      persistAuditState();

      if (appState.auditFilters.status !== "all") {
        renderAuditChecklist();
      } else {
        // Update card styling & button selection in-place
        const card = btn.closest("[data-audit-card]");
        if (card) {
          const isCritical = card.dataset.severity === "critical";
          card.classList.remove(
            "audit-item--pass",
            "audit-item--partial",
            "audit-item--fail",
            "audit-item--na",
            "audit-item--blocker-fail"
          );
          if (isCritical && nextStatus === "fail") {
            card.classList.add("audit-item--blocker-fail");
          } else if (nextStatus !== "unanswered") {
            card.classList.add(`audit-item--${nextStatus}`);
          }
          card.querySelectorAll(".status-btn").forEach((b) => {
            const sel = b.dataset.status === nextStatus;
            b.classList.toggle("is-selected", sel);
            b.setAttribute("aria-pressed", String(sel));
          });
        }
      }
      renderAuditOutputs();
    });

    listEl.addEventListener("input", (e) => {
      const ta = e.target.closest("[data-evidence-item]");
      if (!ta || !appState.audit) return;
      const itemId = ta.dataset.evidenceItem;
      const prev = appState.audit.responses[itemId] || { status: "unanswered", evidence: "" };
      appState.audit.responses[itemId] = { ...prev, evidence: ta.value };
      if (appState.audit.activePresetId !== null) {
        appState.audit.activePresetId = null;
        renderAuditPresetButtons();
      }
      persistAuditState();
      updateAuditExportPreview();
    });
  }

  // JSON Export & Import
  const exportJsonBtn = document.getElementById("audit-export-json-btn");
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", () => {
      if (!appState.audit) return;
      const jsonStr = exportAuditJson(appState.audit.studyMeta, appState.audit.responses, appState.lastAuditScore);
      const slug = slugifyFilename(appState.audit.studyMeta.title, "cns5-audit-state");
      downloadTextFile(`${slug}.json`, jsonStr, "application/json;charset=utf-8");
      showToast("Exported Neuro-AI audit state (.json).");
    });
  }

  const importBtn = document.getElementById("audit-import-json-btn");
  const fileInput = document.getElementById("audit-import-file-input");
  if (importBtn && fileInput) {
    importBtn.addEventListener("click", () => {
      fileInput.value = "";
      fileInput.click();
    });

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const res = validateImportedAuditJson(String(reader.result || ""), appState.auditChecklist);
        if (!res.valid || !res.normalized) {
          showImportFeedback(false, `Import failed for "${file.name}"`, res.errors);
          showToast("JSON import validation failed.", "error");
          return;
        }
        appState.audit = {
          activePresetId: null,
          studyMeta: res.normalized.studyMeta,
          responses: res.normalized.responses
        };
        persistAuditState();
        syncAuditMetaInputs();
        renderAuditPresetButtons();
        renderAuditChecklist();
        renderAuditOutputs();
        showImportFeedback(
          true,
          `Imported "${file.name}" successfully.`,
          res.warnings
        );
        showToast("Imported audit state successfully.");
      };
      reader.onerror = () => {
        showImportFeedback(false, `Unable to read file "${file.name}".`, []);
      };
      reader.readAsText(file);
    });
  }

  const feedbackEl = document.getElementById("audit-import-feedback");
  if (feedbackEl) {
    feedbackEl.addEventListener("click", (e) => {
      if (e.target.closest("#audit-dismiss-feedback-btn")) {
        feedbackEl.hidden = true;
      }
    });
  }

  // Publication Exports (Markdown, LaTeX, SVG Badge)
  const dlMdBtn = document.getElementById("audit-dl-md-btn");
  if (dlMdBtn) {
    dlMdBtn.addEventListener("click", () => {
      if (!appState.auditChecklist) return;
      const md = exportAuditMarkdown(appState.auditChecklist, appState.audit.responses, appState.audit.studyMeta, appState.lastAuditScore);
      const slug = slugifyFilename(appState.audit.studyMeta.title, "cns5-audit-report");
      downloadTextFile(`${slug}-audit.md`, md, "text/markdown;charset=utf-8");
      showToast("Downloaded Markdown audit supplement (.md).");
    });
  }

  const copyMdBtn = document.getElementById("audit-copy-md-btn");
  if (copyMdBtn) {
    copyMdBtn.addEventListener("click", () => {
      if (!appState.auditChecklist) return;
      const md = exportAuditMarkdown(appState.auditChecklist, appState.audit.responses, appState.audit.studyMeta, appState.lastAuditScore);
      copyToClipboard(md, "Copied Markdown audit report to clipboard.");
    });
  }

  const dlTexBtn = document.getElementById("audit-dl-tex-btn");
  if (dlTexBtn) {
    dlTexBtn.addEventListener("click", () => {
      if (!appState.auditChecklist) return;
      const tex = exportAuditLatex(appState.auditChecklist, appState.audit.responses, appState.audit.studyMeta, appState.lastAuditScore);
      const slug = slugifyFilename(appState.audit.studyMeta.title, "cns5-audit-supplement");
      downloadTextFile(`${slug}-supplement.tex`, tex, "application/x-tex;charset=utf-8");
      showToast("Downloaded LaTeX longtable supplement (.tex).");
    });
  }

  const copyTexBtn = document.getElementById("audit-copy-tex-btn");
  if (copyTexBtn) {
    copyTexBtn.addEventListener("click", () => {
      if (!appState.auditChecklist) return;
      const tex = exportAuditLatex(appState.auditChecklist, appState.audit.responses, appState.audit.studyMeta, appState.lastAuditScore);
      copyToClipboard(tex, "Copied LaTeX longtable supplement to clipboard.");
    });
  }

  const dlSvgBtn = document.getElementById("audit-dl-svg-btn");
  if (dlSvgBtn) {
    dlSvgBtn.addEventListener("click", () => {
      if (!appState.lastAuditScore) return;
      const svg = exportAuditBadgeSvg(appState.lastAuditScore, appState.audit.studyMeta);
      const slug = slugifyFilename(appState.audit.studyMeta.title, "cns5-audit-badge");
      downloadTextFile(`${slug}-rigor-badge.svg`, svg, "image/svg+xml;charset=utf-8");
      showToast("Downloaded standalone Rigor Badge (.svg).");
    });
  }

  // Export source preview disclosure & format tabs
  const previewDisclosure = document.getElementById("audit-export-preview-disclosure");
  if (previewDisclosure) {
    previewDisclosure.addEventListener("toggle", () => {
      updateAuditExportPreview();
    });
    previewDisclosure.addEventListener("click", (e) => {
      const tabBtn = e.target.closest("[data-preview-fmt]");
      if (!tabBtn) return;
      appState.auditPreviewFormat = tabBtn.dataset.previewFmt;
      previewDisclosure.querySelectorAll("[data-preview-fmt]").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.previewFmt === appState.auditPreviewFormat);
      });
      updateAuditExportPreview();
    });
  }
}

/* ==========================================================================
   Global Studio Controls & Bootstrap
   ========================================================================== */

function wireGlobalControls() {
  // Primary tabs
  document.querySelectorAll(".studio-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchPrimaryTab(btn.dataset.tab, true);
    });
  });

  // Theme toggle
  const themeBtn = document.getElementById("theme-toggle-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = getCurrentTheme() === "dark" ? "light" : "dark";
      applyTheme(next, true);
    });
  }

  // Reset Local State
  const resetBtn = document.getElementById("reset-state-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const ok = window.confirm(
        "Reset all locally saved CNS5-Audit state (WHO CNS5 inputs, RANO calculator values, and Neuro-AI audit responses)? This cannot be undone."
      );
      if (!ok) return;

      removeStorage(STORAGE_KEYS.activeTab);
      removeStorage(STORAGE_KEYS.cns5State);
      removeStorage(STORAGE_KEYS.ranoState);
      removeStorage(STORAGE_KEYS.auditState);

      appState.cns5 = createDefaultCns5State(appState.cns5Rules);
      appState.rano = createDefaultRanoState();
      appState.audit = appState.auditChecklist
        ? createAuditStateFromPreset(appState.auditChecklist, "blank")
        : { activePresetId: null, studyMeta: createEmptyAuditMeta(), responses: {} };
      appState.auditFilters = { domainId: "all", severity: "all", status: "all", query: "" };

      const sevSel = document.getElementById("audit-severity-filter");
      const stSel = document.getElementById("audit-status-filter");
      const searchIn = document.getElementById("audit-search-input");
      if (sevSel) sevSel.value = "all";
      if (stSel) stSel.value = "all";
      if (searchIn) searchIn.value = "";

      renderCns5Vignettes();
      renderCns5FamilySelector();
      renderCns5Form();
      renderCns5Outputs();

      renderRanoSubTabs();
      renderRanoPresets();
      renderRanoForm();
      renderRanoOutputs();

      syncAuditMetaInputs();
      renderAuditPresetButtons();
      renderAuditChecklist();
      renderAuditOutputs();

      showToast("Cleared all local browser state.");
    });
  }
}

async function fetchLocalJson(relPath) {
  const response = await fetch(relPath, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${relPath}`);
  }
  return await response.json();
}

function showLocalFileNotice(failedFiles) {
  const banner = document.getElementById("runtime-banner");
  if (!banner) return;
  banner.hidden = false;
  banner.innerHTML = `
    <strong>Local Static Server Required for JSON Knowledge Bases:</strong>
    Could not load <code>${escapeHtml(failedFiles.join(", "))}</code>.
    Browsers restrict <code>fetch()</code> requests when opening <code>index.html</code> directly over <code>file://</code>.
    Run <code>python -m http.server 8000</code> in the <code>cns5-audit</code> folder and open
    <code>http://localhost:8000/</code> to run 100% locally offline.
  `;
}

function hydrateSavedStates() {
  // Hydrate Tab 1
  const savedCns5 = readStorage(STORAGE_KEYS.cns5State, null);
  const defaultCns5 = createDefaultCns5State(appState.cns5Rules);
  if (savedCns5 && typeof savedCns5 === "object" && savedCns5.inputsByFamily) {
    const mergedInputs = { ...defaultCns5.inputsByFamily };
    for (const fam of CNS5_FAMILIES) {
      if (savedCns5.inputsByFamily[fam] && typeof savedCns5.inputsByFamily[fam] === "object") {
        mergedInputs[fam] = {
          ...getDefaultCns5Input(fam),
          ...savedCns5.inputsByFamily[fam],
          family: fam
        };
      }
    }
    appState.cns5 = {
      activeFamily: CNS5_FAMILIES.includes(savedCns5.activeFamily)
        ? savedCns5.activeFamily
        : defaultCns5.activeFamily,
      inputsByFamily: mergedInputs,
      activeVignetteId: savedCns5.activeVignetteId || null
    };
  } else {
    appState.cns5 = defaultCns5;
  }

  // Hydrate Tab 2
  const savedRano = readStorage(STORAGE_KEYS.ranoState, null);
  const defaultRano = createDefaultRanoState();
  if (savedRano && typeof savedRano === "object") {
    appState.rano = {
      activeSubTab: ["rano2", "rano_bm", "rano_resect"].includes(savedRano.activeSubTab)
        ? savedRano.activeSubTab
        : "rano2",
      activePresetIds: { ...defaultRano.activePresetIds, ...(savedRano.activePresetIds || {}) },
      rano2: { ...defaultRano.rano2, ...(savedRano.rano2 || {}) },
      rano2Lesions: Array.isArray(savedRano.rano2Lesions) && savedRano.rano2Lesions.length > 0
        ? savedRano.rano2Lesions
        : defaultRano.rano2Lesions,
      ranoBmMode: savedRano.ranoBmMode === "sld" ? "sld" : "lesions",
      ranoBm: { ...defaultRano.ranoBm, ...(savedRano.ranoBm || {}) },
      ranoResect: { ...defaultRano.ranoResect, ...(savedRano.ranoResect || {}) }
    };
  } else {
    appState.rano = defaultRano;
  }

  // Hydrate Tab 3
  const savedAudit = readStorage(STORAGE_KEYS.auditState, null);
  if (appState.auditChecklist) {
    if (savedAudit && typeof savedAudit === "object" && savedAudit.responses) {
      const validated = validateImportedAuditJson(
        { studyMeta: savedAudit.studyMeta || {}, responses: savedAudit.responses },
        appState.auditChecklist
      );
      if (validated.valid && validated.normalized) {
        appState.audit = {
          activePresetId: savedAudit.activePresetId || null,
          studyMeta: validated.normalized.studyMeta,
          responses: validated.normalized.responses
        };
      } else {
        appState.audit = createAuditStateFromPreset(appState.auditChecklist, "slice_leakage_pitfall");
      }
    } else {
      appState.audit = createAuditStateFromPreset(appState.auditChecklist, "slice_leakage_pitfall");
    }
  } else {
    appState.audit = { activePresetId: null, studyMeta: createEmptyAuditMeta(), responses: {} };
  }

  // Active tab
  const savedTab = readStorage(STORAGE_KEYS.activeTab, "cns5");
  appState.activeTab = ["cns5", "rano", "audit"].includes(savedTab) ? savedTab : "cns5";
}

async function init() {
  // Sync theme toggle button with pre-paint theme
  applyTheme(getCurrentTheme(), false);

  const [cns5Res, auditRes] = await Promise.allSettled([
    fetchLocalJson("./data/cns5_rules.json"),
    fetchLocalJson("./data/audit_checklist.json")
  ]);

  const failedFiles = [];
  if (cns5Res.status === "fulfilled") {
    appState.cns5Rules = cns5Res.value;
  } else {
    failedFiles.push("./data/cns5_rules.json");
  }

  if (auditRes.status === "fulfilled") {
    appState.auditChecklist = auditRes.value;
  } else {
    failedFiles.push("./data/audit_checklist.json");
  }

  if (failedFiles.length > 0) {
    showLocalFileNotice(failedFiles);
  }

  hydrateSavedStates();

  // Wire all studio interactions
  wireGlobalControls();
  wireCns5Events();
  wireRanoEvents();
  wireAuditEvents();

  // Initial render across all 3 modules
  renderCns5Vignettes();
  renderCns5FamilySelector();
  renderCns5Form();
  renderCns5Outputs();

  renderRanoSubTabs();
  renderRanoPresets();
  renderRanoForm();
  renderRanoOutputs();

  syncAuditMetaInputs();
  syncAuditSeverityFilterCounts();
  renderAuditPresetButtons();
  renderAuditChecklist();
  renderAuditOutputs();

  // Activate saved or default primary tab
  switchPrimaryTab(appState.activeTab, false);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
