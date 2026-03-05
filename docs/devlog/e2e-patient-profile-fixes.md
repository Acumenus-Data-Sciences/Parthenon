# E2E Test Infrastructure & Patient Profile Performance Fix

**Date:** March 5, 2026
**Commits:** `b3c698c2`, `3c1a8da1`

---

## What Was Built

### 1. Production Playwright E2E Test Infrastructure

**Problem:** Tests previously ran only against local dev. No production smoke test pipeline.

**Solution:** Complete rewrite of e2e infrastructure to support production HTTPS:

- `e2e/playwright-local.config.ts` — local config (existing, minor updates)
- `e2e/playwright-prod.config.ts` — new production config targeting `https://parthenon.acumenus.net`
- `e2e/global-setup.ts` — rewrote to work against Sanctum SPA auth:
  1. Navigate to `/login` first (sets XSRF cookie)
  2. API login via `POST /api/v1/auth/login` with XSRF header — gets Bearer token
  3. Browser form login — gets session cookie / storage state
  4. Saves both `AUTH_FILE` (storageState for browser tests) and `TOKEN_FILE` (Bearer token for API calls)
- All configs use `ignoreHTTPSErrors: true` and `storageState` inherited from global setup

**Key patterns:**
- One login per full test run (global setup), avoiding rate limit throttle:5,15
- Studies tests use `getToken()` from TOKEN_FILE for direct API calls, storageState for browser navigation
- Modal dismissal before tab interactions: `Escape` keypress + close button search

**Results:** 43/43 tests passing against production.

### 2. Route::fallback() for Unknown API Routes

**Problem:** Unknown API routes returned 500 (Laravel default HTML error), not 404 JSON.

**Fix:** Added at end of `backend/routes/api.php`:
```php
Route::fallback(function () {
    return response()->json(['message' => 'Not Found'], 404);
});
```

### 3. Patient Profile 504 Timeout Fix

**Problem:** `GET /api/v1/sources/9/profiles/189` returned 504 Gateway Timeout (30s+).

**Root Cause (multi-layer):**
1. No `person_id`-first indexes on clinical tables with 700M+ rows
2. PostgreSQL query planner uses `random_page_cost=4` (HDD default), prefers parallel seq scans over index scans
3. Even after creating 9 CONCURRENTLY indexes, two failed `indisvalid` validation (measurement + observation) due to concurrent ANALYZE interference during build
4. Transaction-level `SET LOCAL statement_timeout` caused one timeout to abort the entire transaction

**Full Fix Applied (in `PatientProfileService.php`):**

1. **Created 9 person_id-first indexes** on all clinical tables:
   - `idx_condition_occurrence_person_id`, `idx_drug_exposure_person_id`, `idx_procedure_occurrence_person_id`, `idx_device_exposure_person_id`, `idx_observation_period_person_id`, `idx_visit_occurrence_person_id`, `idx_death_person_id`, `idx_measurement_person_id`, `idx_observation_person_id`

2. **REINDEX for invalid indexes** — measurement and observation failed initial CONCURRENTLY build; fixed with `REINDEX INDEX CONCURRENTLY`

3. **ANALYZE for fresh statistics** — ran on measurement and observation tables after reindex

4. **`SET enable_seqscan = off`** — forces planner to use indexes even with HDD cost model

5. **Session-level statement timeout (5s per domain)** — not transaction-level, so one domain timeout doesn't kill others

6. **`safeQuery()` pattern** — each domain query wrapped, catches exceptions, returns `[]` on failure, logs warning

7. **`finally` block** — always resets `enable_seqscan = on` and `statement_timeout = 0`

8. **Reduced limits** — measurement and observation from 2000 → 500 rows

**Before:** 504 Gateway Timeout (30-40 seconds)
**After:** Loads in ~0.7 seconds with full patient data

---

## Lessons Learned

- `CREATE INDEX CONCURRENTLY` can fail validation if ANALYZE runs concurrently during the build phase. Always verify `indisvalid` after concurrent builds.
- `random_page_cost=4` (HDD) makes PostgreSQL strongly prefer sequential scans even on indexed selective queries. `SET enable_seqscan=off` is a valid session-level workaround.
- `SET LOCAL` inside a DB::transaction() means one query timeout aborts the whole transaction. Use session-level `SET` with a `finally` reset instead.
- Playwright rate limiting: throttle:5,15 trips up test suites that do per-test logins. One global-setup login per run is the correct pattern.
- The "What's New" changelog modal blocks pointer events on the study detail page — always dismiss with Escape before tab clicks in E2E.
