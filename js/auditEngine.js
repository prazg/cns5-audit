/**
 * CNS5-Audit — Neuro-AI Methodological & Data-Leakage Audit Engine
 *
 * Pure, deterministic, zero-dependency ES Module.
 * Maps 36 neuroimaging & neuro-oncology AI audit items to CLAIM 2024 and TRIPOD+AI,
 * enforces the Critical Blocker score cap (<= 45/100), and exports publication-ready
 * Markdown, LaTeX (longtable), standalone SVG badge, and validated JSON state.
 *
 * Research & Educational Use Only — Not a Certified Medical Device (Non-SaMD).
 */

export const SEVERITY_WEIGHTS = Object.freeze({
  critical: 3,
  major: 2,
  recommended: 1
});

export const STATUS_POINTS = Object.freeze({
  pass: 1.0,
  partial: 0.5,
  fail: 0.0,
  unanswered: 0.0
});

export const CRITICAL_BLOCKER_SCORE_CAP = 45;

const VALID_STATUSES = new Set(["pass", "partial", "fail", "na", "unanswered"]);

const CANONICAL_META_KEYS = [
  "title",
  "authors",
  "year",
  "taskType",
  "modality",
  "cohortSummary",
  "reviewer"
];

const LATEX_ESCAPE_MAP = Object.freeze({
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  "$": "\\$",
  "#": "\\#",
  "_": "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}"
});

const XML_ESCAPE_MAP = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
});

const RISK_BADGE_THEMES = Object.freeze({
  Low: { bg: "#0F766E", label: "LOW RISK" },
  Moderate: { bg: "#B45309", label: "MODERATE RISK" },
  High: { bg: "#C2410C", label: "HIGH RISK" },
  "Critical Blocker": { bg: "#B91C1C", label: "CRITICAL BLOCKER" },
  "Not Assessed": { bg: "#475569", label: "NOT ASSESSED" }
});

const STATUS_DISPLAY_LABELS = Object.freeze({
  pass: "Pass",
  partial: "Partial",
  fail: "Fail",
  na: "N/A",
  unanswered: "Unanswered"
});

const SEVERITY_DISPLAY_LABELS = Object.freeze({
  critical: "Critical",
  major: "Major",
  recommended: "Recommended"
});

/**
 * Internal helper: returns true only for non-null plain objects (not arrays).
 */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Internal helper: normalizes a single response entry safely.
 */
function normalizeResponseEntry(raw) {
  if (typeof raw === "string") {
    const cleaned = raw.trim().toLowerCase();
    return {
      status: VALID_STATUSES.has(cleaned) ? cleaned : "unanswered",
      evidence: ""
    };
  }
  if (isPlainObject(raw)) {
    const rawStatus =
      typeof raw.status === "string" ? raw.status.trim().toLowerCase() : "unanswered";
    const status = VALID_STATUSES.has(rawStatus) ? rawStatus : "unanswered";
    const rawEvidence =
      typeof raw.evidence === "string"
        ? raw.evidence
        : typeof raw.notes === "string"
          ? raw.notes
          : "";
    return { status, evidence: rawEvidence };
  }
  return { status: "unanswered", evidence: "" };
}

/**
 * Internal helper: normalizes studyMeta to the canonical 7-field shape.
 */
function normalizeStudyMeta(meta) {
  const src = isPlainObject(meta) ? meta : {};
  const normalized = {};
  for (const key of CANONICAL_META_KEYS) {
    const val = src[key];
    normalized[key] = val === null || val === undefined ? "" : String(val).trim();
  }
  return normalized;
}

/**
 * Escapes all 10 special LaTeX characters cleanly in a single pass.
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeLatex(text) {
  if (text === null || text === undefined) {
    return "";
  }
  return String(text).replace(/[\\&%$#_{}~^]/g, (ch) => LATEX_ESCAPE_MAP[ch]);
}

/**
 * Escapes XML special characters and strips invalid XML 1.0 control bytes.
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeXml(text) {
  if (text === null || text === undefined) {
    return "";
  }
  const cleaned = String(text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return cleaned.replace(/[&<>"']/g, (ch) => XML_ESCAPE_MAP[ch]);
}

/**
 * Internal helper: prepares prose/cell text for compile-ready pdflatex tables.
 * Preserves escapeLatex purity while normalizing newlines and common Unicode glyphs.
 */
function formatLatexCell(text) {
  if (text === null || text === undefined) {
    return "";
  }
  const singleLine = String(text).replace(/\r?\n+/g, " ").replace(/\s{2,}/g, " ").trim();
  return escapeLatex(singleLine)
    .replace(/\u2264/g, "$\\leq$")
    .replace(/\u2265/g, "$\\geq$")
    .replace(/\u00B1/g, "$\\pm$")
    .replace(/\u00D7/g, "$\\times$")
    .replace(/\u0394/g, "$\\Delta$")
    .replace(/\u00B2/g, "$^2$")
    .replace(/\u00B3/g, "$^3$")
    .replace(/\u2014/g, "---")
    .replace(/\u2013/g, "--")
    .replace(/\u00B7/g, " $\\cdot$ ");
}

/**
 * Internal helper: safely escapes a Markdown table cell.
 */
function escapeMarkdownCell(text) {
  if (text === null || text === undefined) {
    return "";
  }
  return String(text)
    .replace(/\r?\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\|/g, "\\|");
}

/**
 * Computes weighted methodological rigor scores, per-domain breakdowns,
 * CLAIM 2024 / TRIPOD+AI guideline coverage, and the Critical Blocker cap.
 *
 * @param {object} checklistData Parsed contents of data/audit_checklist.json
 * @param {object} [responses={}] Map of itemId -> { status, evidence }
 * @returns {object} Structured audit score summary
 */
export function scoreAudit(checklistData, responses = {}) {
  const domains = Array.isArray(checklistData?.domains) ? checklistData.domains : [];
  const items = Array.isArray(checklistData?.items) ? checklistData.items : [];
  const responseMap = isPlainObject(responses) ? responses : {};

  const domainOrderMap = new Map();
  const domainBuckets = new Map();
  domains.forEach((domain, index) => {
    domainOrderMap.set(domain.id, index);
    domainBuckets.set(domain.id, {
      domainId: domain.id,
      title: domain.title || domain.id,
      shortTitle: domain.shortTitle || domain.title || domain.id,
      maxWeight: 0,
      earnedWeight: 0,
      answeredCount: 0,
      applicableCount: 0,
      criticalFailedCount: 0,
      passCount: 0,
      partialCount: 0,
      failCount: 0
    });
  });

  const counts = {
    total: items.length,
    applicable: 0,
    answered: 0,
    pass: 0,
    partial: 0,
    fail: 0,
    na: 0,
    unanswered: 0
  };

  let maxApplicableWeight = 0;
  let earnedWeight = 0;

  const criticalBlockersRaw = [];
  const criticalPartials = [];
  const criticalUnansweredIds = [];

  const claimTracker = {
    mappedItemCount: 0,
    applicableCount: 0,
    passCount: 0,
    partialCount: 0,
    failCount: 0,
    uniqueRefs: new Set()
  };

  const tripodTracker = {
    mappedItemCount: 0,
    applicableCount: 0,
    passCount: 0,
    partialCount: 0,
    failCount: 0,
    uniqueRefs: new Set()
  };

  items.forEach((item, itemIdx) => {
    const entry = normalizeResponseEntry(responseMap[item.id]);
    const status = entry.status;
    const severity = item.severity in SEVERITY_WEIGHTS ? item.severity : "recommended";
    const weight = SEVERITY_WEIGHTS[severity];

    if (status === "na") {
      counts.na += 1;
    } else {
      counts.applicable += 1;
      maxApplicableWeight += weight;
      earnedWeight += weight * STATUS_POINTS[status];

      if (status === "pass") {
        counts.pass += 1;
        counts.answered += 1;
      } else if (status === "partial") {
        counts.partial += 1;
        counts.answered += 1;
      } else if (status === "fail") {
        counts.fail += 1;
        counts.answered += 1;
      } else {
        counts.unanswered += 1;
      }
    }

    // Domain accumulation
    let bucket = domainBuckets.get(item.domainId);
    if (!bucket) {
      bucket = {
        domainId: item.domainId,
        title: item.domainId,
        shortTitle: item.domainId,
        maxWeight: 0,
        earnedWeight: 0,
        answeredCount: 0,
        applicableCount: 0,
        criticalFailedCount: 0,
        passCount: 0,
        partialCount: 0,
        failCount: 0
      };
      domainBuckets.set(item.domainId, bucket);
    }

    if (status !== "na") {
      bucket.applicableCount += 1;
      bucket.maxWeight += weight;
      bucket.earnedWeight += weight * STATUS_POINTS[status];

      if (status === "pass") {
        bucket.passCount += 1;
        bucket.answeredCount += 1;
      } else if (status === "partial") {
        bucket.partialCount += 1;
        bucket.answeredCount += 1;
      } else if (status === "fail") {
        bucket.failCount += 1;
        bucket.answeredCount += 1;
      }
    }

    // Critical item tracking
    if (severity === "critical") {
      if (status === "fail") {
        bucket.criticalFailedCount += 1;
        criticalBlockersRaw.push({
          domainOrder: domainOrderMap.has(item.domainId)
            ? domainOrderMap.get(item.domainId)
            : Number.MAX_SAFE_INTEGER,
          itemIdx,
          record: {
            id: item.id,
            domainId: item.domainId,
            title: item.title,
            failureMode: item.failureMode || "",
            remediation: item.remediation || ""
          }
        });
      } else if (status === "partial") {
        criticalPartials.push(item.id);
      } else if (status === "unanswered") {
        criticalUnansweredIds.push(item.id);
      }
    }

    // Guideline coverage tracking (CLAIM 2024)
    const claimRefs = Array.isArray(item.claim2024Refs) ? item.claim2024Refs : [];
    if (claimRefs.length > 0) {
      claimTracker.mappedItemCount += 1;
      for (const ref of claimRefs) {
        claimTracker.uniqueRefs.add(ref);
      }
      if (status !== "na") {
        claimTracker.applicableCount += 1;
        if (status === "pass") {
          claimTracker.passCount += 1;
        } else if (status === "partial") {
          claimTracker.partialCount += 1;
        } else if (status === "fail") {
          claimTracker.failCount += 1;
        }
      }
    }

    // Guideline coverage tracking (TRIPOD+AI)
    const tripodRefs = Array.isArray(item.tripodAiRefs) ? item.tripodAiRefs : [];
    if (tripodRefs.length > 0) {
      tripodTracker.mappedItemCount += 1;
      for (const ref of tripodRefs) {
        tripodTracker.uniqueRefs.add(ref);
      }
      if (status !== "na") {
        tripodTracker.applicableCount += 1;
        if (status === "pass") {
          tripodTracker.passCount += 1;
        } else if (status === "partial") {
          tripodTracker.partialCount += 1;
        } else if (status === "fail") {
          tripodTracker.failCount += 1;
        }
      }
    }
  });

  // Sort failed critical blockers strictly by domain order, then item order
  criticalBlockersRaw.sort((a, b) =>
    a.domainOrder !== b.domainOrder ? a.domainOrder - b.domainOrder : a.itemIdx - b.itemIdx
  );
  const criticalBlockersFailed = criticalBlockersRaw.map((x) => x.record);
  const criticalBlockersFailedCount = criticalBlockersFailed.length;
  const criticalFailedIds = criticalBlockersFailed.map((x) => x.id);
  const criticalPartialsCount = criticalPartials.length;
  const criticalUnansweredCount = criticalUnansweredIds.length;

  const rawOverallScore =
    maxApplicableWeight > 0 ? Math.round((earnedWeight / maxApplicableWeight) * 100) : 0;

  const completionPct =
    counts.applicable > 0 ? Math.round((counts.answered / counts.applicable) * 100) : 0;

  const blockerTriggered = criticalBlockersFailedCount > 0;
  const overallScore = blockerTriggered
    ? Math.min(rawOverallScore, CRITICAL_BLOCKER_SCORE_CAP)
    : rawOverallScore;
  const capApplied = blockerTriggered && rawOverallScore > CRITICAL_BLOCKER_SCORE_CAP;

  let capReason = null;
  if (capApplied) {
    capReason = `Critical Blocker cap applied: raw weighted rigor score (${rawOverallScore}/100) was clamped to ${CRITICAL_BLOCKER_SCORE_CAP}/100 because ${criticalBlockersFailedCount} critical leakage or reference-standard ${criticalBlockersFailedCount === 1 ? "item failed" : "items failed"} (${criticalFailedIds.join(", ")}).`;
  } else if (blockerTriggered) {
    capReason = `Critical Blocker triggered by ${criticalBlockersFailedCount} failed critical ${criticalBlockersFailedCount === 1 ? "item" : "items"} (${criticalFailedIds.join(", ")}); overall score cannot exceed ${CRITICAL_BLOCKER_SCORE_CAP}/100 until every critical leakage blocker is resolved.`;
  }

  const criticalUnansweredWarning =
    counts.answered > 0 && criticalUnansweredCount > 0
      ? `${criticalUnansweredCount} applicable Critical Blocker ${criticalUnansweredCount === 1 ? "item remains" : "items remain"} unanswered (${criticalUnansweredIds.join(", ")}); leakage risk is held at High until all applicable Critical Blockers are verified.`
      : null;

  let leakageRiskLevel;
  if (counts.answered === 0) {
    leakageRiskLevel = "Not Assessed";
  } else if (criticalBlockersFailedCount > 0) {
    leakageRiskLevel = "Critical Blocker";
  } else if (criticalPartialsCount > 0 || criticalUnansweredCount > 0 || overallScore < 60) {
    leakageRiskLevel = "High";
  } else if (overallScore < 80) {
    leakageRiskLevel = "Moderate";
  } else {
    leakageRiskLevel = "Low";
  }

  const domainScores = domains.map((domain) => {
    const b = domainBuckets.get(domain.id);
    const score = b.maxWeight > 0 ? Math.round((b.earnedWeight / b.maxWeight) * 100) : 0;
    return {
      domainId: b.domainId,
      title: b.title,
      shortTitle: b.shortTitle,
      score,
      answeredCount: b.answeredCount,
      applicableCount: b.applicableCount,
      criticalFailedCount: b.criticalFailedCount,
      passCount: b.passCount,
      partialCount: b.partialCount,
      failCount: b.failCount
    };
  });

  const finalizeCoverage = (tracker) => ({
    mappedItemCount: tracker.mappedItemCount,
    applicableCount: tracker.applicableCount,
    passCount: tracker.passCount,
    partialCount: tracker.partialCount,
    failCount: tracker.failCount,
    compliancePct:
      tracker.applicableCount > 0
        ? Math.round(
            ((tracker.passCount + 0.5 * tracker.partialCount) / tracker.applicableCount) * 100
          )
        : 0,
    uniqueRefCount: tracker.uniqueRefs.size
  });

  return {
    overallScore,
    rawOverallScore,
    capApplied,
    blockerTriggered,
    capReason,
    leakageRiskLevel,
    completionPct,
    counts,
    criticalBlockersFailedCount,
    criticalBlockersFailed,
    criticalPartialsCount,
    criticalFailedIds,
    criticalUnansweredCount,
    criticalUnansweredIds,
    criticalUnansweredWarning,
    domainScores,
    guidelineCoverage: {
      claim2024: finalizeCoverage(claimTracker),
      tripodAi: finalizeCoverage(tripodTracker)
    }
  };
}

/**
 * Generates a publication-ready GitHub-Flavored Markdown audit supplement.
 *
 * @param {object} checklistData
 * @param {object} [responses={}]
 * @param {object} [studyMeta={}]
 * @param {object|null} [scoreResult=null]
 * @returns {string}
 */
export function exportAuditMarkdown(
  checklistData,
  responses = {},
  studyMeta = {},
  scoreResult = null
) {
  const score = scoreResult || scoreAudit(checklistData, responses);
  const meta = normalizeStudyMeta(studyMeta);
  const domains = Array.isArray(checklistData?.domains) ? checklistData.domains : [];
  const items = Array.isArray(checklistData?.items) ? checklistData.items : [];
  const responseMap = isPlainObject(responses) ? responses : {};
  const domainTitleMap = new Map(domains.map((d) => [d.id, d.title]));

  const lines = [];

  lines.push("# CNS5-Audit — Neuro-AI Methodological & Data-Leakage Audit Report");
  lines.push("");
  lines.push(
    "> **Research & Peer-Review Supplement** — Mapped to **CLAIM 2024** (Tejani et al., *Radiology: Artificial Intelligence* 2024;6(4):e240300) and **TRIPOD+AI** (Collins et al., *BMJ* 2024;385:e078378). *For Research & Educational Use Only — Not a Certified Medical Device.*"
  );
  lines.push("");

  // Study Metadata
  lines.push("## Study Metadata");
  lines.push("");
  lines.push("| Field | Details |");
  lines.push("| :--- | :--- |");
  lines.push(`| **Study Title** | ${escapeMarkdownCell(meta.title || "Not specified")} |`);
  lines.push(`| **Authors** | ${escapeMarkdownCell(meta.authors || "Not specified")} |`);
  lines.push(`| **Year** | ${escapeMarkdownCell(meta.year || "Not specified")} |`);
  lines.push(`| **Task Type** | ${escapeMarkdownCell(meta.taskType || "Not specified")} |`);
  lines.push(`| **Imaging Modality** | ${escapeMarkdownCell(meta.modality || "Not specified")} |`);
  lines.push(`| **Cohort Summary** | ${escapeMarkdownCell(meta.cohortSummary || "Not specified")} |`);
  lines.push(`| **Auditor / Reviewer** | ${escapeMarkdownCell(meta.reviewer || "Not specified")} |`);
  lines.push("");

  // Executive Rigor Summary
  lines.push("## Executive Rigor Summary");
  lines.push("");
  const capSummary = score.capApplied
    ? `YES — Clamped from ${score.rawOverallScore}/100 to ${score.overallScore}/100`
    : score.blockerTriggered
      ? `TRIGGERED — Ceiling locked at ${CRITICAL_BLOCKER_SCORE_CAP}/100`
      : "No";

  lines.push("| Metric | Result |");
  lines.push("| :--- | :--- |");
  lines.push(`| **Effective Rigor Score** | **${score.overallScore} / 100** |`);
  lines.push(`| **Raw Weighted Score** | ${score.rawOverallScore} / 100 |`);
  lines.push(`| **Leakage Risk Tier** | **${score.leakageRiskLevel}** |`);
  lines.push(`| **Critical Blocker Cap** | ${capSummary} |`);
  lines.push(
    `| **Audit Completion** | ${score.completionPct}% (${score.counts.answered}/${score.counts.applicable} applicable; ${score.counts.na} N/A; ${score.counts.unanswered} unanswered) |`
  );
  lines.push(
    `| **Item Tally** | Pass: ${score.counts.pass} · Partial: ${score.counts.partial} · Fail: ${score.counts.fail} · N/A: ${score.counts.na} · Unanswered: ${score.counts.unanswered} |`
  );
  lines.push(
    `| **CLAIM 2024 Coverage** | ${score.guidelineCoverage.claim2024.compliancePct}% compliance across ${score.guidelineCoverage.claim2024.uniqueRefCount} mapped CLAIM items |`
  );
  lines.push(
    `| **TRIPOD+AI Coverage** | ${score.guidelineCoverage.tripodAi.compliancePct}% compliance across ${score.guidelineCoverage.tripodAi.uniqueRefCount} mapped TRIPOD+AI items |`
  );
  lines.push("");

  // Critical Blocker Alert Section
  if (score.criticalBlockersFailedCount > 0) {
    lines.push("## Critical Leakage & Methodology Blockers");
    lines.push("");
    lines.push(`> **CRITICAL BLOCKER ALERT:** ${score.capReason}`);
    lines.push("");
    lines.push("| ID | Domain | Failed Criterion | Why This Invalidates Neuro-AI Studies | Concrete Remediation |");
    lines.push("| :--- | :--- | :--- | :--- | :--- |");
    for (const blocker of score.criticalBlockersFailed) {
      const dTitle = domainTitleMap.get(blocker.domainId) || blocker.domainId;
      lines.push(
        `| \`${blocker.id}\` | ${escapeMarkdownCell(dTitle)} | **${escapeMarkdownCell(blocker.title)}** | ${escapeMarkdownCell(blocker.failureMode)} | ${escapeMarkdownCell(blocker.remediation)} |`
      );
    }
    lines.push("");
  }

  if (score.criticalUnansweredWarning) {
    lines.push(`> **UNVERIFIED CRITICAL BLOCKERS:** ${score.criticalUnansweredWarning}`);
    lines.push("");
  }

  // Domain Breakdown
  lines.push("## Domain Rigor Breakdown");
  lines.push("");
  lines.push("| Domain | Score | Answered | Pass | Partial | Fail | Critical Blockers Failed |");
  lines.push("| :--- | :---: | :---: | :---: | :---: | :---: | :---: |");
  for (const ds of score.domainScores) {
    const blockerCell =
      ds.criticalFailedCount > 0 ? `**${ds.criticalFailedCount} BLOCKER**` : "0";
    lines.push(
      `| ${escapeMarkdownCell(ds.title)} | **${ds.score}%** | ${ds.answeredCount}/${ds.applicableCount} | ${ds.passCount} | ${ds.partialCount} | ${ds.failCount} | ${blockerCell} |`
    );
  }
  lines.push("");

  // Full 36-Item Supplement Matrix
  lines.push("## Complete 36-Item Neuro-AI Audit Matrix");
  lines.push("");
  lines.push("| ID | Domain | Severity | Audit Criterion | Status | CLAIM 2024 | TRIPOD+AI | Evidence / Reviewer Notes |");
  lines.push("| :--- | :--- | :---: | :--- | :---: | :--- | :--- | :--- |");
  for (const item of items) {
    const resp = normalizeResponseEntry(responseMap[item.id]);
    const dTitle = domainTitleMap.get(item.domainId) || item.domainId;
    const sevLabel = SEVERITY_DISPLAY_LABELS[item.severity] || item.severity;
    const statusLabel = STATUS_DISPLAY_LABELS[resp.status] || resp.status;
    const claimStr = Array.isArray(item.claim2024Refs) ? item.claim2024Refs.join(", ") : "";
    const tripodStr = Array.isArray(item.tripodAiRefs) ? item.tripodAiRefs.join(", ") : "";
    const evidenceStr = resp.evidence.trim() ? escapeMarkdownCell(resp.evidence) : "—";
    const statusCell =
      resp.status === "fail" && item.severity === "critical"
        ? `**${statusLabel} (Blocker)**`
        : statusLabel;
    lines.push(
      `| \`${item.id}\` | ${escapeMarkdownCell(dTitle)} | ${sevLabel} | ${escapeMarkdownCell(item.title)} | ${statusCell} | ${escapeMarkdownCell(claimStr)} | ${escapeMarkdownCell(tripodStr)} | ${evidenceStr} |`
    );
  }
  lines.push("");

  // Standards Citation Footer
  lines.push("---");
  lines.push("");
  lines.push("### Reference Standards");
  lines.push(
    "- **CLAIM 2024:** Tejani AS, Klontzas ME, Gatti AA, Kahn CE Jr, Mongan J, et al. *Checklist for Artificial Intelligence in Medical Imaging (CLAIM): 2024 Update.* Radiology: Artificial Intelligence. 2024;6(4):e240300. `doi:10.1148/ryai.240300`"
  );
  lines.push(
    "- **TRIPOD+AI:** Collins GS, Moons KGM, Dhiman P, et al. *TRIPOD+AI statement: updated guidance for reporting clinical prediction models that use regression or machine learning methods.* BMJ. 2024;385:e078378. `doi:10.1136/bmj-2023-078378`"
  );

  return lines.join("\n");
}

/**
 * Generates a compile-ready LaTeX longtable supplement with all TeX special
 * characters safely escaped via escapeLatex().
 *
 * @param {object} checklistData
 * @param {object} [responses={}]
 * @param {object} [studyMeta={}]
 * @param {object|null} [scoreResult=null]
 * @returns {string}
 */
export function exportAuditLatex(
  checklistData,
  responses = {},
  studyMeta = {},
  scoreResult = null
) {
  const score = scoreResult || scoreAudit(checklistData, responses);
  const meta = normalizeStudyMeta(studyMeta);
  const domains = Array.isArray(checklistData?.domains) ? checklistData.domains : [];
  const items = Array.isArray(checklistData?.items) ? checklistData.items : [];
  const responseMap = isPlainObject(responses) ? responses : {};

  const itemsByDomain = new Map();
  for (const d of domains) {
    itemsByDomain.set(d.id, []);
  }
  for (const item of items) {
    if (!itemsByDomain.has(item.domainId)) {
      itemsByDomain.set(item.domainId, []);
    }
    itemsByDomain.get(item.domainId).push(item);
  }

  const domainScoreMap = new Map(score.domainScores.map((ds) => [ds.domainId, ds]));

  const lines = [];
  lines.push("% ============================================================================");
  lines.push("% CNS5-Audit Neuro-AI Methodological & Data-Leakage Audit Supplement");
  lines.push("% Required LaTeX packages in preamble:");
  lines.push("%   \\usepackage{booktabs}");
  lines.push("%   \\usepackage{longtable}");
  lines.push("%   \\usepackage{array}");
  lines.push("%   \\usepackage{ragged2e}");
  lines.push("%   \\usepackage[margin=0.75in]{geometry}");
  lines.push("% ============================================================================");
  lines.push("");
  lines.push("\\subsection*{CNS5-Audit: Neuro-AI Methodological \\& Data-Leakage Audit Supplement}");
  lines.push("");

  // Study metadata header
  lines.push("\\noindent\\textbf{Study Title:} " + formatLatexCell(meta.title || "Not specified") + " \\\\");
  lines.push("\\textbf{Authors:} " + formatLatexCell(meta.authors || "Not specified") + " \\quad \\textbf{Year:} " + formatLatexCell(meta.year || "Not specified") + " \\\\");
  lines.push("\\textbf{Task / Modality:} " + formatLatexCell(meta.taskType || "Not specified") + " --- " + formatLatexCell(meta.modality || "Not specified") + " \\\\");
  lines.push("\\textbf{Cohort Summary:} " + formatLatexCell(meta.cohortSummary || "Not specified") + " \\\\");
  lines.push("\\textbf{Auditor / Reviewer:} " + formatLatexCell(meta.reviewer || "Not specified"));
  lines.push("");
  lines.push("\\vspace{0.5em}");

  // Score & Blocker Summary Callout Box
  lines.push("\\noindent\\fbox{\\parbox{0.97\\linewidth}{\\small");
  lines.push(
    `  \\textbf{Effective Rigor Score:} ${score.overallScore}/100 ` +
      `(Raw Weighted: ${score.rawOverallScore}/100) \\quad ` +
      `\\textbf{Leakage Risk Tier:} ${formatLatexCell(score.leakageRiskLevel)} \\quad ` +
      `\\textbf{Completion:} ${score.completionPct}\\% (${score.counts.answered}/${score.counts.applicable} applicable, ${score.counts.na} N/A) \\\\`
  );
  lines.push(
    `  \\textbf{Item Tally:} Pass: ${score.counts.pass}, Partial: ${score.counts.partial}, ` +
      `Fail: ${score.counts.fail}, N/A: ${score.counts.na}, Unanswered: ${score.counts.unanswered} \\quad ` +
      `\\textbf{CLAIM 2024:} ${score.guidelineCoverage.claim2024.compliancePct}\\% \\quad ` +
      `\\textbf{TRIPOD+AI:} ${score.guidelineCoverage.tripodAi.compliancePct}\\%`
  );
  if (score.blockerTriggered && score.capReason) {
    lines.push("  \\\\[0.35em]");
    lines.push(`  \\textbf{CRITICAL BLOCKER ALERT:} ${formatLatexCell(score.capReason)}`);
  }
  if (score.criticalUnansweredWarning) {
    lines.push("  \\\\[0.35em]");
    lines.push(`  \\textbf{UNVERIFIED CRITICAL BLOCKERS:} ${formatLatexCell(score.criticalUnansweredWarning)}`);
  }
  lines.push("}}");
  lines.push("");
  lines.push("\\vspace{0.6em}");

  // Compact Domain Summary Table
  lines.push("\\begin{center}");
  lines.push("\\small");
  lines.push("\\begin{tabular}{@{}lcccccc@{}}");
  lines.push("\\toprule");
  lines.push("\\textbf{Audit Domain} & \\textbf{Score} & \\textbf{Answered} & \\textbf{Pass} & \\textbf{Partial} & \\textbf{Fail} & \\textbf{Blockers} \\\\");
  lines.push("\\midrule");
  for (const ds of score.domainScores) {
    lines.push(
      `${formatLatexCell(ds.title)} & ${ds.score}\\% & ${ds.answeredCount}/${ds.applicableCount} & ` +
        `${ds.passCount} & ${ds.partialCount} & ${ds.failCount} & ${ds.criticalFailedCount} \\\\`
    );
  }
  lines.push("\\bottomrule");
  lines.push("\\end{tabular}");
  lines.push("\\end{center}");
  lines.push("");

  // Full 36-Item Longtable
  lines.push("{\\footnotesize");
  lines.push("\\setlength{\\tabcolsep}{4pt}");
  lines.push("\\renewcommand{\\arraystretch}{1.2}");
  lines.push(
    "\\begin{longtable}{@{}p{0.06\\linewidth}p{0.09\\linewidth}p{0.26\\linewidth}p{0.09\\linewidth}p{0.17\\linewidth}p{0.27\\linewidth}@{}}"
  );
  lines.push(
    "\\caption{CNS5-Audit 36-Item Neuro-AI Methodological and Data-Leakage Checklist (Mapped to CLAIM 2024 \\& TRIPOD+AI).}\\\\"
  );
  lines.push("\\toprule");
  lines.push(
    "\\textbf{ID} & \\textbf{Severity} & \\textbf{Audit Criterion} & \\textbf{Status} & \\textbf{CLAIM / TRIPOD+AI} & \\textbf{Evidence / Reviewer Notes} \\\\"
  );
  lines.push("\\midrule");
  lines.push("\\endfirsthead");
  lines.push("");
  lines.push("\\multicolumn{6}{@{}l}{\\emph{(Continued from previous page)}}\\\\");
  lines.push("\\toprule");
  lines.push(
    "\\textbf{ID} & \\textbf{Severity} & \\textbf{Audit Criterion} & \\textbf{Status} & \\textbf{CLAIM / TRIPOD+AI} & \\textbf{Evidence / Reviewer Notes} \\\\"
  );
  lines.push("\\midrule");
  lines.push("\\endhead");
  lines.push("");
  lines.push("\\midrule");
  lines.push("\\multicolumn{6}{r@{}}{\\emph{Continued on next page}}\\\\");
  lines.push("\\endfoot");
  lines.push("");
  lines.push("\\bottomrule");
  lines.push("\\endlastfoot");

  domains.forEach((domain, dIdx) => {
    const ds = domainScoreMap.get(domain.id);
    const scoreStr = ds ? `${ds.score}\\%` : "0\\%";
    const blockerNote =
      ds && ds.criticalFailedCount > 0
        ? ` --- ${ds.criticalFailedCount} Critical Blocker${ds.criticalFailedCount === 1 ? "" : "s"} Failed`
        : "";
    if (dIdx > 0) {
      lines.push("\\midrule");
    }
    lines.push(
      `\\multicolumn{6}{@{}l}{\\textbf{${dIdx + 1}. ${formatLatexCell(domain.title)} (${scoreStr}${blockerNote})}} \\\\`
    );
    lines.push("\\midrule");

    const domainItems = itemsByDomain.get(domain.id) || [];
    for (const item of domainItems) {
      const resp = normalizeResponseEntry(responseMap[item.id]);
      const sevLabel = SEVERITY_DISPLAY_LABELS[item.severity] || item.severity;
      const statusLabel = STATUS_DISPLAY_LABELS[resp.status] || resp.status;
      const isBlockerFail = item.severity === "critical" && resp.status === "fail";
      const statusCell = isBlockerFail
        ? `\\textbf{${formatLatexCell(statusLabel)}*}`
        : formatLatexCell(statusLabel);

      const refs = [
        ...(Array.isArray(item.claim2024Refs) ? item.claim2024Refs : []),
        ...(Array.isArray(item.tripodAiRefs) ? item.tripodAiRefs : [])
      ].join(", ");

      const evidenceCell = resp.evidence.trim() ? formatLatexCell(resp.evidence) : "---";
      lines.push(
        `${formatLatexCell(item.id)} & ${formatLatexCell(sevLabel)} & ` +
          `${formatLatexCell(item.title)} & ${statusCell} & ` +
          `${formatLatexCell(refs)} & ${evidenceCell} \\\\`
      );
    }
  });

  lines.push("\\end{longtable}");
  lines.push("}");
  lines.push("");
  lines.push(
    "\\noindent\\footnotesize{\\emph{Note:} Items marked with \\textbf{Fail*} denote failed Critical Leakage/Methodology Blockers that cap overall score at 45/100. Standards: CLAIM 2024 (Tejani et al., Radiology: AI 2024; doi:10.1148/ryai.240300) \\& TRIPOD+AI (Collins et al., BMJ 2024; doi:10.1136/bmj-2023-078378). For research \\& peer-review use only (Non-SaMD).}"
  );

  return lines.join("\n");
}

/**
 * Generates a standalone, XML-valid 420x36 SVG badge displaying the study's
 * rigor score, color-coded risk tier, and Critical Blocker count when triggered.
 *
 * @param {object} scoreResult
 * @param {object} [studyMeta={}]
 * @returns {string}
 */
export function exportAuditBadgeSvg(scoreResult, studyMeta = {}) {
  const safeScore = isPlainObject(scoreResult) ? scoreResult : {};
  const meta = normalizeStudyMeta(studyMeta);

  const overallScore =
    typeof safeScore.overallScore === "number" && Number.isFinite(safeScore.overallScore)
      ? Math.max(0, Math.min(100, Math.round(safeScore.overallScore)))
      : 0;

  const riskLevel =
    typeof safeScore.leakageRiskLevel === "string" && safeScore.leakageRiskLevel in RISK_BADGE_THEMES
      ? safeScore.leakageRiskLevel
      : "Not Assessed";

  const blockerCount =
    typeof safeScore.criticalBlockersFailedCount === "number" &&
    safeScore.criticalBlockersFailedCount > 0
      ? Math.round(safeScore.criticalBlockersFailedCount)
      : 0;

  const capApplied = Boolean(safeScore.capApplied);
  const theme = RISK_BADGE_THEMES[riskLevel] || RISK_BADGE_THEMES["Not Assessed"];

  const scoreText = capApplied ? `${overallScore}/100 CAP` : `${overallScore}/100`;
  const pillText =
    blockerCount > 0
      ? `BLOCKER (${blockerCount} ${blockerCount === 1 ? "FAIL" : "FAILS"})`
      : theme.label;

  const studySuffix = meta.title ? ` — ${meta.title.slice(0, 72)}` : "";
  const ariaLabel = `CNS5-Audit Neuro-AI Rigor Score: ${overallScore} out of 100, ${riskLevel}${blockerCount > 0 ? `, ${blockerCount} critical blockers failed` : ""}${studySuffix}`;
  const titleText = ariaLabel;

  const escapedAria = escapeXml(ariaLabel);
  const escapedTitle = escapeXml(titleText);
  const escapedScoreText = escapeXml(scoreText);
  const escapedPillText = escapeXml(pillText);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="36" viewBox="0 0 420 36" role="img" aria-label="${escapedAria}">`,
    `  <title>${escapedTitle}</title>`,
    `  <defs>`,
    `    <clipPath id="cns5-badge-clip">`,
    `      <rect x="0" y="0" width="420" height="36" rx="6" ry="6"/>`,
    `    </clipPath>`,
    `  </defs>`,
    `  <g clip-path="url(#cns5-badge-clip)">`,
    `    <rect x="0" y="0" width="146" height="36" fill="#0F172A"/>`,
    `    <rect x="146" y="0" width="104" height="36" fill="#1E293B"/>`,
    `    <rect x="250" y="0" width="170" height="36" fill="${theme.bg}"/>`,
    `    <line x1="146" y1="0" x2="146" y2="36" stroke="#334155" stroke-width="1"/>`,
    `    <line x1="250" y1="0" x2="250" y2="36" stroke="#0F172A" stroke-opacity="0.25" stroke-width="1"/>`,
    `  </g>`,
    `  <rect x="0.5" y="0.5" width="419" height="35" rx="5.5" ry="5.5" fill="none" stroke="#334155" stroke-opacity="0.35" stroke-width="1"/>`,
    `  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11.5" font-weight="700" fill="#FFFFFF" text-anchor="middle">`,
    `    <text x="73" y="22" letter-spacing="0.4">CNS5-AUDIT RIGOR</text>`,
    `    <text x="198" y="22" font-size="12" letter-spacing="0.2">${escapedScoreText}</text>`,
    `    <text x="335" y="22" letter-spacing="0.4">${escapedPillText}</text>`,
    `  </g>`,
    `</svg>`
  ].join("\n");
}

/**
 * Serializes audit metadata, responses, and summary metrics to portable JSON.
 *
 * @param {object} [studyMeta={}]
 * @param {object} [responses={}]
 * @param {object|null} [scoreResult=null]
 * @returns {string}
 */
export function exportAuditJson(studyMeta = {}, responses = {}, scoreResult = null) {
  const meta = normalizeStudyMeta(studyMeta);
  const srcResponses = isPlainObject(responses) ? responses : {};
  const cleanResponses = {};

  for (const [itemId, entry] of Object.entries(srcResponses)) {
    cleanResponses[itemId] = normalizeResponseEntry(entry);
  }

  const payload = {
    schemaVersion: "1.0.0",
    tool: "CNS5-Audit",
    exportedAt: new Date().toISOString(),
    studyMeta: meta,
    responses: cleanResponses,
    summary: isPlainObject(scoreResult)
      ? {
          overallScore: scoreResult.overallScore ?? 0,
          rawOverallScore: scoreResult.rawOverallScore ?? 0,
          capApplied: Boolean(scoreResult.capApplied),
          blockerTriggered: Boolean(scoreResult.blockerTriggered),
          leakageRiskLevel: scoreResult.leakageRiskLevel || "Not Assessed",
          completionPct: scoreResult.completionPct ?? 0,
          criticalBlockersFailedCount: scoreResult.criticalBlockersFailedCount ?? 0
        }
      : null
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Safely parses and validates an imported JSON string or plain audit state object.
 * Never throws on malformed JSON or corrupted inputs.
 *
 * @param {string|object} rawInput
 * @param {object} [checklistData=null]
 * @returns {{ valid: boolean, errors: string[], warnings: string[], normalized: { studyMeta: object, responses: object } | null }}
 */
export function validateImportedAuditJson(rawInput, checklistData = null) {
  const errors = [];
  const warnings = [];

  let parsed = rawInput;
  if (typeof rawInput === "string") {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return {
        valid: false,
        errors: ["Imported JSON content is empty."],
        warnings: [],
        normalized: null
      };
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      return {
        valid: false,
        errors: [`Invalid JSON syntax: ${err instanceof Error ? err.message : "parse error"}`],
        warnings: [],
        normalized: null
      };
    }
  }

  if (!isPlainObject(parsed)) {
    return {
      valid: false,
      errors: ["Imported audit payload must be a JSON object."],
      warnings: [],
      normalized: null
    };
  }

  if (parsed.schemaVersion !== undefined && parsed.schemaVersion !== "1.0.0") {
    warnings.push(
      `Imported schemaVersion '${String(parsed.schemaVersion)}' differs from expected '1.0.0'; attempting compatible import.`
    );
  }

  // Validate studyMeta
  const normalizedMeta = normalizeStudyMeta({});
  if (parsed.studyMeta === undefined || parsed.studyMeta === null) {
    warnings.push("studyMeta section missing; initialized empty study metadata fields.");
  } else if (!isPlainObject(parsed.studyMeta)) {
    errors.push("Field 'studyMeta' must be a JSON object.");
  } else {
    for (const key of CANONICAL_META_KEYS) {
      const val = parsed.studyMeta[key];
      if (val === undefined || val === null) {
        normalizedMeta[key] = "";
      } else if (typeof val === "string") {
        normalizedMeta[key] = val.trim();
      } else if (typeof val === "number" || typeof val === "boolean") {
        warnings.push(`studyMeta.${key} was coerced to string.`);
        normalizedMeta[key] = String(val);
      } else {
        errors.push(`studyMeta.${key} must be a string.`);
      }
    }
  }

  // Validate responses
  if (!isPlainObject(parsed.responses)) {
    errors.push("Field 'responses' is required and must be a JSON object keyed by audit item ID.");
    return { valid: false, errors, warnings, normalized: null };
  }

  const checklistItems = Array.isArray(checklistData?.items) ? checklistData.items : [];
  const knownItemIds = checklistItems.map((i) => i.id);
  const knownItemSet = new Set(knownItemIds);

  const normalizedResponses = {};
  const unknownIds = [];

  for (const [id, entry] of Object.entries(parsed.responses)) {
    if (knownItemSet.size > 0 && !knownItemSet.has(id)) {
      unknownIds.push(id);
      continue;
    }

    if (typeof entry === "string") {
      const cleanedStatus = entry.trim().toLowerCase();
      if (!VALID_STATUSES.has(cleanedStatus)) {
        errors.push(
          `Item '${id}' has unsupported status '${entry}' (expected pass, partial, fail, na, or unanswered).`
        );
      } else {
        warnings.push(`Item '${id}' used shorthand string status; normalized to object format.`);
        normalizedResponses[id] = { status: cleanedStatus, evidence: "" };
      }
      continue;
    }

    if (!isPlainObject(entry)) {
      errors.push(`Item '${id}' response must be an object with 'status' and optional 'evidence'.`);
      continue;
    }

    const rawStatus = entry.status;
    if (typeof rawStatus !== "string") {
      errors.push(`Item '${id}' is missing a valid string 'status'.`);
      continue;
    }

    const cleanedStatus = rawStatus.trim().toLowerCase();
    if (!VALID_STATUSES.has(cleanedStatus)) {
      errors.push(
        `Item '${id}' has unsupported status '${rawStatus}' (expected pass, partial, fail, na, or unanswered).`
      );
      continue;
    }

    let evidence = "";
    const rawEvidence = entry.evidence !== undefined ? entry.evidence : entry.notes;
    if (rawEvidence !== undefined && rawEvidence !== null) {
      if (typeof rawEvidence === "string") {
        evidence = rawEvidence;
      } else if (typeof rawEvidence === "number" || typeof rawEvidence === "boolean") {
        warnings.push(`Item '${id}' evidence was coerced to string.`);
        evidence = String(rawEvidence);
      } else {
        errors.push(`Item '${id}' evidence must be a string.`);
        continue;
      }
    }

    normalizedResponses[id] = { status: cleanedStatus, evidence };
  }

  if (unknownIds.length > 0) {
    warnings.push(
      `Ignored ${unknownIds.length} unrecognized item ID(s): ${unknownIds.slice(0, 6).join(", ")}${unknownIds.length > 6 ? "..." : ""}.`
    );
  }

  // Backfill any missing canonical checklist items as unanswered
  let missingCount = 0;
  for (const id of knownItemIds) {
    if (!(id in normalizedResponses)) {
      normalizedResponses[id] = { status: "unanswered", evidence: "" };
      missingCount += 1;
    }
  }
  if (missingCount > 0) {
    warnings.push(
      `${missingCount} checklist item(s) omitted from the imported file were defaulted to 'unanswered'.`
    );
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
      normalized: null
    };
  }

  return {
    valid: true,
    errors: [],
    warnings,
    normalized: {
      studyMeta: normalizedMeta,
      responses: normalizedResponses
    }
  };
}

/**
 * Convenience alias for exportAuditJson().
 */
export function serializeAuditState(studyMeta = {}, responses = {}, scoreResult = null) {
  return exportAuditJson(studyMeta, responses, scoreResult);
}

/**
 * Convenience alias for validateImportedAuditJson().
 */
export function parseImportedAuditState(rawInput, checklistData = null) {
  return validateImportedAuditJson(rawInput, checklistData);
}
