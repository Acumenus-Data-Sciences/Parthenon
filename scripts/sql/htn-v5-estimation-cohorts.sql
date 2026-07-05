-- HTN v5 estimation cohorts for the real Analysis O (delay contrast) and
-- Analysis P (landmark target-trial). Additive: new cohort_definition_ids in the
-- existing results.cohort table; nothing existing is modified. Run once as an
-- owner/superuser (e.g. claude_dev) before `study:htn-v4 --action=run-o|run-p`.
--
--   psql -U claude_dev -h localhost -d parthenon -f scripts/sql/htn-v5-estimation-cohorts.sql
--
-- Cohorts:
--   5456 — delayed diagnosis (G2 ∪ G3 ∪ G4), the comparator for Analysis O.
--   5457 — Analysis P strategy A: treated with an antihypertensive within 90 d of
--          the index (t2), indexed at the t2 + 90 d landmark.
--   5458 — Analysis P strategy B: not treated within grace, same landmark.
-- P cohorts include only members alive & observed at the landmark (so no clone
-- contributes immortal person-time — the immortal-time check passes by design).

-- ── 5456: delayed (Analysis O comparator) ─────────────────────────────
insert into results.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
select 5456, subject_id, cohort_start_date, cohort_end_date
from results.cohort
where cohort_definition_id in (5451, 5452, 5453)
  and not exists (select 1 from results.cohort c where c.cohort_definition_id = 5456);

-- ── 5457 / 5458: Analysis P landmark strategy cohorts ─────────────────
insert into results.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
with t as (
    select subject_id, cohort_start_date as t2 from results.cohort where cohort_definition_id = 5441
),
tx as (
    select descendant_concept_id as cid from vocab.concept_ancestor
    where ancestor_concept_id in (
        select concept_id from app.concept_set_items
        where concept_set_id = 189 and coalesce(is_excluded, false) = false
    )
),
treated as (
    select distinct t.subject_id
    from t
    join omop.drug_exposure de on de.person_id = t.subject_id
    where de.drug_concept_id in (select cid from tx)
      and de.drug_exposure_start_date between t.t2 and t.t2 + 90
),
landmark as (
    select t.subject_id,
           (t.t2 + 90)::date as lm,
           op.observation_period_end_date as end_date
    from t
    join omop.observation_period op on op.person_id = t.subject_id
         and (t.t2 + 90) between op.observation_period_start_date and op.observation_period_end_date
    left join omop.death d on d.person_id = t.subject_id
    where coalesce(d.death_date, op.observation_period_end_date) > (t.t2 + 90)
)
select case when tr.subject_id is not null then 5457 else 5458 end,
       l.subject_id, l.lm, l.end_date
from landmark l
left join treated tr on tr.subject_id = l.subject_id
where not exists (select 1 from results.cohort c where c.cohort_definition_id in (5457, 5458));
