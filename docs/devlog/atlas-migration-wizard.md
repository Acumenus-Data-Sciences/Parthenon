# Atlas Migration Wizard

**Date:** 2026-03-05
**Phase:** Administration — Atlas Migration
**Status:** Shipped

## What Was Built

A comprehensive multi-step wizard in the Admin panel that connects to a live OHDSI Atlas/WebAPI instance and migrates all analysis entities into Parthenon. This replaces the manual CLI-only import workflow with a guided, visual experience.

## Architecture

### Backend

**Database Tables:**
- `atlas_migrations` — tracks each migration run (URL, auth, status, progress counters, selected/discovery/import/validation results as JSON)
- `atlas_id_mappings` — maps every `atlas_id → parthenon_id` per entity type, enabling ID remapping in embedded JSON references

**Services:**
- `AtlasDiscoveryService` — tests WebAPI connectivity and performs parallel inventory discovery via `Http::pool()` across 8 entity endpoints
- `AtlasEntityImporter` — imports entities in dependency order with fail-safe per-entity error handling and automatic ID remapping

**Controller:** `AtlasMigrationController` with 6 endpoints:
- `POST /test-connection` — verify WebAPI reachability
- `POST /discover` — parallel inventory of all entity types
- `POST /start` — begin migration with selected entities
- `GET /{id}/status` — poll progress (frontend polls every 2s)
- `GET /history` — list past migration runs
- `POST /{id}/retry` — retry failed entities only

### Frontend

**Wizard (5 steps), matching SetupWizard UX pattern:**
1. **Connect** — WebAPI URL + auth (none/basic/bearer), test connection button
2. **Discover** — parallel fetch of entity inventories, card grid with counts
3. **Select** — expandable per-category checklists with Select All, dependency warnings
4. **Import** — progress bar, per-entity-type breakdown, real-time polling
5. **Summary** — final report with imported/skipped/failed, retry option, migration history

**Admin Integration:**
- New "Migrate from Atlas" card on Admin Dashboard (rose-500, ArrowRightLeft icon)
- Route: `/admin/atlas-migration`

## Key Design Decisions

### Dependency-Ordered Import
Entities are imported in strict dependency order: concept_sets → cohort_definitions → incidence_rates → characterizations → pathways → estimations → predictions. This ensures that when higher-level entities reference cohort/concept set IDs in their JSON, those IDs have already been mapped.

### ID Remapping
WebAPI entity IDs differ from Parthenon IDs. The importer maintains an `atlas_id_mappings` table and rewrites:
- `ConceptSets[].id` in Circe cohort expressions
- `cohortId`, `targetId`, `comparatorId`, `outcomeId`, `targetCohortId`, `outcomeCohortId`, `comparatorCohortId` in analysis design JSONs

### Fail-Safe Import
One entity failing does not stop the migration. Each entity is wrapped in try/catch, and failures are recorded in `atlas_id_mappings` with status='failed' + error message. The retry endpoint re-imports only failed entities.

### Synchronous Execution
The import runs synchronously in the HTTP request. The frontend polls `/status` every 2 seconds for progress. For very large migrations (1000+ entities), this could be moved to a queued job — the architecture supports it since the `AtlasMigration` model tracks state independently.

## Entity Types Supported

| Entity | WebAPI Endpoint | Parthenon Model | Notes |
|--------|----------------|-----------------|-------|
| Concept Sets | `/conceptset/{id}/expression` | ConceptSet + ConceptSetItem | Items with concept_id + 3 boolean flags |
| Cohort Definitions | `/cohortdefinition/{id}` | CohortDefinition | Circe JSON with embedded concept set refs |
| Incidence Rates | `/ir/{id}` | IncidenceRateAnalysis | References cohort IDs |
| Characterizations | `/cohort-characterization/{id}` | Characterization | References fe_analysis + cohort IDs |
| Pathways | `/pathway-analysis/{id}` | PathwayAnalysis | References cohort definition IDs |
| Estimations | `/estimation/{id}` | EstimationAnalysis | Single JSON blob with cohort + concept set refs |
| Predictions | `/prediction/{id}` | PredictionAnalysis | Single JSON blob with cohort + concept set refs |

## Files Created/Modified

### New Files (10)
- `backend/database/migrations/2026_03_05_290001_create_atlas_migrations_table.php`
- `backend/app/Models/App/AtlasMigration.php`
- `backend/app/Models/App/AtlasIdMapping.php`
- `backend/app/Services/WebApi/AtlasDiscoveryService.php`
- `backend/app/Services/WebApi/AtlasEntityImporter.php`
- `backend/app/Http/Controllers/Api/V1/Admin/AtlasMigrationController.php`
- `frontend/src/features/administration/api/migrationApi.ts`
- `frontend/src/features/administration/hooks/useAtlasMigration.ts`
- `frontend/src/features/administration/pages/AtlasMigrationPage.tsx`
- `docs/devlog/atlas-migration-wizard.md`

### Modified Files (3)
- `backend/routes/api.php` — added 6 atlas-migration routes + controller import
- `frontend/src/app/router.tsx` — added `/admin/atlas-migration` route
- `frontend/src/features/administration/pages/AdminDashboardPage.tsx` — added "Migrate from Atlas" card

## UX Pattern Alignment

The wizard matches the existing SetupWizard UX exactly:
- Gold (#C9A227) stepper circles with connecting lines
- Check marks for completed steps, numbered circles for pending
- Slide animations between steps (wizardSlideFromRight/wizardSlideFromLeft)
- Navigation footer with Previous/Next buttons
- Same border, background, typography, and spacing conventions
