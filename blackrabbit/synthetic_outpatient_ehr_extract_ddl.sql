-- Synthetic outpatient EHR extract schema
-- Purpose: support generation of a 1,000-patient source extract with enough
-- source detail to populate core OHDSI / OMOP CDM tables.
-- Dialect: PostgreSQL
--
-- Design notes
-- - This is a source extract schema, not the OMOP CDM itself.
-- - Outpatient only: ambulatory, office, urgent care, telehealth, lab-only.
-- - Every clinical event keeps source codes and source vocab metadata so an
--   ETL can map to standard OMOP concepts.
-- - Synthetic cohort size target is tracked in extract_batch.target_patient_count.

create schema if not exists synthetic_ehr;

set search_path to synthetic_ehr;

create table if not exists extract_batch (
    batch_id                  bigint generated always as identity primary key,
    batch_name                varchar(100) not null unique,
    target_patient_count      integer not null default 1000,
    outpatient_only_flag      boolean not null default true,
    extract_start_date        date not null,
    extract_end_date          date not null,
    source_ehr_name           varchar(200) not null,
    source_ehr_version        varchar(100),
    created_at                timestamp not null default current_timestamp,
    check (target_patient_count > 0),
    check (extract_end_date >= extract_start_date)
);

create table if not exists location (
    location_id               bigint generated always as identity primary key,
    source_location_id        varchar(50) not null unique,
    address_1                 varchar(255),
    address_2                 varchar(255),
    city                      varchar(100),
    state                     varchar(50),
    zip                       varchar(20),
    county                    varchar(100),
    country                   varchar(100),
    latitude                  numeric(9,6),
    longitude                 numeric(9,6)
);

create table if not exists care_site (
    care_site_id              bigint generated always as identity primary key,
    source_care_site_id       varchar(50) not null unique,
    care_site_name            varchar(255) not null,
    care_site_type            varchar(50) not null,
    location_id               bigint references location(location_id),
    place_of_service_code     varchar(10),
    npi_organization          varchar(20),
    active_flag               boolean not null default true
);

create table if not exists provider (
    provider_id               bigint generated always as identity primary key,
    source_provider_id        varchar(50) not null unique,
    npi                       varchar(20),
    provider_name             varchar(255) not null,
    specialty_source_code     varchar(50),
    specialty_source_value    varchar(255),
    gender_source_value       varchar(50),
    care_site_id              bigint references care_site(care_site_id),
    active_flag               boolean not null default true
);

create table if not exists patient (
    patient_id                bigint generated always as identity primary key,
    batch_id                  bigint not null references extract_batch(batch_id),
    source_patient_id         varchar(50) not null unique,
    enterprise_mrn            varchar(50),
    birth_date                date not null,
    sex_source_value          varchar(50) not null,
    gender_identity_value     varchar(100),
    sexual_orientation_value  varchar(100),
    race_source_value         varchar(100),
    ethnicity_source_value    varchar(100),
    language_source_value     varchar(100),
    marital_status_value      varchar(100),
    religion_value            varchar(100),
    location_id               bigint references location(location_id),
    primary_care_provider_id  bigint references provider(provider_id),
    deceased_flag             boolean not null default false,
    death_datetime            timestamp,
    active_flag               boolean not null default true,
    create_datetime           timestamp not null default current_timestamp,
    update_datetime           timestamp,
    check ((deceased_flag = false and death_datetime is null) or deceased_flag = true)
);

create table if not exists patient_identifier (
    patient_identifier_id     bigint generated always as identity primary key,
    patient_id                bigint not null references patient(patient_id),
    identifier_type           varchar(50) not null,
    identifier_value          varchar(100) not null,
    assigning_authority       varchar(100),
    start_date                date,
    end_date                  date
);

create unique index if not exists ux_patient_identifier
    on patient_identifier (identifier_type, identifier_value);

create table if not exists payer (
    payer_id                  bigint generated always as identity primary key,
    source_payer_id           varchar(50) not null unique,
    payer_name                varchar(255) not null,
    payer_type                varchar(50),
    plan_name                 varchar(255),
    plan_type                 varchar(100),
    metal_level               varchar(50)
);

create table if not exists patient_coverage (
    patient_coverage_id       bigint generated always as identity primary key,
    patient_id                bigint not null references patient(patient_id),
    payer_id                  bigint not null references payer(payer_id),
    member_id                 varchar(100),
    subscriber_id             varchar(100),
    relationship_to_subscriber varchar(50),
    coverage_start_date       date not null,
    coverage_end_date         date,
    product_line              varchar(100),
    pharmacy_benefit_flag     boolean not null default true,
    medical_benefit_flag      boolean not null default true,
    check (coverage_end_date is null or coverage_end_date >= coverage_start_date)
);

create table if not exists visit (
    visit_id                  bigint generated always as identity primary key,
    patient_id                bigint not null references patient(patient_id),
    source_visit_id           varchar(50) not null unique,
    source_encounter_number   varchar(50),
    visit_start_datetime      timestamp not null,
    visit_end_datetime        timestamp not null,
    visit_type                varchar(50) not null,
    visit_class               varchar(50),
    place_of_service_code     varchar(10),
    telehealth_flag           boolean not null default false,
    care_site_id              bigint references care_site(care_site_id),
    attending_provider_id     bigint references provider(provider_id),
    referring_provider_id     bigint references provider(provider_id),
    rendering_provider_id     bigint references provider(provider_id),
    patient_coverage_id       bigint references patient_coverage(patient_coverage_id),
    discharge_disposition     varchar(100),
    chief_complaint           varchar(500),
    reason_for_visit          varchar(500),
    appointment_type          varchar(100),
    appointment_status        varchar(50),
    source_system             varchar(100),
    check (visit_end_datetime >= visit_start_datetime)
);

create index if not exists ix_visit_patient_datetime
    on visit (patient_id, visit_start_datetime);

create table if not exists encounter_diagnosis (
    encounter_diagnosis_id    bigint generated always as identity primary key,
    visit_id                  bigint not null references visit(visit_id),
    patient_id                bigint not null references patient(patient_id),
    diagnosis_datetime        timestamp not null,
    diagnosis_rank            integer,
    diagnosis_type            varchar(50),
    present_on_arrival_flag   boolean,
    source_code               varchar(50) not null,
    source_code_system        varchar(50) not null,
    source_description        varchar(255),
    source_value              varchar(255),
    clinical_status           varchar(50),
    verification_status       varchar(50),
    onset_date                date,
    abatement_date            date,
    recorded_by_provider_id   bigint references provider(provider_id)
);

create index if not exists ix_dx_patient_datetime
    on encounter_diagnosis (patient_id, diagnosis_datetime);

create table if not exists problem_list (
    problem_list_id           bigint generated always as identity primary key,
    patient_id                bigint not null references patient(patient_id),
    source_problem_id         varchar(50),
    problem_name              varchar(255),
    source_code               varchar(50) not null,
    source_code_system        varchar(50) not null,
    source_description        varchar(255),
    status                    varchar(50),
    recorded_date             date not null,
    onset_date                date,
    resolved_date             date,
    last_reviewed_date        date,
    ranking                   integer,
    provider_id               bigint references provider(provider_id)
);

create table if not exists procedure_order (
    procedure_order_id        bigint generated always as identity primary key,
    visit_id                  bigint references visit(visit_id),
    patient_id                bigint not null references patient(patient_id),
    source_order_id           varchar(50) unique,
    order_datetime            timestamp not null,
    ordering_provider_id      bigint references provider(provider_id),
    source_code               varchar(50) not null,
    source_code_system        varchar(50) not null,
    source_description        varchar(255),
    priority                  varchar(50),
    status                    varchar(50),
    reason_text               varchar(500),
    scheduled_datetime        timestamp
);

create table if not exists procedure_result (
    procedure_result_id       bigint generated always as identity primary key,
    procedure_order_id        bigint references procedure_order(procedure_order_id),
    visit_id                  bigint references visit(visit_id),
    patient_id                bigint not null references patient(patient_id),
    procedure_datetime        timestamp not null,
    performer_provider_id     bigint references provider(provider_id),
    source_code               varchar(50) not null,
    source_code_system        varchar(50) not null,
    source_description        varchar(255),
    modifier_code             varchar(20),
    modifier_description      varchar(255),
    result_status             varchar(50),
    body_site                 varchar(100),
    laterality                varchar(50)
);

create table if not exists device_use (
    device_use_id             bigint generated always as identity primary key,
    visit_id                  bigint references visit(visit_id),
    patient_id                bigint not null references patient(patient_id),
    device_datetime           timestamp not null,
    provider_id               bigint references provider(provider_id),
    source_device_id          varchar(50),
    source_code               varchar(50),
    source_code_system        varchar(50),
    source_description        varchar(255),
    device_name               varchar(255) not null,
    unique_device_identifier  varchar(100),
    quantity                  numeric(18,4),
    quantity_unit             varchar(50),
    body_site                 varchar(100),
    laterality                varchar(50),
    status                    varchar(50)
);

create table if not exists medication_order (
    medication_order_id       bigint generated always as identity primary key,
    visit_id                  bigint references visit(visit_id),
    patient_id                bigint not null references patient(patient_id),
    source_medication_order_id varchar(50) not null unique,
    order_datetime            timestamp not null,
    ordering_provider_id      bigint references provider(provider_id),
    source_drug_code          varchar(50) not null,
    source_drug_code_system   varchar(50) not null,
    source_drug_name          varchar(255) not null,
    rxnorm_text               varchar(255),
    dose_quantity             numeric(18,4),
    dose_unit                 varchar(50),
    route_source_value        varchar(100),
    frequency_source_value    varchar(100),
    sig_text                  varchar(1000),
    quantity                  numeric(18,4),
    quantity_unit             varchar(50),
    refills                   integer,
    days_supply               integer,
    intended_start_datetime   timestamp,
    intended_end_datetime     timestamp,
    status                    varchar(50),
    order_class               varchar(50),
    prn_flag                  boolean,
    indication_text           varchar(500)
);

create index if not exists ix_med_order_patient_datetime
    on medication_order (patient_id, order_datetime);

create table if not exists medication_dispense (
    medication_dispense_id    bigint generated always as identity primary key,
    medication_order_id       bigint references medication_order(medication_order_id),
    patient_id                bigint not null references patient(patient_id),
    dispense_datetime         timestamp not null,
    dispensing_provider_id    bigint references provider(provider_id),
    pharmacy_name             varchar(255),
    ndc_code                  varchar(20),
    source_drug_name          varchar(255) not null,
    quantity_dispensed        numeric(18,4),
    quantity_unit             varchar(50),
    days_supply               integer,
    refill_number             integer,
    dispense_status           varchar(50)
);

create table if not exists medication_administration (
    medication_administration_id bigint generated always as identity primary key,
    visit_id                  bigint references visit(visit_id),
    medication_order_id       bigint references medication_order(medication_order_id),
    patient_id                bigint not null references patient(patient_id),
    administration_datetime   timestamp not null,
    administering_provider_id bigint references provider(provider_id),
    source_drug_code          varchar(50) not null,
    source_drug_code_system   varchar(50) not null,
    source_drug_name          varchar(255) not null,
    dose_quantity             numeric(18,4),
    dose_unit                 varchar(50),
    route_source_value        varchar(100),
    administration_site       varchar(100),
    status                    varchar(50)
);

create table if not exists immunization (
    immunization_id           bigint generated always as identity primary key,
    visit_id                  bigint references visit(visit_id),
    patient_id                bigint not null references patient(patient_id),
    immunization_datetime     timestamp not null,
    provider_id               bigint references provider(provider_id),
    cvx_code                  varchar(20),
    source_code               varchar(50),
    source_code_system        varchar(50),
    vaccine_name              varchar(255) not null,
    lot_number                varchar(100),
    manufacturer              varchar(255),
    dose_quantity             numeric(18,4),
    dose_unit                 varchar(50),
    route_source_value        varchar(100),
    body_site                 varchar(100),
    status                    varchar(50)
);

create table if not exists lab_order (
    lab_order_id              bigint generated always as identity primary key,
    visit_id                  bigint references visit(visit_id),
    patient_id                bigint not null references patient(patient_id),
    source_lab_order_id       varchar(50) unique,
    order_datetime            timestamp not null,
    ordering_provider_id      bigint references provider(provider_id),
    source_code               varchar(50) not null,
    source_code_system        varchar(50) not null,
    source_description        varchar(255),
    priority                  varchar(50),
    status                    varchar(50),
    specimen_type             varchar(100)
);

create table if not exists specimen (
    specimen_id               bigint generated always as identity primary key,
    patient_id                bigint not null references patient(patient_id),
    visit_id                  bigint references visit(visit_id),
    lab_order_id              bigint references lab_order(lab_order_id),
    source_specimen_id        varchar(50) unique,
    specimen_datetime         timestamp not null,
    specimen_type             varchar(100),
    source_code               varchar(50),
    source_code_system        varchar(50),
    source_description        varchar(255),
    body_site                 varchar(100),
    laterality                varchar(50),
    collection_method         varchar(100)
);

create table if not exists lab_result (
    lab_result_id             bigint generated always as identity primary key,
    lab_order_id              bigint references lab_order(lab_order_id),
    specimen_id               bigint references specimen(specimen_id),
    visit_id                  bigint references visit(visit_id),
    patient_id                bigint not null references patient(patient_id),
    result_datetime           timestamp not null,
    performing_provider_id    bigint references provider(provider_id),
    source_code               varchar(50) not null,
    source_code_system        varchar(50) not null,
    source_description        varchar(255),
    result_value_text         varchar(255),
    result_value_numeric      numeric(18,4),
    result_unit               varchar(50),
    reference_range_low       numeric(18,4),
    reference_range_high      numeric(18,4),
    abnormal_flag             varchar(20),
    result_status             varchar(50),
    specimen_source_value     varchar(100)
);

create index if not exists ix_lab_result_patient_datetime
    on lab_result (patient_id, result_datetime);

create table if not exists vital_sign (
    vital_sign_id             bigint generated always as identity primary key,
    visit_id                  bigint references visit(visit_id),
    patient_id                bigint not null references patient(patient_id),
    measured_datetime         timestamp not null,
    taken_by_provider_id      bigint references provider(provider_id),
    vital_type                varchar(50) not null,
    source_code               varchar(50),
    source_code_system        varchar(50),
    source_description        varchar(255),
    value_numeric             numeric(18,4),
    value_text                varchar(255),
    unit                      varchar(50),
    position_source_value     varchar(50),
    body_site                 varchar(100)
);

create table if not exists clinical_observation (
    clinical_observation_id   bigint generated always as identity primary key,
    visit_id                  bigint references visit(visit_id),
    patient_id                bigint not null references patient(patient_id),
    observation_datetime      timestamp not null,
    observer_provider_id      bigint references provider(provider_id),
    observation_type          varchar(50) not null,
    source_code               varchar(50),
    source_code_system        varchar(50),
    source_description        varchar(255),
    value_text                varchar(1000),
    value_numeric             numeric(18,4),
    value_unit                varchar(50),
    value_date                date,
    status                    varchar(50)
);

create table if not exists allergy (
    allergy_id                bigint generated always as identity primary key,
    patient_id                bigint not null references patient(patient_id),
    visit_id                  bigint references visit(visit_id),
    source_allergy_id         varchar(50) unique,
    recorded_datetime         timestamp not null,
    recorder_provider_id      bigint references provider(provider_id),
    allergen_type             varchar(50),
    source_code               varchar(50),
    source_code_system        varchar(50),
    allergen_name             varchar(255) not null,
    reaction_text             varchar(255),
    severity                  varchar(50),
    status                    varchar(50),
    onset_date                date
);

create table if not exists smoking_and_social_history (
    social_history_id         bigint generated always as identity primary key,
    patient_id                bigint not null references patient(patient_id),
    visit_id                  bigint references visit(visit_id),
    recorded_datetime         timestamp not null,
    provider_id               bigint references provider(provider_id),
    history_type              varchar(50) not null,
    source_code               varchar(50),
    source_code_system        varchar(50),
    source_description        varchar(255),
    value_text                varchar(255),
    value_numeric             numeric(18,4),
    value_unit                varchar(50),
    status                    varchar(50)
);

create table if not exists family_history (
    family_history_id         bigint generated always as identity primary key,
    patient_id                bigint not null references patient(patient_id),
    visit_id                  bigint references visit(visit_id),
    recorded_datetime         timestamp not null,
    provider_id               bigint references provider(provider_id),
    relationship_source_value varchar(100),
    source_code               varchar(50),
    source_code_system        varchar(50),
    source_description        varchar(255),
    note_text                 varchar(1000),
    status                    varchar(50)
);

create table if not exists referral (
    referral_id               bigint generated always as identity primary key,
    visit_id                  bigint references visit(visit_id),
    patient_id                bigint not null references patient(patient_id),
    referral_datetime         timestamp not null,
    referring_provider_id     bigint references provider(provider_id),
    referred_to_provider_id   bigint references provider(provider_id),
    referred_to_care_site_id  bigint references care_site(care_site_id),
    referral_reason           varchar(500),
    referral_priority         varchar(50),
    referral_status           varchar(50)
);

create table if not exists encounter_charge (
    encounter_charge_id       bigint generated always as identity primary key,
    visit_id                  bigint not null references visit(visit_id),
    patient_id                bigint not null references patient(patient_id),
    charge_datetime           timestamp not null,
    source_charge_id          varchar(50) unique,
    source_code               varchar(50),
    source_code_system        varchar(50),
    source_description        varchar(255),
    revenue_code              varchar(20),
    cpt_hcpcs_code            varchar(20),
    diagnosis_pointer         varchar(50),
    units                     numeric(18,4),
    charge_amount             numeric(18,2),
    allowed_amount            numeric(18,2),
    paid_amount               numeric(18,2),
    patient_responsibility_amount numeric(18,2),
    billing_provider_id       bigint references provider(provider_id),
    status                    varchar(50)
);

create table if not exists encounter_note (
    encounter_note_id         bigint generated always as identity primary key,
    visit_id                  bigint not null references visit(visit_id),
    patient_id                bigint not null references patient(patient_id),
    note_datetime             timestamp not null,
    author_provider_id        bigint references provider(provider_id),
    note_type                 varchar(50) not null,
    note_title                varchar(255),
    note_text                 text not null,
    signed_datetime           timestamp,
    cosigned_datetime         timestamp,
    status                    varchar(50)
);

create table if not exists source_to_omop_map_hint (
    source_to_omop_map_hint_id bigint generated always as identity primary key,
    domain_name               varchar(50) not null,
    source_code_system        varchar(50) not null,
    source_code               varchar(50) not null,
    source_description        varchar(255),
    target_omop_domain        varchar(50),
    target_standard_concept_id integer,
    target_standard_concept_name varchar(255),
    target_vocabulary_id      varchar(50),
    mapping_status            varchar(50) not null default 'UNREVIEWED'
);

create unique index if not exists ux_map_hint_source
    on source_to_omop_map_hint (domain_name, source_code_system, source_code);

comment on schema synthetic_ehr is
'Synthetic outpatient source extract schema intended to drive ETL into the OHDSI OMOP CDM.';

comment on table extract_batch is
'Defines the synthetic extract window and target size; default target is 1,000 patients.';

comment on table patient is
'Demographics for PERSON plus supporting source values for race, ethnicity, sex, language, and death.';

comment on table visit is
'Outpatient encounter header used to populate VISIT_OCCURRENCE and anchor most clinical facts.';

comment on table encounter_diagnosis is
'Visit diagnoses and coded assessment data for CONDITION_OCCURRENCE.';

comment on table problem_list is
'Longitudinal ambulatory problem list for CONDITION_OCCURRENCE or OBSERVATION, depending on ETL rules.';

comment on table procedure_result is
'Completed outpatient procedures for PROCEDURE_OCCURRENCE.';

comment on table device_use is
'Structured outpatient device activity for DEVICE_EXPOSURE when the source EHR captures it.';

comment on table medication_order is
'Prescribed outpatient medications for DRUG_EXPOSURE.';

comment on table medication_dispense is
'Dispense activity supporting DRUG_EXPOSURE dates and pharmacy detail.';

comment on table medication_administration is
'Clinic-administered outpatient medications, including injections and infusions.';

comment on table immunization is
'Vaccinations; can populate DRUG_EXPOSURE or PROCEDURE_OCCURRENCE depending on ETL design.';

comment on table lab_result is
'Laboratory results for MEASUREMENT with source provenance intact.';

comment on table vital_sign is
'Structured vitals for MEASUREMENT.';

comment on table clinical_observation is
'Non-lab, non-vital structured findings for OBSERVATION.';

comment on table encounter_charge is
'Optional financial detail from the outpatient EHR or practice-management side for cost enrichment.';

comment on table encounter_note is
'Source notes for NOTE and NOTE_NLP if downstream NLP is used.';
