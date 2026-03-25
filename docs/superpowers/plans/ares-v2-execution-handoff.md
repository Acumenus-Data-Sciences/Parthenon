# Ares v2 Execution Handoff

> **For:** A fresh Claude Code agent with `--dangerously-skip-permissions`
> **Approach:** GSD skills (`/gsd:execute-phase` or `/gsd:quick` per phase)
> **Date:** 2026-03-24
> **Author:** Previous session agent

---

## What This Is

You are executing the **Ares v2** implementation for Parthenon — an OHDSI outcomes research platform. Ares is a data observatory tab in the Data Explorer that provides network-level data characterization, quality tracking, and cross-source analysis across 6-8 clinical data sources.

**Ares v1 is already deployed and working.** It has 10 panels (Network Overview, Concept Comparison, DQ History, Coverage Matrix, Feasibility, Diversity, Releases, Unmapped Codes, Annotations, Cost) with basic functionality — tables, simple charts, CRUD operations.

**Ares v2 adds 70 enhancements** across those 10 panels, transforming each from a basic display into an industry-leading analytical tool. The design spec is complete, reviewed, and approved. Three implementation plans are written with full code, tests, and commit messages.

---

## Project Context

### Tech Stack
- **Backend:** Laravel 11, PHP 8.4, PostgreSQL 17 (single `parthenon` DB on `pgsql.acumenus.net`, schema-isolated)
- **Frontend:** React 19, TypeScript strict, Vite 7, Tailwind 4, Zustand, TanStack Query, Recharts
- **AI Service:** Python 3.12, FastAPI, pgvector for concept embeddings
- **Test:** Pest (PHP), Vitest (frontend)
- **Deploy:** `./deploy.sh` (PHP caches, migrations, frontend build)

### Critical Rules (HIGHSEC)
- **All routes** MUST have `auth:sanctum` + `permission:analyses.view` (read) or `permission:analyses.create` (write)
- **Models** MUST use `$fillable` — NEVER `$guarded = []`
- **CdmModel is read-only** — never write to OMOP CDM tables directly
- **No hardcoded secrets** — use environment variables
- **Sanctum tokens** expire after 480 minutes

### Frontend Theme
- `#0E0E11` base, `#151518` card bg, `#1a1a22` hover, `#252530` borders
- `#9B1B30` crimson, `#C9A227` gold, `#2DD4BF` teal
- npm install always with `--legacy-peer-deps`

### Database
- Single `parthenon` database on `pgsql.acumenus.net:5432` (PG 17)
- Schemas: `app`, `omop`, `results`, `gis`, `eunomia`, `eunomia_results`, `php`
- **Docker PG is LEGACY — do NOT use**
- Test DB: `parthenon_testing` on same host

### Working Directory
`/home/smudoshi/Github/Parthenon`

---

## Files to Read First

### Specs (read these to understand WHAT to build)
1. **v2 Design Spec:** `docs/superpowers/specs/2026-03-24-ares-v2-design.md` — 70 enhancements, data model, API, security
2. **v1 Design Spec:** `docs/superpowers/specs/2026-03-24-ares-parity-design.md` — the foundation you're building on

### Plans (read these to understand HOW to build it)
3. **Phase A Plan:** `docs/superpowers/plans/2026-03-24-ares-v2-phase-a.md` — 12 tasks, ~20 quick wins
4. **Phase B Plan:** `docs/superpowers/plans/2026-03-24-ares-v2-phase-b.md` — 10 tasks, ~25 core transforms
5. **Phase C Plan:** `docs/superpowers/plans/2026-03-24-ares-v2-phase-c.md` — 11 tasks, ~15 advanced + differentiators

### Project Rules (read these for constraints)
6. **HIGHSEC:** `.claude/rules/HIGHSEC.spec.md`
7. **Auth system:** `.claude/rules/auth-system.md`
8. **CLAUDE.md:** `CLAUDE.md` or `.claude/CLAUDE.md`

### Existing v1 Code (read these to understand patterns)
9. **Backend services:** `backend/app/Services/Ares/` (9 service files)
10. **Controllers:** `backend/app/Http/Controllers/Api/V1/AresController.php` and `NetworkAresController.php`
11. **Frontend components:** `frontend/src/features/data-explorer/components/ares/` (all subdirectories)
12. **Types:** `frontend/src/features/data-explorer/types/ares.ts`
13. **Routes:** `backend/routes/api.php` (search for "ares" sections)

---

## Execution Order

### Phase A: Quick Wins (~20 enhancements, low effort)

Execute first. These are all low-effort changes that enhance existing views without new tables or services.

**Key changes:**
- Replace trend arrows with sparklines in Network Overview
- Add data freshness monitor (days since refresh, STALE badge)
- Add domain coverage and person count columns
- Row click → source detail navigation
- Confidence intervals on Concept Comparison bars
- Good/bad zone shading on DQ trend chart
- Observation period column highlight in Coverage Matrix
- Interactive row/column highlighting + view mode toggle
- Continuous 0-100 scoring for Feasibility (replace binary PASS/FAIL)
- Simpson's Diversity Index cards
- Edit release metadata (inline form)
- Impact-weighted priority score for Unmapped Codes
- Annotation tags + full-text search
- PPPY metric for Cost

**Backend:** Mostly extending existing service methods to return additional computed fields. 1 migration (add `tag` to `chart_annotations`).

**Frontend:** Modify existing view components + 3 new small components (Sparkline, FreshnessCell, ReleaseEditForm).

**Verification after Phase A:**
```bash
cd backend && vendor/bin/pest tests/Unit/Services/Ares/ tests/Feature/Api/V1/AresControllerTest.php tests/Feature/Api/V1/NetworkAresControllerTest.php
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
./deploy.sh --frontend
```

### Phase B: Core Transformations (~25 enhancements, medium effort)

Execute after Phase A. This is the largest phase with new services, tables, and significant frontend components.

**New infrastructure:**
- 8 database migrations (4 new tables: `dq_sla_targets`, `feasibility_templates`, `accepted_mappings`, `unmapped_code_reviews`; 4 alter tables)
- 2 new services: `AutoAnnotationService`, `ReleaseDiffService`
- ~23 new frontend components
- ~20 new API endpoints

**Key changes by panel:**
1. Network Overview: Auto-generated alert banner
2. Concept Comparison: Multi-concept chips + attrition funnel
3. DQ History: Category×release heatmap + cross-source overlay + check sparklines
4. Coverage Matrix: Temporal coverage bars + expected vs actual
5. Feasibility: Criteria impact waterfall + CONSORT diagram + templates + observation time
6. Diversity: Benchmark overlay + age pyramid + DAP gap analysis + pooled demographics
7. Releases: Auto-computed diffs + swimlane timeline + auto-notes + calendar
8. Unmapped Codes: Pareto chart + progress tracker + treemap + export
9. Annotations: System auto-annotations + timeline + create-from-charts
10. Cost: Box-whisker plots + outlier detection + care setting breakdown

**IMPORTANT for Phase B migration:** The `add_parent_id_to_chart_annotations` migration should ONLY add `parent_id`, NOT `tag` (tag was already added in Phase A).

**Verification after Phase B:**
```bash
cd backend && vendor/bin/pest tests/Unit/Services/Ares/ tests/Feature/Api/V1/
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
./deploy.sh
```

### Phase C: Advanced + Differentiators (~15 enhancements, higher effort)

Execute last. Contains the 5 Phase D differentiators (implement these first within Phase C) plus remaining advanced features.

**Phase D differentiators (do these first — they're competitive differentiators):**
1. `ConceptStandardizationService` — age-sex direct standardization for concept rates (no OHDSI tool does this)
2. `PatientArrivalForecastService` — monthly patient accrual projection (TriNetX's killer feature)
3. GIS diversity integration — geographic + socioeconomic diversity via existing GIS module (ahead of all competitors for FDA DAP)
4. `MappingSuggestionService` — pgvector concept embedding similarity for AI mapping suggestions. **Writes to `app.accepted_mappings` staging table, NOT `source_to_concept_map`** (HIGHSEC: CdmModel read-only)
5. Cost type awareness — `cost_type_concept_id` filter + warning when mixing charged/paid/allowed amounts

**Remaining Phase C:**
- DQ radar profile (5 Kahn dimensions)
- DQ SLA dashboard (requires `role:admin|super-admin|data-steward`)
- DQ export (CSV/PDF)
- Regression root cause linking
- Temporal prevalence trends + concept sets + benchmark line
- Coverage export as data availability letter
- ETL provenance metadata on releases
- Chart-anchored annotation markers (retrofit into existing charts)
- Threaded annotation discussions (flat, 1 level only)
- Cross-source cost comparison + cost drivers analysis

**Verification after Phase C:**
```bash
cd backend && vendor/bin/pest
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
docker compose exec node sh -c "cd /app && npx vitest run"
./deploy.sh
```

---

## Quality Gates

### Before Every Commit
- [ ] No `$guarded = []` in any model: `grep -rn 'guarded\s*=\s*\[\]' backend/app/Models/`
- [ ] All new routes have `auth:sanctum` + permission middleware
- [ ] No hardcoded secrets
- [ ] TypeScript passes: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`

### After Each Phase
- [ ] All Pest tests pass: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/ tests/Feature/Api/V1/`
- [ ] TypeScript clean
- [ ] Frontend builds: `docker compose exec node sh -c "cd /app && npx vite build"`
- [ ] Deploy succeeds: `./deploy.sh`
- [ ] Route list shows correct middleware: `docker compose exec php php artisan route:list --path=ares -v`

### Final Milestone Verification
- [ ] All 70 enhancements implemented
- [ ] All tests pass (target: 80%+ coverage on new code)
- [ ] HIGHSEC compliance verified
- [ ] Production deployed and accessible at https://parthenon.acumenus.net

---

## Common Gotchas

1. **Docker `env_file` loads at CREATION time** — `docker compose restart` does NOT reload `.env`. Use `docker compose up -d`.
2. **`json_encode([])` produces `[]` not `{}`** — use `(object) []` for empty JSON objects (Python Pydantic rejects `[]`).
3. **npm install requires `--legacy-peer-deps`** (react-joyride peer dep issue).
4. **Tests MUST target `parthenon_testing` DB** — check `.env.testing` points to `pgsql.acumenus.net`, NOT Docker PG.
5. **`DB_DATABASE` in `.env.testing` must NOT end in `_test`** — Laravel parallel testing appends `_test_N`.
6. **Spatie permission middleware aliases** must be registered in `bootstrap/app.php` (Laravel 11).
7. **Production build:** After frontend changes, rebuild via `./deploy.sh --frontend` or `docker compose exec node sh -c "cd /app && npx vite build"`.

---

## What Success Looks Like

When all three phases are complete:
- **10 panels** transformed from basic v1 displays to industry-leading analytical views
- **Sparklines, heatmaps, funnels, box plots, pyramids, treemaps** — rich visualizations throughout
- **Cross-source comparison** on every metric (DQ, prevalence, cost, diversity)
- **AI-powered mapping suggestions** using pgvector concept embeddings
- **FDA DAP compliance** with disease-epidemiology benchmarks and geographic diversity
- **Auto-generated annotations** for system events (DQ drops, releases, ETL runs)
- **Patient arrival rate forecasting** for study feasibility
- **Age-sex standardized rates** — a capability no OHDSI tool has
- **Zero HIGHSEC violations** — all routes protected, no CDM writes, no secrets exposed

---

## GSD Approach

Use GSD skills for execution:

```bash
# Option 1: Execute each phase as a GSD phase
/gsd:execute-phase  # Point it at each phase plan

# Option 2: For smaller batches within a phase
/gsd:quick  # For individual tasks that are self-contained

# For debugging issues during implementation
/gsd:debug  # Systematic debugging with state tracking
```

Read each plan file completely before starting execution. The plans contain full code, test commands, and commit messages for every step.

**Commit convention:** `feat(ares-v2):` prefix for all commits. Conventional commits format.

**Push after each phase** — not after every task. Phases are the deployment units.

---

## Session SOP

At the end of every working session:
1. **Devlog** — update `docs/devlog/modules/data-explorer/ares-v2-progress.md`
2. **Commit** — conventional commits; never stage secrets
3. **Push** — `git push origin main`
4. **Deploy** — `./deploy.sh`
