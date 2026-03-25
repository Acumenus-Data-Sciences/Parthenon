# Ares v2 Phase C — Advanced Capabilities Implementation Plan

**Date:** 2026-03-24
**Spec:** `docs/superpowers/specs/2026-03-24-ares-v2-design.md` (Section 6, Phases C + D)
**Depends on:** Ares v2 Phase A + Phase B completed
**Scope:** ~15 higher-effort enhancements + 5 Phase D differentiators (implemented first)

---

## Implementation Order

Phase D differentiators are implemented **first** within Phase C because they are competitive differentiators with no equivalent in OHDSI or commercial tools. After that, remaining Phase C items are grouped by service/capability cluster.

| Group | Items | Est. Tasks |
|-------|-------|-----------|
| **D1: ConceptStandardizationService** | Age-sex standardized rates (Panel 2) | 8 |
| **D2: PatientArrivalForecastService** | Patient arrival rate forecast (Panel 5) | 7 |
| **D3: GIS Diversity Integration** | Geographic + socioeconomic diversity (Panel 6) | 8 |
| **D4: MappingSuggestionService** | AI-suggested concept mappings (Panel 8) | 10 |
| **D5: Cost Type Awareness** | Cost type filter + warnings (Panel 10) | 5 |
| **C1: DQ Radar + SLA + Export** | Panels 1, 3 | 9 |
| **C2: Temporal + Concept Sets + Benchmarks** | Panel 2 | 7 |
| **C3: Releases + ETL Provenance** | Panel 7 | 5 |
| **C4: Annotations Advanced** | Panel 9 | 8 |
| **C5: Cost Advanced** | Panel 10 | 6 |
| **C6: Coverage Export + Diversity Trends** | Panels 4, 6 | 5 |

---

## D1: ConceptStandardizationService — Age-Sex Standardized Rates

**Why first:** No OHDSI tool provides age-sex direct standardization. Crude rates are misleading when comparing sources with different age/sex distributions. This is a genuine analytical capability gap.

### Backend Tasks

**D1.1: Create `ConceptStandardizationService`**
- File: `backend/app/Services/Ares/ConceptStandardizationService.php`
- Inject `DynamicConnectionFactory`
- Method: `standardize(int $conceptId, string $method = 'direct'): array`
  - For each source with a results daimon:
    1. Query Achilles analysis 10 (year of birth x gender) to get age-sex population structure
    2. Query concept prevalence stratified by age-sex (analysis 402/702/602/etc. for gender, cross-tab with age from analysis 404/704/604/etc.)
    3. Apply direct standardization using a reference population (US Census 2020 or WHO standard population — store as a config constant)
    4. Return `{ source_id, source_name, crude_rate, standardized_rate, confidence_interval_lower, confidence_interval_upper }`
- Reference population weights stored in `config/ares.php` as `'reference_population'` array keyed by `age_group:gender`
- Wilson score interval for confidence intervals: `p +/- z * sqrt(p(1-p)/n)`

**D1.2: Add config for reference population**
- File: `backend/config/ares.php` (new file)
- Contains:
  - `reference_population` — US Census 2020 age-sex weights (10 age deciles x 2 genders = 20 strata)
  - `domain_weights` — for unmapped code impact scoring (condition=1.0, drug=0.9, etc.)
  - Documented with CDC source citations

**D1.3: Controller endpoint**
- File: `backend/app/Http/Controllers/Api/V1/NetworkAresController.php`
- Method: `compareStandardized(Request $request): JsonResponse`
- Endpoint: `GET /network/ares/compare/standardized?concept_id={id}&method=direct`
- Validate: `concept_id` required integer, `method` in `[direct]`
- Rate limit: `throttle:20,1` (computationally expensive — iterates all sources x age-sex strata)

**D1.4: Route registration**
- File: `backend/routes/api.php`
- Add inside `network/ares` group:
  ```
  Route::get('/compare/standardized', [NetworkAresController::class, 'compareStandardized'])
      ->middleware(['permission:analyses.view', 'throttle:20,1']);
  ```

**D1.5: Unit tests**
- File: `backend/tests/Unit/Services/Ares/ConceptStandardizationServiceTest.php`
- Test standardization math with known population data
- Test fallback when age-sex strata are missing (return crude rate with warning)
- Test empty source handling

### Frontend Tasks

**D1.6: TypeScript types**
- File: `frontend/src/features/data-explorer/types/ares.ts`
- Add:
  ```typescript
  export interface StandardizedComparison {
    source_id: number;
    source_name: string;
    crude_rate: number;
    standardized_rate: number;
    ci_lower: number;
    ci_upper: number;
    person_count: number;
  }
  ```

**D1.7: API hook**
- File: `frontend/src/features/data-explorer/components/ares/concept-comparison/api.ts` (or existing api file)
- Add TanStack Query hook: `useStandardizedComparison(conceptId: number, enabled: boolean)`

**D1.8: Rate toggle UI**
- File: `frontend/src/features/data-explorer/components/ares/concept-comparison/` (existing comparison view)
- Add toggle: "Crude Rate" / "Age-Sex Adjusted"
- When adjusted selected, call standardized endpoint instead of regular compare
- Show confidence interval error bars via Recharts `ErrorBar` component
- Show footnote: "Standardized to US Census 2020 population"

---

## D2: PatientArrivalForecastService — Monthly Accrual Projection

**Why:** TriNetX's killer feature. Answers "how long will enrollment take?" for passing feasibility sources.

### Backend Tasks

**D2.1: Create `PatientArrivalForecastService`**
- File: `backend/app/Services/Ares/PatientArrivalForecastService.php`
- Inject `DynamicConnectionFactory`
- Method: `forecast(int $assessmentId, int $sourceId, int $months = 24): array`
  - For the passing source:
    1. Get required concept IDs from the feasibility assessment criteria
    2. For each concept, query Achilles monthly trend data (analysis 411/711/611/1811/811 — concept by month) to get historical monthly new patient counts
    3. Compute intersection: monthly patients with ALL required concepts (using person-level overlap from observation_period analysis or approximation from concept co-occurrence)
    4. Fit simple linear regression on last 12 months of historical data
    5. Project forward `$months` months with trend + seasonality (12-month moving average for seasonal adjustment)
    6. Return `{ source_id, source_name, historical: [{month, patient_count}], projected: [{month, projected_count, lower_bound, upper_bound}], monthly_rate, months_to_target }`
  - `months_to_target`: if feasibility criteria has `min_patients`, compute when projected cumulative count reaches target

**D2.2: Controller endpoint**
- File: `backend/app/Http/Controllers/Api/V1/NetworkAresController.php`
- Method: `feasibilityForecast(int $id, Request $request): JsonResponse`
- Endpoint: `GET /network/ares/feasibility/{id}/forecast?source_id={sid}&months=24`
- Validate: assessment exists, source passed feasibility, months in 6-60

**D2.3: Route registration**
- Add inside `network/ares` group:
  ```
  Route::get('/feasibility/{id}/forecast', [NetworkAresController::class, 'feasibilityForecast'])
      ->middleware(['permission:analyses.view', 'throttle:10,1']);
  ```

**D2.4: Unit tests**
- File: `backend/tests/Unit/Services/Ares/PatientArrivalForecastServiceTest.php`
- Test linear regression with known data
- Test projection bounds are wider as months increase
- Test handling of sources with insufficient historical data (<6 months)

### Frontend Tasks

**D2.5: TypeScript types**
- Add to `ares.ts`:
  ```typescript
  export interface ArrivalForecast {
    source_id: number;
    source_name: string;
    historical: Array<{ month: string; patient_count: number }>;
    projected: Array<{ month: string; projected_count: number; lower_bound: number; upper_bound: number }>;
    monthly_rate: number;
    months_to_target: number | null;
  }
  ```

**D2.6: API hook**
- Add TanStack Query hook: `useFeasibilityForecast(assessmentId: number, sourceId: number, months?: number)`

**D2.7: ArrivalForecastChart component**
- File: `frontend/src/features/data-explorer/components/ares/feasibility/ArrivalForecastChart.tsx`
- Recharts `ComposedChart` with:
  - Solid line for historical data
  - Dashed line for projected data
  - `ReferenceArea` for confidence band (lower_bound to upper_bound, 20% opacity)
  - `ReferenceLine` for target patient count (if set in criteria)
  - Annotation showing `months_to_target` ("Target reached in ~14 months")
- Accessible from feasibility results: click a passing source row to open forecast

---

## D3: GIS Diversity Integration — Geographic + Socioeconomic Diversity

**Why:** FDA DAP compliance ahead of all competitors. No OHDSI tool integrates geographic/SES diversity.

### Backend Tasks

**D3.1: Create diversity GIS bridge method**
- File: `backend/app/Services/Ares/DiversityService.php` (extend existing)
- Method: `getGeographicDiversity(Source $source): array`
  - Query person table (via OMOP connection) for distinct location_id values
  - Join to location table for state/zip
  - If GIS module has ADI (Area Deprivation Index) data loaded: join ZIP to `gis.adi_data` table
  - Return `{ state_distribution: {state: count}, adi_distribution: {decile: count}, geographic_reach: number_of_states, median_adi: float }`
- Method: `getNetworkGeographicDiversity(): array` — aggregate across sources

**D3.2: Controller endpoints**
- File: `backend/app/Http/Controllers/Api/V1/NetworkAresController.php`
- Method: `diversityGeographic(): JsonResponse`
- Endpoint: `GET /network/ares/diversity/geographic`
- Returns per-source geographic breakdown + network aggregate

**D3.3: Route registration**
- Add inside `network/ares` group:
  ```
  Route::get('/diversity/geographic', [NetworkAresController::class, 'diversityGeographic'])
      ->middleware('permission:analyses.view');
  ```

**D3.4: Unit tests**
- Test with sources that have location data
- Test graceful degradation when GIS/ADI data not loaded (return empty, not error)

### Frontend Tasks

**D3.5: TypeScript types**
- Add to `ares.ts`:
  ```typescript
  export interface GeographicDiversity {
    source_id: number;
    source_name: string;
    state_distribution: Record<string, number>;
    adi_distribution: Record<string, number>;
    geographic_reach: number;
    median_adi: number | null;
  }
  ```

**D3.6: API hook**
- Add TanStack Query hook: `useGeographicDiversity()`

**D3.7: Geographic diversity UI**
- File: `frontend/src/features/data-explorer/components/ares/diversity/GeographicDiversityView.tsx`
- State distribution: horizontal bar chart showing top states per source
- ADI distribution: histogram showing ADI decile distribution
- Geographic reach card: "X states covered"
- Median ADI card with rating (low ADI = disadvantaged areas represented)

**D3.8: Integration into diversity panel**
- Add Geographic tab/section to existing diversity panel
- Show alongside existing gender/race/ethnicity views

---

## D4: MappingSuggestionService — AI-Powered Concept Mapping

**Why:** pgvector-powered concept similarity is a genuine competitive differentiator. No other OHDSI tool offers AI-suggested mappings.

### Backend Tasks

**D4.1: Create `MappingSuggestionService`**
- File: `backend/app/Services/Ares/MappingSuggestionService.php`
- Inject: `DynamicConnectionFactory`
- Method: `suggest(string $sourceCode, string $sourceVocabularyId, int $limit = 5): array`
  - Generate text embedding for `$sourceCode` description using pgvector
  - Query `concept_embeddings` table (existing, uses `Pgvector\Laravel\HasNeighbors`) for nearest neighbors where `standard_concept = 'S'`
  - Use cosine distance: `->nearestNeighbors('embedding', $queryEmbedding, Distance::Cosine)->take($limit)`
  - Return `[{ concept_id, concept_name, domain_id, vocabulary_id, confidence_score, distance }]`
  - Confidence score = `1 - distance` (cosine distance 0-1 → confidence 1-0)
- Method: `suggestForUnmappedCode(int $unmappedCodeId): array`
  - Load `UnmappedSourceCode` by ID
  - Call `suggest()` with source_code text
  - Return suggestions with unmapped code context

**D4.2: Create `app.accepted_mappings` migration**
- File: `backend/database/migrations/xxxx_create_accepted_mappings_table.php`
- Schema:
  ```
  app.accepted_mappings:
    id                  bigint PK auto
    unmapped_code_id    bigint FK -> unmapped_source_codes.id
    source_code         varchar(255)
    source_vocabulary_id varchar(50)
    target_concept_id   integer
    target_concept_name varchar(255)
    confidence_score    float nullable
    status              varchar(20) default 'pending_approval'  -- pending_approval, approved, rejected
    accepted_by         bigint FK -> users.id
    approved_by         bigint FK -> users.id nullable
    accepted_at         timestamp
    approved_at         timestamp nullable
    created_at          timestamp
    updated_at          timestamp
  ```
- **HIGHSEC:** This table lives in `app` schema, NOT in `omop`. CdmModel is read-only. Mapping acceptance writes here, not to `source_to_concept_map`.

**D4.3: Create `AcceptedMapping` model**
- File: `backend/app/Models/App/AcceptedMapping.php`
- Extends base `Model` (NOT CdmModel)
- Connection: `pgsql` (default, app schema)
- `$fillable`: all columns except `id`, `created_at`, `updated_at`
- Relations: `belongsTo(User::class, 'accepted_by')`, `belongsTo(User::class, 'approved_by')`, `belongsTo(UnmappedSourceCode::class, 'unmapped_code_id')`

**D4.4: Controller endpoints — suggestions**
- File: `backend/app/Http/Controllers/Api/V1/AresController.php` (source-scoped)
- Method: `unmappedCodeSuggestions(Source $source, int $codeId): JsonResponse`
- Endpoint: `GET /sources/{source}/ares/unmapped-codes/{codeId}/suggestions`
- Returns top 5 AI-suggested standard concepts with confidence scores

**D4.5: Controller endpoints — accept mapping**
- Method: `acceptMapping(Request $request, Source $source, int $codeId): JsonResponse`
- Endpoint: `POST /sources/{source}/ares/unmapped-codes/{codeId}/map`
- Validate: `target_concept_id` required integer, `confidence_score` optional float
- Creates `AcceptedMapping` with status `pending_approval`
- Requires `permission:mapping.review`

**D4.6: Controller endpoints — promote mapping (admin)**
- File: `backend/app/Http/Controllers/Api/V1/AdminController.php` (or new `MappingAdminController`)
- Method: `promoteMapping(int $mappingId): JsonResponse`
- Endpoint: `POST /admin/mappings/{id}/promote`
- Middleware: `role:admin|super-admin|data-steward`, `permission:mapping.override`
- Copies approved mapping to `source_to_concept_map` via raw SQL on the `omop` connection (controlled write, not via CdmModel)
- Updates `AcceptedMapping` status to `approved`, sets `approved_by` and `approved_at`

**D4.7: Route registration**
- Source-scoped routes inside existing `sources/{source}/ares` group:
  ```
  Route::get('/unmapped-codes/{codeId}/suggestions', ...)
      ->middleware(['permission:analyses.view', 'throttle:30,1']);
  Route::post('/unmapped-codes/{codeId}/map', ...)
      ->middleware('permission:mapping.review');
  ```
- Admin route:
  ```
  Route::post('/admin/mappings/{id}/promote', ...)
      ->middleware(['role:admin|super-admin|data-steward', 'permission:mapping.override']);
  ```

**D4.8: Unit tests**
- File: `backend/tests/Unit/Services/Ares/MappingSuggestionServiceTest.php`
- Test pgvector similarity query returns ranked results
- Test confidence score calculation
- Test empty embedding fallback (source code with no embedding match)

### Frontend Tasks

**D4.9: TypeScript types**
- Add to `ares.ts`:
  ```typescript
  export interface MappingSuggestion {
    concept_id: number;
    concept_name: string;
    domain_id: string;
    vocabulary_id: string;
    confidence_score: number;
    distance: number;
  }

  export interface AcceptedMapping {
    id: number;
    unmapped_code_id: number;
    source_code: string;
    target_concept_id: number;
    target_concept_name: string;
    confidence_score: number | null;
    status: 'pending_approval' | 'approved' | 'rejected';
    accepted_by: number;
    approved_by: number | null;
    accepted_at: string;
    approved_at: string | null;
  }
  ```

**D4.10: Suggestion UI in unmapped codes table**
- File: `frontend/src/features/data-explorer/components/ares/unmapped-codes/MappingSuggestionPanel.tsx`
- Expandable row or slide-in panel per unmapped code
- Shows top 5 suggestions with confidence bar (0-100%)
- Accept / Review / Skip buttons per suggestion
- Accept calls `POST .../map` and shows success toast
- API hooks: `useUnmappedCodeSuggestions(sourceId, codeId)`, `useAcceptMapping()`

---

## D5: Cost Type Awareness with Warnings

**Why:** Prevents the most common HEOR analysis error. Cost types (paid/charged/allowed) can differ 3-10x.

### Backend Tasks

**D5.1: Extend `CostService`**
- File: `backend/app/Services/Ares/CostService.php`
- Method: `getAvailableCostTypes(Source $source): array`
  - Query `cost.cost_type_concept_id` distinct values
  - Resolve concept names
  - Return `[{ concept_id, concept_name, record_count }]`
- Method: `getCostTypeWarning(Source $source): ?string`
  - If multiple cost types exist, return warning message: "This source contains X cost types (paid, charged, allowed). Mixing types can distort analysis by 3-10x. Filter to a single type."
  - If only one type, return null
- Modify existing `getSummary()` and `getTrends()` to accept optional `?int $costTypeConceptId` filter parameter
- Add `cost_type_concept_id` filter to all cost SQL queries when provided

**D5.2: Controller updates**
- Add `costTypes` method to `AresController` (source-scoped):
  - `GET /sources/{source}/ares/cost/types`
- Extend existing cost endpoints to accept `?cost_type_concept_id=` query parameter

**D5.3: Route registration**
- Add inside `sources/{source}/ares` group:
  ```
  Route::get('/cost/types', [AresController::class, 'costTypes'])
      ->middleware('permission:analyses.view');
  ```

**D5.4: Unit tests**
- Test cost type detection
- Test warning message generation
- Test filtered cost queries

### Frontend Tasks

**D5.5: Cost type toggle + warning banner**
- File: `frontend/src/features/data-explorer/components/ares/cost/CostTypeSelector.tsx`
- Dropdown to select cost type (or "All Types" with warning)
- Warning banner component: amber background, explains cost type mixing risk
- Pass selected cost type to all cost API calls
- API hook: `useCostTypes(sourceId)`

---

## C1: DQ Radar Profile + SLA Dashboard + Export

### Backend Tasks

**C1.1: DQ radar profile data**
- File: `backend/app/Services/Ares/DqHistoryService.php` (extend)
- Method: `getRadarProfile(Source $source): array`
  - Query latest release's DQD results grouped by Kahn DQ dimension (category field maps to: completeness, conformance_value, conformance_relational, plausibility_atemporal, plausibility_temporal)
  - Return `{ source_id, source_name, dimensions: { completeness: float, conformance_value: float, ... } }`
- Method: `getNetworkRadarProfiles(): array` — all sources' radar data for comparison

**C1.2: DQ SLA table + endpoints**
- Migration: `create_dq_sla_targets_table.php`
  ```
  app.dq_sla_targets:
    id          bigint PK auto
    source_id   bigint FK -> sources.id
    category    varchar(50)
    min_pass_rate float
    created_by  bigint FK -> users.id
    created_at  timestamp
    updated_at  timestamp
  ```
- Model: `backend/app/Models/App/DqSlaTarget.php`
- Controller method: `storeDqSla(Request $request, Source $source)` and `getDqSla(Source $source)`
- **HIGHSEC:** `POST /sources/{source}/ares/dq-sla` requires `role:admin|super-admin|data-steward`
- `GET /sources/{source}/ares/dq-sla/compliance` — computes current compliance vs targets

**C1.3: DQ SLA compliance computation**
- Method in `DqHistoryService`: `getSlaCompliance(Source $source): array`
  - Load SLA targets for source
  - Compare current category pass rates vs targets
  - Return `[{ category, target, actual, compliant: bool, error_budget_remaining: float }]`

**C1.4: DQ export endpoint**
- `GET /sources/{source}/ares/dq-history/export?format=csv`
- Returns CSV of all DQ trend data + deltas for the source
- PDF format deferred (requires wkhtmltopdf or similar — out of scope for initial implementation, add as follow-up)

**C1.5: Regression root cause linking**
- Method in `DqHistoryService`: `getRegressionContext(Source $source, int $releaseId, string $checkId): array`
  - Query `chart_annotations` where `x_value` matches release date and `source_id` matches
  - Query `source_releases` for release metadata (etl_version change, vocab version change)
  - Return `{ annotations: [...], release_changes: { vocab_changed: bool, etl_changed: bool, ... } }`

**C1.6: Routes**
```
Route::get('/sources/{source}/ares/dq-radar', ...) → permission:analyses.view
Route::post('/sources/{source}/ares/dq-sla', ...) → role:admin|super-admin|data-steward
Route::get('/sources/{source}/ares/dq-sla', ...) → permission:analyses.view
Route::get('/sources/{source}/ares/dq-sla/compliance', ...) → permission:analyses.view
Route::get('/sources/{source}/ares/dq-history/export', ...) → permission:analyses.view
Route::get('/network/ares/dq-radar', ...) → permission:analyses.view
```

### Frontend Tasks

**C1.7: RadarChart component**
- File: `frontend/src/features/data-explorer/components/ares/network-overview/DqRadarChart.tsx`
- Recharts `RadarChart` with 5 spokes for Kahn dimensions
- Per-source overlay (different colors, max 5 sources at once)
- Accessible from Network Overview via expand/click on source row

**C1.8: DQ SLA dashboard**
- File: `frontend/src/features/data-explorer/components/ares/dq-history/DqSlaDashboard.tsx`
- SLA definition form (admin only — check user role before rendering)
- Compliance chart: horizontal bars per category, green/red vs target line
- Error budget burn-down sparkline

**C1.9: Export button**
- Add export button to DQ History view header
- Call export endpoint, trigger browser download

---

## C2: Temporal Prevalence + Concept Sets + Population Benchmarks

### Backend Tasks

**C2.1: Temporal prevalence trends**
- Method in `NetworkComparisonService`: `getTemporalPrevalence(int $conceptId): array`
  - For each source, query concept prevalence per release (from DQD results or Achilles monthly data per release)
  - Return `{ sources: [{ source_id, source_name, trend: [{release_name, rate_per_1000}] }] }`

**C2.2: Concept set comparison**
- Method in `NetworkComparisonService`: `compareConceptSet(array $conceptIds): array`
  - Accept list of concept IDs (from a concept set or manual selection)
  - Return aggregate prevalence across all concepts in the set per source
  - Approach: sum patient counts with any concept in the set (union), not sum of individual rates

**C2.3: Population benchmark overlay**
- Add to `config/ares.php`: `benchmarks` array with published CDC/GBD prevalence rates for common conditions keyed by concept_id
- Method: `getBenchmark(int $conceptId): ?float` — returns national prevalence rate per 1000 if available
- Extend compare endpoint response to include `benchmark_rate` field

**C2.4: Routes**
```
Route::get('/network/ares/compare/temporal', ...) → permission:analyses.view
Route::get('/network/ares/compare/concept-set', ...) → permission:analyses.view, throttle:20,1
```

### Frontend Tasks

**C2.5: Temporal prevalence chart**
- File: `frontend/src/features/data-explorer/components/ares/concept-comparison/TemporalPrevalenceChart.tsx`
- Recharts `LineChart` with one line per source, X=release, Y=rate per 1000
- Toggle between single concept and concept set modes

**C2.6: Concept set selector**
- Multi-concept chip selector extended to support concept set IDs
- "Load Concept Set" button that resolves set → individual concept IDs

**C2.7: Benchmark line overlay**
- Add dashed `ReferenceLine` on comparison bar chart for benchmark value
- Label: "CDC National Rate: X per 1000"
- Only shown when benchmark data exists for selected concept

---

## C3: Releases — ETL Provenance Metadata

### Backend Tasks

**C3.1: Migration — add etl_metadata to source_releases**
- File: `backend/database/migrations/xxxx_add_etl_metadata_to_source_releases.php`
- Add `etl_metadata` jsonb nullable column to `app.source_releases`
- Structure: `{ who: string, code_version: string, parameters: object, duration_seconds: int, started_at: string }`

**C3.2: Update SourceRelease model**
- Add `etl_metadata` to `$fillable` and `$casts` (cast to `array`)

**C3.3: Update release create/update endpoints**
- Extend `StoreReleaseRequest` and `UpdateReleaseRequest` to accept `etl_metadata` as optional validated JSON object

**C3.4: Unit tests**
- Test ETL metadata round-trip (store and retrieve)
- Test partial update of release with etl_metadata

### Frontend Tasks

**C3.5: ETL provenance section in release cards**
- Collapsible section in release detail card
- Show: who ran it, code version, runtime duration, parameters
- Only visible when `etl_metadata` is populated

---

## C4: Annotations — Chart-Anchored Markers + Threaded Discussions

### Backend Tasks

**C4.1: Migration — add tag and parent_id to chart_annotations**
- File: `backend/database/migrations/xxxx_add_tag_parent_id_to_chart_annotations.php`
- Add `tag` varchar(30) nullable, default null. Values: `data_event`, `research_note`, `action_item`, `system`
- Add `parent_id` bigint nullable FK -> `chart_annotations.id` (self-referential, flat threading — max 1 level of nesting)

**C4.2: Update ChartAnnotation model**
- Add `tag` and `parent_id` to `$fillable`
- Add relation: `replies()` → `hasMany(ChartAnnotation::class, 'parent_id')`
- Add relation: `parent()` → `belongsTo(ChartAnnotation::class, 'parent_id')`
- Add scope: `scopeRootAnnotations($query)` → `whereNull('parent_id')`

**C4.3: Extend annotation endpoints**
- Update `StoreAnnotationRequest` to accept optional `tag` (enum validation) and `parent_id` (exists validation)
- Extend list endpoint to support query params: `?tag=system&search=vocab&sort=created_at`
- When listing annotations, eager load `replies` (max 1 level)

**C4.4: Search endpoint**
- `GET /sources/{source}/ares/annotations?search=vocab&tag=system`
- Full-text search on `annotation_text` using PostgreSQL `ILIKE`

### Frontend Tasks

**C4.5: AnnotationMarker component**
- File: `frontend/src/features/data-explorer/components/ares/annotations/AnnotationMarker.tsx`
- Small 4-6px dot at 40% opacity, positioned at chart x-coordinates
- Hover: scale up, show popover with annotation text + creator + date
- Click: expand full annotation detail

**C4.6: Retrofit markers into existing charts**
- Add `AnnotationMarker` layer to:
  - DQ trend chart (`DqTrendChart`)
  - Cost trend chart
  - Domain continuity chart
- Query annotations for the chart_type and source_id, position markers at matching x_value

**C4.7: Tag filter bar**
- Tag filter pills at top of annotations view: All | Data Event | Research Note | Action Item | System
- Color-coded badges on annotation cards by tag

**C4.8: Threaded discussions UI**
- Reply button on annotation cards
- Indented reply cards below parent (1 level only)
- Reply form: text input + submit button
- Uses existing store annotation endpoint with `parent_id` set

---

## C5: Cost Analysis — Cross-Source Comparison + Cost Drivers

### Backend Tasks

**C5.1: Cross-source cost comparison**
- Method in `CostService`: `getNetworkCostComparison(string $domain, ?int $costTypeConceptId = null): array`
  - For each source with cost data:
    - Compute distribution stats (min, p10, p25, median, p75, p90, max) using SQL percentile functions
    - Return per-source box plot data
  - Return `{ sources: [{ source_id, source_name, distribution: { min, p10, p25, median, p75, p90, max } }] }`

**C5.2: Cost drivers endpoint**
- Method in `CostService`: `getCostDrivers(Source $source, int $limit = 10): array`
  - Query cost table joined to relevant domain tables (condition_occurrence, drug_exposure, procedure_occurrence)
  - Group by concept_id, sum total_cost, count records, count patients
  - Return top N concepts by total cost: `[{ concept_id, concept_name, domain, total_cost, record_count, patient_count, pct_of_total }]`

**C5.3: Routes**
```
Route::get('/network/ares/cost/compare', ...) → permission:analyses.view
Route::get('/sources/{source}/ares/cost/drivers', ...) → permission:analyses.view
```

### Frontend Tasks

**C5.4: Cross-source cost box plots**
- File: `frontend/src/features/data-explorer/components/ares/cost/CrossSourceCostChart.tsx`
- Small-multiples box plots, one per source
- Custom Recharts shape component for box-and-whisker rendering

**C5.5: Cost drivers treemap/bars**
- File: `frontend/src/features/data-explorer/components/ares/cost/CostDriversView.tsx`
- Horizontal bar chart showing top 10 cost drivers
- Each bar shows concept name, total cost, % of total
- Click bar to drill down into concept detail (existing concept drilldown)

**C5.6: Integration**
- Add "Cross-Source" toggle to cost analysis panel
- Add "Cost Drivers" tab/section to cost analysis panel

---

## C6: Coverage Export + Diversity Trends

### Backend Tasks

**C6.1: Coverage export endpoint**
- `GET /network/ares/coverage/export?format=csv`
- Returns coverage matrix as CSV download
- Format: Source rows x Domain columns, cells contain record counts
- PDF format: deferred (same as DQ export — follow-up task)

**C6.2: Diversity trends over releases**
- Method in `DiversityService`: `getDiversityTrends(Source $source): array`
  - For each release, query Achilles demographic analyses (2, 4, 5) using the release-specific results schema
  - Return `{ releases: [{ release_name, gender: {...}, race: {...}, ethnicity: {...} }] }`
  - If per-release demographic data is not available (Achilles doesn't store per-release demographics in standard schema), compute Simpson's Diversity Index per release from DQD results and return as sparkline data

### Frontend Tasks

**C6.3: Coverage export button**
- Add export button to coverage matrix view header
- Trigger browser CSV download

**C6.4: Diversity trend sparklines**
- Add sparkline column to diversity table showing diversity index change over releases
- Recharts `Sparkline` or inline SVG showing 6-point trend

**C6.5: Diversity trends view**
- File: `frontend/src/features/data-explorer/components/ares/diversity/DiversityTrendsChart.tsx`
- Line chart showing Simpson's Diversity Index per source over releases
- Toggle between gender/race/ethnicity dimensions

---

## New Database Tables Summary

| Table | Schema | Purpose | Migration |
|-------|--------|---------|-----------|
| `app.accepted_mappings` | app | Staging for AI-accepted concept mappings (two-stage: accept → admin promote) | D4.2 |
| `app.dq_sla_targets` | app | Per-source DQ quality SLA thresholds | C1.2 |

## Altered Existing Tables Summary

| Table | Change | Migration |
|-------|--------|-----------|
| `app.source_releases` | Add `etl_metadata` jsonb nullable | C3.1 |
| `app.chart_annotations` | Add `tag` varchar(30) nullable, `parent_id` bigint FK nullable | C4.1 |

## New Backend Services Summary

| Service | File | Purpose |
|---------|------|---------|
| `ConceptStandardizationService` | `backend/app/Services/Ares/ConceptStandardizationService.php` | Age-sex direct standardization for concept prevalence rates |
| `PatientArrivalForecastService` | `backend/app/Services/Ares/PatientArrivalForecastService.php` | Monthly patient accrual projection from historical data |
| `MappingSuggestionService` | `backend/app/Services/Ares/MappingSuggestionService.php` | pgvector concept embedding similarity for AI mapping suggestions |

## New Config Files

| File | Purpose |
|------|---------|
| `backend/config/ares.php` | Reference population weights, domain weights, CDC benchmark rates |

## New API Endpoints Summary

| Method | Endpoint | Middleware | Group |
|--------|----------|-----------|-------|
| GET | `/network/ares/compare/standardized` | `permission:analyses.view`, `throttle:20,1` | D1 |
| GET | `/network/ares/feasibility/{id}/forecast` | `permission:analyses.view`, `throttle:10,1` | D2 |
| GET | `/network/ares/diversity/geographic` | `permission:analyses.view` | D3 |
| GET | `/sources/{source}/ares/unmapped-codes/{codeId}/suggestions` | `permission:analyses.view`, `throttle:30,1` | D4 |
| POST | `/sources/{source}/ares/unmapped-codes/{codeId}/map` | `permission:mapping.review` | D4 |
| POST | `/admin/mappings/{id}/promote` | `role:admin\|super-admin\|data-steward`, `permission:mapping.override` | D4 |
| GET | `/sources/{source}/ares/cost/types` | `permission:analyses.view` | D5 |
| GET | `/sources/{source}/ares/dq-radar` | `permission:analyses.view` | C1 |
| GET | `/network/ares/dq-radar` | `permission:analyses.view` | C1 |
| POST | `/sources/{source}/ares/dq-sla` | `role:admin\|super-admin\|data-steward` | C1 |
| GET | `/sources/{source}/ares/dq-sla` | `permission:analyses.view` | C1 |
| GET | `/sources/{source}/ares/dq-sla/compliance` | `permission:analyses.view` | C1 |
| GET | `/sources/{source}/ares/dq-history/export` | `permission:analyses.view` | C1 |
| GET | `/network/ares/compare/temporal` | `permission:analyses.view` | C2 |
| GET | `/network/ares/compare/concept-set` | `permission:analyses.view`, `throttle:20,1` | C2 |
| GET | `/network/ares/cost/compare` | `permission:analyses.view` | C5 |
| GET | `/sources/{source}/ares/cost/drivers` | `permission:analyses.view` | C5 |
| GET | `/network/ares/coverage/export` | `permission:analyses.view` | C6 |

## HIGHSEC Compliance Checklist

- [x] All endpoints behind `auth:sanctum` (inherited from route group)
- [x] Permission middleware on every route (view/create/review/override as appropriate)
- [x] DQ SLA write endpoint restricted to `role:admin|super-admin|data-steward`
- [x] Mapping promotion restricted to `role:admin|super-admin|data-steward` + `permission:mapping.override`
- [x] AI suggestion endpoints rate-limited (`throttle:30,1` and `throttle:20,1`)
- [x] CdmModel remains read-only — mapping writes go to `app.accepted_mappings` staging table
- [x] Mapping promotion to `source_to_concept_map` is a controlled admin-only action
- [x] No PHI exposure — all data is aggregate-level
- [x] `AcceptedMapping` model uses `$fillable` (no `$guarded = []`)
- [x] `DqSlaTarget` model uses `$fillable` (no `$guarded = []`)
- [x] No new public (unauthenticated) routes

## Testing Strategy

- **Unit tests** per new service method (ConceptStandardizationService, PatientArrivalForecastService, MappingSuggestionService)
- **Integration tests** per new API endpoint (validate auth, permissions, response structure)
- **Frontend component tests** for new chart types (RadarChart, ArrivalForecastChart, AnnotationMarker, CostBoxPlot)
- All tests target `parthenon_testing` database on `pgsql.acumenus.net`
- Target: 80%+ coverage on new code
