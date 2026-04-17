# Genomics #1.5 — Resolver/expander bug fixes + Endpoint Browser UI

**Quick task:** continuation of `260416-qpg`
**Commit:** `e16973cfe`
**Date:** 2026-04-16

## Context

Genomics #1 (commit `44909d0b5`) imported the FinnGen DF14 endpoint
library — 5,161 phenotype definitions — into `app.cohort_definitions`.
The first run reported coverage of:

- 22.9% FULLY_MAPPED, 17.1% PARTIAL, 29.1% SPARSE, 24.6% UNMAPPED, 6.4% CONTROL_ONLY

The 5,826 codes flagged `ICD10_UNMATCHED` looked suspiciously high.
Diagnostic against `app.finngen_unmapped_codes` revealed that **most of
them were resolvable codes the resolver was failing on**, not genuinely
unmappable Finnish-only codes.

## Bugs found and fixed

### 1. Resolver didn't insert decimals into ICD-10 codes

FinnGen stores ICD-10 codes without the decimal (`E291`, `K0531`).
`vocab.concept` stores them dotted (`E29.1`, `K05.31`). The resolver
ran an exact `LIKE` against the un-dotted form and got zero matches.

**Diagnostic query proved the gap:**

```
Code   | exact lookup | with dot inserted | parent 3-char |
-------|--------------|-------------------|----------------|
E291   |      0       |       1           |       1        |
E833   |      0       |       1           |       1        |
F510   |      0       |       1           |       1        |
```

**Fix** (`FinnGenConceptResolver::resolveIcd10`): for each prefix,
emit both the original and a variant with `.` inserted after position 3
when no dot is present and length is at least 4. This mirrors the
strategy `resolveIcd9` already used.

**Recovered: ~2,050 unique unmapped codes.**

### 2. Pattern expander didn't handle most bracket forms

Real FinnGen patterns include bracket forms beyond the single-digit
range `[d-d]` the original expander handled:

| Form | Example | Was → Now |
|------|---------|-----------|
| Single digit in brackets | `00[1]` | dropped → `001` |
| Multi-digit char class | `I80[12]` | dropped → `I801, I802` |
| Alpha char class | `7490[ABCE]` | dropped → `7490A, 7490B, 7490C, 7490E` |
| Alpha range | `A4[A-C]` | dropped → `A4A, A4B, A4C` |
| ATC alpha class | `L02B[AG]` | dropped → `L02BA, L02BG` |
| Leading regex anchor | `^FN1[ABSY]` | dropped → `FN1A, FN1B, FN1S, FN1Y` |

**Fix** (`FinnGenPatternExpander`): replaced the single-form regex with
a recursive `expandBracketClass()` that tries digit range, alpha range,
then mixed digit/alpha classes in order. Strips leading `^` anchors.

**Recovered: ~70 unique unmapped ICD9_FIN codes.**

### 3. Junk tokens reached the unmapped sidecar

XLSX cell artifacts (`$!$`, `V`, `E`, `D06[7`) were being recorded as
unmapped codes. The resolver's `sanitize()` rejected them at lookup
time, but the importer added them to the sidecar before that gate fired.

**Fix:**
- `FinnGenConceptResolver::sanitize()` now requires length ≥ 2.
- `FinnGenPatternExpander::expand()` rejects unclosed brackets
  (mismatched `[` / `]` counts) and validates final token shape.

## Coverage delta (live production import)

| Bucket | Before | After | Δ |
|---|---|---|---|
| **FULLY_MAPPED** | 1,180 (22.9%) | **2,760 (53.5%)** | **+1,580** |
| **PARTIAL** | 884 (17.1%) | **1,399 (27.1%)** | **+515** |
| SPARSE | 1,500 (29.1%) | 208 (4.0%) | -1,292 (most moved up to PARTIAL/FULLY) |
| **UNMAPPED** | 1,268 (24.6%) | **427 (8.3%)** | **-841** |
| CONTROL_ONLY | 329 (6.4%) | 367 (7.1%) | +38 |

**~80% of endpoints (4,159 of 5,161) now have meaningful coverage** —
up from 40% (2,064). 2× the usable phenotype catalog.

### Per-vocabulary unmapped delta

| Vocab | Before (codes) | After (codes) | Δ |
|---|---|---|---|
| ICD8 | 7,470 | 4,635 | -2,835 (junk filter cleared mis-attributed tokens) |
| ICD10_UNMATCHED | 5,826 | **671** | **−89%** ← dot insertion |
| ICDO3 | 1,073 | 782 | -291 |
| ICD9_FIN | 1,907 | **12** | **−99%** ← bracket expansion |
| NOMESCO | 219 | 235 | +16 (slight, more codes correctly attributed) |
| KELA_REIMB | 61 | 61 | unchanged (Finnish reimbursement, not in OMOP) |
| ATC_UNMATCHED | 4 | 2 | -2 |

The 671 residual `ICD10_UNMATCHED` codes are the genuinely Finnish-only
ICD-10 extensions; closing those needs a custom OMOP vocabulary load
(separate task).

## New surface — FinnGen Endpoint Browser

The data is now valuable enough to deserve a real UI, not just the
generic cohort picker filter.

### Backend — `EndpointBrowserController`

- `GET /api/v1/finngen/endpoints` — paginated list with filters:
  - `q` — substring search across name, description, raw codes
  - `tag` — single tag filter (e.g., `#E4`, `#GASTRO_CM`)
  - `bucket` — coverage bucket filter (`FULLY_MAPPED` etc.)
  - `release` — convenience for `tag = finngen:{release}`
  - `per_page` — 1..100, default 25
- `GET /api/v1/finngen/endpoints/stats` — bucket counts, top 20 tags,
  unmapped vocab summary. Powers the dashboard stat cards.
- `GET /api/v1/finngen/endpoints/{name}` — full endpoint detail
  including parsed source code lists per column and resolved concept
  counts.
- RBAC: all gated by `permission:finngen.workbench.use` (same as the
  rest of SP4 workbench).

### Frontend — `FinnGenEndpointBrowserPage`

Live at `/workbench/finngen-endpoints` (production).

- **Stat card row** — 5 cards (FULLY_MAPPED / PARTIAL / SPARSE /
  UNMAPPED / CONTROL_ONLY) showing count + percentage. Each card is a
  toggle filter. Tone-coded coverage bars at the bottom of each card
  (teal / amber / orange / rose / slate).
- **Search bar** — debounced 300ms, searches name + description + raw
  ICD codes (uses `expression_json::text ILIKE` on the backend).
- **Tag chip row** — top 12 FinnGen chapter tags from the stats
  endpoint. Click to filter; clear-all button surfaces when any
  filter is active.
- **Endpoint rows** — per-endpoint card showing name (mono font),
  coverage badge with %, description, top 5 tags, resolved/total token
  count, and a colored coverage bar.
- **Detail drawer** — slides in from the right with full coverage
  breakdown (conditions / drugs / source-concept counts), metadata
  grid (release, level, sex restriction, includes), all source-code
  columns in collapsible accordions, and a sticky "Use {name} in
  Workbench" CTA at the bottom.
- Dark clinical theme: `#0E0E11` base, teal `#2DD4BF` for
  FULLY_MAPPED, amber `#C9A227`-adjacent for PARTIAL, orange for
  SPARSE, rose `#9B1B30`-adjacent for UNMAPPED, slate for
  CONTROL_ONLY.

## Tests

- 35 new assertions across `PatternExpansionTest` (single-bracket,
  multi-digit class, alpha class, alpha range, ATC class, unclosed
  bracket rejection, anchor stripping, junk filtering) and
  `ConceptResolutionTest` (4-char and 5-char dot insertion, dotted
  passthrough, single-char rejection).
- Full FinnGen suite: **223 tests / 599 assertions, all green.**
- Pre-commit hook: Pint, PHPStan, TypeScript, ESLint, Vitest, vite
  build all passed.

## Honest gaps that remain

- 671 ICD-10 codes are still `ICD10_UNMATCHED` — these are real
  Finnish-only extensions, not resolver bugs. Need a custom Finnish
  ICD-10 OMOP vocabulary build to fix.
- ICD-8 (4,635 codes), ICDO3 (782), ICD9_FIN residual (12),
  NOMESCO (235), KELA_REIMB (61) all still unmapped because their
  source vocabularies aren't in `vocab.concept`. Each needs a custom
  OMOP vocabulary build — separate tasks.
- The browser has no "Use in Workbench" wiring to actually copy the
  endpoint's resolved concept_ids into a new workbench session yet —
  the CTA links to `/workbench/cohorts` (the sessions list). Closing
  that loop is straightforward follow-up work.
- `longname` is not extracted from the XLSX (it's stuffed into
  `description` instead). Cheap follow-up: add a dedicated `longname`
  field to `expression_json`.

## How to use

Production:
- `https://parthenon.acumenus.net/workbench/finngen-endpoints`
- Login as researcher → page renders catalog with stat cards + search
- Click a coverage bucket card to filter
- Click a tag chip to drill in (e.g., `#E4` for endocrine endpoints)
- Click a row → full detail drawer with codes + CTA

CLI:
```bash
# Re-run import (idempotent — picks up resolver fixes for any new release)
docker compose exec php php artisan finngen:import-endpoints --release=df14

# Dry-run with new resolver
docker compose exec php php artisan finngen:import-endpoints --release=df14 --dry-run
```

## References

- Prior commit (initial import): `44909d0b5`
- Devlog #1: `docs/devlog/modules/finngen/genomics-01-endpoint-import.md`
- Quick task plan: `.planning/quick/260416-qpg-import-finngen-curated-endpoint-library-/`
