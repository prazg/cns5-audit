#!/usr/bin/env python3
"""
CNS5-Audit — Automated Clinical Criteria, Schema & Contract Verification Suite

Pure Python 3.12 standard library only (zero third-party dependencies).
Validates:
  1. Zero-build & 100% offline hygiene (index.html, css/styles.css, required files)
  2. WHO CNS5 knowledge base schema, Arabic-only grades, citations & vignettes
  3. Neuro-AI 36-item audit schema, CLAIM 2024 / TRIPOD+AI refs, presets & scoring oracle
  4. ES Module export/import contracts and zero-DOM purity of logic engines
  5. Pure Python clinical & methodological parity checks (always executes everywhere)
  6. Live JS engine verification via Node.js or Headless Edge/Chrome/Chromium when
     available, with graceful fallback on pure-Python CI containers

Exit code: 0 on full pass, non-zero on any failure.
"""

from __future__ import annotations

import argparse
import http.server
import json
import math
import os
import re
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent

REQUIRED_PROJECT_FILES = [
    "ARCHITECTURE.md",
    "index.html",
    "css/styles.css",
    "data/cns5_rules.json",
    "data/audit_checklist.json",
    "js/cns5Engine.js",
    "js/ranoCalculators.js",
    "js/auditEngine.js",
    "js/visuals.js",
    "js/app.js",
]

EXPECTED_CNS5_FAMILIES = [
    "adult_diffuse_glioma",
    "pediatric_hgg",
    "pediatric_lgg",
    "circumscribed_astrocytic",
    "ependymal_tumor",
    "meningioma",
    "medulloblastoma",
]

EXPECTED_AUDIT_DOMAINS = [
    ("cohort_splitting", "CS"),
    ("mri_preprocessing", "MP"),
    ("radiomics_fm_hygiene", "RF"),
    ("multisite_shortcuts", "MS"),
    ("clinical_calibration", "CC"),
    ("open_science_repro", "OS"),
]

EXPECTED_CRITICAL_ITEM_IDS = {
    "CS-01",
    "CS-02",
    "CS-03",
    "MP-01",
    "RF-01",
    "RF-04",
    "RF-05",
    "MS-01",
    "MS-02",
    "CC-01",
    "CC-06",
}

CANONICAL_STUDY_META_KEYS = (
    "title",
    "authors",
    "year",
    "taskType",
    "modality",
    "cohortSummary",
    "reviewer",
)

REQUIRED_EXPORTS: dict[str, list[str]] = {
    "js/cns5Engine.js": [
        "CNS5_FAMILIES",
        "getDefaultCns5Input",
        "classifyCns5",
        "formatCns5Report",
    ],
    "js/ranoCalculators.js": [
        "computeSpdFromLesions",
        "calculateRano2",
        "calculateRanoBm",
        "calculateRanoResect",
        "formatClinicalSummary",
    ],
    "js/auditEngine.js": [
        "SEVERITY_WEIGHTS",
        "STATUS_POINTS",
        "CRITICAL_BLOCKER_SCORE_CAP",
        "scoreAudit",
        "escapeLatex",
        "escapeXml",
        "exportAuditMarkdown",
        "exportAuditLatex",
        "exportAuditBadgeSvg",
        "exportAuditJson",
        "validateImportedAuditJson",
    ],
    "js/visuals.js": [
        "renderRadarChart",
        "renderDecisionTrace",
        "renderResectGauge",
        "renderResponseGauge",
    ],
}

PURE_LOGIC_MODULES = [
    "js/cns5Engine.js",
    "js/ranoCalculators.js",
    "js/auditEngine.js",
]

SEVERITY_WEIGHTS = {"critical": 3, "major": 2, "recommended": 1}
STATUS_POINTS = {"pass": 1.0, "partial": 0.5, "fail": 0.0, "unanswered": 0.0}
CRITICAL_BLOCKER_SCORE_CAP = 45
VALID_AUDIT_STATUSES = {"pass", "partial", "fail", "na", "unanswered"}


# ---------------------------------------------------------------------------
# Static Parsing & Reference Helpers
# ---------------------------------------------------------------------------


def js_round(value: float) -> int:
    """Match JavaScript Math.round() for non-negative scores (half-up)."""
    return int(math.floor(value + 0.5))


def strip_js_comments(source: str) -> str:
    """Remove JS // and /* */ comments while preserving string/template literals."""
    out: list[str] = []
    i = 0
    n = len(source)
    state = "code"
    while i < n:
        ch = source[i]
        nxt = source[i + 1] if i + 1 < n else ""
        if state == "code":
            if ch == "/" and nxt == "/":
                state = "line_comment"
                i += 2
                continue
            if ch == "/" and nxt == "*":
                state = "block_comment"
                i += 2
                continue
            if ch in ("'", '"', "`"):
                state = ch
                out.append(ch)
                i += 1
                continue
            out.append(ch)
            i += 1
        elif state == "line_comment":
            if ch == "\n":
                state = "code"
                out.append("\n")
            i += 1
        elif state == "block_comment":
            if ch == "*" and nxt == "/":
                state = "code"
                out.append(" ")
                i += 2
            else:
                if ch == "\n":
                    out.append("\n")
                i += 1
        else:
            # Inside string or template literal
            out.append(ch)
            if ch == "\\" and i + 1 < n:
                out.append(nxt)
                i += 2
                continue
            if ch == state:
                state = "code"
            i += 1
    return "".join(out)


def extract_js_exports(source: str) -> set[str]:
    """Extract all named ES module exports from a JS source file."""
    cleaned = strip_js_comments(source)
    exports: set[str] = set()

    decl_pattern = re.compile(
        r"\bexport\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)"
    )
    for match in decl_pattern.finditer(cleaned):
        exports.add(match.group(1))

    braced_pattern = re.compile(r"\bexport\s*\{([^}]*)\}", re.MULTILINE | re.DOTALL)
    for match in braced_pattern.finditer(cleaned):
        body = match.group(1)
        for token in body.split(","):
            entry = token.strip()
            if not entry:
                continue
            if " as " in entry:
                _, alias = entry.split(" as ", 1)
                exports.add(alias.strip())
            else:
                exports.add(entry)

    return exports


def extract_js_local_imports(source: str) -> list[tuple[str, list[str]]]:
    """Extract named local relative imports: import { a, b as c } from './x.js'."""
    cleaned = strip_js_comments(source)
    pattern = re.compile(
        r"\bimport\s*\{([^}]*)\}\s*from\s*['\"](\.[^'\"]+)['\"]",
        re.MULTILINE | re.DOTALL,
    )
    results: list[tuple[str, list[str]]] = []
    for match in pattern.finditer(cleaned):
        raw_names = match.group(1)
        rel_path = match.group(2)
        names: list[str] = []
        for token in raw_names.split(","):
            entry = token.strip()
            if not entry:
                continue
            if " as " in entry:
                orig, _ = entry.split(" as ", 1)
                names.append(orig.strip())
            else:
                names.append(entry)
        results.append((rel_path, names))
    return results


class _OfflineHtmlAuditor(HTMLParser):
    """Inspect HTML tags for forbidden external runtime CDN resources."""

    EXTERNAL_ATTR_TAGS = {
        "script": "src",
        "link": "href",
        "img": "src",
        "iframe": "src",
        "embed": "src",
        "source": "src",
        "object": "data",
    }

    def __init__(self) -> None:
        super().__init__()
        self.external_resources: list[tuple[str, str, str]] = []
        self.text_chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag_l = tag.lower()
        target_attr = self.EXTERNAL_ATTR_TAGS.get(tag_l)
        if not target_attr:
            return
        for attr_name, attr_val in attrs:
            if attr_name.lower() == target_attr and attr_val:
                val = attr_val.strip()
                if val.startswith(("http://", "https://", "//")):
                    self.external_resources.append((tag_l, target_attr, val))

    def handle_data(self, data: str) -> None:
        self.text_chunks.append(data)


# ---------------------------------------------------------------------------
# Pure-Python Reference Oracles (Guaranteed Parity Without JS Runtime)
# ---------------------------------------------------------------------------


def escape_latex_reference(text: str) -> str:
    """Reference LaTeX escaper for all 10 special TeX characters."""
    mapping = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    return "".join(mapping.get(ch, ch) for ch in text)


def score_audit_reference(
    checklist_data: dict[str, Any], responses: dict[str, Any]
) -> dict[str, Any]:
    """Reference Python oracle matching ARCHITECTURE.md Section 5.4 exact math."""
    items = checklist_data["items"]
    domains = checklist_data["domains"]

    norm_resp: dict[str, dict[str, str]] = {}
    for item in items:
        raw = responses.get(item["id"])
        if isinstance(raw, dict):
            st = str(raw.get("status", "unanswered")).strip().lower()
            ev = str(raw.get("evidence", ""))
        elif isinstance(raw, str):
            st = raw.strip().lower()
            ev = ""
        else:
            st = "unanswered"
            ev = ""
        if st not in VALID_AUDIT_STATUSES:
            st = "unanswered"
        norm_resp[item["id"]] = {"status": st, "evidence": ev}

    max_weight = 0.0
    earned_weight = 0.0
    counts = {
        "total": len(items),
        "applicable": 0,
        "answered": 0,
        "pass": 0,
        "partial": 0,
        "fail": 0,
        "na": 0,
        "unanswered": 0,
    }
    critical_failed: list[dict[str, Any]] = []
    critical_partials: list[dict[str, Any]] = []
    critical_unanswered: list[dict[str, Any]] = []

    for item in items:
        st = norm_resp[item["id"]]["status"]
        counts[st] += 1
        if st == "na":
            continue
        counts["applicable"] += 1
        if st in ("pass", "partial", "fail"):
            counts["answered"] += 1
        w = SEVERITY_WEIGHTS[item["severity"]]
        max_weight += w
        earned_weight += w * STATUS_POINTS[st]
        if item["severity"] == "critical" and st == "fail":
            critical_failed.append(item)
        elif item["severity"] == "critical" and st == "partial":
            critical_partials.append(item)
        elif item["severity"] == "critical" and st == "unanswered":
            critical_unanswered.append(item)

    raw_score = js_round((earned_weight / max_weight) * 100.0) if max_weight > 0 else 0
    blocker_triggered = len(critical_failed) > 0
    cap_applied = blocker_triggered and raw_score > CRITICAL_BLOCKER_SCORE_CAP
    overall_score = (
        min(raw_score, CRITICAL_BLOCKER_SCORE_CAP) if blocker_triggered else raw_score
    )

    if counts["answered"] == 0:
        risk_level = "Not Assessed"
    elif blocker_triggered:
        risk_level = "Critical Blocker"
    elif len(critical_partials) > 0 or len(critical_unanswered) > 0 or overall_score < 60:
        risk_level = "High"
    elif overall_score < 80:
        risk_level = "Moderate"
    else:
        risk_level = "Low"

    domain_scores = []
    for dom in domains:
        d_items = [it for it in items if it["domainId"] == dom["id"]]
        d_max = 0.0
        d_earned = 0.0
        d_crit_fail = 0
        for it in d_items:
            st = norm_resp[it["id"]]["status"]
            if st == "na":
                continue
            w = SEVERITY_WEIGHTS[it["severity"]]
            d_max += w
            d_earned += w * STATUS_POINTS[st]
            if it["severity"] == "critical" and st == "fail":
                d_crit_fail += 1
        d_score = js_round((d_earned / d_max) * 100.0) if d_max > 0 else 0
        domain_scores.append(
            {
                "domainId": dom["id"],
                "score": d_score,
                "criticalFailedCount": d_crit_fail,
            }
        )

    return {
        "overallScore": overall_score,
        "rawOverallScore": raw_score,
        "capApplied": cap_applied,
        "blockerTriggered": blocker_triggered,
        "leakageRiskLevel": risk_level,
        "counts": counts,
        "criticalBlockersFailedCount": len(critical_failed),
        "criticalBlockersFailedIds": [it["id"] for it in critical_failed],
        "criticalPartialsCount": len(critical_partials),
        "criticalUnansweredCount": len(critical_unanswered),
        "criticalUnansweredIds": [it["id"] for it in critical_unanswered],
        "domainScores": domain_scores,
    }


def classify_cns5_reference(inp: dict[str, Any]) -> dict[str, Any]:
    """Reference Python oracle for WHO CNS5 golden rules (Section 3.3 & 8.1)."""
    fam = inp.get("family", "adult_diffuse_glioma")
    if fam == "adult_diffuse_glioma":
        idh = inp.get("idh_status", "not_tested")
        codel = inp.get("codeletion_1p19q", "not_tested")
        atrx = inp.get("atrx_status", "not_tested")
        cdkn2ab = inp.get("cdkn2ab_homdel", "not_tested")
        tert = inp.get("tert_promoter", "not_tested")
        egfr = inp.get("egfr_amplification", "not_tested")
        c710 = inp.get("chr7_gain_chr10_loss", "not_tested")
        nec = bool(inp.get("necrosis", False))
        mvp = bool(inp.get("mvp", False))
        mit = bool(inp.get("mitotic_activity_high", False))
        if idh == "not_tested":
            if nec or mvp:
                return {"diagnosis": "Glioblastoma, NOS", "cnsWhoGrade": 4, "molecularUpgradeTriggered": False, "nosNecStatus": "NOS"}
            if mit:
                return {"diagnosis": "Diffuse glioma, high-grade, NOS", "cnsWhoGrade": 3, "molecularUpgradeTriggered": False, "nosNecStatus": "NOS"}
            return {"diagnosis": "Diffuse glioma, NOS", "cnsWhoGrade": 2, "molecularUpgradeTriggered": False, "nosNecStatus": "NOS"}
        if idh == "mutant":
            if codel == "codeleted":
                g = 3 if (nec or mvp or mit) else 2
                return {"diagnosis": "Oligodendroglioma, IDH-mutant and 1p/19q-codeleted", "cnsWhoGrade": g, "molecularUpgradeTriggered": False, "nosNecStatus": "none"}
            if codel == "intact" or (codel == "not_tested" and atrx == "lost"):
                if nec or mvp or cdkn2ab == "present":
                    g = 4
                elif mit:
                    g = 3
                else:
                    g = 2
                upg = (cdkn2ab == "present") and not (nec or mvp)
                return {"diagnosis": "Astrocytoma, IDH-mutant", "cnsWhoGrade": g, "molecularUpgradeTriggered": upg, "nosNecStatus": "none"}
            g = 4 if (nec or mvp or cdkn2ab == "present") else (3 if mit else 2)
            return {"diagnosis": "Diffuse glioma, IDH-mutant, NOS", "cnsWhoGrade": g, "molecularUpgradeTriggered": (cdkn2ab == "present" and not (nec or mvp)), "nosNecStatus": "NOS"}
        # IDH-wildtype
        mol_gbm = (tert == "mutant") or (egfr == "present") or (c710 == "present")
        if nec or mvp or mol_gbm:
            return {"diagnosis": "Glioblastoma, IDH-wildtype", "cnsWhoGrade": 4, "molecularUpgradeTriggered": (not (nec or mvp) and mol_gbm), "nosNecStatus": "none"}
        if tert == "wildtype" and egfr == "absent" and c710 == "absent":
            return {"diagnosis": "Diffuse astrocytic glioma, IDH-wildtype, NEC", "cnsWhoGrade": "Not assigned", "molecularUpgradeTriggered": False, "nosNecStatus": "NEC"}
        return {"diagnosis": "Diffuse astrocytic glioma, IDH-wildtype, NOS", "cnsWhoGrade": "Not assigned", "molecularUpgradeTriggered": False, "nosNecStatus": "NOS"}
    if fam == "ependymal_tumor":
        if inp.get("histology_variant") == "myxopapillary":
            return {"diagnosis": "Myxopapillary ependymoma", "cnsWhoGrade": 2, "molecularUpgradeTriggered": False, "nosNecStatus": "none"}
    if fam == "meningioma":
        mit = inp.get("mitoses_per_10hpf", 0) or 0
        anap = bool(inp.get("frank_anaplasia", False))
        tert = inp.get("tert_promoter", "not_tested")
        cdkn2ab = inp.get("cdkn2ab_homdel", "not_tested")
        hist_g3 = mit >= 20 or anap
        mol_g3 = tert == "mutant" or cdkn2ab == "present"
        if hist_g3 or mol_g3:
            return {"diagnosis": "Meningioma", "cnsWhoGrade": 3, "molecularUpgradeTriggered": (not hist_g3 and mol_g3), "nosNecStatus": "none"}
        if mit >= 4 or inp.get("brain_invasion") or (inp.get("atypical_features_count", 0) >= 3) or inp.get("subtype") in ("chordoid", "clear_cell"):
            return {"diagnosis": "Meningioma", "cnsWhoGrade": 2, "molecularUpgradeTriggered": False, "nosNecStatus": "none"}
        return {"diagnosis": "Meningioma", "cnsWhoGrade": 1, "molecularUpgradeTriggered": False, "nosNecStatus": "none"}
    if fam == "medulloblastoma":
        grp = inp.get("molecular_group", "not_tested")
        tp53 = inp.get("tp53_status", "not_tested")
        if grp == "shh" and tp53 == "mutant":
            return {"diagnosis": "Medulloblastoma, SHH-activated and TP53-mutant", "cnsWhoGrade": 4, "molecularUpgradeTriggered": False, "nosNecStatus": "none"}
    raise ValueError(f"Unhandled reference CNS5 test case: {inp}")


def calculate_rano2_reference(p: dict[str, Any]) -> str:
    """Reference Python oracle for RANO 2.0 classification (Wen et al., JCO 2023)."""
    eps = 1e-9
    mode = p.get("tumorMode", "enhancing_hgg")
    mtype = p.get("measurementType", "2d_spd")
    base = float(p["baselineValue"])
    curr = float(p["currentValue"])
    nadir = min(base, float(p["nadirValue"])) if p.get("nadirValue") is not None else base
    steroids = p.get("corticosteroids", "none_or_physiologic")
    clin = p.get("clinicalStatus", "stable_or_improved")
    pr_pct = -65.0 if mtype == "3d_volume" else -50.0
    mr_pct = (-40.0 if mtype == "3d_volume" else -25.0) if mode == "non_enhancing_lgg" else None
    pd_pct = 40.0 if mtype == "3d_volume" else 25.0

    pct_base = ((curr - base) / base) * 100.0 if base > eps else None
    pct_nadir = ((curr - nadir) / nadir) * 100.0 if nadir > eps else (math.inf if curr > eps else 0.0)
    rad_pd = (
        (nadir > eps and pct_nadir >= pd_pct - eps)
        or (nadir <= eps and curr > eps)
        or bool(p.get("newMeasurableLesion"))
        or bool(p.get("nonMeasurableProgression"))
    )
    if clin == "worse":
        return "PD"
    if rad_pd:
        if p.get("within12WeeksPostRt") and not p.get("outsideRtField"):
            return "Prelim-PD"
        return "PD"
    if base <= eps:
        return "SD" if p.get("nonMeasurablePresent") else "Non-PD"
    rad_cr = curr <= eps and not p.get("nonMeasurablePresent") and not p.get("newMeasurableLesion")
    rad_pr = pct_base is not None and pct_base <= pr_pct + eps
    rad_mr = (
        mr_pct is not None
        and pct_base is not None
        and pct_base <= mr_pct + eps
        and pct_base > pr_pct + eps
    )
    if rad_cr:
        if steroids == "none_or_physiologic":
            return "CR"
        return "PR" if steroids == "stable_or_decreased" else "SD"
    if rad_pr:
        return "SD" if steroids == "increased" else "PR"
    if rad_mr:
        return "SD" if steroids == "increased" else "MR"
    return "SD"


def calculate_rano_bm_reference(p: dict[str, Any]) -> tuple[str, bool]:
    """Reference Python oracle for RANO-BM (Lin et al., Lancet Oncol 2015)."""
    eps = 1e-9
    base = float(p["baselineSldMm"])
    curr = float(p["currentSldMm"])
    nadir = min(base, float(p["nadirSldMm"])) if p.get("nadirSldMm") is not None else base
    steroids = p.get("corticosteroids", "none_or_physiologic")
    neuro = p.get("neurologicStatus", "stable_or_improved")
    non_cns = p.get("nonCnsStatus", "not_applicable")

    abs_chg = curr - nadir
    pct_nadir = ((curr - nadir) / nadir) * 100.0 if nadir > eps else (math.inf if curr > eps else 0.0)
    pct_base = ((curr - base) / base) * 100.0 if base > eps else None

    is_pd = (
        (nadir > eps and pct_nadir >= 20.0 - eps and abs_chg >= 5.0 - eps)
        or (nadir <= eps and curr > eps)
        or bool(p.get("newCnsLesion"))
        or bool(p.get("nonTargetCnsProgression"))
        or neuro == "worse"
    )
    if is_pd:
        cns = "PD"
    elif base <= eps:
        cns = "SD" if p.get("nonTargetCnsPresent") else "Non-PD"
    elif curr <= eps and not p.get("nonTargetCnsPresent") and not p.get("newCnsLesion"):
        if steroids == "none_or_physiologic":
            cns = "CR"
        elif steroids == "stable_or_decreased":
            cns = "PR"
        else:
            cns = "SD"
    elif pct_base is not None and pct_base <= -30.0 + eps:
        cns = "SD" if steroids == "increased" else "PR"
    else:
        cns = "SD"

    controlled = {"CR", "PR", "SD"}
    discordance = (cns == "PD" and non_cns in controlled) or (non_cns == "PD" and cns in controlled)
    return cns, discordance


def calculate_rano_resect_reference(p: dict[str, Any]) -> str:
    """Reference Python oracle for RANO-Resect (Karschnia et al., Neuro-Oncology 2023)."""
    eps = 1e-9
    pre_ce = float(p["preOpCeVolCm3"])
    post_ce = float(p["postOpCeVolCm3"])
    post_nce = p.get("postOpNonCeVolCm3")
    if pre_ce <= eps:
        return "N/A"
    ce_red = ((pre_ce - post_ce) / pre_ce) * 100.0
    if (
        p.get("isBiopsyProcedure")
        or ce_red <= eps
        or (post_ce <= 5.0 + eps and ce_red < 10.0 - eps)
    ):
        return "Class 4"
    if post_ce <= eps:
        if post_nce is not None and float(post_nce) <= 5.0 + eps:
            return "Class 1"
        return "Class 2A"
    if post_ce <= 1.0 + eps:
        return "Class 2B"
    if post_ce <= 5.0 + eps:
        return "Class 3A"
    return "Class 3B"


# ---------------------------------------------------------------------------
# Live JS Engine Runner (Node.js OR Headless Browser, Graceful Fallback)
# ---------------------------------------------------------------------------


def _build_js_assertions_body() -> str:
    """Build shared ES module verification body used by both Node and browser harnesses."""
    return r"""
const failures = [];
const passed = [];
const artifacts = {};

function assert(cond, name, detail = "") {
  if (cond) {
    passed.push(name);
  } else {
    failures.push(`${name}${detail ? ": " + detail : ""}`);
  }
}

function assertEq(actual, expected, name) {
  if (actual === expected) {
    passed.push(name);
  } else {
    failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// =========================================================================
// 1. RANO Calculators (js/ranoCalculators.js)
// =========================================================================
if (modules.rano) {
  const {
    computeSpdFromLesions,
    calculateRano2,
    calculateRanoBm,
    calculateRanoResect,
    formatClinicalSummary
  } = modules.rano;

  // 1A. computeSpdFromLesions
  const spdOk = computeSpdFromLesions([
    { longMm: 20, perpMm: 15 },
    { longMm: 12, perpMm: 10 }
  ]);
  assertEq(spdOk.valid, true, "SPD valid");
  assertEq(spdOk.spdMm2, 420, "SPD sum 20*15 + 12*10 = 420");
  assertEq(spdOk.measurableCount, 2, "SPD measurable count = 2");

  const spdSmall = computeSpdFromLesions([{ longMm: 8, perpMm: 12 }]);
  assertEq(spdSmall.measurableCount, 0, "SPD <10mm lesion not counted measurable");
  assert(spdSmall.warnings.length >= 1, "SPD <10mm emits warning");

  const spdCap = computeSpdFromLesions([
    { longMm: 10, perpMm: 10 },
    { longMm: 10, perpMm: 10 },
    { longMm: 10, perpMm: 10 },
    { longMm: 10, perpMm: 10 },
    { longMm: 10, perpMm: 10 },
    { longMm: 20, perpMm: 20 }
  ]);
  assertEq(spdCap.spdMm2, 500, "SPD caps at first 5 lesions");
  assert(spdCap.warnings.length >= 1, "SPD >5 lesions emits warning");

  const spdNeg = computeSpdFromLesions([{ longMm: -5, perpMm: 10 }]);
  assertEq(spdNeg.valid, false, "SPD rejects negative diameter");

  const spdSparse = computeSpdFromLesions([
    { longMm: null, perpMm: 10 },
    { longMm: 20, perpMm: 15 }
  ]);
  assertEq(spdSparse.valid, false, "SPD invalid when first row blank");
  assertEq(spdSparse.lesionProducts.length, 1, "SPD skips blank first row in lesionProducts");
  assertEq(spdSparse.lesionProducts[0].index, 2, "SPD preserves original 1-based row index=2 for second row");

  // 1B. RANO 2.0 Golden Vector 1: <=12w post-RT monotonicity
  const r2MonoPd = calculateRano2({
    tumorMode: "enhancing_hgg",
    measurementType: "2d_spd",
    baselineValue: 400,
    nadirValue: 400,
    currentValue: 600,
    corticosteroids: "stable_or_decreased",
    clinicalStatus: "worse",
    within12WeeksPostRt: true
  });
  assertEq(r2MonoPd.valid, true, "RANO 2.0 monotonicity PD valid");
  assertEq(r2MonoPd.responseCode, "PD", "RANO 2.0 <=12w clinical deterioration MUST be definite PD");
  assertEq(r2MonoPd.preliminaryPdRuleApplied, false, "RANO 2.0 clinical PD does not set prelim flag");

  const r2Prelim = calculateRano2({
    tumorMode: "enhancing_hgg",
    measurementType: "2d_spd",
    baselineValue: 400,
    nadirValue: 400,
    currentValue: 600,
    corticosteroids: "stable_or_decreased",
    clinicalStatus: "stable_or_improved",
    within12WeeksPostRt: true
  });
  assertEq(r2Prelim.responseCode, "Prelim-PD", "RANO 2.0 <=12w radiographic-only PD -> Prelim-PD");
  assertEq(r2Prelim.preliminaryPdRuleApplied, true, "RANO 2.0 Prelim-PD flag true");

  const r2OutField = calculateRano2({
    tumorMode: "enhancing_hgg",
    measurementType: "2d_spd",
    baselineValue: 400,
    nadirValue: 400,
    currentValue: 600,
    corticosteroids: "stable_or_decreased",
    clinicalStatus: "stable_or_improved",
    within12WeeksPostRt: true,
    outsideRtField: true
  });
  assertEq(r2OutField.responseCode, "PD", "RANO 2.0 <=12w outside RT field -> definite PD");

  // 1C. RANO 2.0 Golden Vector 2: Baseline=0 Guard for CR
  const r2BaseZero = calculateRano2({
    tumorMode: "enhancing_hgg",
    measurementType: "2d_spd",
    baselineValue: 0,
    nadirValue: 0,
    currentValue: 0,
    nonMeasurablePresent: false,
    corticosteroids: "none_or_physiologic",
    clinicalStatus: "stable_or_improved"
  });
  assertEq(r2BaseZero.responseCode, "Non-PD", "RANO 2.0 baseline=0 no non-measurable -> Non-PD (never CR)");
  assertEq(r2BaseZero.baselineGuardTriggered, true, "RANO 2.0 baselineGuardTriggered=true");

  const r2BaseZeroEps = calculateRano2({
    tumorMode: "enhancing_hgg",
    measurementType: "2d_spd",
    baselineValue: 0,
    nadirValue: 0,
    currentValue: 1e-12,
    nonMeasurablePresent: false,
    corticosteroids: "none_or_physiologic",
    clinicalStatus: "stable_or_improved"
  });
  assertEq(r2BaseZeroEps.responseCode, "Non-PD", "RANO 2.0 baseline=0 current<=EPS does not spuriously trigger PD");

  const r2BaseZeroNm = calculateRano2({
    tumorMode: "enhancing_hgg",
    measurementType: "2d_spd",
    baselineValue: 0,
    nadirValue: 0,
    currentValue: 0,
    nonMeasurablePresent: true,
    corticosteroids: "none_or_physiologic",
    clinicalStatus: "stable_or_improved"
  });
  assertEq(r2BaseZeroNm.responseCode, "SD", "RANO 2.0 baseline=0 with non-measurable -> SD");
  assertEq(r2BaseZeroNm.baselineGuardTriggered, true, "RANO 2.0 baseline=0 NM sets guard");

  // 1D. RANO 2.0 CR & Steroid Downgrades
  const r2Cr = calculateRano2({
    tumorMode: "enhancing_hgg",
    measurementType: "2d_spd",
    baselineValue: 400,
    nadirValue: 400,
    currentValue: 0,
    nonMeasurablePresent: false,
    corticosteroids: "none_or_physiologic",
    clinicalStatus: "stable_or_improved",
    sustained4Weeks: true
  });
  assertEq(r2Cr.responseCode, "CR", "RANO 2.0 true CR off steroids");
  assertEq(r2Cr.steroidDowngradeApplied, false, "RANO 2.0 true CR no steroid downgrade");

  const r2CrToPr = calculateRano2({
    tumorMode: "enhancing_hgg",
    measurementType: "2d_spd",
    baselineValue: 400,
    nadirValue: 400,
    currentValue: 0,
    nonMeasurablePresent: false,
    corticosteroids: "stable_or_decreased",
    clinicalStatus: "stable_or_improved"
  });
  assertEq(r2CrToPr.responseCode, "PR", "RANO 2.0 radiographic CR on stable/decreased steroids -> PR");
  assertEq(r2CrToPr.steroidDowngradeApplied, true, "RANO 2.0 CR->PR steroidDowngradeApplied=true");

  const r2CrToSd = calculateRano2({
    tumorMode: "enhancing_hgg",
    measurementType: "2d_spd",
    baselineValue: 400,
    nadirValue: 400,
    currentValue: 0,
    nonMeasurablePresent: false,
    corticosteroids: "increased",
    clinicalStatus: "stable_or_improved"
  });
  assertEq(r2CrToSd.responseCode, "SD", "RANO 2.0 radiographic CR on increased steroids -> SD");
  assertEq(r2CrToSd.steroidDowngradeApplied, true, "RANO 2.0 CR->SD steroidDowngradeApplied=true");

  // 1E. RANO 2.0 Golden Vector 3: LGG 3D MR vs HGG SD + float boundaries + rebound PD
  const r2LggMr3d = calculateRano2({
    tumorMode: "non_enhancing_lgg",
    measurementType: "3d_volume",
    baselineValue: 20,
    nadirValue: 20,
    currentValue: 10,
    corticosteroids: "stable_or_decreased",
    clinicalStatus: "stable_or_improved"
  });
  assertEq(r2LggMr3d.responseCode, "MR", "RANO 2.0 LGG 3D -50% -> MR");

  const r2HggSame3d = calculateRano2({
    tumorMode: "enhancing_hgg",
    measurementType: "3d_volume",
    baselineValue: 20,
    nadirValue: 20,
    currentValue: 10,
    corticosteroids: "stable_or_decreased",
    clinicalStatus: "stable_or_improved"
  });
  assertEq(r2HggSame3d.responseCode, "SD", "RANO 2.0 HGG 3D -50% -> SD (no MR in HGG)");

  const r2LggMr2d = calculateRano2({
    tumorMode: "non_enhancing_lgg",
    measurementType: "2d_spd",
    baselineValue: 400,
    nadirValue: 400,
    currentValue: 260,
    corticosteroids: "none_or_physiologic",
    clinicalStatus: "stable_or_improved"
  });
  assertEq(r2LggMr2d.responseCode, "MR", "RANO 2.0 LGG 2D -35% -> MR");

  const r2ReboundPd = calculateRano2({
    tumorMode: "enhancing_hgg",
    measurementType: "2d_spd",
    baselineValue: 400,
    nadirValue: 200,
    currentValue: 250,
    corticosteroids: "none_or_physiologic",
    clinicalStatus: "stable_or_improved"
  });
  assertEq(r2ReboundPd.responseCode, "PD", "RANO 2.0 rebound +25% from nadir overrides -37.5% from baseline");

  const r2FloatBoundary3d = calculateRano2({
    tumorMode: "enhancing_hgg",
    measurementType: "3d_volume",
    baselineValue: 2.0,
    nadirValue: 2.0,
    currentValue: 2.8,
    corticosteroids: "none_or_physiologic",
    clinicalStatus: "stable_or_improved"
  });
  assertEq(r2FloatBoundary3d.responseCode, "PD", "RANO 2.0 3D exact +40% (2.0 -> 2.8 IEEE float) -> PD");

  const r2AliasCheck = calculateRano2({
    tumorTrack: "non_enhancing_lgg",
    metricMode: "spd_2d",
    baselineValue: 100,
    nadirValue: 100,
    currentValue: 75,
    steroids: "none",
    clinicalStatus: "stable_or_improved"
  });
  assertEq(r2AliasCheck.responseCode, "MR", "RANO 2.0 prompt-alias inputs work cleanly");

  const r2Invalid = calculateRano2({ baselineValue: -10, currentValue: 50 });
  assertEq(r2Invalid.valid, false, "RANO 2.0 rejects negative baseline");
  assertEq(r2Invalid.responseCode, "INVALID", "RANO 2.0 invalid returns INVALID");

  // 1F. RANO-BM Golden Vectors 4 & 5: >=20% AND >=5mm dual threshold + Bicompartmental discordance
  const bmNotPd = calculateRanoBm({
    baselineSldMm: 15,
    nadirSldMm: 15,
    currentSldMm: 19,
    corticosteroids: "none_or_physiologic",
    neurologicStatus: "stable_or_improved",
    newCnsLesion: false,
    nonTargetCnsProgression: false
  });
  assertEq(bmNotPd.cnsResponseCode, "SD", "RANO-BM 15->19 (+26.7%, +4mm <5mm) -> SD (NOT PD)");
  assertEq(bmNotPd.pdCriteriaMet.pctGte20, true, "RANO-BM 15->19 pctGte20=true");
  assertEq(bmNotPd.pdCriteriaMet.absGte5mm, false, "RANO-BM 15->19 absGte5mm=false");

  const bmPd = calculateRanoBm({
    baselineSldMm: 15,
    nadirSldMm: 15,
    currentSldMm: 20,
    corticosteroids: "none_or_physiologic",
    neurologicStatus: "stable_or_improved",
    newCnsLesion: false,
    nonTargetCnsProgression: false
  });
  assertEq(bmPd.cnsResponseCode, "PD", "RANO-BM 15->20 (+33.3%, +5mm >=5mm) -> PD");
  assertEq(bmPd.pdCriteriaMet.pctGte20, true, "RANO-BM 15->20 pctGte20=true");
  assertEq(bmPd.pdCriteriaMet.absGte5mm, true, "RANO-BM 15->20 absGte5mm=true");

  const bmAbsOnly = calculateRanoBm({
    baselineSldMm: 50,
    nadirSldMm: 50,
    currentSldMm: 56,
    corticosteroids: "none_or_physiologic",
    neurologicStatus: "stable_or_improved"
  });
  assertEq(bmAbsOnly.cnsResponseCode, "SD", "RANO-BM 50->56 (+12%, +6mm) -> SD (requires >=20% too)");

  const bmDiscord = calculateRanoBm({
    baselineSldMm: 30,
    nadirSldMm: 30,
    currentSldMm: 18,
    corticosteroids: "stable_or_decreased",
    neurologicStatus: "stable_or_improved",
    nonCnsStatus: "PD"
  });
  assertEq(bmDiscord.cnsResponseCode, "PR", "RANO-BM -40% CNS -> PR");
  assertEq(bmDiscord.nonCnsResponseCode, "PD", "RANO-BM non-CNS preserved as PD");
  assertEq(bmDiscord.compartmentDiscordance, true, "RANO-BM CNS PR + Non-CNS PD -> discordance=true");

  const bmCrDowngrade = calculateRanoBm({
    baselineSldMm: 30,
    nadirSldMm: 30,
    currentSldMm: 0,
    corticosteroids: "stable_or_decreased",
    neurologicStatus: "stable_or_improved",
    nonTargetCnsPresent: false
  });
  assertEq(bmCrDowngrade.cnsResponseCode, "PR", "RANO-BM radiographic CR on steroids -> PR");
  assertEq(bmCrDowngrade.steroidDowngradeApplied, true, "RANO-BM CR steroid downgrade flagged");

  const bmLesions = calculateRanoBm({
    targetLesions: [
      { baselineMm: 12, currentMm: 12 },
      { baselineMm: 8, currentMm: 8 },
      { baselineMm: 15, currentMm: 15 },
      { baselineMm: 10, currentMm: 10 },
      { baselineMm: 11, currentMm: 11 },
      { baselineMm: 20, currentMm: 20 }
    ],
    corticosteroids: "none_or_physiologic",
    neurologicStatus: "stable_or_improved",
    priorSrsWithin6Months: true
  });
  assertEq(bmLesions.targetLesionCount, 5, "RANO-BM caps target lesions at 5");
  assertEq(bmLesions.baselineSldMm, 56, "RANO-BM sums first 5 target lesions (12+8+15+10+11=56)");
  assert(bmLesions.warnings.length >= 3, "RANO-BM emits >5 cap, <10mm measurability, and prior SRS warnings");

  const bmBaseEpsGuard = calculateRanoBm({
    baselineSldMm: 1e-12,
    nadirSldMm: 1e-12,
    currentSldMm: 1e-12,
    corticosteroids: "none_or_physiologic",
    neurologicStatus: "stable_or_improved"
  });
  assertEq(bmBaseEpsGuard.cnsResponseCode, "Non-PD", "RANO-BM sub-epsilon baseline<=EPS triggers Non-PD guard (never CR)");
  assertEq(bmBaseEpsGuard.baselineGuardTriggered, true, "RANO-BM sub-epsilon baselineGuardTriggered=true");

  // 1G. RANO-Resect Golden Vectors 6, 7, 8 + All Class Boundaries
  const resNa = calculateRanoResect({ preOpCeVolCm3: 0, postOpCeVolCm3: 0 });
  assertEq(resNa.resectClass, "N/A", "RANO-Resect preOpCe=0 -> N/A");
  assertEq(resNa.naGuardTriggered, true, "RANO-Resect naGuardTriggered=true");

  const resBiopsySmall = calculateRanoResect({ preOpCeVolCm3: 3.0, postOpCeVolCm3: 2.8 });
  assertEq(resBiopsySmall.resectClass, "Class 4", "RANO-Resect 3.0->2.8 (6.7% <10%, <=5cm3 guard) -> Class 4 (NOT Class 3A)");

  const resLargeDebulk = calculateRanoResect({ preOpCeVolCm3: 100, postOpCeVolCm3: 92, isBiopsyProcedure: false });
  assertEq(resLargeDebulk.resectClass, "Class 3B", "RANO-Resect 100->92 (8% partial debulking, not biopsy) -> Class 3B");
  assert(resLargeDebulk.warnings.length >= 1, "RANO-Resect 100->92 emits <10% biopsy-check warning");

  const resLargeBiopsyFlag = calculateRanoResect({ preOpCeVolCm3: 100, postOpCeVolCm3: 92, isBiopsyProcedure: true });
  assertEq(resLargeBiopsyFlag.resectClass, "Class 4", "RANO-Resect 100->92 with isBiopsyProcedure=true -> Class 4");

  const resNoReduction = calculateRanoResect({ preOpCeVolCm3: 100, postOpCeVolCm3: 100, isBiopsyProcedure: false });
  assertEq(resNoReduction.resectClass, "Class 4", "RANO-Resect 100->100 (0% no reduction) -> Class 4");

  const resC1 = calculateRanoResect({ preOpCeVolCm3: 25, postOpCeVolCm3: 0, postOpNonCeVolCm3: 4.2 });
  assertEq(resC1.resectClass, "Class 1", "RANO-Resect 0 CE & 4.2 non-CE -> Class 1");

  const resC1Bound = calculateRanoResect({ preOpCeVolCm3: 25, postOpCeVolCm3: 0, postOpNonCeVolCm3: 5.0 });
  assertEq(resC1Bound.resectClass, "Class 1", "RANO-Resect 0 CE & 5.0 non-CE boundary -> Class 1");

  const resC2aHigh = calculateRanoResect({ preOpCeVolCm3: 25, postOpCeVolCm3: 0, postOpNonCeVolCm3: 8.0 });
  assertEq(resC2aHigh.resectClass, "Class 2A", "RANO-Resect 0 CE & 8.0 non-CE -> Class 2A");

  const resC2aNull = calculateRanoResect({ preOpCeVolCm3: 25, postOpCeVolCm3: 0, postOpNonCeVolCm3: null });
  assertEq(resC2aNull.resectClass, "Class 2A", "RANO-Resect 0 CE & null non-CE -> Class 2A");

  const resC2b = calculateRanoResect({ preOpCeVolCm3: 25, postOpCeVolCm3: 1.0 });
  assertEq(resC2b.resectClass, "Class 2B", "RANO-Resect 1.0 cm3 residual CE -> Class 2B");

  const resC2bTiny = calculateRanoResect({ preOpCeVolCm3: 25, postOpCeVolCm3: 0.04 });
  assertEq(resC2bTiny.resectClass, "Class 2B", "RANO-Resect 0.04 cm3 residual CE -> Class 2B");
  assertEq(resC2bTiny.postOpCeVolCm3, 0.04, "RANO-Resect preserves small non-zero volume 0.04");

  const resC3a = calculateRanoResect({ preOpCeVolCm3: 25, postOpCeVolCm3: 5.0 });
  assertEq(resC3a.resectClass, "Class 3A", "RANO-Resect 5.0 cm3 residual CE -> Class 3A");

  const resC3b = calculateRanoResect({ preOpCeVolCm3: 25, postOpCeVolCm3: 5.1 });
  assertEq(resC3b.resectClass, "Class 3B", "RANO-Resect 5.1 cm3 residual CE -> Class 3B");

  const resTiming = calculateRanoResect({
    preOpCeVolCm3: 25,
    postOpCeVolCm3: 0.5,
    postOpMriTimingHours: 96
  });
  assert(resTiming.warnings.length >= 1, "RANO-Resect >72h post-op MRI emits warning");

  // 1H. formatClinicalSummary
  const noteR2 = formatClinicalSummary("rano2", r2Prelim, {
    baselineValue: 400,
    currentValue: 600,
    corticosteroids: "stable_or_decreased",
    clinicalStatus: "stable_or_improved",
    within12WeeksPostRt: true
  });
  assert(noteR2.includes("Research & Educational Use Only"), "RANO 2.0 summary stamped educational");
  assert(noteR2.includes("Prelim-PD"), "RANO 2.0 summary includes Prelim-PD");

  const noteBm = formatClinicalSummary("rano_bm", bmDiscord, {
    corticosteroids: "stable_or_decreased",
    neurologicStatus: "stable_or_improved"
  });
  assert(noteBm.includes("Research & Educational Use Only"), "RANO-BM summary stamped educational");
  assert(noteBm.includes("Compartmental Discordance"), "RANO-BM summary includes discordance");

  const noteRes = formatClinicalSummary("rano_resect", resC1, {});
  assert(noteRes.includes("Research & Educational Use Only"), "RANO-Resect summary stamped educational");
  assert(noteRes.includes("Class 1"), "RANO-Resect summary includes Class 1");
}

// =========================================================================
// 2. WHO CNS5 Engine (js/cns5Engine.js)
// =========================================================================
if (modules.cns5 && data.cns5Rules) {
  const { classifyCns5, formatCns5Report } = modules.cns5;

  // Golden Vector 1: Molecular GBM
  const v1 = classifyCns5({
    family: "adult_diffuse_glioma",
    idh_status: "wildtype",
    tert_promoter: "mutant",
    necrosis: false,
    mvp: false
  }, data.cns5Rules);
  assertEq(v1.diagnosis, "Glioblastoma, IDH-wildtype", "CNS5 GV1 diagnosis");
  assertEq(v1.cnsWhoGrade, 4, "CNS5 GV1 Arabic grade 4");
  assertEq(v1.molecularUpgradeTriggered, true, "CNS5 GV1 molecularUpgradeTriggered=true");
  assertEq(v1.nosNecStatus, "none", "CNS5 GV1 nosNecStatus=none");

  // Golden Vector 2: IDH-mut Astrocytoma CDKN2A/B Grade 4 upgrade
  const v2 = classifyCns5({
    family: "adult_diffuse_glioma",
    idh_status: "mutant",
    codeletion_1p19q: "intact",
    cdkn2ab_homdel: "present",
    necrosis: false,
    mvp: false
  }, data.cns5Rules);
  assertEq(v2.diagnosis, "Astrocytoma, IDH-mutant", "CNS5 GV2 diagnosis");
  assertEq(v2.cnsWhoGrade, 4, "CNS5 GV2 Arabic grade 4");
  assertEq(v2.molecularUpgradeTriggered, true, "CNS5 GV2 CDKN2A/B upgrade=true");

  // Golden Vector 3: Oligodendroglioma Grade 2 + Vorasidenib pearl
  const v3 = classifyCns5({
    family: "adult_diffuse_glioma",
    idh_status: "mutant",
    codeletion_1p19q: "codeleted",
    necrosis: false,
    mvp: false,
    mitotic_activity_high: false,
    cdkn2ab_homdel: "absent"
  }, data.cns5Rules);
  assertEq(v3.diagnosis, "Oligodendroglioma, IDH-mutant and 1p/19q-codeleted", "CNS5 GV3 diagnosis");
  assertEq(v3.cnsWhoGrade, 2, "CNS5 GV3 grade 2");
  assertEq(v3.molecularUpgradeTriggered, false, "CNS5 GV3 upgrade=false");
  assert(
    (v3.clinicalPearls || []).some((p) => String(p).toLowerCase().includes("vorasidenib")),
    "CNS5 GV3 includes vorasidenib pearl"
  );

  // Golden Vector 4: NOS
  const v4 = classifyCns5({
    family: "adult_diffuse_glioma",
    idh_status: "not_tested",
    necrosis: true
  }, data.cns5Rules);
  assertEq(v4.diagnosis, "Glioblastoma, NOS", "CNS5 GV4 Glioblastoma, NOS");
  assertEq(v4.cnsWhoGrade, 4, "CNS5 GV4 grade 4");
  assertEq(v4.nosNecStatus, "NOS", "CNS5 GV4 nosNecStatus=NOS");

  // Golden Vector 5: NEC
  const v5 = classifyCns5({
    family: "adult_diffuse_glioma",
    idh_status: "wildtype",
    necrosis: false,
    mvp: false,
    tert_promoter: "wildtype",
    egfr_amplification: "absent",
    chr7_gain_chr10_loss: "absent"
  }, data.cns5Rules);
  assertEq(v5.diagnosis, "Diffuse astrocytic glioma, IDH-wildtype, NEC", "CNS5 GV5 NEC diagnosis");
  assertEq(v5.cnsWhoGrade, "Not assigned", "CNS5 GV5 grade Not assigned");
  assertEq(v5.nosNecStatus, "NEC", "CNS5 GV5 nosNecStatus=NEC");

  // Golden Vector 6: Myxopapillary Ependymoma Grade 2
  const v6 = classifyCns5({
    family: "ependymal_tumor",
    compartment: "spinal",
    histology_variant: "myxopapillary"
  }, data.cns5Rules);
  assertEq(v6.diagnosis, "Myxopapillary ependymoma", "CNS5 GV6 Myxopapillary ependymoma");
  assertEq(v6.cnsWhoGrade, 2, "CNS5 GV6 CNS5 grade 2");

  // Golden Vector 7: Meningioma Molecular Grade 3 upgrade
  const v7 = classifyCns5({
    family: "meningioma",
    mitoses_per_10hpf: 1,
    brain_invasion: false,
    atypical_features_count: 0,
    frank_anaplasia: false,
    tert_promoter: "mutant"
  }, data.cns5Rules);
  assert(String(v7.diagnosis).startsWith("Meningioma"), "CNS5 GV7 Meningioma diagnosis");
  assertEq(v7.cnsWhoGrade, 3, "CNS5 GV7 grade 3");
  assertEq(v7.molecularUpgradeTriggered, true, "CNS5 GV7 TERT grade 3 upgrade=true");

  // Golden Vector 8: Medulloblastoma SHH TP53-mutant + Li-Fraumeni
  const v8 = classifyCns5({
    family: "medulloblastoma",
    molecular_group: "shh",
    tp53_status: "mutant"
  }, data.cns5Rules);
  assertEq(v8.diagnosis, "Medulloblastoma, SHH-activated and TP53-mutant", "CNS5 GV8 diagnosis");
  assertEq(v8.cnsWhoGrade, 4, "CNS5 GV8 grade 4");
  assert(
    (v8.clinicalPearls || []).some((p) => String(p).toLowerCase().includes("li-fraumeni")),
    "CNS5 GV8 includes Li-Fraumeni pearl"
  );

  // Golden Vector 3B: Oligodendroglioma low-grade histology + CDKN2A/B homdel stays Grade 2 with warning
  const v3b = classifyCns5({
    family: "adult_diffuse_glioma",
    idh_status: "mutant",
    codeletion_1p19q: "codeleted",
    necrosis: false,
    mvp: false,
    mitotic_activity_high: false,
    cdkn2ab_homdel: "present"
  }, data.cns5Rules);
  assertEq(v3b.diagnosis, "Oligodendroglioma, IDH-mutant and 1p/19q-codeleted", "CNS5 Oligo+CDKN2AB diagnosis");
  assertEq(v3b.cnsWhoGrade, 2, "CNS5 Oligo low-grade histology + CDKN2A/B homdel remains histological grade 2");
  assertEq(v3b.molecularUpgradeTriggered, false, "CNS5 Oligo CDKN2A/B homdel is NOT an unconditional molecular upgrade");
  assert(
    (v3b.warnings || []).some((w) => String(w).includes("CDKN2A/B") && String(w).toLowerCase().includes("borderline")),
    "CNS5 Oligo low-grade + CDKN2A/B emits borderline/prognostic warning"
  );

  // Golden Vector 3C: IDH-mutant NOS with retained ATRX + CDKN2A/B homdel warns oligodendroglioma is never Grade 4
  const v3c = classifyCns5({
    family: "adult_diffuse_glioma",
    idh_status: "mutant",
    codeletion_1p19q: "not_tested",
    atrx_status: "retained",
    cdkn2ab_homdel: "present",
    necrosis: false,
    mvp: false
  }, data.cns5Rules);
  assertEq(v3c.diagnosis, "Diffuse glioma, IDH-mutant, NOS", "CNS5 IDH-mut NOS diagnosis");
  assert(
    (v3c.warnings || []).some((w) => String(w).toLowerCase().includes("oligodendroglioma") && String(w).toLowerCase().includes("grade 4")),
    "CNS5 IDH-mut NOS retained ATRX + CDKN2A/B warns oligodendroglioma is never Grade 4"
  );

  // Golden Vector 9: Non-midline H3 K27-altered (EZHIP / EGFR-mutant) -> NEC
  const v9a = classifyCns5({
    family: "pediatric_hgg",
    anatomic_location: "hemispheric",
    h3_k27_status: "ezhip_overexpressed",
    idh_status: "wildtype"
  }, data.cns5Rules);
  assertEq(v9a.diagnosis, "Diffuse glioma, H3 K27-altered, non-midline, NEC", "CNS5 non-midline EZHIP -> NEC");
  assertEq(v9a.nosNecStatus, "NEC", "CNS5 non-midline EZHIP nosNecStatus=NEC");

  const v9b = classifyCns5({
    family: "pediatric_hgg",
    anatomic_location: "hemispheric",
    h3_k27_status: "egfr_mutant_midline",
    idh_status: "wildtype"
  }, data.cns5Rules);
  assertEq(v9b.diagnosis, "Diffuse glioma, H3 K27-altered, non-midline, NEC", "CNS5 non-midline EGFR-mutant -> NEC");

  // Golden Vector 10: Infant (<4y) hemispheric H3-wt/IDH-wt with untested RTK fusion emits reflex warning
  const v10 = classifyCns5({
    family: "pediatric_hgg",
    patient_age_group: "infant_under_4y",
    anatomic_location: "hemispheric",
    idh_status: "wildtype",
    h3_k27_status: "wildtype",
    h3_g34_status: "wildtype",
    infant_rtk_fusion: "not_tested"
  }, data.cns5Rules);
  assertEq(v10.diagnosis, "Diffuse pediatric-type high-grade glioma, H3-wildtype and IDH-wildtype", "CNS5 infant H3-wt/IDH-wt diagnosis");
  assert(
    (v10.warnings || []).some((w) => String(w).includes("Infant-type hemispheric glioma") && String(w).includes("NTRK")),
    "CNS5 infant hemispheric untested RTK fusion emits reflex warning"
  );

  // Golden Vector 11: HGAP NEC nosNecNote uses CNS WHO grade 3 PXA (no retired 'anaplastic PXA')
  const v11 = classifyCns5({
    family: "circumscribed_astrocytic",
    morphology_subtype: "piloid_high_grade",
    molecular_marker: "absent"
  }, data.cns5Rules);
  assert(
    typeof v11.nosNecNote === "string" && !v11.nosNecNote.toLowerCase().includes("anaplastic pxa"),
    "CNS5 HGAP NEC does not use retired WHO 2016 phrase 'anaplastic PXA'"
  );

  // Run all curated vignettes
  for (const vig of data.cns5Rules.vignettes || []) {
    const res = classifyCns5(vig.inputState, data.cns5Rules);
    const validGrade = [1, 2, 3, 4, "Not assigned"].includes(res.cnsWhoGrade);
    assert(validGrade, `CNS5 vignette ${vig.id} yields valid Arabic grade`);
    assert(Array.isArray(res.decisionPath) && res.decisionPath.length > 0, `CNS5 vignette ${vig.id} has decisionPath`);
  }

  const rpt = formatCns5Report(v1, { family: "adult_diffuse_glioma" });
  assert(typeof rpt === "string" && rpt.includes("Glioblastoma, IDH-wildtype"), "CNS5 formatCns5Report includes diagnosis");
}

// =========================================================================
// 3. Neuro-AI Audit Engine (js/auditEngine.js)
// =========================================================================
if (modules.audit && data.auditChecklist) {
  const {
    scoreAudit,
    escapeLatex,
    exportAuditMarkdown,
    exportAuditLatex,
    exportAuditBadgeSvg,
    exportAuditJson,
    validateImportedAuditJson
  } = modules.audit;

  const gsPreset = data.auditChecklist.presets.gold_standard;
  const gsScore = scoreAudit(data.auditChecklist, gsPreset.responses);
  assertEq(gsScore.criticalBlockersFailedCount, 0, "Audit gold_standard 0 critical failed");
  assertEq(gsScore.capApplied, false, "Audit gold_standard capApplied=false");
  assert(gsScore.overallScore >= 90, "Audit gold_standard overallScore >= 90", `got ${gsScore.overallScore}`);
  assertEq(gsScore.leakageRiskLevel, "Low", "Audit gold_standard risk=Low");

  const slPreset = data.auditChecklist.presets.slice_leakage_pitfall;
  const slScore = scoreAudit(data.auditChecklist, slPreset.responses);
  assert(slScore.criticalBlockersFailedCount >= 4, "Audit slice_leakage >=4 critical failed");
  assert(slScore.rawOverallScore > 45, "Audit slice_leakage rawOverallScore > 45", `got ${slScore.rawOverallScore}`);
  assertEq(slScore.overallScore, 45, "Audit slice_leakage capped to 45");
  assertEq(slScore.capApplied, true, "Audit slice_leakage capApplied=true");
  assertEq(slScore.leakageRiskLevel, "Critical Blocker", "Audit slice_leakage risk=Critical Blocker");

  const blPreset = data.auditChecklist.presets.blank;
  const blScore = scoreAudit(data.auditChecklist, blPreset.responses);
  assertEq(blScore.counts.answered, 0, "Audit blank answered=0");
  assertEq(blScore.overallScore, 0, "Audit blank overallScore=0");
  assertEq(blScore.leakageRiskLevel, "Not Assessed", "Audit blank risk=Not Assessed");

  // Unanswered Critical Blocker edge case: 35 pass + CS-01 unanswered MUST NOT yield Low risk
  const unansResp = {};
  for (const it of data.auditChecklist.items) {
    unansResp[it.id] = { status: it.id === "CS-01" ? "unanswered" : "pass", evidence: "" };
  }
  const unansScore = scoreAudit(data.auditChecklist, unansResp);
  assertEq(unansScore.overallScore, 96, "Audit 35-pass + CS-01 unanswered overallScore=96");
  assertEq(unansScore.leakageRiskLevel, "High", "Audit unanswered Critical Blocker caps risk at High (never Low)");
  assertEq(unansScore.criticalUnansweredCount, 1, "Audit criticalUnansweredCount=1");
  assert(
    Array.isArray(unansScore.criticalUnansweredIds) && unansScore.criticalUnansweredIds.includes("CS-01"),
    "Audit criticalUnansweredIds contains CS-01"
  );
  assert(
    typeof unansScore.criticalUnansweredWarning === "string" && unansScore.criticalUnansweredWarning.includes("CS-01"),
    "Audit criticalUnansweredWarning mentions CS-01"
  );

  const escaped = escapeLatex("50% IDH_1 & $100 #tag {a}^2 ~x\\y");
  assertEq(
    escaped,
    "50\\% IDH\\_1 \\& \\$100 \\#tag \\{a\\}\\textasciicircum{}2 \\textasciitilde{}x\\textbackslash{}y",
    "Audit escapeLatex golden vector"
  );

  const badgeSvg = exportAuditBadgeSvg(slScore, slPreset.studyMeta);
  artifacts.badgeSvg = badgeSvg;
  assert(typeof badgeSvg === "string" && badgeSvg.includes("<svg") && badgeSvg.includes("45/100"), "Audit SVG badge rendered with 45/100");

  const tex = exportAuditLatex(data.auditChecklist, slPreset.responses, slPreset.studyMeta, slScore);
  assert(tex.includes("longtable") && tex.includes("\\toprule") && tex.includes("\\bottomrule"), "Audit LaTeX export contains longtable booktabs");

  const md = exportAuditMarkdown(data.auditChecklist, slPreset.responses, slPreset.studyMeta, slScore);
  assert(md.includes("CS-01") && md.includes("Critical Blocker"), "Audit Markdown export contains CS-01 & Critical Blocker");

  const exportedJson = exportAuditJson(slPreset.studyMeta, slPreset.responses, slScore);
  const reimported = validateImportedAuditJson(exportedJson, data.auditChecklist);
  assertEq(reimported.valid, true, "Audit JSON export round-trips cleanly");

  const badImport = validateImportedAuditJson("{not valid json", data.auditChecklist);
  assertEq(badImport.valid, false, "Audit JSON validator rejects malformed JSON without throwing");
}
"""


def _try_run_js_via_node() -> dict[str, Any] | None:
    """Attempt live JS verification using Node.js ESM loader if installed."""
    node_bin = shutil.which("node")
    if not node_bin:
        return None

    body = _build_js_assertions_body()
    runner_mjs = f"""
import fs from "node:fs";
import path from "node:path";
import {{ pathToFileURL }} from "node:url";

const root = {json.dumps(str(ROOT))};
const modules = {{}};
const data = {{}};

async function maybeImport(relPath) {{
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return await import(pathToFileURL(full).href);
}}

function maybeReadJson(relPath) {{
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8"));
}}

modules.rano = await maybeImport("js/ranoCalculators.js");
modules.cns5 = await maybeImport("js/cns5Engine.js");
modules.audit = await maybeImport("js/auditEngine.js");
data.cns5Rules = maybeReadJson("data/cns5_rules.json");
data.auditChecklist = maybeReadJson("data/audit_checklist.json");

{body}

console.log(JSON.stringify({{
  executed: true,
  runtime: "node",
  modulesLoaded: Object.keys(modules).filter((k) => Boolean(modules[k])),
  passedCount: passed.length,
  failures,
  artifacts
}}));
"""
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            script_path = Path(tmpdir) / "verify_runner.mjs"
            script_path.write_text(runner_mjs, encoding="utf-8")
            proc = subprocess.run(
                [node_bin, str(script_path)],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
            if proc.returncode != 0:
                return {
                    "executed": True,
                    "runtime": "node",
                    "modulesLoaded": [],
                    "passedCount": 0,
                    "failures": [
                        f"Node.js harness crashed (exit {proc.returncode}): {proc.stderr.strip() or proc.stdout.strip()}"
                    ],
                    "artifacts": {},
                }
            # Extract last non-empty JSON line from stdout
            lines = [ln.strip() for ln in proc.stdout.splitlines() if ln.strip()]
            return json.loads(lines[-1])
    except Exception as exc:  # pragma: no cover - runtime environment fallback
        return {"executed": False, "reason": f"Node execution unavailable: {exc}"}


SKIP_BROWSER_FLAG = False


def _should_skip_browser() -> bool:
    """Return True when headless browser fallback is disabled via CLI or CNS5_SKIP_BROWSER."""
    if SKIP_BROWSER_FLAG:
        return True
    env_val = os.environ.get("CNS5_SKIP_BROWSER", "").strip().lower()
    return env_val in ("1", "true", "yes", "on")


def _find_headless_browser() -> str | None:
    """Locate Edge, Chrome, or Chromium executable across Windows/Linux/macOS."""
    candidates = [
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("msedge"),
        shutil.which("chrome"),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    for cand in candidates:
        if cand and Path(cand).is_file():
            return cand
    return None


def _try_run_js_via_headless_browser() -> dict[str, Any] | None:
    """Run live JS ES modules inside a headless Chromium/Edge browser over localhost."""
    if _should_skip_browser():
        return {
            "executed": False,
            "reason": "Headless browser fallback skipped (--skip-browser / CNS5_SKIP_BROWSER).",
        }

    browser_bin = _find_headless_browser()
    if not browser_bin:
        return None

    body = _build_js_assertions_body()
    has_rano = (ROOT / "js" / "ranoCalculators.js").is_file()
    has_cns5 = (ROOT / "js" / "cns5Engine.js").is_file()
    has_audit = (ROOT / "js" / "auditEngine.js").is_file()
    has_cns5_json = (ROOT / "data" / "cns5_rules.json").is_file()
    has_audit_json = (ROOT / "data" / "audit_checklist.json").is_file()

    harness_html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>CNS5-Audit Live JS Harness</title></head>
<body>
<script type="module">
const modules = {{}};
const data = {{}};
try {{
  if ({json.dumps(has_rano)}) modules.rano = await import("./js/ranoCalculators.js");
  if ({json.dumps(has_cns5)}) modules.cns5 = await import("./js/cns5Engine.js");
  if ({json.dumps(has_audit)}) modules.audit = await import("./js/auditEngine.js");
  if ({json.dumps(has_cns5_json)}) {{
    const r = await fetch("./data/cns5_rules.json");
    data.cns5Rules = await r.json();
  }}
  if ({json.dumps(has_audit_json)}) {{
    const r = await fetch("./data/audit_checklist.json");
    data.auditChecklist = await r.json();
  }}

  {body}

  await fetch("/__verify_result__", {{
    method: "POST",
    headers: {{ "Content-Type": "application/json" }},
    body: JSON.stringify({{
      executed: true,
      runtime: "headless-browser",
      modulesLoaded: Object.keys(modules).filter((k) => Boolean(modules[k])),
      passedCount: passed.length,
      failures,
      artifacts
    }})
  }});
}} catch (err) {{
  await fetch("/__verify_result__", {{
    method: "POST",
    headers: {{ "Content-Type": "application/json" }},
    body: JSON.stringify({{
      executed: true,
      runtime: "headless-browser",
      modulesLoaded: [],
      passedCount: 0,
      failures: ["Uncaught JS harness error: " + String(err && err.stack ? err.stack : err)],
      artifacts: {{}}
    }})
  }});
}}
</script>
</body>
</html>
"""

    result_holder: dict[str, Any] = {}
    done_event = threading.Event()

    mime_overrides = {
        ".js": "application/javascript; charset=utf-8",
        ".mjs": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
    }

    class _HarnessHandler(http.server.BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
            return

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path).path
            if parsed == "/__verify_harness__.html":
                payload = harness_html.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return

            rel = parsed.lstrip("/")
            root_resolved = ROOT.resolve()
            target = (root_resolved / rel).resolve()
            if not target.is_relative_to(root_resolved) or not target.is_file():
                self.send_response(404)
                self.end_headers()
                return

            payload = target.read_bytes()
            ctype = mime_overrides.get(target.suffix.lower(), "application/octet-stream")
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def do_POST(self) -> None:  # noqa: N802
            if urlparse(self.path).path != "/__verify_result__":
                self.send_response(404)
                self.end_headers()
                return
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            try:
                result_holder["payload"] = json.loads(raw.decode("utf-8"))
            except Exception as exc:
                result_holder["payload"] = {
                    "executed": True,
                    "runtime": "headless-browser",
                    "modulesLoaded": [],
                    "passedCount": 0,
                    "failures": [f"Malformed JSON from browser harness: {exc}"],
                    "artifacts": {},
                }
            done_event.set()
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")

    server: socketserver.ThreadingTCPServer | None = None
    proc: subprocess.Popen[str] | None = None
    user_data_dir = tempfile.mkdtemp(prefix="cns5audit_browser_")
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _HarnessHandler)
        port = server.server_address[1]
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()

        cmd = [
            browser_bin,
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-crash-reporter",
            "--disable-extensions",
            "--no-first-run",
            "--no-default-browser-check",
            f"--user-data-dir={user_data_dir}",
            f"http://127.0.0.1:{port}/__verify_harness__.html",
        ]

        popen_kwargs: dict[str, Any] = {
            "stdin": subprocess.DEVNULL,
            "stdout": subprocess.DEVNULL,
            "stderr": subprocess.DEVNULL,
            "close_fds": True,
            "text": True,
        }
        if os.name == "nt":
            popen_kwargs["creationflags"] = (
                getattr(subprocess, "CREATE_NO_WINDOW", 0)
                | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
            )

        proc = subprocess.Popen(cmd, **popen_kwargs)
        try:
            poll_timeout = float(os.environ.get("CNS5_BROWSER_TIMEOUT", "8.0"))
        except ValueError:
            poll_timeout = 8.0
        deadline = time.monotonic() + max(1.0, poll_timeout)
        while not done_event.is_set() and time.monotonic() < deadline:
            if proc.poll() is not None and not done_event.is_set():
                break
            done_event.wait(timeout=0.15)

        if not done_event.is_set():
            return {
                "executed": False,
                "reason": f"Headless browser ({Path(browser_bin).name}) timed out or could not reach loopback in this environment.",
            }
        return result_holder.get("payload")
    except Exception as exc:
        return {"executed": False, "reason": f"Headless browser execution unavailable: {exc}"}
    finally:
        if proc is not None:
            try:
                if proc.poll() is None:
                    if os.name == "nt":
                        subprocess.run(
                            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                            stdin=subprocess.DEVNULL,
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                            timeout=3,
                            check=False,
                        )
                    else:
                        proc.terminate()
                proc.wait(timeout=2)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
        if server is not None:
            try:
                server.shutdown()
                server.server_close()
            except Exception:
                pass
        shutil.rmtree(user_data_dir, ignore_errors=True)


def run_live_js_verification(skip_browser: bool | None = None) -> dict[str, Any]:
    """Run live JS assertions via Node.js first, falling back to headless browser."""
    node_res = _try_run_js_via_node()
    if node_res and node_res.get("executed"):
        return node_res
    should_skip = _should_skip_browser() if skip_browser is None else skip_browser
    if should_skip:
        browser_res: dict[str, Any] | None = {
            "executed": False,
            "reason": "Headless browser fallback skipped (--skip-browser / CNS5_SKIP_BROWSER).",
        }
    else:
        browser_res = _try_run_js_via_headless_browser()
        if browser_res and browser_res.get("executed"):
            return browser_res
    reasons = [
        r.get("reason", "")
        for r in (node_res, browser_res)
        if isinstance(r, dict) and r.get("reason")
    ]
    return {
        "executed": False,
        "reason": "; ".join(reasons) or "No Node.js or headless browser runtime available.",
    }


# ---------------------------------------------------------------------------
# Unittest Suites
# ---------------------------------------------------------------------------


class TestZeroBuildOfflineHygiene(unittest.TestCase):
    """Suite 1: Repository completeness, zero external CDN dependencies & disclaimers."""

    def test_required_files_exist(self) -> None:
        missing = [rel for rel in REQUIRED_PROJECT_FILES if not (ROOT / rel).is_file()]
        self.assertEqual(missing, [], f"Missing required project files: {missing}")

    def test_index_html_offline_and_disclaimer(self) -> None:
        index_path = ROOT / "index.html"
        self.assertTrue(index_path.is_file(), "index.html must exist")
        html_text = index_path.read_text(encoding="utf-8")

        parser = _OfflineHtmlAuditor()
        parser.feed(html_text)
        self.assertEqual(
            parser.external_resources,
            [],
            f"External CDN/runtime dependencies are forbidden in index.html: {parser.external_resources}",
        )

        body_lower = " ".join(parser.text_chunks).lower()
        self.assertIn(
            "research",
            body_lower,
            "index.html must include Research & Educational clinical compliance banner",
        )
        self.assertIn(
            "educational",
            body_lower,
            "index.html must include educational-use notice",
        )
        self.assertIn(
            "medical device",
            body_lower,
            "index.html must explicitly state 'Not a Certified Medical Device'",
        )

    def test_styles_css_offline_hygiene(self) -> None:
        css_path = ROOT / "css" / "styles.css"
        self.assertTrue(css_path.is_file(), "css/styles.css must exist")
        css_text = css_path.read_text(encoding="utf-8")
        external_imports = re.findall(
            r"@import\s+(?:url\()?['\"]?\s*(?:https?:)?//[^)'\"\s]+",
            css_text,
            flags=re.IGNORECASE,
        )
        external_urls = re.findall(
            r"url\(\s*['\"]?\s*(?:https?:)?//[^)'\"\s]+",
            css_text,
            flags=re.IGNORECASE,
        )
        self.assertEqual(
            external_imports + external_urls,
            [],
            f"External CDN URLs are forbidden in css/styles.css: {external_imports + external_urls}",
        )


class TestCns5KnowledgeBaseSchema(unittest.TestCase):
    """Suite 2: Validate data/cns5_rules.json structure, Arabic grades, citations & vignettes."""

    @classmethod
    def setUpClass(cls) -> None:
        path = ROOT / "data" / "cns5_rules.json"
        if not path.is_file():
            raise AssertionError(f"Missing required knowledge base: {path}")
        cls.data = json.loads(path.read_text(encoding="utf-8"))

    def test_top_level_structure_and_nos_nec_guidance(self) -> None:
        for key in (
            "schemaVersion",
            "standard",
            "nosNecGuidance",
            "families",
            "companionBiomarkers",
            "vignettes",
            "references",
        ):
            self.assertIn(key, self.data, f"Missing top-level key '{key}' in cns5_rules.json")

        guidance = self.data["nosNecGuidance"]
        for status_key in ("NOS", "NEC"):
            self.assertIn(status_key, guidance)
            for field in ("label", "definition", "action"):
                self.assertTrue(
                    isinstance(guidance[status_key].get(field), str)
                    and guidance[status_key][field].strip(),
                    f"nosNecGuidance.{status_key}.{field} must be a non-empty string",
                )

    def test_families_entities_arabic_grades_and_references(self) -> None:
        families = self.data["families"]
        family_ids = [f["id"] for f in families]
        self.assertEqual(
            len(family_ids),
            len(set(family_ids)),
            "Duplicate family IDs in cns5_rules.json",
        )
        self.assertEqual(
            set(family_ids),
            set(EXPECTED_CNS5_FAMILIES),
            f"Expected exact 7 WHO CNS5 families; got {family_ids}",
        )

        refs = self.data["references"]
        self.assertIsInstance(refs, dict)
        self.assertGreaterEqual(len(refs), 10, "Expected comprehensive WHO CNS5 citation catalog")
        for ref_id, ref_obj in refs.items():
            self.assertEqual(ref_obj.get("id"), ref_id)
            self.assertTrue(
                isinstance(ref_obj.get("citation"), str) and ref_obj["citation"].strip(),
                f"Reference '{ref_id}' missing citation text",
            )

        entity_ids: list[str] = []
        roman_grade_re = re.compile(r"\bgrade\s+(?:I|II|III|IV)\b")

        for fam in families:
            for field in ("id", "categoryGroup", "label", "shortLabel", "description"):
                self.assertTrue(
                    isinstance(fam.get(field), str) and fam[field].strip(),
                    f"Family '{fam.get('id')}' missing non-empty '{field}'",
                )
            entities = fam.get("entities", [])
            self.assertGreaterEqual(
                len(entities), 1, f"Family '{fam['id']}' must define at least 1 entity"
            )
            for ent in entities:
                eid = ent.get("id")
                self.assertTrue(isinstance(eid, str) and eid.strip(), "Entity missing id")
                entity_ids.append(eid)

                name = ent.get("name", "")
                self.assertTrue(isinstance(name, str) and name.strip(), f"Entity '{eid}' missing name")
                self.assertIsNone(
                    roman_grade_re.search(name),
                    f"Entity name '{name}' must use Arabic numerals, never Roman numerals",
                )

                grades = ent.get("gradesAllowed")
                self.assertIsInstance(grades, list, f"Entity '{eid}' gradesAllowed must be a list")
                self.assertGreaterEqual(len(grades), 1, f"Entity '{eid}' gradesAllowed cannot be empty")
                for g in grades:
                    is_valid_arabic = (
                        (isinstance(g, int) and not isinstance(g, bool) and g in (1, 2, 3, 4))
                        or g == "Not assigned"
                    )
                    self.assertTrue(
                        is_valid_arabic,
                        f"Entity '{eid}' has invalid CNS WHO grade {g!r}; must be int 1..4 or 'Not assigned'",
                    )

                self.assertIsInstance(ent.get("molecularHallmarks"), list)
                self.assertIsInstance(ent.get("histologicHallmarks"), list)
                ref_ids = ent.get("referenceIds")
                self.assertIsInstance(ref_ids, list)
                self.assertGreaterEqual(len(ref_ids), 1, f"Entity '{eid}' must cite >=1 reference")
                for rid in ref_ids:
                    self.assertIn(
                        rid, refs, f"Entity '{eid}' cites unknown referenceId '{rid}'"
                    )

        self.assertEqual(
            len(entity_ids), len(set(entity_ids)), "Duplicate entity IDs in cns5_rules.json"
        )
        self.assertGreaterEqual(
            len(entity_ids),
            24,
            f"WHO CNS5 knowledge base must contain >=24 distinct entities; found {len(entity_ids)}",
        )

    def test_vignettes_integrity(self) -> None:
        vignettes = self.data["vignettes"]
        self.assertGreaterEqual(
            len(vignettes), 8, "Expected >=8 curated WHO CNS5 clinical vignettes"
        )
        seen_ids: set[str] = set()
        for vig in vignettes:
            vid = vig.get("id")
            self.assertTrue(isinstance(vid, str) and vid.strip())
            self.assertNotIn(vid, seen_ids, f"Duplicate vignette ID '{vid}'")
            seen_ids.add(vid)
            self.assertTrue(isinstance(vig.get("label"), str) and vig["label"].strip())
            fam = vig.get("family")
            self.assertIn(fam, EXPECTED_CNS5_FAMILIES, f"Vignette '{vid}' has unknown family '{fam}'")
            inp = vig.get("inputState")
            self.assertIsInstance(inp, dict, f"Vignette '{vid}' inputState must be an object")
            if "family" in inp:
                self.assertEqual(
                    inp["family"],
                    fam,
                    f"Vignette '{vid}' inputState.family mismatches vignette.family",
                )


class TestAuditChecklistSchemaAndOracle(unittest.TestCase):
    """Suite 3: Validate data/audit_checklist.json (36 items, CLAIM/TRIPOD+AI, presets, blocker cap)."""

    @classmethod
    def setUpClass(cls) -> None:
        path = ROOT / "data" / "audit_checklist.json"
        if not path.is_file():
            raise AssertionError(f"Missing required audit checklist: {path}")
        cls.data = json.loads(path.read_text(encoding="utf-8"))

    def test_standards_and_six_domains(self) -> None:
        for key in ("schemaVersion", "standards", "domains", "items", "presets"):
            self.assertIn(key, self.data, f"Missing top-level key '{key}' in audit_checklist.json")

        for std_key in ("claim2024", "tripodAi"):
            std = self.data["standards"].get(std_key, {})
            for field in ("name", "citation", "doi"):
                self.assertTrue(
                    isinstance(std.get(field), str) and std[field].strip(),
                    f"standards.{std_key}.{field} must be non-empty",
                )

        domains = self.data["domains"]
        self.assertEqual(len(domains), 6, "Audit checklist must contain exactly 6 domains")
        expected_dom_ids = [d[0] for d in EXPECTED_AUDIT_DOMAINS]
        self.assertEqual([d["id"] for d in domains], expected_dom_ids)
        for dom in domains:
            for field in ("id", "title", "shortTitle", "description"):
                self.assertTrue(
                    isinstance(dom.get(field), str) and dom[field].strip(),
                    f"Domain '{dom.get('id')}' missing non-empty '{field}'",
                )

    def test_36_items_refs_and_severity_distribution(self) -> None:
        items = self.data["items"]
        self.assertEqual(len(items), 36, f"Expected exactly 36 audit items; found {len(items)}")

        claim_re = re.compile(r"^CLAIM-(\d+)$")
        tripod_re = re.compile(r"^TRIPOD\+AI-(\d+)$")
        prefix_by_domain = dict(EXPECTED_AUDIT_DOMAINS)

        seen_ids: set[str] = set()
        per_domain_counts: dict[str, int] = {d[0]: 0 for d in EXPECTED_AUDIT_DOMAINS}
        critical_ids: set[str] = set()

        for item in items:
            iid = item.get("id")
            dom_id = item.get("domainId")
            self.assertTrue(isinstance(iid, str) and iid.strip())
            self.assertNotIn(iid, seen_ids, f"Duplicate audit item ID '{iid}'")
            seen_ids.add(iid)

            self.assertIn(dom_id, per_domain_counts, f"Item '{iid}' has unknown domainId '{dom_id}'")
            per_domain_counts[dom_id] += 1

            expected_prefix = prefix_by_domain[dom_id]
            self.assertTrue(
                re.match(rf"^{expected_prefix}-0[1-6]$", iid),
                f"Item ID '{iid}' does not match expected pattern '{expected_prefix}-01..06'",
            )

            for field in ("title", "question", "failureMode", "remediation"):
                self.assertTrue(
                    isinstance(item.get(field), str) and item[field].strip(),
                    f"Item '{iid}' missing non-empty '{field}'",
                )

            sev = item.get("severity")
            self.assertIn(sev, SEVERITY_WEIGHTS, f"Item '{iid}' has invalid severity '{sev}'")
            if sev == "critical":
                critical_ids.add(iid)

            self.assertIsInstance(
                item.get("neuroImagingRedFlag"),
                bool,
                f"Item '{iid}' neuroImagingRedFlag must be boolean",
            )

            claim_refs = item.get("claim2024Refs")
            self.assertIsInstance(claim_refs, list)
            self.assertGreaterEqual(len(claim_refs), 1, f"Item '{iid}' must map >=1 CLAIM 2024 ref")
            for ref in claim_refs:
                m = claim_re.match(str(ref))
                self.assertIsNotNone(m, f"Item '{iid}' has invalid CLAIM ref '{ref}'")
                num = int(m.group(1))
                self.assertTrue(1 <= num <= 44, f"Item '{iid}' CLAIM ref out of 1..44 range: {ref}")

            tripod_refs = item.get("tripodAiRefs")
            self.assertIsInstance(tripod_refs, list)
            self.assertGreaterEqual(len(tripod_refs), 1, f"Item '{iid}' must map >=1 TRIPOD+AI ref")
            for ref in tripod_refs:
                m = tripod_re.match(str(ref))
                self.assertIsNotNone(m, f"Item '{iid}' has invalid TRIPOD+AI ref '{ref}'")
                num = int(m.group(1))
                self.assertTrue(1 <= num <= 27, f"Item '{iid}' TRIPOD+AI ref out of 1..27 range: {ref}")

        for dom_id, count in per_domain_counts.items():
            self.assertEqual(count, 6, f"Domain '{dom_id}' must have exactly 6 items; found {count}")

        self.assertEqual(
            critical_ids,
            EXPECTED_CRITICAL_ITEM_IDS,
            f"Critical blocker item set mismatch: expected {sorted(EXPECTED_CRITICAL_ITEM_IDS)}, got {sorted(critical_ids)}",
        )

    def test_presets_integrity_and_reference_scoring_oracle(self) -> None:
        presets = self.data["presets"]
        all_item_ids = {it["id"] for it in self.data["items"]}

        for preset_key in ("gold_standard", "slice_leakage_pitfall", "blank"):
            self.assertIn(preset_key, presets, f"Missing required preset '{preset_key}'")
            preset = presets[preset_key]
            self.assertEqual(preset.get("id"), preset_key)
            self.assertTrue(isinstance(preset.get("label"), str) and preset["label"].strip())
            meta = preset.get("studyMeta")
            self.assertIsInstance(meta, dict)
            for mk in CANONICAL_STUDY_META_KEYS:
                self.assertIn(mk, meta, f"Preset '{preset_key}' studyMeta missing key '{mk}'")
            resp = preset.get("responses")
            self.assertIsInstance(resp, dict)
            self.assertEqual(
                set(resp.keys()),
                all_item_ids,
                f"Preset '{preset_key}' responses must cover all 36 audit item IDs",
            )
            for iid, entry in resp.items():
                self.assertIsInstance(entry, dict)
                self.assertIn(
                    entry.get("status"),
                    VALID_AUDIT_STATUSES,
                    f"Preset '{preset_key}' item '{iid}' has invalid status {entry.get('status')!r}",
                )

        # Oracle check 1: gold_standard
        gs = score_audit_reference(self.data, presets["gold_standard"]["responses"])
        self.assertEqual(gs["criticalBlockersFailedCount"], 0)
        self.assertEqual(gs["criticalPartialsCount"], 0)
        self.assertFalse(gs["capApplied"])
        self.assertGreaterEqual(gs["overallScore"], 90)
        self.assertEqual(gs["leakageRiskLevel"], "Low")

        # Oracle check 2: slice_leakage_pitfall (Critical Blocker cap at 45)
        sl = score_audit_reference(self.data, presets["slice_leakage_pitfall"]["responses"])
        self.assertGreaterEqual(sl["criticalBlockersFailedCount"], 4)
        for required_fail in ("CS-01", "MP-01", "RF-01", "MS-01", "CC-01"):
            self.assertIn(
                required_fail,
                sl["criticalBlockersFailedIds"],
                f"slice_leakage_pitfall preset must fail critical blocker '{required_fail}'",
            )
        self.assertGreater(
            sl["rawOverallScore"],
            CRITICAL_BLOCKER_SCORE_CAP,
            "slice_leakage_pitfall rawOverallScore must exceed 45 to visibly demonstrate cap",
        )
        self.assertEqual(sl["overallScore"], CRITICAL_BLOCKER_SCORE_CAP)
        self.assertTrue(sl["capApplied"])
        self.assertEqual(sl["leakageRiskLevel"], "Critical Blocker")

        # Oracle check 3: blank
        bl = score_audit_reference(self.data, presets["blank"]["responses"])
        self.assertEqual(bl["counts"]["answered"], 0)
        self.assertEqual(bl["overallScore"], 0)
        self.assertEqual(bl["leakageRiskLevel"], "Not Assessed")

        # Oracle check 4: unanswered Critical Blocker prevents 'Low' designation
        unans_resp = {
            it["id"]: {"status": "unanswered" if it["id"] == "CS-01" else "pass", "evidence": ""}
            for it in self.data["items"]
        }
        unans = score_audit_reference(self.data, unans_resp)
        self.assertEqual(unans["overallScore"], 96)
        self.assertEqual(unans["leakageRiskLevel"], "High")
        self.assertEqual(unans["criticalUnansweredIds"], ["CS-01"])

    def test_severity_counts_sync_with_index_html_and_readme(self) -> None:
        counts = {"critical": 0, "major": 0, "recommended": 0}
        for item in self.data["items"]:
            counts[item["severity"]] += 1
        self.assertEqual(counts, {"critical": 11, "major": 17, "recommended": 8})

        index_html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn(f"All Severities ({len(self.data['items'])})", index_html)
        self.assertIn(f"Critical Blockers Only ({counts['critical']})", index_html)
        self.assertIn(f"Major ({counts['major']})", index_html)
        self.assertIn(f"Recommended ({counts['recommended']})", index_html)

        readme_text = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn(f"`critical = 3` ({counts['critical']} items)", readme_text)
        self.assertIn(f"`major = 2` ({counts['major']} items)", readme_text)
        self.assertIn(f"`recommended = 1` ({counts['recommended']} items)", readme_text)

    def test_claim_2024_and_tripod_ai_2024_semantic_mappings(self) -> None:
        by_id = {it["id"]: it for it in self.data["items"]}

        # CLAIM 2024 (44-item Tejani et al., Radiology: AI 2024;6(4):e240300) key checks
        self.assertIn("CLAIM-33", by_id["MS-01"]["claim2024Refs"])
        self.assertNotIn("CLAIM-32", by_id["MS-01"]["claim2024Refs"])
        for ref in ("CLAIM-36", "CLAIM-37", "CLAIM-38"):
            self.assertIn(ref, by_id["MS-05"]["claim2024Refs"])
        self.assertNotIn("CLAIM-33", by_id["MS-05"]["claim2024Refs"])
        for ref in ("CLAIM-29", "CLAIM-37", "CLAIM-38"):
            self.assertIn(ref, by_id["CC-04"]["claim2024Refs"])
        self.assertNotIn("CLAIM-31", by_id["CC-04"]["claim2024Refs"])
        self.assertNotIn("CLAIM-34", by_id["CC-04"]["claim2024Refs"])
        self.assertIn("CLAIM-35", by_id["CS-05"]["claim2024Refs"])
        self.assertNotIn("CLAIM-29", by_id["CS-05"]["claim2024Refs"])
        self.assertNotIn("CLAIM-35", by_id["RF-06"]["claim2024Refs"])
        for ref in ("CLAIM-28", "CLAIM-37", "CLAIM-38"):
            self.assertIn(ref, by_id["CC-03"]["claim2024Refs"])
        self.assertNotIn("CLAIM-31", by_id["CC-03"]["claim2024Refs"])
        self.assertIn("CLAIM-21", by_id["CS-06"]["claim2024Refs"])
        self.assertIn("CLAIM-36", by_id["CS-06"]["claim2024Refs"])
        self.assertNotIn("CLAIM-30", by_id["CS-06"]["claim2024Refs"])
        self.assertIn("CLAIM-36", by_id["MS-04"]["claim2024Refs"])
        self.assertNotIn("CLAIM-30", by_id["MS-04"]["claim2024Refs"])
        for ref in ("CLAIM-31", "CLAIM-39"):
            self.assertIn(ref, by_id["MS-06"]["claim2024Refs"])
        self.assertNotIn("CLAIM-36", by_id["MS-06"]["claim2024Refs"])
        for ref in ("CLAIM-30", "CLAIM-39"):
            self.assertIn(ref, by_id["MS-03"]["claim2024Refs"])
        self.assertNotIn("CLAIM-36", by_id["MS-03"]["claim2024Refs"])

        # TRIPOD+AI 2024 (27-item Collins et al., BMJ 2024;385:e078378) key checks
        for iid in ("CS-01", "CS-02", "CS-03", "RF-05"):
            self.assertIn("TRIPOD+AI-12", by_id[iid]["tripodAiRefs"])
            self.assertNotIn("TRIPOD+AI-14", by_id[iid]["tripodAiRefs"])
        for iid in ("CC-01", "CC-02", "MP-04"):
            self.assertIn("TRIPOD+AI-8", by_id[iid]["tripodAiRefs"])
            self.assertNotIn("TRIPOD+AI-6", by_id[iid]["tripodAiRefs"])
        for iid in ("MP-01", "MP-03", "MP-05", "RF-02"):
            self.assertIn("TRIPOD+AI-7", by_id[iid]["tripodAiRefs"])
            self.assertIn("TRIPOD+AI-9", by_id[iid]["tripodAiRefs"])
            self.assertNotIn("TRIPOD+AI-10", by_id[iid]["tripodAiRefs"])
        self.assertIn("TRIPOD+AI-10", by_id["CS-06"]["tripodAiRefs"])
        self.assertNotIn("TRIPOD+AI-8", by_id["CS-06"]["tripodAiRefs"])
        for iid in ("RF-02", "RF-04", "RF-05", "OS-03"):
            self.assertIn("TRIPOD+AI-12", by_id[iid]["tripodAiRefs"])
            self.assertNotIn("TRIPOD+AI-11", by_id[iid]["tripodAiRefs"])
        for iid in ("MS-01", "MS-02", "MS-04", "RF-04"):
            self.assertNotIn("TRIPOD+AI-15", by_id[iid]["tripodAiRefs"])
            self.assertIn("TRIPOD+AI-16", by_id[iid]["tripodAiRefs"])
        self.assertIn("TRIPOD+AI-14", by_id["MS-05"]["tripodAiRefs"])
        self.assertIn("TRIPOD+AI-23", by_id["MS-05"]["tripodAiRefs"])
        self.assertNotIn("TRIPOD+AI-17", by_id["MS-05"]["tripodAiRefs"])
        self.assertIn("TRIPOD+AI-17", by_id["OS-04"]["tripodAiRefs"])
        self.assertIn("TRIPOD+AI-7", by_id["OS-04"]["tripodAiRefs"])
        self.assertNotIn("TRIPOD+AI-5", by_id["OS-04"]["tripodAiRefs"])
        for iid in ("CC-03", "CC-04", "CC-05", "RF-06"):
            self.assertNotIn("TRIPOD+AI-16", by_id[iid]["tripodAiRefs"])
            self.assertIn("TRIPOD+AI-12", by_id[iid]["tripodAiRefs"])
            self.assertIn("TRIPOD+AI-23", by_id[iid]["tripodAiRefs"])
        self.assertIn("TRIPOD+AI-15", by_id["CC-05"]["tripodAiRefs"])


class TestEsModuleContractsAndPurity(unittest.TestCase):
    """Suite 4: Static ES Module export/import graph and zero-DOM purity verification."""

    def test_required_exports_present(self) -> None:
        for rel_path, expected_symbols in REQUIRED_EXPORTS.items():
            full_path = ROOT / rel_path
            self.assertTrue(full_path.is_file(), f"Missing ES module: {rel_path}")
            found_exports = extract_js_exports(full_path.read_text(encoding="utf-8"))
            missing = [sym for sym in expected_symbols if sym not in found_exports]
            self.assertEqual(
                missing,
                [],
                f"{rel_path} is missing required exported symbols: {missing}",
            )

    def test_local_imports_resolve_to_exports(self) -> None:
        js_dir = ROOT / "js"
        self.assertTrue(js_dir.is_dir(), "js/ directory must exist")
        export_cache: dict[Path, set[str]] = {}

        for js_file in sorted(js_dir.glob("*.js")):
            export_cache[js_file.resolve()] = extract_js_exports(
                js_file.read_text(encoding="utf-8")
            )

        for js_file in sorted(js_dir.glob("*.js")):
            imports = extract_js_local_imports(js_file.read_text(encoding="utf-8"))
            for rel_target, imported_names in imports:
                target_path = (js_file.parent / rel_target).resolve()
                self.assertTrue(
                    target_path.is_file(),
                    f"{js_file.name} imports missing local module '{rel_target}'",
                )
                target_exports = export_cache.get(target_path) or extract_js_exports(
                    target_path.read_text(encoding="utf-8")
                )
                unresolved = [n for n in imported_names if n not in target_exports]
                self.assertEqual(
                    unresolved,
                    [],
                    f"{js_file.name} imports non-exported symbol(s) {unresolved} from '{rel_target}'",
                )

    def test_pure_logic_modules_have_zero_dom_globals(self) -> None:
        forbidden_re = re.compile(r"\b(?:document|window|localStorage|sessionStorage)\s*\.")
        for rel_path in PURE_LOGIC_MODULES:
            full_path = ROOT / rel_path
            self.assertTrue(full_path.is_file(), f"Missing pure logic module: {rel_path}")
            stripped = strip_js_comments(full_path.read_text(encoding="utf-8"))
            matches = forbidden_re.findall(stripped)
            self.assertEqual(
                matches,
                [],
                f"Pure logic module {rel_path} must NOT access DOM globals; found {matches}",
            )


class TestPythonReferenceParityClinicalRules(unittest.TestCase):
    """Suite 5: Pure-Python reference parity checks across WHO CNS5, RANO, and Audit criteria."""

    def test_cns5_golden_vectors_reference(self) -> None:
        # 1. Molecular GBM
        r1 = classify_cns5_reference({
            "family": "adult_diffuse_glioma",
            "idh_status": "wildtype",
            "tert_promoter": "mutant",
            "necrosis": False,
            "mvp": False,
        })
        self.assertEqual(r1["diagnosis"], "Glioblastoma, IDH-wildtype")
        self.assertEqual(r1["cnsWhoGrade"], 4)
        self.assertTrue(r1["molecularUpgradeTriggered"])

        # 2. CDKN2A/B Grade 4 upgrade in IDH-mutant astrocytoma
        r2 = classify_cns5_reference({
            "family": "adult_diffuse_glioma",
            "idh_status": "mutant",
            "codeletion_1p19q": "intact",
            "cdkn2ab_homdel": "present",
            "necrosis": False,
            "mvp": False,
        })
        self.assertEqual(r2["diagnosis"], "Astrocytoma, IDH-mutant")
        self.assertEqual(r2["cnsWhoGrade"], 4)
        self.assertTrue(r2["molecularUpgradeTriggered"])

        # 2B. Oligodendroglioma low-grade histology + CDKN2A/B homdel stays Grade 2 (no standalone upgrade)
        r2b = classify_cns5_reference({
            "family": "adult_diffuse_glioma",
            "idh_status": "mutant",
            "codeletion_1p19q": "codeleted",
            "cdkn2ab_homdel": "present",
            "necrosis": False,
            "mvp": False,
            "mitotic_activity_high": False,
        })
        self.assertEqual(r2b["diagnosis"], "Oligodendroglioma, IDH-mutant and 1p/19q-codeleted")
        self.assertEqual(r2b["cnsWhoGrade"], 2)
        self.assertFalse(r2b["molecularUpgradeTriggered"])

        # 3. NOS & NEC
        r4 = classify_cns5_reference({"family": "adult_diffuse_glioma", "idh_status": "not_tested", "necrosis": True})
        self.assertEqual((r4["diagnosis"], r4["cnsWhoGrade"], r4["nosNecStatus"]), ("Glioblastoma, NOS", 4, "NOS"))
        r5 = classify_cns5_reference({
            "family": "adult_diffuse_glioma",
            "idh_status": "wildtype",
            "necrosis": False,
            "mvp": False,
            "tert_promoter": "wildtype",
            "egfr_amplification": "absent",
            "chr7_gain_chr10_loss": "absent",
        })
        self.assertEqual(r5["nosNecStatus"], "NEC")
        self.assertEqual(r5["cnsWhoGrade"], "Not assigned")

        # 4. Myxopapillary ependymoma Grade 2 & Meningioma TERT Grade 3
        r6 = classify_cns5_reference({"family": "ependymal_tumor", "compartment": "spinal", "histology_variant": "myxopapillary"})
        self.assertEqual(r6["cnsWhoGrade"], 2)
        r7 = classify_cns5_reference({"family": "meningioma", "mitoses_per_10hpf": 1, "tert_promoter": "mutant"})
        self.assertEqual(r7["cnsWhoGrade"], 3)
        self.assertTrue(r7["molecularUpgradeTriggered"])

    def test_rano2_golden_vectors_reference(self) -> None:
        # <=12w post-RT monotonicity
        self.assertEqual(
            calculate_rano2_reference({
                "baselineValue": 400, "nadirValue": 400, "currentValue": 600,
                "within12WeeksPostRt": True, "clinicalStatus": "worse",
            }),
            "PD",
        )
        self.assertEqual(
            calculate_rano2_reference({
                "baselineValue": 400, "nadirValue": 400, "currentValue": 600,
                "within12WeeksPostRt": True, "clinicalStatus": "stable_or_improved",
            }),
            "Prelim-PD",
        )
        # Baseline=0 CR guard + EPS consistency
        self.assertEqual(
            calculate_rano2_reference({
                "baselineValue": 0, "nadirValue": 0, "currentValue": 0,
                "nonMeasurablePresent": False, "corticosteroids": "none_or_physiologic",
            }),
            "Non-PD",
        )
        self.assertEqual(
            calculate_rano2_reference({
                "baselineValue": 0, "nadirValue": 0, "currentValue": 1e-12,
                "nonMeasurablePresent": False, "corticosteroids": "none_or_physiologic",
            }),
            "Non-PD",
        )
        # CR steroid downgrade
        self.assertEqual(
            calculate_rano2_reference({
                "baselineValue": 400, "currentValue": 0, "corticosteroids": "stable_or_decreased",
            }),
            "PR",
        )
        self.assertEqual(
            calculate_rano2_reference({
                "baselineValue": 400, "currentValue": 0, "corticosteroids": "increased",
            }),
            "SD",
        )
        # MR in LGG vs SD in HGG
        self.assertEqual(
            calculate_rano2_reference({
                "tumorMode": "non_enhancing_lgg", "measurementType": "3d_volume",
                "baselineValue": 20, "currentValue": 10,
            }),
            "MR",
        )
        self.assertEqual(
            calculate_rano2_reference({
                "tumorMode": "enhancing_hgg", "measurementType": "3d_volume",
                "baselineValue": 20, "currentValue": 10,
            }),
            "SD",
        )

    def test_rano_bm_and_resect_golden_vectors_reference(self) -> None:
        # RANO-BM >=20% AND >=5 mm dual threshold
        self.assertEqual(
            calculate_rano_bm_reference({"baselineSldMm": 15, "nadirSldMm": 15, "currentSldMm": 19}),
            ("SD", False),
        )
        self.assertEqual(
            calculate_rano_bm_reference({"baselineSldMm": 15, "nadirSldMm": 15, "currentSldMm": 20}),
            ("PD", False),
        )
        # Bicompartmental discordance
        self.assertEqual(
            calculate_rano_bm_reference({
                "baselineSldMm": 30, "nadirSldMm": 30, "currentSldMm": 18, "nonCnsStatus": "PD",
            }),
            ("PR", True),
        )
        # Sub-epsilon baseline=0 CR guard consistency
        self.assertEqual(
            calculate_rano_bm_reference({
                "baselineSldMm": 1e-12, "nadirSldMm": 1e-12, "currentSldMm": 1e-12,
            }),
            ("Non-PD", False),
        )
        # RANO-Resect Karschnia 2023 hierarchy
        self.assertEqual(calculate_rano_resect_reference({"preOpCeVolCm3": 0, "postOpCeVolCm3": 0}), "N/A")
        self.assertEqual(calculate_rano_resect_reference({"preOpCeVolCm3": 3.0, "postOpCeVolCm3": 2.8}), "Class 4")
        self.assertEqual(calculate_rano_resect_reference({"preOpCeVolCm3": 100.0, "postOpCeVolCm3": 92.0, "isBiopsyProcedure": False}), "Class 3B")
        self.assertEqual(calculate_rano_resect_reference({"preOpCeVolCm3": 100.0, "postOpCeVolCm3": 92.0, "isBiopsyProcedure": True}), "Class 4")
        self.assertEqual(calculate_rano_resect_reference({"preOpCeVolCm3": 100.0, "postOpCeVolCm3": 100.0, "isBiopsyProcedure": False}), "Class 4")
        self.assertEqual(calculate_rano_resect_reference({"preOpCeVolCm3": 25, "postOpCeVolCm3": 0, "postOpNonCeVolCm3": 4.2}), "Class 1")
        self.assertEqual(calculate_rano_resect_reference({"preOpCeVolCm3": 25, "postOpCeVolCm3": 0, "postOpNonCeVolCm3": 8.0}), "Class 2A")
        self.assertEqual(calculate_rano_resect_reference({"preOpCeVolCm3": 25, "postOpCeVolCm3": 0, "postOpNonCeVolCm3": None}), "Class 2A")
        self.assertEqual(calculate_rano_resect_reference({"preOpCeVolCm3": 25, "postOpCeVolCm3": 1.0}), "Class 2B")
        self.assertEqual(calculate_rano_resect_reference({"preOpCeVolCm3": 25, "postOpCeVolCm3": 5.0}), "Class 3A")
        self.assertEqual(calculate_rano_resect_reference({"preOpCeVolCm3": 25, "postOpCeVolCm3": 5.1}), "Class 3B")

    def test_latex_escaping_golden_vector_reference(self) -> None:
        raw = r"50% IDH_1 & $100 #tag {a}^2 ~x\y"
        expected = r"50\% IDH\_1 \& \$100 \#tag \{a\}\textasciicircum{}2 \textasciitilde{}x\textbackslash{}y"
        self.assertEqual(escape_latex_reference(raw), expected)


class TestLiveJavaScriptEngines(unittest.TestCase):
    """Suite 6: Live ES Module execution via Node.js or Headless Browser (graceful fallback)."""

    def test_skip_browser_env_guard(self) -> None:
        orig_env = os.environ.get("CNS5_SKIP_BROWSER")
        try:
            os.environ["CNS5_SKIP_BROWSER"] = "1"
            self.assertTrue(_should_skip_browser())
            res = _try_run_js_via_headless_browser()
            self.assertIsInstance(res, dict)
            self.assertFalse(res.get("executed"))
            self.assertIn("skipped", str(res.get("reason", "")).lower())
        finally:
            if orig_env is None:
                os.environ.pop("CNS5_SKIP_BROWSER", None)
            else:
                os.environ["CNS5_SKIP_BROWSER"] = orig_env

    def test_app_ui_static_contracts(self) -> None:
        app_js = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        index_html = (ROOT / "index.html").read_text(encoding="utf-8")
        styles_css = (ROOT / "css" / "styles.css").read_text(encoding="utf-8")
        pages_yml = (ROOT / ".github" / "workflows" / "pages.yml").read_text(encoding="utf-8")

        self.assertIn("python tests/verify_rules.py --skip-browser", pages_yml)
        self.assertIn("syncAuditSeverityFilterCounts", app_js)
        self.assertGreaterEqual(
            app_js.count("spdRes.lesionProducts.find((p) => p.index === idx + 1)"),
            2,
            "Both renderRano2SpdHelperInner and updateRano2SpdReadoutOnly must look up lesionProducts by 1-based prod.index",
        )
        self.assertIn("rano2-spd-warnings", app_js)
        self.assertIn("wireTablistKeyboard", app_js)
        self.assertIn("renderAuditProgressQuickbar", app_js)
        self.assertIn("renderPrintSummarySheet", app_js)

        for required_id in (
            "print-summary-btn",
            "print-summary-sheet",
            "audit-progress-bar",
            "audit-next-unanswered-btn",
            "audit-jump-blockers-btn",
            "audit-domain-progress-pills",
        ):
            self.assertIn(f'id="{required_id}"', index_html, f"Missing #{required_id} in index.html")

        self.assertIn("@media print", styles_css)
        self.assertIn(".print-sheet", styles_css)

        cns5_js = (ROOT / "js" / "cns5Engine.js").read_text(encoding="utf-8")
        self.assertNotIn("anaplastic PXA", cns5_js)

    def test_live_js_engines_and_svg_xml_validity(self) -> None:
        result = run_live_js_verification()
        if not result.get("executed"):
            print(
                f"\n[INFO] Live JS runtime skipped ({result.get('reason')}); "
                "all pure-Python schema, static-contract & clinical parity suites passed.",
                file=sys.stderr,
            )
            return

        failures = result.get("failures", [])
        self.assertEqual(
            failures,
            [],
            f"Live JS engine verification ({result.get('runtime')}) failed:\n  - "
            + "\n  - ".join(failures),
        )

        # Verify every expected JS engine module was exercised when present on disk
        loaded = set(result.get("modulesLoaded", []))
        if (ROOT / "js" / "ranoCalculators.js").is_file():
            self.assertIn("rano", loaded, "js/ranoCalculators.js did not load in live JS harness")
        if (ROOT / "js" / "cns5Engine.js").is_file():
            self.assertIn("cns5", loaded, "js/cns5Engine.js did not load in live JS harness")
        if (ROOT / "js" / "auditEngine.js").is_file():
            self.assertIn("audit", loaded, "js/auditEngine.js did not load in live JS harness")

        # Validate SVG badge output from live JS with stdlib XML parser
        badge_svg = (result.get("artifacts") or {}).get("badgeSvg")
        if badge_svg is not None:
            try:
                root_el = ET.fromstring(badge_svg)
            except ET.ParseError as exc:
                self.fail(f"exportAuditBadgeSvg produced invalid XML: {exc}")
            self.assertTrue(
                root_el.tag.endswith("svg"),
                f"Expected root <svg> element; got {root_el.tag}",
            )

        print(
            f"\n[INFO] Live JS verification ({result.get('runtime')}) executed "
            f"{result.get('passedCount', 0)} assertions across {sorted(loaded)} — 100% PASS.",
            file=sys.stderr,
        )


def main(argv: list[str] | None = None) -> int:
    global SKIP_BROWSER_FLAG
    parser = argparse.ArgumentParser(
        description="CNS5-Audit automated clinical criteria, schema, and contract verification suite."
    )
    parser.add_argument(
        "--skip-browser",
        action="store_true",
        help="Skip headless browser (Edge/Chrome/Chromium) JS fallback (equivalent to CNS5_SKIP_BROWSER=1).",
    )
    parser.add_argument(
        "-q",
        "--quiet",
        action="store_true",
        help="Run test suite with reduced verbosity.",
    )
    args, _unknown = parser.parse_known_args(argv)
    if args.skip_browser:
        SKIP_BROWSER_FLAG = True

    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    runner = unittest.TextTestRunner(verbosity=1 if args.quiet else 2)
    outcome = runner.run(suite)
    return 0 if outcome.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
