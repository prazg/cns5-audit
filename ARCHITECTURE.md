# CNS5-Audit — Technical & Clinical Architecture Specification

> **Status:** Authoritative Engineering Contract (v1.0.0)  
> **Scope:** Zero-build, 100% browser-local, open-access GitHub Pages clinical research & neuro-AI peer-review web suite  
> **Regulatory Notice:** *For Research & Educational Use Only — Not a Certified Medical Device (Non-SaMD). No Protected Health Information (PHI) upload or server transmission.*

---

## 1. System Overview & Constraints

**CNS5-Audit** unites three neuro-oncology research workflows inside a single zero-build static web application:

1. **WHO CNS5 (2021) Integrated Molecular-Histological Tumor Classifier** (Louis et al., *Neuro-Oncology* 2021)
2. **Multi-Standard Clinical Calculators** — **RANO 2.0** (Wen et al., *JCO* 2023), **RANO-BM** (Lin et al., *Lancet Oncol* 2015), and **RANO-Resect** (Karschnia et al., *Neuro-Oncology* 2023)
3. **Neuro-AI Leakage & Reporting Auditor** — 36 curated methodological & data-leakage audit items mapped explicitly to **CLAIM 2024** (Tejani et al., *Radiology: AI* 2024) and **TRIPOD+AI** (Collins et al., *BMJ* 2024)

### Hard Architectural Constraints
- **Zero-Build Static Delivery:** Pure HTML5, CSS3, and native ES Modules (`<script type="module">`). **No** Node.js, npm, TypeScript compilation, Tailwind build step, or JavaScript bundler.
- **100% Offline & Zero External Runtime Dependencies:** No external CDN scripts, stylesheets, web fonts, or analytics beacons. All charts and badges are pure client-side SVG; typography uses a calibrated clinical system font stack.
- **100% Browser-Local Privacy:** No `fetch()` calls to external origins. Only relative `fetch('./data/*.json')` requests for local static knowledge bases. User state persists exclusively in `window.localStorage` under namespaced keys (`cns5audit.v1.*`).
- **Automated Verification & CI:** Python 3.12 **standard library only** (`tests/verify_rules.py`) executed via GitHub Actions (`.github/workflows/ci.yml`).
- **Pure Logic Modules:** `js/cns5Engine.js`, `js/ranoCalculators.js`, and `js/auditEngine.js` MUST have **zero DOM (`document`/`window`) dependencies** so they remain pure, deterministic, and independently testable.

---

## 2. Repository Layout & Parallel Engineer Ownership Contract

Four parallel engineers own **strictly disjoint files**. No engineer may edit files outside their assigned slice. Cross-module integration relies strictly on the exported function signatures and JSON schemas defined in Sections 3–7.

```text
cns5-audit/
├── ARCHITECTURE.md               # This specification (read-only contract)
├── index.html                    # [Engineer 4] Semantic HTML5 shell & accessibility landmarks
├── css/
│   └── styles.css                # [Engineer 4] Clinical studio theme (Light/Dark), responsive layout
├── data/
│   ├── cns5_rules.json           # [Engineer 1] WHO CNS5 knowledge base, biomarkers, vignettes, citations
│   └── audit_checklist.json      # [Engineer 3] 36-item Neuro-AI audit schema + 3 built-in presets
├── js/
│   ├── cns5Engine.js             # [Engineer 1] Pure deterministic WHO CNS5 integrated classifier
│   ├── ranoCalculators.js        # [Engineer 2] Pure deterministic RANO 2.0, RANO-BM, RANO-Resect engines
│   ├── auditEngine.js            # [Engineer 3] Pure scoring, blocker cap, MD/LaTeX/SVG/JSON exporters
│   ├── visuals.js                # [Engineer 4] Pure SVG radar chart, decision trace, response/resect gauges
│   └── app.js                    # [Engineer 4] UI orchestration, DOM wiring, localStorage, copy/download
├── tests/
│   └── verify_rules.py           # [QA / CI] Python 3.12 stdlib verification & contract validator
└── .github/
    └── workflows/
        └── ci.yml                # [QA / CI] Automated Python 3.12 verification + GitHub Pages deploy
```

### Ownership & Dependency DAG

| Engineer | Owned Files | Imports Allowed | Must Never Touch |
| :--- | :--- | :--- | :--- |
| **Engineer 1** | `data/cns5_rules.json`, `js/cns5Engine.js` | None (pure JS) | `ranoCalculators.js`, `audit*`, `visuals.js`, `app.js`, `index.html`, `styles.css` |
| **Engineer 2** | `js/ranoCalculators.js` | None (pure JS) | `cns5*`, `audit*`, `visuals.js`, `app.js`, `index.html`, `styles.css` |
| **Engineer 3** | `data/audit_checklist.json`, `js/auditEngine.js` | None (pure JS) | `cns5*`, `ranoCalculators.js`, `visuals.js`, `app.js`, `index.html`, `styles.css` |
| **Engineer 4** | `js/visuals.js`, `js/app.js`, `index.html`, `css/styles.css` | `./cns5Engine.js`, `./ranoCalculators.js`, `./auditEngine.js`, `./visuals.js` | `data/*.json`, engine files |

---

## 3. Module 1: WHO CNS5 (2021) Integrated Classifier (`data/cns5_rules.json` & `js/cns5Engine.js`)

### 3.1 Clinical Taxonomy & Grading Principles
- **Primary Reference:** Louis DN, Perry A, Wesseling P, et al. *The 2021 WHO Classification of Tumors of the Central Nervous System: a summary.* **Neuro-Oncology**. 2021;23(8):1231–1251. `doi:10.1093/neuonc/noab106`.
- **Arabic Numerals Mandatory:** All CNS WHO grades MUST use **Arabic numerals** (`1`, `2`, `3`, `4`) or `"Not assigned"` — **never** Roman numerals (`I`, `II`, `III`, `IV`). Format display text as `"CNS WHO grade 4"` or `"CNS WHO grade not assigned"`.
- **Taxonomy Organization:** Covers all **6 major WHO CNS5 clinical categories** exposed as **7 explicit `family` keys** (splitting Pediatric-type diffuse gliomas cleanly into High-Grade and Low-Grade):
  1. `adult_diffuse_glioma` — Adult-type diffuse gliomas
  2. `pediatric_hgg` — Pediatric-type diffuse high-grade gliomas
  3. `pediatric_lgg` — Pediatric-type diffuse low-grade gliomas
  4. `circumscribed_astrocytic` — Circumscribed astrocytic gliomas
  5. `ependymal_tumor` — Ependymal tumors
  6. `meningioma` — Meningiomas
  7. `medulloblastoma` — Embryonal tumors: Medulloblastomas
- **NOS vs. NEC Distinction (cIMPACT-NOW Update 1 & WHO CNS5):**
  - **NOS (Not Otherwise Specified):** Diagnostic molecular information *necessary* to assign a specific WHO CNS5 entity is **unavailable** (`"not_tested"`, failed assay, insufficient tissue).
  - **NEC (Not Elsewhere Classified):** Necessary diagnostic molecular and histological testing **was completed**, yet the integrated profile is discordant or does not match any recognized WHO CNS5 entity.

### 3.2 JSON Schema: `data/cns5_rules.json`

```json
{
  "schemaVersion": "1.0.0",
  "standard": "WHO Classification of Tumours of the Central Nervous System, 5th Edition (CNS5, 2021)",
  "nosNecGuidance": {
    "NOS": {
      "label": "Not Otherwise Specified (NOS)",
      "definition": "Indicates that diagnostic information (typically molecular testing) required to assign a specific WHO CNS5 entity is unavailable, not performed, or failed technically.",
      "action": "Recommend reflex molecular testing (IDH1/2 sequencing, 1p/19q FISH/NGS, CDKN2A/B, H3/MAPK/fusion panel, or DNA methylation profiling)."
    },
    "NEC": {
      "label": "Not Elsewhere Classified (NEC)",
      "definition": "Indicates that required diagnostic testing was successfully performed, but the integrated histological-molecular results do not conform to any recognized WHO CNS5 diagnosis.",
      "action": "Perform orthogonal confirmation (e.g., whole-arm vs. partial 1p/19q, genome-wide DNA methylation classifier) and discuss at multidisciplinary neuro-oncology tumor board."
    }
  },
  "families": [
    {
      "id": "adult_diffuse_glioma",
      "categoryGroup": "Adult-type diffuse gliomas",
      "label": "Adult-Type Diffuse Gliomas",
      "shortLabel": "Adult Diffuse",
      "description": "IDH-mutant astrocytoma, IDH-mutant & 1p/19q-codeleted oligodendroglioma, and IDH-wildtype glioblastoma (including molecular GBM).",
      "entities": [
        {
          "id": "gbm_idh_wt",
          "name": "Glioblastoma, IDH-wildtype",
          "gradesAllowed": [4],
          "molecularHallmarks": ["IDH-wildtype", "H3-wildtype", "TERT promoter mutation", "EGFR amplification", "+7/-10 chromosome copy-number change"],
          "histologicHallmarks": ["Microvascular proliferation", "Necrosis"],
          "companionNotes": [
            "MGMT promoter methylation predicts benefit from temozolomide alkylating chemotherapy (Stupp/Hegi).",
            "In patients <55 years with IDH1 R132H-negative IHC, IDH1/IDH2 sequencing and H3 K27/G34 exclusion are recommended."
          ],
          "referenceIds": ["louis2021", "brat2018_cimpact3", "stupp2005"]
        }
      ]
    }
  ],
  "companionBiomarkers": {
    "mgmt_methylated": {
      "name": "MGMT Promoter Methylation",
      "summary": "Associated with improved overall survival and greater benefit from temozolomide in Glioblastoma, IDH-wildtype."
    },
    "vorasidenib_idh_grade2": {
      "name": "Vorasidenib (Dual IDH1/2 Inhibitor)",
      "summary": "INDIGO phase 3 trial (Mellinghoff et al., NEJM 2023) demonstrated significantly prolonged PFS and time to next intervention in residual/recurrent CNS WHO grade 2 IDH-mutant glioma."
    },
    "braf_mek_pediatric_lgg": {
      "name": "BRAF / MEK / Pan-RAF Targeted Therapy",
      "summary": "Dabrafenib + trametinib is FDA-approved for BRAF V600E-mutant pediatric LGG; tovorafenib (type II pan-RAF inhibitor) is active across BRAF fusions (KIAA1549::BRAF) and V600E."
    },
    "rtk_fusion_infant": {
      "name": "Actionable RTK Fusions (NTRK/ROS1/ALK/MET)",
      "summary": "Infant-type hemispheric gliomas frequently harbor targetable receptor tyrosine kinase fusions (e.g., larotrectinib/entrectinib for NTRK/ROS1; alectinib/lorlatinib for ALK)."
    },
    "everolimus_sega": {
      "name": "mTOR Inhibition (Everolimus)",
      "summary": "FDA-approved systemic therapy for TSC-associated SEGA not amenable to curative surgical resection."
    },
    "onc201_dmg": {
      "name": "H3 K27-Altered Targeted & Clinical Trial Pathways",
      "summary": "Evaluate for DRD2/ClpP agonist (dordaviprone/ONC201) trials and specialized neuro-oncology protocols."
    },
    "li_fraumeni_shh_tp53": {
      "name": "Germline TP53 / Li-Fraumeni Counseling",
      "summary": "Medulloblastoma, SHH-activated and TP53-mutant carries a high rate of germline TP53 mutation; refer urgently to cancer genetics and avoid radiation-induced secondary malignancy pitfalls."
    }
  },
  "vignettes": [
    {
      "id": "vig_mol_gbm",
      "label": "Molecular GBM (IDH-wt, TERT+, Histologically Low-Grade)",
      "family": "adult_diffuse_glioma",
      "inputState": { "family": "adult_diffuse_glioma", "idh_status": "wildtype", "tert_promoter": "mutant", "egfr_amplification": "absent", "chr7_gain_chr10_loss": "absent", "necrosis": false, "mvp": false, "mitotic_activity_high": false, "mgmt_promoter": "methylated", "h3_tested_wildtype": "wildtype", "age_years": 64 }
    }
  ],
  "references": {
    "louis2021": {
      "id": "louis2021",
      "citation": "Louis DN, Perry A, Wesseling P, et al. The 2021 WHO Classification of Tumors of the Central Nervous System: a summary. Neuro-Oncology. 2021;23(8):1231-1251.",
      "doi": "10.1093/neuonc/noab106"
    }
  }
}
```

**Mandatory content requirements for `data/cns5_rules.json`:**
- All **7** families in `families[]` (`adult_diffuse_glioma`, `pediatric_hgg`, `pediatric_lgg`, `circumscribed_astrocytic`, `ependymal_tumor`, `meningioma`, `medulloblastoma`).
- At least **24** distinct WHO CNS5 entities across those 7 families with accurate hallmarks, Arabic numeral `gradesAllowed`, and `referenceIds`.
- At least **8** curated clinical `vignettes[]` spanning molecular upgrades (molecular GBM, CDKN2A/B grade 4 IDH-mut astrocytoma, molecular grade 3 meningioma), vorasidenib-eligible oligodendroglioma, DMG H3 K27-altered, myxopapillary ependymoma grade 2, SHH TP53-mutant medulloblastoma, and an NOS case.
- Complete `references` dictionary including Louis et al. 2021, cIMPACT-NOW Updates 1–7, Mellinghoff et al. 2023 (INDIGO), Stupp/Hegi, Sahm/Karschnia/Pajtler/Taylor consensus citations.

### 3.3 Exported JS API: `js/cns5Engine.js`

#### Exported Constants & Functions
```js
export const CNS5_FAMILIES = [
  "adult_diffuse_glioma",
  "pediatric_hgg",
  "pediatric_lgg",
  "circumscribed_astrocytic",
  "ependymal_tumor",
  "meningioma",
  "medulloblastoma"
];

export function getDefaultCns5Input(family = "adult_diffuse_glioma") { ... }
export function classifyCns5(inputState, rulesData = null) { ... }
export function formatCns5Report(result, inputState) { ... }
```

#### Exact Input Schemas by Family (`inputState`)
All missing keys MUST safely fall back to `"not_tested"` (for biomarker enums), `false` (for booleans), or `null` (for numbers).

1. **`adult_diffuse_glioma`**:
   - `idh_status`: `"mutant" | "wildtype" | "not_tested"`
   - `codeletion_1p19q`: `"codeleted" | "intact" | "not_tested"`
   - `atrx_status`: `"lost" | "retained" | "not_tested"`
   - `tp53_status`: `"mutant" | "wildtype" | "not_tested"`
   - `cdkn2ab_homdel`: `"present" | "absent" | "not_tested"`
   - `tert_promoter`: `"mutant" | "wildtype" | "not_tested"`
   - `egfr_amplification`: `"present" | "absent" | "not_tested"`
   - `chr7_gain_chr10_loss`: `"present" | "absent" | "not_tested"`
   - `necrosis`: `boolean`
   - `mvp`: `boolean` (microvascular proliferation)
   - `mitotic_activity_high`: `boolean` (significant mitotic activity / anaplasia)
   - `mgmt_promoter`: `"methylated" | "unmethylated" | "not_tested"`
   - `h3_tested_wildtype`: `"wildtype" | "mutant" | "not_tested"`
   - `age_years`: `number | null`

2. **`pediatric_hgg`**:
   - `anatomic_location`: `"midline" | "hemispheric" | "other"`
   - `patient_age_group`: `"infant_under_4y" | "child_adolescent" | "adult"`
   - `h3_k27_status`: `"k27m_mutant" | "ezhip_overexpressed" | "egfr_mutant_midline" | "wildtype" | "not_tested"`
   - `h3_k27me3_loss`: `"lost" | "retained" | "not_tested"`
   - `h3_g34_status`: `"g34r_or_g34v_mutant" | "wildtype" | "not_tested"`
   - `idh_status`: `"wildtype" | "mutant" | "not_tested"`
   - `infant_rtk_fusion`: `"ntrk_fusion" | "ros1_fusion" | "alk_fusion" | "met_fusion" | "absent" | "not_tested"`
   - `pediatric_hgg_subtype`: `"pedhgg_rtk1" | "pedhgg_rtk2" | "pedhgg_mycn" | "none_or_untested"`
   - `low_grade_histology_only`: `boolean` (highlights molecular Grade 4 override in DMG H3 K27-altered)

3. **`pediatric_lgg`**:
   - `myb_mybl1_alteration`: `"myb_or_mybl1_altered" | "absent" | "not_tested"`
   - `angiocentric_histology`: `boolean`
   - `plnty_features`: `boolean` (oligodendroglioma-like + calcifications + strong CD34)
   - `mapk_alteration`: `"braf_v600e" | "fgfr1_alteration" | "fgfr2_fgfr3_fusion" | "braf_fusion" | "nf1_or_other_mapk" | "absent" | "not_tested"`
   - `idh_status`: `"wildtype" | "mutant" | "not_tested"`
   - `h3_status`: `"wildtype" | "mutant" | "not_tested"`

4. **`circumscribed_astrocytic`**:
   - `morphology_subtype`: `"pilocytic" | "piloid_high_grade" | "pxa" | "sega" | "chordoid" | "astroblastoma"`
   - `molecular_marker`: `"kiaa1549_braf" | "braf_v600e" | "hgap_methylation_profile" | "tsc1_tsc2" | "prkca_d463h" | "mn1_altered" | "nf1_or_mapk" | "absent" | "not_tested"`
   - `mitoses_per_10hpf`: `number | null` (determines PXA grade 2 vs 3 at `>= 5`)
   - `cdkn2ab_homdel`: `"present" | "absent" | "not_tested"`

5. **`ependymal_tumor`**:
   - `compartment`: `"supratentorial" | "posterior_fossa" | "spinal"`
   - `histology_variant`: `"classic_or_ependymoma" | "subependymoma" | "myxopapillary"`
   - `anaplastic_features`: `boolean` (grade 2 vs grade 3 for standard ependymomas)
   - `st_fusion`: `"zfta_fusion" | "yap1_fusion" | "absent" | "not_tested"`
   - `pf_methylation_h3k27me3`: `"pfa_h3k27me3_lost" | "pfb_h3k27me3_retained" | "indeterminate_or_other" | "not_tested"`
   - `mycn_amplification`: `"present" | "absent" | "not_tested"`

6. **`meningioma`**:
   - `subtype`: `"meningothelial_or_common" | "chordoid" | "clear_cell" | "rhabdoid" | "papillary" | "secretory"`
   - `mitoses_per_10hpf`: `number` (default `0`; `4–19` -> Grade 2, `>= 20` -> Grade 3)
   - `brain_invasion`: `boolean` (Grade 2)
   - `atypical_features_count`: `number` (`0–5`; `>= 3` -> Grade 2)
   - `frank_anaplasia`: `boolean` (sarcoma-/carcinoma-/melanoma-like -> Grade 3)
   - `tert_promoter`: `"mutant" | "wildtype" | "not_tested"` (**Molecular Grade 3 upgrade**)
   - `cdkn2ab_homdel`: `"present" | "absent" | "not_tested"` (**Molecular Grade 3 upgrade**)
   - `h3k27me3_loss`: `"lost" | "retained" | "not_tested"`
   - `bap1_loss`: `"lost" | "retained" | "not_tested"`
   - `smarce1_loss`: `"lost" | "retained" | "not_tested"`

7. **`medulloblastoma`**:
   - `molecular_group`: `"wnt" | "shh" | "non_wnt_non_shh" | "not_tested" | "indeterminate"`
   - `tp53_status`: `"wildtype" | "mutant" | "not_tested"`
   - `histology`: `"classic" | "desmoplastic_nodular" | "mben" | "large_cell_anaplastic"`
   - `non_wnt_subgroup`: `"group_3" | "group_4" | "unspecified"`
   - `myc_mycn_amplification`: `"myc_amp" | "mycn_amp" | "none" | "not_tested"`

#### Deterministic Classification Rules Summary

| Family | Key Condition | Integrated Diagnosis | `cnsWhoGrade` | `molecularUpgradeTriggered` | `nosNecStatus` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `adult_diffuse_glioma` | `idh_status === "not_tested"` + (`necrosis \|\| mvp`) | `Glioblastoma, NOS` | `4` | `false` | `"NOS"` |
| `adult_diffuse_glioma` | `idh_status === "not_tested"` + `mitotic_activity_high` | `Diffuse glioma, high-grade, NOS` | `3` | `false` | `"NOS"` |
| `adult_diffuse_glioma` | `idh_status === "not_tested"` + low-grade histology | `Diffuse glioma, NOS` | `2` | `false` | `"NOS"` |
| `adult_diffuse_glioma` | `idh_status === "mutant"` + `codeletion_1p19q === "codeleted"` | `Oligodendroglioma, IDH-mutant and 1p/19q-codeleted` | `3` if `necrosis \|\| mvp \|\| mitotic_activity_high` else `2` *(grading remains histological; `cdkn2ab_homdel === "present"` emits an adverse-prognosis warning and is not an unconditional standalone upgrade)* | `false` | `"none"` |
| `adult_diffuse_glioma` | `idh_status === "mutant"` + (`codeletion_1p19q === "intact"` OR (`not_tested` & `atrx_status === "lost"`)) | `Astrocytoma, IDH-mutant` | `4` if `necrosis \|\| mvp \|\| cdkn2ab_homdel === "present"`; else `3` if `mitotic_activity_high`; else `2` | `true` iff `cdkn2ab_homdel === "present"` AND `!(necrosis \|\| mvp)` | `"none"` |
| `adult_diffuse_glioma` | `idh_status === "mutant"` + `codeletion_1p19q === "not_tested"` + `atrx_status !== "lost"` | `Diffuse glioma, IDH-mutant, NOS` | `4` / `3` / `2` (provisional) | `true` iff `cdkn2ab_homdel === "present"` & no necrosis/MVP | `"NOS"` |
| `adult_diffuse_glioma` | `idh_status === "wildtype"` + `h3_tested_wildtype === "mutant"` | `Diffuse glioma, H3-mutant (reclassify under Pediatric-type diffuse HGG)` | `4` | `true` | `"NEC"` |
| `adult_diffuse_glioma` | `idh_status === "wildtype"` + (`necrosis \|\| mvp \|\| tert === "mutant" \|\| egfr === "present" \|\| chr7_10 === "present"`) | `Glioblastoma, IDH-wildtype` | `4` | `true` iff `!(necrosis \|\| mvp)` AND ≥1 molecular GBM marker present | `"none"` |
| `adult_diffuse_glioma` | `idh_status === "wildtype"` + no necrosis/MVP + all 3 GBM molecular markers tested & negative | `Diffuse astrocytic glioma, IDH-wildtype, NEC` | `"Not assigned"` | `false` | `"NEC"` |
| `adult_diffuse_glioma` | `idh_status === "wildtype"` + no necrosis/MVP + ≥1 GBM molecular marker `"not_tested"` | `Diffuse astrocytic glioma, IDH-wildtype, NOS` | `"Not assigned"` | `false` | `"NOS"` |
| `pediatric_hgg` | `anatomic_location === "midline"` + (`h3_k27_status` altered OR `h3_k27me3_loss === "lost"`) | `Diffuse midline glioma, H3 K27-altered` | `4` | `true` if `low_grade_histology_only` else `false` | `"none"` |
| `pediatric_hgg` | `anatomic_location !== "midline"` + `h3_k27_status` altered (`k27m_mutant` / `ezhip_overexpressed` / `egfr_mutant_midline`) | `Diffuse glioma, H3 K27-altered, non-midline, NEC` | `"Not assigned"` | `false` | `"NEC"` |
| `pediatric_hgg` | `h3_g34_status === "g34r_or_g34v_mutant"` | `Diffuse hemispheric glioma, H3 G34-mutant` | `4` | `false` | `"none"` |
| `pediatric_hgg` | `patient_age_group === "infant_under_4y"` + `anatomic_location === "hemispheric"` + RTK fusion present | `Infant-type hemispheric glioma` | `"Not assigned"` | `false` | `"none"` |
| `pediatric_hgg` | `idh_status === "wildtype"` + `h3_k27_status === "wildtype"` + `h3_g34_status === "wildtype"` | `Diffuse pediatric-type high-grade glioma, H3-wildtype and IDH-wildtype` | `4` | `false` | `"none"` |
| `pediatric_hgg` | `idh_status === "mutant"` | `Diffuse glioma, IDH-mutant (reclassify under Adult-type diffuse gliomas), NEC` | `"Not assigned"` | `false` | `"NEC"` |
| `pediatric_hgg` | Required H3/IDH testing incomplete & no defining alteration | `Pediatric-type diffuse high-grade glioma, NOS` | `4` | `false` | `"NOS"` |
| `pediatric_lgg` | `idh_status === "mutant"` OR `h3_status === "mutant"` | `Discordant diffuse glioma (IDH- or H3-mutant — reclassify), NEC` | `"Not assigned"` | `false` | `"NEC"` |
| `pediatric_lgg` | `angiocentric_histology` + `myb_mybl1 === "myb_or_mybl1_altered"` | `Angiocentric glioma` | `1` | `false` | `"none"` |
| `pediatric_lgg` | `angiocentric_histology` + `myb_mybl1 === "not_tested"` | `Angiocentric glioma, NOS` | `1` | `false` | `"NOS"` |
| `pediatric_lgg` | `!angiocentric_histology` + `myb_mybl1 === "myb_or_mybl1_altered"` | `Diffuse astrocytoma, MYB- or MYBL1-altered` | `1` | `false` | `"none"` |
| `pediatric_lgg` | `plnty_features` + MAPK altered | `Polymorphous low-grade neuroepithelial tumor of the young (PLNTY)` | `1` | `false` | `"none"` |
| `pediatric_lgg` | `plnty_features` + `mapk_alteration === "not_tested"` | `Polymorphous low-grade neuroepithelial tumor of the young (PLNTY), NOS` | `1` | `false` | `"NOS"` |
| `pediatric_lgg` | MAPK altered (`braf_v600e`/`fgfr1`/`fgfr2_fgfr3`/`braf_fusion`/`nf1`) + IDH/H3 wt | `Diffuse low-grade glioma, MAPK pathway-altered` | `"Not assigned"` | `false` | `"none"` |
| `pediatric_lgg` | All molecular markers tested & negative | `Pediatric-type diffuse low-grade glioma, NEC` | `"Not assigned"` | `false` | `"NEC"` |
| `pediatric_lgg` | Incomplete molecular testing | `Pediatric-type diffuse low-grade glioma, NOS` | `"Not assigned"` | `false` | `"NOS"` |
| `circumscribed_astrocytic` | `morphology_subtype === "pilocytic"` | `Pilocytic astrocytoma` | `1` | `false` | `"none"` |
| `circumscribed_astrocytic` | `piloid_high_grade` + `hgap_methylation_profile` | `High-grade astrocytoma with piloid features` | `"Not assigned"` | `false` | `"none"` |
| `circumscribed_astrocytic` | `piloid_high_grade` + `"not_tested"` / `"absent"` | `High-grade astrocytoma with piloid features, NOS` / `Circumscribed high-grade astrocytic glioma, NEC` | `"Not assigned"` | `false` | `"NOS"` / `"NEC"` |
| `circumscribed_astrocytic` | `morphology_subtype === "pxa"` | `Pleomorphic xanthoastrocytoma` | `3` if `mitoses_per_10hpf >= 5` else `2` | `false` | `"none"` |
| `circumscribed_astrocytic` | `morphology_subtype === "sega"` | `Subependymal giant cell astrocytoma` | `1` | `false` | `"none"` |
| `circumscribed_astrocytic` | `morphology_subtype === "chordoid"` (`prkca_d463h` or `not_tested`) / `"absent"` | `Chordoid glioma` / `Chordoid glioma-like tumor, NEC` | `2` / `"Not assigned"` | `false` | `"none"` / `"NEC"` |
| `circumscribed_astrocytic` | `morphology_subtype === "astroblastoma"` + `mn1_altered` / `not_tested` / `absent` | `Astroblastoma, MN1-altered` / `Astroblastoma, NOS` / `Astroblastoma, NEC` | `"Not assigned"` | `false` | `"none"` / `"NOS"` / `"NEC"` |
| `ependymal_tumor` | `histology_variant === "subependymoma"` | `Subependymoma` | `1` | `false` | `"none"` |
| `ependymal_tumor` | `histology_variant === "myxopapillary"` | `Myxopapillary ependymoma` | `2` *(upgraded from WHO 2016 grade I!)* | `false` | `"none"` |
| `ependymal_tumor` | `supratentorial` + `zfta_fusion` / `yap1_fusion` / `not_tested` / `absent` | `Supratentorial ependymoma, ZFTA fusion-positive` / `YAP1 fusion-positive` / `NOS` / `NEC` | `3` if `anaplastic_features` else `2` | `false` | `"none"` / `"NOS"` / `"NEC"` |
| `ependymal_tumor` | `posterior_fossa` + `pfa` / `pfb` / `not_tested` / `indeterminate` | `Posterior fossa group A (PFA) ependymoma` / `PFB ependymoma` / `NOS` / `NEC` | `3` if `anaplastic_features` else `2` | `false` | `"none"` / `"NOS"` / `"NEC"` |
| `ependymal_tumor` | `spinal` + `mycn_amplification === "present"` | `Spinal ependymoma, MYCN-amplified` | `"Not assigned"` | `true` *(high-risk molecular entity)* | `"none"` |
| `ependymal_tumor` | `spinal` + `mycn === "absent"` (or low-grade `not_tested`) / high-grade `not_tested` | `Spinal ependymoma` / `Spinal ependymoma, NOS` | `3` if `anaplastic_features` else `2` | `false` | `"none"` / `"NOS"` |
| `meningioma` | `mitoses >= 20 \|\| frank_anaplasia \|\| tert === "mutant" \|\| cdkn2ab === "present"` | `Meningioma` *(with subtype qualifier)* | `3` | `true` iff `!(mitoses >= 20 \|\| frank_anaplasia)` AND (`tert === "mutant" \|\| cdkn2ab === "present"`) | `"none"` |
| `meningioma` | `mitoses >= 4 \|\| brain_invasion \|\| atypical_features_count >= 3 \|\| subtype in ["chordoid","clear_cell"]` | `Meningioma` *(with subtype qualifier)* | `2` | `false` | `"none"` |
| `meningioma` | Otherwise (note: rhabdoid & papillary are NO LONGER automatic Grade 3 in CNS5!) | `Meningioma` *(with subtype qualifier)* | `1` | `false` | `"none"` |
| `medulloblastoma` | `molecular_group === "wnt"` | `Medulloblastoma, WNT-activated` | `4` | `false` | `"none"` |
| `medulloblastoma` | `molecular_group === "shh"` + `tp53_status === "wildtype"` | `Medulloblastoma, SHH-activated and TP53-wildtype` | `4` | `false` | `"none"` |
| `medulloblastoma` | `molecular_group === "shh"` + `tp53_status === "mutant"` | `Medulloblastoma, SHH-activated and TP53-mutant` | `4` | `false` | `"none"` |
| `medulloblastoma` | `molecular_group === "shh"` + `tp53_status === "not_tested"` | `Medulloblastoma, SHH-activated, TP53 status unknown (NOS)` | `4` | `false` | `"NOS"` |
| `medulloblastoma` | `molecular_group === "non_wnt_non_shh"` | `Medulloblastoma, non-WNT/non-SHH` *(append Group 3 / Group 4 if specified)* | `4` | `false` | `"none"` |
| `medulloblastoma` | `molecular_group === "not_tested"` | `Medulloblastoma, histologically defined (NOS)` | `4` | `false` | `"NOS"` |
| `medulloblastoma` | `molecular_group === "indeterminate"` | `Medulloblastoma, NEC` | `4` | `false` | `"NEC"` |

#### Exact Return Contract of `classifyCns5(inputState, rulesData)`
```js
{
  // Required core fields:
  diagnosis: string,                    // e.g., "Glioblastoma, IDH-wildtype"
  cnsWhoGrade: 1 | 2 | 3 | 4 | "Not assigned",
  family: string,                       // One of CNS5_FAMILIES
  criteriaMatched: string[],            // Explicit criteria satisfied
  decisionPath: [                       // Ordered nodes consumed by visuals.renderDecisionTrace()
    {
      stepId: string,                   // e.g., "step_idh"
      label: string,                    // e.g., "IDH1/2 Status"
      value: string,                    // e.g., "Wildtype"
      outcome: string,                  // e.g., "Evaluate molecular & histologic GBM criteria"
      status: "pass" | "upgrade" | "warning" | "nos_nec" | "terminal"
    }
  ],
  molecularUpgradeTriggered: boolean,   // True when molecular hallmark elevates grade/risk over histology
  nosNecNote: string | null,            // Non-null explanatory guidance whenever NOS/NEC or discordance occurs
  clinicalPearls: string[],             // Therapeutic/prognostic notes (MGMT, vorasidenib, BRAF/MEK, Li-Fraumeni, etc.)
  references: [                         // Resolved citation objects
    { id: string, citation: string, doi?: string }
  ],

  // Supplemental structured metadata for UI & formatting:
  entityId: string,                     // Machine key matching cns5_rules.json entity id (or NOS/NEC id)
  gradeDisplay: string,                 // e.g., "CNS WHO grade 4" or "CNS WHO grade not assigned"
  nosNecStatus: "none" | "NOS" | "NEC",
  warnings: string[]                    // Discordance alerts (e.g., ATRX loss + 1p/19q codeleted; age <55 IDH-wt IHC caveat)
}
```

---

## 4. Module 2: Multi-Standard Clinical Calculators (`js/ranoCalculators.js`)

All three calculators MUST be pure, side-effect-free ES Module exports with strict input validation (`valid: boolean`, `errors: string[]`) and deterministic numeric precision (round display percentages to 1 decimal place; evaluate threshold inequalities on unrounded exact floating-point math with standard `>=` / `<=` boundaries).

### 4.1 Exported JS API: `js/ranoCalculators.js`
```js
export function computeSpdFromLesions(lesions) { ... }       // Helper: [{ longMm, perpMm }] -> { spdMm2, measurableCount, warnings }
export function calculateRano2(params) { ... }               // Wen et al., JCO 2023
export function calculateRanoBm(params) { ... }              // Lin et al., Lancet Oncol 2015
export function calculateRanoResect(params) { ... }          // Karschnia et al., Neuro-Oncology 2023
export function formatClinicalSummary(calcType, result, inputs) { ... }
```

### 4.2 `calculateRano2(params)` — RANO 2.0 (Wen et al., *JCO* 2023)

#### Inputs (`params`)
```js
{
  tumorMode: "enhancing_hgg" | "non_enhancing_lgg",   // Default: "enhancing_hgg"
  measurementType: "2d_spd" | "3d_volume",            // Default: "2d_spd" (mm² vs cm³)
  baselineValue: number,                              // >= 0 (Post-RT baseline for newly diagnosed HGG per RANO 2.0)
  nadirValue: number | null,                          // Smallest prior value >= 0; if null, defaults to baselineValue
  currentValue: number,                               // >= 0
  corticosteroids: "none_or_physiologic" | "stable_or_decreased" | "increased",
  clinicalStatus: "stable_or_improved" | "worse",     // "worse" = unequivocal clinical deterioration
  newMeasurableLesion: boolean,                       // Default: false
  nonMeasurablePresent: boolean,                      // Default: false (relevant for CR & baseline=0 guard)
  nonMeasurableProgression: boolean,                  // Default: false
  within12WeeksPostRt: boolean,                       // Default: false
  outsideRtField: boolean,                            // Default: false (if true, progression outside RT field is definite PD even <=12 wks)
  sustained4Weeks: boolean                            // Default: false (confirmation flag for CR/PR/MR)
}
```

#### Exact RANO 2.0 Algorithm & Invariants
1. **Validation:** Reject negative `baselineValue`, `nadirValue`, or `currentValue` (`valid: false`).
2. **Reference Computation:**
   - `nadirRef = (nadirValue !== null && nadirValue !== undefined) ? Math.min(baselineValue, nadirValue) : baselineValue`.
   - `pctChangeFromBaseline = baselineValue > 0 ? ((currentValue - baselineValue) / baselineValue) * 100 : null`.
   - `pctChangeFromNadir = nadirRef > 0 ? ((currentValue - nadirRef) / nadirRef) * 100 : (currentValue > 0 ? Infinity : 0)`.
3. **Mode-Specific Thresholds (Wen et al., *JCO* 2023, Table 1):**
   - **2D SPD (`"2d_spd"`):**
     - `PR`: `pctChangeFromBaseline <= -50`
     - `MR` (**ONLY when `tumorMode === "non_enhancing_lgg"`**): `-50 < pctChangeFromBaseline <= -25`
     - `PD`: `pctChangeFromNadir >= 25`
   - **3D Volume (`"3d_volume"`):**
     - `PR`: `pctChangeFromBaseline <= -65`
     - `MR` (**ONLY when `tumorMode === "non_enhancing_lgg"`**): `-65 < pctChangeFromBaseline <= -40`
     - `PD`: `pctChangeFromNadir >= 40`
4. **Radiographic vs. Clinical PD & `≤12 Weeks Post-RT` Monotonicity Rule:**
   - `radiographicPd = (nadirRef > 0 && pctChangeFromNadir >= pdThreshold) || (nadirRef === 0 && currentValue > 0) || newMeasurableLesion || nonMeasurableProgression`.
   - `clinicalPd = (clinicalStatus === "worse")`.
   - **STRICT MONOTONICITY INVARIANT:**
     - If `clinicalPd === true` -> **ALWAYS Definite `"PD"`**, regardless of `within12WeeksPostRt` or `radiographicPd`! Adding worse imaging MUST NEVER weaken `"PD"` to `"Prelim-PD"`.
     - Else if `radiographicPd === true`:
       - If `within12WeeksPostRt === true && outsideRtField !== true` -> **`"Prelim-PD"`** (`"Preliminary Progressive Disease — Unconfirmed (≤12 wks post-RT)"`), requiring confirmatory MRI `>= 4 weeks` later (pseudoprogression guard).
       - Else -> **Definite `"PD"`**.
5. **Baseline Disease Guard for CR (when not PD/Prelim-PD):**
   - If `baselineValue === 0 && !nonMeasurablePresent`:
     - Cannot declare CR, PR, or MR because no measurable or evaluable tumor was present at baseline (`baselineGuardTriggered = true`).
     - Return `responseCode: "Non-PD"` (`"No Measurable Baseline Disease (Non-PD — CR Not Applicable)"`).
   - If `baselineValue === 0 && nonMeasurablePresent`:
     - Residual non-measurable disease persists with zero measurable target baseline (`baselineGuardTriggered = true`); CR/PR/MR cannot be assigned -> return `responseCode: "SD"` (`"Stable Disease (Non-Measurable Disease Only — CR Not Applicable)"`).
6. **CR / PR / MR / SD Evaluation (when `baselineValue > 0`, or non-measurable-only CR):**
   - **CR:** `currentValue === 0 && !nonMeasurablePresent && !newMeasurableLesion && corticosteroids === "none_or_physiologic" && clinicalStatus === "stable_or_improved"` (and `baselineValue > 0`).
   - **Steroid Downgrade Rule:**
     - If radiographic CR (`currentValue === 0 && !nonMeasurablePresent && baselineValue > 0`) occurs with `corticosteroids === "stable_or_decreased"` -> downgrade to **`"PR"`** (explain: CR requires none/physiologic corticosteroids).
     - If radiographic CR, PR, or MR occurs with `corticosteroids === "increased"` -> downgrade to **`"SD"`** (explain: increased corticosteroids alone is not PD without clinical deterioration, but precludes CR/PR/MR).
   - **PR:** `baselineValue > 0 && pctChangeFromBaseline <= prThreshold && corticosteroids !== "increased" && clinicalStatus === "stable_or_improved"`.
   - **MR (Non-Enhancing LGG ONLY):** `tumorMode === "non_enhancing_lgg" && baselineValue > 0 && pctChangeFromBaseline <= mrThreshold && pctChangeFromBaseline > prThreshold && corticosteroids !== "increased" && clinicalStatus === "stable_or_improved"`.
   - **SD:** All remaining non-PD cases.

#### Return Contract of `calculateRano2(params)`
```js
{
  valid: boolean,
  errors: string[],
  standard: "RANO 2.0 (Wen et al., JCO 2023)",
  tumorMode: "enhancing_hgg" | "non_enhancing_lgg",
  measurementType: "2d_spd" | "3d_volume",
  unit: "mm²" | "cm³",
  responseCode: "CR" | "PR" | "MR" | "SD" | "Prelim-PD" | "PD" | "Non-PD" | "INVALID",
  responseLabel: string,
  severityTier: "favorable" | "stable" | "warning" | "progression" | "neutral",
  pctChangeFromBaseline: number | null,
  pctChangeFromNadir: number | null,
  nadirReference: number,
  thresholds: { prPct: number, mrPct: number | null, pdPct: number },
  baselineGuardTriggered: boolean,
  preliminaryPdRuleApplied: boolean,
  steroidDowngradeApplied: boolean,
  confirmationStatus: string,
  rationale: string[],
  warnings: string[],
  reference: { citation: string, doi: string }
}
```

---

### 4.3 `calculateRanoBm(params)` — RANO-BM (Lin et al., *Lancet Oncology* 2015)

#### Inputs (`params`)
```js
{
  // Either targetLesions[] (1-5 lesions, preferred) OR direct SLD scalars:
  targetLesions?: [
    { id?: string, label?: string, baselineMm: number, nadirMm?: number | null, currentMm: number }
  ],
  baselineSldMm?: number,                             // Used if targetLesions is omitted/empty
  nadirSldMm?: number | null,
  currentSldMm?: number,
  corticosteroids: "none_or_physiologic" | "stable_or_decreased" | "increased",
  neurologicStatus: "stable_or_improved" | "worse",
  newCnsLesion: boolean,                              // Default: false
  nonTargetCnsPresent: boolean,                       // Default: false
  nonTargetCnsProgression: boolean,                   // Default: false
  nonCnsStatus: "CR" | "PR" | "SD" | "PD" | "NE" | "not_applicable", // Separate systemic RECIST 1.1 compartment!
  priorSrsWithin6Months: boolean,                     // Default: false (triggers radiation necrosis / pseudoprogression caution)
  sustained4Weeks: boolean                            // Default: false
}
```

#### Exact RANO-BM Algorithm & Invariants
1. **Target Lesion Rules:**
   - Up to **5** measurable target CNS lesions. If `targetLesions.length > 5`, flag a warning and validate only the first 5 (or return validation warning).
   - Measurability check: warn if any baseline target lesion is `< 10 mm` (Lin et al. 2015 specifies `>= 10 mm` longest diameter with slice thickness `<= 5 mm`, ideally `<= 1.5 mm` 3D isotropic).
   - Compute `baselineSldMm`, `nadirSldMm` (defaulting per-lesion `nadirMm` to `baselineMm`), `currentSldMm`, and `nadirRef = Math.min(baselineSldMm, nadirSldMm)`.
   - Compute `absChangeFromNadirMm = currentSldMm - nadirRef`.
   - Compute `pctChangeFromBaseline = baselineSldMm > 0 ? ((currentSldMm - baselineSldMm) / baselineSldMm) * 100 : null`.
   - Compute `pctChangeFromNadir = nadirRef > 0 ? ((currentSldMm - nadirRef) / nadirRef) * 100 : (currentSldMm > 0 ? Infinity : 0)`.
2. **CNS Compartment Response (Evaluated Strictly Independently of Non-CNS Disease):**
   - **CNS PD:** ANY of:
     - `(nadirRef > 0 && pctChangeFromNadir >= 20 && absChangeFromNadirMm >= 5)` — **BOTH `>= 20%` relative increase AND `>= 5 mm` absolute increase from nadir required!**
     - `(nadirRef === 0 && currentSldMm > 0)` (reappearance of measurable CNS disease after nadir 0)
     - `newCnsLesion === true`
     - `nonTargetCnsProgression === true`
     - `neurologicStatus === "worse"` (unequivocal CNS neurological deterioration)
   - **Baseline Guard (when not PD):** If `baselineSldMm === 0 && !nonTargetCnsPresent` -> `cnsResponseCode: "Non-PD"`, `baselineGuardTriggered: true`.
   - **CNS CR:** `baselineSldMm > 0 && currentSldMm === 0 && !nonTargetCnsPresent && !newCnsLesion && corticosteroids === "none_or_physiologic" && neurologicStatus === "stable_or_improved"`.
   - **CNS PR:** `baselineSldMm > 0 && pctChangeFromBaseline <= -30 && corticosteroids !== "increased" && neurologicStatus === "stable_or_improved"` (also catches radiographic CR downgraded by `"stable_or_decreased"` steroids).
   - **CNS SD:** Otherwise (including radiographic CR/PR downgraded by `"increased"` steroids).
3. **Bicompartmental Separation (CNS vs. Non-CNS Systemic):**
   - Preserve `cnsResponseCode` and `nonCnsStatus` as **separate fields** — never average or collapse them.
   - Set `compartmentDiscordance = true` whenever one compartment is `"PD"` while the other is `"CR"`, `"PR"`, or `"SD"`, or when one responds (`CR`/`PR`) while the other progresses (`PD`).

#### Return Contract of `calculateRanoBm(params)`
```js
{
  valid: boolean,
  errors: string[],
  standard: "RANO-BM (Lin et al., Lancet Oncology 2015)",
  cnsResponseCode: "CR" | "PR" | "SD" | "PD" | "Non-PD" | "INVALID",
  cnsResponseLabel: string,
  nonCnsResponseCode: "CR" | "PR" | "SD" | "PD" | "NE" | "not_applicable",
  bicompartmentalSummary: string,
  compartmentDiscordance: boolean,
  severityTier: "favorable" | "stable" | "warning" | "progression" | "neutral",
  targetLesionCount: number,
  baselineSldMm: number,
  nadirSldMm: number,
  currentSldMm: number,
  absChangeFromNadirMm: number,
  pctChangeFromBaseline: number | null,
  pctChangeFromNadir: number | null,
  pdCriteriaMet: { pctGte20: boolean, absGte5mm: boolean, newLesion: boolean, nonTargetPd: boolean, neuroWorse: boolean },
  baselineGuardTriggered: boolean,
  steroidDowngradeApplied: boolean,
  confirmationStatus: string,
  rationale: string[],
  warnings: string[],
  reference: { citation: string, doi: string }
}
```

---

### 4.4 `calculateRanoResect(params)` — RANO-Resect (Karschnia et al., *Neuro-Oncology* 2023)

#### Inputs (`params`)
```js
{
  preOpCeVolCm3: number,                 // >= 0 (Pre-operative contrast-enhancing tumor volume in cm³)
  postOpCeVolCm3: number,                // >= 0 (Post-operative residual CE volume in cm³)
  preOpNonCeVolCm3?: number | null,      // Optional pre-operative non-CE (FLAIR) volume in cm³
  postOpNonCeVolCm3?: number | null,     // Residual non-CE volume in cm³ (required to unlock Class 1 when postOpCeVolCm3 === 0)
  isBiopsyProcedure?: boolean,           // Default: false (explicit surgical biopsy override -> Class 4)
  postOpMriTimingHours?: number | null   // Optional QA check (>72h warns of reactive surgical enhancement)
}
```

#### Exact RANO-Resect Algorithm & Decision Hierarchy
Evaluate in this **exact strict order** so boundaries never overlap:

1. **Validation:** Reject negative volumes (`valid: false`).
2. **Explicit `N/A` Guard (`preOpCeVolCm3 === 0`):**
   - Return `resectClass: "N/A"`, `className: "Not Applicable — No Pre-Op Contrast-Enhancing Tumor"`, `naGuardTriggered: true`.
   - Include clinical note directing the user to non-enhancing / IDH-mutant glioma RANO-Resect frameworks (Karschnia et al., 2023/2024) rather than CE glioblastoma classes.
3. **Compute CE Volumetric Reduction:**
   - `ceReductionPct = ((preOpCeVolCm3 - postOpCeVolCm3) / preOpCeVolCm3) * 100`.
   - `nonCeReductionPct = (preOpNonCeVolCm3 != null && preOpNonCeVolCm3 > 0 && postOpNonCeVolCm3 != null) ? ((preOpNonCeVolCm3 - postOpNonCeVolCm3) / preOpNonCeVolCm3) * 100 : null`.
4. **Class 4 — Biopsy (Evaluated BEFORE residual volume thresholds!):**
   - Triggered if `isBiopsyProcedure === true` OR `ceReductionPct <= 0` (no tumor volume reduction per Karschnia et al., 2023) OR `(postOpCeVolCm3 <= 5 && ceReductionPct < 10)` (operational small-lesion biopsy guard preventing tiny biopsied tumors like `3.0 cm³ -> 2.8 cm³` from being misclassified as Class 3A subtotal resection, while large partial debulkings such as `100 cm³ -> 92 cm³` with `isBiopsyProcedure === false` classify strictly as Class 3B Partial CE Resection).
5. **Class 1 vs. Class 2A (`postOpCeVolCm3 === 0`):**
   - If `postOpNonCeVolCm3 !== null && postOpNonCeVolCm3 !== undefined && postOpNonCeVolCm3 <= 5`:
     - **`"Class 1"`** — *Supramaximal CE Resection* (`0 cm³` residual CE AND `≤ 5 cm³` residual non-CE).
     - *(If `nonCeReductionPct !== null && nonCeReductionPct < 60`, add an informative nuance note referencing the Karschnia et al. 2023 supplemental `≥60%` non-CE reduction criterion.)*
   - Else:
     - **`"Class 2A"`** — *Complete CE Resection (Maximal)* (`0 cm³` residual CE; `> 5 cm³` residual non-CE or non-CE not supplied).
     - If `postOpNonCeVolCm3 == null`, add explicit note that residual non-CE volume was omitted so Class 1 could not be verified.
6. **Class 2B (`0 < postOpCeVolCm3 <= 1`):**
   - **`"Class 2B"`** — *Near-Total CE Resection (Maximal)*.
7. **Class 3A (`1 < postOpCeVolCm3 <= 5`):**
   - **`"Class 3A"`** — *Subtotal CE Resection (Submaximal)*.
8. **Class 3B (`postOpCeVolCm3 > 5`):**
   - **`"Class 3B"`** — *Partial CE Resection (Submaximal)*.

#### Return Contract of `calculateRanoResect(params)`
```js
{
  valid: boolean,
  errors: string[],
  standard: "RANO-Resect (Karschnia et al., Neuro-Oncology 2023)",
  resectClass: "Class 1" | "Class 2A" | "Class 2B" | "Class 3A" | "Class 3B" | "Class 4" | "N/A" | "INVALID",
  className: string,
  categoryGroup: "Supramaximal" | "Maximal" | "Submaximal" | "Biopsy" | "Not Applicable" | "Invalid",
  severityTier: "favorable" | "good" | "moderate" | "poor" | "neutral",
  preOpCeVolCm3: number,
  postOpCeVolCm3: number,
  ceReductionPct: number | null,
  postOpNonCeVolCm3: number | null,
  nonCeReductionPct: number | null,
  naGuardTriggered: boolean,
  rationale: string[],
  warnings: string[],
  reference: { citation: string, doi: string }
}
```

### 4.5 `formatClinicalSummary(calcType, result, inputs)`
- `calcType`: `"rano2" | "rano_bm" | "rano_resect"`
- Returns a clean multi-line plain-text structured tumor-board / research note containing: header with standard & citation, key measurements & percentage changes, corticosteroid/clinical/compartmental modifiers, final classification, confirmation reminders, warnings, and `"For Research & Educational Use Only — Not a Certified Medical Device"`.

---

## 5. Module 3: Neuro-AI Leakage & Reporting Auditor (`data/audit_checklist.json` & `js/auditEngine.js`)

### 5.1 Reporting Standards & Citation Anchors
- **CLAIM 2024 (44 items):** Tejani AS, Klontzas ME, Gatti AA, Kahn CE Jr, Mongan J, et al. *Checklist for Artificial Intelligence in Medical Imaging (CLAIM): 2024 Update.* **Radiology: Artificial Intelligence**. 2024;6(4):e240300. `doi:10.1148/ryai.240300`.
- **TRIPOD+AI (27 items):** Collins GS, Moons KGM, Dhiman P, et al. *TRIPOD+AI statement: updated guidance for reporting clinical prediction models that use regression or machine learning methods.* **BMJ**. 2024;385:e078378. `doi:10.1136/bmj-2023-078378`.

### 5.2 Exact 36-Item Curated Catalog Across 6 Domains (`data/audit_checklist.json`)

The checklist contains **exactly 6 domains × 6 items = 36 items**. Every item MUST include:
`id`, `domainId`, `title`, `question`, `severity` (`"critical" | "major" | "recommended"`), `claim2024Refs` (`string[]`, format `"CLAIM-N"`), `tripodAiRefs` (`string[]`, format `"TRIPOD+AI-N"`), `failureMode`, `remediation`, and `neuroImagingRedFlag` (`boolean`).

| Domain ID | Domain Title | Item IDs | Critical Blocker Items (`severity: "critical"`) |
| :--- | :--- | :--- | :--- |
| `cohort_splitting` | **Cohort & Splitting** | `CS-01` .. `CS-06` | `CS-01` (Strict patient-level split; zero 2D slice/patch leakage), `CS-02` (Longitudinal/multi-timepoint & multi-sequence patient grouping), `CS-03` (Locked held-out test set isolation / nested CV) |
| `mri_preprocessing` | **MRI Preprocessing & Harmonization** | `MP-01` .. `MP-06` | `MP-01` (Train-only fitting of intensity normalization, z-scoring & ComBat harmonization — zero transductive test leakage) |
| `radiomics_fm_hygiene` | **Radiomics & Foundation-Model Hygiene** | `RF-01` .. `RF-06` | `RF-01` (Feature selection, PCA/LASSO & SMOTE strictly inside each training fold), `RF-04` (Foundation model / pretrained backbone benchmark contamination check against BraTS/TCGA/UPenn-GBM/UCSF-PDGM), `RF-05` (Hyperparameter tuning & early stopping isolated from final test set) |
| `multisite_shortcuts` | **Multi-Site & Shortcut Generalization** | `MS-01` .. `MS-06` | `MS-01` (True external multi-institutional or temporal validation cohort), `MS-02` (Scanner/vendor/hospital site shortcut auditing — ruling out site-confounded predictions) |
| `clinical_calibration` | **Clinical Calibration & Reference Standards** | `CC-01` .. `CC-06` | `CC-01` (WHO CNS5 2021 integrated molecular reference standard alignment — no outdated histology-only labels), `CC-06` (Immortal-time & post-baseline treatment leakage guard via landmarking) |
| `open_science_repro` | **Open Science & Reproducibility** | `OS-01` .. `OS-06` | *(0 critical blockers; 4 `major` + 2 `recommended` — open-science gaps reduce rigor score without falsely claiming data leakage)* |

**Complete 36-Item Roster Specification:**
- **Domain 1 (`cohort_splitting`):**
  - `CS-01` (`critical`): Patient-Level Partitioning (Zero 2D Slice/Patch Leakage) — `CLAIM-19`, `CLAIM-20`; `TRIPOD+AI-12`
  - `CS-02` (`critical`): Longitudinal & Multi-Scan Patient Grouping — `CLAIM-19`, `CLAIM-20`; `TRIPOD+AI-12`
  - `CS-03` (`critical`): Locked Held-Out Test Set & Nested Cross-Validation — `CLAIM-19`, `CLAIM-26`, `CLAIM-32`; `TRIPOD+AI-12`
  - `CS-04` (`major`): Consecutive Cohort Eligibility & Spectrum Bias Reporting — `CLAIM-7`, `CLAIM-8`, `CLAIM-36`; `TRIPOD+AI-5`, `TRIPOD+AI-6`
  - `CS-05` (`major`): Participant Flow & Exclusion Flowchart (CONSORT/STARD) — `CLAIM-12`, `CLAIM-35`; `TRIPOD+AI-11`, `TRIPOD+AI-20`
  - `CS-06` (`recommended`): Sample Size, Events-Per-Variable & Class-Balance Justification — `CLAIM-21`, `CLAIM-36`; `TRIPOD+AI-10`, `TRIPOD+AI-13`
- **Domain 2 (`mri_preprocessing`):**
  - `MP-01` (`critical`): Train-Only Intensity Normalization, Scaling & ComBat Fitting — `CLAIM-9`, `CLAIM-20`; `TRIPOD+AI-7`, `TRIPOD+AI-9`, `TRIPOD+AI-12`
  - `MP-02` (`major`): MRI Acquisition Protocol & Sequence Provenance (T1+C, FLAIR, 2D vs 3D) — `CLAIM-12`, `CLAIM-13`; `TRIPOD+AI-7`, `TRIPOD+AI-9`, `TRIPOD+AI-11`
  - `MP-03` (`major`): Brain Extraction, Co-Registration & Resection-Cavity QC — `CLAIM-9`, `CLAIM-10`; `TRIPOD+AI-7`, `TRIPOD+AI-9`
  - `MP-04` (`major`): Ground-Truth Tumor Segmentation Protocol & Inter-Rater Reliability (Dice) — `CLAIM-14`, `CLAIM-16`, `CLAIM-18`; `TRIPOD+AI-8`
  - `MP-05` (`recommended`): Isotropic Resampling & Anisotropic Slice-Thickness Handling — `CLAIM-9`, `CLAIM-13`; `TRIPOD+AI-7`, `TRIPOD+AI-9`
  - `MP-06` (`recommended`): Motion, Susceptibility & Post-Op Blood-Product Artifact QA — `CLAIM-10`, `CLAIM-12`; `TRIPOD+AI-7`, `TRIPOD+AI-27`
- **Domain 3 (`radiomics_fm_hygiene`):**
  - `RF-01` (`critical`): In-Fold Feature Selection, Dimensionality Reduction & Oversampling (SMOTE) — `CLAIM-20`, `CLAIM-25`; `TRIPOD+AI-12`, `TRIPOD+AI-13`
  - `RF-02` (`major`): IBSI-Compliant Radiomics Extraction Parameters (Bin Width, Filters) — `CLAIM-9`, `CLAIM-23`; `TRIPOD+AI-7`, `TRIPOD+AI-9`, `TRIPOD+AI-12`
  - `RF-03` (`major`): Radiomic Feature Repeatability & Segmentation-Perturbation Stability (ICC) — `CLAIM-18`, `CLAIM-25`, `CLAIM-30`; `TRIPOD+AI-7`, `TRIPOD+AI-9`, `TRIPOD+AI-12`
  - `RF-04` (`critical`): Foundation-Model / Pretrained Backbone Benchmark Contamination Audit — `CLAIM-20`, `CLAIM-24`, `CLAIM-25`; `TRIPOD+AI-5`, `TRIPOD+AI-12`, `TRIPOD+AI-16`
  - `RF-05` (`critical`): Hyperparameter Tuning & Checkpoint Selection Isolated from Test Set — `CLAIM-26`, `CLAIM-27`; `TRIPOD+AI-12`
  - `RF-06` (`recommended`): Incremental Value Ablation Against Clinical/Volumetric Baseline — `CLAIM-28`, `CLAIM-30`, `CLAIM-37`; `TRIPOD+AI-12`, `TRIPOD+AI-23`
- **Domain 4 (`multisite_shortcuts`):**
  - `MS-01` (`critical`): True External Multi-Institutional or Temporal Validation Cohort — `CLAIM-7`, `CLAIM-33`; `TRIPOD+AI-5`, `TRIPOD+AI-16`
  - `MS-02` (`critical`): Scanner, Vendor & Site-Confounder Shortcut Audit — `CLAIM-13`, `CLAIM-30`, `CLAIM-40`; `TRIPOD+AI-12`, `TRIPOD+AI-16`, `TRIPOD+AI-26`
  - `MS-03` (`major`): Surgical/Treatment Artifact Shortcut Check (Craniotomy, Cavity, Steroids) — `CLAIM-30`, `CLAIM-39`, `CLAIM-40`; `TRIPOD+AI-6`, `TRIPOD+AI-26`
  - `MS-04` (`major`): Cross-Site Label Prevalence & WHO-Edition Shift Assessment — `CLAIM-33`, `CLAIM-36`; `TRIPOD+AI-16`, `TRIPOD+AI-20`, `TRIPOD+AI-21`
  - `MS-05` (`major`): Subgroup Performance & Equity Stratification (Age, Sex, Subtype, EOR) — `CLAIM-36`, `CLAIM-37`, `CLAIM-38`; `TRIPOD+AI-14`, `TRIPOD+AI-23`
  - `MS-06` (`recommended`): Saliency, Failure-Case & Out-of-Distribution (OOD) Qualitative Audit — `CLAIM-30`, `CLAIM-31`, `CLAIM-39`; `TRIPOD+AI-25`, `TRIPOD+AI-26`, `TRIPOD+AI-27`
- **Domain 5 (`clinical_calibration`):**
  - `CC-01` (`critical`): WHO CNS5 (2021) Integrated Molecular Reference Standard Alignment — `CLAIM-14`, `CLAIM-15`; `TRIPOD+AI-8`
  - `CC-02` (`major`): Standardized Clinical Response / Outcome Adjudication (RANO 2.0 / RANO-BM) — `CLAIM-14`, `CLAIM-17`, `CLAIM-28`; `TRIPOD+AI-8`
  - `CC-03` (`major`): Probability Calibration Reporting (Calibration Slope/Intercept, Brier, ECE) — `CLAIM-28`, `CLAIM-37`, `CLAIM-38`; `TRIPOD+AI-12`, `TRIPOD+AI-23`
  - `CC-04` (`major`): Uncertainty Quantification & Patient-Level Confidence Intervals (Bootstrap/IPCW) — `CLAIM-29`, `CLAIM-37`, `CLAIM-38`; `TRIPOD+AI-12`, `TRIPOD+AI-23`
  - `CC-05` (`recommended`): Clinical Utility, Operating-Point Justification & Decision Curve Analysis — `CLAIM-28`, `CLAIM-41`; `TRIPOD+AI-12`, `TRIPOD+AI-15`, `TRIPOD+AI-23`, `TRIPOD+AI-25`
  - `CC-06` (`critical`): Immortal-Time Bias & Future-Treatment Leakage Guard (Landmarking) — `CLAIM-6`, `CLAIM-15`; `TRIPOD+AI-5`, `TRIPOD+AI-8`, `TRIPOD+AI-9`
- **Domain 6 (`open_science_repro`):**
  - `OS-01` (`major`): Public Code, Preprocessing Pipeline & Inference Model Availability — `CLAIM-43`; `TRIPOD+AI-18`, `TRIPOD+AI-22`
  - `OS-02` (`major`): Explicit Cohort Manifest & Partition Case-IDs (BraTS/TCGA Replication) — `CLAIM-7`, `CLAIM-43`; `TRIPOD+AI-18`
  - `OS-03` (`major`): Deterministic Seeds, Library Versions & Compute Environment Disclosure — `CLAIM-23`, `CLAIM-25`; `TRIPOD+AI-12`
  - `OS-04` (`major`): IRB/Ethics Approval, Defacing & DICOM De-Identification Protocol — `CLAIM-11`, `CLAIM-42`; `TRIPOD+AI-7`, `TRIPOD+AI-17`
  - `OS-05` (`recommended`): Completed CLAIM 2024 & TRIPOD+AI Cross-Reference Supplement — `CLAIM-1`, `CLAIM-2`; `TRIPOD+AI-1`, `TRIPOD+AI-2`
  - `OS-06` (`recommended`): Intended-Use Scope, Human-in-the-Loop Limits & Non-SaMD Framing — `CLAIM-3`, `CLAIM-40`, `CLAIM-41`; `TRIPOD+AI-3`, `TRIPOD+AI-27`

*(Total: **11** `critical`, **17** `major`, **8** `recommended` = **36 items**.)*

### 5.3 JSON Structure & Built-In Example Audit Presets (`data/audit_checklist.json`)

Top-level JSON structure of `data/audit_checklist.json`:
```json
{
  "schemaVersion": "1.0.0",
  "standards": {
    "claim2024": { "name": "CLAIM 2024 Update", "citation": "Tejani AS, et al. Radiology: Artificial Intelligence. 2024;6(4):e240300.", "doi": "10.1148/ryai.240300" },
    "tripodAi": { "name": "TRIPOD+AI Statement", "citation": "Collins GS, et al. BMJ. 2024;385:e078378.", "doi": "10.1136/bmj-2023-078378" }
  },
  "domains": [
    { "id": "cohort_splitting", "title": "Cohort & Splitting", "shortTitle": "Cohort & Split", "description": "..." }
  ],
  "items": [
    {
      "id": "CS-01",
      "domainId": "cohort_splitting",
      "title": "Patient-Level Partitioning (Zero 2D Slice/Patch Leakage)",
      "question": "Were train, validation, and test partitions constructed strictly at the patient level so no slices, patches, or exams from the same individual appear across splits?",
      "severity": "critical",
      "claim2024Refs": ["CLAIM-19", "CLAIM-20"],
      "tripodAiRefs": ["TRIPOD+AI-14"],
      "neuroImagingRedFlag": true,
      "failureMode": "...",
      "remediation": "..."
    }
  ],
  "presets": {
    "gold_standard": {
      "id": "gold_standard",
      "label": "Gold Standard Multi-Center Study",
      "description": "...",
      "studyMeta": { "title": "...", "authors": "...", "year": "2025", "taskType": "Radiogenomics (WHO CNS5 IDH/1p19q)", "modality": "Multi-parametric 3T MRI (T1+C, FLAIR, T2, DWI)", "cohortSummary": "...", "reviewer": "Peer Review Studio" },
      "responses": { "CS-01": { "status": "pass", "evidence": "Methods p. 6: GroupKFold by patient_id; external site held out." } }
    },
    "slice_leakage_pitfall": { "...": "Must include all 36 item IDs in responses" },
    "blank": { "...": "Must include all 36 item IDs with status='unanswered'" }
  }
}
```

**Canonical `studyMeta` contract** (shared across `presets`, `app.js`, and all `auditEngine.js` exporters):
`{ title: string, authors: string, year: string, taskType: string, modality: string, cohortSummary: string, reviewer: string }`.

**Required Preset Semantics (`data/audit_checklist.json -> presets`):**
Must include exactly these 3 keys:
1. **`gold_standard`**: Multi-center prospective/external-validation WHO CNS5 IDH/1p19q radiogenomics study. Zero critical failures, zero critical partials, `overallScore >= 90`, `leakageRiskLevel: "Low"`, realistic manuscript section citations in `evidence`.
2. **`slice_leakage_pitfall`**: Classic high-leakage single-center 2D slice-split GBM radiomics + SMOTE archetype. Explicitly fails `CS-01`, `MP-01`, `RF-01`, `MS-01`, `CC-01` while passing enough documentation/reproducibility/minor items so that **`rawOverallScore > 45` (e.g., ~55–62)** and the **automated Critical Blocker cap visibly clamps `overallScore` to `45`** (`capApplied: true`, `leakageRiskLevel: "Critical Blocker"`).
3. **`blank`**: Empty study metadata and all 36 responses set to `{ status: "unanswered", evidence: "" }` (`overallScore: 0`, `leakageRiskLevel: "Not Assessed"`).

### 5.4 Exported JS API & Exact Scoring Math (`js/auditEngine.js`)

```js
export const SEVERITY_WEIGHTS = { critical: 3, major: 2, recommended: 1 };
export const STATUS_POINTS = { pass: 1.0, partial: 0.5, fail: 0.0, unanswered: 0.0 };
export const CRITICAL_BLOCKER_SCORE_CAP = 45;

export function scoreAudit(checklistData, responses) { ... }
export function escapeLatex(text) { ... }
export function escapeXml(text) { ... }
export function exportAuditMarkdown(checklistData, responses, studyMeta, scoreResult) { ... }
export function exportAuditLatex(checklistData, responses, studyMeta, scoreResult) { ... }
export function exportAuditBadgeSvg(scoreResult, studyMeta) { ... }
export function exportAuditJson(studyMeta, responses, scoreResult) { ... }
export function validateImportedAuditJson(rawInput, checklistData) { ... }
```

#### Exact Scoring & Blocker Cap Specification (`scoreAudit`)
- Normalize each item response: missing entries default to `{ status: "unanswered", evidence: "" }`.
- Items with `status === "na"` are **excluded** from both earned weight and maximum applicable weight.
- For each domain `d` and globally across all 36 items:
  - `maxApplicableWeight = sum(SEVERITY_WEIGHTS[item.severity])` over all items where `status !== "na"`.
  - `earnedWeight = sum(SEVERITY_WEIGHTS[item.severity] * STATUS_POINTS[status])` over all items where `status !== "na"`.
  - `rawScore = maxApplicableWeight > 0 ? Math.round((earnedWeight / maxApplicableWeight) * 100) : 0`.
  - `answeredApplicableCount = count(status in ["pass", "partial", "fail"])`.
  - `completionPct = applicableCount > 0 ? Math.round((answeredApplicableCount / applicableCount) * 100) : 0`.
- **Critical Blocker Cap Rule:**
  - `criticalBlockersFailed = items.filter(i => i.severity === "critical" && status === "fail")`.
  - `criticalPartials = items.filter(i => i.severity === "critical" && status === "partial")`.
  - If `criticalBlockersFailed.length > 0`:
    - `capApplied = rawScore > CRITICAL_BLOCKER_SCORE_CAP` (and `blockerTriggered = true`).
    - `overallScore = Math.min(rawScore, CRITICAL_BLOCKER_SCORE_CAP)` (strictly `<= 45`!).
  - Else:
    - `capApplied = false`, `blockerTriggered = false`, `overallScore = rawScore`.
- **Leakage Risk Level (`leakageRiskLevel`) Decision Table:**
  1. `answeredApplicableCount === 0` -> `"Not Assessed"`
  2. `criticalBlockersFailed.length > 0` -> `"Critical Blocker"`
  3. `criticalPartials.length > 0 || criticalUnansweredIds.length > 0 || overallScore < 60` -> `"High"`
  4. `overallScore < 80` -> `"Moderate"`
  5. Otherwise (`overallScore >= 80 && criticalBlockersFailed.length === 0 && criticalPartials.length === 0 && criticalUnansweredIds.length === 0`) -> `"Low"`

#### Return Contract of `scoreAudit(checklistData, responses)`
```js
{
  overallScore: number,                  // 0-100 (capped <= 45 when any Critical Blocker fails)
  rawOverallScore: number,               // Uncapped 0-100 score
  capApplied: boolean,                   // True when rawOverallScore > 45 and clamped to 45
  blockerTriggered: boolean,             // True when criticalBlockersFailedCount > 0
  capReason: string | null,              // Human-readable blocker alert banner text
  leakageRiskLevel: "Low" | "Moderate" | "High" | "Critical Blocker" | "Not Assessed",
  completionPct: number,                 // 0-100
  counts: {
    total: 36,
    applicable: number,
    answered: number,
    pass: number,
    partial: number,
    fail: number,
    na: number,
    unanswered: number
  },
  criticalBlockersFailedCount: number,
  criticalBlockersFailed: [              // Sorted by domain order
    { id: string, domainId: string, title: string, failureMode: string, remediation: string }
  ],
  criticalPartialsCount: number,
  domainScores: [                        // Always ordered in checklistData.domains order (6 items for radar chart)
    {
      domainId: string,
      title: string,
      shortTitle: string,
      score: number,                     // 0-100
      answeredCount: number,
      applicableCount: number,
      criticalFailedCount: number,
      passCount: number,
      partialCount: number,
      failCount: number
    }
  ],
  guidelineCoverage: {
    claim2024: {
      mappedItemCount: number,
      applicableCount: number,
      passCount: number,
      partialCount: number,
      failCount: number,
      compliancePct: number,
      uniqueRefCount: number
    },
    tripodAi: {
      mappedItemCount: number,
      applicableCount: number,
      passCount: number,
      partialCount: number,
      failCount: number,
      compliancePct: number,
      uniqueRefCount: number
    }
  }
}
```

#### Exporter Requirements
- `escapeLatex(str)`: MUST escape all 10 special TeX characters cleanly (`\` -> `\textbackslash{}`, `&` -> `\&`, `%` -> `\%`, `$` -> `\$`, `#` -> `\#`, `_` -> `\_`, `{` -> `\{`, `}` -> `\}`, `~` -> `\textasciitilde{}`, `^` -> `\textasciicircum{}`).
- `exportAuditLatex(...)`: Outputs a complete, compile-ready `longtable` (using `\toprule`, `\midrule`, `\bottomrule`, `\endfirsthead`, `\endhead`) with study metadata header, score/blocker summary callout, and all 36 items with escaped fields.
- `exportAuditMarkdown(...)`: Outputs structured GFM with study metadata, executive rigor summary, Critical Blocker alert table (if any), domain summary table, and full 36-item supplement table.
- `exportAuditBadgeSvg(scoreResult, studyMeta)`: Outputs a valid standalone `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="36" role="img" aria-label="...">` badge with XML-escaped labels, rigor score (`XX/100`), color-coded risk pill, and blocker count if triggered.
- `validateImportedAuditJson(rawInput, checklistData)`: Accepts JSON string or object; returns `{ valid: boolean, errors: string[], warnings: string[], normalized: { studyMeta, responses } | null }`. Never throws on malformed JSON.

---

## 6. Module 4: Pure SVG Visualizations (`js/visuals.js`)

All render functions accept a DOM container (`HTMLElement`) as their first argument, replace its content safely with an accessible `<svg>` element (`role="img"`, `<title>`, `viewBox`), and use CSS custom properties (`var(--ink-primary)`, `var(--surface-card)`, `var(--accent)`, etc.) so Dark/Light theme transitions are instantaneous.

```js
export function renderRadarChart(containerEl, domainScores, options = {}) { ... }
export function renderDecisionTrace(containerEl, cns5Result, options = {}) { ... }
export function renderResectGauge(containerEl, resectResult, options = {}) { ... }
export function renderResponseGauge(containerEl, calcType, calcResult, options = {}) { ... }
```

### Visual Specifications
1. **`renderRadarChart(containerEl, domainScores, options)`:**
   - 6-axis hexagonal radar (`viewBox="0 0 460 380"`).
   - Concentric reference rings at `20, 40, 60, 80, 100` with subtle percentage labels.
   - Semi-transparent filled data polygon stroked in semantic risk color (emerald for Low, amber for Moderate, orange for High, crimson for Critical Blocker).
   - Each vertex renders a numeric score badge and, when `criticalFailedCount > 0`, a double-ring crimson blocker warning halo on that axis vertex.
2. **`renderDecisionTrace(containerEl, cns5Result, options)`:**
   - Dynamic-height vertical flowchart (`viewBox="0 0 520 H"`) iterating over `cns5Result.decisionPath`.
   - Each node displays step index, biomarker/criterion label, observed value badge, and branch outcome, connected by crisp directional arrowheads.
   - Distinct visual accents for `status`: `"pass"` (emerald border), `"upgrade"` (amber-crimson glow + `"MOLECULAR UPGRADE"` tag), `"nos_nec"` (indigo dashed border), `"warning"` (amber), `"terminal"` (filled clinical accent banner showing final WHO CNS5 integrated diagnosis & Arabic grade).
3. **`renderResectGauge(containerEl, resectResult, options)`:**
   - Segmented 6-tier horizontal clinical bar (`Class 1`, `Class 2A`, `Class 2B`, `Class 3A`, `Class 3B`, `Class 4`) with threshold annotations (`0 CE & ≤5 non-CE`, `0 CE`, `≤1 cm³`, `≤5 cm³`, `>5 cm³`, `<10% / Biopsy`) and active pointer needle.
   - When `resectResult.resectClass === "N/A"`, renders a clean neutral slate card explaining `Pre-Op CE Volume = 0 cm³ — Standard CE RANO-Resect Not Applicable`.
4. **`renderResponseGauge(containerEl, calcType, calcResult, options)`:**
   - Bidirectional percentage scale from `-100%` (left, CR) through `0%` (baseline/nadir origin) to `+60%+` (right, PD).
   - Dynamically adapts shaded zones for `rano2` (`2d_spd` vs `3d_volume`; includes `MR` band *only* in `non_enhancing_lgg` mode) and `rano_bm` (`-30%` PR, `+20%` PD with `≥5 mm` callout).
   - Plots distinct markers for `% Change vs. Baseline` (diamond) and `% Change vs. Nadir` (circle), plus badge pills for `Prelim-PD`, `Steroid Downgrade`, or `CNS/Non-CNS Discordance`.

---

## 7. Clinical Decision & Peer-Review Studio UX (`index.html`, `css/styles.css`, `js/app.js`)

### 7.1 Aesthetic & Theme System
- **Visual Identity:** Precision radiology workstation meets peer-review editorial studio — high information density without visual clutter, strict tabular numerals (`font-variant-numeric: tabular-nums`) on all clinical figures, subtle hairline borders, zero gratuitous gradients.
- **Dark / Light Mode Toggle:** Controlled via `document.documentElement.dataset.theme = "light" | "dark"`, persisted in `localStorage["cns5audit.v1.theme"]`, defaulting to `prefers-color-scheme`.
- **Semantic Palette (WCAG AA `>= 4.5:1` contrast in both themes):**
  - Light canvas `#F8FAFC`, elevated cards `#FFFFFF`, primary ink `#0F172A`, accent teal `#0F766E`, clinical blue `#0369A1`.
  - Dark canvas `#0B1120`, elevated cards `#111827`, primary ink `#F1F5F9`, accent teal `#2DD4BF`, clinical blue `#38BDF8`.
  - Status tokens: `--status-pass` (emerald), `--status-warn` (amber), `--status-high` (orange), `--status-critical` (crimson), `--status-nos` (indigo).

### 7.2 Mandatory Persistent Banner & Privacy Guarantees
- Top full-width non-dismissible clinical compliance bar in `index.html`:
  > **For Research & Educational Use Only — Not a Certified Medical Device.** Do not enter patient-identifying data (PHI). All calculations and audits execute **100% locally in your browser** (zero external uploads).
- Header controls: App brand + version pill, 3 top-level studio tabs (`WHO CNS5 Classifier`, `RANO Calculators`, `Neuro-AI Audit Studio`), Theme Toggle (`Light`/`Dark`), and `Reset Local State` button (clears `cns5audit.v1.*` keys after confirmation).

### 7.3 Responsive Layout & Key Workflows (`js/app.js`)
- **Desktop (`>= 1024px`):** Two-column studio grid (interactive form/checklist on left; sticky live diagnostic/score dashboard + SVG visuals + copy/export actions on right).
- **Mobile/Tablet (`< 1024px`):** Clean single-column stack with compact sticky score/diagnosis summary strip.
- **Graceful Local-File Notice:** If `fetch('./data/cns5_rules.json')` fails (e.g., user double-clicked `index.html` over `file://`), display a clean inline banner instructing the user to run `python -m http.server 8000` in the project directory.
- **One-Click Exports & Clipboard:**
  - CNS5 tab: `Copy Integrated Pathology Note`
  - RANO tab: `Copy Clinical Note` (via `formatClinicalSummary`)
  - Audit tab: `Copy Markdown`, `Download .md`, `Copy LaTeX`, `Download .tex`, `Download SVG Badge`, `Export JSON`, `Import JSON` (file picker with inline validation feedback from `validateImportedAuditJson`).

---

## 8. Golden Clinical & Methodological Test Vectors (Verification Contract)

All engineers and `tests/verify_rules.py` MUST adhere to these canonical test vectors:

### 8.1 WHO CNS5 Golden Vectors
1. **Molecular GBM Upgrade:** `adult_diffuse_glioma`, `idh_status="wildtype"`, `tert_promoter="mutant"`, `necrosis=false`, `mvp=false` -> `Glioblastoma, IDH-wildtype`, `cnsWhoGrade=4`, `molecularUpgradeTriggered=true`, `nosNecStatus="none"`.
2. **IDH-Mutant Astrocytoma CDKN2A/B Upgrade:** `adult_diffuse_glioma`, `idh_status="mutant"`, `codeletion_1p19q="intact"`, `cdkn2ab_homdel="present"`, `necrosis=false`, `mvp=false` -> `Astrocytoma, IDH-mutant`, `cnsWhoGrade=4`, `molecularUpgradeTriggered=true`.
3. **Oligodendroglioma Grade 2 (Vorasidenib Pearl):** `adult_diffuse_glioma`, `idh_status="mutant"`, `codeletion_1p19q="codeleted"`, `necrosis=false`, `mvp=false`, `mitotic_activity_high=false`, `cdkn2ab_homdel="absent"` -> `Oligodendroglioma, IDH-mutant and 1p/19q-codeleted`, `cnsWhoGrade=2`, `molecularUpgradeTriggered=false`, pearls include vorasidenib.
4. **Adult Diffuse Glioma NOS:** `adult_diffuse_glioma`, `idh_status="not_tested"`, `necrosis=true` -> `Glioblastoma, NOS`, `cnsWhoGrade=4`, `nosNecStatus="NOS"`.
5. **Adult Diffuse Glioma NEC:** `adult_diffuse_glioma`, `idh_status="wildtype"`, `necrosis=false`, `mvp=false`, `tert_promoter="wildtype"`, `egfr_amplification="absent"`, `chr7_gain_chr10_loss="absent"` -> `Diffuse astrocytic glioma, IDH-wildtype, NEC`, `cnsWhoGrade="Not assigned"`, `nosNecStatus="NEC"`.
6. **Myxopapillary Ependymoma Grade 2 Upgrade:** `ependymal_tumor`, `compartment="spinal"`, `histology_variant="myxopapillary"` -> `Myxopapillary ependymoma`, `cnsWhoGrade=2`.
7. **Meningioma Molecular Grade 3 Upgrade:** `meningioma`, `mitoses_per_10hpf=1`, `brain_invasion=false`, `atypical_features_count=0`, `frank_anaplasia=false`, `tert_promoter="mutant"` -> `Meningioma`, `cnsWhoGrade=3`, `molecularUpgradeTriggered=true`.
8. **Medulloblastoma SHH TP53-Mutant:** `medulloblastoma`, `molecular_group="shh"`, `tp53_status="mutant"` -> `Medulloblastoma, SHH-activated and TP53-mutant`, `cnsWhoGrade=4`, pearls include Li-Fraumeni genetic counseling.

### 8.2 RANO Calculators Golden Vectors
1. **RANO 2.0 `≤12 Weeks` Monotonicity:** `within12WeeksPostRt=true`, `clinicalStatus="worse"`, `baselineValue=400`, `nadirValue=400`, `currentValue=600` (+50% rad PD) -> **`PD`** (NEVER `Prelim-PD`!). Same imaging with `clinicalStatus="stable_or_improved"` -> **`Prelim-PD`**.
2. **RANO 2.0 Baseline Disease Guard for CR:** `baselineValue=0`, `currentValue=0`, `nonMeasurablePresent=false`, `corticosteroids="none_or_physiologic"`, `clinicalStatus="stable_or_improved"` -> **`Non-PD`** (`baselineGuardTriggered=true`), NEVER `CR`.
3. **RANO 2.0 LGG 3D Minor Response:** `tumorMode="non_enhancing_lgg"`, `measurementType="3d_volume"`, `baselineValue=20`, `nadirValue=20`, `currentValue=10` (-50% volume, between `-40%` and `-65%`), `corticosteroids="stable_or_decreased"`, `clinicalStatus="stable_or_improved"` -> **`MR`**. Same inputs in `enhancing_hgg` -> **`SD`**.
4. **RANO-BM `>=20%` WITHOUT `>=5 mm` Absolute Increase:** `baselineSldMm=15`, `nadirSldMm=15`, `currentSldMm=19` (+26.7%, +4 mm < 5 mm), no new lesions, neuro stable -> **`SD`** (NOT `PD`!). Changing `currentSldMm=20` (+33.3%, +5 mm >= 5 mm) -> **`PD`**.
5. **RANO-BM Bicompartmental Discordance:** CNS `PR` (-40% SLD) + `nonCnsStatus="PD"` -> `cnsResponseCode="PR"`, `nonCnsResponseCode="PD"`, `compartmentDiscordance=true`.
6. **RANO-Resect Explicit `N/A` Guard:** `preOpCeVolCm3=0`, `postOpCeVolCm3=0` -> `resectClass="N/A"`, `naGuardTriggered=true`.
7. **RANO-Resect Class 4 Before Residual Threshold:** `preOpCeVolCm3=3.0`, `postOpCeVolCm3=2.8` (6.7% reduction < 10%) -> **`Class 4`** (Biopsy), NOT `Class 3A`!
8. **RANO-Resect Class 1 vs. Class 2A:** `preOpCeVolCm3=25`, `postOpCeVolCm3=0`, `postOpNonCeVolCm3=4.2` -> **`Class 1`**; with `postOpNonCeVolCm3=8.0` or `null` -> **`Class 2A`**.

### 8.3 Neuro-AI Audit Golden Vectors
1. **`gold_standard` preset:** `criticalBlockersFailedCount === 0`, `capApplied === false`, `overallScore >= 90`, `leakageRiskLevel === "Low"`.
2. **`slice_leakage_pitfall` preset:** `criticalBlockersFailedCount >= 4`, `rawOverallScore > 45`, `overallScore === 45`, `capApplied === true`, `leakageRiskLevel === "Critical Blocker"`.
3. **`blank` preset:** `counts.answered === 0`, `overallScore === 0`, `leakageRiskLevel === "Not Assessed"`.
4. **LaTeX Escaping:** `escapeLatex("50% IDH_1 & $100 #tag {a}^2 ~x\\y")` yields `"50\\% IDH\\_1 \\& \\$100 \\#tag \\{a\\}\\textasciicircum{}2 \\textasciitilde{}x\\textbackslash{}y"`.
5. **SVG Badge XML Validity:** Output of `exportAuditBadgeSvg(...)` parses cleanly with Python `xml.etree.ElementTree.fromstring()`.

---

## 9. Verification & GitHub Actions CI (`tests/verify_rules.py` & `.github/workflows/ci.yml`)

`tests/verify_rules.py` MUST run with **Python 3.12 stdlib only** (`json`, `re`, `pathlib`, `xml.etree.ElementTree`, `html.parser`, `sys`) and exit non-zero on any failure:

1. **Zero-Build & Offline Hygiene:** Verify all required files exist; assert zero external `http://` or `https://` `<script>`/`<link>` CDN dependencies in `index.html` and `css/styles.css`; assert clinical research disclaimer text exists in `index.html`.
2. **Schema & Domain Validation (`data/cns5_rules.json`):** Validate JSON structure, all 7 family IDs, Arabic-only CNS WHO grades, non-empty citations, and valid vignette input schemas.
3. **Audit Knowledge Base & Scoring Oracle (`data/audit_checklist.json`):** Verify exactly 6 domains × 6 items = 36 items, unique IDs, valid severity weights, valid CLAIM 2024 (`CLAIM-1`..`44`) and TRIPOD+AI (`TRIPOD+AI-1`..`27`) references, and execute Python reference scoring against all 3 built-in presets (`gold_standard`, `slice_leakage_pitfall`, `blank`) verifying exact blocker-cap behavior.
4. **ES Module Static Contract Check (`js/*.js`):** Verify every exported symbol listed in Sections 3–6 exists in its assigned module, verify every `import { ... } from './...'` in `js/app.js` resolves to an exported symbol, and verify zero DOM globals (`document.`, `window.`) inside pure logic modules (`cns5Engine.js`, `ranoCalculators.js`, `auditEngine.js`).
5. **CI Workflow (`.github/workflows/ci.yml`):** Triggers on `push` and `pull_request` to `main`, runs `python3 tests/verify_rules.py` on `ubuntu-latest` with Python 3.12, and gates GitHub Pages deployment on passing verification.
