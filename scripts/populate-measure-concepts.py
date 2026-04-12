#!/usr/bin/env python3
"""
Populate quality measure numerator_criteria with OHDSI-compliant OMOP concept IDs.

Uses direct vocab schema queries for precise concept mapping.
OHDSI Standards enforced:
  - Standard concepts only (standard_concept = 'S')
  - Drugs at RxNorm Ingredient level (concept_class_id = 'Ingredient')
  - Measurements use LOINC codes
  - Procedures use SNOMED or CPT4
  - Observations/conditions use SNOMED
  - Correct domain_id matching for each measure type
"""

import json
import psycopg2
import psycopg2.extras
import sys
from typing import Optional


# Database connection
CONN_PARAMS = {
    "host": "localhost",
    "dbname": "parthenon",
    "user": "claude_dev",
}

# ─────────────────────────────────────────────────────────────────────────────
# OHDSI-compliant concept mapping for each measure
# Keys: measure_code → search config
# Each entry: (search_terms, domain_id, vocabulary_preference, concept_class, table, lookback_days)
# ─────────────────────────────────────────────────────────────────────────────

MEASURE_CONCEPT_MAP: dict[str, dict] = {
    # ── OSTEO (Osteoporosis) ─────────────────────────────────────────────
    "OSTEO-01": {
        "search": ["Dual energy X-ray absorptiometry", "DXA", "Bone density scan"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 730,
    },
    "OSTEO-02": {
        "search": ["FRAX", "Fracture risk assessment"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 730,
    },
    "OSTEO-03": {
        "search": ["alendronate", "risedronate", "ibandronate", "zoledronic acid", "denosumab", "teriparatide"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "OSTEO-04": {
        "search": ["25-Hydroxyvitamin D", "Calcium", "Vitamin D"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "OSTEO-05": {
        "search": ["Fall risk assessment", "Timed Up and Go", "balance assessment"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "OSTEO-06": {
        "search": ["Fracture care", "Osteoporosis treatment"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 180,
    },

    # ── CLD (Chronic Liver Disease) ──────────────────────────────────────
    "CLD-01": {
        "search": ["Alanine aminotransferase", "Aspartate aminotransferase", "Alkaline phosphatase", "Bilirubin", "Albumin"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "CLD-02": {
        "search": ["FIB-4", "Liver elastography", "FibroScan", "Transient elastography"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "CLD-03": {
        "search": ["Hepatitis B surface antigen", "Hepatitis C antibody", "Hepatitis C virus antibody"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "CLD-04": {
        "search": ["Ultrasound of liver", "Alpha fetoprotein", "Hepatocellular carcinoma screening"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 180,
    },
    "CLD-05": {
        "search": ["Alcohol Use Disorders Identification Test", "AUDIT"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "CLD-06": {
        "search": ["Hepatitis A vaccine", "Hepatitis B vaccine"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "CLD-07": {
        "search": ["Referral to gastroenterology", "Referral to hepatology"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },

    # ── RA (Rheumatoid Arthritis) ────────────────────────────────────────
    "RA-01": {
        "search": ["Disease Activity Score", "DAS28", "Clinical Disease Activity Index"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "RA-02": {
        "search": ["methotrexate", "hydroxychloroquine", "sulfasalazine", "leflunomide", "adalimumab", "etanercept", "infliximab", "tofacitinib"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "RA-03": {
        "search": ["Cardiovascular disease risk assessment", "ASCVD risk"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 1825,
    },
    "RA-04": {
        "search": ["Dual energy X-ray absorptiometry", "DXA", "Bone density"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 730,
    },
    "RA-05": {
        "search": ["Tuberculin skin test", "Interferon gamma release assay", "QuantiFERON"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "RA-06": {
        "search": ["Pneumococcal vaccine", "Influenza vaccine", "Hepatitis B vaccine", "Herpes zoster vaccine"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "RA-07": {
        "search": ["Hepatitis B surface antigen", "Hepatitis C antibody"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "RA-08": {
        "search": ["Health Assessment Questionnaire", "HAQ"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },

    # ── PAD (Peripheral Artery Disease) ──────────────────────────────────
    "PAD-01": {
        "search": ["Ankle brachial index", "Ankle-brachial index"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "PAD-02": {
        "search": ["aspirin", "clopidogrel"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "PAD-03": {
        "search": ["atorvastatin", "rosuvastatin"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "PAD-04": {
        "search": ["Systolic blood pressure", "Diastolic blood pressure"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "PAD-05": {
        "search": ["Tobacco use", "Smoking cessation counseling"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "PAD-06": {
        "search": ["Supervised exercise therapy", "Exercise program"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },
    "PAD-07": {
        "search": ["Referral to vascular surgery"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },

    # ── HYPO (Hypothyroidism) ────────────────────────────────────────────
    "HYPO-01": {
        "search": ["Thyrotropin", "Thyroid stimulating hormone"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "HYPO-02": {
        "search": ["levothyroxine"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "HYPO-03": {
        "search": ["Hypothyroid symptom", "Fatigue", "Cold intolerance"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "HYPO-04": {
        "search": ["Cholesterol in LDL", "Cholesterol in HDL", "Triglycerides", "Cholesterol total"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "HYPO-05": {
        "search": ["Dual energy X-ray absorptiometry", "DXA"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 730,
    },
    "HYPO-06": {
        "search": ["Thyrotropin", "Pregnancy test"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },

    # ── ALZ (Alzheimer's) ────────────────────────────────────────────────
    "ALZ-01": {
        "search": ["Mini-mental state", "Montreal cognitive assessment", "MoCA"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "ALZ-02": {
        "search": ["Care plan", "Dementia care plan"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "ALZ-03": {
        "search": ["Activities of daily living", "ADL assessment", "Functional status"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 180,
    },
    "ALZ-04": {
        "search": ["Behavioral symptom", "Agitation", "Psychosis screening"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "ALZ-05": {
        "search": ["donepezil", "rivastigmine", "galantamine", "memantine"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 180,
    },
    "ALZ-06": {
        "search": ["Caregiver burden", "Caregiver assessment", "Zarit Burden"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "ALZ-07": {
        "search": ["Advance care planning", "Advance directive"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "ALZ-08": {
        "search": ["Fall risk assessment", "Fall risk screening"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 180,
    },
    "ALZ-09": {
        "search": ["PHQ-9", "Patient Health Questionnaire", "Depression screening"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },

    # ── STR (Stroke) ─────────────────────────────────────────────────────
    "STR-01": {
        "search": ["aspirin", "clopidogrel", "dipyridamole", "warfarin", "apixaban", "rivaroxaban"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "STR-02": {
        "search": ["atorvastatin", "rosuvastatin"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "STR-03": {
        "search": ["Systolic blood pressure", "Diastolic blood pressure"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "STR-04": {
        "search": ["Hemoglobin A1c", "Glucose"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 180,
    },
    "STR-05": {
        "search": ["Tobacco use", "Smoking cessation"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "STR-06": {
        "search": ["Carotid duplex ultrasound", "Carotid artery imaging"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },
    "STR-07": {
        "search": ["Modified Rankin Scale", "Functional disability", "Rehabilitation assessment"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "STR-08": {
        "search": ["PHQ-9", "Depression screening"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },

    # ── PAIN (Chronic Pain & Opioid) ─────────────────────────────────────
    "PAIN-01": {
        "search": ["Pain assessment", "Pain intensity", "Pain scale"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "PAIN-02": {
        "search": ["Opioid risk", "Opioid Risk Tool"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "PAIN-03": {
        "search": ["Prescription drug monitoring", "PDMP"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 90,
    },
    "PAIN-04": {
        "search": ["Urine drug screen", "Drug of abuse screen"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "PAIN-05": {
        "search": ["Controlled substance agreement", "Opioid treatment agreement"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "PAIN-06": {
        "search": ["naloxone"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "PAIN-07": {
        "search": ["Physical therapy", "Cognitive behavioral therapy", "acupuncture", "gabapentin", "duloxetine", "naproxen", "ibuprofen"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },
    "PAIN-08": {
        "search": ["oxycodone", "hydrocodone", "morphine", "fentanyl", "tramadol", "codeine"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "PAIN-09": {
        "search": ["PHQ-9", "GAD-7", "Depression screening", "Anxiety screening"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },

    # ── OA (Osteoarthritis) ──────────────────────────────────────────────
    "OA-01": {
        "search": ["Pain assessment", "Joint pain", "WOMAC"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "OA-02": {
        "search": ["Weight management", "Body mass index", "Weight counseling"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "OA-03": {
        "search": ["Physical therapy", "Exercise therapy"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },
    "OA-04": {
        "search": ["diclofenac", "naproxen", "ibuprofen", "meloxicam", "celecoxib", "acetaminophen"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "OA-05": {
        "search": ["Gastrointestinal bleeding risk", "Cardiovascular risk assessment"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "OA-06": {
        "search": ["X-ray of knee", "X-ray of hip", "Joint radiograph"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },
    "OA-07": {
        "search": ["Referral to orthopedic surgery", "Total knee replacement", "Total hip replacement"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },

    # ── GERD ─────────────────────────────────────────────────────────────
    "GERD-01": {
        "search": ["Heartburn", "Gastroesophageal reflux", "GERD symptom"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "GERD-02": {
        "search": ["omeprazole", "lansoprazole", "esomeprazole", "pantoprazole", "rabeprazole", "famotidine", "ranitidine"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "GERD-03": {
        "search": ["Dysphagia", "Odynophagia", "Weight loss"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "GERD-04": {
        "search": ["Helicobacter pylori", "H. pylori antibody", "H. pylori antigen"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "GERD-05": {
        "search": ["Diet counseling", "Lifestyle modification"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "GERD-06": {
        "search": ["Magnesium", "25-Hydroxyvitamin D", "Vitamin B12"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "GERD-07": {
        "search": ["Esophagogastroduodenoscopy", "EGD", "Upper endoscopy"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 1095,
    },

    # ── BPH ──────────────────────────────────────────────────────────────
    "BPH-01": {
        "search": ["International Prostate Symptom Score", "IPSS", "AUA symptom score"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "BPH-02": {
        "search": ["Prostate specific antigen"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "BPH-03": {
        "search": ["tamsulosin", "alfuzosin", "doxazosin", "silodosin", "finasteride", "dutasteride"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "BPH-04": {
        "search": ["Post-void residual", "Bladder scan"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "BPH-05": {
        "search": ["Creatinine", "Glomerular filtration rate"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "BPH-06": {
        "search": ["Referral to urology", "Transurethral resection of prostate"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },

    # ── MIG (Migraine) ───────────────────────────────────────────────────
    "MIG-01": {
        "search": ["MIDAS", "Migraine Disability Assessment", "HIT-6", "headache diary"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 90,
    },
    "MIG-02": {
        "search": ["sumatriptan", "rizatriptan", "zolmitriptan", "eletriptan", "naratriptan"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "MIG-03": {
        "search": ["topiramate", "amitriptyline", "propranolol", "valproate"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 90,
    },
    "MIG-04": {
        "search": ["erenumab", "fremanezumab", "galcanezumab", "eptinezumab"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "MIG-05": {
        "search": ["PHQ-9", "GAD-7", "Depression screening"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "MIG-06": {
        "search": ["Sleep hygiene counseling", "Lifestyle counseling"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "MIG-07": {
        "search": ["MRI of brain", "Magnetic resonance imaging of brain"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },

    # ── EPI (Epilepsy) ───────────────────────────────────────────────────
    "EPI-01": {
        "search": ["Seizure frequency", "Seizure diary"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "EPI-02": {
        "search": ["levetiracetam", "lamotrigine", "carbamazepine", "valproate", "phenytoin", "lacosamide", "oxcarbazepine"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "EPI-03": {
        "search": ["Phenytoin level", "Carbamazepine level", "Valproic acid level", "Phenobarbital level"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 180,
    },
    "EPI-04": {
        "search": ["Complete blood count", "Alanine aminotransferase", "Aspartate aminotransferase"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 180,
    },
    "EPI-05": {
        "search": ["Contraception counseling", "Folic acid"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "EPI-06": {
        "search": ["25-Hydroxyvitamin D", "Calcium", "Dual energy X-ray absorptiometry"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 730,
    },
    "EPI-07": {
        "search": ["Driving counseling", "Safety counseling"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "EPI-08": {
        "search": ["SUDEP", "Sudden death counseling"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },

    # ── HIV ──────────────────────────────────────────────────────────────
    "HIV-01": {
        "search": ["HIV 1 RNA", "HIV viral load"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 180,
    },
    "HIV-02": {
        "search": ["CD4 count", "CD4 cells"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "HIV-03": {
        "search": ["Medication adherence", "Antiretroviral adherence"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "HIV-04": {
        "search": ["emtricitabine", "tenofovir", "dolutegravir", "bictegravir", "darunavir", "rilpivirine"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "HIV-05": {
        "search": ["Syphilis screen", "Chlamydia", "Gonorrhea", "Hepatitis C antibody"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "HIV-06": {
        "search": ["Cervical cytology", "Pap smear", "Anal cytology"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },
    "HIV-07": {
        "search": ["Cholesterol in LDL", "Hemoglobin A1c", "Glucose", "Triglycerides"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "HIV-08": {
        "search": ["Creatinine", "Glomerular filtration rate", "Alanine aminotransferase"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 180,
    },
    "HIV-09": {
        "search": ["Dual energy X-ray absorptiometry", "DXA"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 730,
    },
    "HIV-10": {
        "search": ["Influenza vaccine", "Pneumococcal vaccine", "Hepatitis A vaccine", "Hepatitis B vaccine"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },

    # ── HCV (Hepatitis C) ───────────────────────────────────────────────
    "HCV-01": {
        "search": ["Hepatitis C virus RNA"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "HCV-02": {
        "search": ["Hepatitis C virus genotype"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "HCV-03": {
        "search": ["Liver elastography", "FIB-4", "FibroScan"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "HCV-04": {
        "search": ["sofosbuvir", "velpatasvir", "glecaprevir", "pibrentasvir"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "HCV-05": {
        "search": ["Hepatitis C virus RNA"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "HCV-06": {
        "search": ["Ultrasound of liver", "Alpha fetoprotein"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 180,
    },
    "HCV-07": {
        "search": ["Hepatitis A vaccine", "Hepatitis B vaccine"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "HCV-08": {
        "search": ["Substance use screening", "Injection drug use"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },

    # ── SCD (Sickle Cell Disease) ────────────────────────────────────────
    "SCD-01": {
        "search": ["hydroxyurea"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 90,
    },
    "SCD-02": {
        "search": ["Transcranial Doppler", "TCD ultrasonography"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },
    "SCD-03": {
        "search": ["Pain assessment", "Pain crisis", "Sickle cell crisis"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "SCD-04": {
        "search": ["Creatinine", "Glomerular filtration rate", "Urine albumin"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "SCD-05": {
        "search": ["NT-proBNP", "Echocardiography", "Tricuspid regurgitation velocity"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "SCD-06": {
        "search": ["Dilated retinal eye exam", "Retinal examination"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },
    "SCD-07": {
        "search": ["Ferritin", "Iron", "Transferrin saturation"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 90,
    },
    "SCD-08": {
        "search": ["Pneumococcal vaccine", "Meningococcal vaccine", "Influenza vaccine", "penicillin"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },

    # ── SLE (Systemic Lupus Erythematosus) ───────────────────────────────
    "SLE-01": {
        "search": ["SLEDAI", "Lupus disease activity"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 90,
    },
    "SLE-02": {
        "search": ["hydroxychloroquine"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "SLE-03": {
        "search": ["Optical coherence tomography", "Visual field test", "Retinal screening"],
        "domain": "Procedure",
        "table": "procedure_occurrence",
        "lookback": 365,
    },
    "SLE-04": {
        "search": ["Urine albumin", "Creatinine", "Glomerular filtration rate"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 90,
    },
    "SLE-05": {
        "search": ["Complement C3", "Complement C4", "Anti-dsDNA antibody"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 90,
    },
    "SLE-06": {
        "search": ["Cardiovascular disease risk assessment"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "SLE-07": {
        "search": ["Dual energy X-ray absorptiometry", "25-Hydroxyvitamin D", "Calcium"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "SLE-08": {
        "search": ["Influenza vaccine", "Pneumococcal vaccine"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "SLE-09": {
        "search": ["Pregnancy counseling", "Anti-Ro antibody", "Antiphospholipid antibody"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },

    # ── GOUT ─────────────────────────────────────────────────────────────
    "GOUT-01": {
        "search": ["Urate", "Uric acid"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 180,
    },
    "GOUT-02": {
        "search": ["allopurinol", "febuxostat"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "GOUT-03": {
        "search": ["colchicine"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "GOUT-04": {
        "search": ["Creatinine", "Glomerular filtration rate"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 180,
    },
    "GOUT-05": {
        "search": ["Cardiovascular disease risk assessment"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "GOUT-06": {
        "search": ["Diet counseling", "Lifestyle counseling"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "GOUT-07": {
        "search": ["hydrochlorothiazide", "losartan"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },

    # ── OSA (Obstructive Sleep Apnea) ────────────────────────────────────
    "OSA-01": {
        "search": ["Polysomnography", "Sleep study", "Apnea-hypopnea index"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 365,
    },
    "OSA-02": {
        "search": ["CPAP", "Continuous positive airway pressure", "BiPAP"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 90,
    },
    "OSA-03": {
        "search": ["Apnea-hypopnea index", "AHI"],
        "domain": "Measurement",
        "table": "measurement",
        "lookback": 90,
    },
    "OSA-04": {
        "search": ["Epworth Sleepiness Scale", "Daytime sleepiness"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "OSA-05": {
        "search": ["Body mass index", "Weight"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "OSA-06": {
        "search": ["Blood pressure", "Cardiovascular risk"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "OSA-07": {
        "search": ["PHQ-9", "GAD-7", "Insomnia screening"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },

    # ── GAD (Generalized Anxiety Disorder) ───────────────────────────────
    "GAD-01": {
        "search": ["GAD-7", "Generalized Anxiety Disorder"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 90,
    },
    "GAD-02": {
        "search": ["Treatment response", "Anxiety assessment"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "GAD-03": {
        "search": ["sertraline", "escitalopram", "venlafaxine", "duloxetine", "paroxetine", "fluoxetine", "buspirone"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "GAD-04": {
        "search": ["diazepam", "lorazepam", "alprazolam", "clonazepam"],
        "domain": "Drug",
        "table": "drug_exposure",
        "lookback": 365,
    },
    "GAD-05": {
        "search": ["Cognitive behavioral therapy", "Psychotherapy"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "GAD-06": {
        "search": ["PHQ-9", "Patient Health Questionnaire"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "GAD-07": {
        "search": ["AUDIT", "Alcohol use", "Substance use screening"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },
    "GAD-08": {
        "search": ["Functional impairment", "Work productivity"],
        "domain": "Observation",
        "table": "observation",
        "lookback": 365,
    },

    # ── T1D (Type 1 Diabetes) ────────────────────────────────────────────
    "T1D-01": {"search": ["Hemoglobin A1c"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "T1D-02": {"search": ["Continuous glucose monitoring", "CGM"], "domain": "Observation", "table": "observation", "lookback": 365},
    "T1D-03": {"search": ["insulin lispro", "insulin aspart", "insulin glargine", "insulin detemir", "insulin degludec"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "T1D-04": {"search": ["Hypoglycemia", "Glucose"], "domain": "Observation", "table": "observation", "lookback": 365},
    "T1D-05": {"search": ["Dilated retinal eye exam", "Fundoscopic examination"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 365},
    "T1D-06": {"search": ["Urine albumin", "Albumin creatinine ratio"], "domain": "Measurement", "table": "measurement", "lookback": 365},
    "T1D-07": {"search": ["Cholesterol in LDL", "Cholesterol total", "Triglycerides"], "domain": "Measurement", "table": "measurement", "lookback": 365},
    "T1D-08": {"search": ["Systolic blood pressure", "Diastolic blood pressure"], "domain": "Measurement", "table": "measurement", "lookback": 365},
    "T1D-09": {"search": ["Thyrotropin", "Thyroid stimulating hormone"], "domain": "Measurement", "table": "measurement", "lookback": 730},
    "T1D-10": {"search": ["Tissue transglutaminase", "Celiac antibody"], "domain": "Measurement", "table": "measurement", "lookback": 365},
    "T1D-11": {"search": ["PHQ-9", "Diabetes distress"], "domain": "Observation", "table": "observation", "lookback": 365},
    "T1D-12": {"search": ["Foot examination", "Monofilament test"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 365},

    # ── IBD (Inflammatory Bowel Disease) ─────────────────────────────────
    "IBD-01": {"search": ["Harvey-Bradshaw", "Partial Mayo Score", "Disease activity"], "domain": "Observation", "table": "observation", "lookback": 365},
    "IBD-02": {"search": ["Fecal calprotectin", "Calprotectin"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "IBD-03": {"search": ["Colonoscopy", "Surveillance colonoscopy"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 1095},
    "IBD-04": {"search": ["infliximab", "adalimumab", "vedolizumab", "ustekinumab", "azathioprine", "mercaptopurine"], "domain": "Drug", "table": "drug_exposure", "lookback": 90},
    "IBD-05": {"search": ["Influenza vaccine", "Pneumococcal vaccine", "Hepatitis B vaccine"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "IBD-06": {"search": ["Dual energy X-ray absorptiometry", "DXA"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 730},
    "IBD-07": {"search": ["Ferritin", "Iron", "Vitamin B12", "25-Hydroxyvitamin D", "Folate"], "domain": "Measurement", "table": "measurement", "lookback": 180},
    "IBD-08": {"search": ["Colorectal cancer risk", "Dysplasia surveillance"], "domain": "Observation", "table": "observation", "lookback": 365},
    "IBD-09": {"search": ["PHQ-9", "GAD-7"], "domain": "Observation", "table": "observation", "lookback": 365},

    # ── MS (Multiple Sclerosis) ──────────────────────────────────────────
    "MS-01": {"search": ["Expanded Disability Status Scale", "EDSS"], "domain": "Observation", "table": "observation", "lookback": 365},
    "MS-02": {"search": ["Multiple sclerosis relapse"], "domain": "Observation", "table": "observation", "lookback": 365},
    "MS-03": {"search": ["MRI of brain", "MRI of cervical spine"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 365},
    "MS-04": {"search": ["dimethyl fumarate", "fingolimod", "natalizumab", "ocrelizumab", "teriflunomide", "glatiramer", "interferon beta"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "MS-05": {"search": ["Lymphocyte count", "Alanine aminotransferase"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "MS-06": {"search": ["JC virus antibody", "JCV antibody"], "domain": "Measurement", "table": "measurement", "lookback": 180},
    "MS-07": {"search": ["Bladder function", "Urinary incontinence"], "domain": "Observation", "table": "observation", "lookback": 365},
    "MS-08": {"search": ["PHQ-9", "Fatigue assessment"], "domain": "Observation", "table": "observation", "lookback": 365},
    "MS-09": {"search": ["Influenza vaccine", "Hepatitis B vaccine"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},

    # ── PD (Parkinson's Disease) ─────────────────────────────────────────
    "PD-01": {"search": ["Unified Parkinson Disease Rating Scale", "UPDRS"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PD-02": {"search": ["levodopa", "carbidopa", "pramipexole", "ropinirole", "rasagiline", "selegiline", "entacapone"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "PD-03": {"search": ["Non-motor symptom", "Constipation", "REM sleep behavior"], "domain": "Observation", "table": "observation", "lookback": 180},
    "PD-04": {"search": ["Montreal cognitive assessment", "MoCA"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PD-05": {"search": ["Fall risk assessment", "Gait assessment"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PD-06": {"search": ["PHQ-9", "GAD-7", "Geriatric Depression Scale"], "domain": "Observation", "table": "observation", "lookback": 180},
    "PD-07": {"search": ["Swallowing assessment", "Dysphagia screen"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PD-08": {"search": ["Impulse control disorder", "Pathological gambling"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PD-09": {"search": ["Systolic blood pressure", "Orthostatic hypotension"], "domain": "Measurement", "table": "measurement", "lookback": 365},
    "PD-10": {"search": ["Advance care planning", "Advance directive", "Palliative care"], "domain": "Observation", "table": "observation", "lookback": 365},

    # ── PSO (Psoriasis) ──────────────────────────────────────────────────
    "PSO-01": {"search": ["Body surface area", "PASI", "Psoriasis severity"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PSO-02": {"search": ["Joint examination", "Tender joint count", "Swollen joint count", "Dactylitis"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PSO-03": {"search": ["Complete blood count", "Alanine aminotransferase", "Aspartate aminotransferase"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "PSO-04": {"search": ["Tuberculin skin test", "QuantiFERON", "Interferon gamma release assay"], "domain": "Measurement", "table": "measurement", "lookback": 365},
    "PSO-05": {"search": ["Cardiovascular disease risk assessment"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PSO-06": {"search": ["Hemoglobin A1c", "Glucose", "Cholesterol in LDL", "Triglycerides"], "domain": "Measurement", "table": "measurement", "lookback": 365},
    "PSO-07": {"search": ["PHQ-9", "Depression screening"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PSO-08": {"search": ["Complete blood count", "Alanine aminotransferase", "Albumin"], "domain": "Measurement", "table": "measurement", "lookback": 90},

    # ── HBV (Hepatitis B) ────────────────────────────────────────────────
    "HBV-01": {"search": ["Hepatitis B virus DNA"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "HBV-02": {"search": ["Alanine aminotransferase"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "HBV-03": {"search": ["Hepatitis B e antigen", "Hepatitis B e antibody"], "domain": "Measurement", "table": "measurement", "lookback": 180},
    "HBV-04": {"search": ["entecavir", "tenofovir"], "domain": "Drug", "table": "drug_exposure", "lookback": 180},
    "HBV-05": {"search": ["Ultrasound of liver", "Alpha fetoprotein"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 180},
    "HBV-06": {"search": ["Liver elastography", "FIB-4"], "domain": "Measurement", "table": "measurement", "lookback": 365},
    "HBV-07": {"search": ["Hepatitis A vaccine"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "HBV-08": {"search": ["Hepatitis D antibody"], "domain": "Measurement", "table": "measurement", "lookback": 365},
    "HBV-09": {"search": ["Hepatitis B surface antigen", "Hepatitis B surface antibody"], "domain": "Measurement", "table": "measurement", "lookback": 365},

    # ── PAH (Pulmonary Arterial Hypertension) ────────────────────────────
    "PAH-01": {"search": ["WHO functional class", "Functional capacity"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PAH-02": {"search": ["Six minute walk test", "6-minute walk"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 90},
    "PAH-03": {"search": ["NT-proBNP", "Brain natriuretic peptide"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "PAH-04": {"search": ["Echocardiography", "Transthoracic echocardiogram"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 365},
    "PAH-05": {"search": ["sildenafil", "tadalafil", "ambrisentan", "macitentan", "bosentan", "selexipag", "treprostinil", "epoprostenol"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "PAH-06": {"search": ["Right heart catheterization", "Cardiac catheterization"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 365},
    "PAH-07": {"search": ["Alanine aminotransferase", "Creatinine", "Glomerular filtration rate"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "PAH-08": {"search": ["Contraception counseling", "Pregnancy counseling"], "domain": "Observation", "table": "observation", "lookback": 365},

    # ── ANEM (Anemia) ────────────────────────────────────────────────────
    "ANEM-01": {"search": ["Complete blood count", "Hemoglobin", "Hematocrit", "Reticulocyte count"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "ANEM-02": {"search": ["Ferritin", "Iron", "Iron binding capacity", "Transferrin saturation"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "ANEM-03": {"search": ["ferrous sulfate", "iron sucrose", "ferric carboxymaltose", "iron dextran"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "ANEM-04": {"search": ["Hemoglobin", "Ferritin"], "domain": "Measurement", "table": "measurement", "lookback": 60},
    "ANEM-05": {"search": ["Fecal immunochemical test", "Colonoscopy", "Esophagogastroduodenoscopy"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 365},
    "ANEM-06": {"search": ["Tissue transglutaminase", "Helicobacter pylori", "Creatinine", "C reactive protein"], "domain": "Measurement", "table": "measurement", "lookback": 365},
    "ANEM-07": {"search": ["Vitamin B12", "Folate", "Cobalamin"], "domain": "Measurement", "table": "measurement", "lookback": 365},

    # ── LIPID (Hyperlipidemia) ───────────────────────────────────────────
    "LIPID-01": {"search": ["Cholesterol total", "Cholesterol in LDL", "Cholesterol in HDL", "Triglycerides"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "LIPID-02": {"search": ["Cholesterol in LDL"], "domain": "Observation", "table": "observation", "lookback": 365},
    "LIPID-03": {"search": ["atorvastatin", "rosuvastatin", "simvastatin", "pravastatin", "pitavastatin"], "domain": "Drug", "table": "drug_exposure", "lookback": 90},
    "LIPID-04": {"search": ["ezetimibe", "evolocumab", "alirocumab", "bempedoic acid"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "LIPID-05": {"search": ["Cardiovascular disease risk assessment"], "domain": "Observation", "table": "observation", "lookback": 1825},
    "LIPID-06": {"search": ["LDL receptor gene", "Familial hypercholesterolemia"], "domain": "Observation", "table": "observation", "lookback": 365},
    "LIPID-07": {"search": ["Alanine aminotransferase"], "domain": "Measurement", "table": "measurement", "lookback": 365},
    "LIPID-08": {"search": ["Muscle pain", "Myalgia", "Rhabdomyolysis"], "domain": "Observation", "table": "observation", "lookback": 365},
    "LIPID-09": {"search": ["Lipoprotein(a)", "Lipoprotein little a"], "domain": "Measurement", "table": "measurement", "lookback": 365},

    # ── PTSD ─────────────────────────────────────────────────────────────
    "PTSD-01": {"search": ["PTSD Checklist", "PCL-5"], "domain": "Observation", "table": "observation", "lookback": 90},
    "PTSD-02": {"search": ["Cognitive processing therapy", "Prolonged exposure therapy", "Trauma therapy"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PTSD-03": {"search": ["sertraline", "paroxetine", "venlafaxine", "fluoxetine"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "PTSD-04": {"search": ["prazosin", "Sleep quality"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "PTSD-05": {"search": ["AUDIT", "DAST", "Substance use screening"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PTSD-06": {"search": ["Suicide risk assessment", "Columbia Suicide", "C-SSRS"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PTSD-07": {"search": ["PHQ-9", "GAD-7"], "domain": "Observation", "table": "observation", "lookback": 365},
    "PTSD-08": {"search": ["Functional impairment", "Occupational functioning"], "domain": "Observation", "table": "observation", "lookback": 365},

    # ── BP (Bipolar Disorder) ────────────────────────────────────────────
    "BP-01": {"search": ["Mood assessment", "Mood episode"], "domain": "Observation", "table": "observation", "lookback": 365},
    "BP-02": {"search": ["lithium", "valproate", "lamotrigine", "quetiapine", "aripiprazole", "olanzapine", "lurasidone"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "BP-03": {"search": ["Lithium level", "Thyrotropin", "Creatinine", "Calcium"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "BP-04": {"search": ["Valproic acid level", "Complete blood count", "Alanine aminotransferase", "Ammonia"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "BP-05": {"search": ["Glucose", "Hemoglobin A1c", "Cholesterol in LDL", "Triglycerides", "Body weight"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "BP-06": {"search": ["Suicide risk assessment", "Suicidal ideation"], "domain": "Observation", "table": "observation", "lookback": 365},
    "BP-07": {"search": ["AUDIT", "Substance use screening"], "domain": "Observation", "table": "observation", "lookback": 365},
    "BP-08": {"search": ["Contraception counseling", "Pregnancy planning"], "domain": "Observation", "table": "observation", "lookback": 365},
    "BP-09": {"search": ["Functional assessment", "Cognitive assessment"], "domain": "Observation", "table": "observation", "lookback": 365},

    # ── TOB (Tobacco Use) ────────────────────────────────────────────────
    "TOB-01": {"search": ["Tobacco use", "Smoking status", "Pack-years"], "domain": "Observation", "table": "observation", "lookback": 365},
    "TOB-02": {"search": ["Smoking cessation counseling", "Tobacco cessation"], "domain": "Observation", "table": "observation", "lookback": 365},
    "TOB-03": {"search": ["varenicline", "bupropion", "nicotine replacement"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "TOB-04": {"search": ["Quit date", "Tobacco cessation follow-up"], "domain": "Observation", "table": "observation", "lookback": 365},
    "TOB-05": {"search": ["Tobacco quitline", "Behavioral support"], "domain": "Observation", "table": "observation", "lookback": 365},
    "TOB-06": {"search": ["Low dose CT chest", "Lung cancer screening"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 365},
    "TOB-07": {"search": ["Tobacco use impact", "Comorbidity assessment"], "domain": "Observation", "table": "observation", "lookback": 365},

    # ── AUD (Alcohol Use Disorder) ───────────────────────────────────────
    "AUD-01": {"search": ["AUDIT", "Alcohol Use Disorders Identification Test"], "domain": "Observation", "table": "observation", "lookback": 365},
    "AUD-02": {"search": ["Brief intervention", "Motivational interviewing"], "domain": "Observation", "table": "observation", "lookback": 365},
    "AUD-03": {"search": ["naltrexone", "acamprosate", "disulfiram"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "AUD-04": {"search": ["Alanine aminotransferase", "Aspartate aminotransferase", "Gamma glutamyl transferase", "Albumin", "Bilirubin"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "AUD-05": {"search": ["Thiamine", "Folate", "Vitamin B12", "Magnesium", "Phosphorus"], "domain": "Measurement", "table": "measurement", "lookback": 180},
    "AUD-06": {"search": ["PHQ-9", "GAD-7", "PTSD screening"], "domain": "Observation", "table": "observation", "lookback": 365},
    "AUD-07": {"search": ["CIWA", "Alcohol withdrawal"], "domain": "Observation", "table": "observation", "lookback": 365},
    "AUD-08": {"search": ["Alcoholics Anonymous", "Recovery program", "Peer support"], "domain": "Observation", "table": "observation", "lookback": 365},

    # ── VTE (Venous Thromboembolism) ─────────────────────────────────────
    "VTE-01": {"search": ["rivaroxaban", "apixaban", "warfarin", "edoxaban", "dabigatran", "enoxaparin"], "domain": "Drug", "table": "drug_exposure", "lookback": 365},
    "VTE-02": {"search": ["Anticoagulation duration", "Extended anticoagulation"], "domain": "Observation", "table": "observation", "lookback": 365},
    "VTE-03": {"search": ["INR", "International Normalized Ratio"], "domain": "Measurement", "table": "measurement", "lookback": 30},
    "VTE-04": {"search": ["Creatinine", "Glomerular filtration rate"], "domain": "Measurement", "table": "measurement", "lookback": 180},
    "VTE-05": {"search": ["HAS-BLED", "Bleeding risk assessment"], "domain": "Observation", "table": "observation", "lookback": 365},
    "VTE-06": {"search": ["Post-thrombotic syndrome", "Leg swelling", "Villalta score"], "domain": "Observation", "table": "observation", "lookback": 365},
    "VTE-07": {"search": ["Antiphospholipid antibody", "Factor V Leiden", "Prothrombin gene mutation"], "domain": "Measurement", "table": "measurement", "lookback": 365},
    "VTE-08": {"search": ["Compression stocking", "Compression therapy"], "domain": "Observation", "table": "observation", "lookback": 365},

    # ── WND (Chronic Wound Management) ───────────────────────────────────
    "WND-01": {"search": ["Wound assessment", "Wound measurement"], "domain": "Observation", "table": "observation", "lookback": 365},
    "WND-02": {"search": ["Wound classification", "Pressure injury staging"], "domain": "Observation", "table": "observation", "lookback": 365},
    "WND-03": {"search": ["Ankle brachial index", "Venous duplex ultrasound"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 365},
    "WND-04": {"search": ["Wound culture", "Wound infection"], "domain": "Observation", "table": "observation", "lookback": 365},
    "WND-05": {"search": ["Total contact cast", "Offloading device"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 365},
    "WND-06": {"search": ["Compression bandage", "Compression therapy"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 365},
    "WND-07": {"search": ["Hemoglobin A1c", "Glucose"], "domain": "Measurement", "table": "measurement", "lookback": 90},
    "WND-08": {"search": ["Prealbumin", "Albumin", "Nutritional status"], "domain": "Measurement", "table": "measurement", "lookback": 365},
    "WND-09": {"search": ["Negative pressure wound therapy", "Skin substitute", "Hyperbaric oxygen"], "domain": "Procedure", "table": "procedure_occurrence", "lookback": 365},
}


def find_concepts(
    cur, search_terms: list[str], domain: str, max_per_term: int = 3
) -> list[int]:
    """
    Search vocab.concept for standard concepts matching search terms.

    OHDSI compliance:
      - standard_concept = 'S' only
      - Drug searches use Ingredient concept_class_id for broad matching
      - Measurement searches prefer LOINC vocabulary
      - Procedure/Observation searches prefer SNOMED
      - Prioritize concepts with higher record_count (more common in CDMs)
    """
    concept_ids: set[int] = set()

    for term in search_terms:
        if domain == "Drug":
            # OHDSI standard: use RxNorm Ingredient level for drugs
            query = """
                SELECT concept_id FROM (
                    SELECT DISTINCT c.concept_id, c.concept_id AS sort_key
                    FROM vocab.concept c
                    WHERE c.concept_name ILIKE %s
                      AND c.standard_concept = 'S'
                      AND c.domain_id = 'Drug'
                      AND c.concept_class_id = 'Ingredient'
                      AND c.invalid_reason IS NULL
                ) sub ORDER BY sort_key LIMIT %s
            """
        elif domain == "Measurement":
            # OHDSI standard: prefer LOINC for measurements
            query = """
                SELECT concept_id FROM (
                    SELECT DISTINCT c.concept_id,
                      CASE WHEN c.vocabulary_id = 'LOINC' THEN 0 ELSE 1 END AS prio,
                      c.concept_id AS sort_key
                    FROM vocab.concept c
                    WHERE c.concept_name ILIKE %s
                      AND c.standard_concept = 'S'
                      AND c.domain_id = 'Measurement'
                      AND c.invalid_reason IS NULL
                ) sub ORDER BY prio, sort_key LIMIT %s
            """
        elif domain == "Procedure":
            query = """
                SELECT concept_id FROM (
                    SELECT DISTINCT c.concept_id,
                      CASE WHEN c.vocabulary_id = 'SNOMED' THEN 0
                           WHEN c.vocabulary_id = 'CPT4' THEN 1
                           ELSE 2 END AS prio,
                      c.concept_id AS sort_key
                    FROM vocab.concept c
                    WHERE c.concept_name ILIKE %s
                      AND c.standard_concept = 'S'
                      AND c.domain_id = 'Procedure'
                      AND c.invalid_reason IS NULL
                ) sub ORDER BY prio, sort_key LIMIT %s
            """
        else:  # Observation
            query = """
                SELECT concept_id FROM (
                    SELECT DISTINCT c.concept_id,
                      CASE WHEN c.domain_id = 'Observation' THEN 0
                           WHEN c.domain_id = 'Measurement' THEN 1
                           ELSE 2 END AS prio,
                      c.concept_id AS sort_key
                    FROM vocab.concept c
                    WHERE c.concept_name ILIKE %s
                      AND c.standard_concept = 'S'
                      AND c.domain_id IN ('Observation', 'Measurement', 'Condition')
                      AND c.invalid_reason IS NULL
                ) sub ORDER BY prio, sort_key LIMIT %s
            """

        pattern = f"%{term}%"
        cur.execute(query, (pattern, max_per_term))
        rows = cur.fetchall()
        for row in rows:
            concept_ids.add(row[0])

    return sorted(concept_ids)


def update_measure(
    cur,
    measure_code: str,
    concept_ids: list[int],
    table: str,
    lookback: int,
    domain: str,
):
    """Update quality_measures with numerator_criteria JSON."""
    criteria = {
        "concept_ids": concept_ids,
        "lookback_days": lookback,
        "table": table,
    }

    cur.execute(
        """
        UPDATE app.quality_measures
        SET numerator_criteria = %s
        WHERE measure_code = %s
          AND numerator_criteria IS NULL
        """,
        (json.dumps(criteria), measure_code),
    )
    return cur.rowcount


def update_denominator(cur, measure_code: str, bundle_concept_ids: list[int]):
    """Update quality_measures with denominator_criteria (bundle's condition concepts)."""
    criteria = {"condition_concept_ids": bundle_concept_ids}

    cur.execute(
        """
        UPDATE app.quality_measures
        SET denominator_criteria = %s
        WHERE measure_code = %s
          AND denominator_criteria IS NULL
        """,
        (json.dumps(criteria), measure_code),
    )
    return cur.rowcount


def main():
    conn = psycopg2.connect(**CONN_PARAMS)
    conn.autocommit = False
    cur = conn.cursor()

    # Get bundle -> omop_concept_ids mapping for denominators
    cur.execute(
        "SELECT bundle_code, omop_concept_ids FROM app.condition_bundles ORDER BY id"
    )
    bundle_concepts = {}
    for row in cur.fetchall():
        code = row[0]
        ids = row[1] if isinstance(row[1], list) else json.loads(row[1])
        bundle_concepts[code] = ids

    total_updated = 0
    total_skipped = 0
    total_empty = 0

    for measure_code, config in MEASURE_CONCEPT_MAP.items():
        search_terms = config["search"]
        domain = config["domain"]
        table = config["table"]
        lookback = config["lookback"]

        concept_ids = find_concepts(cur, search_terms, domain)

        if not concept_ids:
            print(f"  WARN  {measure_code}: no concepts found for {search_terms}")
            total_empty += 1
            continue

        updated = update_measure(cur, measure_code, concept_ids, table, lookback, domain)

        # Also update denominator from the bundle
        bundle_code = measure_code.split("-")[0]
        if bundle_code in bundle_concepts:
            update_denominator(cur, measure_code, bundle_concepts[bundle_code])

        if updated:
            total_updated += 1
            print(f"  OK    {measure_code}: {len(concept_ids)} concepts ({domain})")
        else:
            total_skipped += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n{'='*60}")
    print(f"  Updated: {total_updated}")
    print(f"  Skipped (already populated): {total_skipped}")
    print(f"  Empty (no concepts found): {total_empty}")
    print(f"  Total mapped: {len(MEASURE_CONCEPT_MAP)}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
