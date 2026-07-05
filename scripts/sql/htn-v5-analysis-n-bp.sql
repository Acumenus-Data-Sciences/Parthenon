-- Analysis N — index (t2) blood-pressure distribution per group. Recomputes the
-- real SBP/DBP moments + percentiles from omop.measurement and rewrites
-- results.htn_v4_n_bp_summary. Run as a superuser/owner that can SELECT omop.*
-- (e.g. claude_dev). NOTE: this scans the 710M-row measurement table (bounded to
-- a ±400/30-day window around the index) and takes ~12 minutes — run off-peak.
--
--   psql -U claude_dev -h localhost -d parthenon -f scripts/sql/htn-v5-analysis-n-bp.sql
--
-- Per group × measure it takes the reading nearest the index (t2 = cohort_start),
-- one per member, then reports n / mean / sd / median / IQR / skewness / kurtosis.
-- SBP = concept 3004249, DBP = 3012888 (verified LOINC). Only the index timepoint
-- is materialised here; t1 and t_dx are refinements (each a further measurement
-- pass). `study:htn-v4 --action=run-n` reads this table.

DROP TABLE IF EXISTS results.htn_v4_n_bp_summary;
CREATE TABLE results.htn_v4_n_bp_summary AS
with idx as (
  select distinct on (ch.cohort_definition_id, ch.subject_id, m.measurement_concept_id)
    ch.cohort_definition_id cd, m.measurement_concept_id mc, m.value_as_number v
  from results.cohort ch
  join omop.measurement m
    on m.person_id = ch.subject_id
   and m.measurement_concept_id in (3004249, 3012888)
   and m.measurement_date between ch.cohort_start_date - 400 and ch.cohort_start_date + 30
  where ch.cohort_definition_id in (5450,5451,5452,5453,5454,5455)
    and m.value_as_number between 40 and 300
  order by ch.cohort_definition_id, ch.subject_id, m.measurement_concept_id,
           abs(m.measurement_date - ch.cohort_start_date)
),
stats as (select cd, mc, count(*) n, avg(v) mean, stddev(v) sd from idx group by cd, mc)
select
  (case s.cd when 5450 then 'G1 (timely ≤3mo)' when 5451 then 'G2 (3–6mo)'
             when 5452 then 'G3 (6–12mo)' when 5453 then 'G4 (delayed >12mo)'
             when 5454 then 'Never-diagnosed' else 'Comparator C' end) as grp,
  'index' as timepoint,
  (case s.mc when 3004249 then 'SBP' else 'DBP' end) as measure,
  s.n,
  round(s.mean::numeric,1) as mean, round(s.sd::numeric,1) as sd,
  round(percentile_cont(0.5)  within group (order by i.v)::numeric,1) as median,
  round(percentile_cont(0.25) within group (order by i.v)::numeric,1) as q1,
  round(percentile_cont(0.75) within group (order by i.v)::numeric,1) as q3,
  round(avg(power((i.v - s.mean)/nullif(s.sd,0), 3))::numeric,3) as skew,
  round(avg(power((i.v - s.mean)/nullif(s.sd,0), 4))::numeric,3) as kurt
from idx i join stats s on s.cd = i.cd and s.mc = i.mc
group by s.cd, s.mc, s.n, s.mean, s.sd;

GRANT SELECT ON results.htn_v4_n_bp_summary TO parthenon_app;
