---
phase: 17
slug: pgs-prs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 17 — Validation Strategy

Derived from `17-RESEARCH.md` §Validation Architecture.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Pest 3.x (PHP) + Vitest (TS) + R testthat (optional) |
| **Config file** | `backend/phpunit.xml`, `frontend/vitest.config.ts` |
| **Quick run** | `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen/{file}.php --no-coverage` |
| **Full suite** | `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen tests/Unit/FinnGen --no-coverage` + `docker compose exec -T node sh -c "cd /app && npx vitest run"` |
| **Estimated runtime** | ~10s quick / ~3min full / ~5min E2E checkpoint |

## Sampling Rate

- **Per task commit:** quick Pest on the file touched
- **Per wave merge:** full Pest + Vitest
- **Phase gate:** full suite green + checkpoint smoke-gen (curl PGS000001 × PANCREAS) with DEPLOY-LOG

## Per-Requirement Verification Map

| SC / Req | Behavior | Test Type | Automated Command | File | Status |
|----------|----------|-----------|-------------------|------|--------|
| SC-1 / GENOMICS-06 | Ingestion idempotent (2 runs → 1 row in pgs_scores) | Pest feature | `pest tests/Feature/FinnGen/LoadPgsCatalogCommandTest.php -x` | ❌ W0 | ⬜ |
| SC-1 / GENOMICS-06 | HIGHSEC grants block present + effective | Pest feature | `pest ... --filter=grants` | ❌ W0 | ⬜ |
| SC-2 / GENOMICS-07 | Dispatch 202 + run envelope | Pest feature | `pest tests/Feature/FinnGen/PrsDispatchTest.php -x` | ❌ W0 | ⬜ |
| SC-2 / GENOMICS-07 | R worker param passthrough | manual smoke | `curl POST /api/v1/finngen/endpoints/E4_DM2/prs` → poll → psql | — CHECKPOINT Wave 5 | ⬜ |
| SC-2 / GENOMICS-07 | Write-back to prs_subject_scores | manual psql | `SELECT COUNT(*), AVG(raw_score) FROM pancreas_gwas_results.prs_subject_scores WHERE score_id='PGS000001'` | — CHECKPOINT Wave 5 | ⬜ |
| SC-3 / GENOMICS-08 | Histogram endpoint aggregated + quintiles | Pest feature | `pest tests/Feature/FinnGen/CohortPrsEndpointsTest.php --filter=histogram` | ❌ W0 | ⬜ |
| SC-3 / GENOMICS-08 | CSV download streams | Pest feature | `pest ... --filter=download` | ❌ W0 | ⬜ |
| SC-3 / GENOMICS-08 | PrsDistributionPanel renders + 5 ReferenceArea | Vitest unit | `npx vitest run src/features/cohort-definitions/components/__tests__/PrsDistributionPanel.test.tsx` | ❌ W0 | ⬜ |
| SC-4 / GENOMICS-08 | Empty-state CTA + picker | Vitest unit | `npx vitest run src/features/cohort-definitions/components/__tests__/ComputePrsModal.test.tsx` | ❌ W0 | ⬜ |
| invariant (HIGHSEC §4.1) | parthenon_app USAGE+SELECT on vocab.pgs_scores | Pest | `pest ... --filter=grants` | ❌ W0 | ⬜ |
| invariant (13.2 T-13.2-S3) | `app.cohort_definitions.id > 100B` count = 0 | psql | `SELECT COUNT(*) FROM app.cohort_definitions WHERE id > 100000000000` → 0 | — automated in Plan 5 | ⬜ |
| invariant (cross-schema FK) | `prs_subject_scores.score_id` FK ON DELETE CASCADE works | Pest | `pest ... --filter=cross_schema_fk` | ❌ W0 | ⬜ |

## Wave 0 Requirements

- [ ] `backend/tests/Feature/FinnGen/LoadPgsCatalogCommandTest.php`
- [ ] `backend/tests/Feature/FinnGen/PrsDispatchTest.php` (mirror `GwasDispatchTest.php` — manual seed, fake RunService)
- [ ] `backend/tests/Feature/FinnGen/CohortPrsEndpointsTest.php`
- [ ] `backend/tests/Unit/FinnGen/PgsCatalogFetcherTest.php`
- [ ] `backend/tests/Unit/FinnGen/PgsScoreIngesterTest.php`
- [ ] `frontend/src/features/cohort-definitions/components/__tests__/PrsDistributionPanel.test.tsx`
- [ ] `frontend/src/features/cohort-definitions/components/__tests__/ComputePrsModal.test.tsx`
- [ ] `backend/tests/Feature/FinnGen/PrsPermissionSeederTest.php`

No new framework install needed.

## Manual-Only Verifications (CHECKPOINT Wave 5)

| Behavior | SC | Instructions |
|----------|----|-----|
| E2E smoke-gen PGS000001 × PANCREAS | SC-2, GENOMICS-07 | See RESEARCH §Manual E2E Runbook |
| Histogram renders with real data | SC-3 | Load cohort detail drawer, verify BarChart + ReferenceArea + summary stats |
| CSV download matches psql row count | SC-3 | Click Download CSV, compare row count to `SELECT COUNT(*) FROM ...` |

## Security Threat Model (from RESEARCH §Security Domain)

| Threat ID | STRIDE | Mitigation | Verification |
|-----------|--------|------------|--------------|
| T-17-S1 | Tampering | PGS weights file checksum verify before ingest | PgsCatalogFetcher unit test |
| T-17-S2 | Information Disclosure | Raw subject scores NOT leaked via histogram endpoint (pre-aggregated server-side) | CohortPrsEndpointsTest assertion |
| T-17-S3 | Elevation of Privilege | `finngen.prs.compute` permission gates POST endpoint | Pest permission test |
| T-17-S4 | Denial of Service | PRS dispatch rate-limited via `throttle:10,1` + Horizon queue backpressure | Route middleware verification |

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] Feedback latency < 10s quick / 3min full
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
