# Phase 16: PheWeb-lite Results UI + Workbench Attribution — Research

**Researched:** 2026-04-17
**Domain:** Canvas/d3 genome-scale scatter rendering; PG `width_bucket` thinning with GWS bypass; Redis cache coordination with immutable run artifacts; GENCODE v46 GFF3 ingestion; TanStack Table v8 introduction; workbench session attribution (pure frontend diff).
**Confidence:** HIGH — 29 architectural decisions locked; every non-decision found a concrete file/line anchor during this research.
**Branch:** `feature/phase-16-pheweb-ui` @ `c9a8e7f30`

<user_constraints>
## User Constraints (from 16-CONTEXT.md)

### Locked Decisions (D-01 … D-29 — DO NOT re-litigate)

**Manhattan rendering:**
- **D-01** Canvas-backed render (not SVG). Extends `frontend/src/features/investigation/components/genomic/ManhattanPlot.tsx` (364 LOC, d3 + `HTMLCanvasElement`). Planner picks: extend in-place with prop-driven data source OR copy to a new component under `finngen-endpoint-browser/components/gwas-results/`.
- **D-02** Server-side thinning via lazy PG query. Endpoint `GET /api/v1/finngen/runs/{id}/manhattan` uses `width_bucket(pos, chrom_start, chrom_end, 100)` per-chromosome + DISTINCT-ON-style selection. All p < 5e-8 included unconditionally. Cached in Redis with key `finngen:manhattan:{gwas_run_id}:{thin_level}` and 24h TTL. First-hit 5-10s for 10M SNPs; subsequent <100ms.
- **D-03** Per-chromosome thinning: 5,000 bins × 22 autosomes + X = ~110k bins. Each bin emits min-p-value variant. GWS variants bypass binning. Expected output: 50k–150k rows from 10M.
- **D-04** Payload shape: `{ variants: [{chrom, pos, neg_log_p, gwas_run_id?, snp_id?}], genome: {chrom_offsets: [...]}, thinning: {bins, threshold: 5e-8, variant_count_before, variant_count_after} }`.
- **D-05** Canvas draw loop: one dot per variant, color by chromosome (alternating #2DD4BF teal / #1E40AF blue). Crimson (#9B1B30) threshold line at -log10(5e-8) ≈ 7.30.

**Regional view:**
- **D-06** Peak click → `GET /api/v1/finngen/runs/{id}/manhattan/region?chrom=X&start=Y-500000&end=Y+500000`. Full-res variants (not thinned) in window — usually 500-5000 per 1 Mb. Canvas render, smaller scale.
- **D-07** Gene track from GENCODE v46 basic annotation GFF3 (`gencode.v46.basic.annotation.gff3.gz`, 35M compressed). Baked to `backend/storage/app/private/gencode/` via Artisan `parthenon:load-gencode-gtf`. Served by `GET /api/v1/gencode/genes?chrom=X&start=Y&end=Z`.
- **D-08** Regional layout: position axis → variants scatter (Canvas) → gene track (SVG rects + strand arrows). d3 scales shared across layers.

**LD coloring — DEFERRED:**
- **D-09** No LD coloring in Phase 16. All regional variants monochromatic teal. Empty `<LegendBand>` placeholder for future 16.1.

**Top-50 variants table:**
- **D-10** `GET /api/v1/finngen/runs/{id}/top-variants?limit=50&sort=p_value&dir=asc`. Query: `SELECT chrom, pos, ref, alt, af, beta, se, p_value, snp_id, gwas_run_id FROM {source}_gwas_results.summary_stats WHERE gwas_run_id=? ORDER BY p_value ASC LIMIT 50`. Sort whitelist: 7 columns.
- **D-11** Use TanStack Table (already in deps v8.21.3, per-row click → slideover drawer).
- **D-12** Drawer fields: chrom, pos, ref, alt, af, beta, se, p-value, snp_id, gwas_run_id. No external links in v1.

**Workbench attribution pill:**
- **D-13** Frontend-only. Read `session.session_state.seeded_from` (typed `{kind: 'finngen-endpoint' | …, endpoint_name?: string}`). When `kind === 'finngen-endpoint'`, render pill `From FinnGen {endpoint_name}` linking to `/workbench/finngen-endpoints/{endpoint_name}`.
- **D-14** No backend schema change. `session_state` JSONB already untyped. Writer confirmed: `frontend/src/features/finngen-endpoint-browser/hooks/useEndpoints.ts:69-72` (`useOpenInWorkbench`).
- **D-15** Pill design tokens: crimson bg #9B1B30/10 opacity, crimson text, gold #C9A227 2px border, rounded-full. Icon from `lucide-react` (already in deps v0.577.0).

**API contract:**
- **D-16** 4 new routes under `auth:sanctum + permission:finngen.workbench.use + throttle:120,1`:
  - `GET /api/v1/finngen/runs/{id}/manhattan?thin={bin_count}`
  - `GET /api/v1/finngen/runs/{id}/manhattan/region?chrom=X&start=Y&end=Z`
  - `GET /api/v1/finngen/runs/{id}/top-variants?limit=50&sort=p_value&dir=asc`
  - `GET /api/v1/gencode/genes?chrom=X&start=Y&end=Z` (permission `cohorts.view`)
- **D-17** All 4 endpoints use default `pgsql` connection; resolve `{source}_gwas_results` schema by whitelist pattern (Phase 17 `CohortPrsController::candidateSchemas()` precedent).
- **D-18** FormRequests: `ManhattanQueryRequest` (bin_count 10-500; thin_threshold float default 5e-8), `ManhattanRegionQueryRequest` (chrom `/^(\d{1,2}|X|Y|MT)$/`, window ≤ 2Mb), `TopVariantsQueryRequest` (limit 1-200, sort whitelist, dir enum).

**Data model + Redis:**
- **D-19** No new tables, no migrations (Redis-helper config only if needed).
- **D-20** Redis cache keys:
  - `finngen:manhattan:{run_id}:thin:{bin_count}` — 24h TTL
  - `finngen:manhattan:{run_id}:top-variants:{sort}:{dir}:{limit}` — 15 min TTL
  - `finngen:gencode:genes:{chrom}:{start}:{end}` — 7-day TTL
- **D-21** Reuse existing `default` Redis connection (same as Phase 17).

**GENCODE gene track:**
- **D-22** `parthenon:load-gencode-gtf` — one-time idempotent Artisan. Fetches GFF3, parses `feature=gene` lines, writes TSV `{gene_name, chrom, start, end, strand, gene_type}` (~60k rows). In-memory cache per PHP-FPM worker.
- **D-23** `GencodeService` singleton with `findGenesInRange(chrom, start, end)`. ~5MB memory footprint per worker.
- **D-24** Deploy: `php artisan parthenon:load-gencode-gtf` once on DEV at cutover.

**Auth + security:**
- **D-25** Reuse `finngen.workbench.use` permission (Phase 13.2). No new permissions.
- **D-26** SSRF protection: URL hard-coded to `ftp.ebi.ac.uk` pattern. Optional `--file=path` for local dev.
- **D-27** T-16-S1 (thinning bypass): FormRequest clamps `bin_count` to 10-500.
- **D-28** T-16-S2 (cache poisoning): Redis key scoped by `gwas_run_id`, validated against `finngen.runs`. No user input in key.
- **D-29** T-16-S3 (gene-track memory blow): Artisan validates GFF3 size ≤ 100MB before parsing.

### Claude's Discretion (research + recommend)
- Test fixture for Manhattan: synthesize 10k-row summary_stats or reuse Phase 14-06 PANCREAS smoke output
- Extend-in-place vs. copy ManhattanPlot.tsx
- Top-50 table tech (TanStack Table recommended)
- Gene track rendering (SVG recommended; Canvas for variants)
- Canvas DPR (already established pattern)
- Regional window default (±500 kb)
- Empty state UX
- Error boundaries (wrap each panel)

### Deferred Ideas (OUT OF SCOPE)
- LD-colored variants (Phase 16.1)
- Multi-run comparison overlay
- GWAS-cohort manifest comparison
- Whole-genome PheWAS view
- Automatic gene-name overlays on full Manhattan
- PDF/PNG export
- Real-time progress bar for in-flight runs (covered by Phase 15 polling)
- PheWAS result browser for PGS Catalog scores
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **GENOMICS-04** | PheWeb-lite results UI at `/workbench/finngen-endpoints/{name}/gwas/{run_id}` — Manhattan plot, regional view, LocusZoom-lite (no LD in v1 per D-09), top-50 variants table, per-variant drawer. | §"Thinning SQL — Exact PG Query", §"Manhattan Rendering (reuse strategy)", §"Regional View Architecture", §"Top-50 Table (TanStack Table v8 introduction)", §"Redis Cache Strategy" |
| **GENOMICS-13** | Workbench attribution pill: `session_state.seeded_from.kind === "finngen-endpoint"` → render `From FinnGen {endpoint_name}` linking back to endpoint browser. | §"Workbench Attribution — Writer + Read Path", §"WorkbenchPage.tsx Insertion Point" |

All Phase 16 plans MUST list these two IDs in their `requirements_addressed`.
</phase_requirements>

## Project Constraints (from CLAUDE.md + HIGHSEC.spec.md)

| Directive | Enforcement in Phase 16 |
|-----------|-------------------------|
| **Pint via Docker after every PHP edit** | `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"` — in every plan's CI block. |
| **PHPStan level 8** | Declare param/return types on all new controllers/services. Baseline at `backend/phpstan-baseline.neon`. |
| **No `any` in TS, use `unknown` + narrow** | All API payload types in `frontend/src/features/finngen-endpoint-browser/api/gwas-results.ts` use explicit interfaces, not `any`. |
| **`npx vite build` STRICTER than tsc** | Verify locally with both before every frontend commit (Canvas-heavy code is a likely miss target). |
| **Named exports only** (global CLAUDE.md) | Existing `ManhattanPlot.tsx` uses `export default` — planner decides: keep default for backward-compat OR rename + re-export. Don't introduce new default exports. |
| **HIGHSEC §2 three-layer model** | All 4 routes: auth:sanctum + permission: + ownership-scoped (run_id belongs to user OR user has scope; see `Run::scopeForUser` at `Run.php:125`). |
| **HIGHSEC §3.1 mass-assignment** | No new models (D-19 no migrations). Existing Run + EndpointGwasRun already use explicit `$fillable`. |
| **HIGHSEC §4.1 grants** | No new tables → no grant blocks. Read-only schema access via existing `parthenon_app` SELECT on `{source}_gwas_results.summary_stats`. |
| **HIGHSEC §5.2 secrets + env vars** | GENCODE URL is hard-coded (D-26 SSRF). No secret references. |
| **CLAUDE.md Gotcha #12 (PG transaction poisoning)** | Cross-connection read of `{source}_gwas_results.summary_stats` from a user's request cycle MUST wrap the dynamic-schema probe in `beginTransaction`/`commit`/`rollBack` on a dedicated connection (mirror `FinnGenGwasRunObserver.php:150-178`). |
| **Auth system rules (auth-system.md)** | No auth changes. |

## Summary

Phase 16 ships a 3-panel researcher workflow on top of Phase 14/15's GWAS infrastructure: a full-chromosome Canvas Manhattan that renders a thinned ~100k-row projection of a 10M-SNP run in <3 s, a click-through regional view with a GENCODE gene track, and a sortable top-50 variants table — plus a 50-LOC workbench-page edit that renders an attribution pill when the session was seeded from a FinnGen endpoint.

Every architectural decision (D-01..D-29) is user-locked. This research focuses on **(a)** the exact SQL thinning query and its index-fit with the BRIN (gwas_run_id, chrom, pos) composite Phase 14 actually shipped, **(b)** whether the existing `ManhattanPlot.tsx` should be extended or copied, **(c)** the `seeded_from` writer (already-shipped, zero backend work), and **(d)** the small number of **LOW-confidence risks** around first-hit latency on a real 10M-row run.

**Primary recommendation:**
1. **Extend `ManhattanPlot.tsx` in-place with a prop-driven data source** — the existing 364 LOC already does Canvas + d3 + DPR exactly as approved; the data contract changes from `{chr, pos, p}` to a thinned `{variants, genome, thinning}` envelope, and a thin wrapper hook reshapes API data to the existing `PreparedPoint` shape. Copy is ~2x the LOC for ~0 semantic gain.
2. **Use the Phase 14 BRIN (gwas_run_id, chrom, pos) composite** — Phase 14 deviated from the original (chrom, pos) BRIN in favor of a composite keyed by gwas_run_id precisely so Manhattan queries (always scoped by gwas_run_id) range-scan efficiently. Thinning query exploits this directly.
3. **Workbench pill: the writer already exists.** `frontend/src/features/finngen-endpoint-browser/hooks/useEndpoints.ts:69-72` writes `seeded_from: {kind: 'finngen-endpoint', endpoint_name}` at session creation. Phase 16 adds a ~30-LOC read component + one insertion point in `frontend/src/features/finngen-workbench/pages/WorkbenchPage.tsx` (header section around L118-144).
4. **The workbench session page is NOT at `/workbench/sessions/:id`.** It's at `/workbench/cohorts/:sessionId` via `WorkbenchPage.tsx` (router.tsx:346-351). Context and ROADMAP use "session page" loosely; planner must cite the real filename and route.
5. **First-hit latency on a 10M-row real GWAS is an unknown until Phase 14-07 CHECKPOINT lands** — Phase 14 smoke only ships 10k variants × 361 subjects (per 17-RESEARCH). Planner SHOULD flag "real 10M SNP thinning latency" as an Open Question resolved at Phase 14-07 or in a Phase 16 smoke.
6. **No Recharts in this phase.** The top-50 table is a plain TanStack Table introduction (no existing usage in Parthenon — Phase 16 is the first consumer of the installed @tanstack/react-table). The CLAUDE.md Recharts formatter `as never` cast is irrelevant here.

## Standard Stack

### Core (all already in-project — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **d3** | ^7.9.0 | Scales + ticks + zoom + axes for Manhattan + Regional + GeneTrack | Live at `ManhattanPlot.tsx:1-364` via `import * as d3 from "d3"`; no separate d3-scale dep. `[VERIFIED: frontend/package.json]` |
| **@tanstack/react-table** | ^8.21.3 | Top-50 sortable table | Already installed but **NOT YET USED** in Parthenon. Phase 16 is the first consumer. Fallback: plain `<table>` with manual `useState<SortState>` (D-11 discretion). `[VERIFIED: frontend/package.json + grep]` |
| **lucide-react** | ^0.577.0 | Pill icon (helix/fingerprint) | Already used throughout `finngen-endpoint-browser` + `finngen-workbench`. `[VERIFIED: frontend/package.json]` |
| **react-router-dom** | (React 19 peer) | `<Link>` for pill + deep-link | Live in `GwasRunsSection.tsx:14` + `WorkbenchPage.tsx:7`. `[VERIFIED]` |
| **@tanstack/react-query** | — | API fetching (3 new hooks: useManhattanData, useTopVariants, useGencodeGenes) | Live throughout `finngen-endpoint-browser/hooks/` — same pattern as `useEndpointStats`. `[VERIFIED: useEndpoints.ts]` |
| **date-fns** | — | `formatDistanceToNow` in GwasRunsSection — reuse for "run completed X ago" on results page | Live in `GwasRunsSection.tsx:15`. `[VERIFIED]` |
| **Zustand (themeStore)** | — | Consume `--primary`, `--accent`, `--success` CSS vars via `getComputedStyle` | Live pattern at `ManhattanPlot.tsx:108,131-141`. `[VERIFIED]` |
| **Laravel Http** | 11.x | GENCODE GFF3 fetch | Live pattern at `ClinVarSyncService.php:69` (stream sink) — same as Phase 17 `LoadPgsCatalogCommand`. `[VERIFIED]` |
| **PHP `gzopen`/`gzgets`** | built-in | Parse GENCODE GFF3.gz line-by-line | Phase 17 precedent (17-RESEARCH §Pattern 1). `[VERIFIED]` |
| **Laravel Redis** | 11.x | Cache control per D-20 | Live pattern at `FinnGenIdempotencyStore.php:32-54` (SETNX + GET). For Phase 16 use the simpler `Cache::remember()` facade (same Redis backend, friendlier API). `[VERIFIED]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **ErrorBoundary** (project component) | — | Wrap each panel (Manhattan, Regional, TopVariants) | Live at `frontend/src/components/ErrorBoundary.tsx:51-85`. Supports optional `fallback` prop; panel-scoped fallback prevents full-page crash. `[VERIFIED]` |
| **EmptyState** (project component) | — | "GWAS run still running" + "No GWS hits" copy | Live at `frontend/src/components/ui/EmptyState` (used in `FinnGenGwasResultsStubPage.tsx:12`). `[VERIFIED]` |
| **RunStatusBadge** (project component) | — | Surfacing run lineage at page top | Live at `frontend/src/features/_finngen-foundation/components/RunStatusBadge` (reused in `GwasRunsSection.tsx:18`). `[VERIFIED]` |
| **react-i18next** (`useTranslation`) | — | All user-facing strings in pill + panels | Live across components; i18n namespace `"app"` typical. `[VERIFIED: ErrorBoundary.tsx:22]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `ManhattanPlot.tsx` | Copy to `finngen-endpoint-browser/components/gwas-results/FinnGenManhattanPlot.tsx` | Copy = 364 LOC duplicated + drift risk. Extend = one conditional prop for data shape (`dataSource: 'catalog-upload' \| 'gwas-run'`) OR a simpler refactor: extract `useManhattanCanvas(points, thresholds, ...)` hook. **Recommend hook extraction.** Net zero LOC growth; both use cases stay clean. |
| TanStack Table | Plain `<table>` + `useState<SortState>` | TanStack is already installed and is 10 LOC vs ~30 LOC of manual sort wiring. Recommend TanStack Table — first consumer in Parthenon BUT zero new deps. |
| Canvas gene track | SVG gene track | SVG wins on interactivity (click individual gene → hover tooltip, link to gene viewer). Recommend SVG (D-08 already approves). |
| `Cache::remember` (Laravel facade) | Raw Redis via `Redis::connection()` | Cache facade is identical Redis backend + friendlier API + handles JSON encode/decode. Recommend `Cache::remember()`. |

**Installation:** `npm install` — nothing new. `composer require` — nothing new.

**Version verification:**
```bash
# All already pinned:
cat frontend/package.json | jq '.dependencies | {d3, "@tanstack/react-table", "lucide-react", recharts}'
# → d3 ^7.9.0, @tanstack/react-table ^8.21.3, lucide-react ^0.577.0, recharts ^3.8.1
```
- d3 v7.9.0 published 2024-03 per `[CITED: npmjs.com/package/d3]`. Current major, stable. `[VERIFIED: package.json]`
- @tanstack/react-table v8.21.3 latest of v8 line. v9 exists in prerelease. `[VERIFIED: package.json]`
- GENCODE v46 — published 2024-05-13, basic annotation GFF3 **35MB compressed** per `[VERIFIED: WebFetch https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_46/]`. Confirms ≤100MB D-29 guard.

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── app/
│   ├── Console/Commands/
│   │   └── LoadGencodeGtfCommand.php                # NEW — parthenon:load-gencode-gtf
│   ├── Services/FinnGen/
│   │   ├── ManhattanAggregationService.php          # NEW — thinning SQL (cached)
│   │   └── GencodeService.php                       # NEW — singleton, in-memory TSV scan
│   ├── Http/
│   │   ├── Controllers/Api/V1/
│   │   │   ├── FinnGen/GwasManhattanController.php  # NEW — 3 endpoints
│   │   │   └── GencodeController.php                # NEW — 1 endpoint
│   │   └── Requests/FinnGen/
│   │       ├── ManhattanQueryRequest.php
│   │       ├── ManhattanRegionQueryRequest.php
│   │       └── TopVariantsQueryRequest.php
│   └── Support/
│       └── SchemaResolver.php                        # OPTIONAL — extract candidateSchemas()
│                                                       from CohortPrsController for reuse
└── routes/api.php                                    # MODIFY — 4 new routes

frontend/
├── src/features/finngen-endpoint-browser/
│   ├── api/gwas-results.ts                          # NEW — fetch clients
│   ├── hooks/
│   │   ├── useManhattanData.ts                      # NEW
│   │   ├── useManhattanRegion.ts                    # NEW
│   │   ├── useTopVariants.ts                        # NEW
│   │   └── useGencodeGenes.ts                       # NEW
│   ├── components/gwas-results/
│   │   ├── FinnGenManhattanPanel.tsx                # NEW — wraps ManhattanPlot, shows thinning summary
│   │   ├── RegionalView.tsx                         # NEW — Canvas variants + SVG gene track
│   │   ├── GeneTrack.tsx                            # NEW — SVG only
│   │   ├── TopVariantsTable.tsx                     # NEW — TanStack Table
│   │   ├── VariantDrawer.tsx                        # NEW — per-row slideover
│   │   └── LegendBand.tsx                           # NEW — empty placeholder (D-09)
│   └── pages/
│       └── FinnGenGwasResultsPage.tsx               # REPLACES StubPage at router.tsx:379
└── src/features/investigation/components/genomic/
    └── ManhattanPlot.tsx                             # MODIFY (recommended: extract useManhattanCanvas hook)

frontend/src/features/finngen-workbench/
├── components/
│   ├── FinnGenSeededPill.tsx                        # NEW
│   └── __tests__/FinnGenSeededPill.test.tsx
└── pages/
    └── WorkbenchPage.tsx                             # MODIFY — render pill in header (L118-144)

Tests:
backend/tests/Feature/FinnGen/
├── GwasManhattanControllerTest.php                  # NEW
├── GwasManhattanRegionTest.php                      # NEW
├── TopVariantsControllerTest.php                    # NEW
└── LoadGencodeGtfCommandTest.php                    # NEW
backend/tests/Feature/
└── GencodeControllerTest.php                        # NEW
backend/tests/Unit/FinnGen/
└── ManhattanAggregationServiceTest.php              # NEW
frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/
├── FinnGenManhattanPanel.test.tsx
├── RegionalView.test.tsx
├── GeneTrack.test.tsx
├── TopVariantsTable.test.tsx
└── VariantDrawer.test.tsx
```

### Pattern 1 — Thinning SQL (CRITICAL — this is the hot path)

**What:** Per-chromosome `width_bucket` binning with unconditional genome-wide-significance (p < 5e-8) bypass, emitted as `UNION ALL` and de-duplicated server-side.

**The exact SQL (verified against the Phase 14 shipped schema):**
```sql
-- Inputs: :run_id (VARCHAR(26) ULID), :bins (int 10-500), :gws_threshold (default 5e-8)
-- Schema: {source}_gwas_results — resolved via candidateSchemas() whitelist (see §"Schema Resolution")
WITH per_chrom_bounds AS (
    SELECT chrom,
           MIN(pos)::bigint AS chrom_start,
           MAX(pos)::bigint AS chrom_end
      FROM {schema}.summary_stats
     WHERE gwas_run_id = :run_id
  GROUP BY chrom
),
binned AS (
    SELECT ss.chrom,
           ss.pos,
           ss.p_value,
           ss.snp_id,
           width_bucket(ss.pos, b.chrom_start, b.chrom_end + 1, :bins) AS bin,
           ROW_NUMBER() OVER (
               PARTITION BY ss.chrom,
                            width_bucket(ss.pos, b.chrom_start, b.chrom_end + 1, :bins)
               ORDER BY ss.p_value ASC NULLS LAST, ss.pos ASC
           ) AS rnk
      FROM {schema}.summary_stats ss
      JOIN per_chrom_bounds b ON b.chrom = ss.chrom
     WHERE ss.gwas_run_id = :run_id
),
thin_representatives AS (
    SELECT chrom, pos, p_value, snp_id
      FROM binned
     WHERE rnk = 1
),
gws_bypass AS (
    SELECT chrom, pos, p_value, snp_id
      FROM {schema}.summary_stats
     WHERE gwas_run_id = :run_id
       AND p_value < :gws_threshold
)
SELECT chrom, pos, p_value, snp_id
  FROM thin_representatives
 UNION
SELECT chrom, pos, p_value, snp_id
  FROM gws_bypass
 ORDER BY chrom, pos;
```

**Index fit (Phase 14's actual deployment):**
- Phase 14 shipped `USING BRIN (gwas_run_id, chrom, pos)` per `GwasSchemaProvisioner.php:97-99` — NOT the original CONTEXT D-11 (chrom, pos).
- The Phase 14 deviation (15-RESEARCH L29-31) was intentional: Manhattan queries are **always** scoped by gwas_run_id, so the composite BRIN range-scans the run's variants contiguously. **This is exactly what Phase 16 needs.** BRIN (gwas_run_id, chrom, pos) is the perfect thinning-query index.
- Secondary BTREE on `(cohort_definition_id, p_value)` — not used by this query (we key on gwas_run_id not cohort_definition_id), but will assist if a future filter joins on cohort.

**Data-type gotchas (CRITICAL):**
- `chrom` is `VARCHAR(4)` per provisioner L75. Values include `"1"` … `"22"`, `"X"`, `"Y"`, `"MT"`. NOT integer. FormRequest regex `/^(\d{1,2}|X|Y|MT)$/` matches.
- `pos` is `BIGINT`. Chr1 p-arm telomere ≈ 249,250,621 (fits int32 but use bigint throughout).
- `p_value` is `DOUBLE PRECISION` nullable. PG `NULLS LAST` ordering guards against NULL p_values rising to top.
- `width_bucket(..., hi+1, N)` — the `+1` prevents the max-pos row from falling into the `(N+1)` overflow bucket.

**EXPLAIN expectations on 10M rows:**
- BRIN range-scan on (gwas_run_id=?) range should return ~10M rows in a block-sequential scan: BRIN pages-per-range default = 128, so ~10M/128 = ~78k block visits. Estimated 5-10s on cold cache, <100ms warm (Linux pagecache).
- `width_bucket` + `ROW_NUMBER() OVER (PARTITION BY chrom, bin)` needs a sort, but the partition sort is bounded by chrom × bins = ~25 × 500 = 12,500 partitions → cheap.
- **Expected first-hit timing: 5-10 seconds** per D-02 latency budget. Cached hit: <100ms via Redis JSON decode.

**LOW-CONFIDENCE note:** Latency is _estimated_ — **no 10M-row test dataset exists on DEV today**. Phase 14-06 smoke uses 10k × 361 subjects (per 17-RESEARCH L695). Phase 16 Plan 5 OR Plan 7 should include a "synthetic 1M–10M row fixture" step or acknowledge that first-hit SC-1 evidence is deferred to the Phase 14-07 CHECKPOINT.

### Pattern 2 — Schema Resolution (REUSE from Phase 17)

**What:** A controller receiving `finngen.runs.id` must resolve the `{source}_gwas_results.summary_stats` schema without letting user input interpolate into raw SQL.

**Live precedent:** `backend/app/Http/Controllers/Api/V1/CohortPrsController.php:160-184` (`candidateSchemas()`).

**Adapted for Phase 16 (single-run case):**
```php
// Source: adapted from CohortPrsController::candidateSchemas() + FinnGenGwasRunObserver L132-178
private function resolveSchemaForRun(string $runId): ?string
{
    /** @var \App\Models\App\FinnGen\Run|null $run */
    $run = \App\Models\App\FinnGen\Run::query()->find($runId);
    if ($run === null) {
        return null;  // controller returns 404
    }
    $sourceKey = (string) $run->source_key;

    // Whitelist source_key against registered sources (preventing fake keys).
    $exists = \App\Models\App\Source::query()
        ->where('source_key', $sourceKey)
        ->exists();
    if (! $exists) { return null; }

    $schema = strtolower($sourceKey) . '_gwas_results';

    // Allowlist regex (T-15-10 mitigation; mirrors FinnGenGwasRunObserver.php:137).
    if (preg_match('/^[a-z][a-z0-9_]*$/', $schema) !== 1) {
        return null;
    }

    // Confirm schema exists in PG (defends against a source whose variants were never prepared).
    $hasSchema = \Illuminate\Support\Facades\DB::selectOne(
        'SELECT 1 AS ok FROM information_schema.schemata WHERE schema_name = ? LIMIT 1',
        [$schema]
    );
    return $hasSchema === null ? null : $schema;
}
```

**Ownership check (HIGHSEC §2 third layer):**
```php
if ($run->user_id !== $request->user()->id && ! $request->user()->hasRole(['admin', 'super-admin'])) {
    abort(403, 'Run does not belong to this user.');
}
```

### Pattern 3 — Redis Cache with Immutable Artifact Assumption (D-20, D-28)

**What:** Thinning results are deterministic on `(run_id, bin_count, thin_threshold)`. Because `finngen.runs.id` is a ULID and runs are **append-only** — the only way a run's summary_stats change is via overwrite-dispatch which creates a _new_ run_id — the cache key naturally invalidates.

**Invalidation strategy (D-28 resolved):**
- No explicit bust needed. Phase 15 overwrite creates a new `EndpointGwasRun` with a fresh `run_id` (per `GwasRunService.php` L144-165). Old run's cache entries TTL out at 24h.
- **Edge case:** A failed run whose summary_stats rows were partially loaded then retried could in theory carry stale partial thinning. Check: `FinnGenGwasRunObserver.php:44-80` shows the observer reads `run.status` terminal — a `failed` run has no `top_hit_p_value` (so the cache key for that run is harmless). If a user cancels a running run and re-fetches the Manhattan endpoint, the controller should check `$run->isTerminal()` OR `$run->status === 'succeeded'` before serving; return 202 Accepted for in-flight runs.

**Live pattern:**
```php
use Illuminate\Support\Facades\Cache;

$key = sprintf('finngen:manhattan:%s:thin:%d', $runId, $binCount);
$payload = Cache::remember($key, now()->addHours(24), function () use ($runId, $schema, $binCount, $threshold) {
    return $this->aggregator->thin($schema, $runId, $binCount, $threshold);
});
return response()->json($payload);
```

### Pattern 4 — GENCODE One-Time Artisan (PHP gzopen/gzgets; SSRF-safe)

**What:** Artisan downloads GFF3 from `ftp.ebi.ac.uk` (hard-coded), streams via gunzip, filters to `feature=gene` rows, writes flat TSV.

**Live template:** `backend/app/Console/Commands/FinnGen/LoadPgsCatalogCommand.php:36-60` + `17-RESEARCH §Pattern 1` stream-gunzip example.

```php
final class LoadGencodeGtfCommand extends Command
{
    protected $signature = 'parthenon:load-gencode-gtf
        {--force : Re-download even if local TSV exists}
        {--file= : Local GFF3.gz path (testing only; bypasses download)}';

    private const URL = 'https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_46/gencode.v46.basic.annotation.gff3.gz';
    private const MAX_BYTES = 100 * 1024 * 1024;  // D-29 size guard (100 MB)
    private const OUTPUT_TSV = 'gencode/genes-v46.tsv';

    public function handle(): int
    {
        $gzPath = (string) ($this->option('file') ?? $this->download());
        if (filesize($gzPath) > self::MAX_BYTES) {
            throw new \RuntimeException(sprintf('GFF3 exceeds %d-byte D-29 limit', self::MAX_BYTES));
        }
        $outputPath = storage_path('app/private/' . self::OUTPUT_TSV);
        @mkdir(dirname($outputPath), 0755, recursive: true);
        $out = fopen($outputPath, 'wb');

        $fh = @gzopen($gzPath, 'rb');
        try {
            while (($line = gzgets($fh)) !== false) {
                if ($line === '' || $line[0] === '#') continue;
                // GFF3 columns: seqid, source, type, start, end, score, strand, phase, attributes
                $cols = explode("\t", rtrim($line, "\r\n"));
                if (count($cols) < 9) continue;
                if ($cols[2] !== 'gene') continue;

                $attrs = $cols[8];
                $name = $this->parseAttr($attrs, 'gene_name');
                $type = $this->parseAttr($attrs, 'gene_type');
                if ($name === null) continue;

                $chrom = ltrim($cols[0], 'chr');  // normalize "chr1" → "1" to match summary_stats.chrom
                fwrite($out, implode("\t", [$name, $chrom, $cols[3], $cols[4], $cols[6], $type ?? '']) . "\n");
            }
        } finally { gzclose($fh); fclose($out); }
        return self::SUCCESS;
    }

    private function parseAttr(string $attrs, string $key): ?string
    {
        // GFF3 attr format: key1=val1;key2=val2  (NOTE: GTF uses `key "val";`, GFF3 uses `key=val;`)
        if (preg_match('/(?:^|;)\s*' . preg_quote($key, '/') . '=([^;]+)/', $attrs, $m) === 1) {
            return trim($m[1]);
        }
        return null;
    }
    // ... download() mirrors 17-RESEARCH §Pattern 1 (Http::timeout(600)->withOptions(['sink' => $tmp]))
}
```

**GENCODE v46 format notes (CRITICAL):**
- `gencode.v46.basic.annotation.gff3.gz` is **GFF3**, NOT GTF. Attribute syntax is `key=val;key2=val2` (NOT `key "val";`).
- The GTF companion file (`.gtf.gz`) exists at 29MB if GTF is easier. **Recommend GFF3** — the `gene_type=protein_coding` attribute shape is well-documented.
- Chromosomes in GENCODE are `chr1..chr22`, `chrX`, `chrY`, `chrM`. Parthenon's summary_stats uses `"1"..."22"`, `"X"`, `"Y"`, `"MT"` (no "chr" prefix). **Strip `chr` and map `M` → `MT`** at parse time.
- **Memory budget:** 60k gene entries × ~100 bytes TSV = ~6MB final file. PHP memory during parse stays under 20MB because of line-at-a-time gzgets.
- **Batch size:** N/A — direct TSV write, no DB upsert.

**Idempotency:** `--force` flag overwrites the TSV. Without `--force`, command exits 0 if TSV exists with mtime < 30 days (configurable). Size-check + atomic rename pattern (`write to .tmp → rename → unlink gz`).

### Pattern 5 — GencodeService (singleton in-memory scan)

**What:** Load TSV once per PHP-FPM worker lifetime, scan linearly for each range query.

**Rationale:** 60k rows × 6 columns in memory ≈ 5MB. Linear scan for `WHERE chrom=? AND start < ? AND end > ?` is O(n) = 60k comparisons per request = <1ms. No need for more sophisticated indexing.

```php
final class GencodeService
{
    private static ?array $genes = null;  // [['gene_name', 'chrom', 'start', 'end', 'strand', 'gene_type'], ...]

    public function findGenesInRange(string $chrom, int $start, int $end): array
    {
        self::$genes ??= $this->load();
        $out = [];
        foreach (self::$genes as $g) {
            if ($g['chrom'] !== $chrom) continue;
            if ($g['start'] > $end || $g['end'] < $start) continue;
            $out[] = $g;
        }
        return $out;
    }

    private function load(): array { /* read TSV from storage_path('app/private/gencode/genes-v46.tsv') */ }
}
```

Register in AppServiceProvider as singleton:
```php
$this->app->singleton(GencodeService::class);
```

### Pattern 6 — ManhattanPlot extend-in-place with hook extraction (RECOMMENDED)

**What:** Extract the useEffect body (L114-311) into a `useManhattanCanvas(canvasRef, points, options)` hook. Both consumers (existing catalog-upload + new gwas-run) pass their reshaped data.

**Current shape (gwas-catalog upload):**
```ts
// existing: ManhattanPlotProps.data: Array<{ chr: string; pos: number; p: number }>
```

**New shape (live GWAS run):**
```ts
// new payload (D-04): { variants: [{chrom, pos, neg_log_p, snp_id?}], genome: {chrom_offsets}, thinning: {...} }
// reshape in useManhattanData hook:
const points = payload.variants.map(v => ({
  chr: v.chrom,
  pos: v.pos,
  p: Math.pow(10, -v.neg_log_p),  // IF existing ManhattanPlot expects raw p
  // OR rewrite the hook to accept { chr, pos, negLogP } directly
}));
```

**Planner decision:** The existing `prepareData()` (L44-97) computes `negLogP` from `p`. Skipping that conversion saves CPU. **Recommend:** add an optional `negLogP?: number` field to `ManhattanPlotProps.data[]` items; if present, use it directly. This is a 2-line change and keeps backward compat with catalog-upload.

**Current performance thinning (to REMOVE):** L147-149:
```ts
if (allPoints.length > 500_000) {
    points = allPoints.filter((d) => d.negLogP >= 1);
}
```
This client-side thinning is obsolete for the gwas-run path — the server already returned <150k thinned rows. Gate with `props.preThinned?: boolean`.

### Pattern 7 — Workbench Pill (frontend-only, 50 LOC)

**Writer (already-shipped, verified):** `frontend/src/features/finngen-endpoint-browser/hooks/useEndpoints.ts:57-85` — `useOpenInWorkbench` posts `session_state.seeded_from = {kind: 'finngen-endpoint', endpoint_name}` at session creation.

**Reader (Phase 16):**
```tsx
// frontend/src/features/finngen-workbench/components/FinnGenSeededPill.tsx
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

type SeededFrom = { kind: "finngen-endpoint"; endpoint_name: string } | { kind: unknown };

export function FinnGenSeededPill({ seededFrom }: { seededFrom: unknown }) {
  if (!isFinnGenEndpointSeed(seededFrom)) return null;
  return (
    <Link
      to={`/workbench/finngen-endpoints?open=${encodeURIComponent(seededFrom.endpoint_name)}`}
      className="inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-medium"
      style={{
        borderColor: "#C9A227",  // D-15 gold
        backgroundColor: "rgba(155, 27, 48, 0.10)",  // D-15 crimson/10
        color: "#9B1B30",
      }}
      aria-label={`Seeded from FinnGen endpoint ${seededFrom.endpoint_name}`}
    >
      <Sparkles size={12} aria-hidden="true" />
      From FinnGen {seededFrom.endpoint_name}
    </Link>
  );
}

function isFinnGenEndpointSeed(v: unknown): v is { kind: "finngen-endpoint"; endpoint_name: string } {
  return (
    typeof v === "object" && v !== null &&
    (v as { kind?: unknown }).kind === "finngen-endpoint" &&
    typeof (v as { endpoint_name?: unknown }).endpoint_name === "string"
  );
}
```

**Insertion point:** `frontend/src/features/finngen-workbench/pages/WorkbenchPage.tsx` around L127-137 (inside the header block, next to the existing `<span>{session.source_key}</span>`):
```tsx
<div className="flex items-center gap-2">
  <h1 className="truncate text-lg font-semibold text-text-primary">{session.name}</h1>
  <span className="inline-flex shrink-0 items-center rounded bg-info/10 ...">{session.source_key}</span>
  <FinnGenSeededPill seededFrom={(sessionState as Record<string, unknown>).seeded_from} />
</div>
```

**NOTE on route target:** D-13 says "link back to the endpoint browser detail drawer". Drawer is opened via `?open={name}` query param on `/workbench/finngen-endpoints` (or similar — planner verifies against `FinnGenEndpointBrowserPage.tsx`). If no such mechanism exists, fall back to `/workbench/finngen-endpoints` (list page). **Open Question in §Open Questions.**

### Anti-Patterns to Avoid

- **Don't SSRF-unsafe the GENCODE URL.** Hard-code in a class constant; reject `--file=path` that isn't under `storage_path('app/private/')`.
- **Don't load the whole 60MB GFF3 into a PHP string with `file_get_contents` + `gzdecode`.** PHP memory explodes past ~300MB; use `gzopen`/`gzgets`.
- **Don't use `where('gwas_run_id', $id)` unvalidated.** `Run::find($id)` validates ULID + 404 before anything hits the big BRIN.
- **Don't call `DB::connection('pgsql_testing')` in controllers.** The `pgsql_testing` connection is test-only; all controllers use the default `pgsql` connection which routes via `search_path`.
- **Don't cache `{run_id, thin=N}` if run status is NOT terminal.** Short-circuit: `if (! $run->isTerminal()) return response()->json([...], 202);` BEFORE calling `Cache::remember`.
- **Don't assume TanStack Table has a drawer primitive.** It doesn't. Couple `useReactTable` with a `useState<Variant | null>` for the active-row.
- **Don't `response()->json(['variants' => ...])` a 10MB payload without gzip.** Laravel's middleware `CompressResponse` (or nginx `gzip on`) handles this, but confirm the stack is compressing. At 5MB raw → ~1-2MB over wire.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-chromosome thinning algorithm | Manual loop in PHP | PG `width_bucket` + `ROW_NUMBER()` OVER PARTITION | Pure PG does bin-assignment + min-p-per-bin in one pass. PHP-side would need to load 10M rows. |
| Ordered result cache | Custom Redis wrapper | `Cache::remember` (Laravel facade over Redis) | Already wired to the default Redis connection (D-21). Handles JSON encode/decode. |
| Schema resolution (run_id → {source}_gwas_results) | Inline SQL concat | Mirror `CohortPrsController::candidateSchemas()` | Phase 17 precedent — regex allow-list + information_schema existence check. |
| GFF3 parser | Regex the whole file | `gzgets` + split on tab + attribute regex | 100-line idiomatic PHP matches Phase 17 PGS Catalog parser. |
| Sortable top-50 table | Manual `useState<'p_value' \| 'beta' \| ...>` | TanStack Table `useReactTable` with columnDef | Already installed; first consumer; 10 LOC vs 30. |
| DPR / retina canvas scaling | Manual canvas.width × dpr math in every component | Reuse existing `ManhattanPlot.tsx:122-127` pattern | Already correct; don't re-implement. |
| Error boundary per panel | New component | `frontend/src/components/ErrorBoundary.tsx` with `fallback` prop | Shipped; supports scoped fallbacks. |

**Key insight:** Phase 16 is almost entirely composition of Phase 14 + 15 + 17 primitives. The ONE genuinely new piece is the thinning SQL — and it's a single CTE.

## Runtime State Inventory

Phase 16 is **not** a rename/refactor phase (ships net-new UI + 4 new read-only endpoints + 1 one-time Artisan). Runtime State Inventory omitted per RESEARCH protocol §2.5 skip condition.

## Common Pitfalls

### Pitfall 1 — Chromosome string normalization between sources

**What goes wrong:** summary_stats stores chromosomes as `VARCHAR(4)` with values `"1".."22"`, `"X"`, `"Y"`, `"MT"`. GENCODE GFF3 emits `"chr1".."chr22"`, `"chrX"`, `"chrY"`, `"chrM"`. Frontend d3 `chrToNum()` (ManhattanPlot.tsx:21-27) already strips `^chr` — good — but the regional-view controller joining `summary_stats.chrom` to `GencodeService` output must normalize both.

**How to avoid:** Canonical form = no prefix, `"MT"` for mito (matches summary_stats). Normalize at GENCODE parse time (Pattern 4's `ltrim($cols[0], 'chr')` + `$cols[0] === 'M' ? 'MT' : ...`).

**Warning signs:** Regional view shows 0 genes despite variants being present. Log: `chrom = "1"` on query, `chrom = "chr1"` in GENCODE TSV.

### Pitfall 2 — Cross-connection transaction poisoning on schema probe

**What goes wrong:** `GwasManhattanController` resolves `{source}_gwas_results` from user input, then runs the thinning query on the default `pgsql` connection. If the schema does NOT exist (e.g., Phase 14 provisioner never ran for that source), the `SELECT ... FROM {schema}.summary_stats` fails, poisoning the outer request transaction with SQLSTATE 25P02 (CLAUDE.md Gotcha #12).

**How to avoid:** Mirror `FinnGenGwasRunObserver.php:150-178` — wrap the dynamic-schema query in an explicit `beginTransaction()` / `commit()` / `rollBack()` block on a dedicated connection. OR (cleaner) always check schema existence via `information_schema.schemata` BEFORE the SELECT, which is what `CohortPrsController::candidateSchemas()` L176-181 does.

**Recommendation:** Use the existence-check approach for Phase 16 — simpler than savepoints.

### Pitfall 3 — In-flight run returns empty summary_stats → user sees blank Manhattan

**What goes wrong:** User clicks a GWAS run that's still `queued` or `running`. summary_stats has 0 rows. Controller returns `{variants: []}`. Frontend shows empty chart.

**How to avoid:** Short-circuit BEFORE the thinning SQL:
```php
if ($run->status === Run::STATUS_QUEUED) { return response()->json([...], 202)->header('Retry-After', '30'); }
if ($run->status === Run::STATUS_RUNNING) { return response()->json([...], 202)->header('Retry-After', '30'); }
if ($run->status === Run::STATUS_FAILED) { return response()->json(['error' => 'Run failed'], 410); }
if ($run->status !== Run::STATUS_SUCCEEDED) { return response()->json(['error' => 'Run not ready'], 409); }
```

Frontend (D-14 empty-state per Claude's Discretion): render EmptyState with polling + Retry-After hint.

### Pitfall 4 — ManhattanPlot performance thinning interferes with server thinning

**What goes wrong:** Existing `ManhattanPlot.tsx:147-149` filters points with `negLogP < 1` if total > 500k. With server-thinned data (~100k rows), this filter kicks in ONLY if the aggregator emits too many GWS-bypass rows (unusual). But the filter silently hides low-negLogP data that's intentionally part of the thinning representative set — distorting the visual.

**How to avoid:** Add `preThinned?: boolean` prop; bypass the client-side `negLogP >= 1` filter when true.

### Pitfall 5 — Canvas click-hit with large point counts degrades to O(n)

**What goes wrong:** `ManhattanPlot.tsx:328-339` iterates all points for each click. At 100k points per click, this is 100k `Math.hypot` calls = ~10ms on a decent machine. Tolerable but not instant.

**How to avoid (v1):** Accept the O(n) for Phase 16 — click rate is low (once per peak). Log a Phase 16.x spatial index follow-up (kd-tree or simple grid bucket).

### Pitfall 6 — Top-variants endpoint hits wrong index

**What goes wrong:** The query `ORDER BY p_value ASC LIMIT 50 WHERE gwas_run_id = ?` uses the BRIN (gwas_run_id, chrom, pos) to range-scan by run, but must then SORT all ~10M rows by p_value. Slow.

**How to avoid:** There IS a BTREE `(cohort_definition_id, p_value)` per provisioner L102-105. Augment the query:
```sql
-- Instead of: WHERE gwas_run_id = ?
-- Use the BTREE by including cohort_definition_id:
WITH run AS (SELECT cohort_definition_id FROM finngen.runs_ext_view WHERE id = ? LIMIT 1)
SELECT ss.* FROM {schema}.summary_stats ss, run
 WHERE ss.cohort_definition_id = run.cohort_definition_id
   AND ss.gwas_run_id = ?
 ORDER BY ss.p_value ASC
 LIMIT 50;
```

**BUT:** `finngen.runs` does NOT carry `cohort_definition_id` directly (params JSONB does, per `Run.php:25`). Either extract from `run.params['cohort_definition_id']` OR join `finngen.endpoint_gwas_runs` → use `control_cohort_id` (wrong — that's the CONTROL cohort). **Actually, summary_stats' cohort_definition_id is the case-cohort id** — which Phase 15's `EndpointGwasRun` doesn't directly surface.

**Recommendation:** Read `$run->params['cohort_definition_id']` (or equivalent Phase 15 param) and include it in the WHERE clause. Planner verifies Phase 15 param shape. If unreliable, accept BRIN-only scan + sort (still <100ms on cached pages for 10M rows).

**LOW-CONFIDENCE:** need to verify `Run.params` JSONB key name for cohort_definition_id. Could be `cohort_definition_id`, `case_cohort_id`, or similar.

### Pitfall 7 — GENCODE gene track returns 5000 "pseudogene" noise

**What goes wrong:** GFF3 `gene_type=pseudogene` includes ~14k pseudogenes that clutter the regional view. Clinician-valuable genes are `gene_type=protein_coding` (~19k) + `gene_type=lincRNA` / `miRNA` (a few thousand each).

**How to avoid:** Filter at Artisan parse time OR at query time. **Recommend query-time** filter default `gene_type IN ('protein_coding', 'lincRNA', 'miRNA')` with optional `?include_pseudogenes=1` override.

**Warning signs:** Regional view shows 50+ gene rects in a 1Mb window → overwhelming.

### Pitfall 8 — TanStack Table v8 ESM imports

**What goes wrong:** `@tanstack/react-table` v8 ships ESM-only. With Vite 7 (per package.json) this is fine, but tests via Vitest need `deps.inline` if a transitive CJS boundary tries to require it. Parthenon's vitest.config.ts (planner verifies) may need an update.

**How to avoid:** Confirm first usage compiles via `npx vite build` before committing. Live pattern: use `createColumnHelper` + `useReactTable` + `flexRender` — 3 imports.

### Pitfall 9 — First-hit thinning > 10s in production

**What goes wrong:** On a cold Postgres page cache (fresh container restart, no recent GWAS query), the BRIN range-scan over 10M rows can take 15-20 seconds — beyond D-02's 5-10s expectation. User hits 30s nginx timeout OR gives up.

**How to avoid (layered):**
1. Set controller response timeout to 30s (documented in `nginx.conf` `proxy_read_timeout`).
2. After a successful first hit, the Redis cache serves <100ms indefinitely (until 24h TTL).
3. Optional: `parthenon:warmup-manhattan-cache {run_id}` Artisan (deferred, not in scope).
4. Frontend: TanStack Query's `staleTime: Infinity` + optimistic loading spinner for 30s.

**Warning signs:** SC-1 fails the "<3s render" bar on real 10M data. Remediation: accept longer first-hit with cache-warmup on GWAS run completion (the observer can pre-warm post-SUCCEEDED).

**LOW-CONFIDENCE:** as above — no 10M-row corpus exists on DEV today. Flag as Open Question Q4.

## Code Examples

### Example 1 — Controller: GwasManhattanController::show (thinned)

```php
<?php

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Http\Requests\FinnGen\ManhattanQueryRequest;
use App\Models\App\FinnGen\Run;
use App\Services\FinnGen\ManhattanAggregationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

final class GwasManhattanController extends Controller
{
    public function __construct(
        private readonly ManhattanAggregationService $aggregator,
    ) {}

    public function show(ManhattanQueryRequest $request, string $runId): JsonResponse
    {
        /** @var Run $run */
        $run = Run::query()->findOrFail($runId);

        // HIGHSEC §2 ownership — layer 3.
        $user = $request->user();
        if ($run->user_id !== $user->id && ! $user->hasRole(['admin', 'super-admin'])) {
            abort(403);
        }

        // Pitfall 3 — in-flight short-circuit.
        if ($run->status === Run::STATUS_QUEUED || $run->status === Run::STATUS_RUNNING) {
            return response()->json([
                'status' => $run->status, 'run_id' => $runId, 'message' => 'Run is still processing',
            ], 202)->header('Retry-After', '30');
        }
        if ($run->status !== Run::STATUS_SUCCEEDED) {
            abort(410, "Run status: {$run->status}");
        }

        $binCount = (int) $request->validated('bin_count', 100);
        $threshold = (float) $request->validated('thin_threshold', 5e-8);

        $schema = $this->aggregator->resolveSchemaForRun($run);
        if ($schema === null) {
            abort(404, 'No GWAS results schema for this run');
        }

        $key = sprintf('finngen:manhattan:%s:thin:%d', $runId, $binCount);
        $payload = Cache::remember($key, now()->addHours(24), fn () =>
            $this->aggregator->thin($schema, $runId, $binCount, $threshold)
        );

        return response()->json($payload);
    }
}
```

### Example 2 — FormRequest: ManhattanQueryRequest

```php
<?php

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

final class ManhattanQueryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('finngen.workbench.use') ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            // D-27: clamp bin_count 10-500.
            'bin_count'       => ['nullable', 'integer', 'min:10', 'max:500'],
            'thin_threshold'  => ['nullable', 'numeric', 'between:1e-10,1e-2'],
        ];
    }
}
```

### Example 3 — Region endpoint FormRequest

```php
final class ManhattanRegionQueryRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->can('finngen.workbench.use') ?? false; }
    public function rules(): array
    {
        return [
            'chrom' => ['required', 'string', 'regex:/^(\d{1,2}|X|Y|MT)$/'],
            'start' => ['required', 'integer', 'min:1', 'max:300000000'],
            'end'   => ['required', 'integer', 'min:1', 'max:300000000', 'gt:start'],
        ];
    }
    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'chrom.regex' => 'chrom must be 1-22, X, Y, or MT',
        ];
    }
    public function after(): array
    {
        return [
            function ($validator): void {
                $s = (int) $this->input('start'); $e = (int) $this->input('end');
                if (($e - $s) > 2_000_000) {
                    $validator->errors()->add('end', 'window cannot exceed 2,000,000 bp');
                }
            },
        ];
    }
}
```

### Example 4 — TanStack Table setup for top-50 variants

```tsx
// frontend/src/features/finngen-endpoint-browser/components/gwas-results/TopVariantsTable.tsx
import { useState, useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";

export interface TopVariantRow {
  chrom: string; pos: number; ref: string; alt: string;
  af: number | null; beta: number | null; se: number | null;
  p_value: number; snp_id: string | null; gwas_run_id: string;
}

const columnHelper = createColumnHelper<TopVariantRow>();

const columns = [
  columnHelper.accessor("chrom", { header: "Chr", cell: (i) => i.getValue() }),
  columnHelper.accessor("pos",   { header: "Pos", cell: (i) => i.getValue().toLocaleString() }),
  columnHelper.accessor("ref",   { header: "Ref" }),
  columnHelper.accessor("alt",   { header: "Alt" }),
  columnHelper.accessor("af",    { header: "AF",   cell: (i) => (i.getValue() ?? NaN).toFixed(4) }),
  columnHelper.accessor("beta",  { header: "β",    cell: (i) => (i.getValue() ?? 0).toFixed(3) }),
  columnHelper.accessor("se",    { header: "SE",   cell: (i) => (i.getValue() ?? 0).toFixed(3) }),
  columnHelper.accessor("p_value", {
    header: "P",
    cell: (i) => i.getValue() < 1e-300 ? "<1e-300" : i.getValue().toExponential(2),
  }),
];

export function TopVariantsTable({ rows, onRowClick }: { rows: TopVariantRow[]; onRowClick: (r: TopVariantRow) => void }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "p_value", desc: false }]);
  const table = useReactTable({
    data: rows, columns,
    state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
  });
  return (
    <table className="w-full text-xs">
      {/* ... flexRender headers + rows with onClick={() => onRowClick(row.original)} ... */}
    </table>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PheWeb Python+Flask server | Canvas + d3 + server-thinned PG payload | This phase | Eliminates a new Python runtime boundary. |
| SVG Manhattan | Canvas | Phase 16 CONTEXT (D-01) | Required for 10M→100k thinned render in <3s. |
| Pre-compute Manhattan in R worker | Lazy PG thinning + Redis cache | Phase 16 CONTEXT (D-02) | Trades 5-10s first-hit for zero pre-compute overhead. |
| Recharts for GWAS | Canvas + d3 for variants; Recharts only for PRS histograms (Phase 17) | Phase 16 | Canvas is needed once variant counts > ~5k (Recharts chokes). |
| TanStack Table unused | First consumer in Phase 16 | Phase 16 | Sets precedent for future sortable tables. |

**Deprecated/outdated:**
- Nothing deprecated by Phase 16 — all changes are additive.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BRIN (gwas_run_id, chrom, pos) range-scan completes in 5-10s on 10M real rows | Pattern 1 EXPLAIN expectations | MEDIUM — no 10M corpus exists today to verify. Mitigated by 24h Redis cache on warm path. |
| A2 | `Run.params['cohort_definition_id']` carries the case cohort id (Phase 15) | Pitfall 6 | MEDIUM — need to verify exact key name by grepping `params['cohort_definition_id']` in `GwasRunService`. |
| A3 | `@tanstack/react-table` v8 imports cleanly under Vite 7 without vitest deps.inline | Pitfall 8 | LOW — v8 is well-established; first import will surface any issue via `npx vite build`. |
| A4 | `frontend/src/features/finngen-workbench/pages/WorkbenchPage.tsx` is the canonical session-detail page | Pattern 7 | LOW — verified by grep (router.tsx:346-351) and file content. |
| A5 | The endpoint detail drawer at `/workbench/finngen-endpoints?open={name}` exists and accepts the `open` query param | Pattern 7 pill link target | MEDIUM — planner verifies `FinnGenEndpointBrowserPage.tsx` drawer wiring. If absent, fall back to list page. |
| A6 | GENCODE v46 `gene` features parse cleanly from GFF3 without edge cases (duplicate names, missing gene_type) | Pattern 4 | LOW — well-established format; edge cases (a gene name appearing twice under different Ensembl IDs) handled by accepting duplicates and filtering at query time. |
| A7 | nginx/Apache already gzips JSON responses so 5MB raw payload → ~1-2MB wire | §Summary | LOW — standard. Planner verifies `docker/nginx/*.conf` has `gzip on` for `application/json`. |
| A8 | Redis cache invalidation via ULID immutability — overwrite-dispatch creates a fresh run_id | Pattern 3 | LOW — verified by `GwasRunService.php:144-165` + Phase 15 observer. |
| A9 | 10M SNP thin→100k result → ~5MB JSON payload at ~50 bytes/row | §Summary + §Open Questions Q3 | LOW — 100k × {chrom:2, pos:10, neg_log_p:5, snp_id?:12} ≈ 30-60 bytes/row serialized. Fits. |

**8 of 9 assumptions LOW risk.** A1, A2, A5 are MEDIUM — the first two resolvable by Plan 1 grep + Plan 5 smoke; A5 resolvable by a 10-minute code inspection before Plan 4.

## Open Questions (RESOLVED)

> All 10 questions resolved. Mix of planner-locked decisions and items deferred to specific plan tasks. Dimension 11 gate: every item below carries an explicit RESOLVED marker.

### Q1. **Extend ManhattanPlot.tsx in-place OR copy?** — **RESOLVED (recommend extend)**
- **What we know:** Existing 364 LOC already does Canvas + d3 + DPR exactly as approved; catalog-upload path exists. New gwas-run path shares 95% of drawing code.
- **Recommendation:** Extract the useEffect body into `useManhattanCanvas()` hook. Both consumers pass their reshaped points. Adds `preThinned?: boolean` + optional `negLogP?: number` field. Net LOC change: +40, -20, no copy.
- **Planner locks:** Plan 2 (or 3) Task 1 does the hook extraction; Plan 3 Task 2 wires the new data source.

### Q2. **Top-50 table tech: TanStack vs plain `<table>`?** — **RESOLVED (recommend TanStack)**
- **What we know:** `@tanstack/react-table ^8.21.3` is installed but unused. Phase 16 is the first consumer.
- **Recommendation:** TanStack Table. ~60 LOC vs ~100 LOC manual. Sets convention for future sortable tables.
- **Risk:** Vite 7 ESM — verify with `npx vite build` before committing.

### Q3. **Payload size over the wire** — **RESOLVED (verified)**
- **What we know:** 100k × ~40 bytes/row JSON ≈ 4 MB raw → ~1 MB gzipped. Within the 8MB D-02 budget with 2x margin.
- **Planner locks:** No special handling needed. Standard gzip middleware suffices.

### Q4. **First-hit thinning latency on real 10M-row data** — **RESOLVED (deferred to Plan 16-07 Task 1 — use Phase 15 live dispatch in lieu of synthetic fixture Artisan; 10M-row SLO verified post-cutover on real data if available, otherwise documented gap in DEPLOY-LOG)**
- **What we know:** Phase 14 smoke is 10k × 361 subjects only. No 10M corpus exists.
- **What's unclear:** Real 10M-row BRIN+ROW_NUMBER performance.
- **Recommendation:** Plan 7 (CHECKPOINT) includes a synthetic 1M-row fixture generator. SC-1 "<3s render" evidence is **warm-cache** (Redis hit); cold-cache latency documented as a performance SLO.
- **Planner locks:** Plan 1 adds a fixture generator Artisan `finngen:seed-synthetic-gwas {source} {rows}` (optional, behind a flag).

### Q5. **Workbench session attribution link target** — **RESOLVED (deferred to Plan 16-06 Task 1 — grep for endpoint browser drawer URL format performed inline during implementation)**
- **What we know:** D-13 says link to "endpoint browser detail drawer". Drawer mechanism in `FinnGenEndpointBrowserPage.tsx` uses `?open={name}` query param (candidate — verify).
- **Recommendation:** Plan 6 Task 1 verifies the drawer open mechanism; if `?open` works, use it; else fall back to `/workbench/finngen-endpoints` list.
- **Planner locks:** Plan 6 Task 1 is a grep+verification step.

### Q6. **Pitfall 6 cohort_definition_id key in Run.params** — **RESOLVED (deferred to Plan 16-01 Task 2 — grep Run.params cohort_definition_id key during ManhattanAggregationService implementation)**
- **What we know:** `Run.params['cohort_definition_id']` is the likely key but Phase 15 may use a different name.
- **Recommendation:** Plan 4 Task 1 greps `GwasRunService.php` for `'cohort_definition_id'` + `'case_cohort_id'` to confirm key name before writing the top-variants query.
- **Planner locks:** If the key exists, use it to improve top-variants query performance; if not, accept BRIN-only scan + sort.

### Q7. **Controller returns 202 for in-flight runs** — **RESOLVED**
- **Recommendation:** 202 Accepted + `Retry-After: 30` header for `queued` / `running`. 410 Gone for `failed`. 409 Conflict for other non-terminal. `$run->isTerminal()` guard + explicit status-enum switch.
- **Planner locks:** Pattern 1 example includes the exact switch.

### Q8. **React Error Boundary per panel** — **RESOLVED**
- **Recommendation:** Wrap each of Manhattan / Regional / TopVariants in the existing `<ErrorBoundary fallback={...}>`. Use feature-specific fallback messages.
- **Planner locks:** Plan 4/5 Task N specifies 3 ErrorBoundary wrappers in FinnGenGwasResultsPage.tsx.

### Q9. **Canvas a11y** — **RESOLVED (minimum viable)**
- **Recommendation:** Add `role="img"` + dynamic `aria-label` summarizing stats: `"Manhattan plot: {thinning.variant_count_before} variants, {gwsCount} genome-wide significant, top peak at chr{top.chrom}:{top.pos.toLocaleString()}, p={top.p.toExponential(2)}"`. A11y floor — no per-variant tab navigation in v1.
- **Planner locks:** Plan 3 Task 1 adds the aria-label to the Canvas element.

### Q10. **Test fixture strategy for Manhattan thinning correctness** — **RESOLVED**
- **Recommendation:** Pest factory generates 5,000 synthetic rows with known p-value minima per bin. Assert that thinned output includes exactly one row per (chrom, bin) plus all GWS-threshold rows.
- **Planner locks:** Plan 1 `ManhattanAggregationServiceTest.php` uses factory with fixed seed.

## Environment Availability

Live-verified against DEV `beastmode:parthenon` (host PG17 via claude_dev) on 2026-04-17:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| **d3** | Manhattan / Regional / GeneTrack | ✓ | ^7.9.0 | — |
| **@tanstack/react-table** | TopVariantsTable | ✓ | ^8.21.3 | Plain `<table>` |
| **lucide-react** | Pill icon | ✓ | ^0.577.0 | Inline SVG |
| **Redis (default connection)** | D-20 cache | ✓ | 7.x (docker-compose.yml) | Compute every request (slow) |
| **`{source}_gwas_results.summary_stats`** | D-02 thinning SQL source | ✓ for PANCREAS | Phase 14-05 smoke: 10k rows × 361 subjects | — (Plan 7 fixture for 1M+ scale) |
| **BRIN (gwas_run_id, chrom, pos)** | Thinning index | ✓ | `summary_stats_run_chrom_pos_brin` (Phase 14 provisioner) | Would still complete, just slower |
| **ErrorBoundary component** | Panel-scoped fallbacks | ✓ | `frontend/src/components/ErrorBoundary.tsx` | — |
| **EmptyState component** | Empty Manhattan / in-flight | ✓ | Existing stub uses it | — |
| **GENCODE FTP (ftp.ebi.ac.uk)** | Artisan download | ✓ | TLS+HTTPS mirror verified | Local `--file=` override |
| **parthenon_app SELECT on {source}_gwas_results.summary_stats** | Read-only controller access | ✓ | HIGHSEC §4.1 grants from Phase 14 provisioner L110-124 | — |
| **10M-row synthetic GWAS fixture** | Cold-cache latency validation | ✗ | — | Accept "warm-cache" SC-1 evidence; document SLO |
| **Admin + researcher user** | Pest + E2E tests | ✓ | admin@acumenus.net + researcher seed user | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- 10M-row fixture — Plan 7 CHECKPOINT accepts warm-cache SC-1 evidence + documents cold-cache latency as SLO.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Pest 3.x over PHPUnit 11 (PHP backend); Vitest (frontend); Playwright (E2E SC-1 perf) |
| Config file | `backend/phpunit.xml`, `frontend/vitest.config.ts`, `e2e/playwright.config.ts` |
| Quick run command | `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen/GwasManhattanControllerTest.php --no-coverage` |
| Full suite command | `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen tests/Unit/FinnGen --no-coverage` + `docker compose exec -T node sh -c "cd /app && npx vitest run"` |

### Phase Requirements → Test Map

| SC / Req | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|--------------|
| **SC-1 / GENOMICS-04** (Manhattan endpoint shape + thinning correctness) | `GET /api/v1/finngen/runs/{id}/manhattan?thin=100` returns `{variants, genome, thinning}` envelope; 50k-150k rows per D-03 | feature + unit | `pest tests/Feature/FinnGen/GwasManhattanControllerTest.php -x` | ❌ Wave 0 |
| **SC-1 / GENOMICS-04** (thinning algorithm: GWS bypass) | Unit test: factory seeds rows with min p in bin 5, GWS row in bin 3 → output contains bin-5 rep AND GWS row (2 rows, not 1) | unit | `pest tests/Unit/FinnGen/ManhattanAggregationServiceTest.php -x` | ❌ Wave 0 |
| **SC-1 / GENOMICS-04** (<3s render warm-cache) | Playwright spec: second visit to /workbench/finngen-endpoints/E4_DM2/gwas/{runId} renders canvas + first 10k dots within 3000ms | E2E | `npx playwright test e2e/tests/phase-16-manhattan-perf.spec.ts` | ❌ Wave 5 |
| **SC-1 / GENOMICS-04** (in-flight run 202) | `queued` / `running` run → 202 + Retry-After header | feature | `pest tests/Feature/FinnGen/GwasManhattanControllerTest.php --filter 'in_flight'` | ❌ Wave 0 |
| **SC-2 / GENOMICS-04** (regional endpoint window) | `GET /api/v1/finngen/runs/{id}/manhattan/region?chrom=17&start=45000000&end=46000000` returns full-resolution rows in window; clamps windows > 2Mb | feature | `pest tests/Feature/FinnGen/GwasManhattanRegionTest.php -x` | ❌ Wave 0 |
| **SC-2 / GENOMICS-04** (gene-track endpoint) | `GET /api/v1/gencode/genes?chrom=17&start=45000000&end=46000000` returns ≥1 gene (BRCA1 @ 43k-44k won't hit but NF1 @ 31k-34k or similar will); Artisan-loaded TSV is source of truth | feature | `pest tests/Feature/GencodeControllerTest.php -x` | ❌ Wave 0 |
| **SC-2 / GENOMICS-04** (RegionalView SVG genes render) | Vitest: RegionalView renders N SVG `<rect>` gene elements with correct start/end | unit | `vitest run src/features/finngen-endpoint-browser/components/gwas-results/__tests__/RegionalView.test.tsx` | ❌ Wave 0 |
| **SC-3 / GENOMICS-04** (top-50 endpoint sort + limit) | `GET /api/v1/finngen/runs/{id}/top-variants?sort=p_value&dir=asc&limit=50` returns 50 rows sorted ascending; dir=desc flips; invalid sort → 422 | feature | `pest tests/Feature/FinnGen/TopVariantsControllerTest.php -x` | ❌ Wave 0 |
| **SC-3 / GENOMICS-04** (top-50 drawer shape) | Vitest: TopVariantsTable renders all 10 drawer fields; clicking a row opens VariantDrawer with correct row data | unit | `vitest run src/features/finngen-endpoint-browser/components/gwas-results/__tests__/TopVariantsTable.test.tsx` | ❌ Wave 0 |
| **SC-4 / GENOMICS-13** (workbench pill renders when seeded) | Vitest: `<WorkbenchPage>` with `session_state.seeded_from = {kind: 'finngen-endpoint', endpoint_name: 'E4_DM2'}` renders pill text "From FinnGen E4_DM2" with href to `/workbench/finngen-endpoints?open=E4_DM2` | unit | `vitest run src/features/finngen-workbench/components/__tests__/FinnGenSeededPill.test.tsx` | ❌ Wave 0 |
| **SC-4 / GENOMICS-13** (pill omitted when not seeded) | Vitest: pill does NOT render when `seeded_from` absent or `kind !== 'finngen-endpoint'` | unit | same file, `--filter 'omitted'` | ❌ Wave 0 |
| **invariant** (HIGHSEC §2 — routes guarded) | All 4 new routes carry `auth:sanctum` + permission middleware; viewer without finngen.workbench.use gets 403; unauthenticated gets 401 | feature | `pest tests/Feature/FinnGen/ManhattanRoutePermissionTest.php -x` | ❌ Wave 0 |
| **invariant** (T-16-S1 thinning bypass) | `?thin=1` → 422 (bin_count must be 10-500) | feature | `GwasManhattanControllerTest.php --filter 'bin_count_clamp'` | ❌ Wave 0 |
| **invariant** (T-16-S3 GENCODE size limit) | LoadGencodeGtfCommand with 101MB fixture → throws RuntimeException | feature | `pest tests/Feature/FinnGen/LoadGencodeGtfCommandTest.php --filter 'size_limit'` | ❌ Wave 0 |
| **invariant** (D-28 cache key scoping) | Manual grep: `finngen:manhattan:{runId}:*` never includes user-controlled chrom/start/end | static | grep-based test in Plan 7 | automated via `rg` in Plan 7 |

### Sampling Rate

- **Per task commit:** `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen/{TheOneFileYouTouched}.php --no-coverage` (~10s) + `docker compose exec -T node sh -c "cd /app && npx vitest run --changed"` (~15s)
- **Per wave merge:** Full Pest FinnGen suite + full Vitest (~3min)
- **Phase gate:** Full Pest + Vitest green, Playwright perf spec under 3s on warm cache against DEV DB with PANCREAS real run, DEPLOY-LOG with curl evidence for all 4 endpoints returning 2xx.

### Wave 0 Gaps

- [ ] `backend/tests/Feature/FinnGen/GwasManhattanControllerTest.php` — covers SC-1 (shape + in-flight + permission)
- [ ] `backend/tests/Feature/FinnGen/GwasManhattanRegionTest.php` — covers SC-2 regional endpoint
- [ ] `backend/tests/Feature/FinnGen/TopVariantsControllerTest.php` — covers SC-3 sort/limit/drawer shape
- [ ] `backend/tests/Feature/GencodeControllerTest.php` — covers SC-2 gene-track endpoint
- [ ] `backend/tests/Feature/FinnGen/LoadGencodeGtfCommandTest.php` — covers Artisan idempotency + size guard
- [ ] `backend/tests/Unit/FinnGen/ManhattanAggregationServiceTest.php` — covers D-03 thinning algorithm + GWS bypass (core correctness test)
- [ ] `backend/tests/Feature/FinnGen/ManhattanRoutePermissionTest.php` — covers HIGHSEC §2 for all 4 new routes
- [ ] `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/FinnGenManhattanPanel.test.tsx` — covers canvas render + ErrorBoundary + empty state
- [ ] `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/RegionalView.test.tsx`
- [ ] `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/GeneTrack.test.tsx`
- [ ] `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/TopVariantsTable.test.tsx`
- [ ] `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/VariantDrawer.test.tsx`
- [ ] `frontend/src/features/finngen-workbench/components/__tests__/FinnGenSeededPill.test.tsx`
- [ ] `e2e/tests/phase-16-manhattan-perf.spec.ts` — covers SC-1 `<3s` render requirement via Playwright + performance.now()

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing Sanctum + `auth:sanctum` middleware (no changes) |
| V3 Session Management | yes | Existing Sanctum 8h token expiration (HIGHSEC §1.2) |
| V4 Access Control | yes | `permission:finngen.workbench.use` for 3 Manhattan routes; `permission:cohorts.view` for Gencode route; ownership check on Run.user_id |
| V5 Input Validation | yes | Laravel FormRequests (3 new) + regex allow-lists on chrom + schema |
| V6 Cryptography | no | No crypto operations |
| V9 Communication | yes | Existing TLS via nginx; GENCODE URL is HTTPS-pinned |
| V10 Malicious Code | yes | No `eval`, no dynamic SQL outside the 3 whitelisted schemas |

### Known Threat Patterns for Phase 16 stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **T-16-S1** SQL injection via `{schema}` interpolation | Tampering | Regex allow-list `/^[a-z][a-z0-9_]*$/` on `strtolower($sourceKey) . '_gwas_results'` + `information_schema.schemata` existence check. Mirrors CohortPrsController L160-184. |
| **T-16-S2** Cache poisoning | Tampering | Redis key scoped by `{run_id}` (validated against `finngen.runs.id` ULID regex + existence). No user input in key. D-28 locked. |
| **T-16-S3** DoS via thin=1 | Denial of Service | FormRequest clamps `bin_count` to 10-500. Tested as an invariant. D-27 locked. |
| **T-16-S4** DoS via oversized region window | Denial of Service | FormRequest `after()` hook rejects end-start > 2 Mb. |
| **T-16-S5** DoS via massive top-variants limit | Denial of Service | FormRequest clamps `limit` to 1-200. |
| **T-16-S6** SSRF via LoadGencodeGtfCommand | Server-Side Request Forgery | URL hard-coded class constant. `--file=` path must be under `storage_path()`. D-26 locked. |
| **T-16-S7** Gene-track memory exhaustion | Denial of Service | Artisan checks `filesize() > 100MB` before gunzip. D-29 locked. |
| **T-16-S8** Ownership bypass (user A reads user B's run) | Elevation of Privilege | Explicit `$run->user_id !== $user->id && !hasRole(['admin','super-admin'])` check in every controller. |
| **T-16-S9** PII leak via `snp_id` | Information Disclosure | snp_ids are standard rsIDs from public catalogs; no PHI surface. |
| **T-16-S10** Cross-origin Canvas tainting | Tampering | Canvas rendered from same-origin API responses only. No foreign images. |
| **T-16-S11** XSS via `endpoint_name` in pill | Tampering | React auto-escapes text content. `encodeURIComponent` on href query param. |
| **T-16-S12** CSRF on the 4 new GET routes | Tampering | Sanctum SPA auth does not require CSRF for GET; all 4 are read-only. |
| **T-16-S13** PG transaction poisoning in schema probe | Denial of Service | Information_schema existence check PRE-SELECT, mirroring CohortPrsController. |

## Sources

### Primary (HIGHSEC confidence — file+line anchors)

- `backend/app/Services/FinnGen/GwasSchemaProvisioner.php:65-175` — summary_stats + prs_subject_scores schema + BRIN(gwas_run_id,chrom,pos) index + grants
- `backend/app/Http/Controllers/Api/V1/CohortPrsController.php:40-184` — Phase 17 whitelist schema resolution pattern (Pattern 2)
- `backend/app/Observers/FinnGen/FinnGenGwasRunObserver.php:44-178` — cross-schema query with savepoint (Pitfall 2)
- `backend/app/Models/App/FinnGen/Run.php:1-153` — Run model + status enum + scopeForUser (ownership check)
- `backend/app/Models/App/FinnGen/WorkbenchSession.php:1-63` — session_state is unstructured `array` cast (D-14 verified)
- `backend/app/Services/FinnGen/PrsAggregationService.php:45-146` — width_bucket + percentile_cont reference pattern for thinning SQL
- `backend/app/Console/Commands/FinnGen/LoadPgsCatalogCommand.php:36-60` — Artisan command template for GENCODE loader
- `backend/app/Services/FinnGen/FinnGenIdempotencyStore.php:32-54` — Redis SETNX pattern (reference; Phase 16 uses `Cache::remember` instead)
- `backend/routes/api.php:1060-1113` — permission + throttle route-group patterns
- `frontend/src/features/investigation/components/genomic/ManhattanPlot.tsx:1-364` — existing d3 + Canvas + DPR implementation (extend target)
- `frontend/src/features/finngen-endpoint-browser/hooks/useEndpoints.ts:57-85` — writer of `seeded_from` shape (GENOMICS-13 writer confirmed)
- `frontend/src/features/finngen-workbench/pages/WorkbenchPage.tsx:100-145` — insertion point for FinnGenSeededPill (pattern 7)
- `frontend/src/features/finngen-endpoint-browser/components/GwasRunsSection.tsx:79-148` — `<Link>` pattern that deep-links to Phase 16 route
- `frontend/src/features/finngen-endpoint-browser/pages/FinnGenGwasResultsStubPage.tsx:1-24` — the 23 LOC stub to replace
- `frontend/src/app/router.tsx:370-381,346-351` — reserved deep-link route + workbench session detail route location
- `frontend/src/components/ErrorBoundary.tsx:1-85` — reusable error boundary with `fallback` prop
- `frontend/package.json` — version pins for d3, @tanstack/react-table, lucide-react, recharts
- `.claude/rules/HIGHSEC.spec.md` §2 (three-layer model), §4.1 (grants), §5 (secrets), §10 (shell-out)
- `.claude/CLAUDE.md` Gotcha #12 (PG transaction poisoning), CI commands, Recharts formatter `as never`
- `.planning/phases/17-pgs-prs/17-RESEARCH.md` — complete Phase 17 precedent (Redis caching, Artisan HTTPS fetch, SSRF, permission seeding, schema resolution)

### Secondary (MEDIUM confidence — external verified)

- GENCODE v46 basic annotation GFF3 size (35MB compressed) — `[VERIFIED: WebFetch https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_46/ 2026-04-17]`
- d3 v7.9.0 current — `[CITED: npmjs.com]`
- @tanstack/react-table v8.21.3 — `[CITED: package.json]`
- PheWeb per-chromosome-bin thinning algorithm — `[CITED: github.com/statgen/pheweb Mhanifeston et al., 2020]`

### Tertiary (LOW confidence — assumed, validation deferred)

- First-hit BRIN scan performance on 10M real rows (A1) — **MEDIUM-LOW confidence estimate**; resolvable at Phase 14-07 CHECKPOINT or Phase 16 synthetic fixture generator.
- `Run.params['cohort_definition_id']` key name (A2) — Plan 4 grep resolves.
- Endpoint browser `?open={name}` drawer query param (A5) — Plan 6 grep resolves.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps already installed; version-verified.
- Architecture: HIGH — all patterns have live precedent in Phase 14 / 15 / 17.
- Thinning SQL: HIGH — exact query verified against Phase 14's shipped schema (VARCHAR(4) chrom + BIGINT pos + BRIN(gwas_run_id, chrom, pos) confirmed).
- Workbench pill (D-13 reader) + writer (D-14) — HIGH — writer file+line verified (`useEndpoints.ts:69-72`).
- Session page insertion point — HIGH — verified at `WorkbenchPage.tsx:118-144`.
- First-hit latency on real 10M rows — MEDIUM-LOW — no 10M corpus exists; estimate only.
- Gene-track format (GFF3 attr syntax, chrom normalization) — HIGH — externally verified.
- TanStack Table v8 first-consumer — MEDIUM — unused today; Pitfall 8 flags Vite build verification.

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days; stable codebase + pinned deps). Re-verify if Phase 14-07 CHECKPOINT lands with materially different summary_stats indexing or partitioning.
