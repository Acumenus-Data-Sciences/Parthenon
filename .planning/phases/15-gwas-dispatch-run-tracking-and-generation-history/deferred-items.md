# Phase 15 Deferred Items

Logged during Plan 15-05 execution (per SCOPE BOUNDARY: out-of-scope failures
in unrelated files are not auto-fixed during per-plan TDD).

## i18n locale parity test

- **File:** `frontend/src/i18n/__tests__/localeParity.test.ts`
- **Test:** "keeps supported locale metadata aligned with Laravel config"
- **Status:** pre-existing failure (unchanged by Plan 15-05)
- **Discovered during:** Full vitest suite run at Plan 15-05 close
- **Impact:** does not block Phase 15; no interaction with GWAS dispatch path
- **Owner:** i18n-unified worktree (likely stale snapshot vs main Laravel config
  after 17-01 PGS/PRS merge) — route to the i18n team or fold into a sweep
