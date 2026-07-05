-- Analysis R instrument (member grain): site leave-one-out diagnostic-propensity
-- Z on the visit-linked T subset. Run as a superuser/owner that can SELECT omop.*
-- (e.g. claude_dev) — parthenon_owner cannot read the CDM schema:
--
--   psql -U claude_dev -h localhost -d parthenon -f scripts/sql/htn-v5-analysis-r-instrument.sql
--
-- Replaces any prior htn_v4_r_instrument. Additive to the CDM (read-only there).
-- Each visit-linked T member is assigned their most-recent-visit care_site; sites
-- with ≥ 25 T patients get a leave-one-out timely-diagnosis propensity (z_loo).
-- `study:htn-v4 --action=run-r` then computes the first-stage F from this table.

DROP TABLE IF EXISTS results.htn_v4_r_instrument;
CREATE TABLE results.htn_v4_r_instrument AS
with t as (select subject_id from results.cohort where cohort_definition_id = 5441),
site as (
    select distinct on (vo.person_id) vo.person_id, vo.care_site_id
    from omop.visit_occurrence vo join t on t.subject_id = vo.person_id
    where vo.care_site_id is not null
    order by vo.person_id, vo.visit_start_date desc
),
timely as (select subject_id from results.cohort where cohort_definition_id = 5450),
diagnosed as (select subject_id from results.cohort where cohort_definition_id in (5450, 5451, 5452, 5453)),
member as (
    select s.person_id, s.care_site_id,
        (case when tm.subject_id is not null then 1 else 0 end) as timely,
        (case when dx.subject_id is not null then 1 else 0 end) as diagnosed
    from site s
    left join timely tm on tm.subject_id = s.person_id
    left join diagnosed dx on dx.subject_id = s.person_id
),
site_stats as (
    select care_site_id, count(*) n, sum(timely) n_timely
    from member group by care_site_id having count(*) >= 25
)
select m.person_id as subject_id, m.care_site_id, ss.n as site_size,
    m.timely as individual_timely, m.diagnosed as individual_diagnosed,
    round((ss.n_timely - m.timely)::numeric / (ss.n - 1), 4) as z_loo
from member m join site_stats ss on ss.care_site_id = m.care_site_id;

GRANT SELECT ON results.htn_v4_r_instrument TO parthenon_app;
