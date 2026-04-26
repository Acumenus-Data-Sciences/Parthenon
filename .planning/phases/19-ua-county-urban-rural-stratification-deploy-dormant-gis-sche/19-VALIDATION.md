---
phase: 19
slug: ua-county-urban-rural-stratification
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-26
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled from 19-RESEARCH.md "Validation Architecture" section by gsd-planner during Wave 0.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (PHP)** | Pest (Laravel 11) |
| **Framework (Python)** | pytest 7.x |
| **Config file (PHP)** | backend/phpunit.xml (Pest auto-discovers) |
| **Config file (Python)** | scripts/gis/pyproject.toml or pytest.ini (Wave 0 installs if missing) |
| **Quick run command (PHP)** | `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --filter='Phase19|Gis|UaCounty'"` |
| **Quick run command (Python)** | `python -m pytest scripts/gis/tests/ -k 'phase19 or ua_county' -x` |
| **Full suite command** | `make test` (Pest + Vitest + pytest) |
| **Estimated runtime** | ~45–90 seconds (filtered) / ~6–10 minutes (full) |

---

## Sampling Rate

- **After every task commit:** Run filtered Pest/pytest (whichever stack the task touched)
- **After every plan wave:** Run full Pest + full pytest for `scripts/gis/tests/`
- **Before `/gsd-verify-work`:** Full `make test` must be green
- **Max feedback latency:** ~90 seconds for filtered, ~10 minutes for full suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-1 | 01   | 0    | GIS-01..04  | -          | Requirement IDs declared | grep | `grep -c '\\*\\*GIS-0' .planning/REQUIREMENTS.md` | yes (W0) | pending |
| 19-01-2 | 01   | 0    | GIS-01, GIS-03 | T-19-04 | RED Pest stubs       | unit  | `vendor/bin/pest --filter='phase19'` (must FAIL) | yes (W0) | pending |
| 19-01-3 | 01   | 0    | GIS-02, GIS-04 | T-19-01 | RED pytest + GREEN DSN guard + RED Vitest | unit  | `pytest scripts/gis/tests/ -k 'phase19 or ua_county'` | yes (W0) | pending |
| 19-02-1 | 02   | 1    | GIS-01      | T-19-02    | gis schema + 5 tables + matview | integration | `vendor/bin/pest tests/Feature/Gis/Phase19SchemaDeployTest.php` | no (W1) | pending |
| 19-02-2 | 02   | 1    | GIS-01      | T-19-03    | source_id FK + unique constraint (D-01) | integration | `vendor/bin/pest --filter='d-01'` | no (W1) | pending |
| 19-02-3 | 02   | 1    | GIS-01      | T-19-03    | parthenon_app GRANT posture | integration | `vendor/bin/pest --filter='highsec'` | no (W1) | pending |
| 19-03-1 | 03   | 2    | GIS-02      | T-19-01    | env-DSN loader_common module | unit  | `pytest scripts/gis/tests/test_dsn_no_legacy_credentials.py` | no (W2) | pending |
| 19-03-2 | 03   | 2    | GIS-02      | T-19-05    | crosswalk multi-source loop | integration | `pytest scripts/gis/tests/test_load_crosswalk_multi_source.py` | no (W2) | pending |
| 19-03-3 | 03   | 2    | GIS-02      | T-19-06    | UA loader UPSERT + CT_2022 skip | integration | `pytest scripts/gis/tests/test_load_ua_county.py` | no (W2) | pending |
| 19-04-1 | 04   | 3    | GIS-03      | T-19-04    | IncidenceRateService.location_urban_pct | unit  | `vendor/bin/pest tests/Feature/Studies/UrbanPctStratificationTest.php` | no (W3) | pending |
| 19-04-2 | 04   | 3    | GIS-03      | T-19-04    | FormRequest enum validation | feature | `vendor/bin/pest --filter='gis-03'` | no (W3) | pending |
| 19-04-3 | 04   | 3    | GIS-03      | T-19-07    | Frontend toggle render | unit  | `npx vitest run src/features/analyses/components/__tests__/UrbanPctStratificationToggle.test.tsx` | no (W3) | pending |
| 19-05-1 | 05   | 4    | GIS-04      | T-19-01    | Legacy loaders remediated | unit  | `pytest scripts/gis/tests/test_dsn_no_legacy_credentials.py` (full grandfather list) | no (W4) | pending |
| 19-05-2 | 05   | 4    | GIS-01..04  | T-19-08    | E2E smoke on Acumenus | smoke | manual checkpoint + DEPLOY-LOG | no (W4) | pending |

*Filled by gsd-planner during plan generation. The tasks below are seed expectations from RESEARCH.md "Validation Architecture" — final IDs assigned by planner.*

### Seed test expectations (from RESEARCH.md)

| # | Test | Type | Stack | Why |
|---|------|------|-------|-----|
| 1 | xlsx parser handles 3,234 county rows + skips CT_2022 sheet | unit | Python | GIS-02 — verify scope of v1 import |
| 2 | `STATE\|\|COUNTY` zero-fill produces 5-digit FIPS for all rows | unit | Python | GIS-02 — join key correctness |
| 3 | Deployed gis schema has all 6 tables with correct PostGIS geometry columns | integration | PHP/Pest | GIS-01 — schema deployed against parthenon, not ohdsi |
| 4 | gis schema GRANTs: parthenon_app SELECT only; parthenon_migrator DDL | integration | PHP/Pest | GIS-01 — least-privilege per HIGHSEC §1 |
| 5 | Crosswalk loaded → patient_geography matview populated → ≥1 person row joined to a county | integration | Python | GIS-02 — patient→county join works end-to-end |
| 6 | UA loader inserts ~3,234 county rows in gis.geographic_location, idempotent on re-run | integration | Python | GIS-02 — no duplicates after second run |
| 7 | Per-source loop: gis.external_exposure rows tagged with source_dataset='ua_county_2020:omop' for Acumenus | integration | Python | GIS-02 — multi-source isolation |
| 8 | Studies stratification by `urban_pct` returns differential population counts on Acumenus | end-to-end | PHP/Pest | GIS-03 — researcher-visible value test |
| 9 | Synthetic-zip sources (synpuf) produce ZERO person-level exposure rows | integration | Python | GIS-02 — out-of-scope exclusion is correct |
| 10 | IncidenceRateService accepts `stratifyBy=location_urban_pct` and returns groups | unit | PHP/Pest | GIS-03 — covariate plumbing wired |
| 11 | `frontend/src/features/analyses/components/__tests__/UrbanPctStratificationToggle.test.tsx` exports STRATIFY_BY_LOCATION_OPTIONS toggle (smoke render) — B-08: file lives under `analyses/`, NOT `studies/`; component is `IncidenceRateDesigner.tsx`, NOT `StudyDesigner.tsx` | unit | Vitest | GIS-03 — UI surface |
| 12 | DSN env-driven (no hardcoded `dbname=ohdsi user=smudoshi password=acumenus`) | unit | Python | GIS-04 — security regression guard |
| 13 | Smoke gate: full pipeline (migrate → load_geography → load_crosswalk → load_ua_county → studies query) on Acumenus | smoke | both | GATE-EVIDENCE — proves the value chain |

---

## Wave 0 Requirements

- [ ] `backend/tests/Feature/Gis/Phase19SchemaDeployTest.php` — Pest tests for gis schema existence, table list, GRANTs (REQ GIS-01)
- [ ] `backend/tests/Feature/Studies/UrbanPctStratificationTest.php` — Pest tests for IncidenceRateService.urban_pct (REQ GIS-03)
- [ ] `scripts/gis/tests/test_load_ua_county.py` — pytest stubs for xlsx parsing, FIPS construction, idempotency (REQ GIS-02)
- [ ] `scripts/gis/tests/test_load_crosswalk_multi_source.py` — pytest stubs for per-source crosswalk (REQ GIS-02)
- [ ] `scripts/gis/tests/conftest.py` — shared fixtures (DSN, parthenon_migrator role, sample xlsx)
- [ ] `scripts/gis/pyproject.toml` (or pytest.ini) — pytest config + dev deps if not present
- [ ] `frontend/src/features/analyses/components/__tests__/UrbanPctStratificationToggle.test.tsx` — Vitest for stratification UI (B-08: matches Plan 01/04 actual landing path)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Researcher creates a study, picks Acumenus, stratifies by urban_pct, sees population counts split into urban-leaning vs rural-leaning groups | GIS-03 | E2E flow includes UI rendering, async query orchestration, and visual interpretation that automated assertion can only partially cover | 1) Log into https://parthenon.acumenus.net  2) New Study → Source = Acumenus  3) Add covariate: urban_pct (continuous)  4) Run incidence rate analysis  5) Verify results show ≥2 strata with ≥10 persons each, urban_pct gradient is monotonic with cohort size |
| CT 2022 dual-FIPS handling: confirm v1 ignores CT_2022 sheet without warnings, no silently-double-counted CT counties | GIS-02 | Decision policy — automated test confirms count, but humans confirm the decision is documented in CHANGELOG/devlog | Inspect `scripts/gis/load_ua_county.py` — assert sheet `'CT_2022'` is filtered. Read devlog entry for CT decision. Verify SELECT count(*) FROM gis.geographic_location WHERE state_fips='09' returns 8 (old) not 17 (old+new) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s for filtered, < 600s for full suite
- [ ] `nyquist_compliant: true` set in frontmatter (after planner finalizes Per-Task Verification Map)

**Approval:** Wave 0 complete — RED tests authored 2026-04-26.
