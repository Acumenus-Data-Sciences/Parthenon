import type { ProInstrument } from "../types/proInstrument";

export const INSTRUMENTS: ProInstrument[] = [
  // ── Mental Health ──────────────────────────────────────────────────────
  { abbreviation: "PHQ-9", name: "Patient Health Questionnaire-9", domain: "Mental Health", items: "9", hasLoinc: true, loincCode: "44249-1", hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "PHQ-2", name: "Patient Health Questionnaire-2", domain: "Mental Health", items: "2", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "GAD-7", name: "Generalized Anxiety Disorder-7", domain: "Mental Health", items: "7", hasLoinc: true, loincCode: "69737-5", hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "BDI-II", name: "Beck Depression Inventory-II", domain: "Mental Health", items: "21", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "no", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "C-SSRS", name: "Columbia Suicide Severity Rating Scale", domain: "Mental Health", items: "6\u201316", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "no", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "PANSS", name: "Positive and Negative Syndrome Scale", domain: "Mental Health", items: "30", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "SAPS/SANS", name: "Assessment of Positive/Negative Symptoms", domain: "Mental Health", items: "34/25", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "PHQ-SADS", name: "PHQ Somatic/Anxiety/Depression", domain: "Mental Health", items: "Multiple", hasLoinc: true, loincCode: "69729-2", hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "PCL-5", name: "PTSD Checklist for DSM-5", domain: "Mental Health", items: "20", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "no", license: "public", licenseDetail: "Public Domain" },

  // ── Substance Use ──────────────────────────────────────────────────────
  { abbreviation: "AUDIT", name: "Alcohol Use Disorders Identification Test", domain: "Substance Use", items: "10", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain (WHO)" },
  { abbreviation: "DAST-10", name: "Drug Abuse Screening Test", domain: "Substance Use", items: "10", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "CAGE", name: "CAGE Questionnaire", domain: "Substance Use", items: "4", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "ASSIST", name: "Alcohol/Substance Involvement Screening", domain: "Substance Use", items: "8", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain (WHO)" },
  { abbreviation: "SASSI-3", name: "Substance Abuse Subtle Screening", domain: "Substance Use", items: "93", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "proprietary", licenseDetail: "Proprietary" },

  // ── Quality of Life ────────────────────────────────────────────────────
  { abbreviation: "EQ-5D-3L", name: "EuroQol 5-Dimension 3-Level", domain: "Quality of Life", items: "5+VAS", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "EQ-5D-5L", name: "EuroQol 5-Dimension 5-Level", domain: "Quality of Life", items: "5+VAS", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "SF-36", name: "Short Form Health Survey-36", domain: "Quality of Life", items: "36", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "SF-12", name: "Short Form Health Survey-12", domain: "Quality of Life", items: "12", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "WHOQOL-BREF", name: "WHO Quality of Life-Brief", domain: "Quality of Life", items: "26", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (WHO)" },
  { abbreviation: "HUI", name: "Health Utility Index", domain: "Quality of Life", items: "Variable", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "QOL-1", name: "PRO Quality of Life Tool", domain: "Quality of Life", items: "6", hasLoinc: true, loincCode: "72355-1", hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "SF-6D", name: "Short Form 6-Dimension", domain: "Quality of Life", items: "6", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "proprietary", licenseDetail: "Proprietary" },

  // ── Pain ────────────────────────────────────────────────────────────────
  { abbreviation: "VAS-Pain", name: "Visual Analog Scale for Pain", domain: "Pain", items: "1", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "NRS-Pain", name: "Numeric Rating Scale for Pain", domain: "Pain", items: "1", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "BPI", name: "Brief Pain Inventory", domain: "Pain", items: "17", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "MPQ", name: "McGill Pain Questionnaire", domain: "Pain", items: "78", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "SF-MPQ", name: "Short Form McGill Pain", domain: "Pain", items: "15", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "proprietary", licenseDetail: "Proprietary" },

  // ── Functional Status ──────────────────────────────────────────────────
  { abbreviation: "Barthel", name: "Barthel Index", domain: "Functional Status", items: "10", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "Katz ADL", name: "Katz Index of Independence in ADL", domain: "Functional Status", items: "6", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "IADL", name: "Instrumental Activities of Daily Living", domain: "Functional Status", items: "8", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "FIM", name: "Functional Independence Measure", domain: "Functional Status", items: "18", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "ODI", name: "Oswestry Disability Index", domain: "Functional Status", items: "10", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "KPS", name: "Karnofsky Performance Status", domain: "Functional Status", items: "1", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "ECOG-PS", name: "ECOG Performance Status", domain: "Functional Status", items: "1", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "RMDQ", name: "Roland-Morris Disability Questionnaire", domain: "Functional Status", items: "24", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "NDI", name: "Neck Disability Index", domain: "Functional Status", items: "10", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },

  // ── Oncology ───────────────────────────────────────────────────────────
  { abbreviation: "EORTC QLQ-C30", name: "EORTC Quality of Life-Cancer 30", domain: "Oncology", items: "30", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "FACT-G", name: "Functional Assessment of Cancer Therapy", domain: "Oncology", items: "28", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "no", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "FACIT-F", name: "FACIT Fatigue Scale", domain: "Oncology", items: "13", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "no", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "ESAS", name: "Edmonton Symptom Assessment System", domain: "Oncology", items: "10", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "EPIC-26", name: "Expanded Prostate Cancer Index", domain: "Oncology", items: "26", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "no", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "EORTC QLQ-BR23", name: "EORTC Breast Cancer Module", domain: "Oncology", items: "23", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "FACT-An", name: "FACT Anemia Scale", domain: "Oncology", items: "40", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "no", license: "proprietary", licenseDetail: "Proprietary" },

  // ── Cognitive ──────────────────────────────────────────────────────────
  { abbreviation: "MoCA", name: "Montreal Cognitive Assessment", domain: "Cognitive", items: "30", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "MMSE", name: "Mini-Mental State Examination", domain: "Cognitive", items: "30", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "NIH Toolbox CB", name: "NIH Toolbox Cognition Battery", domain: "Cognitive", items: "12 tests", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },

  // ── Geriatric ──────────────────────────────────────────────────────────
  { abbreviation: "GDS", name: "Geriatric Depression Scale", domain: "Geriatric", items: "15", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "FRAIL", name: "FRAIL Screening Tool", domain: "Geriatric", items: "5", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "Tinetti", name: "Tinetti Gait and Balance", domain: "Geriatric", items: "28", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "FES", name: "Falls Efficacy Scale", domain: "Geriatric", items: "10", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "OARS/OMFAQ", name: "Older Americans Functional Assessment", domain: "Geriatric", items: "~100", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain" },

  // ── Cardiovascular ─────────────────────────────────────────────────────
  { abbreviation: "KCCQ", name: "Kansas City Cardiomyopathy Questionnaire", domain: "Cardiovascular", items: "23", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "SAQ", name: "Seattle Angina Questionnaire", domain: "Cardiovascular", items: "19", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "MLHF", name: "MN Living with Heart Failure", domain: "Cardiovascular", items: "21", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "MacNew", name: "MacNew Heart Disease QoL", domain: "Cardiovascular", items: "27", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "proprietary", licenseDetail: "Proprietary" },

  // ── Respiratory ────────────────────────────────────────────────────────
  { abbreviation: "CAT", name: "COPD Assessment Test", domain: "Respiratory", items: "8", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "mMRC", name: "Modified MRC Dyspnea Scale", domain: "Respiratory", items: "1", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "SGRQ", name: "St. George's Respiratory Questionnaire", domain: "Respiratory", items: "50", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "ACT", name: "Asthma Control Test", domain: "Respiratory", items: "5", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },

  // ── Diabetes ───────────────────────────────────────────────────────────
  { abbreviation: "PAID", name: "Problem Areas in Diabetes", domain: "Diabetes", items: "20", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "DDS", name: "Diabetes Distress Scale", domain: "Diabetes", items: "17", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "DTSQ", name: "Diabetes Treatment Satisfaction", domain: "Diabetes", items: "6", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "DSMQ-R", name: "Diabetes Self-Management Questionnaire", domain: "Diabetes", items: "16", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "proprietary", licenseDetail: "Proprietary" },

  // ── Pediatric ──────────────────────────────────────────────────────────
  { abbreviation: "PedsQL", name: "Pediatric Quality of Life Inventory", domain: "Pediatric", items: "23", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "CBCL", name: "Child Behavior Checklist", domain: "Pediatric", items: "99\u2013118", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "SDQ", name: "Strengths and Difficulties Questionnaire", domain: "Pediatric", items: "25", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "PSC-17", name: "Pediatric Symptom Checklist", domain: "Pediatric", items: "17", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },

  // ── Neurological ───────────────────────────────────────────────────────
  { abbreviation: "NIHSS", name: "NIH Stroke Scale", domain: "Neurological", items: "11", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "mRS", name: "Modified Rankin Scale", domain: "Neurological", items: "1", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "GCS", name: "Glasgow Coma Scale", domain: "Neurological", items: "3", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "FOUR", name: "Full Outline of UnResponsiveness", domain: "Neurological", items: "13", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },

  // ── Sleep ──────────────────────────────────────────────────────────────
  { abbreviation: "PSQI", name: "Pittsburgh Sleep Quality Index", domain: "Sleep", items: "19", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "ESS", name: "Epworth Sleepiness Scale", domain: "Sleep", items: "8", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "ISI", name: "Insomnia Severity Index", domain: "Sleep", items: "7", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "proprietary", licenseDetail: "Proprietary" },

  // ── Sexual Health ──────────────────────────────────────────────────────
  { abbreviation: "IIEF", name: "International Index of Erectile Function", domain: "Sexual Health", items: "15", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "FSFI", name: "Female Sexual Function Index", domain: "Sexual Health", items: "19", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },

  // ── Musculoskeletal ────────────────────────────────────────────────────
  { abbreviation: "WOMAC", name: "Western Ontario McMaster OA Index", domain: "Musculoskeletal", items: "24", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "HAQ-DI", name: "Health Assessment Questionnaire", domain: "Musculoskeletal", items: "20", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
  { abbreviation: "DAS28", name: "Disease Activity Score-28", domain: "Musculoskeletal", items: "28+labs", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "ASQoL", name: "Ankylosing Spondylitis QoL", domain: "Musculoskeletal", items: "18", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },

  // ── SDOH ───────────────────────────────────────────────────────────────
  { abbreviation: "PRAPARE", name: "Protocol for Responding to Assets/Risks/Experiences", domain: "SDOH", items: "15+5", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "AHC HRSN", name: "Accountable Health Communities Screening", domain: "SDOH", items: "10+", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "partial", license: "public", licenseDetail: "Public Domain (CMS)" },

  // ── Perioperative ──────────────────────────────────────────────────────
  { abbreviation: "ASA-PS", name: "ASA Physical Status Classification", domain: "Perioperative", items: "1", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },
  { abbreviation: "WHO SSC", name: "WHO Safe Surgery Checklist", domain: "Perioperative", items: "19", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (WHO)" },

  // ── PROMIS ─────────────────────────────────────────────────────────────
  { abbreviation: "PROMIS GH-10", name: "PROMIS Global Health", domain: "PROMIS", items: "10", hasLoinc: true, loincCode: "61578-1", hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },
  { abbreviation: "PROMIS-29", name: "PROMIS Profile 29 v2.1", domain: "PROMIS", items: "29", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },
  { abbreviation: "PROMIS PF", name: "PROMIS Physical Function", domain: "PROMIS", items: "4\u201310", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },
  { abbreviation: "PROMIS PI", name: "PROMIS Pain Interference", domain: "PROMIS", items: "4\u20138", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },
  { abbreviation: "PROMIS Fatigue", name: "PROMIS Fatigue", domain: "PROMIS", items: "4\u20138", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },
  { abbreviation: "PROMIS Anxiety", name: "PROMIS Anxiety", domain: "PROMIS", items: "4\u20138", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },
  { abbreviation: "PROMIS Depression", name: "PROMIS Depression", domain: "PROMIS", items: "4\u20138", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },
  { abbreviation: "PROMIS Sleep", name: "PROMIS Sleep Disturbance", domain: "PROMIS", items: "4\u20138", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },
  { abbreviation: "PROMIS SI", name: "PROMIS Social Isolation", domain: "PROMIS", items: "4\u20138", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },
  { abbreviation: "PROMIS CF", name: "PROMIS Cognitive Function", domain: "PROMIS", items: "4\u20138", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },
  { abbreviation: "PROMIS PI-3a", name: "PROMIS Pain Intensity", domain: "PROMIS", items: "3", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },
  { abbreviation: "PROMIS Ped", name: "PROMIS Pediatric Measures", domain: "PROMIS", items: "Variable", hasLoinc: true, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },

  // ── Ophthalmology ──────────────────────────────────────────────────────
  { abbreviation: "NEI VFQ-25", name: "National Eye Institute Visual Function", domain: "Ophthalmology", items: "25", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain (NIH)" },

  // ── Movement Disorders ─────────────────────────────────────────────────
  { abbreviation: "YGTSS", name: "Yale Global Tic Severity Scale", domain: "Movement Disorders", items: "12", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "public", licenseDetail: "Public Domain" },

  // ── Medication Adherence ───────────────────────────────────────────────
  { abbreviation: "MMAS-8", name: "Morisky Medication Adherence Scale", domain: "Medication Adherence", items: "8", hasLoinc: false, loincCode: null, hasSnomed: false, snomedCode: null, omopCoverage: "yes", license: "proprietary", licenseDetail: "Proprietary" },
];
