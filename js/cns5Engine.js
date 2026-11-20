/**
 * WHO CNS5 (2021) Integrated Molecular-Histological Tumor Classifier Engine
 * Pure, deterministic, zero-dependency ES module (no DOM or network access).
 *
 * Primary Standard:
 * Louis DN, Perry A, Wesseling P, et al. The 2021 WHO Classification of Tumors
 * of the Central Nervous System: a summary. Neuro-Oncology. 2021;23(8):1231-1251.
 * doi:10.1093/neuonc/noab106
 *
 * Research & Educational Use Only — Not a Certified Medical Device (Non-SaMD).
 */

export const CNS5_FAMILIES = Object.freeze([
  "adult_diffuse_glioma",
  "pediatric_hgg",
  "pediatric_lgg",
  "circumscribed_astrocytic",
  "ependymal_tumor",
  "meningioma",
  "medulloblastoma"
]);

const BUILTIN_REFERENCES = Object.freeze({
  louis2021: {
    id: "louis2021",
    citation: "Louis DN, Perry A, Wesseling P, et al. The 2021 WHO Classification of Tumors of the Central Nervous System: a summary. Neuro-Oncology. 2021;23(8):1231-1251.",
    doi: "10.1093/neuonc/noab106"
  },
  louis2018_cimpact1: {
    id: "louis2018_cimpact1",
    citation: "Louis DN, Wesseling P, Paulus W, et al. cIMPACT-NOW update 1: Not Otherwise Specified (NOS) and Not Elsewhere Classified (NEC). Acta Neuropathologica. 2018;135(3):481-484.",
    doi: "10.1007/s00401-018-1808-0"
  },
  louis2018_cimpact2: {
    id: "louis2018_cimpact2",
    citation: "Louis DN, Giannini C, Capper D, et al. cIMPACT-NOW update 2: diagnostic clarifications for diffuse midline glioma, H3 K27M-mutant and diffuse astrocytoma/anaplastic astrocytoma, IDH-mutant. Acta Neuropathologica. 2018;135(4):639-642.",
    doi: "10.1007/s00401-018-1826-y"
  },
  brat2018_cimpact3: {
    id: "brat2018_cimpact3",
    citation: "Brat DJ, Aldape K, Colman H, et al. cIMPACT-NOW update 3: recommended diagnostic criteria for diffuse astrocytic glioma, IDH-wildtype, with molecular features of glioblastoma (CNS WHO grade 4). Acta Neuropathologica. 2018;136(5):805-810.",
    doi: "10.1007/s00401-018-1913-0"
  },
  ellison2019_cimpact4: {
    id: "ellison2019_cimpact4",
    citation: "Ellison DW, Hawkins C, Jones DTW, et al. cIMPACT-NOW update 4: diffuse gliomas characterized by MYB, MYBL1, or FGFR1 alterations or BRAFV600E mutation. Acta Neuropathologica. 2019;137(4):683-687.",
    doi: "10.1007/s00401-019-01987-0"
  },
  brat2020_cimpact5: {
    id: "brat2020_cimpact5",
    citation: "Brat DJ, Aldape K, Colman H, et al. cIMPACT-NOW update 5: recommended grading criteria and terminologies for IDH-mutant astrocytomas. Acta Neuropathologica. 2020;139(3):603-608.",
    doi: "10.1007/s00401-020-02127-9"
  },
  louis2020_cimpact6: {
    id: "louis2020_cimpact6",
    citation: "Louis DN, Wesseling P, Aldape K, et al. cIMPACT-NOW update 6: new entity and diagnostic principle recommendations of the cIMPACT-Utrecht meeting on future CNS tumor classification and grading. Brain Pathology. 2020;30(4):844-856.",
    doi: "10.1111/bpa.12832"
  },
  ellison2020_cimpact7: {
    id: "ellison2020_cimpact7",
    citation: "Ellison DW, Aldape KD, Capper D, et al. cIMPACT-NOW update 7: advancing the molecular classification of ependymal tumors. Brain Pathology. 2020;30(5):863-866.",
    doi: "10.1111/bpa.12866"
  },
  stupp2005: {
    id: "stupp2005",
    citation: "Stupp R, Mason WP, van den Bent MJ, et al. Radiotherapy plus concomitant and adjuvant temozolomide for glioblastoma. New England Journal of Medicine. 2005;352(10):987-996.",
    doi: "10.1056/NEJMoa043330"
  },
  hegi2005: {
    id: "hegi2005",
    citation: "Hegi ME, Diserens AC, Gorlia T, et al. MGMT gene silencing and benefit from temozolomide in glioblastoma. New England Journal of Medicine. 2005;352(10):997-1003.",
    doi: "10.1056/NEJMoa043331"
  },
  mellinghoff2023_indigo: {
    id: "mellinghoff2023_indigo",
    citation: "Mellinghoff IK, van den Bent MJ, Blumenthal DT, et al. Vorasidenib in IDH1- or IDH2-mutant low-grade glioma. New England Journal of Medicine. 2023;389(7):589-601.",
    doi: "10.1056/NEJMoa2304194"
  },
  appay2019_cdkn2a: {
    id: "appay2019_cdkn2a",
    citation: "Appay R, Dehais C, Maurage CA, et al. CDKN2A homozygous deletion is a strong adverse prognosis factor in diffuse malignant IDH-mutant gliomas. Neuro-Oncology. 2019;21(12):1519-1528.",
    doi: "10.1093/neuonc/noz124"
  },
  bouffet2023: {
    id: "bouffet2023",
    citation: "Bouffet E, Hansford JR, Garre ML, et al. Dabrafenib plus trametinib in pediatric glioma with BRAF V600 mutations. New England Journal of Medicine. 2023;389(12):1108-1120.",
    doi: "10.1056/NEJMoa2303815"
  },
  kilburn2024_firefly1: {
    id: "kilburn2024_firefly1",
    citation: "Kilburn LB, Khuong-Quang DA, Hansford JR, et al. The type 2 RAF inhibitor tovorafenib in relapsed/refractory pediatric low-grade glioma: the phase 2 FIREFLY-1 trial. Nature Medicine. 2024;30(1):207-217.",
    doi: "10.1038/s41591-023-02668-y"
  },
  sahm2016_tert: {
    id: "sahm2016_tert",
    citation: "Sahm F, Schrimpf D, Olar A, et al. TERT promoter mutations and risk of recurrence in meningioma. Journal of the National Cancer Institute. 2016;108(5):djv377.",
    doi: "10.1093/jnci/djv377"
  },
  sievers2020_cdkn2a: {
    id: "sievers2020_cdkn2a",
    citation: "Sievers P, Hielscher T, Schrimpf D, et al. CDKN2A/B homozygous deletion is associated with early recurrence in meningiomas. Acta Neuropathologica. 2020;140(3):409-413.",
    doi: "10.1007/s00401-020-02188-w"
  },
  katz2018_h3k27me3_meningioma: {
    id: "katz2018_h3k27me3_meningioma",
    citation: "Katz LM, Hielscher T, Liechty B, et al. Loss of histone H3K27me3 identifies a subset of meningiomas with increased risk of recurrence. Acta Neuropathologica. 2018;135(6):955-963.",
    doi: "10.1007/s00401-018-1844-9"
  },
  pajtler2015_ependymoma: {
    id: "pajtler2015_ependymoma",
    citation: "Pajtler KW, Witt H, Sill M, et al. Molecular classification of ependymal tumors across all CNS compartments, histopathological grades, and age groups. Cancer Cell. 2015;27(5):728-743.",
    doi: "10.1016/j.ccell.2015.04.002"
  },
  ghasemi2019_mycn_spinal: {
    id: "ghasemi2019_mycn_spinal",
    citation: "Ghasemi DR, Sill M, Okonechnikov K, et al. MYCN amplification drives an aggressive form of spinal ependymoma. Acta Neuropathologica. 2019;138(6):1075-1089.",
    doi: "10.1007/s00401-019-02056-2"
  },
  taylor2012_mb: {
    id: "taylor2012_mb",
    citation: "Taylor MD, Northcott PA, Korshunov A, et al. Molecular subgroups of medulloblastoma: the current consensus. Acta Neuropathologica. 2012;123(4):465-472.",
    doi: "10.1007/s00401-011-0922-z"
  },
  zhukova2013_shh_tp53: {
    id: "zhukova2013_shh_tp53",
    citation: "Zhukova N, Ramaswamy V, Remke M, et al. Subgroup-specific prognostic implications of TP53 mutation in medulloblastoma. Journal of Clinical Oncology. 2013;31(23):2927-2935.",
    doi: "10.1200/JCO.2012.48.5052"
  },
  capper2018_methylation: {
    id: "capper2018_methylation",
    citation: "Capper D, Jones DTW, Sill M, et al. DNA methylation-based classification of central nervous system tumours. Nature. 2018;555(7697):469-474.",
    doi: "10.1038/nature26000"
  },
  clarke2020_infant: {
    id: "clarke2020_infant",
    citation: "Clarke M, Mackay A, Ismer B, et al. Infant high-grade gliomas comprise multiple subgroups characterized by novel targetable gene fusions and favorable outcomes. Cancer Discovery. 2020;10(7):942-963.",
    doi: "10.1158/2159-8290.CD-19-1030"
  },
  venneti2023_onc201: {
    id: "venneti2023_onc201",
    citation: "Venneti S, Kawakibi AR, Ji S, et al. Clinical efficacy of ONC201 in H3K27M-mutant diffuse midline gliomas is driven by disruption of integrated metabolic and epigenetic pathways. Cancer Discovery. 2023;13(11):2370-2393.",
    doi: "10.1158/2159-8290.CD-23-0131"
  },
  franz2013_exist1: {
    id: "franz2013_exist1",
    citation: "Franz DN, Belousova E, Sparagana S, et al. Efficacy and safety of everolimus for subependymal giant cell astrocytomas associated with tuberous sclerosis complex (EXIST-1): a multicentre, randomised, placebo-controlled phase 3 trial. The Lancet. 2013;381(9861):125-132.",
    doi: "10.1016/S0140-6736(12)61134-9"
  },
  reinhardt2018_hgap: {
    id: "reinhardt2018_hgap",
    citation: "Reinhardt A, Stichel D, Schrimpf D, et al. Anaplastic astrocytoma with piloid features, a novel molecular class of IDH wildtype glioma with recurrent MAPK pathway, CDKN2A/B and ATRX alterations. Acta Neuropathologica. 2018;136(2):273-291.",
    doi: "10.1007/s00401-018-1837-8"
  },
  huse2017_plnty: {
    id: "huse2017_plnty",
    citation: "Huse JT, Snuderl M, Jones DTW, et al. Polymorphous low-grade neuroepithelial tumor of the young (PLNTY): an epileptogenic neoplasm with oligodendroglioma-like components, aberrant CD34 expression, and genetic alterations involving the MAP kinase pathway. Acta Neuropathologica. 2017;133(3):417-429.",
    doi: "10.1007/s00401-016-1639-9"
  },
  sturm2016_mn1: {
    id: "sturm2016_mn1",
    citation: "Sturm D, Orr BA, Toprak UH, et al. New brain tumor entities emerge from molecular classification of CNS-PNETs. Cell. 2016;164(5):1060-1072.",
    doi: "10.1016/j.cell.2016.01.015"
  }
});

/**
 * Five canonical one-click neuropathology teaching vignettes demonstrating
 * critical WHO CNS5 integrated molecular-histological diagnostic principles.
 */
export const SAMPLE_CNS5_CASES = Object.freeze([
  {
    id: "case_mol_gbm_egfr",
    title: "Histologically Low-Grade IDH-wt Astrocytoma with EGFR Amp -> Molecular GBM Grade 4",
    label: "Molecular GBM (IDH-wt, EGFR Amp, No Necrosis/MVP)",
    family: "adult_diffuse_glioma",
    clinicalVignette: "61-year-old with non-enhancing diffusely infiltrating astrocytoma lacking necrosis and microvascular proliferation, but IDH-wildtype with EGFR amplification and +7/-10 copy-number changes.",
    expectedDiagnosis: "Glioblastoma, IDH-wildtype",
    expectedGrade: 4,
    inputState: {
      family: "adult_diffuse_glioma",
      idh_status: "wildtype",
      codeletion_1p19q: "intact",
      atrx_status: "retained",
      tp53_status: "wildtype",
      cdkn2ab_homdel: "not_tested",
      tert_promoter: "wildtype",
      egfr_amplification: "present",
      chr7_gain_chr10_loss: "present",
      necrosis: false,
      mvp: false,
      mitotic_activity_high: false,
      mgmt_promoter: "methylated",
      h3_tested_wildtype: "wildtype",
      age_years: 61
    }
  },
  {
    id: "case_astro_cdkn2ab_g4",
    title: "IDH-Mutant Astrocytoma with Homozygous CDKN2A/B Deletion -> Grade 4",
    label: "IDH-Mutant Astrocytoma (CDKN2A/B HomDel -> Grade 4)",
    family: "adult_diffuse_glioma",
    clinicalVignette: "39-year-old with IDH1 R132H-mutant, ATRX-lost, 1p/19q-intact astrocytoma showing elevated mitoses without necrosis or MVP, but homozygous CDKN2A/B deletion.",
    expectedDiagnosis: "Astrocytoma, IDH-mutant",
    expectedGrade: 4,
    inputState: {
      family: "adult_diffuse_glioma",
      idh_status: "mutant",
      codeletion_1p19q: "intact",
      atrx_status: "lost",
      tp53_status: "mutant",
      cdkn2ab_homdel: "present",
      tert_promoter: "wildtype",
      egfr_amplification: "absent",
      chr7_gain_chr10_loss: "absent",
      necrosis: false,
      mvp: false,
      mitotic_activity_high: true,
      mgmt_promoter: "methylated",
      h3_tested_wildtype: "wildtype",
      age_years: 39
    }
  },
  {
    id: "case_oligo_g2",
    title: "IDH-Mutant 1p/19q-Codeleted Oligodendroglioma Grade 2",
    label: "Oligodendroglioma, IDH-mut & 1p/19q-Codel (Grade 2)",
    family: "adult_diffuse_glioma",
    clinicalVignette: "44-year-old with frontal non-enhancing glioma showing uniform round nuclei, IDH mutation, whole-arm 1p/19q codeletion, intact CDKN2A/B, and low mitotic activity.",
    expectedDiagnosis: "Oligodendroglioma, IDH-mutant and 1p/19q-codeleted",
    expectedGrade: 2,
    inputState: {
      family: "adult_diffuse_glioma",
      idh_status: "mutant",
      codeletion_1p19q: "codeleted",
      atrx_status: "retained",
      tp53_status: "wildtype",
      cdkn2ab_homdel: "absent",
      tert_promoter: "mutant",
      egfr_amplification: "absent",
      chr7_gain_chr10_loss: "absent",
      necrosis: false,
      mvp: false,
      mitotic_activity_high: false,
      mgmt_promoter: "methylated",
      h3_tested_wildtype: "wildtype",
      age_years: 44
    }
  },
  {
    id: "case_dmg_h3k27",
    title: "Midline H3 K27-Altered DMG Grade 4",
    label: "Diffuse Midline Glioma, H3 K27-Altered (Grade 4)",
    family: "pediatric_hgg",
    clinicalVignette: "11-year-old with pontine-thalamic infiltrative glioma exhibiting low-grade biopsy histology, but H3 K27M mutation and global nuclear H3 K27me3 loss.",
    expectedDiagnosis: "Diffuse midline glioma, H3 K27-altered",
    expectedGrade: 4,
    inputState: {
      family: "pediatric_hgg",
      anatomic_location: "midline",
      patient_age_group: "child_adolescent",
      h3_k27_status: "k27m_mutant",
      h3_k27me3_loss: "lost",
      h3_g34_status: "wildtype",
      idh_status: "wildtype",
      infant_rtk_fusion: "not_tested",
      pediatric_hgg_subtype: "none_or_untested",
      low_grade_histology_only: true
    }
  },
  {
    id: "case_meningioma_tert_g3",
    title: "Histologically Grade 1 Meningioma with TERT Promoter Mutation -> CNS WHO Grade 3",
    label: "Meningioma (Histologic Grade 1 + TERT+ -> Grade 3)",
    family: "meningioma",
    clinicalVignette: "58-year-old with meningothelial convexity meningioma having only 1 mitosis/10 HPF, no brain invasion, and 0 atypical features, but positive for TERT promoter mutation.",
    expectedDiagnosis: "Meningioma",
    expectedGrade: 3,
    inputState: {
      family: "meningioma",
      subtype: "meningothelial_or_common",
      mitoses_per_10hpf: 1,
      brain_invasion: false,
      atypical_features_count: 0,
      frank_anaplasia: false,
      tert_promoter: "mutant",
      cdkn2ab_homdel: "absent",
      h3k27me3_loss: "retained",
      bap1_loss: "retained",
      smarce1_loss: "retained"
    }
  }
]);

const FAMILY_FORM_CONFIGS = Object.freeze({
  adult_diffuse_glioma: {
    familyId: "adult_diffuse_glioma",
    label: "Adult-Type Diffuse Gliomas",
    shortLabel: "Adult Diffuse",
    description: "IDH-mutant astrocytoma, IDH-mutant & 1p/19q-codeleted oligodendroglioma, and IDH-wildtype glioblastoma (including molecular GBM).",
    fields: [
      {
        key: "idh_status",
        label: "IDH1/2 Status",
        type: "select",
        group: "Core Molecular Lineage",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested / unavailable" },
          { value: "mutant", label: "IDH1/2 Mutant" },
          { value: "wildtype", label: "IDH1/2 Wildtype" }
        ]
      },
      {
        key: "codeletion_1p19q",
        label: "1p/19q Whole-Arm Codeletion",
        type: "select",
        group: "Core Molecular Lineage",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "codeleted", label: "Codeleted (whole-arm 1p/19q)" },
          { value: "intact", label: "Intact (non-codeleted)" }
        ]
      },
      {
        key: "atrx_status",
        label: "ATRX Nuclear Expression",
        type: "select",
        group: "Core Molecular Lineage",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "lost", label: "Lost (mutant)" },
          { value: "retained", label: "Retained (wildtype)" }
        ]
      },
      {
        key: "tp53_status",
        label: "TP53 Status",
        type: "select",
        group: "Core Molecular Lineage",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "mutant", label: "Mutant / strong diffuse p53" },
          { value: "wildtype", label: "Wildtype" }
        ]
      },
      {
        key: "cdkn2ab_homdel",
        label: "CDKN2A/B Homozygous Deletion",
        type: "select",
        group: "Molecular Grading & GBM Markers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "present", label: "Present (homozygous deletion)" },
          { value: "absent", label: "Absent / intact" }
        ]
      },
      {
        key: "tert_promoter",
        label: "TERT Promoter Mutation",
        type: "select",
        group: "Molecular Grading & GBM Markers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "mutant", label: "Mutant (C228T / C250T)" },
          { value: "wildtype", label: "Wildtype" }
        ]
      },
      {
        key: "egfr_amplification",
        label: "EGFR Gene Amplification",
        type: "select",
        group: "Molecular Grading & GBM Markers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "present", label: "Present (amplified)" },
          { value: "absent", label: "Absent" }
        ]
      },
      {
        key: "chr7_gain_chr10_loss",
        label: "Chromosome +7 / -10 Copy-Number Change",
        type: "select",
        group: "Molecular Grading & GBM Markers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "present", label: "Present (+7 gain and -10 loss)" },
          { value: "absent", label: "Absent" }
        ]
      },
      {
        key: "necrosis",
        label: "Necrosis",
        type: "boolean",
        group: "Histologic Grading Features",
        defaultValue: false
      },
      {
        key: "mvp",
        label: "Microvascular Proliferation (MVP)",
        type: "boolean",
        group: "Histologic Grading Features",
        defaultValue: false
      },
      {
        key: "mitotic_activity_high",
        label: "Significant Mitotic Activity / Anaplasia",
        type: "boolean",
        group: "Histologic Grading Features",
        defaultValue: false
      },
      {
        key: "mgmt_promoter",
        label: "MGMT Promoter Methylation",
        type: "select",
        group: "Therapeutic & Context Modifiers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "methylated", label: "Methylated" },
          { value: "unmethylated", label: "Unmethylated" }
        ]
      },
      {
        key: "h3_tested_wildtype",
        label: "Histone H3 (K27/G34) Status",
        type: "select",
        group: "Therapeutic & Context Modifiers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "wildtype", label: "Wildtype" },
          { value: "mutant", label: "Mutant (H3 K27 or G34)" }
        ]
      },
      {
        key: "age_years",
        label: "Patient Age (years)",
        type: "number",
        group: "Therapeutic & Context Modifiers",
        defaultValue: null,
        min: 0,
        max: 120
      }
    ]
  },
  pediatric_hgg: {
    familyId: "pediatric_hgg",
    label: "Pediatric-Type Diffuse High-Grade Gliomas",
    shortLabel: "Pediatric HGG",
    description: "Diffuse midline glioma H3 K27-altered, diffuse hemispheric glioma H3 G34-mutant, H3-wt/IDH-wt pediatric HGG, and infant-type hemispheric glioma.",
    fields: [
      {
        key: "anatomic_location",
        label: "Anatomic Location",
        type: "select",
        group: "Clinical & Anatomic Context",
        defaultValue: "midline",
        options: [
          { value: "midline", label: "Midline (brainstem/pons, thalamus, spinal cord)" },
          { value: "hemispheric", label: "Cerebral Hemispheric" },
          { value: "other", label: "Other / Non-Midline" }
        ]
      },
      {
        key: "patient_age_group",
        label: "Patient Age Group",
        type: "select",
        group: "Clinical & Anatomic Context",
        defaultValue: "child_adolescent",
        options: [
          { value: "infant_under_4y", label: "Infant / Early Childhood (<4 years)" },
          { value: "child_adolescent", label: "Child / Adolescent" },
          { value: "adult", label: "Adult" }
        ]
      },
      {
        key: "h3_k27_status",
        label: "H3 K27 Alteration Pathway",
        type: "select",
        group: "Histone H3 & IDH Profiling",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "k27m_mutant", label: "H3 K27M Mutant (H3.3 or H3.1/H3.2)" },
          { value: "ezhip_overexpressed", label: "H3-Wildtype with EZHIP Overexpression" },
          { value: "egfr_mutant_midline", label: "EGFR-Mutant Midline / Bithalamic Subtype" },
          { value: "wildtype", label: "Wildtype / Absent" }
        ]
      },
      {
        key: "h3_k27me3_loss",
        label: "Nuclear H3 K27me3 Expression",
        type: "select",
        group: "Histone H3 & IDH Profiling",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "lost", label: "Global Loss of H3 K27me3" },
          { value: "retained", label: "Retained H3 K27me3" }
        ]
      },
      {
        key: "h3_g34_status",
        label: "H3 G34 (H3-3A p.G35R/V) Status",
        type: "select",
        group: "Histone H3 & IDH Profiling",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "g34r_or_g34v_mutant", label: "H3 G34R or G34V Mutant" },
          { value: "wildtype", label: "Wildtype" }
        ]
      },
      {
        key: "idh_status",
        label: "IDH1/2 Status",
        type: "select",
        group: "Histone H3 & IDH Profiling",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "wildtype", label: "IDH1/2 Wildtype" },
          { value: "mutant", label: "IDH1/2 Mutant" }
        ]
      },
      {
        key: "infant_rtk_fusion",
        label: "Infant-Type Actionable RTK Fusion",
        type: "select",
        group: "RTK Fusions & Methylation Subtype",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "ntrk_fusion", label: "NTRK1/2/3 Fusion" },
          { value: "ros1_fusion", label: "ROS1 Fusion" },
          { value: "alk_fusion", label: "ALK Fusion" },
          { value: "met_fusion", label: "MET Fusion" },
          { value: "absent", label: "Absent" }
        ]
      },
      {
        key: "pediatric_hgg_subtype",
        label: "pHGG Methylation Subclass (if H3-wt/IDH-wt)",
        type: "select",
        group: "RTK Fusions & Methylation Subtype",
        defaultValue: "none_or_untested",
        options: [
          { value: "none_or_untested", label: "None / Untested" },
          { value: "pedhgg_rtk1", label: "pHGG RTK1 (PDGFRA / Lynch / RT-associated)" },
          { value: "pedhgg_rtk2", label: "pHGG RTK2 (EGFR / TERT)" },
          { value: "pedhgg_mycn", label: "pHGG MYCN (MYCN-amplified)" }
        ]
      },
      {
        key: "low_grade_histology_only",
        label: "Low-Grade / Bland Biopsy Histology Only",
        type: "boolean",
        group: "Histology Override Check",
        defaultValue: false
      }
    ]
  },
  pediatric_lgg: {
    familyId: "pediatric_lgg",
    label: "Pediatric-Type Diffuse Low-Grade Gliomas",
    shortLabel: "Pediatric LGG",
    description: "IDH-wt/H3-wt pediatric-type diffuse LGGs driven by MYB/MYBL1 or MAPK alterations, including angiocentric glioma and PLNTY.",
    fields: [
      {
        key: "myb_mybl1_alteration",
        label: "MYB / MYBL1 Alteration (incl. MYB::QKI)",
        type: "select",
        group: "Molecular Drivers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "myb_or_mybl1_altered", label: "MYB or MYBL1 Altered" },
          { value: "absent", label: "Absent" }
        ]
      },
      {
        key: "mapk_alteration",
        label: "MAPK Pathway Alteration",
        type: "select",
        group: "Molecular Drivers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "braf_v600e", label: "BRAF p.V600E Mutation" },
          { value: "fgfr1_alteration", label: "FGFR1 Alteration (TKD dup / mutation / fusion)" },
          { value: "fgfr2_fgfr3_fusion", label: "FGFR2 or FGFR3 Fusion" },
          { value: "braf_fusion", label: "BRAF Fusion (e.g., KIAA1549::BRAF)" },
          { value: "nf1_or_other_mapk", label: "NF1 or Other MAPK Alteration" },
          { value: "absent", label: "Absent" }
        ]
      },
      {
        key: "angiocentric_histology",
        label: "Angiocentric Perivascular Rosettes (Angiocentric Histology)",
        type: "boolean",
        group: "Histologic Signatures",
        defaultValue: false
      },
      {
        key: "plnty_features",
        label: "PLNTY Features (Oligo-like + Calcifications + Strong CD34)",
        type: "boolean",
        group: "Histologic Signatures",
        defaultValue: false
      },
      {
        key: "idh_status",
        label: "IDH1/2 Exclusion Status",
        type: "select",
        group: "Exclusion Markers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "wildtype", label: "IDH1/2 Wildtype" },
          { value: "mutant", label: "IDH1/2 Mutant" }
        ]
      },
      {
        key: "h3_status",
        label: "Histone H3 Exclusion Status",
        type: "select",
        group: "Exclusion Markers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "wildtype", label: "H3 Wildtype" },
          { value: "mutant", label: "H3 Mutant" }
        ]
      }
    ]
  },
  circumscribed_astrocytic: {
    familyId: "circumscribed_astrocytic",
    label: "Circumscribed Astrocytic Gliomas",
    shortLabel: "Circumscribed",
    description: "Pilocytic astrocytoma, HGAP, pleomorphic xanthoastrocytoma (PXA), SEGA, chordoid glioma, and astroblastoma, MN1-altered.",
    fields: [
      {
        key: "morphology_subtype",
        label: "Circumscribed Morphologic Pattern",
        type: "select",
        group: "Morphology",
        defaultValue: "pilocytic",
        options: [
          { value: "pilocytic", label: "Pilocytic Astrocytoma" },
          { value: "piloid_high_grade", label: "High-Grade Astrocytoma with Piloid Features (HGAP)" },
          { value: "pxa", label: "Pleomorphic Xanthoastrocytoma (PXA)" },
          { value: "sega", label: "Subependymal Giant Cell Astrocytoma (SEGA)" },
          { value: "chordoid", label: "Chordoid Glioma" },
          { value: "astroblastoma", label: "Astroblastoma" }
        ]
      },
      {
        key: "molecular_marker",
        label: "Key Molecular / Methylation Marker",
        type: "select",
        group: "Molecular Profile",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "kiaa1549_braf", label: "KIAA1549::BRAF Fusion" },
          { value: "braf_v600e", label: "BRAF p.V600E Mutation" },
          { value: "hgap_methylation_profile", label: "HGAP DNA Methylation Profile" },
          { value: "tsc1_tsc2", label: "TSC1 / TSC2 Alteration" },
          { value: "prkca_d463h", label: "PRKCA p.D463H Mutation" },
          { value: "mn1_altered", label: "MN1 Rearrangement / Fusion" },
          { value: "nf1_or_mapk", label: "NF1 or Other MAPK Alteration" },
          { value: "absent", label: "Expected Defining Marker Absent" }
        ]
      },
      {
        key: "mitoses_per_10hpf",
        label: "Mitoses per 10 HPF (PXA Grade 2 vs. 3 at >=5)",
        type: "number",
        group: "Grading & Modifiers",
        defaultValue: null,
        min: 0,
        max: 200
      },
      {
        key: "cdkn2ab_homdel",
        label: "CDKN2A/B Homozygous Deletion",
        type: "select",
        group: "Grading & Modifiers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "present", label: "Present" },
          { value: "absent", label: "Absent" }
        ]
      }
    ]
  },
  ependymal_tumor: {
    familyId: "ependymal_tumor",
    label: "Ependymal Tumors",
    shortLabel: "Ependymal",
    description: "Anatomic-molecular ependymomas (ZFTA, YAP1, PFA, PFB, Spinal, MYCN-amplified), myxopapillary ependymoma (CNS WHO grade 2), and subependymoma (grade 1).",
    fields: [
      {
        key: "compartment",
        label: "Anatomic Compartment",
        type: "select",
        group: "Anatomic & Histologic Classification",
        defaultValue: "supratentorial",
        options: [
          { value: "supratentorial", label: "Supratentorial" },
          { value: "posterior_fossa", label: "Posterior Fossa" },
          { value: "spinal", label: "Spinal" }
        ]
      },
      {
        key: "histology_variant",
        label: "Histologic Variant",
        type: "select",
        group: "Anatomic & Histologic Classification",
        defaultValue: "classic_or_ependymoma",
        options: [
          { value: "classic_or_ependymoma", label: "Conventional Ependymoma" },
          { value: "myxopapillary", label: "Myxopapillary Ependymoma" },
          { value: "subependymoma", label: "Subependymoma" }
        ]
      },
      {
        key: "anaplastic_features",
        label: "High-Grade / Anaplastic Features (Brisk Mitoses, MVP, Hypercellularity)",
        type: "boolean",
        group: "Anatomic & Histologic Classification",
        defaultValue: false
      },
      {
        key: "st_fusion",
        label: "Supratentorial Fusion Status (ZFTA / YAP1)",
        type: "select",
        group: "Compartment Molecular Drivers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "zfta_fusion", label: "ZFTA Fusion-Positive (e.g., ZFTA::RELA)" },
          { value: "yap1_fusion", label: "YAP1 Fusion-Positive (e.g., YAP1::MAMLD1)" },
          { value: "absent", label: "Both ZFTA & YAP1 Fusions Absent" }
        ]
      },
      {
        key: "pf_methylation_h3k27me3",
        label: "Posterior Fossa H3 K27me3 / Methylation Class",
        type: "select",
        group: "Compartment Molecular Drivers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "pfa_h3k27me3_lost", label: "PFA (H3 K27me3 Lost / PFA Methylation)" },
          { value: "pfb_h3k27me3_retained", label: "PFB (H3 K27me3 Retained / PFB Methylation)" },
          { value: "indeterminate_or_other", label: "Indeterminate / Non-PFA-PFB" }
        ]
      },
      {
        key: "mycn_amplification",
        label: "Spinal MYCN Amplification",
        type: "select",
        group: "Compartment Molecular Drivers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "present", label: "Present (MYCN-amplified)" },
          { value: "absent", label: "Absent" }
        ]
      }
    ]
  },
  meningioma: {
    familyId: "meningioma",
    label: "Meningiomas",
    shortLabel: "Meningioma",
    description: "Combined histological and molecular grading (TERT promoter mutation or CDKN2A/B homozygous deletion trigger automatic CNS WHO grade 3).",
    fields: [
      {
        key: "subtype",
        label: "Histologic Subtype",
        type: "select",
        group: "Histology & Grading",
        defaultValue: "meningothelial_or_common",
        options: [
          { value: "meningothelial_or_common", label: "Meningothelial / Fibrous / Transitional / Common" },
          { value: "chordoid", label: "Chordoid (intrinsic grade >=2)" },
          { value: "clear_cell", label: "Clear Cell (intrinsic grade >=2)" },
          { value: "rhabdoid", label: "Rhabdoid (no longer automatic grade 3 in CNS5)" },
          { value: "papillary", label: "Papillary (no longer automatic grade 3 in CNS5)" },
          { value: "secretory", label: "Secretory (KLF4/TRAF7)" }
        ]
      },
      {
        key: "mitoses_per_10hpf",
        label: "Mitoses per 10 HPF (4-19 -> Grade 2; >=20 -> Grade 3)",
        type: "number",
        group: "Histology & Grading",
        defaultValue: 0,
        min: 0,
        max: 200
      },
      {
        key: "brain_invasion",
        label: "Unambiguous Brain Invasion (CNS WHO Grade 2 Criterion)",
        type: "boolean",
        group: "Histology & Grading",
        defaultValue: false
      },
      {
        key: "atypical_features_count",
        label: "Atypical Features Present (0-5; >=3 -> Grade 2)",
        type: "number",
        group: "Histology & Grading",
        defaultValue: 0,
        min: 0,
        max: 5
      },
      {
        key: "frank_anaplasia",
        label: "Frank Anaplasia (Sarcoma-, Carcinoma-, or Melanoma-Like -> Grade 3)",
        type: "boolean",
        group: "Histology & Grading",
        defaultValue: false
      },
      {
        key: "tert_promoter",
        label: "TERT Promoter Mutation (Molecular Grade 3 Trigger)",
        type: "select",
        group: "Molecular Grading & Prognostic Biomarkers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "mutant", label: "Mutant (automatic CNS WHO grade 3)" },
          { value: "wildtype", label: "Wildtype" }
        ]
      },
      {
        key: "cdkn2ab_homdel",
        label: "CDKN2A/B Homozygous Deletion (Molecular Grade 3 Trigger)",
        type: "select",
        group: "Molecular Grading & Prognostic Biomarkers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "present", label: "Present (automatic CNS WHO grade 3)" },
          { value: "absent", label: "Absent / intact" }
        ]
      },
      {
        key: "h3k27me3_loss",
        label: "H3 K27me3 Loss (Recurrence Risk Biomarker)",
        type: "select",
        group: "Molecular Grading & Prognostic Biomarkers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "lost", label: "Lost (elevated recurrence risk)" },
          { value: "retained", label: "Retained" }
        ]
      },
      {
        key: "bap1_loss",
        label: "BAP1 Expression",
        type: "select",
        group: "Molecular Grading & Prognostic Biomarkers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "lost", label: "Lost (BAP1 syndrome risk)" },
          { value: "retained", label: "Retained" }
        ]
      },
      {
        key: "smarce1_loss",
        label: "SMARCE1 Expression",
        type: "select",
        group: "Molecular Grading & Prognostic Biomarkers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "lost", label: "Lost (clear cell / SMARCE1 syndrome risk)" },
          { value: "retained", label: "Retained" }
        ]
      }
    ]
  },
  medulloblastoma: {
    familyId: "medulloblastoma",
    label: "Medulloblastomas",
    shortLabel: "Medulloblastoma",
    description: "Molecularly defined CNS WHO grade 4 embryonal tumors: WNT-activated, SHH-activated TP53-wt, SHH-activated TP53-mutant, and non-WNT/non-SHH.",
    fields: [
      {
        key: "molecular_group",
        label: "Molecular Group",
        type: "select",
        group: "Molecular Subgrouping",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "wnt", label: "WNT-activated" },
          { value: "shh", label: "SHH-activated" },
          { value: "non_wnt_non_shh", label: "Non-WNT / Non-SHH (Group 3 / Group 4)" },
          { value: "indeterminate", label: "Indeterminate / Unclassifiable" }
        ]
      },
      {
        key: "tp53_status",
        label: "TP53 Status (Mandatory for SHH-Activated)",
        type: "select",
        group: "Molecular Subgrouping",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "wildtype", label: "TP53-Wildtype" },
          { value: "mutant", label: "TP53-Mutant" }
        ]
      },
      {
        key: "non_wnt_subgroup",
        label: "Non-WNT/Non-SHH Subgroup (if known)",
        type: "select",
        group: "Molecular Subgrouping",
        defaultValue: "unspecified",
        options: [
          { value: "unspecified", label: "Unspecified" },
          { value: "group_3", label: "Group 3" },
          { value: "group_4", label: "Group 4" }
        ]
      },
      {
        key: "histology",
        label: "Histologic Pattern",
        type: "select",
        group: "Histology & Risk Modifiers",
        defaultValue: "classic",
        options: [
          { value: "classic", label: "Classic" },
          { value: "desmoplastic_nodular", label: "Desmoplastic / Nodular" },
          { value: "mben", label: "Medulloblastoma with Extensive Nodularity (MBEN)" },
          { value: "large_cell_anaplastic", label: "Large Cell / Anaplastic (high-risk)" }
        ]
      },
      {
        key: "myc_mycn_amplification",
        label: "MYC / MYCN Amplification",
        type: "select",
        group: "Histology & Risk Modifiers",
        defaultValue: "not_tested",
        options: [
          { value: "not_tested", label: "Not tested" },
          { value: "none", label: "None / Not amplified" },
          { value: "myc_amp", label: "MYC Amplification" },
          { value: "mycn_amp", label: "MYCN Amplification" }
        ]
      }
    ]
  }
});

/* -------------------------------------------------------------------------- */
/* Internal Helpers                                                           */
/* -------------------------------------------------------------------------- */

function toBool(value) {
  return value === true || value === "true";
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toEnum(value, allowed, fallback) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function formatGradeDisplay(grade) {
  if (grade === 1 || grade === 2 || grade === 3 || grade === 4) {
    return `CNS WHO grade ${grade}`;
  }
  return "CNS WHO grade not assigned";
}

function resolveReferences(refIds, rulesData) {
  const seen = new Set();
  const resolved = [];
  const externalRefs = rulesData && typeof rulesData === "object" && rulesData.references
    ? rulesData.references
    : null;

  for (const id of refIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const refObj = (externalRefs && externalRefs[id]) || BUILTIN_REFERENCES[id];
    if (refObj) {
      resolved.push({
        id: refObj.id || id,
        citation: refObj.citation,
        ...(refObj.doi ? { doi: refObj.doi } : {})
      });
    }
  }
  if (resolved.length === 0) {
    resolved.push({ ...BUILTIN_REFERENCES.louis2021 });
  }
  return resolved;
}

function addStep(decisionPath, stepId, label, value, outcome, status) {
  decisionPath.push({ stepId, label, value, outcome, status });
}

function pushUnique(list, text) {
  if (text && !list.includes(text)) {
    list.push(text);
  }
}

function humanizeToken(token) {
  const MAP = {
    not_tested: "Not tested",
    mutant: "Mutant",
    wildtype: "Wildtype",
    present: "Present",
    absent: "Absent",
    codeleted: "Codeleted",
    intact: "Intact",
    lost: "Lost",
    retained: "Retained",
    methylated: "Methylated",
    unmethylated: "Unmethylated",
    midline: "Midline",
    hemispheric: "Hemispheric",
    other: "Other / Non-midline",
    infant_under_4y: "Infant (<4 years)",
    child_adolescent: "Child / Adolescent",
    adult: "Adult",
    k27m_mutant: "H3 K27M mutant",
    ezhip_overexpressed: "EZHIP overexpressed",
    egfr_mutant_midline: "EGFR-mutant midline",
    g34r_or_g34v_mutant: "H3 G34R/V mutant",
    ntrk_fusion: "NTRK fusion",
    ros1_fusion: "ROS1 fusion",
    alk_fusion: "ALK fusion",
    met_fusion: "MET fusion",
    pedhgg_rtk1: "pHGG RTK1",
    pedhgg_rtk2: "pHGG RTK2",
    pedhgg_mycn: "pHGG MYCN",
    none_or_untested: "Unspecified / untested",
    myb_or_mybl1_altered: "MYB/MYBL1 altered",
    braf_v600e: "BRAF p.V600E",
    fgfr1_alteration: "FGFR1 alteration",
    fgfr2_fgfr3_fusion: "FGFR2/FGFR3 fusion",
    braf_fusion: "BRAF fusion",
    nf1_or_other_mapk: "NF1 / other MAPK alteration",
    pilocytic: "Pilocytic astrocytoma",
    piloid_high_grade: "Piloid high-grade astrocytoma",
    pxa: "Pleomorphic xanthoastrocytoma",
    sega: "SEGA",
    chordoid: "Chordoid",
    astroblastoma: "Astroblastoma",
    kiaa1549_braf: "KIAA1549::BRAF fusion",
    hgap_methylation_profile: "HGAP DNA methylation profile",
    tsc1_tsc2: "TSC1/TSC2 alteration",
    prkca_d463h: "PRKCA p.D463H",
    mn1_altered: "MN1 altered",
    supratentorial: "Supratentorial",
    posterior_fossa: "Posterior fossa",
    spinal: "Spinal",
    classic_or_ependymoma: "Conventional ependymoma",
    subependymoma: "Subependymoma",
    myxopapillary: "Myxopapillary ependymoma",
    zfta_fusion: "ZFTA fusion-positive",
    yap1_fusion: "YAP1 fusion-positive",
    pfa_h3k27me3_lost: "PFA (H3 K27me3 lost)",
    pfb_h3k27me3_retained: "PFB (H3 K27me3 retained)",
    indeterminate_or_other: "Indeterminate / non-PFA-PFB",
    meningothelial_or_common: "Meningothelial / common subtype",
    clear_cell: "Clear cell subtype",
    rhabdoid: "Rhabdoid subtype",
    papillary: "Papillary subtype",
    secretory: "Secretory subtype",
    wnt: "WNT-activated",
    shh: "SHH-activated",
    non_wnt_non_shh: "Non-WNT / Non-SHH",
    indeterminate: "Indeterminate",
    classic: "Classic",
    desmoplastic_nodular: "Desmoplastic / nodular",
    mben: "MBEN",
    large_cell_anaplastic: "Large cell / anaplastic",
    group_3: "Group 3",
    group_4: "Group 4",
    unspecified: "Unspecified",
    myc_amp: "MYC amplified",
    mycn_amp: "MYCN amplified",
    none: "None"
  };
  return Object.prototype.hasOwnProperty.call(MAP, token) ? MAP[token] : String(token);
}

/* -------------------------------------------------------------------------- */
/* Public Defaults & Form Configuration                                       */
/* -------------------------------------------------------------------------- */

export function getDefaultCns5Input(family = "adult_diffuse_glioma") {
  const validFamily = CNS5_FAMILIES.includes(family) ? family : "adult_diffuse_glioma";
  switch (validFamily) {
    case "adult_diffuse_glioma":
      return {
        family: "adult_diffuse_glioma",
        idh_status: "not_tested",
        codeletion_1p19q: "not_tested",
        atrx_status: "not_tested",
        tp53_status: "not_tested",
        cdkn2ab_homdel: "not_tested",
        tert_promoter: "not_tested",
        egfr_amplification: "not_tested",
        chr7_gain_chr10_loss: "not_tested",
        necrosis: false,
        mvp: false,
        mitotic_activity_high: false,
        mgmt_promoter: "not_tested",
        h3_tested_wildtype: "not_tested",
        age_years: null
      };
    case "pediatric_hgg":
      return {
        family: "pediatric_hgg",
        anatomic_location: "midline",
        patient_age_group: "child_adolescent",
        h3_k27_status: "not_tested",
        h3_k27me3_loss: "not_tested",
        h3_g34_status: "not_tested",
        idh_status: "not_tested",
        infant_rtk_fusion: "not_tested",
        pediatric_hgg_subtype: "none_or_untested",
        low_grade_histology_only: false
      };
    case "pediatric_lgg":
      return {
        family: "pediatric_lgg",
        myb_mybl1_alteration: "not_tested",
        angiocentric_histology: false,
        plnty_features: false,
        mapk_alteration: "not_tested",
        idh_status: "not_tested",
        h3_status: "not_tested"
      };
    case "circumscribed_astrocytic":
      return {
        family: "circumscribed_astrocytic",
        morphology_subtype: "pilocytic",
        molecular_marker: "not_tested",
        mitoses_per_10hpf: null,
        cdkn2ab_homdel: "not_tested"
      };
    case "ependymal_tumor":
      return {
        family: "ependymal_tumor",
        compartment: "supratentorial",
        histology_variant: "classic_or_ependymoma",
        anaplastic_features: false,
        st_fusion: "not_tested",
        pf_methylation_h3k27me3: "not_tested",
        mycn_amplification: "not_tested"
      };
    case "meningioma":
      return {
        family: "meningioma",
        subtype: "meningothelial_or_common",
        mitoses_per_10hpf: 0,
        brain_invasion: false,
        atypical_features_count: 0,
        frank_anaplasia: false,
        tert_promoter: "not_tested",
        cdkn2ab_homdel: "not_tested",
        h3k27me3_loss: "not_tested",
        bap1_loss: "not_tested",
        smarce1_loss: "not_tested"
      };
    case "medulloblastoma":
      return {
        family: "medulloblastoma",
        molecular_group: "not_tested",
        tp53_status: "not_tested",
        histology: "classic",
        non_wnt_subgroup: "unspecified",
        myc_mycn_amplification: "not_tested"
      };
    default:
      return getDefaultCns5Input("adult_diffuse_glioma");
  }
}

export function getFamilyFormConfig(familyId = "adult_diffuse_glioma") {
  const validFamily = CNS5_FAMILIES.includes(familyId) ? familyId : "adult_diffuse_glioma";
  const base = FAMILY_FORM_CONFIGS[validFamily];
  return {
    familyId: base.familyId,
    label: base.label,
    shortLabel: base.shortLabel,
    description: base.description,
    defaults: getDefaultCns5Input(validFamily),
    fields: base.fields.map((field) => ({
      ...field,
      ...(field.options ? { options: field.options.map((opt) => ({ ...opt })) } : {})
    }))
  };
}

/* -------------------------------------------------------------------------- */
/* Family Classifiers                                                         */
/* -------------------------------------------------------------------------- */

function classifyAdultDiffuseGlioma(raw, rulesData) {
  const s = {
    idh_status: toEnum(raw.idh_status, ["mutant", "wildtype", "not_tested"], "not_tested"),
    codeletion_1p19q: toEnum(raw.codeletion_1p19q, ["codeleted", "intact", "not_tested"], "not_tested"),
    atrx_status: toEnum(raw.atrx_status, ["lost", "retained", "not_tested"], "not_tested"),
    tp53_status: toEnum(raw.tp53_status, ["mutant", "wildtype", "not_tested"], "not_tested"),
    cdkn2ab_homdel: toEnum(raw.cdkn2ab_homdel, ["present", "absent", "not_tested"], "not_tested"),
    tert_promoter: toEnum(raw.tert_promoter, ["mutant", "wildtype", "not_tested"], "not_tested"),
    egfr_amplification: toEnum(raw.egfr_amplification, ["present", "absent", "not_tested"], "not_tested"),
    chr7_gain_chr10_loss: toEnum(raw.chr7_gain_chr10_loss, ["present", "absent", "not_tested"], "not_tested"),
    necrosis: toBool(raw.necrosis),
    mvp: toBool(raw.mvp),
    mitotic_activity_high: toBool(raw.mitotic_activity_high),
    mgmt_promoter: toEnum(raw.mgmt_promoter, ["methylated", "unmethylated", "not_tested"], "not_tested"),
    h3_tested_wildtype: toEnum(raw.h3_tested_wildtype, ["wildtype", "mutant", "not_tested"], "not_tested"),
    age_years: toNullableNumber(raw.age_years)
  };

  const criteriaMatched = [];
  const decisionPath = [];
  const clinicalPearls = [];
  const warnings = [];
  const refIds = ["louis2021"];

  if (s.age_years !== null && s.age_years < 0) {
    s.age_years = null;
    pushUnique(warnings, "Invalid negative patient age ignored; enter a non-negative age in years.");
  }

  let diagnosis = "";
  let entityId = "";
  let cnsWhoGrade = "Not assigned";
  let molecularUpgradeTriggered = false;
  let nosNecStatus = "none";
  let nosNecNote = null;

  const hasNecrosisOrMvp = s.necrosis || s.mvp;
  const histoHighList = [];
  if (s.necrosis) histoHighList.push("necrosis");
  if (s.mvp) histoHighList.push("microvascular proliferation (MVP)");
  if (s.mitotic_activity_high) histoHighList.push("significant mitotic activity/anaplasia");

  if (s.idh_status === "not_tested") {
    refIds.push("louis2018_cimpact1");
    nosNecStatus = "NOS";
    addStep(
      decisionPath,
      "step_idh",
      "IDH1/2 Molecular Status",
      "Not tested",
      "Required IDH testing unavailable -> assign NOS designation",
      "nos_nec"
    );

    if (hasNecrosisOrMvp) {
      diagnosis = "Glioblastoma, NOS";
      entityId = "adult_glioma_gbm_nos";
      cnsWhoGrade = 4;
      criteriaMatched.push(`IDH1/2 status not tested; histologic ${histoHighList.join(" + ")} present`);
      addStep(
        decisionPath,
        "step_histology",
        "Histologic High-Grade Features",
        histoHighList.join(", "),
        "Meets histologic grade 4 criteria without IDH testing -> Glioblastoma, NOS",
        "nos_nec"
      );
      nosNecNote = "IDH1/2 molecular testing was not performed or failed. Under WHO CNS5, diffuse glioma with microvascular proliferation and/or necrosis without IDH status is reported as 'Glioblastoma, NOS' (CNS WHO grade 4). Reflex IDH1/2 testing (plus H3 K27/G34 exclusion in younger adults) is recommended.";
    } else if (s.mitotic_activity_high) {
      diagnosis = "Diffuse glioma, high-grade, NOS";
      entityId = "adult_glioma_hg_nos";
      cnsWhoGrade = 3;
      criteriaMatched.push("IDH1/2 status not tested; significant mitotic activity/anaplasia without necrosis or MVP");
      addStep(
        decisionPath,
        "step_histology",
        "Histologic Grading",
        "High mitotic activity / anaplasia",
        "Provisional CNS WHO grade 3 pending IDH1/2, 1p/19q, CDKN2A/B, and molecular GBM workup",
        "nos_nec"
      );
      nosNecNote = "IDH1/2 testing is required to separate Astrocytoma, IDH-mutant, Oligodendroglioma, IDH-mutant and 1p/19q-codeleted, and molecular Glioblastoma, IDH-wildtype (CNS WHO grade 4).";
    } else {
      diagnosis = "Diffuse glioma, NOS";
      entityId = "adult_glioma_nos";
      cnsWhoGrade = 2;
      criteriaMatched.push("IDH1/2 status not tested; histologically low-grade diffuse glioma");
      addStep(
        decisionPath,
        "step_histology",
        "Histologic Grading",
        "Low-grade histology (no necrosis, MVP, or brisk mitoses)",
        "Provisional CNS WHO grade 2 pending IDH1/2 and molecular grading markers",
        "nos_nec"
      );
      nosNecNote = "IDH1/2 testing is essential: a histologically low-grade diffuse glioma in an adult may represent IDH-mutant astrocytoma/oligodendroglioma (CNS WHO grade 2 or CDKN2A/B-deleted grade 4) or molecular Glioblastoma, IDH-wildtype (CNS WHO grade 4).";
    }

    if (s.h3_tested_wildtype === "mutant") {
      pushUnique(warnings, "H3 mutation was reported while IDH was not tested: verify IDH status and evaluate under Pediatric-type diffuse high-grade gliomas (e.g., DMG H3 K27-altered or DHG H3 G34-mutant).");
    }
    if (s.cdkn2ab_homdel === "present" || s.tert_promoter === "mutant" || s.egfr_amplification === "present" || s.chr7_gain_chr10_loss === "present") {
      pushUnique(warnings, "High-risk molecular marker(s) were reported despite missing IDH testing; complete IDH1/2 sequencing to establish definitive CNS WHO grade 4 molecular classification.");
    }
  } else if (s.idh_status === "mutant") {
    criteriaMatched.push("IDH1/2 mutation present");
    addStep(
      decisionPath,
      "step_idh",
      "IDH1/2 Molecular Status",
      "Mutant",
      "IDH-mutant diffuse glioma lineage -> evaluate 1p/19q and ATRX",
      "pass"
    );

    if (s.h3_tested_wildtype === "mutant") {
      pushUnique(warnings, "Co-occurring IDH and H3 mutations are exceedingly rare; verify sequencing calls and consider DNA methylation profiling.");
    }

    if (s.codeletion_1p19q === "codeleted") {
      diagnosis = "Oligodendroglioma, IDH-mutant and 1p/19q-codeleted";
      entityId = "oligodendroglioma_idh_mut_1p19q";
      criteriaMatched.push("Combined whole-arm 1p/19q codeletion present");
      refIds.push("appay2019_cdkn2a");

      addStep(
        decisionPath,
        "step_1p19q",
        "1p/19q & ATRX Lineage",
        "1p/19q Codeleted",
        "Defines Oligodendroglioma, IDH-mutant and 1p/19q-codeleted",
        "pass"
      );

      if (s.atrx_status === "lost") {
        pushUnique(warnings, "Discordant profile: ATRX loss with 1p/19q codeletion is exceptionally rare. Confirm whole-arm (not partial) 1p/19q codeletion via NGS/SNP array and verify ATRX IHC internal positive controls.");
      }
      if (s.tp53_status === "mutant") {
        pushUnique(warnings, "Discordant profile: TP53 mutation rarely co-occurs with true whole-arm 1p/19q codeletion; confirm whole-arm 1p/19q status.");
      }

      const hasHistGrade3 = hasNecrosisOrMvp || s.mitotic_activity_high;
      const hasCdkn2ab = s.cdkn2ab_homdel === "present";

      if (hasHistGrade3) {
        cnsWhoGrade = 3;
        molecularUpgradeTriggered = false;
        criteriaMatched.push(`High-grade histologic features present (${histoHighList.join(", ")}) -> CNS WHO grade 3`);
        if (hasCdkn2ab) {
          criteriaMatched.push("CDKN2A/B homozygous deletion present (adverse prognostic biomarker supporting CNS WHO grade 3 behavior in oligodendroglioma)");
          pushUnique(clinicalPearls, "CDKN2A/B homozygous deletion in CNS WHO grade 3 oligodendroglioma is an adverse prognostic biomarker associated with shorter survival (Appay et al., Neuro-Oncology 2019).");
        }
        addStep(
          decisionPath,
          "step_grade",
          "Oligodendroglioma Grading (Histology + CDKN2A/B)",
          hasCdkn2ab
            ? `${histoHighList.join(", ")} + CDKN2A/B homdel`
            : histoHighList.join(", "),
          "Meets histological CNS WHO grade 3 criteria",
          "pass"
        );
      } else {
        cnsWhoGrade = 2;
        molecularUpgradeTriggered = false;
        if (hasCdkn2ab) {
          criteriaMatched.push("No brisk mitotic activity, MVP, or necrosis -> histological CNS WHO grade 2 (CDKN2A/B homozygous deletion present as adverse prognostic marker)");
          addStep(
            decisionPath,
            "step_grade",
            "Oligodendroglioma Grading (Histology + CDKN2A/B)",
            "Low-grade histology; CDKN2A/B homdel present (adverse marker)",
            "Assign histological CNS WHO grade 2 with high-risk prognostic alert (WHO CNS5 retains histological grading; CDKN2A/B homdel is not an unconditional standalone upgrade rule in oligodendroglioma)",
            "warning"
          );
          pushUnique(
            warnings,
            "CDKN2A/B homozygous deletion in histologically low-grade Oligodendroglioma, IDH-mutant and 1p/19q-codeleted: under WHO CNS5 (Louis et al., 2021; WHO 5th ed. Blue Book), oligodendroglioma grading remains histological and CDKN2A/B homozygous deletion is NOT an unconditional standalone molecular grade-upgrade rule (unlike Astrocytoma, IDH-mutant or Meningioma). Because CDKN2A/B homdel is an adverse prognostic marker that may support CNS WHO grade 3 specifically in histologically borderline/equivocal cases, re-evaluate mitotic count, microvascular proliferation, sampling adequacy, and whole-arm 1p/19q status."
          );
        } else {
          criteriaMatched.push("No brisk mitotic activity, MVP, or necrosis -> CNS WHO grade 2");
          addStep(
            decisionPath,
            "step_grade",
            "Oligodendroglioma Grading (Histology + CDKN2A/B)",
            "Low-grade histology; no CDKN2A/B homozygous deletion",
            "Assign CNS WHO grade 2",
            "pass"
          );
        }
        refIds.push("mellinghoff2023_indigo");
        pushUnique(clinicalPearls, "Vorasidenib (dual mutant IDH1/2 inhibitor): INDIGO phase 3 trial (Mellinghoff et al., NEJM 2023) demonstrated significantly prolonged PFS and time to next intervention in residual or recurrent CNS WHO grade 2 IDH-mutant glioma.");
      }

      pushUnique(clinicalPearls, "WHO CNS5 retired the modifier 'anaplastic'; grade 3 tumors are termed 'Oligodendroglioma, IDH-mutant and 1p/19q-codeleted, CNS WHO grade 3'.");
      pushUnique(clinicalPearls, "IDH-mutant, 1p/19q-codeleted oligodendrogliomas demonstrate favorable chemosensitivity to alkylating regimens (PCV or temozolomide).");
    } else if (s.codeletion_1p19q === "intact" || (s.codeletion_1p19q === "not_tested" && s.atrx_status === "lost")) {
      diagnosis = "Astrocytoma, IDH-mutant";
      entityId = "astrocytoma_idh_mut";
      refIds.push("louis2018_cimpact2", "brat2020_cimpact5", "appay2019_cdkn2a");

      if (s.codeletion_1p19q === "intact") {
        criteriaMatched.push("1p/19q intact -> astrocytic lineage");
        addStep(
          decisionPath,
          "step_1p19q",
          "1p/19q & ATRX Lineage",
          `1p/19q Intact${s.atrx_status === "lost" ? " + ATRX Lost" : ""}`,
          "Establishes Astrocytoma, IDH-mutant",
          "pass"
        );
      } else {
        criteriaMatched.push("ATRX loss in IDH-mutant diffuse glioma establishes Astrocytoma, IDH-mutant without mandatory 1p/19q testing (cIMPACT-NOW Update 2)");
        addStep(
          decisionPath,
          "step_1p19q",
          "1p/19q & ATRX Lineage",
          "ATRX Lost (1p/19q not tested)",
          "Unequivocal ATRX loss establishes Astrocytoma, IDH-mutant per WHO CNS5 / cIMPACT-NOW Update 2",
          "pass"
        );
      }

      if (s.codeletion_1p19q === "intact" && s.atrx_status === "retained" && s.tert_promoter === "mutant") {
        pushUnique(warnings, "Unusual profile: IDH-mutant glioma with intact 1p/19q, retained ATRX, and TERT promoter mutation — verify 1p/19q testing sensitivity (rule out false-negative FISH) and consider DNA methylation profiling.");
      }

      const hasCdkn2ab = s.cdkn2ab_homdel === "present";
      if (hasNecrosisOrMvp || hasCdkn2ab) {
        cnsWhoGrade = 4;
        molecularUpgradeTriggered = hasCdkn2ab && !hasNecrosisOrMvp;
        if (hasNecrosisOrMvp) {
          criteriaMatched.push(`Histologic ${s.necrosis && s.mvp ? "necrosis and MVP" : s.necrosis ? "necrosis" : "microvascular proliferation"} present -> CNS WHO grade 4`);
        }
        if (hasCdkn2ab) {
          criteriaMatched.push("CDKN2A/B homozygous deletion present -> automatic CNS WHO grade 4 regardless of histology (cIMPACT-NOW Update 5 / WHO CNS5)");
        }
        addStep(
          decisionPath,
          "step_cdkn2ab",
          "CDKN2A/B & Histologic Grade 4 Criteria",
          molecularUpgradeTriggered
            ? "CDKN2A/B homozygous deletion (no necrosis/MVP)"
            : hasCdkn2ab
              ? `${histoHighList.join(", ")} + CDKN2A/B homdel`
              : histoHighList.join(", "),
          molecularUpgradeTriggered
            ? "MOLECULAR UPGRADE: CDKN2A/B homozygous deletion elevates Astrocytoma, IDH-mutant to CNS WHO grade 4"
            : "Meets CNS WHO grade 4 criteria",
          molecularUpgradeTriggered ? "upgrade" : "pass"
        );
        pushUnique(clinicalPearls, "WHO CNS5 retired the term 'Glioblastoma, IDH-mutant'; these tumors are now strictly classified as 'Astrocytoma, IDH-mutant, CNS WHO grade 4' with distinct biology and improved survival compared to IDH-wildtype glioblastoma.");
      } else if (s.mitotic_activity_high) {
        cnsWhoGrade = 3;
        criteriaMatched.push("Significant mitotic activity/anaplasia without necrosis, MVP, or CDKN2A/B homozygous deletion -> CNS WHO grade 3");
        addStep(
          decisionPath,
          "step_grade",
          "Astrocytoma Grading (Mitotic Activity & CDKN2A/B)",
          `High mitotic activity; CDKN2A/B ${humanizeToken(s.cdkn2ab_homdel)}`,
          "Assign CNS WHO grade 3",
          s.cdkn2ab_homdel === "not_tested" ? "warning" : "pass"
        );
        if (s.cdkn2ab_homdel === "not_tested") {
          pushUnique(warnings, "CDKN2A/B homozygous deletion was not tested; strongly recommended in grade 3 IDH-mutant astrocytomas to exclude molecular CNS WHO grade 4.");
        }
      } else {
        cnsWhoGrade = 2;
        criteriaMatched.push("Low mitotic activity without necrosis, MVP, or CDKN2A/B homozygous deletion -> CNS WHO grade 2");
        addStep(
          decisionPath,
          "step_grade",
          "Astrocytoma Grading (Histology & CDKN2A/B)",
          `Low-grade histology; CDKN2A/B ${humanizeToken(s.cdkn2ab_homdel)}`,
          "Assign CNS WHO grade 2",
          "pass"
        );
        refIds.push("mellinghoff2023_indigo");
        pushUnique(clinicalPearls, "Vorasidenib (dual mutant IDH1/2 inhibitor): INDIGO phase 3 trial (Mellinghoff et al., NEJM 2023) demonstrated significantly prolonged PFS and time to next intervention in residual or recurrent CNS WHO grade 2 IDH-mutant glioma.");
        if (s.cdkn2ab_homdel === "not_tested") {
          pushUnique(warnings, "CDKN2A/B status not tested; consider testing if atypical/borderline features exist to exclude occult CNS WHO grade 4.");
        }
      }
    } else {
      // IDH-mutant, 1p/19q not tested, ATRX not lost -> NOS
      diagnosis = "Diffuse glioma, IDH-mutant, NOS";
      entityId = "adult_glioma_idh_mut_nos";
      nosNecStatus = "NOS";
      refIds.push("louis2018_cimpact1", "brat2020_cimpact5");
      const hasCdkn2ab = s.cdkn2ab_homdel === "present";

      addStep(
        decisionPath,
        "step_1p19q",
        "1p/19q & ATRX Lineage",
        `1p/19q Not tested; ATRX ${humanizeToken(s.atrx_status)}`,
        "Cannot definitively distinguish Astrocytoma vs. Oligodendroglioma -> NOS",
        "nos_nec"
      );

      if (hasNecrosisOrMvp || hasCdkn2ab) {
        cnsWhoGrade = 4;
        molecularUpgradeTriggered = hasCdkn2ab && !hasNecrosisOrMvp;
        criteriaMatched.push("Provisional CNS WHO grade 4 (necrosis/MVP or CDKN2A/B homozygous deletion)");
        if (s.atrx_status === "retained") {
          pushUnique(
            warnings,
            hasCdkn2ab
              ? "Retained nuclear ATRX favors Oligodendroglioma, IDH-mutant and 1p/19q-codeleted, which is NEVER assigned CNS WHO grade 4 (maximum grade 3) and in which CDKN2A/B homozygous deletion is NOT an unconditional standalone molecular grade-upgrade rule. Provisional CNS WHO grade 4 applies only if whole-arm 1p/19q is intact (Astrocytoma, IDH-mutant); perform urgent 1p/19q testing before finalizing grade."
              : "Retained nuclear ATRX favors Oligodendroglioma, IDH-mutant and 1p/19q-codeleted, which is assigned CNS WHO grade 3 (NEVER grade 4) even when necrosis or microvascular proliferation is present. Perform urgent whole-arm 1p/19q testing before finalizing CNS WHO grade 4."
          );
        }
      } else if (s.mitotic_activity_high) {
        cnsWhoGrade = 3;
        criteriaMatched.push("Provisional CNS WHO grade 3 (significant mitotic activity/anaplasia)");
      } else {
        cnsWhoGrade = 2;
        criteriaMatched.push("Provisional CNS WHO grade 2 (low-grade histology)");
      }
      const atrxRetainedGrade4Caveat = s.atrx_status === "retained" && (hasNecrosisOrMvp || hasCdkn2ab);
      addStep(
        decisionPath,
        "step_grade",
        "Provisional Grading",
        molecularUpgradeTriggered ? "CDKN2A/B homdel (no necrosis/MVP)" : formatGradeDisplay(cnsWhoGrade),
        atrxRetainedGrade4Caveat
          ? `Provisional ${formatGradeDisplay(cnsWhoGrade)} ONLY if 1p/19q intact — retained ATRX favors oligodendroglioma (never grade 4)`
          : `Assign provisional ${formatGradeDisplay(cnsWhoGrade)} pending 1p/19q and ATRX testing`,
        atrxRetainedGrade4Caveat ? "warning" : molecularUpgradeTriggered ? "upgrade" : "nos_nec"
      );
      nosNecNote = atrxRetainedGrade4Caveat
        ? "IDH1/2 mutation is confirmed, 1p/19q codeletion was not tested, and ATRX is retained — favoring Oligodendroglioma, IDH-mutant and 1p/19q-codeleted (which is never CNS WHO grade 4). Urgent whole-arm 1p/19q testing (FISH/NGS/SNP array) is required before finalizing grade 4."
        : "IDH1/2 mutation is confirmed, but 1p/19q codeletion was not tested and unequivocal ATRX loss was not established. Perform whole-arm 1p/19q testing (FISH/NGS/SNP array) and ATRX IHC to distinguish Astrocytoma, IDH-mutant from Oligodendroglioma, IDH-mutant and 1p/19q-codeleted.";
    }

    if (s.mgmt_promoter === "methylated") {
      pushUnique(clinicalPearls, "MGMT promoter methylated: associated with favorable sensitivity to alkylating chemotherapy (temozolomide/PCV).");
    }
  } else {
    // IDH-wildtype
    criteriaMatched.push("IDH1/2 wildtype");
    addStep(
      decisionPath,
      "step_idh",
      "IDH1/2 Molecular Status",
      "Wildtype",
      "Check histone H3 status and evaluate histologic & molecular GBM criteria",
      "pass"
    );

    if (s.h3_tested_wildtype === "mutant") {
      diagnosis = "Diffuse glioma, H3-mutant (reclassify under Pediatric-type diffuse HGG)";
      entityId = "adult_glioma_h3_reclassify_nec";
      cnsWhoGrade = 4;
      molecularUpgradeTriggered = true;
      nosNecStatus = "NEC";
      refIds.push("louis2018_cimpact1", "louis2018_cimpact2", "louis2020_cimpact6");
      criteriaMatched.push("Histone H3 mutation detected in IDH-wildtype diffuse glioma");
      addStep(
        decisionPath,
        "step_h3",
        "Histone H3 Exclusion",
        "H3 Mutant",
        "Excludes Glioblastoma, IDH-wildtype -> reclassify under Pediatric-type diffuse HGG",
        "upgrade"
      );
      nosNecNote = "Glioblastoma, IDH-wildtype requires both IDH-wildtype and H3-wildtype status. Because a histone H3 alteration is present, reclassify this tumor under Pediatric-type diffuse high-grade gliomas (Diffuse midline glioma, H3 K27-altered or Diffuse hemispheric glioma, H3 G34-mutant).";
    } else {
      if (s.age_years !== null && s.age_years < 55) {
        pushUnique(warnings, "Patient age <55 years: if IDH-wildtype status relied solely on IDH1 p.R132H IHC, perform IDH1/IDH2 sequencing to exclude non-canonical IDH mutations and confirm H3 K27/G34 wildtype status.");
      }

      const molGbmHits = [];
      if (s.tert_promoter === "mutant") molGbmHits.push("TERT promoter mutation");
      if (s.egfr_amplification === "present") molGbmHits.push("EGFR gene amplification");
      if (s.chr7_gain_chr10_loss === "present") molGbmHits.push("+7/-10 chromosome copy-number change");
      const hasMolGbm = molGbmHits.length > 0;

      if (hasNecrosisOrMvp || hasMolGbm) {
        diagnosis = "Glioblastoma, IDH-wildtype";
        entityId = "gbm_idh_wt";
        cnsWhoGrade = 4;
        molecularUpgradeTriggered = !hasNecrosisOrMvp && hasMolGbm;
        refIds.push("brat2018_cimpact3", "stupp2005", "hegi2005");

        if (hasNecrosisOrMvp) {
          criteriaMatched.push(`Histologic GBM criteria met (${s.necrosis && s.mvp ? "necrosis + MVP" : s.necrosis ? "necrosis" : "microvascular proliferation"})`);
        }
        if (hasMolGbm) {
          criteriaMatched.push(`Molecular GBM criteria met (${molGbmHits.join(", ")})`);
        }

        addStep(
          decisionPath,
          "step_gbm_criteria",
          "Histologic & Molecular GBM Criteria",
          molecularUpgradeTriggered
            ? `${molGbmHits.join(" + ")} (no necrosis/MVP)`
            : hasMolGbm
              ? `${histoHighList.join(", ")} + ${molGbmHits.join(", ")}`
              : histoHighList.join(", "),
          molecularUpgradeTriggered
            ? "MOLECULAR UPGRADE: Molecular GBM criteria establish Glioblastoma, IDH-wildtype, CNS WHO grade 4 despite low-grade histology"
            : "Meets WHO CNS5 criteria for Glioblastoma, IDH-wildtype, CNS WHO grade 4",
          molecularUpgradeTriggered ? "upgrade" : "pass"
        );

        if (s.mgmt_promoter === "methylated") {
          pushUnique(clinicalPearls, "MGMT promoter methylated: predicts improved overall survival and substantially greater benefit from temozolomide alkylating chemotherapy (Stupp et al., NEJM 2005; Hegi et al., NEJM 2005).");
        } else if (s.mgmt_promoter === "unmethylated") {
          pushUnique(clinicalPearls, "MGMT promoter unmethylated: reduced expected benefit from temozolomide; consider clinical trial enrollment and guideline-based RT/systemic therapy tailoring (especially in elderly patients).");
        } else {
          pushUnique(clinicalPearls, "MGMT promoter methylation not tested: strongly recommended for all Glioblastoma, IDH-wildtype cases to inform temozolomide benefit and clinical trial stratification.");
        }

        if (molecularUpgradeTriggered) {
          pushUnique(clinicalPearls, "WHO CNS5 / cIMPACT-NOW Update 3 Molecular GBM rule: In an adult IDH-wildtype diffuse astrocytic glioma, >=1 of TERT promoter mutation, EGFR amplification, or +7/-10 copy-number change suffices for Glioblastoma, IDH-wildtype, CNS WHO grade 4 even without necrosis or MVP.");
          if (molGbmHits.length === 1 && s.tert_promoter === "mutant") {
            pushUnique(warnings, "Caveat: Isolated TERT promoter mutation can occur in non-GBM CNS tumors (e.g., PXA, oligodendroglioma, ganglioglioma); ensure diffusely infiltrating astrocytic morphology and IDH-/H3-wildtype status are confirmed.");
          }
        }
      } else {
        const allThreeTestedNegative =
          s.tert_promoter === "wildtype" &&
          s.egfr_amplification === "absent" &&
          s.chr7_gain_chr10_loss === "absent";

        refIds.push("louis2018_cimpact1", "brat2018_cimpact3", "capper2018_methylation");
        cnsWhoGrade = "Not assigned";
        molecularUpgradeTriggered = false;

        if (allThreeTestedNegative) {
          diagnosis = "Diffuse astrocytic glioma, IDH-wildtype, NEC";
          entityId = "adult_glioma_idh_wt_nec";
          nosNecStatus = "NEC";
          criteriaMatched.push("IDH-wildtype; no necrosis or MVP; TERT promoter, EGFR amplification, and +7/-10 all tested and negative");
          addStep(
            decisionPath,
            "step_gbm_criteria",
            "Histologic & Molecular GBM Criteria",
            "Necrosis/MVP absent; TERT wt, EGFR not amp, +7/-10 absent",
            "Does NOT qualify as Glioblastoma, IDH-wildtype -> designate NEC and perform methylation profiling",
            "nos_nec"
          );
          nosNecNote = "All three molecular GBM markers (TERT promoter, EGFR amplification, +7/-10) were tested and negative, and histologic necrosis/MVP are absent. Do NOT force a Glioblastoma diagnosis. Perform genome-wide DNA methylation profiling and evaluate for pediatric-type diffuse gliomas (MYB/MYBL1, MAPK/BRAF/FGFR, H3) or circumscribed astrocytic gliomas.";
          pushUnique(clinicalPearls, "IDH-wildtype histologically low-grade gliomas lacking TERT/EGFR/+7/-10 frequently reclassify on DNA methylation profiling as pediatric-type diffuse LGG (MAPK or MYB/MYBL1 altered), PXA, ganglioglioma, or HGAP.");
        } else {
          diagnosis = "Diffuse astrocytic glioma, IDH-wildtype, NOS";
          entityId = "adult_glioma_idh_wt_nos";
          nosNecStatus = "NOS";
          const untested = [];
          if (s.tert_promoter === "not_tested") untested.push("TERT promoter");
          if (s.egfr_amplification === "not_tested") untested.push("EGFR amplification");
          if (s.chr7_gain_chr10_loss === "not_tested") untested.push("+7/-10 copy-number change");
          criteriaMatched.push(`IDH-wildtype; no necrosis or MVP; incomplete molecular GBM panel (untested: ${untested.join(", ")})`);
          addStep(
            decisionPath,
            "step_gbm_criteria",
            "Histologic & Molecular GBM Criteria",
            `Necrosis/MVP absent; untested: ${untested.join(", ")}`,
            "Incomplete molecular GBM testing -> designate NOS",
            "nos_nec"
          );
          nosNecNote = `IDH-wildtype diffuse astrocytic glioma without necrosis/MVP requires completion of molecular GBM testing (${untested.join(", ")}) before excluding Glioblastoma, IDH-wildtype (CNS WHO grade 4). Consider H3 K27/G34 exclusion and DNA methylation profiling.`;
        }
      }
    }
  }

  const gradeDisplay = formatGradeDisplay(cnsWhoGrade);
  addStep(
    decisionPath,
    "step_terminal",
    "Integrated WHO CNS5 Diagnosis",
    diagnosis,
    gradeDisplay,
    "terminal"
  );

  return {
    diagnosis,
    cnsWhoGrade,
    family: "adult_diffuse_glioma",
    criteriaMatched,
    decisionPath,
    molecularUpgradeTriggered,
    nosNecNote,
    clinicalPearls,
    references: resolveReferences(refIds, rulesData),
    entityId,
    gradeDisplay,
    nosNecStatus,
    warnings
  };
}

function classifyPediatricHgg(raw, rulesData) {
  const s = {
    anatomic_location: toEnum(raw.anatomic_location, ["midline", "hemispheric", "other"], "midline"),
    patient_age_group: toEnum(raw.patient_age_group, ["infant_under_4y", "child_adolescent", "adult"], "child_adolescent"),
    h3_k27_status: toEnum(raw.h3_k27_status, ["k27m_mutant", "ezhip_overexpressed", "egfr_mutant_midline", "wildtype", "not_tested"], "not_tested"),
    h3_k27me3_loss: toEnum(raw.h3_k27me3_loss, ["lost", "retained", "not_tested"], "not_tested"),
    h3_g34_status: toEnum(raw.h3_g34_status, ["g34r_or_g34v_mutant", "wildtype", "not_tested"], "not_tested"),
    idh_status: toEnum(raw.idh_status, ["wildtype", "mutant", "not_tested"], "not_tested"),
    infant_rtk_fusion: toEnum(raw.infant_rtk_fusion, ["ntrk_fusion", "ros1_fusion", "alk_fusion", "met_fusion", "absent", "not_tested"], "not_tested"),
    pediatric_hgg_subtype: toEnum(raw.pediatric_hgg_subtype, ["pedhgg_rtk1", "pedhgg_rtk2", "pedhgg_mycn", "none_or_untested"], "none_or_untested"),
    low_grade_histology_only: toBool(raw.low_grade_histology_only)
  };

  const criteriaMatched = [];
  const decisionPath = [];
  const clinicalPearls = [];
  const warnings = [];
  const refIds = ["louis2021"];

  let diagnosis = "";
  let entityId = "";
  let cnsWhoGrade = "Not assigned";
  let molecularUpgradeTriggered = false;
  let nosNecStatus = "none";
  let nosNecNote = null;

  const h3K27Altered = ["k27m_mutant", "ezhip_overexpressed", "egfr_mutant_midline"].includes(s.h3_k27_status);
  const rtkFusionPresent = ["ntrk_fusion", "ros1_fusion", "alk_fusion", "met_fusion"].includes(s.infant_rtk_fusion);

  addStep(
    decisionPath,
    "step_context",
    "Anatomic & Age Context",
    `${humanizeToken(s.anatomic_location)} | ${humanizeToken(s.patient_age_group)}`,
    "Guide molecular branch evaluation for Pediatric-type diffuse HGG",
    "pass"
  );

  if (s.idh_status === "mutant") {
    diagnosis = "Diffuse glioma, IDH-mutant (reclassify under Adult-type diffuse gliomas), NEC";
    entityId = "ped_hgg_idh_mut_reclassify_nec";
    cnsWhoGrade = "Not assigned";
    nosNecStatus = "NEC";
    refIds.push("louis2018_cimpact1");
    criteriaMatched.push("IDH1/2 mutation detected — discordant with pediatric-type diffuse HGG");
    addStep(
      decisionPath,
      "step_idh",
      "IDH1/2 Exclusion",
      "IDH1/2 Mutant",
      "Incompatible with Pediatric-type HGG -> reclassify under Adult-type diffuse gliomas",
      "nos_nec"
    );
    nosNecNote = "Pediatric-type diffuse high-grade gliomas are IDH-wildtype. Reclassify this IDH-mutant glioma under Adult-type diffuse gliomas (Astrocytoma, IDH-mutant or Oligodendroglioma, IDH-mutant and 1p/19q-codeleted).";
  } else if (s.anatomic_location === "midline" && (h3K27Altered || s.h3_k27me3_loss === "lost")) {
    diagnosis = "Diffuse midline glioma, H3 K27-altered";
    entityId = "dmg_h3k27_altered";
    cnsWhoGrade = 4;
    molecularUpgradeTriggered = s.low_grade_histology_only;
    refIds.push("louis2018_cimpact2", "louis2020_cimpact6", "venneti2023_onc201");

    const k27Details = [];
    if (h3K27Altered) k27Details.push(humanizeToken(s.h3_k27_status));
    if (s.h3_k27me3_loss === "lost") k27Details.push("global H3 K27me3 loss");
    criteriaMatched.push(`Midline diffuse glioma with ${k27Details.join(" + ")}`);

    addStep(
      decisionPath,
      "step_h3k27",
      "H3 K27 Alteration & Midline Location",
      `Midline + ${k27Details.join(", ")}`,
      molecularUpgradeTriggered
        ? "MOLECULAR UPGRADE: Assigned CNS WHO grade 4 regardless of low-grade biopsy histology"
        : "Meets WHO CNS5 criteria for Diffuse midline glioma, H3 K27-altered (CNS WHO grade 4)",
      molecularUpgradeTriggered ? "upgrade" : "pass"
    );

    if (h3K27Altered && s.h3_k27me3_loss === "retained") {
      pushUnique(warnings, "H3 K27 alteration reported alongside retained nuclear H3 K27me3: confirm H3 K27me3 IHC interpretation and molecular assay.");
    }
    if (s.low_grade_histology_only) {
      pushUnique(clinicalPearls, "Molecular grade 4 override: Diffuse midline glioma, H3 K27-altered is always assigned CNS WHO grade 4 irrespective of bland or low-grade biopsy histology.");
    }
    pushUnique(clinicalPearls, "WHO CNS5 broadened 'H3 K27M-mutant' to 'H3 K27-altered' to include H3.3/H3.1/H3.2 K27M-mutant, H3-wildtype EZHIP-overexpressing, and EGFR-mutant midline/bithalamic subtypes.");
    pushUnique(clinicalPearls, "H3 K27M / H3 K27-altered clinical trial eligibility: evaluate DRD2/ClpP agonist (dordaviprone / ONC201) trials, GD2 CAR-T therapy, and specialized pediatric/adult DMG clinical protocols.");
  } else if (s.anatomic_location !== "midline" && h3K27Altered) {
    diagnosis = "Diffuse glioma, H3 K27-altered, non-midline, NEC";
    entityId = "ped_hgg_nonmidline_k27_nec";
    cnsWhoGrade = "Not assigned";
    nosNecStatus = "NEC";
    refIds.push("louis2018_cimpact1", "louis2018_cimpact2", "louis2020_cimpact6", "capper2018_methylation");
    criteriaMatched.push(`Non-midline (${humanizeToken(s.anatomic_location)}) diffuse glioma with ${humanizeToken(s.h3_k27_status)}`);
    addStep(
      decisionPath,
      "step_h3k27_loc",
      "Anatomic Location vs. H3 K27 Alteration",
      `${humanizeToken(s.anatomic_location)} + ${humanizeToken(s.h3_k27_status)}`,
      "WHO CNS5 restricts DMG diagnosis to midline structures -> classify as NEC",
      "nos_nec"
    );
    nosNecNote = "WHO CNS5 strictly requires midline anatomic localization (brainstem/pons, thalamus, spinal cord) for 'Diffuse midline glioma, H3 K27-altered'. Non-midline H3 K27-altered gliomas (including H3 K27M-mutant, EZHIP-overexpressing, or EGFR-mutant midline-type alterations) have variable biology; confirm anatomic origin and perform DNA methylation profiling.";
  } else if (s.h3_g34_status === "g34r_or_g34v_mutant") {
    diagnosis = "Diffuse hemispheric glioma, H3 G34-mutant";
    entityId = "dhg_h3g34_mutant";
    cnsWhoGrade = 4;
    refIds.push("louis2020_cimpact6");
    criteriaMatched.push("H3-3A p.G35R/V (H3 G34R/V) mutation present");
    addStep(
      decisionPath,
      "step_h3g34",
      "H3 G34 Status",
      "H3 G34R/V Mutant",
      "Defines Diffuse hemispheric glioma, H3 G34-mutant (CNS WHO grade 4)",
      "pass"
    );
    if (s.anatomic_location === "midline") {
      pushUnique(warnings, "H3 G34-mutant gliomas characteristically involve the cerebral hemispheres; verify anatomic origin and sequencing result.");
    }
    pushUnique(clinicalPearls, "Characteristically demonstrates OLIG2-negative, ATRX-lost, TP53-mutant immunophenotype and high frequency of MGMT promoter methylation.");
  } else if (s.patient_age_group === "infant_under_4y" && s.anatomic_location === "hemispheric" && rtkFusionPresent) {
    diagnosis = "Infant-type hemispheric glioma";
    entityId = "infant_hemispheric_glioma";
    cnsWhoGrade = "Not assigned";
    refIds.push("clarke2020_infant");
    criteriaMatched.push(`Infant/early-childhood hemispheric glioma with ${humanizeToken(s.infant_rtk_fusion)}`);
    addStep(
      decisionPath,
      "step_infant_rtk",
      "Infant RTK Fusion Profile",
      humanizeToken(s.infant_rtk_fusion),
      "Defines Infant-type hemispheric glioma (CNS WHO grade not assigned)",
      "pass"
    );
    pushUnique(clinicalPearls, `Actionable RTK fusion (${humanizeToken(s.infant_rtk_fusion)}): evaluate targeted kinase inhibitor therapy (e.g., larotrectinib/entrectinib for NTRK/ROS1; alectinib/lorlatinib for ALK; MET inhibitors for MET), enabling radiation-sparing management in infants.`);
  } else if (s.idh_status === "wildtype" && s.h3_k27_status === "wildtype" && s.h3_g34_status === "wildtype") {
    diagnosis = "Diffuse pediatric-type high-grade glioma, H3-wildtype and IDH-wildtype";
    entityId = "pedhgg_h3_idh_wt";
    cnsWhoGrade = 4;
    refIds.push("capper2018_methylation");
    criteriaMatched.push("H3 K27-wildtype, H3 G34-wildtype, and IDH1/2-wildtype");
    if (s.pediatric_hgg_subtype !== "none_or_untested") {
      criteriaMatched.push(`DNA methylation subclass: ${humanizeToken(s.pediatric_hgg_subtype)}`);
    }
    const infantRtkUntested =
      s.patient_age_group === "infant_under_4y" &&
      s.anatomic_location === "hemispheric" &&
      s.infant_rtk_fusion === "not_tested";
    if (infantRtkUntested) {
      refIds.push("clarke2020_infant");
      pushUnique(
        warnings,
        "Infant (<4 years) hemispheric glioma with untested RTK fusion status: perform reflex RNA fusion panel (NTRK1/2/3, ROS1, ALK, MET) and/or DNA methylation profiling to exclude Infant-type hemispheric glioma (CNS WHO grade not assigned; harbors actionable RTK fusions amenable to radiation-sparing targeted kinase inhibitor therapy)."
      );
    }
    addStep(
      decisionPath,
      "step_h3_idh_wt",
      "H3 & IDH Wildtype Confirmation",
      `H3-wt, IDH-wt${s.pediatric_hgg_subtype !== "none_or_untested" ? ` (${humanizeToken(s.pediatric_hgg_subtype)})` : ""}`,
      infantRtkUntested
        ? "Assign provisional Diffuse pediatric-type HGG (CNS WHO grade 4); reflex RTK fusion testing required to exclude Infant-type hemispheric glioma"
        : "Assign Diffuse pediatric-type high-grade glioma, H3-wildtype and IDH-wildtype (CNS WHO grade 4)",
      infantRtkUntested ? "warning" : "pass"
    );
    if (s.pediatric_hgg_subtype === "pedhgg_rtk1") {
      pushUnique(clinicalPearls, "pHGG RTK1 subclass: frequently harbors PDGFRA amplification and is enriched in constitutional mismatch repair deficiency (CMMRD)/Lynch syndrome and prior cranial radiation; evaluate MMR/TMB for checkpoint inhibitor eligibility.");
    } else if (s.pediatric_hgg_subtype === "pedhgg_mycn") {
      pushUnique(clinicalPearls, "pHGG MYCN subclass: associated with MYCN amplification and the most aggressive clinical course among H3-wt/IDH-wt pediatric HGG subclasses.");
    } else if (s.pediatric_hgg_subtype === "pedhgg_rtk2") {
      pushUnique(clinicalPearls, "pHGG RTK2 subclass: frequently shows EGFR amplification and TERT promoter mutation, often arising in older children/adolescents.");
    } else {
      pushUnique(clinicalPearls, "DNA methylation profiling resolves H3-wildtype and IDH-wildtype pediatric HGG into three molecular subclasses (pHGG RTK1, pHGG RTK2, pHGG MYCN) with distinct prognostic and germline screening implications.");
    }
  } else {
    diagnosis = "Pediatric-type diffuse high-grade glioma, NOS";
    entityId = "ped_hgg_nos";
    cnsWhoGrade = 4;
    nosNecStatus = "NOS";
    refIds.push("louis2018_cimpact1");
    criteriaMatched.push("Required H3 K27, H3 G34, and/or IDH1/2 testing incomplete with no defining alteration identified");
    addStep(
      decisionPath,
      "step_incomplete",
      "Required Molecular Panel",
      `H3 K27: ${humanizeToken(s.h3_k27_status)}, H3 G34: ${humanizeToken(s.h3_g34_status)}, IDH: ${humanizeToken(s.idh_status)}`,
      "Insufficient molecular profiling for specific entity -> assign NOS",
      "nos_nec"
    );
    nosNecNote = "Complete H3 K27 (including H3 K27me3 IHC / EZHIP / EGFR for midline tumors), H3 G34, IDH1/2, and infant RTK fusion / DNA methylation profiling to establish a specific WHO CNS5 pediatric-type HGG diagnosis.";
  }

  const gradeDisplay = formatGradeDisplay(cnsWhoGrade);
  addStep(
    decisionPath,
    "step_terminal",
    "Integrated WHO CNS5 Diagnosis",
    diagnosis,
    gradeDisplay,
    "terminal"
  );

  return {
    diagnosis,
    cnsWhoGrade,
    family: "pediatric_hgg",
    criteriaMatched,
    decisionPath,
    molecularUpgradeTriggered,
    nosNecNote,
    clinicalPearls,
    references: resolveReferences(refIds, rulesData),
    entityId,
    gradeDisplay,
    nosNecStatus,
    warnings
  };
}

function classifyPediatricLgg(raw, rulesData) {
  const s = {
    myb_mybl1_alteration: toEnum(raw.myb_mybl1_alteration, ["myb_or_mybl1_altered", "absent", "not_tested"], "not_tested"),
    angiocentric_histology: toBool(raw.angiocentric_histology),
    plnty_features: toBool(raw.plnty_features),
    mapk_alteration: toEnum(
      raw.mapk_alteration,
      ["braf_v600e", "fgfr1_alteration", "fgfr2_fgfr3_fusion", "braf_fusion", "nf1_or_other_mapk", "absent", "not_tested"],
      "not_tested"
    ),
    idh_status: toEnum(raw.idh_status, ["wildtype", "mutant", "not_tested"], "not_tested"),
    h3_status: toEnum(raw.h3_status, ["wildtype", "mutant", "not_tested"], "not_tested")
  };

  const criteriaMatched = [];
  const decisionPath = [];
  const clinicalPearls = [];
  const warnings = [];
  const refIds = ["louis2021", "ellison2019_cimpact4"];

  let diagnosis = "";
  let entityId = "";
  let cnsWhoGrade = "Not assigned";
  const molecularUpgradeTriggered = false;
  let nosNecStatus = "none";
  let nosNecNote = null;

  const hasMapk = ["braf_v600e", "fgfr1_alteration", "fgfr2_fgfr3_fusion", "braf_fusion", "nf1_or_other_mapk"].includes(s.mapk_alteration);

  if (s.idh_status === "mutant" || s.h3_status === "mutant") {
    diagnosis = "Discordant diffuse glioma (IDH- or H3-mutant — reclassify), NEC";
    entityId = "ped_lgg_discordant_nec";
    cnsWhoGrade = "Not assigned";
    nosNecStatus = "NEC";
    refIds.push("louis2018_cimpact1");
    criteriaMatched.push(`Exclusion marker positive (${s.idh_status === "mutant" ? "IDH mutant" : ""}${s.idh_status === "mutant" && s.h3_status === "mutant" ? " + " : ""}${s.h3_status === "mutant" ? "H3 mutant" : ""})`);
    addStep(
      decisionPath,
      "step_exclusion",
      "IDH / H3 Exclusion Check",
      s.idh_status === "mutant" && s.h3_status === "mutant"
        ? "IDH + H3 Mutant"
        : s.idh_status === "mutant"
          ? "IDH Mutant"
          : "H3 Mutant",
      "Incompatible with Pediatric-type diffuse LGG -> reclassify",
      "nos_nec"
    );
    nosNecNote = "Pediatric-type diffuse low-grade gliomas are strictly IDH-wildtype and H3-wildtype. Reclassify IDH-mutant tumors under Adult-type diffuse gliomas and H3-mutant tumors under Pediatric-type diffuse high-grade gliomas.";
  } else {
    addStep(
      decisionPath,
      "step_exclusion",
      "IDH / H3 Exclusion Check",
      `IDH: ${humanizeToken(s.idh_status)} | H3: ${humanizeToken(s.h3_status)}`,
      "No IDH or H3 mutation identified -> proceed with pediatric LGG taxonomy",
      s.idh_status === "not_tested" || s.h3_status === "not_tested" ? "warning" : "pass"
    );

    if (s.idh_status === "not_tested" || s.h3_status === "not_tested") {
      pushUnique(warnings, "IDH1/2 and/or H3 wildtype status was not explicitly documented; verify IDH-wildtype and H3-wildtype status to exclude adult-type diffuse glioma or H3-altered HGG.");
    }

    if (s.angiocentric_histology && s.myb_mybl1_alteration === "myb_or_mybl1_altered") {
      diagnosis = "Angiocentric glioma";
      entityId = "angiocentric_glioma";
      cnsWhoGrade = 1;
      criteriaMatched.push("Angiocentric perivascular histology + MYB/MYBL1 (MYB::QKI) alteration");
      addStep(
        decisionPath,
        "step_myb",
        "Angiocentric Morphology & MYB/MYBL1",
        "Angiocentric + MYB/MYBL1 altered",
        "Defines Angiocentric glioma (CNS WHO grade 1)",
        "pass"
      );
      pushUnique(clinicalPearls, "Angiocentric glioma is strongly driven by MYB::QKI fusion and carries an excellent seizure-control and survival prognosis (CNS WHO grade 1).");
    } else if (s.angiocentric_histology && s.myb_mybl1_alteration === "not_tested") {
      diagnosis = "Angiocentric glioma, NOS";
      entityId = "angiocentric_glioma_nos";
      cnsWhoGrade = 1;
      nosNecStatus = "NOS";
      refIds.push("louis2018_cimpact1");
      criteriaMatched.push("Angiocentric histology present; MYB/MYBL1 testing not performed");
      addStep(
        decisionPath,
        "step_myb",
        "Angiocentric Morphology & MYB/MYBL1",
        "Angiocentric + MYB/MYBL1 not tested",
        "Assign Angiocentric glioma, NOS (CNS WHO grade 1)",
        "nos_nec"
      );
      nosNecNote = "Angiocentric histology is present, but MYB::QKI / MYB-MYBL1 fusion testing was not performed; confirm molecular driver for definitive WHO CNS5 reporting.";
    } else if (!s.angiocentric_histology && s.myb_mybl1_alteration === "myb_or_mybl1_altered") {
      diagnosis = "Diffuse astrocytoma, MYB- or MYBL1-altered";
      entityId = "diffuse_astrocytoma_myb_mybl1";
      cnsWhoGrade = 1;
      criteriaMatched.push("MYB or MYBL1 structural alteration without angiocentric glioma pattern");
      addStep(
        decisionPath,
        "step_myb",
        "MYB / MYBL1 Pathway",
        "MYB or MYBL1 altered",
        "Defines Diffuse astrocytoma, MYB- or MYBL1-altered (CNS WHO grade 1)",
        "pass"
      );
      pushUnique(clinicalPearls, "Indolent epileptogenic CNS WHO grade 1 diffuse astrocytoma with high rates of long-term disease control after surgical resection.");
    } else if (s.plnty_features && hasMapk) {
      diagnosis = "Polymorphous low-grade neuroepithelial tumor of the young (PLNTY)";
      entityId = "plnty";
      cnsWhoGrade = 1;
      refIds.push("huse2017_plnty");
      criteriaMatched.push(`PLNTY histologic/CD34 features + ${humanizeToken(s.mapk_alteration)}`);
      addStep(
        decisionPath,
        "step_plnty",
        "PLNTY Features & MAPK Driver",
        `PLNTY features + ${humanizeToken(s.mapk_alteration)}`,
        "Defines PLNTY (CNS WHO grade 1)",
        "pass"
      );
      pushUnique(clinicalPearls, "PLNTY typically presents with refractory temporal lobe epilepsy in children/young adults and harbors BRAF V600E or FGFR2/FGFR3 fusions with benign CNS WHO grade 1 behavior.");
    } else if (s.plnty_features && s.mapk_alteration === "not_tested") {
      diagnosis = "Polymorphous low-grade neuroepithelial tumor of the young (PLNTY), NOS";
      entityId = "plnty_nos";
      cnsWhoGrade = 1;
      nosNecStatus = "NOS";
      refIds.push("huse2017_plnty", "louis2018_cimpact1");
      criteriaMatched.push("PLNTY features present; MAPK alteration testing not performed");
      addStep(
        decisionPath,
        "step_plnty",
        "PLNTY Features & MAPK Driver",
        "PLNTY features + MAPK not tested",
        "Assign PLNTY, NOS (CNS WHO grade 1)",
        "nos_nec"
      );
      nosNecNote = "Characteristic PLNTY morphology/CD34 positivity is present, but MAPK alteration testing (BRAF V600E, FGFR2/FGFR3 fusions) was not completed.";
    } else if (hasMapk) {
      diagnosis = "Diffuse low-grade glioma, MAPK pathway-altered";
      entityId = "diffuse_lgg_mapk_altered";
      cnsWhoGrade = "Not assigned";
      refIds.push("bouffet2023", "kilburn2024_firefly1");
      criteriaMatched.push(`MAPK pathway alteration identified (${humanizeToken(s.mapk_alteration)})`);
      addStep(
        decisionPath,
        "step_mapk",
        "MAPK Pathway Driver",
        humanizeToken(s.mapk_alteration),
        "Defines Diffuse low-grade glioma, MAPK pathway-altered",
        "pass"
      );

      if (s.angiocentric_histology && s.myb_mybl1_alteration === "absent") {
        pushUnique(warnings, "Angiocentric-like features reported without MYB/MYBL1 alteration; confirm MAPK-altered LGG vs. morphologic mimic by DNA methylation profiling.");
      }

      if (s.mapk_alteration === "braf_v600e") {
        pushUnique(clinicalPearls, "BRAF V600E targeted therapy: Dabrafenib + trametinib is FDA-approved for BRAF V600E-mutant pediatric low-grade glioma (Bouffet et al., NEJM 2023); tovorafenib (type 2 pan-RAF inhibitor) is also active.");
      } else if (s.mapk_alteration === "braf_fusion") {
        pushUnique(clinicalPearls, "BRAF fusion targeted therapy: Tovorafenib (type 2 pan-RAF inhibitor, FIREFLY-1) and MEK inhibitors are active in BRAF-fused pediatric LGG. Avoid first-generation type 1 BRAF monomers (e.g., vemurafenib/dabrafenib monotherapy) due to paradoxical MAPK activation.");
      } else if (s.mapk_alteration === "fgfr1_alteration" || s.mapk_alteration === "fgfr2_fgfr3_fusion") {
        pushUnique(clinicalPearls, "FGFR-altered LGG: Evaluate MEK inhibition or selective FGFR inhibitor clinical trials for unresectable/progressive disease.");
      } else {
        pushUnique(clinicalPearls, "NF1/MAPK pathway-altered LGG: Evaluate MEK inhibitor therapy (e.g., selumetinib) and clinical genetics assessment for NF1 where appropriate.");
      }
    } else if (s.myb_mybl1_alteration === "absent" && s.mapk_alteration === "absent") {
      diagnosis = "Pediatric-type diffuse low-grade glioma, NEC";
      entityId = "ped_lgg_nec";
      cnsWhoGrade = "Not assigned";
      nosNecStatus = "NEC";
      refIds.push("louis2018_cimpact1", "capper2018_methylation");
      criteriaMatched.push("MYB/MYBL1 and MAPK pathway alterations tested and negative");
      addStep(
        decisionPath,
        "step_mol_neg",
        "MYB/MYBL1 & MAPK Molecular Panel",
        "All defining drivers absent",
        "Completed molecular testing does not match a defined WHO CNS5 entity -> NEC",
        "nos_nec"
      );
      nosNecNote = "MYB/MYBL1 and MAPK pathway drivers were tested and negative. Perform RNA fusion sequencing and genome-wide DNA methylation profiling to identify rare fusions or alternative glioneuronal entities.";
    } else {
      diagnosis = "Pediatric-type diffuse low-grade glioma, NOS";
      entityId = "ped_lgg_nos";
      cnsWhoGrade = "Not assigned";
      nosNecStatus = "NOS";
      refIds.push("louis2018_cimpact1");
      criteriaMatched.push("Incomplete molecular testing (MYB/MYBL1 and/or MAPK panel not performed)");
      addStep(
        decisionPath,
        "step_mol_incomplete",
        "MYB/MYBL1 & MAPK Molecular Panel",
        `MYB/MYBL1: ${humanizeToken(s.myb_mybl1_alteration)} | MAPK: ${humanizeToken(s.mapk_alteration)}`,
        "Required molecular testing incomplete -> NOS",
        "nos_nec"
      );
      nosNecNote = "Complete MYB/MYBL1 rearrangement testing and MAPK pathway profiling (BRAF V600E, BRAF fusions, FGFR1/2/3, NF1) along with IDH/H3 exclusion to assign a definitive WHO CNS5 entity.";
    }

    if (s.plnty_features && s.mapk_alteration === "absent") {
      pushUnique(warnings, "PLNTY histologic/CD34 features reported with negative MAPK panel; consider RNA fusion sequencing (FGFR2/FGFR3) and DNA methylation profiling.");
    }
    if (s.angiocentric_histology && s.myb_mybl1_alteration === "absent") {
      pushUnique(warnings, "Angiocentric histology reported with negative MYB/MYBL1 testing; confirm RNA fusion coverage for MYB::QKI and consider DNA methylation profiling.");
    }
  }

  const gradeDisplay = formatGradeDisplay(cnsWhoGrade);
  addStep(
    decisionPath,
    "step_terminal",
    "Integrated WHO CNS5 Diagnosis",
    diagnosis,
    gradeDisplay,
    "terminal"
  );

  return {
    diagnosis,
    cnsWhoGrade,
    family: "pediatric_lgg",
    criteriaMatched,
    decisionPath,
    molecularUpgradeTriggered,
    nosNecNote,
    clinicalPearls,
    references: resolveReferences(refIds, rulesData),
    entityId,
    gradeDisplay,
    nosNecStatus,
    warnings
  };
}

function classifyCircumscribedAstrocytic(raw, rulesData) {
  const s = {
    morphology_subtype: toEnum(
      raw.morphology_subtype,
      ["pilocytic", "piloid_high_grade", "pxa", "sega", "chordoid", "astroblastoma"],
      "pilocytic"
    ),
    molecular_marker: toEnum(
      raw.molecular_marker,
      ["kiaa1549_braf", "braf_v600e", "hgap_methylation_profile", "tsc1_tsc2", "prkca_d463h", "mn1_altered", "nf1_or_mapk", "absent", "not_tested"],
      "not_tested"
    ),
    mitoses_per_10hpf: toNullableNumber(raw.mitoses_per_10hpf),
    cdkn2ab_homdel: toEnum(raw.cdkn2ab_homdel, ["present", "absent", "not_tested"], "not_tested")
  };

  if (s.mitoses_per_10hpf !== null && s.mitoses_per_10hpf < 0) {
    s.mitoses_per_10hpf = 0;
  }

  const criteriaMatched = [];
  const decisionPath = [];
  const clinicalPearls = [];
  const warnings = [];
  const refIds = ["louis2021"];

  let diagnosis = "";
  let entityId = "";
  let cnsWhoGrade = "Not assigned";
  const molecularUpgradeTriggered = false;
  let nosNecStatus = "none";
  let nosNecNote = null;

  addStep(
    decisionPath,
    "step_morph",
    "Circumscribed Morphology",
    humanizeToken(s.morphology_subtype),
    "Evaluate entity-specific molecular and mitotic criteria",
    "pass"
  );

  switch (s.morphology_subtype) {
    case "pilocytic": {
      diagnosis = "Pilocytic astrocytoma";
      entityId = "pilocytic_astrocytoma";
      cnsWhoGrade = 1;
      criteriaMatched.push("Circumscribed pilocytic astrocytoma morphology");
      if (["kiaa1549_braf", "braf_v600e", "nf1_or_mapk"].includes(s.molecular_marker)) {
        criteriaMatched.push(`Supporting MAPK pathway alteration (${humanizeToken(s.molecular_marker)})`);
      }
      addStep(
        decisionPath,
        "step_mol",
        "MAPK Molecular Context",
        humanizeToken(s.molecular_marker),
        "Assign Pilocytic astrocytoma (CNS WHO grade 1)",
        "pass"
      );
      if (s.molecular_marker === "braf_v600e") {
        refIds.push("bouffet2023");
        pushUnique(clinicalPearls, "BRAF V600E-mutant pilocytic astrocytoma: dabrafenib + trametinib is FDA-approved for pediatric BRAF V600E-mutant LGG requiring systemic therapy.");
      } else if (s.molecular_marker === "kiaa1549_braf") {
        refIds.push("kilburn2024_firefly1");
        pushUnique(clinicalPearls, "KIAA1549::BRAF fusion: classic driver of posterior fossa pilocytic astrocytoma; if progressive/unresectable, evaluate type 2 pan-RAF (tovorafenib) or MEK inhibition and avoid type 1 BRAF monotherapy.");
      } else {
        pushUnique(clinicalPearls, "Microvascular proliferation and occasional necrosis do not upgrade classic pilocytic astrocytoma above CNS WHO grade 1.");
      }
      if (s.cdkn2ab_homdel === "present") {
        pushUnique(warnings, "CDKN2A/B homozygous deletion in a pilocytic-appearing astrocytoma (particularly in adults or with brisk mitoses) warrants DNA methylation profiling to exclude High-grade astrocytoma with piloid features (HGAP) or PXA.");
      }
      break;
    }
    case "piloid_high_grade": {
      refIds.push("reinhardt2018_hgap", "capper2018_methylation");
      cnsWhoGrade = "Not assigned";
      if (s.molecular_marker === "hgap_methylation_profile") {
        diagnosis = "High-grade astrocytoma with piloid features";
        entityId = "hgap";
        criteriaMatched.push("High-grade piloid astrocytic morphology + characteristic HGAP DNA methylation profile");
        addStep(
          decisionPath,
          "step_hgap_meth",
          "DNA Methylation Classifier",
          "HGAP methylation profile confirmed",
          "Definitive diagnosis of High-grade astrocytoma with piloid features",
          "pass"
        );
        pushUnique(clinicalPearls, "HGAP is the first WHO CNS5 circumscribed glioma requiring DNA methylation profiling for definitive diagnosis; typically harbors MAPK alteration + CDKN2A/B deletion + ATRX loss.");
      } else if (s.molecular_marker === "absent") {
        diagnosis = "Circumscribed high-grade astrocytic glioma, NEC";
        entityId = "circumscribed_hg_nec";
        nosNecStatus = "NEC";
        refIds.push("louis2018_cimpact1");
        criteriaMatched.push("High-grade piloid astrocytic morphology, but HGAP DNA methylation profile absent");
        addStep(
          decisionPath,
          "step_hgap_meth",
          "DNA Methylation Classifier",
          "HGAP profile absent",
          "Does not match HGAP methylation class -> NEC",
          "nos_nec"
        );
        nosNecNote = "HGAP DNA methylation profile was negative; integrate MAPK, ATRX, CDKN2A/B, BRAF, and IDH/H3 findings to exclude CNS WHO grade 3 pleomorphic xanthoastrocytoma (PXA), IDH-wildtype glioblastoma, or diffuse midline glioma.";
      } else {
        diagnosis = "High-grade astrocytoma with piloid features, NOS";
        entityId = "hgap_nos";
        nosNecStatus = "NOS";
        refIds.push("louis2018_cimpact1");
        criteriaMatched.push("High-grade piloid morphology without confirmatory HGAP DNA methylation profiling");
        addStep(
          decisionPath,
          "step_hgap_meth",
          "DNA Methylation Classifier",
          humanizeToken(s.molecular_marker),
          "HGAP methylation confirmation pending -> NOS",
          "nos_nec"
        );
        nosNecNote = "Genome-wide DNA methylation profiling is an essential WHO CNS5 diagnostic criterion for High-grade astrocytoma with piloid features (HGAP).";
      }
      break;
    }
    case "pxa": {
      diagnosis = "Pleomorphic xanthoastrocytoma";
      entityId = "pxa";
      const isGrade3 = s.mitoses_per_10hpf !== null && s.mitoses_per_10hpf >= 5;
      cnsWhoGrade = isGrade3 ? 3 : 2;
      criteriaMatched.push("Pleomorphic xanthoastrocytoma morphology");
      if (s.mitoses_per_10hpf !== null) {
        criteriaMatched.push(`Mitotic count: ${s.mitoses_per_10hpf} per 10 HPF (${isGrade3 ? ">=5 -> CNS WHO grade 3" : "<5 -> CNS WHO grade 2"})`);
      } else {
        pushUnique(warnings, "Mitotic count per 10 HPF was not entered; document exact mitotic count (>=5 mitoses/10 HPF establishes CNS WHO grade 3 PXA).");
      }
      addStep(
        decisionPath,
        "step_pxa_mitoses",
        "PXA Mitotic Grading (>=5 per 10 HPF)",
        s.mitoses_per_10hpf !== null ? `${s.mitoses_per_10hpf} / 10 HPF` : "Not reported (default grade 2)",
        isGrade3 ? "Meets CNS WHO grade 3 PXA threshold" : "Assign CNS WHO grade 2 PXA",
        "pass"
      );
      if (s.molecular_marker === "braf_v600e") {
        refIds.push("bouffet2023");
        criteriaMatched.push("BRAF p.V600E mutation present");
        pushUnique(clinicalPearls, "BRAF V600E-mutant PXA: evaluate BRAF + MEK inhibitor therapy (e.g., dabrafenib + trametinib) for recurrent, progressive, or unresectable disease.");
      }
      if (s.cdkn2ab_homdel === "present") {
        criteriaMatched.push("CDKN2A/B homozygous deletion present (characteristic in ~90% of PXAs)");
      }
      pushUnique(clinicalPearls, "WHO CNS5 retired the modifier 'anaplastic'; high-grade PXA (>=5 mitoses/10 HPF) is designated 'Pleomorphic xanthoastrocytoma, CNS WHO grade 3'.");
      break;
    }
    case "sega": {
      diagnosis = "Subependymal giant cell astrocytoma";
      entityId = "sega";
      cnsWhoGrade = 1;
      refIds.push("franz2013_exist1");
      criteriaMatched.push("SEGA morphology (subependymal intraventricular giant cell astrocytoma)");
      if (s.molecular_marker === "tsc1_tsc2") {
        criteriaMatched.push("TSC1/TSC2 alteration confirmed");
      }
      addStep(
        decisionPath,
        "step_sega",
        "TSC1 / TSC2 Context",
        humanizeToken(s.molecular_marker),
        "Assign Subependymal giant cell astrocytoma (CNS WHO grade 1)",
        "pass"
      );
      pushUnique(clinicalPearls, "mTOR inhibition (everolimus): FDA-approved systemic therapy for TSC-associated SEGA not amenable to curative surgical resection (EXIST-1 trial, Franz et al., Lancet 2013).");
      pushUnique(clinicalPearls, "Evaluate clinical genetics and multi-organ surveillance for Tuberous Sclerosis Complex (TSC1/TSC2).");
      break;
    }
    case "chordoid": {
      if (s.molecular_marker === "absent") {
        diagnosis = "Chordoid glioma-like tumor, NEC";
        entityId = "chordoid_glioma_nec";
        cnsWhoGrade = "Not assigned";
        nosNecStatus = "NEC";
        refIds.push("louis2018_cimpact1", "capper2018_methylation");
        criteriaMatched.push("Chordoid glioma-like morphology, but PRKCA p.D463H mutation absent");
        addStep(
          decisionPath,
          "step_prkca",
          "PRKCA p.D463H Hallmark",
          "Absent",
          "PRKCA p.D463H absence is atypical for Chordoid glioma -> NEC",
          "nos_nec"
        );
        nosNecNote = "Recurrent PRKCA p.D463H mutation is a near-universal molecular hallmark of Chordoid glioma. Absence warrants orthogonal review and DNA methylation profiling to exclude chordoid meningioma or other mimics.";
      } else {
        diagnosis = "Chordoid glioma";
        entityId = "chordoid_glioma";
        cnsWhoGrade = 2;
        criteriaMatched.push("Chordoid glioma morphology (anterior third ventricle)");
        if (s.molecular_marker === "prkca_d463h") {
          criteriaMatched.push("PRKCA p.D463H hallmark mutation confirmed");
        }
        addStep(
          decisionPath,
          "step_prkca",
          "PRKCA p.D463H Hallmark",
          humanizeToken(s.molecular_marker),
          "Assign Chordoid glioma (CNS WHO grade 2)",
          "pass"
        );
        pushUnique(clinicalPearls, "WHO CNS5 simplified 'chordoid glioma of the third ventricle' to 'Chordoid glioma' (CNS WHO grade 2), molecularly characterized by recurrent PRKCA p.D463H mutation.");
      }
      break;
    }
    case "astroblastoma": {
      refIds.push("sturm2016_mn1");
      cnsWhoGrade = "Not assigned";
      if (s.molecular_marker === "mn1_altered") {
        diagnosis = "Astroblastoma, MN1-altered";
        entityId = "astroblastoma_mn1";
        criteriaMatched.push("Astroblastic perivascular pseudorosettes + MN1 alteration");
        addStep(
          decisionPath,
          "step_mn1",
          "MN1 Rearrangement Status",
          "MN1 altered",
          "Definitive diagnosis of Astroblastoma, MN1-altered",
          "pass"
        );
        pushUnique(clinicalPearls, "Astroblastoma, MN1-altered (frequently MN1::BEND2) has no assigned CNS WHO grade in CNS5; local recurrence is frequent, though long-term overall survival is often favorable.");
      } else if (s.molecular_marker === "absent") {
        diagnosis = "Astroblastoma, NEC";
        entityId = "astroblastoma_nec";
        nosNecStatus = "NEC";
        refIds.push("louis2018_cimpact1", "capper2018_methylation");
        criteriaMatched.push("Astroblastoma-like morphology with MN1 alteration absent");
        addStep(
          decisionPath,
          "step_mn1",
          "MN1 Rearrangement Status",
          "Absent",
          "MN1-negative astroblastoma morphology -> NEC",
          "nos_nec"
        );
        nosNecNote = "MN1 rearrangement was absent; perform DNA methylation profiling and targeted NGS/fusion panel to evaluate mimics (e.g., BRAF V600E-mutant glioma, PXA, or ZFTA fusion-positive ependymoma).";
      } else {
        diagnosis = "Astroblastoma, NOS";
        entityId = "astroblastoma_nos";
        nosNecStatus = "NOS";
        refIds.push("louis2018_cimpact1");
        criteriaMatched.push("Astroblastoma morphology without MN1 molecular testing");
        addStep(
          decisionPath,
          "step_mn1",
          "MN1 Rearrangement Status",
          humanizeToken(s.molecular_marker),
          "MN1 testing required for definitive WHO CNS5 entity -> NOS",
          "nos_nec"
        );
        nosNecNote = "Perform MN1 break-apart FISH, RNA fusion sequencing, or DNA methylation profiling to establish 'Astroblastoma, MN1-altered'.";
      }
      break;
    }
    default:
      break;
  }

  const gradeDisplay = formatGradeDisplay(cnsWhoGrade);
  addStep(
    decisionPath,
    "step_terminal",
    "Integrated WHO CNS5 Diagnosis",
    diagnosis,
    gradeDisplay,
    "terminal"
  );

  return {
    diagnosis,
    cnsWhoGrade,
    family: "circumscribed_astrocytic",
    criteriaMatched,
    decisionPath,
    molecularUpgradeTriggered,
    nosNecNote,
    clinicalPearls,
    references: resolveReferences(refIds, rulesData),
    entityId,
    gradeDisplay,
    nosNecStatus,
    warnings
  };
}

function classifyEpendymalTumor(raw, rulesData) {
  const s = {
    compartment: toEnum(raw.compartment, ["supratentorial", "posterior_fossa", "spinal"], "supratentorial"),
    histology_variant: toEnum(raw.histology_variant, ["classic_or_ependymoma", "subependymoma", "myxopapillary"], "classic_or_ependymoma"),
    anaplastic_features: toBool(raw.anaplastic_features),
    st_fusion: toEnum(raw.st_fusion, ["zfta_fusion", "yap1_fusion", "absent", "not_tested"], "not_tested"),
    pf_methylation_h3k27me3: toEnum(raw.pf_methylation_h3k27me3, ["pfa_h3k27me3_lost", "pfb_h3k27me3_retained", "indeterminate_or_other", "not_tested"], "not_tested"),
    mycn_amplification: toEnum(raw.mycn_amplification, ["present", "absent", "not_tested"], "not_tested")
  };

  const criteriaMatched = [];
  const decisionPath = [];
  const clinicalPearls = [];
  const warnings = [];
  const refIds = ["louis2021", "ellison2020_cimpact7", "pajtler2015_ependymoma"];

  let diagnosis = "";
  let entityId = "";
  let cnsWhoGrade = "Not assigned";
  let molecularUpgradeTriggered = false;
  let nosNecStatus = "none";
  let nosNecNote = null;

  addStep(
    decisionPath,
    "step_compartment",
    "Compartment & Variant",
    `${humanizeToken(s.compartment)} | ${humanizeToken(s.histology_variant)}`,
    "Route through WHO CNS5 anatomic-molecular ependymal classification",
    "pass"
  );

  if (s.histology_variant === "subependymoma") {
    diagnosis = "Subependymoma";
    entityId = "subependymoma";
    cnsWhoGrade = 1;
    criteriaMatched.push("Subependymoma histology (clusters of bland nuclei in fibrillary matrix)");
    addStep(
      decisionPath,
      "step_subependymoma",
      "Morphologic Entity",
      "Subependymoma",
      "Assigned CNS WHO grade 1 across all CNS compartments",
      "pass"
    );
    pushUnique(clinicalPearls, "Subependymoma is an indolent CNS WHO grade 1 tumor with excellent prognosis following surgical resection.");
  } else if (s.histology_variant === "myxopapillary") {
    diagnosis = "Myxopapillary ependymoma";
    entityId = "myxopapillary_ependymoma";
    cnsWhoGrade = 2;
    criteriaMatched.push("Myxopapillary ependymoma morphology -> CNS WHO grade 2 (WHO CNS5 upgrade from grade 1)");
    addStep(
      decisionPath,
      "step_myxopapillary",
      "WHO CNS5 Myxopapillary Grading",
      "Myxopapillary ependymoma",
      "Assigned CNS WHO grade 2 (upgraded from grade 1 in the 2016 4th edition update)",
      "pass"
    );
    if (s.compartment !== "spinal") {
      pushUnique(warnings, "Myxopapillary ependymoma almost exclusively arises in the conus medullaris / filum terminale (spinal compartment); verify anatomic localization.");
    }
    pushUnique(clinicalPearls, "WHO CNS5 Grading Change: Myxopapillary ependymoma was upgraded from grade 1 (2016) to CNS WHO grade 2 because recurrence risk and clinical behavior match conventional spinal ependymoma.");
  } else if (s.compartment === "supratentorial") {
    cnsWhoGrade = s.anaplastic_features ? 3 : 2;
    if (s.st_fusion === "zfta_fusion") {
      diagnosis = "Supratentorial ependymoma, ZFTA fusion-positive";
      entityId = "supratentorial_ependymoma_zfta";
      criteriaMatched.push("Supratentorial compartment + ZFTA gene fusion (formerly C11orf95/RELA)");
      criteriaMatched.push(s.anaplastic_features ? "Anaplastic histologic features present -> CNS WHO grade 3" : "No anaplastic features -> CNS WHO grade 2");
      addStep(
        decisionPath,
        "step_st_fusion",
        "Supratentorial Fusion Status",
        "ZFTA fusion-positive",
        `Assign Supratentorial ependymoma, ZFTA fusion-positive (${formatGradeDisplay(cnsWhoGrade)})`,
        "pass"
      );
      pushUnique(clinicalPearls, "WHO CNS5 renamed 'RELA fusion-positive' to 'ZFTA fusion-positive' because ZFTA (C11orf95) can fuse with non-RELA partners; CDKN2A deletion confers additional adverse prognosis.");
    } else if (s.st_fusion === "yap1_fusion") {
      diagnosis = "Supratentorial ependymoma, YAP1 fusion-positive";
      entityId = "supratentorial_ependymoma_yap1";
      criteriaMatched.push("Supratentorial compartment + YAP1 gene fusion");
      criteriaMatched.push(s.anaplastic_features ? "Anaplastic histologic features present -> CNS WHO grade 3" : "No anaplastic features -> CNS WHO grade 2");
      addStep(
        decisionPath,
        "step_st_fusion",
        "Supratentorial Fusion Status",
        "YAP1 fusion-positive",
        `Assign Supratentorial ependymoma, YAP1 fusion-positive (${formatGradeDisplay(cnsWhoGrade)})`,
        "pass"
      );
      pushUnique(clinicalPearls, "YAP1 fusion-positive supratentorial ependymoma predominantly occurs in young children/infants and has a distinctly favorable prognosis compared to ZFTA fusion-positive tumors.");
    } else if (s.st_fusion === "absent") {
      diagnosis = "Supratentorial ependymoma, NEC";
      entityId = "supratentorial_ependymoma_nec";
      nosNecStatus = "NEC";
      refIds.push("louis2018_cimpact1", "capper2018_methylation");
      criteriaMatched.push("Supratentorial ependymoma with ZFTA and YAP1 fusions tested and absent");
      addStep(
        decisionPath,
        "step_st_fusion",
        "Supratentorial Fusion Status",
        "ZFTA and YAP1 fusions absent",
        "Fusion-negative supratentorial ependymoma -> NEC",
        "nos_nec"
      );
      nosNecNote = "Both ZFTA and YAP1 fusions were excluded. Assign 'Supratentorial ependymoma, NEC' and perform DNA methylation profiling to rule out histologic mimics (e.g., MN1-altered astroblastoma or BCOR-altered CNS tumor).";
    } else {
      diagnosis = "Supratentorial ependymoma, NOS";
      entityId = "supratentorial_ependymoma_nos";
      nosNecStatus = "NOS";
      refIds.push("louis2018_cimpact1");
      criteriaMatched.push("Supratentorial ependymoma without ZFTA/YAP1 fusion testing");
      addStep(
        decisionPath,
        "step_st_fusion",
        "Supratentorial Fusion Status",
        "Not tested",
        "Molecular fusion profiling required -> NOS",
        "nos_nec"
      );
      nosNecNote = "ZFTA and YAP1 fusion testing was not performed; perform RNA fusion sequencing, FISH, or DNA methylation profiling.";
    }
  } else if (s.compartment === "posterior_fossa") {
    cnsWhoGrade = s.anaplastic_features ? 3 : 2;
    if (s.pf_methylation_h3k27me3 === "pfa_h3k27me3_lost") {
      diagnosis = "Posterior fossa group A (PFA) ependymoma";
      entityId = "pfa_ependymoma";
      criteriaMatched.push("Posterior fossa compartment + global H3 K27me3 loss / PFA methylation profile");
      criteriaMatched.push(s.anaplastic_features ? "Anaplastic histologic features -> CNS WHO grade 3" : "No anaplastic features -> CNS WHO grade 2");
      addStep(
        decisionPath,
        "step_pf_group",
        "Posterior Fossa H3 K27me3 / Methylation",
        "PFA (H3 K27me3 lost)",
        `Assign Posterior fossa group A (PFA) ependymoma (${formatGradeDisplay(cnsWhoGrade)})`,
        "pass"
      );
      pushUnique(clinicalPearls, "PFA ependymoma (H3 K27me3 loss, frequently EZHIP-overexpressing) predominantly affects young children and carries higher recurrence risk than PFB; evaluate chromosome 1q gain and 6q loss for ultra-high-risk stratification.");
    } else if (s.pf_methylation_h3k27me3 === "pfb_h3k27me3_retained") {
      diagnosis = "Posterior fossa group B (PFB) ependymoma";
      entityId = "pfb_ependymoma";
      criteriaMatched.push("Posterior fossa compartment + retained H3 K27me3 / PFB methylation profile");
      criteriaMatched.push(s.anaplastic_features ? "Anaplastic histologic features -> CNS WHO grade 3" : "No anaplastic features -> CNS WHO grade 2");
      addStep(
        decisionPath,
        "step_pf_group",
        "Posterior Fossa H3 K27me3 / Methylation",
        "PFB (H3 K27me3 retained)",
        `Assign Posterior fossa group B (PFB) ependymoma (${formatGradeDisplay(cnsWhoGrade)})`,
        "pass"
      );
      pushUnique(clinicalPearls, "PFB ependymoma typically occurs in older children and adults and confers markedly superior long-term survival compared to PFA ependymoma.");
    } else if (s.pf_methylation_h3k27me3 === "indeterminate_or_other") {
      diagnosis = "Posterior fossa ependymoma, NEC";
      entityId = "pf_ependymoma_nec";
      nosNecStatus = "NEC";
      refIds.push("louis2018_cimpact1", "capper2018_methylation");
      criteriaMatched.push("Posterior fossa ependymoma with indeterminate/non-PFA-PFB methylation/H3 K27me3 status");
      addStep(
        decisionPath,
        "step_pf_group",
        "Posterior Fossa H3 K27me3 / Methylation",
        "Indeterminate / non-PFA-PFB",
        "Cannot classify into PFA or PFB despite completed testing -> NEC",
        "nos_nec"
      );
      nosNecNote = "H3 K27me3 / DNA methylation testing did not resolve PFA vs. PFB; re-evaluate methylation classifier purity/score and exclude posterior fossa subependymoma or midline H3 K27-altered glioma.";
    } else {
      diagnosis = "Posterior fossa ependymoma, NOS";
      entityId = "pf_ependymoma_nos";
      nosNecStatus = "NOS";
      refIds.push("louis2018_cimpact1");
      criteriaMatched.push("Posterior fossa ependymoma without H3 K27me3 IHC or DNA methylation profiling");
      addStep(
        decisionPath,
        "step_pf_group",
        "Posterior Fossa H3 K27me3 / Methylation",
        "Not tested",
        "H3 K27me3 IHC and/or DNA methylation required -> NOS",
        "nos_nec"
      );
      nosNecNote = "H3 K27me3 immunostaining and/or DNA methylation profiling is required to distinguish high-risk PFA from more favorable PFB ependymoma.";
    }
  } else {
    // Spinal compartment
    if (s.mycn_amplification === "present") {
      diagnosis = "Spinal ependymoma, MYCN-amplified";
      entityId = "spinal_ependymoma_mycn";
      cnsWhoGrade = "Not assigned";
      molecularUpgradeTriggered = true;
      refIds.push("ghasemi2019_mycn_spinal");
      criteriaMatched.push("Spinal ependymoma + high-level MYCN gene amplification (high-risk WHO CNS5 molecular entity)");
      addStep(
        decisionPath,
        "step_spinal_mycn",
        "Spinal MYCN Amplification",
        "MYCN Amplified",
        "MOLECULAR UPGRADE: Distinct aggressive entity 'Spinal ependymoma, MYCN-amplified'",
        "upgrade"
      );
      pushUnique(clinicalPearls, "Spinal ependymoma, MYCN-amplified is a distinct aggressive WHO CNS5 entity characterized by early recurrence and frequent leptomeningeal dissemination; craniospinal staging MRI and CSF cytology are critical.");
    } else if (s.mycn_amplification === "not_tested" && s.anaplastic_features) {
      diagnosis = "Spinal ependymoma, NOS";
      entityId = "spinal_ependymoma_nos";
      cnsWhoGrade = 3;
      nosNecStatus = "NOS";
      refIds.push("louis2018_cimpact1", "ghasemi2019_mycn_spinal");
      criteriaMatched.push("High-grade/anaplastic spinal ependymoma without MYCN amplification testing");
      addStep(
        decisionPath,
        "step_spinal_mycn",
        "Spinal MYCN Amplification",
        "Not tested (anaplastic features present)",
        "Assign Spinal ependymoma, NOS (CNS WHO grade 3) pending MYCN FISH/NGS",
        "nos_nec"
      );
      nosNecNote = "MYCN amplification testing (FISH, NGS, or DNA methylation) is strongly recommended for high-grade/anaplastic spinal ependymomas to exclude 'Spinal ependymoma, MYCN-amplified'.";
    } else {
      diagnosis = "Spinal ependymoma";
      entityId = "spinal_ependymoma";
      cnsWhoGrade = s.anaplastic_features ? 3 : 2;
      criteriaMatched.push(`Spinal compartment ependymoma (${s.mycn_amplification === "absent" ? "MYCN not amplified" : "low-grade histology"})`);
      criteriaMatched.push(s.anaplastic_features ? "Anaplastic features -> CNS WHO grade 3" : "No anaplastic features -> CNS WHO grade 2");
      addStep(
        decisionPath,
        "step_spinal_mycn",
        "Spinal Ependymoma & MYCN Status",
        `MYCN: ${humanizeToken(s.mycn_amplification)}`,
        `Assign Spinal ependymoma (${formatGradeDisplay(cnsWhoGrade)})`,
        "pass"
      );
      pushUnique(clinicalPearls, "Conventional spinal ependymoma frequently harbors NF2/22q alterations; screen for NF2-related schwannomatosis in young patients or multifocal spinal lesions.");
    }
  }

  const gradeDisplay = formatGradeDisplay(cnsWhoGrade);
  addStep(
    decisionPath,
    "step_terminal",
    "Integrated WHO CNS5 Diagnosis",
    diagnosis,
    gradeDisplay,
    "terminal"
  );

  return {
    diagnosis,
    cnsWhoGrade,
    family: "ependymal_tumor",
    criteriaMatched,
    decisionPath,
    molecularUpgradeTriggered,
    nosNecNote,
    clinicalPearls,
    references: resolveReferences(refIds, rulesData),
    entityId,
    gradeDisplay,
    nosNecStatus,
    warnings
  };
}

function classifyMeningioma(raw, rulesData) {
  const s = {
    subtype: toEnum(
      raw.subtype,
      ["meningothelial_or_common", "chordoid", "clear_cell", "rhabdoid", "papillary", "secretory"],
      "meningothelial_or_common"
    ),
    mitoses_per_10hpf: toNullableNumber(raw.mitoses_per_10hpf) ?? 0,
    brain_invasion: toBool(raw.brain_invasion),
    atypical_features_count: toNullableNumber(raw.atypical_features_count) ?? 0,
    frank_anaplasia: toBool(raw.frank_anaplasia),
    tert_promoter: toEnum(raw.tert_promoter, ["mutant", "wildtype", "not_tested"], "not_tested"),
    cdkn2ab_homdel: toEnum(raw.cdkn2ab_homdel, ["present", "absent", "not_tested"], "not_tested"),
    h3k27me3_loss: toEnum(raw.h3k27me3_loss, ["lost", "retained", "not_tested"], "not_tested"),
    bap1_loss: toEnum(raw.bap1_loss, ["lost", "retained", "not_tested"], "not_tested"),
    smarce1_loss: toEnum(raw.smarce1_loss, ["lost", "retained", "not_tested"], "not_tested")
  };

  const criteriaMatched = [];
  const decisionPath = [];
  const clinicalPearls = [];
  const warnings = [];
  const refIds = ["louis2021"];

  if (s.mitoses_per_10hpf < 0) {
    s.mitoses_per_10hpf = 0;
    pushUnique(warnings, "Negative mitotic count clamped to 0.");
  }
  if (s.atypical_features_count < 0) {
    s.atypical_features_count = 0;
  } else if (s.atypical_features_count > 5) {
    s.atypical_features_count = 5;
    pushUnique(warnings, "Atypical histologic features count exceeds 5 and was clamped to 5.");
  }

  const SUBTYPE_DIAGNOSIS = {
    meningothelial_or_common: "Meningioma",
    chordoid: "Meningioma (chordoid subtype)",
    clear_cell: "Meningioma (clear cell subtype)",
    rhabdoid: "Meningioma (rhabdoid subtype)",
    papillary: "Meningioma (papillary subtype)",
    secretory: "Meningioma (secretory subtype)"
  };

  const diagnosis = SUBTYPE_DIAGNOSIS[s.subtype] || "Meningioma";
  const entityId = "meningioma";
  const nosNecStatus = "none";
  const nosNecNote = null;

  const histGrade3Reasons = [];
  if (s.mitoses_per_10hpf >= 20) histGrade3Reasons.push(`${s.mitoses_per_10hpf} mitoses/10 HPF (>=20)`);
  if (s.frank_anaplasia) histGrade3Reasons.push("frank anaplasia (sarcoma-/carcinoma-/melanoma-like)");
  const hasHistGrade3 = histGrade3Reasons.length > 0;

  const molGrade3Reasons = [];
  if (s.tert_promoter === "mutant") {
    molGrade3Reasons.push("TERT promoter mutation");
    refIds.push("sahm2016_tert");
  }
  if (s.cdkn2ab_homdel === "present") {
    molGrade3Reasons.push("CDKN2A/B homozygous deletion");
    refIds.push("sievers2020_cdkn2a");
  }
  const hasMolGrade3 = molGrade3Reasons.length > 0;

  const histGrade2Reasons = [];
  if (s.mitoses_per_10hpf >= 4 && s.mitoses_per_10hpf < 20) histGrade2Reasons.push(`${s.mitoses_per_10hpf} mitoses/10 HPF (4-19)`);
  if (s.brain_invasion) histGrade2Reasons.push("unambiguous brain invasion");
  if (s.atypical_features_count >= 3) histGrade2Reasons.push(`${s.atypical_features_count}/5 atypical features (>=3)`);
  if (s.subtype === "chordoid") histGrade2Reasons.push("chordoid subtype");
  if (s.subtype === "clear_cell") histGrade2Reasons.push("clear cell subtype");
  const hasHistGrade2 = histGrade2Reasons.length > 0;

  const histologicBaselineGrade = hasHistGrade3 ? 3 : hasHistGrade2 ? 2 : 1;
  addStep(
    decisionPath,
    "step_hist_grade",
    "Histologic Grading Assessment",
    hasHistGrade3
      ? histGrade3Reasons.join(", ")
      : hasHistGrade2
        ? histGrade2Reasons.join(", ")
        : `${s.mitoses_per_10hpf} mitoses/10 HPF, ${s.atypical_features_count}/5 atypical features, no brain invasion`,
    `Histologic baseline corresponds to CNS WHO grade ${histologicBaselineGrade}`,
    "pass"
  );

  let cnsWhoGrade = 1;
  let molecularUpgradeTriggered = false;

  if (hasHistGrade3 || hasMolGrade3) {
    cnsWhoGrade = 3;
    molecularUpgradeTriggered = !hasHistGrade3 && hasMolGrade3;
    if (hasHistGrade3) {
      criteriaMatched.push(`Histologic grade 3 criteria: ${histGrade3Reasons.join("; ")}`);
    }
    if (hasMolGrade3) {
      criteriaMatched.push(`Molecular grade 3 criteria: ${molGrade3Reasons.join("; ")} (automatic CNS WHO grade 3 in WHO CNS5)`);
    }
    addStep(
      decisionPath,
      "step_mol_grade3",
      "Molecular Grade 3 Drivers (TERT / CDKN2A/B)",
      hasMolGrade3 ? molGrade3Reasons.join(" + ") : `TERT: ${humanizeToken(s.tert_promoter)} | CDKN2A/B: ${humanizeToken(s.cdkn2ab_homdel)}`,
      molecularUpgradeTriggered
        ? `MOLECULAR UPGRADE: Upgraded from histologic grade ${histologicBaselineGrade} to CNS WHO grade 3`
        : "Confirms CNS WHO grade 3 meningioma",
      molecularUpgradeTriggered ? "upgrade" : "pass"
    );
    if (molecularUpgradeTriggered) {
      pushUnique(clinicalPearls, `WHO CNS5 Molecular Grade 3 Override: ${molGrade3Reasons.join(" and ")} independently establish CNS WHO grade 3 meningioma regardless of benign-appearing histology, warranting aggressive multidisciplinary management and adjuvant radiotherapy evaluation.`);
    }
  } else if (hasHistGrade2) {
    cnsWhoGrade = 2;
    criteriaMatched.push(`Histologic grade 2 criteria: ${histGrade2Reasons.join("; ")}`);
    addStep(
      decisionPath,
      "step_mol_grade3",
      "Molecular Grade 3 Drivers (TERT / CDKN2A/B)",
      `TERT: ${humanizeToken(s.tert_promoter)} | CDKN2A/B: ${humanizeToken(s.cdkn2ab_homdel)}`,
      "No molecular grade 3 driver identified -> CNS WHO grade 2",
      "pass"
    );
  } else {
    cnsWhoGrade = 1;
    criteriaMatched.push(`Low mitotic count (${s.mitoses_per_10hpf}/10 HPF), no brain invasion, <3 atypical features, and no molecular grade 3 trigger`);
    addStep(
      decisionPath,
      "step_mol_grade3",
      "Molecular Grade 3 Drivers (TERT / CDKN2A/B)",
      `TERT: ${humanizeToken(s.tert_promoter)} | CDKN2A/B: ${humanizeToken(s.cdkn2ab_homdel)}`,
      "No molecular grade 3 driver identified -> CNS WHO grade 1",
      "pass"
    );
  }

  if ((s.subtype === "rhabdoid" || s.subtype === "papillary") && cnsWhoGrade < 3) {
    pushUnique(clinicalPearls, `WHO CNS5 Subtype Update: ${s.subtype === "rhabdoid" ? "Rhabdoid" : "Papillary"} morphology is NO LONGER sufficient alone for CNS WHO grade 3; grade is determined strictly by mitotic count, anaplasia, brain invasion, atypical features, and TERT/CDKN2A/B status.`);
  }
  if (s.subtype === "secretory") {
    pushUnique(clinicalPearls, "Secretory meningioma characteristically harbors KLF4/TRAF7 co-mutations and frequently induces severe peritumoral cerebral edema disproportionate to tumor size.");
  }
  if (s.h3k27me3_loss === "lost") {
    refIds.push("katz2018_h3k27me3_meningioma");
    criteriaMatched.push("H3 K27me3 loss present (adverse prognostic biomarker)");
    pushUnique(clinicalPearls, "H3 K27me3 loss: associated with significantly increased risk of recurrence and shorter recurrence-free survival in meningioma (especially grade 1/2 tumors), supporting closer MRI surveillance or adjuvant RT discussion (does not independently assign grade 3 in CNS5).");
  }
  if (s.bap1_loss === "lost") {
    criteriaMatched.push("BAP1 loss present");
    pushUnique(clinicalPearls, "BAP1 loss: associated with rhabdoid/high-grade meningioma and aggressive recurrence behavior; refer to cancer genetics to evaluate germline BAP1 tumor predisposition syndrome.");
  }
  if (s.smarce1_loss === "lost") {
    criteriaMatched.push("SMARCE1 loss present");
    pushUnique(clinicalPearls, "SMARCE1 loss: hallmark of clear cell meningioma (CNS WHO grade 2); evaluate for germline SMARCE1 hereditary predisposition syndrome, particularly in pediatric or spinal cases.");
    if (s.subtype !== "clear_cell") {
      pushUnique(warnings, "SMARCE1 loss reported with non-clear-cell subtype selection: review histology for clear cell meningioma features (which carry intrinsic CNS WHO grade 2 behavior).");
    }
  }

  const gradeDisplay = formatGradeDisplay(cnsWhoGrade);
  addStep(
    decisionPath,
    "step_terminal",
    "Integrated WHO CNS5 Diagnosis",
    diagnosis,
    gradeDisplay,
    "terminal"
  );

  return {
    diagnosis,
    cnsWhoGrade,
    family: "meningioma",
    criteriaMatched,
    decisionPath,
    molecularUpgradeTriggered,
    nosNecNote,
    clinicalPearls,
    references: resolveReferences(refIds, rulesData),
    entityId,
    gradeDisplay,
    nosNecStatus,
    warnings
  };
}

function classifyMedulloblastoma(raw, rulesData) {
  const s = {
    molecular_group: toEnum(raw.molecular_group, ["wnt", "shh", "non_wnt_non_shh", "not_tested", "indeterminate"], "not_tested"),
    tp53_status: toEnum(raw.tp53_status, ["wildtype", "mutant", "not_tested"], "not_tested"),
    histology: toEnum(raw.histology, ["classic", "desmoplastic_nodular", "mben", "large_cell_anaplastic"], "classic"),
    non_wnt_subgroup: toEnum(raw.non_wnt_subgroup, ["group_3", "group_4", "unspecified"], "unspecified"),
    myc_mycn_amplification: toEnum(raw.myc_mycn_amplification, ["myc_amp", "mycn_amp", "none", "not_tested"], "not_tested")
  };

  const criteriaMatched = [`Histologic pattern: ${humanizeToken(s.histology)}`];
  const decisionPath = [];
  const clinicalPearls = [];
  const warnings = [];
  const refIds = ["louis2021", "taylor2012_mb"];

  const cnsWhoGrade = 4;
  const molecularUpgradeTriggered = false;
  let diagnosis = "";
  let entityId = "";
  let nosNecStatus = "none";
  let nosNecNote = null;

  if (s.molecular_group === "wnt") {
    diagnosis = "Medulloblastoma, WNT-activated";
    entityId = "mb_wnt";
    criteriaMatched.push("Molecular group: WNT-activated (CNS WHO grade 4)");
    addStep(
      decisionPath,
      "step_mb_group",
      "Medulloblastoma Molecular Group",
      "WNT-activated",
      "Assign Medulloblastoma, WNT-activated (CNS WHO grade 4)",
      "pass"
    );
    pushUnique(clinicalPearls, "Most favorable medulloblastoma group (>90-95% 5-year survival in standard-risk pediatric cohorts); focus of treatment de-escalation trials.");
    pushUnique(clinicalPearls, "Driven by somatic CTNNB1 exon 3 mutations in ~85-90% of cases; if CTNNB1 is wildtype, screen urgently for germline APC mutation (Turcot / FAP syndrome).");
    if (s.histology === "desmoplastic_nodular" || s.histology === "mben") {
      pushUnique(warnings, "Desmoplastic/nodular or MBEN histology is strongly associated with SHH-activated medulloblastoma rather than WNT-activated; verify molecular group classification.");
    }
  } else if (s.molecular_group === "shh") {
    refIds.push("zhukova2013_shh_tp53");
    addStep(
      decisionPath,
      "step_mb_group",
      "Medulloblastoma Molecular Group",
      "SHH-activated",
      "Evaluate mandatory TP53 status to separate TP53-wildtype vs. TP53-mutant",
      "pass"
    );

    if (s.tp53_status === "wildtype") {
      diagnosis = "Medulloblastoma, SHH-activated and TP53-wildtype";
      entityId = "mb_shh_tp53_wt";
      criteriaMatched.push("Molecular group: SHH-activated + TP53-wildtype (CNS WHO grade 4)");
      addStep(
        decisionPath,
        "step_tp53",
        "TP53 Status (SHH Stratification)",
        "TP53-Wildtype",
        "Assign Medulloblastoma, SHH-activated and TP53-wildtype",
        "pass"
      );
      pushUnique(clinicalPearls, "Intermediate overall prognosis; infants with desmoplastic/nodular or MBEN histology show favorable outcomes with radiation-sparing chemotherapy.");
      pushUnique(clinicalPearls, "Screen for germline PTCH1 or SUFU mutations (Gorlin syndrome), especially in young children with desmoplastic/nodular or MBEN morphology.");
    } else if (s.tp53_status === "mutant") {
      diagnosis = "Medulloblastoma, SHH-activated and TP53-mutant";
      entityId = "mb_shh_tp53_mut";
      criteriaMatched.push("Molecular group: SHH-activated + TP53-mutant (high-risk CNS WHO grade 4)");
      addStep(
        decisionPath,
        "step_tp53",
        "TP53 Status (SHH Stratification)",
        "TP53-Mutant",
        "High-risk entity: Medulloblastoma, SHH-activated and TP53-mutant",
        "warning"
      );
      pushUnique(clinicalPearls, "Germline TP53 / Li-Fraumeni genetic counseling: Medulloblastoma, SHH-activated and TP53-mutant carries a very high rate of germline TP53 mutation (Li-Fraumeni syndrome). Urgent referral to cancer genetics is mandatory, and radiotherapy carries elevated secondary malignancy risk.");
      pushUnique(clinicalPearls, "Very high-risk prognosis frequently accompanied by large cell/anaplastic histology, chromothripsis, and MYCN or GLI2 amplification.");
    } else {
      diagnosis = "Medulloblastoma, SHH-activated, TP53 status unknown (NOS)";
      entityId = "mb_shh_nos";
      nosNecStatus = "NOS";
      refIds.push("louis2018_cimpact1");
      criteriaMatched.push("Molecular group: SHH-activated, but TP53 mutation status not tested");
      addStep(
        decisionPath,
        "step_tp53",
        "TP53 Status (SHH Stratification)",
        "Not tested",
        "TP53 testing is mandatory in SHH medulloblastoma -> NOS",
        "nos_nec"
      );
      nosNecNote = "TP53 sequencing (+/- p53 IHC) is mandatory to distinguish 'Medulloblastoma, SHH-activated and TP53-wildtype' from high-risk 'Medulloblastoma, SHH-activated and TP53-mutant' (associated with Li-Fraumeni syndrome).";
    }
  } else if (s.molecular_group === "non_wnt_non_shh") {
    refIds.push("capper2018_methylation");
    entityId = "mb_non_wnt_non_shh";
    if (s.non_wnt_subgroup === "group_3") {
      diagnosis = "Medulloblastoma, non-WNT/non-SHH (Group 3)";
      criteriaMatched.push("Molecular group: non-WNT/non-SHH, Group 3 (CNS WHO grade 4)");
    } else if (s.non_wnt_subgroup === "group_4") {
      diagnosis = "Medulloblastoma, non-WNT/non-SHH (Group 4)";
      criteriaMatched.push("Molecular group: non-WNT/non-SHH, Group 4 (CNS WHO grade 4)");
    } else {
      diagnosis = "Medulloblastoma, non-WNT/non-SHH";
      criteriaMatched.push("Molecular group: non-WNT/non-SHH (CNS WHO grade 4)");
    }
    addStep(
      decisionPath,
      "step_mb_group",
      "Medulloblastoma Molecular Group",
      s.non_wnt_subgroup === "unspecified" ? "Non-WNT / Non-SHH" : `Non-WNT / Non-SHH (${humanizeToken(s.non_wnt_subgroup)})`,
      `Assign ${diagnosis}`,
      "pass"
    );
    pushUnique(clinicalPearls, "WHO CNS5 groups Group 3 and Group 4 under 'Medulloblastoma, non-WNT/non-SHH', further resolved into 8 molecular subgroups (subgroups 1-8) by DNA methylation profiling.");
    if (s.histology === "desmoplastic_nodular" || s.histology === "mben") {
      pushUnique(warnings, "Desmoplastic/nodular or MBEN histology is unusual for non-WNT/non-SHH medulloblastoma; verify molecular subgrouping.");
    }
  } else if (s.molecular_group === "indeterminate") {
    diagnosis = "Medulloblastoma, NEC";
    entityId = "mb_nec";
    nosNecStatus = "NEC";
    refIds.push("louis2018_cimpact1", "capper2018_methylation");
    criteriaMatched.push("Molecular group profiling completed with indeterminate/unclassifiable result");
    addStep(
      decisionPath,
      "step_mb_group",
      "Medulloblastoma Molecular Group",
      "Indeterminate",
      "Completed molecular profiling did not resolve a WHO CNS5 group -> NEC",
      "nos_nec"
    );
    nosNecNote = "Molecular classification yielded indeterminate results. Verify tumor cellularity, repeat DNA methylation profiling, and exclude non-medulloblastoma CNS embryonal tumors (AT/RT, ETMR, CNS neuroblastoma FOXR2-activated).";
  } else {
    diagnosis = "Medulloblastoma, histologically defined (NOS)";
    entityId = "mb_histologic_nos";
    nosNecStatus = "NOS";
    refIds.push("louis2018_cimpact1");
    criteriaMatched.push("Molecular group profiling not performed -> histologically defined medulloblastoma (NOS)");
    addStep(
      decisionPath,
      "step_mb_group",
      "Medulloblastoma Molecular Group",
      "Not tested",
      "Molecular grouping required for integrated WHO CNS5 diagnosis -> NOS",
      "nos_nec"
    );
    nosNecNote = "Molecular group testing (DNA methylation profiling, transcriptomic panel, or validated IHC + CTNNB1/TP53 sequencing) was not performed. WHO CNS5 requires layered reporting integrating molecular group and histology.";
  }

  if (s.myc_mycn_amplification === "myc_amp") {
    criteriaMatched.push("MYC amplification present (high-risk prognostic modifier)");
    pushUnique(clinicalPearls, "MYC amplification (characteristic of high-risk Group 3 medulloblastoma) predicts aggressive biological behavior and elevated risk of leptomeningeal dissemination.");
  } else if (s.myc_mycn_amplification === "mycn_amp") {
    criteriaMatched.push("MYCN amplification present");
    pushUnique(clinicalPearls, "MYCN amplification is strongly adverse in SHH-activated TP53-mutant and Group 3 contexts; interpret risk strictly within the assigned molecular group.");
  }

  if (s.histology === "large_cell_anaplastic") {
    pushUnique(clinicalPearls, "Large cell/anaplastic histology is an adverse histological risk factor across molecular groups (especially when paired with MYC/MYCN amplification or TP53 mutation).");
  }

  const gradeDisplay = formatGradeDisplay(cnsWhoGrade);
  addStep(
    decisionPath,
    "step_terminal",
    "Integrated WHO CNS5 Diagnosis",
    diagnosis,
    gradeDisplay,
    "terminal"
  );

  return {
    diagnosis,
    cnsWhoGrade,
    family: "medulloblastoma",
    criteriaMatched,
    decisionPath,
    molecularUpgradeTriggered,
    nosNecNote,
    clinicalPearls,
    references: resolveReferences(refIds, rulesData),
    entityId,
    gradeDisplay,
    nosNecStatus,
    warnings
  };
}

/* -------------------------------------------------------------------------- */
/* Primary Classifier & Report Formatter Exports                              */
/* -------------------------------------------------------------------------- */

export function classifyCns5(inputState, rulesData = null) {
  const safeInput = inputState && typeof inputState === "object" ? inputState : {};
  const family = CNS5_FAMILIES.includes(safeInput.family)
    ? safeInput.family
    : "adult_diffuse_glioma";

  switch (family) {
    case "adult_diffuse_glioma":
      return classifyAdultDiffuseGlioma(safeInput, rulesData);
    case "pediatric_hgg":
      return classifyPediatricHgg(safeInput, rulesData);
    case "pediatric_lgg":
      return classifyPediatricLgg(safeInput, rulesData);
    case "circumscribed_astrocytic":
      return classifyCircumscribedAstrocytic(safeInput, rulesData);
    case "ependymal_tumor":
      return classifyEpendymalTumor(safeInput, rulesData);
    case "meningioma":
      return classifyMeningioma(safeInput, rulesData);
    case "medulloblastoma":
      return classifyMedulloblastoma(safeInput, rulesData);
    default:
      return classifyAdultDiffuseGlioma(safeInput, rulesData);
  }
}

export function formatCns5Report(result, inputState = null) {
  const res = result || classifyCns5(inputState || {});
  const config = getFamilyFormConfig(res.family);
  const lines = [
    "========================================================================",
    "WHO CNS5 (2021) LAYERED INTEGRATED NEUROPATHOLOGY REPORT SUMMARY",
    "========================================================================",
    `Tumor Family:          ${config.label}`,
    `Integrated Diagnosis:  ${res.diagnosis}`,
    `CNS WHO Grade:         ${res.gradeDisplay}`,
    `NOS / NEC Status:      ${res.nosNecStatus === "none" ? "Definitive WHO CNS5 Entity" : res.nosNecStatus}`,
    `Molecular Upgrade:     ${res.molecularUpgradeTriggered ? "YES — Molecular hallmark elevated grade/risk over histology" : "No"}`,
    ""
  ];

  if (Array.isArray(res.criteriaMatched) && res.criteriaMatched.length > 0) {
    lines.push("Criteria Matched:");
    for (const item of res.criteriaMatched) {
      lines.push(`  - ${item}`);
    }
    lines.push("");
  }

  if (Array.isArray(res.decisionPath) && res.decisionPath.length > 0) {
    lines.push("Diagnostic Decision Trace:");
    res.decisionPath.forEach((step, idx) => {
      lines.push(`  ${idx + 1}. ${step.label}: ${step.value} -> ${step.outcome}`);
    });
    lines.push("");
  }

  if (res.nosNecNote) {
    lines.push(`${res.nosNecStatus === "NEC" ? "NEC" : "NOS"} / Diagnostic Guidance:`);
    lines.push(`  ${res.nosNecNote}`);
    lines.push("");
  }

  if (Array.isArray(res.warnings) && res.warnings.length > 0) {
    lines.push("Discordance & QA Warnings:");
    for (const w of res.warnings) {
      lines.push(`  [!] ${w}`);
    }
    lines.push("");
  }

  if (Array.isArray(res.clinicalPearls) && res.clinicalPearls.length > 0) {
    lines.push("Prognostic & Therapeutic Biomarker Pearls:");
    for (const pearl of res.clinicalPearls) {
      lines.push(`  * ${pearl}`);
    }
    lines.push("");
  }

  if (inputState && typeof inputState === "object") {
    const enteredKeys = Object.keys(inputState).filter(
      (k) => k !== "family" && inputState[k] !== null && inputState[k] !== undefined && inputState[k] !== ""
    );
    if (enteredKeys.length > 0) {
      lines.push("Input Profile Snapshot:");
      for (const key of enteredKeys) {
        const val = typeof inputState[key] === "boolean"
          ? (inputState[key] ? "Yes" : "No")
          : humanizeToken(inputState[key]);
        lines.push(`  - ${key}: ${val}`);
      }
      lines.push("");
    }
  }

  if (Array.isArray(res.references) && res.references.length > 0) {
    lines.push("References:");
    res.references.forEach((ref, idx) => {
      lines.push(`  [${idx + 1}] ${ref.citation}${ref.doi ? ` doi:${ref.doi}` : ""}`);
    });
    lines.push("");
  }

  lines.push("------------------------------------------------------------------------");
  lines.push("For Research & Educational Use Only — Not a Certified Medical Device (Non-SaMD).");
  lines.push("No Protected Health Information (PHI) transmitted; computed 100% locally.");

  return lines.join("\n");
}
