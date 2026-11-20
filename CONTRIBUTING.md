# Contributing to CNS5-Audit

Thank you for your interest in contributing to **CNS5-Audit**. We welcome contributions from neuro-oncologists, neuropathologists, neuroradiologists, neuro-AI researchers, biostatisticians, and software engineers who share a commitment to transparent, reproducible, evidence-backed neuro-oncology research tools.

> [!IMPORTANT]
> **Clinical Safety & Privacy Policy:** Never include Protected Health Information (PHI), patient-identifying details, real clinical case numbers, or institutional DICOM metadata in issues, pull requests, commit messages, vignettes, or test fixtures. All examples and test vectors MUST be purely synthetic or derived solely from published consensus criteria.

---

## 1. Non-Negotiable Architectural & Clinical Invariants

Before proposing changes, please review [ARCHITECTURE.md](ARCHITECTURE.md). All contributions must uphold these core invariants:

1. **Zero-Build Static Delivery:** CNS5-Audit runs purely on HTML5, CSS3, and native browser ES Modules (`<script type="module">`). Do **not** introduce Node.js, `npm`, `package.json`, TypeScript compilation, CSS preprocessors, or JavaScript bundlers.
2. **100% Offline & Zero External Runtime Dependencies:** Do **not** add external `http://` or `https://` `<script>`, `<link>`, font, icon, CDN, or analytics references anywhere in `index.html`, `css/`, or `js/`. All charts, gauges, decision traces, and badges must remain pure client-side SVG.
3. **100% Browser-Local Privacy:** Never add outbound network requests (`fetch`, `XMLHttpRequest`, `sendBeacon`, or `WebSocket`) to external origins. Runtime `fetch()` calls are strictly limited to relative local JSON files (`./data/*.json`). Client persistence must stay strictly within `window.localStorage` under the `cns5audit.v1.*` namespace.
4. **Pure Logic Separation:** Core domain engines (`js/cns5Engine.js`, `js/ranoCalculators.js`, `js/auditEngine.js`) MUST maintain **zero DOM or browser global dependencies** (`document.*`, `window.*` are forbidden) so they remain deterministic and independently testable.
5. **WHO CNS5 Terminology Discipline:**
   - Always represent grades with **Arabic numerals** (`1`, `2`, `3`, `4`, formatted as `CNS WHO grade 4`) or `"Not assigned"` (`CNS WHO grade not assigned`). **Never** use Roman numerals (`I`, `II`, `III`, `IV`).
   - Preserve the strict cIMPACT-NOW Update 1 distinction between **NOS** (necessary molecular testing unavailable/unperformed/failed) and **NEC** (necessary molecular testing performed, but integrated profile does not conform to a recognized WHO CNS5 entity).
6. **Evidence-Backed Rules Only:** Every modification to diagnostic logic, clinical thresholds, biomarker pearls, or Neuro-AI audit criteria must cite a peer-reviewed primary consensus source with a verifiable DOI and include matching verification vectors.

---

## 2. Repository Structure & Module Boundaries

| Path | Responsibility | Constraints |
| :--- | :--- | :--- |
| `data/cns5_rules.json` | WHO CNS5 knowledge base (7 families, entities, companion biomarkers, vignettes, citations) | Arabic grades only; valid DOIs; matches `ARCHITECTURE.md` Section 3.2 |
| `js/cns5Engine.js` | Pure deterministic WHO CNS5 integrated classifier & report formatter | Pure ES module; zero DOM/window references |
| `js/ranoCalculators.js` | Pure deterministic RANO 2.0, RANO-BM, and RANO-Resect engines | Pure ES module; strict boundary invariants; zero DOM/window references |
| `data/audit_checklist.json` | 36-item (6 domains x 6 items) CLAIM 2024 + TRIPOD+AI schema & 3 presets | Exact 36-item structure; valid `CLAIM-1..44` & `TRIPOD+AI-1..27` refs |
| `js/auditEngine.js` | Pure weighted scoring, Critical Blocker cap (`<= 45`), MD/LaTeX/SVG/JSON exporters | Pure ES module; full 10-char LaTeX escaping; XML-valid SVG; zero DOM refs |
| `js/visuals.js` | Pure client-side SVG renderers (radar, decision trace, response & resect gauges) | Uses CSS custom properties for instant Dark/Light theme adaptation |
| `js/app.js`, `index.html`, `css/styles.css` | Clinical studio UI, accessibility landmarks, responsive layout, `localStorage` state | Zero CDN/external links; WCAG AA `>= 4.5:1` contrast; persistent disclaimer |
| `tests/verify_rules.py` | Automated verification & contract oracle | Python 3.12 **standard library only** (zero third-party `pip` packages) |
| `.github/workflows/pages.yml` | CI verification gate (push/PR) & static GitHub Pages deployment (`main`) | Deploy job strictly gated on `verify` passing |

---

## 3. Local Development & Verification Workflow

### Prerequisites
- **Python 3.12+** (standard library only; no virtual environment or `pip install` required)
- Any modern desktop or mobile web browser (Chromium, Firefox, Safari, Edge)

### Step-by-Step Setup

1. **Fork and clone** the repository, then create a focused feature branch from `main`:
   ```bash
   git checkout -b feat/short-descriptive-name
   ```

2. **Serve the static site locally** (required so browsers allow native ES Modules and relative `fetch('./data/*.json')` requests):
   ```bash
   python -m http.server 8000
   ```
   Open `http://localhost:8000` in your browser.

3. **Run the automated verification suite** (identical to the CI gate in `.github/workflows/pages.yml`):
   ```bash
   python tests/verify_rules.py
   ```
   All checks must exit with status `0` before opening a pull request.

4. **Manual UI & Export Smoke Checks** (for any UI, visual, or exporter change):
   - Toggle **Light** and **Dark** themes and verify readability/contrast (`>= 4.5:1`) across all cards and SVGs.
   - Verify desktop (`>= 1024px` two-column studio) and narrow mobile (`< 1024px` stacked) layouts.
   - Test copy/download exports: Integrated Pathology Note, RANO Clinical Note, Audit Markdown (`.md`), LaTeX `longtable` (`.tex`), standalone SVG Badge (`.svg`), and JSON Export/Import round-trip.
   - Verify **Reset Local State** cleanly clears `cns5audit.v1.*` keys.

---

## 4. Guidelines for Domain-Specific Contributions

### Updating WHO CNS5 Rules (`data/cns5_rules.json` & `js/cns5Engine.js`)
- Cite WHO CNS5 (Louis et al., *Neuro-Oncology* 2021) or subsequent official cIMPACT-NOW updates / phase 3 practice-changing trials with DOIs in `references`.
- Confirm all missing/omitted input keys safely default to `"not_tested"`, `false`, or `null`.
- Verify `molecularUpgradeTriggered`, `nosNecStatus`, and `decisionPath` nodes remain consistent with `ARCHITECTURE.md` Section 3.3.

### Updating RANO Calculators (`js/ranoCalculators.js`)
- Evaluate all threshold inequalities on exact unrounded floating-point values (`>=` / `<=`); round only display outputs (1 decimal place).
- Preserve all safety invariants:
  - **RANO 2.0:** `<= 12 weeks` post-RT monotonicity (unequivocal clinical deterioration MUST ALWAYS return definite `PD`, never `Prelim-PD`); baseline disease guard (`baselineValue === 0` never returns `CR`); steroid downgrade rules.
  - **RANO-BM:** Both `>= 20%` relative AND `>= 5 mm` absolute increase from nadir required for volumetric/SLD CNS PD; strict separation of CNS and systemic Non-CNS compartments.
  - **RANO-Resect:** Explicit `N/A` guard when `preOpCeVolCm3 === 0`; Class 4 Biopsy (`< 10%` CE reduction or biopsy flag) evaluated *before* residual volume thresholds (`Class 1`..`3B`).

### Updating the Neuro-AI Audit Schema (`data/audit_checklist.json` & `js/auditEngine.js`)
- Maintain valid cross-references to **CLAIM 2024** (`CLAIM-1`..`CLAIM-44`) and **TRIPOD+AI** (`TRIPOD+AI-1`..`TRIPOD+AI-27`).
- Preserve the Critical Blocker score cap (`overallScore <= 45` whenever any `severity === "critical"` item has `status === "fail"`) and verify all 3 built-in presets (`gold_standard`, `slice_leakage_pitfall`, `blank`) satisfy the golden vectors in `ARCHITECTURE.md` Section 8.3.
- Ensure `escapeLatex()` escapes all 10 special TeX characters and `exportAuditBadgeSvg()` produces well-formed XML parsable by Python's `xml.etree.ElementTree.fromstring()`.

---

## 5. Pull Request Checklist

Before submitting a pull request, please confirm:

- [ ] `python tests/verify_rules.py` passes with zero errors locally.
- [ ] No external CDN links, external fonts, analytics, or build tooling were introduced.
- [ ] Pure engine modules (`cns5Engine.js`, `ranoCalculators.js`, `auditEngine.js`) remain free of `document` and `window` calls.
- [ ] All clinical or methodological changes include primary peer-reviewed citations (with DOIs) and updated test vectors.
- [ ] No PHI or patient-identifiable data appears anywhere in code, fixtures, screenshots, or PR descriptions.
- [ ] Relevant documentation (`README.md`, `ARCHITECTURE.md`, or `CITATION.cff`) is updated if public behavior, versions, or contracts changed.

---

## 6. Reporting Bugs, Clinical Discrepancies, or Privacy Issues

- **Clinical or Algorithmic Discrepancies:** Please open a GitHub issue labeled `clinical-accuracy` including: (1) module and exact inputs, (2) observed vs. expected output, and (3) exact primary guideline table/section and DOI supporting the expected behavior.
- **Privacy or Security Concerns:** If you identify any regression that could trigger an unintended external network request, unsafe HTML/SVG injection, or `localStorage` data leak, please report it promptly with reproduction steps so maintainers can remediate it immediately.

---

## 7. Code of Conduct & License

CNS5-Audit adheres to collaborative, constructive, evidence-based scientific discourse. Treat all contributors and reviewers with respect, and ground methodological disagreements in published primary literature and reproducible evidence.

By submitting a contribution to CNS5-Audit, you agree that your work will be licensed under the repository's [MIT License](LICENSE).
