# Standard PROs+ Builder & Conduct Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clinical instrument Builder tab (custom item authoring with ATHENA concept search, drag-drop ordering, REDCap/FHIR import) and a Conduct tab (cohort-based survey campaigns with bulk import, manual proxy entry, and published self-report links via SurveyJS) to the Standard PROs+ module.

**Architecture:** Builder uses @coltorapps/builder (MIT headless state engine) + @dnd-kit (already installed) for drag-drop. Conduct uses SurveyJS Form Library (MIT) as runtime renderer with a TypeScript adapter converting native instrument model -> SurveyJS JSON. New survey_campaigns table with Draft->Active->Closed lifecycle. Campaign seeds survey_conduct rows from OHDSI cohort via CohortGenerationService.

**Tech Stack:** React 19, TypeScript strict, TanStack Query, Zustand, Tailwind 4, @coltorapps/builder-react, survey-core, survey-react-ui, papaparse, qrcode.react, @dnd-kit/sortable (existing). Laravel 11 backend with existing survey models + new campaign model.

**Spec:** `docs/superpowers/specs/2026-03-29-standard-pros-builder-conduct-design.md`

---

## File Structure

### Files to Create (Frontend)

| File | Responsibility |
|------|---------------|
| `frontend/src/features/standard-pros/components/builder/InstrumentMetadataForm.tsx` | Name, abbreviation, domain, version, scoring method |
| `frontend/src/features/standard-pros/components/builder/ScoringMethodEditor.tsx` | Type, range, subscales editor |
| `frontend/src/features/standard-pros/components/builder/ConceptPickerField.tsx` | ATHENA concept search wrapper |
| `frontend/src/features/standard-pros/components/builder/AnswerOptionsEditor.tsx` | Add/remove/reorder answer options |
| `frontend/src/features/standard-pros/components/builder/ItemEditor.tsx` | Right panel: edit selected item |
| `frontend/src/features/standard-pros/components/builder/SortableItemRow.tsx` | Single draggable item row |
| `frontend/src/features/standard-pros/components/builder/SortableItemList.tsx` | DndContext + SortableContext wrapper |
| `frontend/src/features/standard-pros/components/builder/InstrumentPanel.tsx` | Left panel: item list + toolbox |
| `frontend/src/features/standard-pros/components/builder/ImportInstrumentModal.tsx` | REDCap/FHIR/CSV import modal |
| `frontend/src/features/standard-pros/components/builder/BuilderTab.tsx` | Assembly: metadata + split panel |
| `frontend/src/features/standard-pros/lib/instrumentBuilder.ts` | Coltor entity/attribute/builder definitions |
| `frontend/src/features/standard-pros/lib/surveyBuilderStore.ts` | Zustand store wrapping Coltor |
| `frontend/src/features/standard-pros/lib/redcapParser.ts` | REDCap CSV -> instrument items |
| `frontend/src/features/standard-pros/lib/fhirParser.ts` | FHIR Questionnaire R4 -> instrument items |
| `frontend/src/features/standard-pros/components/conduct/CampaignCard.tsx` | Campaign summary card |
| `frontend/src/features/standard-pros/components/conduct/NewCampaignModal.tsx` | Create campaign modal |
| `frontend/src/features/standard-pros/components/conduct/ImportResponsesModal.tsx` | REDCap/CSV response import |
| `frontend/src/features/standard-pros/components/conduct/ManualEntryModal.tsx` | Proxy entry form |
| `frontend/src/features/standard-pros/components/conduct/PublishLinkPanel.tsx` | QR code + copy link |
| `frontend/src/features/standard-pros/components/conduct/ConductTab.tsx` | Assembly: campaign list |
| `frontend/src/features/standard-pros/api/campaignApi.ts` | Campaign API functions |
| `frontend/src/features/standard-pros/hooks/useCampaigns.ts` | Campaign hooks |
| `frontend/src/features/standard-pros/lib/instrumentToSurveyJs.ts` | Runtime adapter |
| `frontend/src/pages/PublicSurveyPage.tsx` | Public /survey/:token page |

### Files to Create (Backend)

| File | Responsibility |
|------|---------------|
| `backend/app/Models/Survey/SurveyCampaign.php` | Campaign model |
| `backend/app/Http/Controllers/Api/V1/SurveyCampaignController.php` | Campaign CRUD + lifecycle |
| `backend/app/Http/Controllers/Api/V1/SurveyConductController.php` | Manual proxy entry |
| `backend/app/Http/Controllers/Api/V1/SurveyRespondController.php` | Public survey submission |
| `backend/app/Services/Survey/CampaignSeedService.php` | Cohort -> survey_conduct rows |
| `backend/app/Services/Survey/SurveyImportService.php` | CSV/REDCap response import |
| `backend/app/Services/Survey/SurveyScoreService.php` | Score computation |
| `backend/app/Http/Requests/Api/StoreSurveyCampaignRequest.php` | Campaign validation |
| `backend/database/migrations/2026_03_30_000001_create_survey_campaigns_table.php` | Migration |

### Files to Modify

| File | Change |
|------|--------|
| `backend/app/Http/Controllers/Api/V1/SurveyInstrumentController.php` | Add `clone()` method |
| `backend/routes/api.php` | Add campaign + conduct + public routes |
| `frontend/src/features/standard-pros/pages/StandardProsPage.tsx` | Replace BuilderTab placeholder, add ConductTab |
| `frontend/src/features/standard-pros/api/surveyApi.ts` | Add mutation functions |
| `frontend/src/features/standard-pros/hooks/useSurveyInstruments.ts` | Add mutation hooks |
| `frontend/src/app/router.tsx` | Add /survey/:token public route |

---

## Phase 1: Foundation (Tasks 1-3)

### Task 1: Install NPM Packages

Install 6 new packages (@dnd-kit already present):

- [ ] **Step 1:** Install runtime dependencies
  ```bash
  cd frontend && npm install --legacy-peer-deps @coltorapps/builder @coltorapps/builder-react survey-core survey-react-ui papaparse qrcode.react
  ```

- [ ] **Step 2:** Install dev type declarations
  ```bash
  npm install --legacy-peer-deps -D @types/papaparse
  ```

- [ ] **Step 3:** Verify TypeScript compiles cleanly
  ```bash
  docker compose exec node sh -c "cd /app && npx tsc --noEmit"
  ```

- [ ] **Step 4:** Verify Vite build succeeds
  ```bash
  docker compose exec node sh -c "cd /app && npx vite build"
  ```

---

### Task 2: Database Migration

Create migration for `survey_campaigns` table + add `campaign_id` to `survey_conduct`.

- [ ] **Step 1:** Create migration file `backend/database/migrations/2026_03_30_000001_create_survey_campaigns_table.php`

  ```php
  Schema::create('survey_campaigns', function (Blueprint $table) {
      $table->id();
      $table->string('name');
      $table->foreignId('survey_instrument_id')->constrained('survey_instruments')->cascadeOnDelete();
      $table->unsignedBigInteger('cohort_generation_id')->nullable();
      $table->string('status', 20)->default('draft');  // draft, active, closed
      $table->string('publish_token', 64)->nullable()->unique();
      $table->text('description')->nullable();
      $table->timestamp('closed_at')->nullable();
      $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
      $table->timestamps();

      $table->index('status');
      $table->index('survey_instrument_id');
  });
  ```

- [ ] **Step 2:** Add `campaign_id` FK to `survey_conduct`
  ```php
  Schema::table('survey_conduct', function (Blueprint $table) {
      $table->foreignId('campaign_id')->nullable()->constrained('survey_campaigns')->nullOnDelete();
      $table->index('campaign_id');
  });
  ```

- [ ] **Step 3:** Make `person_id` nullable on `survey_conduct` (for anonymous responses)
  ```php
  Schema::table('survey_conduct', function (Blueprint $table) {
      $table->unsignedBigInteger('person_id')->nullable()->change();
  });
  ```

- [ ] **Step 4:** Run migration
  ```bash
  docker compose exec php php artisan migrate
  ```

- [ ] **Step 5:** Run Pint
  ```bash
  docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
  ```

---

### Task 3: SurveyScoreService (TDD)

Service that computes `total_score` and `subscale_scores` for a survey_conduct record.

- [ ] **Step 1: Write test** — `backend/tests/Feature/Services/SurveyScoreServiceTest.php`

  Test cases:
  - Sum scoring: instrument with 3 likert items, responses with values 1,2,3 -> total = 6
  - Mean scoring: same responses -> total = 2.0
  - Reverse coding: item with `is_reverse_coded=true`, `max_value=4`, response=1 -> scored as 3
  - Subscale scoring: 2 subscales with different items, verify `subscale_scores` JSON contains both

  ```php
  uses(RefreshDatabase::class);

  it('computes sum score for likert responses', function () {
      $instrument = SurveyInstrument::factory()->create([
          'scoring_method' => ['type' => 'sum', 'range' => [0, 12]],
      ]);
      // Create 3 items with values 1, 2, 3
      // Create conduct record + responses
      // Assert total_score === 6
  });
  ```

- [ ] **Step 2: Run test — verify FAIL (RED)**
  ```bash
  docker compose exec php php artisan test --filter=SurveyScoreService
  ```

- [ ] **Step 3: Implement** — `backend/app/Services/Survey/SurveyScoreService.php`

  ```php
  class SurveyScoreService
  {
      public function compute(SurveyConductRecord $conduct): array
      {
          // Load responses with items
          // Apply reverse coding where is_reverse_coded = true
          // Group by subscale_name
          // Compute total based on scoring_method.type (sum, mean, weighted)
          // Return ['total_score' => float, 'subscale_scores' => array]
      }
  }
  ```

- [ ] **Step 4: Run test — verify PASS (GREEN)**

- [ ] **Step 5: Run Pint**
  ```bash
  docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
  ```

---

## Phase 2: Backend — Campaign & Conduct (Tasks 4-8)

### Task 4: SurveyCampaign Model + Controller (TDD)

- [ ] **Step 1:** Create `SurveyCampaign` model — `backend/app/Models/Survey/SurveyCampaign.php`

  - `$fillable`: name, survey_instrument_id, cohort_generation_id, status, publish_token, description, closed_at, created_by
  - Relationships: `instrument()` -> BelongsTo SurveyInstrument, `conductRecords()` -> HasMany SurveyConductRecord, `creator()` -> BelongsTo User
  - Scopes: `scopeActive`, `scopeDraft`, `scopeClosed`
  - Cast: `closed_at` -> datetime

- [ ] **Step 2:** Create `StoreSurveyCampaignRequest` — `backend/app/Http/Requests/Api/StoreSurveyCampaignRequest.php`

  Rules: name (required, string, max:255), survey_instrument_id (required, exists:survey_instruments,id), cohort_generation_id (nullable, integer), description (nullable, string)

- [ ] **Step 3: Write test** — `backend/tests/Feature/Api/V1/SurveyCampaignTest.php`

  ```php
  uses(RefreshDatabase::class);

  it('lists campaigns', function () { ... });
  it('creates a campaign', function () { ... });
  it('shows a campaign with stats', function () { ... });
  it('updates a campaign', function () { ... });
  it('deletes a campaign', function () { ... });
  it('activates a draft campaign and generates publish token', function () { ... });
  it('closes an active campaign', function () { ... });
  it('returns campaign stats with completion counts', function () { ... });
  it('rejects activation of already active campaign', function () { ... });
  ```

- [ ] **Step 4: Run test — verify FAIL (RED)**

- [ ] **Step 5:** Create `SurveyCampaignController` with all methods: index, store, show, update, destroy, activate, close, stats

- [ ] **Step 6: Run test — verify PASS (GREEN)**

- [ ] **Step 7: Run Pint**

---

### Task 5: CampaignSeedService

Seeds survey_conduct rows from cohort members.

- [ ] **Step 1: Write test** — seed creates conduct rows for each cohort member with `completion_status='pending'`

  Note: This test may need to mock the CohortGenerationService or use a test cohort generation. The seed service depends on the source's results schema.

- [ ] **Step 2: Implement** — `backend/app/Services/Survey/CampaignSeedService.php`

  ```php
  class CampaignSeedService
  {
      public function __construct(
          private CohortGenerationService $cohortService
      ) {}

      public function seed(SurveyCampaign $campaign): int
      {
          // Load cohort generation
          // Get members via CohortGenerationService pattern:
          //   - Resolve source from generation
          //   - Get results schema: $source->getTableQualifier(DaimonType::Results)
          //   - Query {resultsSchema}.cohort for subject_id
          // Create survey_conduct rows: person_id=subject_id, survey_instrument_id, campaign_id, completion_status='pending'
          // Return count
      }
  }
  ```

- [ ] **Step 3:** Wire to `SurveyCampaignController@seed` endpoint

- [ ] **Step 4: Run Pint**

---

### Task 6: SurveyInstrumentController::clone()

Clone a library instrument into a user-editable copy.

- [ ] **Step 1: Write test**

  ```php
  it('clones an instrument with all items and answer options', function () {
      $user = User::factory()->create();
      $instrument = SurveyInstrument::factory()->create();
      // Add items with answer options

      $response = $this->actingAs($user)
          ->postJson("/api/v1/survey-instruments/{$instrument->id}/clone")
          ->assertStatus(201);

      // Assert new instrument has different id, same items/options count
      // Assert created_by = auth user
  });
  ```

- [ ] **Step 2: Run test — FAIL (RED)**

- [ ] **Step 3: Implement clone()** in `SurveyInstrumentController`

  Replicate instrument, replicate all items with answer options, set `created_by = auth user`, append " (Copy)" to name.

- [ ] **Step 4: Run test — PASS (GREEN)**

- [ ] **Step 5: Run Pint**

---

### Task 7: SurveyImportService (TDD)

Import CSV/REDCap response data into a campaign.

- [ ] **Step 1: Write test**

  Test: parse CSV with `person_id` + item value columns, match to campaign's conduct records, create survey_responses, compute scores.

- [ ] **Step 2: Run test — FAIL (RED)**

- [ ] **Step 3: Implement** — `backend/app/Services/Survey/SurveyImportService.php`

  ```php
  class SurveyImportService
  {
      public function __construct(
          private SurveyScoreService $scoreService
      ) {}

      public function importResponses(SurveyCampaign $campaign, UploadedFile $file): array
      {
          // Parse CSV rows
          // For each row: find survey_conduct by person_id + campaign_id
          // Create survey_response rows per item
          // Score via SurveyScoreService
          // Update completion_status to 'complete'
          // Return ['imported' => count, 'matched' => count, 'skipped' => count]
      }
  }
  ```

- [ ] **Step 4: Run test — PASS (GREEN)**

- [ ] **Step 5:** Wire to `SurveyCampaignController@importResponses`

- [ ] **Step 6: Run Pint**

---

### Task 8: SurveyConductController + SurveyRespondController + Routes

- [ ] **Step 1:** Create `SurveyConductController` — `backend/app/Http/Controllers/Api/V1/SurveyConductController.php`

  `storeResponses(Request $request, SurveyConductRecord $conduct)`:
  - Validates array of `{survey_item_id, value_as_number?, value_as_concept_id?, value_as_string?}`
  - Creates survey_response rows
  - Scores via SurveyScoreService
  - Updates `completion_status` to `'complete'`

- [ ] **Step 2:** Create `SurveyRespondController` — `backend/app/Http/Controllers/Api/V1/SurveyRespondController.php`

  `show(string $token)`: Returns instrument with items if campaign is active + not closed
  `store(string $token, Request $request)`: Creates anonymous survey_conduct (person_id=null) + responses

- [ ] **Step 3:** Add all routes to `backend/routes/api.php`:

  Campaign routes under `auth:sanctum` + `permission:analyses.create`:
  ```php
  Route::prefix('v1/survey-campaigns')->middleware(['auth:sanctum', 'permission:analyses.create'])->group(function () {
      Route::get('/', [SurveyCampaignController::class, 'index']);
      Route::post('/', [SurveyCampaignController::class, 'store']);
      Route::get('/{campaign}', [SurveyCampaignController::class, 'show']);
      Route::put('/{campaign}', [SurveyCampaignController::class, 'update']);
      Route::delete('/{campaign}', [SurveyCampaignController::class, 'destroy']);
      Route::post('/{campaign}/activate', [SurveyCampaignController::class, 'activate']);
      Route::post('/{campaign}/close', [SurveyCampaignController::class, 'close']);
      Route::post('/{campaign}/seed', [SurveyCampaignController::class, 'seed']);
      Route::get('/{campaign}/stats', [SurveyCampaignController::class, 'stats']);
      Route::post('/{campaign}/import', [SurveyCampaignController::class, 'importResponses']);
  });
  ```

  Conduct response route under `auth:sanctum`:
  ```php
  Route::post('v1/survey-conduct/{conduct}/responses', [SurveyConductController::class, 'storeResponses'])
      ->middleware(['auth:sanctum', 'permission:analyses.create']);
  ```

  Instrument clone route:
  ```php
  Route::post('v1/survey-instruments/{instrument}/clone', [SurveyInstrumentController::class, 'clone'])
      ->middleware(['auth:sanctum', 'permission:analyses.create']);
  ```

  Public survey-respond routes (unauthenticated, rate-limited):
  ```php
  Route::prefix('v1/survey-respond')->middleware('throttle:60,1')->group(function () {
      Route::get('/{token}', [SurveyRespondController::class, 'show']);
      Route::post('/{token}', [SurveyRespondController::class, 'store']);
  });
  ```

- [ ] **Step 4: Run Pint**
  ```bash
  docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
  ```

- [ ] **Step 5: Run full PHP test suite**
  ```bash
  docker compose exec php php artisan test --filter=Survey
  ```

---

## Phase 3: Shared Frontend Infrastructure (Tasks 9-12)

### Task 9: instrumentToSurveyJs.ts Adapter (TDD)

Runtime adapter: `SurveyInstrumentDetailApi` -> SurveyJS Model JSON.

- [ ] **Step 1: Write Vitest test** — `frontend/src/features/standard-pros/lib/__tests__/instrumentToSurveyJs.test.ts`

  Test cases for each response_type mapping:
  - `likert` -> `radiogroup` with choices from answer_options
  - `yes_no` -> `boolean`
  - `numeric` -> `text` with inputType 'number', min/max
  - `free_text` -> `comment` with maxLength
  - `multi_select` -> `checkbox`
  - `date` -> `text` with inputType 'date'
  - Subscale grouping into pages
  - Reverse coded flag preserved in question metadata

- [ ] **Step 2: Run test — FAIL (RED)**
  ```bash
  cd frontend && npx vitest run --reporter=verbose
  ```

- [ ] **Step 3: Implement** — `frontend/src/features/standard-pros/lib/instrumentToSurveyJs.ts`

  ```typescript
  export function instrumentToSurveyJs(instrument: SurveyInstrumentDetailApi): object {
      // Map each item to SurveyJS question type per mapping table
      // Map answer_options to choices array
      // Group items by subscale_name into pages (if subscales exist)
      // Return SurveyJS JSON model
  }
  ```

- [ ] **Step 4: Run test — PASS (GREEN)**

- [ ] **Step 5: TypeScript check**
  ```bash
  npx tsc --noEmit
  ```

---

### Task 10: Coltor Builder Definitions

Create the entity/attribute/builder definitions for the clinical instrument builder.

- [ ] **Step 1:** Create `frontend/src/features/standard-pros/lib/instrumentBuilder.ts`

  Define attributes via `createAttribute`:
  - `labelAttribute` — z.string().min(1)
  - `conceptIdAttribute` — z.object({ concept_id, concept_name, vocabulary_id }).nullable()
  - `loincCodeAttribute` — z.string().nullable()
  - `reverseScoredAttribute` — z.boolean().default(false)
  - `subscaleKeyAttribute` — z.string().nullable()
  - `responseOptionsAttribute` — z.array(z.object({ text, value, omop_concept_id?, loinc_la_code? }))
  - `minValueAttribute`, `maxValueAttribute` — z.number().nullable()

  Define entities via `createEntity`:
  - `likertItemEntity` — attributes: [label, conceptId, loinc, reverseScored, subscaleKey, responseOptions]
  - `vasItemEntity` — attributes: [label, conceptId, minValue, maxValue]
  - `nrsItemEntity` — attributes: [label, conceptId, minValue, maxValue]
  - `freeTextItemEntity` — attributes: [label, conceptId]
  - `subscaleEntity` — attributes: [label], childrenAllowed: [likertItem, nrsItem, vasItem]
  - `sectionEntity` — attributes: [label], childrenAllowed: all item types

  Create `instrumentBuilder` via `createBuilder` with all entities.

- [ ] **Step 2:** Create `frontend/src/features/standard-pros/lib/surveyBuilderStore.ts`

  Zustand store wrapping Coltor's `useBuilderStore`:
  - State: `selectedEntityId`, `instrumentMetadata` (name, abbreviation, domain, version, scoring_method)
  - Actions: `setSelectedEntity`, `updateMetadata`, `toApiPayload()` (converts builder schema -> API request body)

- [ ] **Step 3: TypeScript check**
  ```bash
  npx tsc --noEmit
  ```

---

### Task 11: Import Parsers (TDD)

- [ ] **Step 1: Write Vitest tests for redcapParser**

  Test cases:
  - Parse REDCap data dictionary CSV -> array of items
  - Map `field_type`: radio->likert, text->free_text, dropdown->likert, yesno->yes_no, slider->vas, calc->numeric
  - Parse Choices column: `"1, Not at all | 2, Several days | 3, More than half"` -> answer options array

- [ ] **Step 2: Run test — FAIL (RED)**

- [ ] **Step 3: Implement** — `frontend/src/features/standard-pros/lib/redcapParser.ts`

  Uses `papaparse` for CSV parsing. Exports `parseRedcapDictionary(csvString: string): ParsedItem[]`.

- [ ] **Step 4: Run test — PASS (GREEN)**

- [ ] **Step 5: Write Vitest tests for fhirParser**

  Test cases:
  - Parse FHIR Questionnaire R4 JSON -> same output format
  - Map `item.type`: choice->likert, boolean->yes_no, integer->numeric, string->free_text, date->date
  - Map `item.answerOption[].valueCoding` -> answer options

- [ ] **Step 6: Implement** — `frontend/src/features/standard-pros/lib/fhirParser.ts`

  Exports `parseFhirQuestionnaire(questionnaire: FhirQuestionnaire): ParsedItem[]`.

- [ ] **Step 7: Run all frontend tests**
  ```bash
  cd frontend && npx vitest run && npx tsc --noEmit
  ```

---

### Task 12: Campaign API + Hooks

- [ ] **Step 1:** Create `frontend/src/features/standard-pros/api/campaignApi.ts`

  Types:
  ```typescript
  export interface SurveyCampaignApi {
      id: number;
      name: string;
      survey_instrument_id: number;
      cohort_generation_id: number | null;
      status: 'draft' | 'active' | 'closed';
      publish_token: string | null;
      description: string | null;
      closed_at: string | null;
      created_by: number | null;
      instrument?: SurveyInstrumentApi;
      conduct_records_count?: number;
      completed_count?: number;
      created_at: string;
      updated_at: string;
  }

  export interface CampaignStatsApi {
      total_members: number;
      completed: number;
      pending: number;
      anonymous_responses: number;
      completion_rate: number;
  }
  ```

  Functions: fetchCampaigns, fetchCampaign, createCampaign, updateCampaign, deleteCampaign, activateCampaign, closeCampaign, seedCampaign, importResponses, fetchCampaignStats

- [ ] **Step 2:** Create `frontend/src/features/standard-pros/hooks/useCampaigns.ts`

  Hooks: useCampaigns(), useCampaign(id), useCreateCampaign(), useActivateCampaign(), useCloseCampaign(), useSeedCampaign(), useImportResponses()

- [ ] **Step 3:** Add mutation functions to `surveyApi.ts`:
  - `cloneInstrument(id: number)`
  - `createInstrumentItem(instrumentId: number, data)`
  - `updateInstrumentItem(instrumentId: number, itemId: number, data)`
  - `deleteInstrumentItem(instrumentId: number, itemId: number)`
  - `storeResponses(conductId: number, responses[])`

- [ ] **Step 4:** Add mutation hooks to `useSurveyInstruments.ts`

- [ ] **Step 5: TypeScript check**
  ```bash
  docker compose exec node sh -c "cd /app && npx tsc --noEmit"
  ```

---

## Phase 4: Builder Tab (Tasks 13-19)

### Task 13: InstrumentMetadataForm

- [ ] **Step 1:** Create `frontend/src/features/standard-pros/components/builder/InstrumentMetadataForm.tsx`

  - Fields: name (required), abbreviation (required, max 30), domain (select from DOMAIN_ORDER), version (default '1.0'), description (textarea)
  - Uses react-hook-form + zod schema
  - Dark clinical theme: bg-[#141418], border-[#2A2A2F], text-[#F0EDE8]
  - Calls `updateMetadata` on the builder store

- [ ] **Step 2: TypeScript check**

---

### Task 14: ScoringMethodEditor + ConceptPickerField + AnswerOptionsEditor

- [ ] **Step 1:** Create `ScoringMethodEditor.tsx`
  - Fields: type (select: sum/mean/weighted/custom), range [min, max] (two number inputs), subscales (tag input — type + enter to add)
  - Outputs `scoring_method` JSON matching existing backend format

- [ ] **Step 2:** Create `ConceptPickerField.tsx`
  - Wraps existing `VocabularySearchPanel` component with `onSelect` callback
  - Displays selected concept: concept_id, concept_name, vocabulary_id
  - Clear button to deselect

- [ ] **Step 3:** Create `AnswerOptionsEditor.tsx`
  - Add/remove answer options
  - Each option: option_text (input), option_value (number input), loinc_la_code (optional input)
  - Uses @dnd-kit/sortable for drag-to-reorder
  - "Add Option" button at bottom

- [ ] **Step 4: TypeScript check**

---

### Task 15: ItemEditor (Right Panel)

- [ ] **Step 1:** Create `frontend/src/features/standard-pros/components/builder/ItemEditor.tsx`

  Renders different fields based on entity type:
  - **likertItem**: label, ConceptPickerField, LOINC code input, reverse coded toggle, subscale key input, AnswerOptionsEditor
  - **vasItem**: label, ConceptPickerField, min/max labels, scale length
  - **nrsItem**: label, ConceptPickerField, min/max values, anchor labels
  - **freeTextItem**: label, ConceptPickerField, max length, required toggle

  Receives `selectedEntityId` from builder store. Reads/writes attributes via Coltor hooks.

- [ ] **Step 2:** Show empty state when no entity selected: "Select an item to edit its properties"

- [ ] **Step 3: TypeScript check**

---

### Task 16: SortableItemRow + SortableItemList

- [ ] **Step 1:** Create `SortableItemRow.tsx`
  - Uses `useSortable` from @dnd-kit
  - Displays: drag handle (grip icon), item_number, truncated item_text, response_type badge, concept badge (if mapped)
  - Click handler sets `selectedEntityId` in builder store
  - Highlighted when selected

- [ ] **Step 2:** Create `SortableItemList.tsx`
  - `DndContext` + `SortableContext` wrapping `SortableItemRow` list
  - `onDragEnd` updates builder store entity order via `arrayMove`
  - Uses `closestCenter` collision detection

- [ ] **Step 3: TypeScript check**

---

### Task 17: InstrumentPanel (Left Panel)

- [ ] **Step 1:** Create `frontend/src/features/standard-pros/components/builder/InstrumentPanel.tsx`

  - Top section: "Add Item" toolbox — buttons for each entity type (Likert, VAS, NRS, Free Text, Matrix, Section)
  - Each button has icon + label, adds new entity to builder store on click
  - Bottom section: SortableItemList of current items
  - Item count badge in header

- [ ] **Step 2: TypeScript check**

---

### Task 18: ImportInstrumentModal

- [ ] **Step 1:** Create `frontend/src/features/standard-pros/components/builder/ImportInstrumentModal.tsx`

  - 3 import tabs: REDCap, FHIR, CSV
  - **REDCap tab**: file upload -> `redcapParser` -> preview items table -> confirm -> add to builder store
  - **FHIR tab**: file upload or paste JSON -> `fhirParser` -> preview -> confirm
  - **CSV tab**: file upload -> generic column mapping -> preview -> confirm
  - Preview shows: item_text, response_type, answer option count
  - "Import X items" confirmation button

- [ ] **Step 2: TypeScript check**

---

### Task 19: BuilderTab Assembly

- [ ] **Step 1:** Create `frontend/src/features/standard-pros/components/builder/BuilderTab.tsx`

  Layout:
  - Top: InstrumentMetadataForm (collapsible)
  - Middle: split panel — InstrumentPanel (left, ~40%) | ItemEditor (right, ~60%)
  - Bottom action bar: Save button, Preview button (renders via instrumentToSurveyJs in modal), Import button -> ImportInstrumentModal
  - ScoringMethodEditor inline within metadata or as expandable section

- [ ] **Step 2:** Replace placeholder `BuilderTab` in `StandardProsPage.tsx`

  ```typescript
  import { BuilderTab } from '../components/builder/BuilderTab';
  // Remove the old placeholder function
  ```

- [ ] **Step 3: TypeScript check**
  ```bash
  docker compose exec node sh -c "cd /app && npx tsc --noEmit"
  ```

- [ ] **Step 4: Vite build**
  ```bash
  docker compose exec node sh -c "cd /app && npx vite build"
  ```

---

## Phase 5: Conduct Tab (Tasks 20-25)

### Task 20: CampaignCard

- [ ] **Step 1:** Create `frontend/src/features/standard-pros/components/conduct/CampaignCard.tsx`

  Display:
  - Campaign name (bold)
  - Instrument abbreviation badge
  - Status badge: Draft (gray), Active (teal), Closed (crimson)
  - Progress bar: X/Y complete (percentage)
  - Created date
  - Action buttons: Activate (if draft), Close (if active), Import, Manual Entry, Publish Link (if active)

- [ ] **Step 2: TypeScript check**

---

### Task 21: NewCampaignModal

- [ ] **Step 1:** Create `frontend/src/features/standard-pros/components/conduct/NewCampaignModal.tsx`

  Form fields:
  - Campaign name (required)
  - Select instrument (dropdown from instruments list)
  - Select cohort generation (dropdown from existing generations — fetch from cohort API)
  - Description (textarea, optional)

  On submit: `createCampaign` mutation -> `seedCampaign` mutation -> close modal -> refetch campaigns

- [ ] **Step 2: TypeScript check**

---

### Task 22: ImportResponsesModal

- [ ] **Step 1:** Create `frontend/src/features/standard-pros/components/conduct/ImportResponsesModal.tsx`

  - File upload (CSV/REDCap format)
  - Preview: show matched person_ids count, column mapping preview
  - Submit: `useImportResponses` mutation with FormData
  - Result display: "X responses imported, Y persons matched, Z skipped"

- [ ] **Step 2: TypeScript check**

---

### Task 23: ManualEntryModal

- [ ] **Step 1:** Create `frontend/src/features/standard-pros/components/conduct/ManualEntryModal.tsx`

  - Select person from campaign's pending conduct records (dropdown showing person_id)
  - Render instrument items as form fields (simple form, not SurveyJS — likert as radio, free_text as textarea, numeric as number input)
  - Submit: `storeResponses` mutation for that conduct record
  - On success: close modal, refetch campaign stats

- [ ] **Step 2: TypeScript check**

---

### Task 24: PublishLinkPanel

- [ ] **Step 1:** Create `frontend/src/features/standard-pros/components/conduct/PublishLinkPanel.tsx`

  - Shows publish URL: `{window.location.origin}/survey/{publish_token}`
  - Copy to clipboard button (with "Copied!" feedback)
  - QR code via `qrcode.react` `<QRCodeSVG>` component
  - Status indicator: Active (green dot), Closed (red), Draft (no link — "Activate campaign to generate link")

- [ ] **Step 2: TypeScript check**

---

### Task 25: ConductTab Assembly

- [ ] **Step 1:** Create `frontend/src/features/standard-pros/components/conduct/ConductTab.tsx`

  Layout:
  - Header: "Survey Campaigns" + "New Campaign" button
  - Campaign list: grid of CampaignCards
  - Empty state: "No campaigns yet. Create a campaign to start collecting survey responses."
  - Each card expands on click to show PublishLinkPanel + action buttons

- [ ] **Step 2:** Add "Conduct" tab to TABS array in `StandardProsPage.tsx`

  ```typescript
  const TABS = [
      { id: "library", label: "Instrument Library", icon: Library },
      { id: "coverage", label: "Coverage Analytics", icon: PieChart },
      { id: "builder", label: "Survey Builder", icon: Wrench },
      { id: "conduct", label: "Survey Conduct", icon: ClipboardList },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
  ] as const;
  ```

- [ ] **Step 3:** Import and render ConductTab:
  ```typescript
  {tab === "conduct" && <ConductTab />}
  ```

- [ ] **Step 4: TypeScript check**
  ```bash
  docker compose exec node sh -c "cd /app && npx tsc --noEmit"
  ```

---

## Phase 6: Integration & Polish (Tasks 26-28)

### Task 26: PublicSurveyPage + Router

- [ ] **Step 1:** Create `frontend/src/pages/PublicSurveyPage.tsx`

  - Fetch instrument via `GET /api/v1/survey-respond/{token}`
  - Convert via `instrumentToSurveyJs()`
  - Render SurveyJS: `<Survey model={surveyModel} onComplete={handleSubmit} />`
  - On complete: `POST /api/v1/survey-respond/{token}` with responses
  - Show thank-you screen after submission
  - Error states: campaign not found, campaign closed, submission failed
  - Minimal branding — no auth required, no sidebar

- [ ] **Step 2:** Add route to `frontend/src/app/router.tsx`

  Add outside the auth-protected layout:
  ```typescript
  {
      path: "survey/:token",
      lazy: () => import("@/pages/PublicSurveyPage").then(m => ({ Component: m.default })),
  }
  ```

- [ ] **Step 3: TypeScript check**

---

### Task 27: Wire Everything into StandardProsPage

- [ ] **Step 1:** Verify TABS array includes all 5 tabs: library, coverage, builder, conduct, analytics

- [ ] **Step 2:** Import BuilderTab and ConductTab components

- [ ] **Step 3:** Render in tab content:
  ```typescript
  {tab === "builder" && <BuilderTab />}
  {tab === "conduct" && <ConductTab />}
  ```

- [ ] **Step 4:** Remove old placeholder `BuilderTab` function from StandardProsPage.tsx

- [ ] **Step 5: TypeScript check**

---

### Task 28: Final Verification

- [ ] **Step 1: TypeScript check**
  ```bash
  docker compose exec node sh -c "cd /app && npx tsc --noEmit"
  ```

- [ ] **Step 2: Vite build**
  ```bash
  docker compose exec node sh -c "cd /app && npx vite build"
  ```

- [ ] **Step 3: PHP Pint**
  ```bash
  docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
  ```

- [ ] **Step 4: PHP tests**
  ```bash
  docker compose exec php php artisan test --filter=Survey
  ```

- [ ] **Step 5: Frontend tests**
  ```bash
  cd frontend && npx vitest run
  ```

- [ ] **Step 6: Manual smoke test**
  - Builder tab renders with split panel layout
  - Can add items via toolbox, drag to reorder
  - Can edit item attributes in right panel
  - Can save instrument via API
  - Conduct tab renders with empty state
  - Can create new campaign
  - Campaign cards show status and progress
  - Published link shows QR code (when active)
  - Public survey page renders instrument via SurveyJS
