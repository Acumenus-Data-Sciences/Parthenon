---
phase: 16
slug: pheweb-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 16 — Validation Strategy

Derived from `16-RESEARCH.md` §Validation Architecture.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Pest 3.x + Vitest + Playwright (SC-1 perf only) |
| **Config** | `backend/phpunit.xml`, `frontend/vitest.config.ts`, `e2e/playwright.config.ts` |
| **Quick run** | `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen/GwasManhattanControllerTest.php --no-coverage` |
| **Full suite** | Pest FinnGen + Vitest + optional Playwright SC-1 spec |

## Sampling Rate

- Per task commit: quick Pest on touched file
- Per wave merge: full FinnGen Pest + Vitest
- Phase gate: full suite + Plan 7 DEV cutover checkpoint + Playwright SC-1 benchmark

## Per-Requirement Verification Map

| SC / Req | Behavior | Test Type | Command | File | Status |
|----------|----------|-----------|---------|------|--------|
| SC-1 / GENOMICS-04 | Manhattan endpoint shape + thinning | Pest feature | `pest tests/Feature/FinnGen/GwasManhattanControllerTest.php -x` | ❌ W0 | ⬜ |
| SC-1 / GENOMICS-04 | Thinning algorithm (GWS bypass) | Pest unit | `pest tests/Unit/FinnGen/ManhattanAggregationServiceTest.php -x` | ❌ W0 | ⬜ |
| SC-1 / GENOMICS-04 | <3s render warm-cache | Playwright E2E | `npx playwright test e2e/tests/phase-16-manhattan-perf.spec.ts` | ❌ W5 | ⬜ |
| SC-1 / GENOMICS-04 | In-flight run returns 202 | Pest feature | filter=`in_flight` | ❌ W0 | ⬜ |
| SC-2 / GENOMICS-04 | Regional endpoint window | Pest feature | `pest tests/Feature/FinnGen/GwasManhattanRegionTest.php -x` | ❌ W0 | ⬜ |
| SC-2 / GENOMICS-04 | GENCODE gene track endpoint | Pest feature | `pest tests/Feature/GencodeControllerTest.php -x` | ❌ W0 | ⬜ |
| SC-2 / GENOMICS-04 | RegionalView SVG genes render | Vitest unit | `vitest run RegionalView.test.tsx` | ❌ W0 | ⬜ |
| SC-3 / GENOMICS-04 | Top-50 endpoint sort + limit | Pest feature | `pest tests/Feature/FinnGen/TopVariantsControllerTest.php -x` | ❌ W0 | ⬜ |
| SC-3 / GENOMICS-04 | Top-50 drawer shape | Vitest unit | `vitest run TopVariantsTable.test.tsx` | ❌ W0 | ⬜ |
| SC-4 / GENOMICS-13 | Pill renders when seeded | Vitest unit | `vitest run FinnGenSeededPill.test.tsx` | ❌ W0 | ⬜ |
| SC-4 / GENOMICS-13 | Pill omitted when not seeded | Vitest unit | same file filter=`omitted` | ❌ W0 | ⬜ |
| invariant (HIGHSEC §2) | Routes guarded (401/403) | Pest feature | `pest ManhattanRoutePermissionTest.php -x` | ❌ W0 | ⬜ |
| invariant (T-16-S1) | `?thin=1` → 422 | Pest feature | filter=`bin_count_clamp` | ❌ W0 | ⬜ |
| invariant (T-16-S3) | GENCODE size limit | Pest feature | filter=`size_limit` | ❌ W0 | ⬜ |

## Wave 0 Requirements (14 new test files)

- [ ] `backend/tests/Feature/FinnGen/GwasManhattanControllerTest.php`
- [ ] `backend/tests/Feature/FinnGen/GwasManhattanRegionTest.php`
- [ ] `backend/tests/Feature/FinnGen/TopVariantsControllerTest.php`
- [ ] `backend/tests/Feature/FinnGen/ManhattanRoutePermissionTest.php`
- [ ] `backend/tests/Feature/GencodeControllerTest.php`
- [ ] `backend/tests/Feature/FinnGen/LoadGencodeGtfCommandTest.php`
- [ ] `backend/tests/Unit/FinnGen/ManhattanAggregationServiceTest.php`
- [ ] `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/FinnGenManhattanPlot.test.tsx`
- [ ] `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/RegionalView.test.tsx`
- [ ] `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/TopVariantsTable.test.tsx`
- [ ] `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/GeneTrack.test.tsx`
- [ ] `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/VariantDrawer.test.tsx`
- [ ] `frontend/src/features/finngen-workbench/components/__tests__/FinnGenSeededPill.test.tsx`
- [ ] `e2e/tests/phase-16-manhattan-perf.spec.ts` (Wave 5 — perf benchmark)

## Manual-Only Verifications (CHECKPOINT Wave 5)

| Behavior | SC | Instructions |
|----------|----|-----|
| Live Manhattan from real GWAS run | SC-1 | Navigate to DEV `/workbench/finngen-endpoints/E4_DM2/gwas/{runId}` — plot renders; peaks visible |
| Regional drill-down | SC-2 | Click a peak → regional view opens; gene track renders; close returns |
| Top-50 sortable | SC-3 | Sort by p_value desc, then by beta; verify row order; click row → drawer |
| Pill on workbench session | SC-4 | Open a FinnGen-seeded workbench session → pill at top; click → endpoint browser |

## Security Threat Model

| Threat ID | STRIDE | Mitigation | Verification |
|-----------|--------|------------|--------------|
| T-16-S1 | DoS (thinning bypass) | FormRequest clamps bin_count 10-500 | Pest filter=`bin_count_clamp` |
| T-16-S2 | Tampering (cache poisoning) | Redis key scoped to server-validated gwas_run_id | Static grep in Plan 7 |
| T-16-S3 | DoS (GENCODE size) | Artisan size-check ≤100MB | Pest filter=`size_limit` |
| T-16-S4 | SSRF | GENCODE URL hardcoded pattern, no --url flag | Plan 2 static check |
| T-16-S5 | IDOR | gwas_run_id validated via `finngen.runs` existence + source_key match | Pest 404 test |

## Validation Sign-Off

- [ ] All 14 Wave 0 test files created
- [ ] Full Pest + Vitest green
- [ ] Playwright SC-1 perf: <3s warm-cache render
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
