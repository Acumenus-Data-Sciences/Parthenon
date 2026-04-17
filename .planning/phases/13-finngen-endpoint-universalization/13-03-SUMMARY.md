---
phase: 13
plan: 03
subsystem: finngen-endpoint-universalization
tags: [backend, enum, classifier, finngen, coverage-profile, pure-function, wave-2]
requires:
  - plan: "13-01"
    provides: ["FinnGenCoverageProfileClassifierTest RED skeleton (4 failing tests)"]
  - adr: "ADR-002"
    provides: ["classification edge-case rules (tandem KELA, truncated=resolved, ICDO3 STCM)"]
provides:
  - "App\\Enums\\CoverageProfile (UPPERCASE-named, string-backed, 3 cases)"
  - "App\\Services\\FinnGen\\FinnGenCoverageProfileClassifier::classify (pure static)"
  - "RED -> GREEN transition for Plan 01's 4 classifier test cases"
affects:
  - "Plan 13-04 (resolver): downstream consumer of CoverageProfile enum"
  - "Plan 13-06 (importer): calls classify() inside processRow + writes ->value into app.cohort_definitions.coverage_profile"
  - "Plan 13-07 (frontend): literal type union mirrors enum string values"
tech-stack:
  added: []
  patterns:
    - "Final-class pure-function service (no DB, no I/O)"
    - "Named-parameter entry point for self-documenting call site"
    - "UPPERCASE enum cases with lowercase/snake_case string values (CohortDomain convention)"
key-files:
  created:
    - "backend/app/Enums/CoverageProfile.php"
    - "backend/app/Services/FinnGen/FinnGenCoverageProfileClassifier.php"
  modified: []
decisions:
  - "CoverageProfile case names UPPERCASE per project C-4 convention; string values lowercase/snake_case to match Plan 02 migration and frontend literal unions"
  - "Truncated resolver output counts as RESOLVED for classification (ADR-002 Rule 2) — classifier inspects standard !== [], ignores truncated bit"
  - "Classifier is a pure function — no DB dependency, no I/O, importer (Plan 06) owns persistence"
metrics:
  duration: "~5min"
  completed: "2026-04-17"
  tasks: 2
  files: 2
commits:
  - "c59f0fc21: feat(13-03): add CoverageProfile enum for endpoint portability"
  - "7be7413c5: feat(13-03): add FinnGenCoverageProfileClassifier pure-function service"
---

# Phase 13 Plan 03: CoverageProfile Enum + Classifier Summary

**One-liner:** Shipped the `CoverageProfile` enum and pure-function `FinnGenCoverageProfileClassifier::classify()` that maps FinnGen resolver output (7 vocab groups) to UNIVERSAL / PARTIAL / FINLAND_ONLY per ADR-002, turning Plan 01's 4 failing classifier Pest tests GREEN.

## Objective Completion

Both Wave-2 artifacts ship cleanly:

- `App\Enums\CoverageProfile` — 3 cases UPPERCASE (`UNIVERSAL`, `PARTIAL`, `FINLAND_ONLY`) backed by lowercase string values (`universal`, `partial`, `finland_only`) that match Plan 02's migration value list and Plan 07's frontend literal type union.
- `App\Services\FinnGen\FinnGenCoverageProfileClassifier` — `final class` with a single `public static classify(...)` method taking 7 named array parameters (`icd10, icd9, atc, icd8, icdO3, nomesco, kelaReimb`), each typed-documented as the resolver's `array{standard: list<int>, source: list<int>, truncated: bool}` return shape.

The classifier is a pure function: no DB, no I/O. It inspects `$group['standard'] !== []` per vocab, classifies FINLAND_ONLY when none resolved, UNIVERSAL when all resolved, PARTIAL otherwise. Truncated output (standard array of 500 with `truncated: true`) counts as resolved (ADR-002 Rule 2).

## Files Created

| Path | Purpose |
|---|---|
| `backend/app/Enums/CoverageProfile.php` | Type-safe enum with `label()` + `allValues()` helpers |
| `backend/app/Services/FinnGen/FinnGenCoverageProfileClassifier.php` | Pure-function classifier, named-parameter entry point |

## Verification

### Pint (Laravel formatting)

```
PASS   ............................................................ 1 file
```

Run on both new files, no diff.

### PHPStan level 8

```
Note: Using configuration file /var/www/html/phpstan.neon.

 [OK] No errors
```

Analyzed `app/Enums/CoverageProfile.php` and `app/Services/FinnGen/FinnGenCoverageProfileClassifier.php` together at level 8 (max) with `--memory-limit=2G`.

### Pest — FinnGenCoverageProfileClassifierTest (RED -> GREEN)

```
   PASS  Tests\Unit\FinnGen\FinnGenCoverageProfileClassifierTest
  ✓ it returns FINLAND_ONLY when no group resolves
  ✓ it returns PARTIAL when at least one group resolves and at least one does not
  ✓ it returns UNIVERSAL when every non-empty input group resolves
  ✓ it treats truncated standard arrays as resolved for classification purposes

  Tests:    4 passed (4 assertions)
  Duration: 0.14s
```

All 4 test cases that Plan 13-01 scaffolded as RED now flip to GREEN. No other Pest files touched (scope respected).

## Commits

| Hash | Message |
|---|---|
| `c59f0fc21` | feat(13-03): add CoverageProfile enum for endpoint portability |
| `7be7413c5` | feat(13-03): add FinnGenCoverageProfileClassifier pure-function service |

Both committed with `--no-verify` per parallel-execution protocol (checks already run manually via main-worktree PHP container because the worktree has no vendor/).

## Deviations from Plan

None — plan executed exactly as written. Both files use the literal content blocks from the PLAN `<action>` sections; no edge-case deviations, no Rule 1-4 triggers.

## Downstream Unblocked

Plans now able to `use App\Enums\CoverageProfile` and `use App\Services\FinnGen\FinnGenCoverageProfileClassifier`:

- **Plan 13-04** (resolver refactor): can annotate return shape downstream of classify().
- **Plan 13-05** (FinnishVocabResolver / StandardFirstResolver): consumers of the enum for unit-test assertions.
- **Plan 13-06** (importer): inserts `CoverageProfile::classify(icd10: ..., icd9: ...)->value` into `app.cohort_definitions.coverage_profile` inside `processRow()`.
- **Plan 13-07** (frontend browser): React literal type union `'universal' | 'partial' | 'finland_only'` mirrors `CoverageProfile::allValues()`.

## Known Stubs

None. Both files are complete terminal artifacts (no TODOs, no placeholders, no hardcoded empties that flow to UI).

## Threat Flags

None. Enum + pure function; no new network endpoints, no file access, no schema writes, no trust boundaries crossed. Trust boundaries remain the resolver (inputs) and importer (output destination) — both owned by other plans.

## Self-Check: PASSED

- FOUND: `backend/app/Enums/CoverageProfile.php`
- FOUND: `backend/app/Services/FinnGen/FinnGenCoverageProfileClassifier.php`
- FOUND: commit `c59f0fc21` (feat(13-03): add CoverageProfile enum)
- FOUND: commit `7be7413c5` (feat(13-03): add FinnGenCoverageProfileClassifier)
