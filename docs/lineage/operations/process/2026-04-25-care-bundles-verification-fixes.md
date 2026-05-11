# CareBundles Workbench — Verification fixes

**Date:** 2026-04-25

End-to-end verification of all four phases (1, 2, Tier A, Tier B, Tier C)
surfaced two real bugs:

## Bug 1 — roster→cohort export crashed (HTTP 500)

**Symptom:** `POST /care-bundles/{bundle}/measures/{measure}/roster/to-cohort`
returned `Server Error`. Laravel log showed
`SQLSTATE[42501]: Insufficient privilege: 7 ERROR: permission denied for
sequence cohort_definitions_id_seq`.

**Root cause:** `app.cohort_definitions` was created by `parthenon_migrator`
in a migration that pre-dated the 2026-04-12 role-split. Its linked sequence
was therefore owned by `parthenon_migrator` instead of `parthenon_owner`, so
the default-privileges chain never granted USAGE/UPDATE on the sequence to
the runtime user `parthenon_app`. Inserts via Eloquent (which need
`nextval()`) failed.

**Fix:** New migration `2026_04_25_010000_grant_cohort_definitions_seq_to_app.php`:

```sql
ALTER TABLE app.cohort_definitions OWNER TO parthenon_owner;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE app.cohort_definitions_id_seq TO parthenon_app;
```

**Verified:** A test cohort created from the HTN-01 non-compliant roster
returned cohort #5411 with **98,104 members** in `results.cohort` exactly
matching the roster total.

## Bug 2 — methodology endpoint took 10 seconds

**Symptom:** Clicking the ⓘ on a measure to open the methodology card took
~10s on Acumenus.

**Root causes:**

1. `MeasureDataQualityChecker::checkDomainCoverage` ran
   `SELECT COUNT(*) FROM cdm.measurement` — a 17M-row sequential scan on
   Acumenus.
2. The same checker did `SELECT COUNT(*) ... LIMIT 1` for hit detection;
   `LIMIT 1` doesn't short-circuit a `COUNT(*)` aggregate.
3. `MeasureMethodologyService::describeSource` ran uncached
   `MAX(measurement_date)` queries (3.7s on Acumenus measurement).
4. ~15 `vocab.concept_ancestor` queries per request for descendant counts.

**Fixes:**

- DQ checker uses `pg_class.reltuples` (instant catalog lookup) for the
  empty-table check and `EXISTS (...)` for the hit check (short-circuits
  on first match).
- Methodology service caches the entire assembled response per
  `(bundle_id, measure_id, source_id, run_id, definition_timestamps)`
  with a 24h TTL. The cache key includes the run_id so a fresh
  materialization invalidates it automatically; the timestamp tail
  invalidates on bundle/measure edits.

**Verified timings:**

| Path | Before | After |
|---|---:|---:|
| methodology cold (per run, one-time) | 10,167 ms | 6,853 ms |
| methodology warm (every click thereafter) | n/a | 70–112 ms |

Other read endpoints (sources, coverage, qualifications, comparison,
strata, trend, roster, all VSAC reads) verified at 50–135 ms warm.
