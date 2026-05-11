# Phase 9.9 — Migration Guide (Atlas → Parthenon)

**Date:** 2026-03-03
**Status:** Complete

---

## What Was Built

### Backend — 2 New Artisan Commands

**`parthenon:import-atlas-concept-sets {path} {--user-id=}`**
- Mirrors `ImportAtlasCohortsCommand` pattern exactly
- Accepts directory of JSON files or single file
- Supports both single-object and array JSON formats (Atlas bulk export format)
- Parses Atlas concept set format: `{name, expression: {items: [{concept: {CONCEPT_ID,...}, isExcluded, includeDescendants, includeMapped}]}}`
- Creates `ConceptSet` + `ConceptSetItem` records per concept in the set
- Duplicate check (case-insensitive name) — skips rather than errors
- Summary line: `✓ Imported N  ↷ Skipped M (duplicate)  ✗ Failed K`

**`parthenon:validate-atlas-parity {--atlas-url=} {--atlas-token=} {--source-key=} {--compare-n=10} {--tolerance=0.02} {--no-generate}`**
- Fetches cohort definition list from Atlas WebAPI (`GET /cohortdefinition/`)
- Randomly selects N cohorts (or all if `--compare-n=0`)
- For each cohort:
  1. Fetches full CIRCE expression from Atlas (`GET /cohortdefinition/{id}`)
  2. Tries to get Atlas's stored generation count (`GET /cohortdefinition/{id}/info`)
  3. Imports to Parthenon if not already present (validates with `CohortExpressionSchema`)
  4. Generates in Parthenon via `CohortGenerationService` (synchronous in CLI context)
  5. Compares counts with configurable tolerance
- PASS / WARN (between tolerance and 5× tolerance) / FAIL (> 5× tolerance) / N/A (no Atlas count)
- Outputs Laravel-style table with all results
- Returns exit code 1 if any FAILures (usable in CI)
- Fixes during implementation:
  - PHP disallows arithmetic expressions inside string interpolation — extracted `$pct` variable
  - Cyrillic `$parthenонCount` variable name (LLM artefact) replaced with `$parthenonCount`

Both commands verified with `php artisan list parthenon` — all 4 migration-relevant commands registered.
Pint style check: 2 minor fixes (single quotes, unary operators).

### Documentation — 7 MDX pages in `docs/site/docs/migration/`

| File | Content |
|------|---------|
| `00-overview.mdx` | What transfers automatically, what requires manual work, estimated timeline, prerequisites |
| `01-before-you-begin.mdx` | Full prerequisite checklist (Parthenon, Atlas, access), manual vs automatic matrix, risk mitigation |
| `02-export-from-atlas.mdx` | Atlas UI export + bash bulk export scripts for cohorts, concept sets, analysis definitions, sources |
| `03-import-into-parthenon.mdx` | CLI commands for all import types, expected JSON formats, verification checklist |
| `04-validating-parity.mdx` | Parity validation command reference, example output, manual spot-check checklist, SQL diff instructions, WARN vs FAIL guidance |
| `05-cutover.mdx` | Legacy URL redirect table, end-user communication template, parallel operation, decommission checklist |
| `06-feature-comparison.mdx` | Full Atlas → Parthenon feature mapping table (5 sections: vocabulary, cohorts, analyses, data explorer, administration + WebAPI compat) |

Migration section added to `docs/site/sidebars.ts` between Administration and Appendices.

---

## Architecture Notes

- The `validate-atlas-parity` command uses `CohortGenerationService::generate()` synchronously in the CLI context. Horizon is not involved — the job runs in-process. This is correct for a validation CLI tool.
- Atlas `/cohortdefinition/{id}/info` response format varies by WebAPI version. The command handles both `personCount` and `person_count` field names and tolerates missing/empty generation arrays gracefully.
- The `--no-generate` flag allows comparison against already-generated Parthenon cohorts, enabling fast re-validation without re-running generation.

---

## Test

```bash
php artisan list parthenon
# All 4 migration commands listed cleanly

cd docs/site && npm run build
# SUCCESS — 43 HTML pages (36 original + 7 migration)
```

---

## Existing Commands (pre-existing, unchanged)

- `parthenon:import-atlas-cohorts` — already existed; documented in migration guide
- `parthenon:import-webapi-sources` — already existed; documented in migration guide
