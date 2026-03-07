# ETL Plan: Dr. M.B. Udoshi — Single Patient Import to OHDSI Acumenus CDM

## Patient Summary

**Patient:** Dr. Mallikarjun B. Udoshi, MD (Master Cardiologist)
**DOB:** 12/01/1942 | **Sex:** Male | **Race:** East Indian
**Address:** 94 Sedlar Lane, Dallas, PA 18612
**MRNs:** 000499504 (Commonwealth Health), 052098050 (HUP), 364612374 (PMC/DCR), 013163120 (PAH)
**Primary Diagnosis:** Stage IV Metastatic Colon Carcinoma (Adenocarcinoma of Sigmoid Colon)

**Clinical Timeline:** 2006-11-30 through 2015-08-28 (9 years of documented care)

---

## Source Data Inventory

### 1. Continuity of Care Record (CCR) — `MBU-REVISED-CCR-V2.pdf`
- **Pages 1-2:** History of Present Illness timeline (26 dated clinical events, 2006-2015)
- **Pages 3-4:** CT Chest without contrast report (05/18/2015, Commonwealth Health)
- **Pages 5-7:** CT Abdomen with/without contrast report (02/17/2012, CDI/Wyoming Valley)
- **Pages 7-8:** PET/CT Skull Base to Mid-Thigh (05/15/2013, Wilkes-Barre General)
- **Pages 9-10:** PET/CT report from UPenn/HUP (02/29/2012) — initial staging
- **Pages 11-12:** CT Chest without contrast (05/13/2013, CDI) — interval increase in nodules
- **Pages 13-14:** PET/CT (08/03/2015, Wilkes-Barre General) — extensive metastatic progression
- **Pages 15-16:** CT Abdomen with/without contrast (01/14/2015, Commonwealth Health)
- **Pages 17-18:** CT Chest with contrast (01/14/2015, Commonwealth Health) — nodule progression
- **Pages 19-20:** Surgical Pathology / Right Lung Biopsy (08/19/2013, HUP) — metastatic adenocarcinoma confirmed, EGFR/KRAS molecular testing
- **Pages 21-22:** EGFR Mutation Analysis Report (08/19/2013, HUP Molecular Pathology)

### 2. DICOM Imaging Archive — `docs/MBU/`
- **5,013 DICOM files** in `DICOM/` directory
- **DICOMDIR** index file (2.3 MB)
- **Two patient entries** (same patient, different name registrations):
  - `UDOSHI_MALLIKARJUN` — 1 study: WB PET/CT Lung/Colon (CT attenuation + SUV PET)
  - `UDOSHI_MALLIKARJUN_MD` — 13 studies:
    - ABD_PEL_ORAL_WO_W_IV_CONTRAST (9967357)
    - CHEST_FRONTAL_LATERAL_2_VIEW (2 studies)
    - CHEST_IV_CON_CT (9766058)
    - CHEST_WO_IV_CON_CT (14243588, 9832203, 9882033, 9919874)
    - CHEST_W_IV_CON_CT (14138299)
    - CT_CHEST_W_IV_CONTRAST_CT (9967356)
    - C_SPINE_WO_CONTRAST_MRI (7296)
    - PET_CT_SKULL_BASE_TO_M (1540)
    - SINUSES_CT_ROUTINE (10019688)
- **Exported from OsiriX** (Mac DICOM viewer) with QuickTime .mov cine files and HTML viewers
- **Weasis viewer** bundled (cross-platform DICOM viewer, Linux/Mac/Win)

### 3. CEA Lab Values (from CCR page 2)
16 serial Carcinoembryonic Antigen measurements spanning 2006-2015.

---

## OMOP CDM v5.4 Target Tables

This ETL populates **10 OMOP CDM tables** in the `omop` schema of the local `ohdsi` database:

| # | Table | Records | Source |
|---|-------|---------|--------|
| 1 | `person` | 1 | Demographics from CCR/reports |
| 2 | `observation_period` | 1 | 2006-11-30 to 2015-08-28 |
| 3 | `visit_occurrence` | ~40 | Each dated clinical encounter |
| 4 | `condition_occurrence` | ~15 | Diagnoses, metastases, complications |
| 5 | `procedure_occurrence` | ~25 | Colonoscopies, surgeries, imaging, biopsies, RFA, radiation |
| 6 | `drug_exposure` | ~8 | FOLFOX, FOLFIRI, Avastin, GlaxoSmithKline trial drug |
| 7 | `measurement` | ~20 | CEA levels (16), EGFR mutation, KRAS mutation |
| 8 | `observation` | ~5 | Weight loss, debilitation, clinical notes |
| 9 | `note` | ~12 | Full radiology/pathology report text |
| 10 | `death` | 1 | (date to be confirmed with user) |

**Total: ~127 records across 10 tables**

---

## Phase 1: OMOP Concept Mapping (Verified Against Acumenus Vocabulary)

### 1.1 Demographics

| Field | Value | concept_id | concept_name |
|-------|-------|------------|--------------|
| Gender | Male | 8507 | MALE |
| Race | East Indian | 38003574 | Asian Indian (Race) |
| Ethnicity | Not Hispanic | 38003564 | Not Hispanic or Latino |

### 1.2 Conditions

| Clinical Event | concept_id | concept_name | vocabulary |
|----------------|------------|--------------|------------|
| Adenocarcinoma of sigmoid colon | 443381 | Malignant tumor of sigmoid colon | SNOMED |
| Pulmonary metastases (lung nodules) | *TBD — query at runtime* | Secondary malignant neoplasm of lung | SNOMED |
| Hepatic metastases (08/2015) | *TBD* | Secondary malignant neoplasm of liver | SNOMED |
| Bone metastases — T5/T6, left scapula (08/2015) | *TBD* | Secondary malignant neoplasm of bone | SNOMED |
| Pleural effusion | 254061 | Pleural effusion | SNOMED |
| Pleurisy | 78786 | Pleurisy | SNOMED |
| Mucositis (FOLFOX side effect) | 440436 | Mucositis following therapy | SNOMED |
| Myelosuppression (FOLFOX side effect) | 4156433 | Myelosuppression | SNOMED |

### 1.3 Procedures

| Clinical Event | concept_id | concept_name | vocabulary |
|----------------|------------|--------------|------------|
| Colonoscopy (×5: 2006, 2007, 2009, 2011, 2012) | 4249893 | Colonoscopy | SNOMED |
| Polypectomy (2006-11-30) | 4103380 | Endoscopic polypectomy of large intestine | SNOMED |
| CT Abdomen (02/08/2012) | 4061009 | CT of abdomen | SNOMED |
| PET/CT (02/29/2012, 05/15/2013, 08/03/2015) | 4305790 | Positron emission tomography | SNOMED |
| Sigmoid colectomy with end-to-end anastomosis (03/06/2012) | 4225427 | Sigmoid colectomy | SNOMED |
| CT Chest (multiple: 2013-2015) | 4058335 | CT of chest | SNOMED |
| Thoracoscopy + Right Lung Biopsy (08/19/2013) | 4032774 | Thoracoscopy | SNOMED |
| Biopsy of lung (08/19/2013) | 4303062 | Biopsy of lung | SNOMED |
| RFA — right upper lung nodule (05/19/2015) | 604322 | Radiofrequency ablation | SNOMED |
| RFA — left lung nodules ×3 (06/22/2015) | 604322 | Radiofrequency ablation | SNOMED |
| Thoracentesis / pleural tap (07/01/2015) | 4240305 | Thoracentesis | SNOMED |
| Chest X-ray (06/30/2015) | 4163872 | Plain chest X-ray | SNOMED |
| Regional radiation therapy — T5 + left scapula (08/10/2015) | 4141448 | External beam radiation therapy procedure | SNOMED |

### 1.4 Drug Exposures

| Regimen | Components (RxNorm Ingredients) | Dates |
|---------|-------------------------------|-------|
| **FOLFOX** (4 rounds, stopped for toxicity) | oxaliplatin (1318011), fluorouracil (955632), leucovorin (1388796) | 2012-05-07 → ~2012-08 |
| **FOLFIRI** (7 rounds) | irinotecan (1367268), fluorouracil (955632), leucovorin (1388796) | 2013-10-07 → ~2014-01 |
| **Avastin (bevacizumab)** maintenance (7 treatments, no effect) | bevacizumab (1397141) | 2015-01 → 2015-04 |
| **Phase I Clinical Trial** (GlaxoSmithKline, UPenn) — ceased for side effects | *concept_id=0* (unknown investigational drug) | 2014-09-10 → ~2014-10 |

### 1.5 Measurements

| Measurement | concept_id | value | unit | dates |
|-------------|------------|-------|------|-------|
| CEA level (×16 serial values) | 4244721 | 5.0, 5.1, 5.1, 6.1, 17, 20, 22, 3.7, 4.5, 4.7, 4.7, 4.9, 4.5, 4.7, 5.7 | ng/mL | 2006-12 → 2015-02 |
| EGFR Exon 19 deletion | 35962802 | Negative | — | 2013-08-19 |
| EGFR Leu858Arg mutation | 35962802 | Negative | — | 2013-08-19 |
| KRAS mutation analysis | 3012200 | *previously tested — result: positive (KRAS)* | — | 2013 |

### 1.6 Notes (Full Radiology/Pathology Report Text)

| Note | note_type_concept_id | Date |
|------|---------------------|------|
| CT Abdomen w/wo contrast — CDI (Dr. Naresh Shah) | 44814637 (Radiology report) | 2012-02-17 |
| PET/CT — HUP (Dr. Shah, Jagruti / Dr. Drebin) | 44814637 | 2012-02-29 |
| CT Chest w/o contrast — CDI (Dr. Naresh Shah) | 44814637 | 2013-05-13 |
| PET/CT — Wilkes-Barre (Dr. Nobel George) | 44814637 | 2013-05-15 |
| Surgical Pathology — HUP (Dr. Hatem, Dr. Deshpande) | 44814638 (Pathology report) | 2013-08-19 |
| EGFR Mutation Analysis — HUP Molecular Pathology (Dr. Pear) | 44814638 | 2013-08-19 |
| CT Abdomen w/wo contrast — Commonwealth (Dr. Naresh Shah) | 44814637 | 2015-01-14 |
| CT Chest w contrast — Commonwealth (Dr. Naresh Shah) | 44814637 | 2015-01-14 |
| CT Chest w/o contrast — Commonwealth (Dr. Naresh Shah) | 44814637 | 2015-05-18 |
| PET/CT — Wilkes-Barre (Dr. Joan Forgetta) | 44814637 | 2015-08-03 |

---

## Phase 2: Complete Clinical Timeline → OMOP Events

Every dated event from the CCR, mapped to its target OMOP table:

| Date | Event | OMOP Table | concept_id |
|------|-------|------------|------------|
| 2006-11-30 | Routine colonoscopy, polyp removed, Adeno CA w/ submucosal invasion | procedure_occurrence | 4249893 + 4103380 |
| 2006-11-30 | Initial diagnosis: Adenocarcinoma of sigmoid colon | condition_occurrence | 443381 |
| 2006-12 | CEA = 5.0 | measurement | 4244721 |
| 2007-05-01 | Second colonoscopy — negative | procedure_occurrence | 4249893 |
| 2007-12 | CEA = 5.1 | measurement | 4244721 |
| 2009-03-23 | Third colonoscopy — negative | procedure_occurrence | 4249893 |
| 2009-03 | CEA = 5.1 | measurement | 4244721 |
| 2010-11 | CEA = 6.1 | measurement | 4244721 |
| 2011-04-01 | Fourth colonoscopy — negative | procedure_occurrence | 4249893 |
| 2011-12 | CEA = 17 (rising) | measurement | 4244721 |
| 2012-01-02 | Fifth colonoscopy — negative (done due to high CEA) | procedure_occurrence | 4249893 |
| 2012-02 | CEA = 20 | measurement | 4244721 |
| 2012-02-08 | CT Abdomen — retroperitoneal mass found | procedure_occurrence | 4061009 |
| 2012-02-29 | PET Scan @ UPenn — hypermetabolic lesion (retroperitoneal mass) | procedure_occurrence | 4305790 |
| 2012-03-05 | CEA = 22 (peak) | measurement | 4244721 |
| 2012-03-06 | Surgery: sigmoid colectomy w/ end-to-end anastomosis @ UPenn (Dr. Drebin) — pathology: Adeno CA | procedure_occurrence | 4225427 |
| 2012-03-07 | CEA = 3.7 (post-surgical drop) | measurement | 4244721 |
| 2012-05-07 | FOLFOX chemotherapy started | drug_exposure | 1318011, 955632, 1388796 |
| 2012-05-07 | FOLFOX stopped after 4 rounds — myelosuppression + mucositis | condition_occurrence | 4156433, 440436 |
| 2012-06-04 | CEA = 4.5 | measurement | 4244721 |
| 2012-10 | CEA = 4.7 | measurement | 4244721 |
| 2013-01 | CEA = 4.7 | measurement | 4244721 |
| 2013-02-08 | CT Chest — two small lung nodules found | procedure_occurrence | 4058335 |
| 2013-02-08 | New condition: pulmonary metastases | condition_occurrence | *lung mets concept* |
| 2013-05 | CEA = 4.9 | measurement | 4244721 |
| 2013-05-13 | CT Chest — enlarging, now 4 lung nodules (interval increase) | procedure_occurrence | 4058335 |
| 2013-05-15 | PET/CT skull base to mid-thigh — subcentimeter nodules, no FDG avid | procedure_occurrence | 4305790 |
| 2013-08-19 | Thoracoscopy + right lung biopsy — metastatic Adeno CA confirmed | procedure_occurrence | 4032774 + 4303062 |
| 2013-08-19 | Pathology: metastatic colonic adenocarcinoma, CDX-2 positive | note | (pathology) |
| 2013-08-19 | EGFR Exon 19 deletion: Negative | measurement | 35962802 |
| 2013-08-19 | EGFR Leu858Arg mutation: Negative | measurement | 35962802 |
| 2013-08-19 | KRAS: previously tested (positive per prior record) | measurement | 3012200 |
| 2013-10 | CEA = 4.5 | measurement | 4244721 |
| 2013-10-07 | FOLFIRI chemotherapy started (7 rounds) | drug_exposure | 1367268, 955632, 1388796 |
| 2013-12 | CEA = 4.7 | measurement | 4244721 |
| 2013-12-26 | CT Chest — reduction in lung nodule size, no new nodules | procedure_occurrence | 4058335 |
| 2014-03-26 | CT Chest — stable | procedure_occurrence | 4058335 |
| 2014-07-03 | CT Chest + Abdomen — enlarged lung nodules, no liver mets | procedure_occurrence | 4058335 + 4061009 |
| 2014-08-25 | CT Chest — enlarging nodules + new small nodules | procedure_occurrence | 4058335 |
| 2014-09-10 | Phase I Clinical Trial (GlaxoSmithKline) @ UPenn — ceased for side effects | drug_exposure | 0 |
| 2015-01 | Avastin maintenance started (7 treatments, no effect) | drug_exposure | 1397141 |
| 2015-01-12 | Consultation at Johns Hopkins — Dr. Luis Diaz | visit_occurrence | — |
| 2015-01-14 | CT Abdomen w/wo contrast — no metastasis in abdomen | procedure_occurrence | 4061009 |
| 2015-01-14 | CT Chest w contrast — slight interval increase in nodules | procedure_occurrence | 4058335 |
| 2015-02 | CEA = 5.7 | measurement | 4244721 |
| 2015-04-25 | Consultation with Dr. Hong — scheduled for RFA | visit_occurrence | — |
| 2015-05-18 | CT Chest w/o contrast — nodules unchanged/minimally larger | procedure_occurrence | 4058335 |
| 2015-05-19 | RFA right upper lung nodule (single) | procedure_occurrence | 604322 |
| 2015-06-22 | RFA left lung nodules (three) | procedure_occurrence | 604322 |
| 2015-06-22 | Hospitalized — severe chest wall pain, pleurisy | condition_occurrence | 78786 |
| 2015-06-30 | CXR — left pleural effusion + atelectasis | procedure_occurrence + condition | 4163872 + 254061 |
| 2015-07-01 | USG Pleural Tap — 1000 mL from left chest | procedure_occurrence | 4240305 |
| 2015-07/08 | Severe weight loss, constitutional symptoms, debilitation | observation | 4229881 |
| 2015-08-03 | PET/CT — multiple metastases: liver, lung, bone (T5/T6, left scapula) | procedure_occurrence | 4305790 |
| 2015-08-03 | New: hepatic metastases | condition_occurrence | *liver mets concept* |
| 2015-08-03 | New: bone metastases (T5/T6, left scapula) | condition_occurrence | *bone mets concept* |
| 2015-08-05 | Consultation with Radiation Oncologist — Dr. Schulman | visit_occurrence | — |
| 2015-08-10 | Regional radiation therapy to T5 + left scapula (12 treatments through 08-28) | procedure_occurrence | 4141448 |

---

## Phase 3: Implementation — Python ETL Script

### 3.1 Architecture

```
installer/
  etl_mbu_patient.py        # Main ETL script
  data/
    mbu_clinical_events.json # Structured extraction of all events above
```

The script will:
1. Connect to the `ohdsi` database at `pgsql.acumenus.net`
2. Resolve all `*TBD*` concept_ids via live vocabulary queries at runtime
3. Assign `person_id` = next available after max existing (1005787 + 1 = **1005788**)
4. Insert records across all 10 tables in a single transaction
5. Validate referential integrity post-insert
6. Optionally push DICOM files to Orthanc and link via `imaging_study` app table

### 3.2 Person Record

```sql
INSERT INTO omop.person (
  person_id, gender_concept_id, year_of_birth, month_of_birth, day_of_birth,
  birth_datetime, race_concept_id, ethnicity_concept_id,
  person_source_value, gender_source_value, race_source_value
) VALUES (
  1005788, 8507, 1942, 12, 1,
  '1942-12-01'::timestamp, 38003574, 38003564,
  'MBU-UDOSHI-499504', 'M', 'East Indian'
);
```

### 3.3 Observation Period

```sql
INSERT INTO omop.observation_period (
  observation_period_id, person_id,
  observation_period_start_date, observation_period_end_date,
  period_type_concept_id
) VALUES (
  nextval, 1005788,
  '2006-11-30', '2015-08-28',
  32817  -- EHR
);
```

### 3.4 Visit Occurrence Strategy

Each dated clinical encounter becomes a `visit_occurrence`:
- **Outpatient visits** (concept_id 9202): colonoscopies, CT scans, consultations, chemo sessions
- **Inpatient visits** (concept_id 9201): sigmoid colectomy (03/06/2012), thoracoscopy + biopsy (08/19/2013), hospitalization for pleurisy (06/22/2015)
- **Emergency room** (concept_id 9203): none documented

Care sites derived from reports:
- Commonwealth Health Diagnostic Imaging Center, Forty Fort PA
- Hospital of the University of Pennsylvania (HUP)
- Wilkes-Barre General Hospital
- Johns Hopkins (consultation)

### 3.5 Drug Exposure Strategy

FOLFOX and FOLFIRI are multi-drug regimens. OMOP CDM stores **individual drug ingredients**, not regimen names. Each regimen component gets its own `drug_exposure` row:

**FOLFOX** → 3 rows per cycle × 4 cycles:
- oxaliplatin (1318011)
- fluorouracil (955632)
- leucovorin (1388796)

**FOLFIRI** → 3 rows per cycle × 7 cycles:
- irinotecan (1367268)
- fluorouracil (955632)
- leucovorin (1388796)

**Avastin** → 7 rows:
- bevacizumab (1397141)

For cycle-level granularity, we create one `drug_exposure` per component spanning the full regimen duration (with `quantity` = number of cycles), since individual cycle dates are not documented.

### 3.6 Measurement Strategy — CEA Tumor Marker

The 16 serial CEA values are a powerful longitudinal biomarker showing:
- **Baseline normal** (5.0 in 2006)
- **Rising signal** (17 → 20 → 22 in 2011-2012) — led to CT discovery of retroperitoneal mass
- **Post-surgical drop** (22 → 3.7 in March 2012) — sigmoid colectomy effective
- **Stable plateau** (4.5-4.9 through 2013) — during FOLFIRI
- **Late rise** (5.7 in 2015) — correlates with metastatic progression

Each gets a `measurement` row with:
- `measurement_concept_id` = 4244721 (Carcinoembryonic antigen measurement)
- `value_as_number` = the CEA value
- `unit_concept_id` = 8842 (nanogram per milliliter)

### 3.7 DICOM Integration

The 5,013 DICOM files and 14 imaging studies can be:
1. Pushed to the existing Orthanc PACS server via its REST API
2. Linked to the OMOP patient via the `imaging_study` app table
3. Viewable in the OHIF viewer already integrated in Parthenon

This creates a **complete longitudinal imaging record** linked to the CDM patient — the exact use case the Imaging Outcomes Research module (Phase 16) was built for.

---

## Phase 4: Validation

After ETL execution:

1. **Row count verification** — confirm expected record counts per table
2. **Referential integrity** — all `person_id`, `visit_occurrence_id`, `concept_id` foreign keys valid
3. **Temporal consistency** — no events before observation_period_start or after end
4. **Concept validity** — all concept_ids exist in `omop.concept` with `standard_concept = 'S'`
5. **Clinical coherence** — CEA timeline, condition onset dates, procedure chronology make sense
6. **Achilles re-run** — regenerate Achilles statistics to include new patient in aggregate dashboard
7. **Parthenon UI** — verify patient appears in Data Explorer, timeline visualization works

---

## Phase 5: Significance for the Platform

This single patient import establishes a **reference implementation** for:

1. **Manual EHR-to-OMOP ETL** — demonstrates the full mapping workflow from unstructured clinical documents to standardized CDM
2. **Longitudinal oncology use case** — 9-year cancer journey with serial imaging, labs, multiple treatment lines, molecular testing
3. **DICOM-CDM linkage** — proves the imaging-to-outcomes research pipeline built in Phase 16
4. **RECIST-like response assessment** — the CT reports contain detailed tumor measurements at each timepoint, enabling the measurement tracking and response assessment features
5. **Drug exposure patterns** — FOLFOX → FOLFIRI → Avastin → Clinical Trial → RFA → Radiation therapy demonstrates realistic treatment sequencing
6. **Biomarker correlation** — CEA trend correlated with imaging findings and treatment response
7. **Multi-site care** — data from 4+ institutions (Commonwealth, HUP, Wilkes-Barre, Hopkins) demonstrates real-world fragmentation

This patient becomes the **flagship demonstration case** for Parthenon's capabilities in outcomes research.

---

## Execution Order

1. Create `installer/etl_mbu_patient.py` — Python script using psycopg2
2. Create `installer/data/mbu_clinical_events.json` — structured event data
3. Run concept resolution queries to fill all `*TBD*` concept IDs
4. Execute ETL in single transaction with rollback safety
5. Push DICOM files to Orthanc
6. Link imaging studies to OMOP patient in app DB
7. Run Achilles refresh
8. Verify in Parthenon UI
