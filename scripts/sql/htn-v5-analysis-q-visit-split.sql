-- Analysis Q — visit-linked vs measurement-only strata (NEW-17). Recomputes the
-- never-diagnosed / MACE / CKD rates by encounter linkage and rewrites
-- results.htn_v4_q_visit_split. Run as a superuser/owner that can SELECT omop.*
-- (e.g. claude_dev). Scans visit_occurrence for the T cohort (~3 minutes).
--
--   psql -U claude_dev -h localhost -d parthenon -f scripts/sql/htn-v5-analysis-q-visit-split.sql
--
-- `study:htn-v4 --action=run-q` reads this table + the primary never-dx fraction.

DROP TABLE IF EXISTS results.htn_v4_q_visit_split;
CREATE TABLE results.htn_v4_q_visit_split AS
with t as (select subject_id from results.cohort where cohort_definition_id = 5441),
vl as (select distinct vo.person_id from omop.visit_occurrence vo join t on t.subject_id = vo.person_id where vo.care_site_id is not null),
dx as (select subject_id from results.cohort where cohort_definition_id in (5450,5451,5452,5453)),
mace as (select distinct subject_id from results.cohort where cohort_definition_id = 5426),
ckd as (select distinct subject_id from results.cohort where cohort_definition_id = 5427)
select
  (case when vl.person_id is not null then 'visit_linked' else 'measurement_only' end) as strat,
  count(*)::int as n,
  round(avg(case when dx.subject_id is null then 1 else 0 end)::numeric, 4) as never_dx_rate,
  round(avg(case when mace.subject_id is not null then 1 else 0 end)::numeric, 4) as mace_rate,
  round(avg(case when ckd.subject_id is not null then 1 else 0 end)::numeric, 4) as ckd_rate
from t
left join vl on vl.person_id = t.subject_id
left join dx on dx.subject_id = t.subject_id
left join mace on mace.subject_id = t.subject_id
left join ckd on ckd.subject_id = t.subject_id
group by 1;

GRANT SELECT ON results.htn_v4_q_visit_split TO parthenon_app;
