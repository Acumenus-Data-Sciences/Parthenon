# MIMIC Export Data Dictionary

Source database: `zephyrus`

Observed source schema: `stage`

Derived view schema: `mimic_stage`

Materialized export schema: `mimic_export`

## ID conventions

- `subject_id`: stable hashed surrogate over Epic `pat_id`
- `hadm_id`: stable hashed surrogate over Epic `hsp_account_id`
- `order_id`: stable hashed surrogate over `order_proc_id` or `cpoe_info.order_id`
- `transfer_id`: stable hashed surrogate over ADT `event_id`
- `problem_id`: stable hashed surrogate over `problem_list_id`

## mimic_patients

Purpose: patient-level demographics.

Key columns:
- `subject_id`
- `src_pat_id`
- `src_epic_pat_id`
- `mrn`

Clinical columns:
- `gender`
- `dob`
- `dod`
- `language`
- `marital_status`
- `race`

Administrative columns:
- `city`
- `state_c`
- `zip`
- `record_state_c`

Primary sources:
- `stage.patient`
- `stage.zc_sex`
- `stage.zc_language`
- `stage.zc_marital_status`
- `stage.zc_ethnic_group`

## mimic_admissions

Purpose: hospital encounter/admission layer.

Key columns:
- `subject_id`
- `hadm_id`
- `src_pat_id`
- `src_pat_enc_csn_id`
- `src_hsp_account_id`

Time columns:
- `admittime`
- `dischtime`
- `deathtime`
- `edregtime`
- `edouttime`

Clinical/admin columns:
- `admission_type`
- `admission_location`
- `discharge_location`
- `language`
- `marital_status`
- `race`
- `hospital_expire_flag`
- `admission_prov_id`
- `discharge_prov_id`

Important caveat:
- `hadm_id` is null when the source `hsp_account_id` is the sentinel string `\N`.

Primary sources:
- `stage.pat_enc_hsp_hx`
- `mimic_stage.mimic_patients`
- `stage.zc_adm_source`
- `stage.zc_pat_class`
- `stage.zc_disch_disp`
- `stage.zc_disch_dest`

## mimic_transfers

Purpose: ADT/transfer event stream.

Key columns:
- `subject_id`
- `hadm_id`
- `transfer_id`
- `src_event_id`
- `src_pat_id`
- `src_pat_enc_csn_id`
- `src_hsp_account_id`

Time columns:
- `eventtime`
- `intime`

Location/event columns:
- `event_type_c`
- `int_event_type_c`
- `department_id`
- `loc_id`
- `room_id`
- `bed_id`
- `serv_area_id`
- `patient_class`
- `pat_service_c`
- `pat_lvl_of_care_c`
- `accommodation_c`
- `comments`

Important caveat:
- not every transfer row resolves to `hadm_id`

Primary sources:
- `stage.adt_transfers`
- `stage.pat_enc_hsp_hx`
- `stage.zc_pat_class`

## mimic_orders

Purpose: order-level fact layer.

Key columns:
- `subject_id`
- `hadm_id`
- `order_id`
- `src_order_proc_id`
- `src_cpoe_order_id`
- `src_pat_id`
- `src_pat_enc_csn_id`
- `src_hsp_account_id`

Time columns:
- `ordertime`
- `resulttime`

Order content columns:
- `order_type_c`
- `cpoe_order_type_c`
- `proc_id`
- `order_name`
- `medication_id`
- `med_name`
- `dose`
- `order_status_c`
- `lab_status_c`
- `resulting_lab_id`
- `resulting_prov`
- `is_medication_order`
- `is_lab_order`
- `source_table`

Important caveats:
- this is not MIMIC `labevents`
- this is not MIMIC `emar`
- `is_lab_order` means lab-like order/result metadata exists, not component-level lab values

Primary sources:
- `stage.order_proc`
- `stage.cpoe_info`
- `stage.order_status`
- `stage.pat_enc_hsp_hx`

## mimic_problem_list

Purpose: patient-level diagnosis/problem layer.

Key columns:
- `subject_id`
- `hadm_id`
- `problem_id`
- `src_problem_list_id`
- `src_pat_id`
- `src_pat_enc_csn_id`
- `src_hsp_account_id`

Diagnosis columns:
- `dx_id`
- `icd9_code`
- `diagnosis_code`
- `current_icd10_list`
- `diagnosis_name`

Time/status columns:
- `starttime`
- `endtime`
- `status`
- `problem_status_c`
- `class_of_problem`
- `problem_type_c`
- `chronic_yn`
- `is_present_on_adm_c`
- `diagnosis_provenance`

Important caveats:
- in the current extract, `problem_ept_csn` is always null
- as a result, `hadm_id` is always null here
- this should not be treated as MIMIC `diagnoses_icd`

Primary sources:
- `stage.problem_list`
- `stage.clarity_edg`

## Provenance policy

- `mimic_export.*` contains observed data only
- any synthetic augmentation should live in separate tables
- synthetic tables should carry a required `data_origin = 'synthetic'` field
