-- HTN v5 demonstration-fixture long-form tables (Layer 2 table reader + CSV).
--
-- The Parthenon runtime role (parthenon_app) has USAGE but NO CREATE on the
-- `results` schema by design (owner/migrator/runtime split). These tables must
-- therefore be created by the owner. Run once as parthenon_owner (or a
-- superuser that SET ROLEs to it):
--
--   psql -U claude_dev -h localhost -d parthenon -f scripts/sql/htn-v5-fixture-tables.sql
--
-- After creation, `study:seed-htn-v5-fixture` (running as parthenon_app) can
-- TRUNCATE + INSERT the fixture rows via the granted privileges below.
-- Additive only; touches nothing in omop / vocab.

SET ROLE parthenon_owner;

CREATE TABLE IF NOT EXISTS results.htn_v4_m_comorbidity_matrix (
    morbidity   text,
    population  text,
    prevalence  numeric,
    wilson_lo   numeric,
    wilson_hi   numeric,
    n_present   integer,
    n_total     integer,
    adjusted_or numeric,
    or_ci_lo    numeric,
    or_ci_hi    numeric
);

CREATE TABLE IF NOT EXISTS results.htn_v4_n_bp_distribution (
    grp       text,
    timepoint text,
    measure   text,
    n         integer,
    mean      numeric,
    sd        numeric,
    median    numeric,
    q1        numeric,
    q3        numeric,
    skew      numeric,
    kurt      numeric
);

CREATE TABLE IF NOT EXISTS results.htn_v4_q_phenotype_grid (
    index_rule        text,
    threshold         integer,
    max_gap           integer,
    never_dx_fraction numeric,
    n                 integer,
    median_latency    integer,
    visit_linked      boolean
);

CREATE TABLE IF NOT EXISTS results.htn_v4_r_instrument (
    tertile    integer,
    covariate  text,
    mean_value numeric,
    balanced   boolean
);

CREATE TABLE IF NOT EXISTS results.htn_v4_triangulation (
    design      text,
    outcome     text,
    estimate    numeric,
    ci_lo       numeric,
    ci_hi       numeric,
    estimable   boolean,
    gate_status text
);

GRANT SELECT, INSERT, TRUNCATE, DELETE ON
    results.htn_v4_m_comorbidity_matrix,
    results.htn_v4_n_bp_distribution,
    results.htn_v4_q_phenotype_grid,
    results.htn_v4_r_instrument,
    results.htn_v4_triangulation
TO parthenon_app;

RESET ROLE;
