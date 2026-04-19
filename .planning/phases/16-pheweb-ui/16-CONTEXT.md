# Phase 16: PheWeb-lite Results UI + Workbench Attribution - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Branch:** `feature/phase-16-pheweb-ui` (off origin/main)
**Depends on:** Phase 15 (GWAS dispatch + run tracking — landed on main by parallel agent)

<domain>
## Phase Boundary

Deliver 3 UI capabilities end-to-end so researchers can browse a completed GWAS run natively and identify FinnGen-seeded workbench sessions at a glance:

1. **Manhattan plot page** at `/workbench/finngen-endpoints/{name}/gwas/{run_id}` renders a full-chromosome Manhattan plot in <3 seconds for ~10M-SNP summary-stat runs.
2. **Regional view + LocusZoom-lite panel** — click a peak → ±500 kb window with variants + gene track (no LD coloring in v1).
3. **Top-50 variants table** — sortable, per-row drawer with chrom/pos/ref/alt/af/beta/se/p-value + `gwas_run_id`.
4. **Workbench session attribution pill** — any session whose `session_state.seeded_from.kind === 'finngen-endpoint'` displays "From FinnGen {endpoint_name}" at the top of the operation tree, linking back to the endpoint browser detail drawer.

**In scope:**
- Extend existing `frontend/src/features/investigation/components/genomic/ManhattanPlot.tsx` (d3 + Canvas stub at 364 LOC) for the live summary_stats use case OR create a new companion component under `frontend/src/features/finngen-endpoint-browser/components/gwas-results/` — planner decides based on divergence.
- New Canvas-based regional view + gene track (d3 + GENCODE v46 GTF).
- New top-50 variants table component with sort + per-row drawer.
- Session attribution pill rendered in the FinnGen workbench session page.
- Backend endpoints:
  - `GET /api/v1/finngen/runs/{id}/manhattan?thin=N` → aggregated ≤50-100k rows
  - `GET /api/v1/finngen/runs/{id}/manhattan/region?chrom=X&start=Y&end=Z` → full resolution in window
  - `GET /api/v1/finngen/runs/{id}/top-variants?limit=50&sort=p_value` → sortable top-N
- Redis cache layer keyed by `gwas_run_id` for thinned result.
- Route replacement: swap the 23-line `FinnGenGwasResultsStubPage.tsx` for a real page.
- Pest feature tests for 3 new backend endpoints; Vitest for 3+ new components.

**Out of scope (deferred):**
- LD-colored variants (deferred to Phase 16.1 — needs LDlink integration or pre-computed LD matrices per reference pop).
- Multi-run comparison view (overlay two Manhattan plots).
- GWAS-cohort manifest comparison (same endpoint, 2+ sources).
- Whole-genome PheWAS view (hundreds of phenotypes vs one variant).
- Automatic gene-name overlays for every significant peak (v1: gene track only in regional view).
- Downloadable PDF / PNG export.
- Real-time progress bar for in-flight runs (Phase 15's run polling UI covers this elsewhere).
- PheWAS result browser for PGS Catalog scores.

**Scope guardrails:**
- Reuse Phase 14 `{source}_gwas_results.summary_stats` shape. No schema changes.
- No new npm dependencies — d3 + Canvas pattern matches Phase 16's own `ManhattanPlot.tsx` stub + existing `ForestPlot.tsx` / `KaplanMeierPlot.tsx` precedent.
- No backend runtime changes: no new services, no new schemas, no new migrations beyond optional Redis-key helpers in config.
- Performance contract: ≥10M SNPs → thinned payload ≤8MB → render ≤3s on a cold load. Subsequent viewport interactions <100ms.

</domain>

<decisions>
## Implementation Decisions

### Manhattan rendering (user-locked)
- **D-01:** Canvas-backed render, NOT SVG. Extends existing `ManhattanPlot.tsx` (frontend/src/features/investigation/components/genomic/ManhattanPlot.tsx) which already ships d3 + `HTMLCanvasElement` at 364 LOC. Planner evaluates: extend in-place vs. copy to new component under `finngen-endpoint-browser/`. Default: extend with a prop-driven data source (Phase 15 GWAS run API vs. Phase 15 GWAS Catalog upload) — avoids duplicate drawing code.
- **D-02:** Server-side thinning via lazy PG query. Endpoint `GET /api/v1/finngen/runs/{id}/manhattan` queries `{source}_gwas_results.summary_stats WHERE gwas_run_id=?`, window-aggregates to ~50-100k rows using `width_bucket(pos, chrom_start, chrom_end, 100)` per-chromosome + a `MAX(-LOG10(p_value)) KEEP (FIRST BY ... ORDER BY p_value)` pattern (or DISTINCT ON). All genome-wide-significant variants (p < 5e-8) included unconditionally regardless of thinning bucket. Cached in Redis with key `finngen:manhattan:{gwas_run_id}:{thin_level}` and 24h TTL. First-hit latency 5-10s for 10M SNPs; subsequent hits <100ms.
- **D-03:** Thinning algorithm per chromosome: 5,000 bins × 22 autosomes + X = ~110k bins. Each bin emits the variant with minimum p-value (maximum -log10(p)). Genome-wide-significant variants (p < 5e-8) bypass binning and are always included. Expected output: 50k–150k rows from a 10M-SNP input.
- **D-04:** Frontend payload shape: `{ variants: [{chrom, pos, neg_log_p, gwas_run_id?, snp_id?}], genome: {chrom_offsets: [...]}, thinning: {bins: N, threshold: 5e-8, variant_count_before: 10_000_000, variant_count_after: 97_432} }`.
- **D-05:** Canvas draw loop: one dot per variant, color by chromosome (alternating blue/teal per Parthenon theme #2DD4BF / #1E40AF). Vertical line at -log10(5e-8) ≈ 7.30 drawn in crimson #9B1B30.

### Regional view (user-locked)
- **D-06:** Click a peak → open regional view with `GET /api/v1/finngen/runs/{id}/manhattan/region?chrom=X&start=Y-500000&end=Y+500000`. Returns full-resolution variants (not thinned) in the window — usually 500-5000 variants per 1 Mb window. Canvas render, smaller scale.
- **D-07:** Gene track from GENCODE v46 basic annotation GTF (`https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_46/gencode.v46.basic.annotation.gff3.gz`, ~40MB compressed). Baked into `backend/storage/app/private/gencode/` via an Artisan command `parthenon:load-gencode-gtf` (new). Served by `GET /api/v1/gencode/genes?chrom=X&start=Y&end=Z` returning lightweight `{gene_name, chrom, start, end, strand, gene_type}` list. Cache-Control: 1 year (static data).
- **D-08:** Regional view layout (top to bottom): chromosome position axis → variants scatter (Canvas) → gene track (SVG rects with strand arrows). d3 scales shared across layers.

### LD coloring (user-locked — DEFERRED)
- **D-09:** No LD coloring in Phase 16. All regional variants rendered monochromatic (Parthenon teal #2DD4BF). Planner adds an empty `<LegendBand>` placeholder component so a future 16.1 can drop in LD gradient without restructuring. Deferred-items.md documents the LDlink/LD-matrix-precompute follow-up scope.

### Top-50 variants table (user-locked default: recommended)
- **D-10:** New endpoint `GET /api/v1/finngen/runs/{id}/top-variants?limit=50&sort=p_value&dir=asc`. Query: `SELECT chrom, pos, ref, alt, af, beta, se, p_value, snp_id, gwas_run_id FROM {source}_gwas_results.summary_stats WHERE gwas_run_id=? ORDER BY p_value ASC LIMIT 50`. Supports sort on any of those 7 columns.
- **D-11:** Frontend component uses existing Parthenon table patterns (TanStack Table available in project per existing cohort-definition list views). Per-row click → slideover drawer (same pattern as cohort-definitions drawer).
- **D-12:** Drawer fields (per ROADMAP SC-3): chrom, pos, ref, alt, af, beta, se, p-value, snp_id, gwas_run_id. No external links in v1 (dbSNP / UCSC deferred).

### Workbench session attribution pill (user-locked default: recommended)
- **D-13:** Frontend-only change. FinnGen workbench session page (`frontend/src/features/finngen-workbench/pages/WorkbenchSessionPage.tsx` or equivalent — planner locates) reads `session.session_state.seeded_from` (typed as `{kind: 'finngen-endpoint' | ..., endpoint_name?: string}` in a new TS interface). When `kind === 'finngen-endpoint'`, render a pill at the top of the operation tree: `From FinnGen {endpoint_name}` with a link to `/workbench/finngen-endpoints/{endpoint_name}`.
- **D-14:** No backend schema change. The `session_state` JSONB column on `finngen.workbench_sessions` is already untyped `array` per the model; whatever wrote `seeded_from` already wrote the correct shape (planner verifies by grep for `seeded_from` in backend controllers/services — likely written by `WorkbenchSessionController::store` or `FinnGenEndpointImporter` at session-creation time).
- **D-15:** Pill uses existing Parthenon design tokens: crimson bg #9B1B30/10 opacity, crimson text, gold border #C9A227 2px. Rounded-full. Icon: a simple helix or fingerprint SVG from lucide-react (already in deps).

### API contract
- **D-16:** 4 new routes in `backend/routes/api.php`, all under `auth:sanctum + permission:finngen.workbench.use + throttle:120,1`:
  - `GET /api/v1/finngen/runs/{id}/manhattan?thin={bin_count}` (thinned summary — default bin_count=100)
  - `GET /api/v1/finngen/runs/{id}/manhattan/region?chrom=X&start=Y&end=Z` (full-res window)
  - `GET /api/v1/finngen/runs/{id}/top-variants?limit=50&sort=p_value&dir=asc`
  - `GET /api/v1/gencode/genes?chrom=X&start=Y&end=Z` (gene track data; different permission — `cohorts.view`)
- **D-17:** All 4 endpoints use the default `pgsql` connection but resolve the `{source}_gwas_results` schema by joining `finngen.runs.source_key` → `app.sources.source_key` → derived schema name (`{source_lower}_gwas_results`). Schema-name injection is SECURE via whitelist of registered sources (same pattern as `CohortPrsController` from Phase 17).
- **D-18:** FormRequests for the 2 query-param routes: `ManhattanQueryRequest` (bin_count int 10-500; thin_threshold float default 5e-8), `ManhattanRegionQueryRequest` (chrom string `/^(\d{1,2}|X|Y|MT)$/`, start/end int, window ≤ 2Mb), `TopVariantsQueryRequest` (limit 1-200, sort whitelist, dir enum).

### Data model + Redis cache
- **D-19:** No new tables. No new migrations.
- **D-20:** Redis cache keys:
  - `finngen:manhattan:{run_id}:thin:{bin_count}` — JSON payload of thinned variants (24h TTL)
  - `finngen:manhattan:{run_id}:top-variants:{sort}:{dir}:{limit}` — JSON payload (15 min TTL — shorter because sort variants mutable)
  - `finngen:gencode:genes:{chrom}:{start}:{end}` — JSON (7-day TTL; static data)
- **D-21:** Redis connection: reuse existing `default` connection (same as Phase 17 idempotency cache). No new config.

### GENCODE gene track
- **D-22:** `parthenon:load-gencode-gtf` Artisan command — one-time bootstrap (idempotent). Fetches GENCODE v46 basic annotation GFF3, parses gene entries (lines with `feature=gene`), writes to `backend/storage/app/private/gencode/genes-v46.tsv` (simplified: `gene_name\tchrom\tstart\tend\tstrand\tgene_type`, ~60k rows). Load at request-time into memory (via a simple in-memory cache facade) OR serve from flat TSV scan (cache-hit path common).
- **D-23:** GencodeService as a singleton with a `findGenesInRange(chrom, start, end)` method. Loads the TSV once per PHP-FPM worker lifetime. Memory footprint ~5MB.
- **D-24:** Deploy runbook: run `php artisan parthenon:load-gencode-gtf` once on DEV as part of Plan 16 cutover. Plan 16 deploy includes this step.

### Auth + security
- **D-25:** Reuse existing `finngen.workbench.use` permission (from Phase 13.2). No new permissions.
- **D-26:** SSRF protection on `parthenon:load-gencode-gtf` — URL hard-coded to ftp.ebi.ac.uk pattern; no `--url` flag. Optional `--file=path` flag for local development override.
- **D-27:** T-16-S1 (thinning bypass): request with `thin=1` could force full 10M-row payload → DoS. FormRequest clamps bin_count to 10-500.
- **D-28:** T-16-S2 (cache poisoning): Redis key scoped by `gwas_run_id` (validated against finngen.runs existence). No user input in key.
- **D-29:** T-16-S3 (gene-track memory blow): Artisan command validates GFF3 size ≤ 100MB before parsing.

### Claude's Discretion
- **Test fixture for Manhattan:** planner picks — either generate synthetic 10k-row summary_stats fixture in Pest beforeEach OR reuse Phase 14's synthetic PANCREAS GWAS smoke output if it produced plausible p-values.
- **Extend-in-place vs copy:** existing `ManhattanPlot.tsx` under `investigation/genomic/` — extend with prop-driven data source OR create a new parallel component under `finngen-endpoint-browser/components/gwas-results/`. Planner decides based on how different the live-summary-stats case is from the GWAS-catalog-upload case.
- **Top-50 table tech:** TanStack Table (already in deps) vs plain HTML table. Recommend TanStack for consistent sort+drawer pattern.
- **Gene track rendering:** Canvas (matches Manhattan) vs SVG (easier interaction for click-to-info). Recommend SVG for gene track, Canvas for variants scatter — layered composition.
- **Canvas DPR:** d3 + `window.devicePixelRatio` for retina sharpness — already the pattern in existing ManhattanPlot.
- **Regional window default:** ±500 kb per ROADMAP SC-2 (1 Mb total).
- **Empty-state:** What if summary_stats has 0 rows for run_id? Render "GWAS run is still in progress" placeholder + link to run polling UI.
- **Error boundaries:** React Error Boundary wrapping each panel so a Canvas crash doesn't take down the whole page.

### Folded Todos
(No matching pending todos — `todo_count` = 0.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 14 + 15 foundation (reuse)
- `backend/database/migrations/create_{pancreas,synpuf,...}_gwas_results_schema` — summary_stats column set
- `backend/app/Services/FinnGen/GwasSchemaProvisioner.php` — confirms `{source}_gwas_results.summary_stats` shape
- `backend/app/Services/FinnGen/GwasRunService.php` — run dispatch + completion observer
- `backend/app/Models/App/FinnGen/Run.php` — status + summary fields
- `backend/app/Observers/FinnGen/FinnGenGwasRunObserver.php` — run completion hook (Phase 15)
- Phase 15 route registrations in `backend/routes/api.php` — pattern for `POST /finngen/endpoints/{name}/gwas` route template

### Existing UI reuse (DO NOT DUPLICATE)
- `frontend/src/features/investigation/components/genomic/ManhattanPlot.tsx` (364 LOC, d3 + Canvas) — EXTEND or COPY
- `frontend/src/features/finngen-endpoint-browser/pages/FinnGenGwasResultsStubPage.tsx` (23 LOC stub) — REPLACE with real page
- `frontend/src/features/estimation/components/ForestPlot.tsx` + `KaplanMeierPlot.tsx` — d3 rendering pattern reference
- `frontend/src/features/finngen-endpoint-browser/components/RunGwasPanel.tsx` + `GwasRunsSection.tsx` — integration points for clicking through to results

### Workbench session attribution
- `backend/app/Models/App/FinnGen/WorkbenchSession.php` L47 `session_state` as `array` cast
- `backend/app/Services/FinnGen/` (grep for `seeded_from` — planner verifies which service writes this shape)
- `frontend/src/features/finngen-workbench/` — session page integration point

### Governance
- `.claude/rules/HIGHSEC.spec.md` §4.1 grants; §5 secrets; §7 PHI (no PHI in Manhattan; only summary stats)
- `.claude/CLAUDE.md` — Pint via Docker, PHPStan level 8, no `any` in TS, `npx vite build` stricter than tsc, Recharts formatter `as never` cast (NOT using Recharts here but pattern for drawer tooltips)

### External references
- GENCODE v46 GFF3: https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_46/gencode.v46.basic.annotation.gff3.gz
- PheWeb source code (for thinning algorithm reference): https://github.com/statgen/pheweb
- d3-scale + d3-axis docs (pinned version already in Parthenon frontend)

### Target code (to create or extend)
- `backend/app/Http/Controllers/Api/V1/FinnGen/GwasManhattanController.php` (NEW)
- `backend/app/Http/Controllers/Api/V1/GencodeController.php` (NEW)
- `backend/app/Services/FinnGen/ManhattanAggregationService.php` (NEW)
- `backend/app/Services/FinnGen/GencodeService.php` (NEW)
- `backend/app/Console/Commands/LoadGencodeGtfCommand.php` (NEW)
- `backend/app/Http/Requests/FinnGen/ManhattanQueryRequest.php` (NEW)
- `backend/app/Http/Requests/FinnGen/ManhattanRegionQueryRequest.php` (NEW)
- `backend/app/Http/Requests/FinnGen/TopVariantsQueryRequest.php` (NEW)
- `backend/routes/api.php` — 4 new routes
- `frontend/src/features/investigation/components/genomic/ManhattanPlot.tsx` (EXTEND with prop-driven data source)
  OR `frontend/src/features/finngen-endpoint-browser/components/gwas-results/FinnGenManhattanPlot.tsx` (NEW)
- `frontend/src/features/finngen-endpoint-browser/components/gwas-results/RegionalView.tsx` (NEW)
- `frontend/src/features/finngen-endpoint-browser/components/gwas-results/GeneTrack.tsx` (NEW)
- `frontend/src/features/finngen-endpoint-browser/components/gwas-results/TopVariantsTable.tsx` (NEW)
- `frontend/src/features/finngen-endpoint-browser/components/gwas-results/VariantDrawer.tsx` (NEW)
- `frontend/src/features/finngen-endpoint-browser/pages/FinnGenGwasResultsPage.tsx` (REPLACES StubPage)
- `frontend/src/features/finngen-endpoint-browser/hooks/useManhattanData.ts` (NEW)
- `frontend/src/features/finngen-endpoint-browser/hooks/useTopVariants.ts` (NEW)
- `frontend/src/features/finngen-endpoint-browser/hooks/useGencodeGenes.ts` (NEW)
- `frontend/src/features/finngen-endpoint-browser/api/gwas-results.ts` (NEW)
- `frontend/src/features/finngen-workbench/components/FinnGenSeededPill.tsx` (NEW)
- `frontend/src/features/finngen-workbench/pages/WorkbenchSessionPage.tsx` (EDIT — add pill render)

### Target tests
- `backend/tests/Feature/FinnGen/GwasManhattanControllerTest.php` (NEW) — thinning shape, cache behavior, 404 for missing run, permission
- `backend/tests/Feature/FinnGen/GwasManhattanRegionTest.php` (NEW) — window clamp, chrom whitelist, full-res within window
- `backend/tests/Feature/FinnGen/TopVariantsControllerTest.php` (NEW) — sort whitelist, limit clamp
- `backend/tests/Feature/GencodeControllerTest.php` (NEW) — range query, GENCODE service mock
- `backend/tests/Feature/LoadGencodeGtfCommandTest.php` (NEW) — idempotency, SSRF guard, size limit
- `backend/tests/Unit/FinnGen/ManhattanAggregationServiceTest.php` (NEW) — binning algorithm, gws-threshold bypass
- `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/FinnGenManhattanPlot.test.tsx` OR `ManhattanPlot.test.tsx` extension
- `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/TopVariantsTable.test.tsx`
- `frontend/src/features/finngen-endpoint-browser/components/gwas-results/__tests__/GeneTrack.test.tsx`
- `frontend/src/features/finngen-workbench/components/__tests__/FinnGenSeededPill.test.tsx`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **`ManhattanPlot.tsx` 364 LOC with d3 + Canvas** — matches the approved rendering strategy exactly. Extend with a new prop (`dataSource: 'catalog-upload' | 'gwas-run'`) to distinguish the existing GWAS-catalog-upload use case from the new live-run use case. Alternatively, abstract the rendering into a hook + create two wrapper components.
- **Phase 17 `CohortPrsController`** — proves the per-source-schema whitelist lookup pattern for `{source}_gwas_results.*` queries.
- **Phase 15's FinnGenRunObserver** (`backend/app/Observers/FinnGen/FinnGenGwasRunObserver.php`) — run-completion hook; we don't need to add logic here but the Manhattan controller uses the run's status to reject in-flight requests (return 202 Accepted + "run is queued" body).
- **TanStack Query + TanStack Table** — already in frontend deps; reuse for data fetching + sortable table.
- **Parthenon design tokens** — crimson #9B1B30, gold #C9A227, teal #2DD4BF — all in use for consistent badge/pill styling.
- **Phase 14 `GwasSchemaProvisioner`** — confirms the `{source}_gwas_results.summary_stats` column set matches what we query.
- **Phase 13.2 shared-PDO trait** (`SharesPdoAcrossTestConnections`) — PRS/GWAS controller tests reuse; Phase 16's new controllers will too.

### Established patterns
- **d3 scales + Canvas with devicePixelRatio** — already in `ManhattanPlot.tsx`; reuse across new Regional + GeneTrack components.
- **`{source}` schema resolution** — query `app.sources` where source_key matches, derive schema name as `strtolower(source_key) . '_gwas_results'`. Validate against whitelist before using in raw SQL. Phase 14 + 17 precedent.
- **Redis cache key pattern** — `{feature}:{entity}:{id}:{variant}:...` matches Phase 17's `finngen:idem:{user_id}:{key}` pattern.
- **Single-txn Laravel auto-wrap** — not needed here (no migrations).
- **Artisan command with idempotent upsert + HTTPS fetch + SSRF guard** — Phase 17's `LoadPgsCatalogCommand` template applies directly to `LoadGencodeGtfCommand`.
- **Permission gating** — `permission:finngen.workbench.use` for variant/manhattan routes; `permission:cohorts.view` for gencode (generic reference data).

### Integration points
- **`FinnGenGwasResultsStubPage.tsx`** — replaced by `FinnGenGwasResultsPage.tsx` that renders the whole 3-panel layout (Manhattan on top, table below, regional view lazy-mounted on peak-click).
- **Workbench session page** — planner locates the current page/component and inserts `<FinnGenSeededPill>` above the operation tree.
- **Routes under `/workbench/finngen-endpoints/{name}/gwas/{run_id}`** — already scaffolded by Phase 15's route reservation (commit `1a899f44d feat(15-07): reserve Phase 16 GWAS results route with stub page`). Planner confirms the stub is the link target from `GwasRunsSection.tsx`.

</code_context>

<specifics>
## Specific Ideas

- **Phase 14's `ManhattanPlot.tsx` already uses d3 + Canvas exactly as approved** — this is the biggest accelerator. The component drawing logic is reusable; the data contract changes from "uploaded file parsed client-side" to "API payload fetched server-side with thinning already applied".
- **PheWeb's own thinning algorithm is the reference** — they use a similar per-chromosome binning + genome-wide-significance bypass. Matches our D-03 spec.
- **First-hit 5-10s latency is acceptable** when Redis caches the thinned result — this is the explicit tradeoff with not pre-computing in the R worker. Real-world: researchers hit a GWAS results page multiple times during an analysis session; the cache pays off.
- **Gene track in regional view only** — NOT in the full-chromosome Manhattan. Manhattan is too zoomed-out for gene labels to be readable; adding them is noise.
- **Session attribution pill is a 50-LOC frontend-only change** — the session already stores `seeded_from` per Phase 13.2/13.1 promote flow. This is the quickest SC to close.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 16.1 — LD coloring in regional view.** Integrate either LDlink REST API (proxy + cache) or pre-computed LD matrices from 1000 Genomes per reference population.
- **Phase 16.2 — Download Manhattan as PNG / PDF.** Canvas `toDataURL` + server PDF render if needed.
- **Phase 16.3 — PheWAS view.** Reuse the TopVariants controller inverted: one variant → multiple GWAS runs (phenotype x-axis).
- **Phase 16.4 — Gene-peak auto-labeling.** Label the top-3 genes per genome-wide-significant peak directly on the Manhattan plot.
- **Phase 16.5 — Run comparison overlay.** Two Manhattan plots side-by-side, or same plot with two colors.
- **Whole-genome Pheweb-style browser** — one phenotype-vs-many-variants view is v1; the inverse (one-variant-vs-many-phenotypes) is future work.
- **GWAS-as-a-covariate** — using PRS from Phase 17 as a GWAS covariate in Phase 14's regenie pipeline — future phase.
- **FHIR / GA4GH VRS export** of variants — future phase.

### Reviewed Todos (not folded)
(No matching pending todos.)

</deferred>

---

*Phase: 16-pheweb-ui*
*Context gathered: 2026-04-19*
