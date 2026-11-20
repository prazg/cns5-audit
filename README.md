# CNS5-Audit

**Integrated WHO CNS5 (2021) Molecular-Histological Tumor Classification, Multi-Standard RANO Clinical Calculators & Neuro-AI Data-Leakage Auditing Suite**

`v1.0.0` · `Zero-Build Static ES Modules` · `100% Browser-Local (Zero Upload)` · `Python 3.12 CI-Verified` · `MIT License`

> [!CAUTION]
> **For Research & Educational Use Only — Not a Certified Medical Device (Non-SaMD).**
> CNS5-Audit is an open-science clinical research, education, and peer-review decision-support toolkit. It is **not** cleared, approved, or certified by the FDA, EMA, CE-MDR, UKCA, or any other regulatory authority for clinical diagnosis, prognosis, or treatment selection, and must never replace board-certified neuropathology, neuroradiology, or multidisciplinary tumor-board judgment. **Do not enter Protected Health Information (PHI)** or patient-identifying identifiers.

---

## Overview

Modern neuro-oncology research and neuroimaging AI peer review span three tightly coupled yet routinely fragmented workflows:

1. **Integrated Molecular-Histological Diagnosis** under the **WHO CNS5 (2021)** framework (replacing legacy histology-only labels and Roman-numeral grades with Arabic-numeral integrated diagnoses and molecular grade upgrades).
2. **Standardized Response & Surgical Extent-of-Resection Assessment** across **RANO 2.0** (adult high- and low-grade gliomas), **RANO-BM** (brain metastases), and **RANO-Resect** (volumetric extent of resection in glioblastoma).
3. **Methodological & Data-Leakage Auditing** of neuro-AI, radiomics, and foundation-model manuscripts mapped explicitly to **CLAIM 2024** and **TRIPOD+AI**.

**CNS5-Audit** unifies all three workflows in a single, zero-build static web application designed for seamless open-access deployment on GitHub Pages and offline workstation use:

- **Zero-Build Static Architecture:** Pure HTML5, CSS3, and native browser ES Modules (`<script type="module">`) — no Node.js, npm, TypeScript transpilation, or bundler required.
- **100% Offline & Zero External Runtime Dependencies:** No third-party CDNs, external web fonts, icon packs, or analytics beacons. All radar charts, decision-trace diagrams, response gauges, and rigor badges are rendered as pure client-side SVG.
- **Zero-Upload Browser-Local Privacy:** All clinical classification, volumetric math, scoring, and document export execute strictly inside your browser with zero server transmission.
- **Deterministic Pure-Logic Core & Automated CI:** Core engines (`js/cns5Engine.js`, `js/ranoCalculators.js`, `js/auditEngine.js`) have zero DOM dependencies and are validated on every push and pull request by a Python 3.12 standard-library verification suite (`tests/verify_rules.py`).

---

## Module 1: WHO CNS5 (2021) Integrated Classifier

*Primary Reference: Louis et al., Neuro-Oncology 2021 (`doi:10.1093/neuonc/noab106`)*

A deterministic, transparent molecular-histological classifier covering **6 major WHO CNS5 clinical categories** exposed across **7 explicit taxonomic families** and **24+ curated entities**, accompanied by **8+ built-in clinical teaching vignettes**:

| Family Key | Clinical Category | Key Integrated Entities & Molecular Hallmarks |
| :--- | :--- | :--- |
| `adult_diffuse_glioma` | Adult-Type Diffuse Gliomas | *Glioblastoma, IDH-wildtype* (including molecular GBM via *TERT*p / *EGFR* amp / `+7/-10`), *Astrocytoma, IDH-mutant* (Grades 2–4; *CDKN2A/B* homdel -> Grade 4), *Oligodendroglioma, IDH-mutant and 1p/19q-codeleted* (Grades 2–3) |
| `pediatric_hgg` | Pediatric-Type Diffuse High-Grade Gliomas | *Diffuse midline glioma, H3 K27-altered* (Grade 4 regardless of histology), *Diffuse hemispheric glioma, H3 G34-mutant*, *Diffuse pediatric-type HGG, H3-wt & IDH-wt*, *Infant-type hemispheric glioma* (NTRK/ROS1/ALK/MET RTK fusions) |
| `pediatric_lgg` | Pediatric-Type Diffuse Low-Grade Gliomas | *Angiocentric glioma*, *Diffuse astrocytoma, MYB- or MYBL1-altered*, *PLNTY*, *Diffuse low-grade glioma, MAPK pathway-altered* |
| `circumscribed_astrocytic` | Circumscribed Astrocytic Gliomas | *Pilocytic astrocytoma*, *High-grade astrocytoma with piloid features (HGAP)*, *Pleomorphic xanthoastrocytoma* (Grades 2–3), *SEGA*, *Chordoid glioma*, *Astroblastoma, MN1-altered* |
| `ependymal_tumor` | Ependymal Tumors | *Subependymoma* (Grade 1), *Myxopapillary ependymoma* (**upgraded to Grade 2** in CNS5), *Supratentorial ZFTA/YAP1 fusion-positive*, *Posterior fossa PFA/PFB*, *Spinal ependymoma, MYCN-amplified* |
| `meningioma` | Meningiomas | *Meningioma* (Grades 1–3; **molecular Grade 3 upgrade** via *TERT*p mutation or *CDKN2A/B* homozygous deletion; rhabdoid & papillary subtypes no longer automatic Grade 3) |
| `medulloblastoma` | Embryonal Tumors: Medulloblastomas | *WNT-activated*, *SHH-activated & TP53-wildtype*, *SHH-activated & TP53-mutant*, *Non-WNT/non-SHH* (Group 3 / Group 4) |

### Key Clinical Safeguards & Outputs
- **Mandatory Arabic-Numeral Grading:** Enforces `CNS WHO grade 1`–`4` or `CNS WHO grade not assigned` throughout rules, UI, and notes — never legacy Roman numerals (`I`–`IV`).
- **Explicit Molecular Upgrade Flagging:** Highlights every instance where a molecular hallmark elevates grade or risk beyond histological appearance (e.g., histologically low-grade IDH-wildtype diffuse glioma upgraded to Grade 4 GBM via *TERT* promoter mutation; histologically Grade 1 meningioma upgraded to Grade 3 via *CDKN2A/B* homozygous deletion).
- **Strict NOS vs. NEC Separation (cIMPACT-NOW Update 1):** Distinguishes **NOS** (*Not Otherwise Specified*: required molecular testing unavailable/unperformed/failed -> triggers reflex-testing guidance) from **NEC** (*Not Elsewhere Classified*: required molecular testing completed but discordant/unclassifiable -> triggers orthogonal confirmation & DNA methylation profiling guidance).
- **Companion Biomarker & Therapeutic Pearls:** Context-sensitive research pearls for *MGMT* promoter methylation, vorasidenib (INDIGO trial, Grade 2 IDH-mutant glioma), BRAF/MEK/pan-RAF inhibitors in pediatric LGG, actionable RTK fusions in infant-type hemispheric glioma, everolimus in SEGA, ONC201/dordaviprone pathways in DMG H3 K27-altered, and germline *TP53* / Li-Fraumeni genetic counseling in SHH *TP53*-mutant medulloblastoma.
- **Interactive SVG Decision Trace & Note Export:** Renders a step-by-step flowchart of every biomarker gate (`js/visuals.js -> renderDecisionTrace`) with one-click **Copy Integrated Pathology Note**.

---

## Module 2: Multi-Standard Clinical Calculators (RANO 2.0, RANO-BM, RANO-Resect)

Pure, deterministic volumetric and response calculators with strict input validation, exact unrounded threshold evaluation, interactive pure-SVG gauges (`renderResponseGauge`, `renderResectGauge`), and one-click structured tumor-board / research summary export (`formatClinicalSummary`).

| Standard | Primary Reference | Scope & Measurement Mode | Key Response / Class Thresholds | Built-In Clinical & Mathematical Guards |
| :--- | :--- | :--- | :--- | :--- |
| **RANO 2.0** | Wen et al., *JCO* 2023 (`doi:10.1200/JCO.23.01059`) | Adult Enhancing HGG & Non-Enhancing LGG; **2D SPD (`mm²`)** or **3D Volume (`cm³`)** | **2D SPD:** `PR <= -50%`, `MR -25% to -50%` *(LGG only)*, `PD >= +25%` from nadir.<br>**3D Vol:** `PR <= -65%`, `MR -40% to -65%` *(LGG only)*, `PD >= +40%` from nadir. | **Strict `<= 12 wks` Post-RT Monotonicity:** Unequivocal clinical deterioration is *always* definite `PD` (never downgraded to `Prelim-PD`); radiographic-only in-field progression `<= 12 wks` triggers `Prelim-PD` (`>= 4 wks` confirmation). **Baseline Guard:** `baseline = 0` yields `Non-PD`/`SD`, never `CR`. **Steroid Downgrades:** Stable/decreased steroids downgrade radiographic CR -> PR; increased steroids downgrade CR/PR/MR -> SD. |
| **RANO-BM** | Lin et al., *Lancet Oncology* 2015 (`doi:10.1016/S1470-2045(15)70057-4`) | Brain metastases; up to **5 measurable target CNS lesions** (`>= 10 mm` longest diameter; SLD in `mm`) | **CNS CR:** `0 mm`, no non-target/new lesions, none/physiologic steroids.<br>**CNS PR:** `<= -30%` vs. baseline.<br>**CNS PD:** **`>= +20%` AND `>= +5 mm`** from nadir, new CNS lesion, non-target PD, or neurologic worsening. | **Dual PD Requirement:** Prevents small absolute changes (e.g., `15 mm -> 19 mm`, `+26.7%` but `+4 mm < 5 mm`) from falsely triggering `PD`. **Bicompartmental Separation:** CNS response and systemic Non-CNS (RECIST 1.1) status remain strictly separate with automatic `compartmentDiscordance` alerting. **Prior SRS (`<= 6 mos`):** Flags radiation necrosis / pseudoprogression caution. |
| **RANO-Resect** | Karschnia et al., *Neuro-Oncology* 2023 (`doi:10.1093/neuonc/noac193`) | Newly diagnosed contrast-enhancing (CE) glioblastoma extent of resection (`cm³`) | **Class 1 (Supramaximal):** `0 cm³` CE & `<= 5 cm³` non-CE.<br>**Class 2A (Complete):** `0 cm³` CE.<br>**Class 2B (Near-Total):** `<= 1 cm³` CE.<br>**Class 3A (Subtotal):** `<= 5 cm³` CE.<br>**Class 3B (Partial):** `> 5 cm³` CE.<br>**Class 4 (Biopsy):** Biopsy procedure or no CE volume reduction (plus operational `< 10%` guard for small `<= 5 cm³` lesions). | **Explicit `N/A` Guard:** `preOpCeVolCm3 = 0` returns `N/A` (directing users to non-enhancing glioma frameworks). **Class 4 Precedence:** Explicit biopsy, `<= 0%` reduction, and small-lesion (`<= 5 cm³` residual, `< 10%` reduction) cases map to Class 4 while large partial debulkings (`> 5 cm³` residual with positive reduction) map to Class 3B. **Post-Op MRI Timing QA:** Warns if scan acquired `> 72 hours` post-op. |

---

## Module 3: Neuro-AI Leakage & Reporting Auditor (CLAIM 2024 + TRIPOD+AI)

*Primary References: Tejani et al., Radiology: AI 2024 (`doi:10.1148/ryai.240300`); Collins et al., BMJ 2024 (`doi:10.1136/bmj-2023-078378`)*

A structured **36-item peer-review and self-audit studio** engineered specifically for neuroimaging machine learning, radiomics, survival modeling, and medical foundation-model studies. Every item cross-references exact **CLAIM 2024** (`CLAIM-1`..`44`) and **TRIPOD+AI** (`TRIPOD+AI-1`..`27`) checklist items alongside neuro-imaging-specific failure modes and actionable remediations.

### 6 Audit Domains (6 Items per Domain = 36 Total)

| Domain ID | Domain Title | Item IDs | Critical Blocker Items (`severity: critical`, weight `3`) |
| :--- | :--- | :--- | :--- |
| `cohort_splitting` | **Cohort & Splitting** | `CS-01`..`CS-06` | `CS-01` Patient-level split (zero 2D slice/patch leakage); `CS-02` Longitudinal/multi-scan patient grouping; `CS-03` Locked held-out test set / nested CV |
| `mri_preprocessing` | **MRI Preprocessing & Harmonization** | `MP-01`..`MP-06` | `MP-01` Train-only intensity normalization, scaling & ComBat fitting (zero transductive test leakage) |
| `radiomics_fm_hygiene` | **Radiomics & Foundation-Model Hygiene** | `RF-01`..`RF-06` | `RF-01` In-fold feature selection, PCA/LASSO & SMOTE; `RF-04` Pretrained backbone / foundation-model benchmark contamination audit (BraTS/TCGA/UPenn-GBM/UCSF-PDGM); `RF-05` Hyperparameter tuning & checkpoint isolation |
| `multisite_shortcuts` | **Multi-Site & Shortcut Generalization** | `MS-01`..`MS-06` | `MS-01` True external multi-institutional or temporal validation cohort; `MS-02` Scanner, vendor & hospital-site shortcut audit |
| `clinical_calibration` | **Clinical Calibration & Reference Standards** | `CC-01`..`CC-06` | `CC-01` WHO CNS5 (2021) integrated molecular reference standard alignment; `CC-06` Immortal-time bias & future-treatment leakage guard (landmarking) |
| `open_science_repro` | **Open Science & Reproducibility** | `OS-01`..`OS-06` | *(0 critical blockers; 4 `major` + 2 `recommended` — prevents open-science gaps from being conflated with data leakage)* |

### Weighted Scoring & Automated Critical Blocker Cap
- **Item Weights:** `critical = 3` (11 items), `major = 2` (17 items), `recommended = 1` (8 items).
- **Status Multipliers:** `pass = 1.0`, `partial = 0.5`, `fail = 0.0`, `unanswered = 0.0`; `na` items are excluded from both numerator and denominator.
- **Critical Blocker Score Cap (`<= 45/100`):** If **any** of the 11 Critical Blocker items is marked `fail`, the overall rigor score is automatically capped at `Math.min(rawOverallScore, 45)` and `leakageRiskLevel` is set to **`Critical Blocker`**. This prevents high documentation or open-science scores from masking fatal data leakage or invalid reference labels.
- **Risk Tier Logic:** `Not Assessed` (0 answered) -> `Critical Blocker` (`>= 1` critical failure) -> `High` (`>= 1` critical partial, `>= 1` unanswered applicable critical blocker, or score `< 60`) -> `Moderate` (`60 <= score < 80`) -> `Low` (`score >= 80` with zero critical failures, partials, or unanswered applicable critical blockers).

### Built-In Audit Presets & Publication-Ready Exports
- **3 Curated Presets:** `gold_standard` (multi-center external validation WHO CNS5 radiogenomics study; score `>= 90`, `Low` risk), `slice_leakage_pitfall` (classic single-center 2D slice-split + pre-split SMOTE pitfall demonstrating the Critical Blocker cap clamping `rawOverallScore > 45` down to `45`), and `blank`.
- **Visuals & Exporters:**
  - **6-Axis Hexagonal SVG Radar Chart** (`renderRadarChart`) with concentric reference rings and crimson double-ring blocker halos on any compromised domain axis.
  - **Markdown Supplement** (`.md`) — GitHub-Flavored Markdown report with study metadata, Critical Blocker alert table, domain summary, and complete 36-item audit table.
  - **LaTeX Manuscript Supplement** (`.tex`) — Compile-ready `longtable` (`booktabs` style) with complete 10-character TeX escaping (`\`, `&`, `%`, `$`, `#`, `_`, `{`, `}`, `~`, `^`).
  - **Standalone SVG Rigor Badge** (`.svg`) — XML-valid, self-contained `420x36` badge displaying rigor score, risk tier, and blocker count for repositories or graphical abstracts.
  - **Validated JSON State Round-Trip** (`.json`) — Save and reload complete peer-review audits locally with schema validation (`validateImportedAuditJson`).

---

## Zero-Upload Browser-Local Privacy & Security

CNS5-Audit is engineered from first principles for privacy-conscious clinical research environments:

| Guarantee | Implementation |
| :--- | :--- |
| **Zero Server Uploads** | Static files only; no backend API, database, or server-side execution. |
| **Zero External Network Calls** | Runtime `fetch()` is restricted exclusively to local relative JSON knowledge bases (`./data/cns5_rules.json`, `./data/audit_checklist.json`). Automated CI enforces zero `http://` or `https://` `<script>`/`<link>` tags. |
| **Zero Tracking or Telemetry** | No cookies, analytics scripts, error-reporting beacons, or third-party fonts. |
| **Transparent Local Persistence** | Draft inputs, theme selection (`light`/`dark`), and in-progress audits persist strictly in your browser's `window.localStorage` under `cns5audit.v1.*` and can be wiped immediately via the header **Reset Local State** button. |
| **No PHI Policy** | Users should enter only de-identified research parameters, synthetic teaching cases, or manuscript-level metadata — never patient names, MRNs, dates of birth, or other PHI. |

---

## Quick Start

### Option 1: Open Live on GitHub Pages
Visit the repository's deployed **GitHub Pages** site in any modern browser (Chromium, Firefox, Safari, or Edge). No installation, login, or build step is needed.

### Option 2: Run Locally (Zero Build Step)
Because modern browsers block native ES Modules (`<script type="module">`) and relative `fetch('./data/*.json')` requests over the `file://` protocol, serve the repository with any lightweight local HTTP server (such as Python's built-in module):

```bash
git clone https://github.com/<your-org-or-user>/cns5-audit.git
cd cns5-audit
python -m http.server 8000
```

Then open **http://localhost:8000** in your browser. *(If `index.html` is opened directly via `file://`, the app automatically displays a helpful inline notice with this exact command.)*

### Option 3: Run Automated Verification Locally
Validate all clinical rule schemas, Arabic-grade compliance, 36-item CLAIM 2024 / TRIPOD+AI mappings, Python scoring oracle parity, ES module export/import contracts, pure-logic DOM isolation, and zero-CDN offline hygiene using **Python 3.12 standard library only** (zero `pip install` required):

```bash
python tests/verify_rules.py
# Or skip headless browser fallback in restricted/sandboxed environments:
python tests/verify_rules.py --skip-browser
# (or set environment variable CNS5_SKIP_BROWSER=1)
```

---

## Repository Structure & CI/CD

```text
cns5-audit/
├── .github/
│   └── workflows/
│       └── pages.yml             # CI verification gate (push/PR) + GitHub Pages deploy (main)
├── ARCHITECTURE.md               # Authoritative technical & clinical engineering contract
├── CITATION.cff                  # Machine-readable software citation metadata (CFF 1.2.0)
├── CONTRIBUTING.md               # Clinical, architectural & open-science contribution guide
├── LICENSE                       # MIT License (2026)
├── README.md                     # Documentation & primary literature reference guide
├── .gitignore                    # Python, staging, editor & OS ignore hygiene
├── index.html                    # Semantic HTML5 shell, accessibility landmarks & persistent disclaimer
├── css/
│   └── styles.css                # Clinical studio theme (Light/Dark, WCAG AA, tabular numerals)
├── data/
│   ├── cns5_rules.json           # WHO CNS5 knowledge base (7 families, 24+ entities, 8+ vignettes)
│   └── audit_checklist.json      # 36-item CLAIM 2024 + TRIPOD+AI schema & 3 built-in presets
├── js/
│   ├── cns5Engine.js             # Pure deterministic WHO CNS5 integrated classifier
│   ├── ranoCalculators.js        # Pure deterministic RANO 2.0, RANO-BM & RANO-Resect calculators
│   ├── auditEngine.js            # Pure scoring, Critical Blocker cap & MD/LaTeX/SVG/JSON exporters
│   ├── visuals.js                # Pure client-side SVG radar, decision trace & clinical gauges
│   └── app.js                    # Studio UI orchestration, localStorage state & export handlers
└── tests/
    └── verify_rules.py           # Python 3.12 stdlib verification & golden-vector contract suite
```

### Automated Verification & GitHub Pages Deployment
The workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml) enforces open-science quality automatically:
1. **`verify` job (every `push` and `pull_request` to `main`):** Checks out the repository on `ubuntu-latest`, provisions Python 3.12, and executes `python tests/verify_rules.py`. Any schema regression, external CDN leak, DOM reference inside a pure engine, or scoring mismatch fails the build.
2. **`deploy` job (`main` pushes & manual `workflow_dispatch` only, gated on `needs: verify`):** Stages the clean zero-build static assets (`index.html`, `css/`, `js/`, `data/`, `.nojekyll`) and deploys directly to GitHub Pages via official `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages`.

---

## Primary Literature References

All clinical classification rules, volumetric response criteria, and neuro-AI reporting audit mappings are grounded directly in the following primary consensus publications:

1. **WHO CNS5 (2021):** Louis DN, Perry A, Wesseling P, Brat DJ, Cree IA, Figarella-Branger D, Hawkins C, Ng HK, Pfister SM, Reifenberger G, Soffietti R, von Deimling A, Ellison DW. *The 2021 WHO Classification of Tumors of the Central Nervous System: a summary.* **Neuro-Oncology**. 2021;23(8):1231–1251. doi:[10.1093/neuonc/noab106](https://doi.org/10.1093/neuonc/noab106)
2. **RANO 2.0 (2023):** Wen PY, van den Bent M, Youssef G, et al. *RANO 2.0: Update to the Response Assessment in Neuro-Oncology Criteria for High- and Low-Grade Gliomas in Adults.* **Journal of Clinical Oncology**. 2023;41(33):5187–5199. doi:[10.1200/JCO.23.01059](https://doi.org/10.1200/JCO.23.01059)
3. **RANO-BM (2015):** Lin NU, Lee EQ, Aoyama H, et al. *Response assessment criteria for brain metastases: proposal from the RANO group.* **The Lancet Oncology**. 2015;16(6):e270–e278. doi:[10.1016/S1470-2045(15)70057-4](https://doi.org/10.1016/S1470-2045(15)70057-4)
4. **RANO-Resect (2023):** Karschnia P, Young JS, Dono A, et al. *Prognostic validation of a new classification system for extent of resection in glioblastoma: a report of the RANO resect group.* **Neuro-Oncology**. 2023;25(5):940–954. doi:[10.1093/neuonc/noac193](https://doi.org/10.1093/neuonc/noac193)
5. **CLAIM 2024:** Tejani AS, Klontzas ME, Gatti AA, Kahn CE Jr, Mongan J, et al. *Checklist for Artificial Intelligence in Medical Imaging (CLAIM): 2024 Update.* **Radiology: Artificial Intelligence**. 2024;6(4):e240300. doi:[10.1148/ryai.240300](https://doi.org/10.1148/ryai.240300)
6. **TRIPOD+AI (2024):** Collins GS, Moons KGM, Dhiman P, et al. *TRIPOD+AI statement: updated guidance for reporting clinical prediction models that use regression or machine learning methods.* **BMJ**. 2024;385:e078378. doi:[10.1136/bmj-2023-078378](https://doi.org/10.1136/bmj-2023-078378)

*Additional companion citations (including cIMPACT-NOW Updates 1–7, the INDIGO vorasidenib phase 3 trial, and entity-specific molecular consensus guidelines) are indexed inside `data/cns5_rules.json` and surfaced inline within each diagnostic trace.*

---

## Citation, Contributing & License

- **Cite CNS5-Audit:** Use GitHub's **"Cite this repository"** menu or see [`CITATION.cff`](CITATION.cff) (Citation File Format 1.2.0).
- **Contribute:** See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md) for clinical evidence standards, pure-logic contracts, and pull request verification steps.
- **License:** Released under the [MIT License](LICENSE) (Copyright (c) 2026 CNS5-Audit Contributors).

---

<!-- PRAZG_SUITE_README_START -->
## Open Neuro & Pathology AI Suite

Part of the open-access neurosurgery, neuroimaging, neuro-oncology, and computational pathology web suite by [@prazg](https://github.com/prazg):

| Tool | Live App | Repository | Focus |
|---|---|---|---|
| **NeuroScope-RANO** | [Open App](https://prazg.github.io/neuroscope-rano/) | [`prazg/neuroscope-rano`](https://github.com/prazg/neuroscope-rano) | Zero-upload NIfTI MRI volumetrics, RANO 2.0, RANO-Resect (EOR) & AI segmentation QA |
| **OpenNeuroAtlas** | [Open App](https://prazg.github.io/openneuroatlas/) | [`prazg/openneuroatlas`](https://github.com/prazg/openneuroatlas) | Living registry of 44 open neurosurgery & neuroimaging datasets, foundation models & MICCAI benchmarks |
| **CNS5-Audit** *(this repo)* | [Open App](https://prazg.github.io/cns5-audit/) | [`prazg/cns5-audit`](https://github.com/prazg/cns5-audit) | WHO CNS5 (2021) classifier, RANO 2.0 / RANO-BM / RANO-Resect calculators & CLAIM/TRIPOD+AI leakage auditor |
| **NeuroCorridor-3D** | [Open App](https://prazg.github.io/neurocorridor-3d/) | [`prazg/neurocorridor-3d`](https://github.com/prazg/neurocorridor-3d) | Interactive 3D MNI-152 eloquent neuroanatomy, white-matter tractography & surgical corridor sandbox |
| **3D Neurosurgical Atlas** | [Open App](https://prazg.github.io/3D_Neurosurgical_Atlas/) | [`prazg/3D_Neurosurgical_Atlas`](https://github.com/prazg/3D_Neurosurgical_Atlas) | Interactive browser-based 3D atlas of craniospinal anatomy, 76 walkthroughs & neuro-oncological pathology |
| **Brain Trials Finder** | [Open App](https://prazg.github.io/brain_trials_finder/) | [`prazg/brain_trials_finder`](https://github.com/prazg/brain_trials_finder) | Discovers actively recruiting neuro-oncology clinical trials across ClinicalTrials.gov, ISRCTN, EU CTIS & WHO ICTRP |
| **Brain Radiology FM** | [Open App](https://prazg.github.io/Brain_Radiology_FM_Portal/) | [`prazg/Brain_Radiology_FM_Portal`](https://github.com/prazg/Brain_Radiology_FM_Portal) | Interactive PACS portal & GPU runner for 28 open-weight 3D Brain MRI, Head CT & fMRI foundation models |
| **Histology FM** | [Open App](https://prazg.github.io/Histology_FM_Portal/) | [`prazg/Histology_FM_Portal`](https://github.com/prazg/Histology_FM_Portal) | Graphical frontend & GPU runner for 55 open-weight clinical & preclinical histology foundation models |
| **Animal Pathology FM** | [Open App](https://prazg.github.io/Animal_Pathology_FM_Portal/) | [`prazg/Animal_Pathology_FM_Portal`](https://github.com/prazg/Animal_Pathology_FM_Portal) | Frontend & local runner for open-weight preclinical, rodent & veterinary pathology foundation models |
| **Remote DICOM Viewer** | [Open App](https://prazg.github.io/Remote_Dicom_Viewer/) | [`prazg/Remote_Dicom_Viewer`](https://github.com/prazg/Remote_Dicom_Viewer) | Secure browser-based DICOM viewer for sending scans for remote radiological reporting |

<!-- PRAZG_SUITE_README_END -->
