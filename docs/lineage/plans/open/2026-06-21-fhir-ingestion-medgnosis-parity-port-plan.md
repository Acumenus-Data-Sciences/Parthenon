---
doc_type: plan
status: open
date: 2026-06-21
owner: acumenus
module: ingestion
lineage_anchor: false
supersedes: []
superseded_by: null
related_prs: []
related_code:
  - backend/app/Services/Fhir/FhirBulkMapper.php
  - backend/app/Services/Fhir/CrosswalkService.php
  - backend/app/Jobs/Fhir/RunFhirSyncJob.php
  - docs/lineage/design/specs/2026-06-21-fhir-ingestion-medgnosis-parity-port-design.md
---

# FHIR Ingestion — Medgnosis-Parity Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 inbound FHIR resource types (DocumentReference, Coverage, ServiceRequest, CarePlan, Goal, CareTeam) + reference dimensions + soft-delete/`entered-in-error`/Bulk-`deleted`-manifest handling to Parthenon's FHIR→OMOP-CDM ingestion, validated against a live EHR sandbox.

**Architecture:** A `ResourceMapper` interface + per-resource mapper classes (under `backend/app/Services/Fhir/Mappers/`) registered into the existing `FhirBulkMapper::mapResource()` `match` via a `default` registry fall-through — leaving the 855-line file's inline mappers untouched. Shared mapping helpers move to a `FhirMapperSupport` trait used by both. Reference dimensions reuse the existing `CrosswalkService` get-or-create resolvers; CarePlan/Goal/CareTeam land in 3 new OMOP-extension tables; soft-delete hard-deletes the crosswalked CDM row with an audit stamp.

**Tech Stack:** Laravel 11 / PHP 8.4, Pest, PHPStan L8, PostgreSQL 17 (schema-isolated CDM). Mappers return `list<{cdm_table, data, fhir_resource_type, fhir_resource_id}>`; the two-pass `FhirNdjsonProcessorService` already persists them.

**Reference:** Design spec `docs/lineage/design/specs/2026-06-21-fhir-ingestion-medgnosis-parity-port-design.md`. Medgnosis source of truth (mapping reference): `~/Github/Medgnosis/apps/api/src/services/ehr/edwHydration.ts` + `docs/superpowers/devlogs/2026-06-20-fhir-edw-expansion-closeout.md`.

**Gates after every code task:** `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"` then `cd backend && php scripts/pest-lane.php <test path>` and `php -d memory_limit=-1 vendor/bin/phpstan analyse <changed files> --no-progress`. Real-schema validation runs each new INSERT inside `BEGIN…ROLLBACK` against the OMOP test schema (Phase 1 Task 0 builds the harness).

---

## File Structure

**Create:**
- `backend/app/Services/Fhir/Mappers/ResourceMapper.php` — interface (`resourceType(): string`, `map(array $resource, string $siteKey): array`).
- `backend/app/Services/Fhir/Mappers/Support/FhirMapperSupport.php` — trait with the shared helpers extracted from `FhirBulkMapper`.
- `backend/app/Services/Fhir/Mappers/{DocumentReferenceMapper,CoverageMapper,ServiceRequestMapper,CarePlanMapper,GoalMapper,CareTeamMapper}.php`.
- `backend/database/migrations/2026_06_21_100000_create_omop_care_extension_tables.php`.
- `backend/database/migrations/2026_06_21_100100_add_fhir_crosswalk_deleted_columns.php`.
- `backend/tests/Unit/Services/Fhir/Mappers/{DocumentReferenceMapper,CoverageMapper,ServiceRequestMapper,CarePlanMapper,GoalMapper,CareTeamMapper}Test.php`.
- `backend/tests/Feature/Fhir/FhirSoftDeleteTest.php`, `backend/tests/Feature/Fhir/FhirCrossSchemaExtensionTest.php` (real-schema rollback harness).

**Modify:**
- `backend/app/Services/Fhir/FhirBulkMapper.php` — extract helpers into the trait (behavior-preserving); add `default => $this->mapViaRegistry(...)`; inject the mapper registry.
- `backend/app/Services/Fhir/CrosswalkService.php` — add `deleteByResource(siteKey, type, id): array` + `markDeleted(...)`.
- `backend/app/Jobs/Fhir/RunFhirSyncJob.php` — add `processBulkDeletions()` after hydration.
- `backend/app/Models/App/FhirConnection.php` — default `export_resource_types` to the 16-type set.

---

## Phase 1 — Foundations

### Task 1.1: Extract shared mapping helpers into a trait (behavior-preserving)

**Files:**
- Create: `backend/app/Services/Fhir/Mappers/Support/FhirMapperSupport.php`
- Modify: `backend/app/Services/Fhir/FhirBulkMapper.php`

- [ ] **Step 1:** Identify the helpers the new mappers need (confirmed used by `mapDiagnosticReport`): `extractCodings`, `resolveSubjectPersonId`, `resolveEncounterVisitId`, `parseDate`, `parseDatetime`. Read their current bodies in `FhirBulkMapper.php` and move them verbatim into a new trait, changing `private function` → `protected function`:

```php
<?php

namespace App\Services\Fhir\Mappers\Support;

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\VocabularyLookupService;
use Carbon\Carbon;

/**
 * Shared FHIR→OMOP mapping helpers used by FhirBulkMapper and the per-resource
 * ResourceMapper classes. Extracted verbatim from FhirBulkMapper (behavior-preserving).
 * The using class MUST expose `$this->vocab` (VocabularyLookupService) and
 * `$this->crosswalk` (CrosswalkService).
 */
trait FhirMapperSupport
{
    // PASTE the exact current bodies of extractCodings, resolveSubjectPersonId,
    // resolveEncounterVisitId, parseDate, parseDatetime here as `protected function`.
}
```

- [ ] **Step 2:** In `FhirBulkMapper.php` add `use FhirMapperSupport;` to the class and DELETE the now-duplicated private methods. Keep `$vocab`/`$crosswalk` constructor properties.
- [ ] **Step 3:** Run the existing FHIR tests to prove no behavior change: `cd backend && php scripts/pest-lane.php tests/Feature/Fhir tests/Unit/Services/Fhir --stop-on-failure`. Expected: PASS (same as before).
- [ ] **Step 4:** Pint + PHPStan on both files. Expected: clean.
- [ ] **Step 5:** Commit: `git commit -m "refactor(fhir): extract FhirMapperSupport trait (behavior-preserving)"`.

### Task 1.2: ResourceMapper interface + registry dispatch

**Files:**
- Create: `backend/app/Services/Fhir/Mappers/ResourceMapper.php`
- Modify: `backend/app/Services/Fhir/FhirBulkMapper.php`

- [ ] **Step 1: Write the failing test** `backend/tests/Unit/Services/Fhir/Mappers/RegistryDispatchTest.php`:

```php
<?php

use App\Services\Fhir\FhirBulkMapper;
use App\Services\Fhir\Mappers\ResourceMapper;

it('dispatches an unknown-to-the-match resource type to a registered mapper', function () {
    $stub = new class implements ResourceMapper {
        public function resourceType(): string { return 'CarePlan'; }
        public function map(array $resource, string $siteKey): array {
            return [['cdm_table' => 'care_plan', 'data' => ['x' => 1]]];
        }
    };
    $mapper = app(FhirBulkMapper::class);
    $mapper->registerMapper($stub);

    $rows = $mapper->mapResource(['resourceType' => 'CarePlan', 'id' => 'cp1'], 'site');

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['cdm_table'])->toBe('care_plan')
        ->and($rows[0]['fhir_resource_type'])->toBe('CarePlan')
        ->and($rows[0]['fhir_resource_id'])->toBe('cp1');
});
```

- [ ] **Step 2: Run it, expect FAIL** (`registerMapper` undefined): `php scripts/pest-lane.php tests/Unit/Services/Fhir/Mappers/RegistryDispatchTest.php`.
- [ ] **Step 3: Implement.** Create the interface:

```php
<?php

namespace App\Services\Fhir\Mappers;

interface ResourceMapper
{
    /** The FHIR resourceType this maps, e.g. 'CarePlan'. */
    public function resourceType(): string;

    /**
     * @return list<array{cdm_table: string, data: array<string, mixed>}>
     */
    public function map(array $resource, string $siteKey): array;
}
```

  In `FhirBulkMapper.php` add a registry + dispatch (change the `match` default):

```php
/** @var array<string, ResourceMapper> */
private array $registry = [];

public function registerMapper(ResourceMapper $mapper): void
{
    $this->registry[$mapper->resourceType()] = $mapper;
}

// in mapResource(), replace `default => null,` with:
//   default => $this->registry[$resource['resourceType'] ?? '']?->map($resource, $siteKey) ?? null,
```

- [ ] **Step 4: Run test, expect PASS.**
- [ ] **Step 5:** Register the 6 mappers in `AppServiceProvider::boot()` via `afterResolving(FhirBulkMapper::class, …)` (add as each mapper lands). Pint + PHPStan. Commit: `git commit -m "feat(fhir): ResourceMapper interface + registry dispatch in FhirBulkMapper"`.

### Task 1.3: Real-schema rollback validation harness

**Files:** Create `backend/tests/Feature/Fhir/FhirCrossSchemaExtensionTest.php`

- [ ] **Step 1:** Write a Pest helper that, given a `cdm_table` + `data` array, runs `INSERT … RETURNING` inside `DB::connection('omop')->transaction(fn () => …, then throws to roll back)` and asserts no exception (catches column/NOT-NULL/cast errors). Template:

```php
function assertInsertableOmop(string $table, array $data): void {
    $thrown = null;
    try {
        DB::connection('omop')->transaction(function () use ($table, $data) {
            DB::connection('omop')->table($table)->insert($data);
            throw new RuntimeException('__rollback__'); // never commit test data
        });
    } catch (\Throwable $e) {
        if ($e->getMessage() !== '__rollback__') { $thrown = $e; }
    }
    expect($thrown)->toBeNull();
}
```

- [ ] **Step 2:** Skip the whole file when omop is unwritable (mirror `CdmModelTest`'s `->skip(fn () => …)` guard) so CI without a writable omop still passes.
- [ ] **Step 3:** Commit: `git commit -m "test(fhir): add real-schema rollback insert harness"`.

### Task 1.4: OMOP care-extension migrations

**Files:** Create `backend/database/migrations/2026_06_21_100000_create_omop_care_extension_tables.php`

- [ ] **Step 1:** Read the existing OMOP-extension-bridge migration (the imaging/genomics extension tables — `grep -rl "image_occurrence\|genomic_test" backend/database/migrations`) to copy its **exact** schema-targeting pattern (which connection/schema, `Schema::connection(...)`, the per-CDM-schema approach). Match it.
- [ ] **Step 2:** Create `care_plan`, `care_goal`, `care_team`, `care_team_member` per the spec's column sketch, using that pattern. Each: PK bigIncrements, `person_id` (bigInteger, indexed), the `*_concept_id` (bigInteger default 0) + `*_source_value` columns, `created_date`/`updated_date` timestamps matching OMOP-extension convention. `care_goal.care_plan_id` + `care_team_member.care_team_id` are nullable FKs.
- [ ] **Step 3:** `php artisan migrate --path=backend/database/migrations/2026_06_21_100000_create_omop_care_extension_tables.php` (against the dev DB). Verify with `\d care_plan` etc.
- [ ] **Step 4:** Add each table to `assertInsertableOmop` smoke in the harness (insert a minimal row → rollback → no error). Commit.

### Task 1.5: Crosswalk deleted columns

**Files:** Create `backend/database/migrations/2026_06_21_100100_add_fhir_crosswalk_deleted_columns.php`

- [ ] **Step 1:** For each `fhir_*_crosswalk` table that maps a FHIR resource to a CDM row, add nullable `deleted_at` (timestamp) + `deleted_reason` (string) if absent (`Schema::hasColumn` guard).
- [ ] **Step 2:** Migrate + verify. Commit: `git commit -m "feat(fhir): crosswalk soft-delete audit columns + care extension tables"`.

---

## Phase 2 — Reference dimensions (light: resolvers already exist)

`CrosswalkService` already has `resolveProviderId`/`resolveLocationId`/`resolveCareSiteId` (get-or-create). This phase just ensures the new mappers can backfill these FKs; it is exercised by the mapper tests in Phases 3–4 rather than standalone. **No standalone task** — verified via the DocumentReference (provider) + CareTeam (provider/care_site) mapper tests. (If a gap surfaces, add a `ReferenceDimensionResolver` wrapper here.)

---

## Phase 3 — Clean-home mappers

> Each mapper task follows the identical 5-step TDD shape: write the Pest mock test → run (FAIL) → implement `map()` → run (PASS) → real-schema rollback assert + Pint/PHPStan + commit. The `map()` body and the asserted columns are given in full per resource (no "similar to" references).

### Task 3.1: DocumentReferenceMapper → `note`

**Files:** Create `backend/app/Services/Fhir/Mappers/DocumentReferenceMapper.php` + `backend/tests/Unit/Services/Fhir/Mappers/DocumentReferenceMapperTest.php`

- [ ] **Step 1: Test:**

```php
<?php
use App\Services\Fhir\Mappers\DocumentReferenceMapper;
use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\VocabularyLookupService;

it('maps a DocumentReference to an OMOP note row', function () {
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'pat1')->andReturn(42);
    $crosswalk->shouldReceive('lookupVisitId')->with('site', 'enc1')->andReturn(7);
    $crosswalk->shouldReceive('resolveProviderId')->andReturn(9);
    $vocab = Mockery::mock(VocabularyLookupService::class);

    $mapper = new DocumentReferenceMapper($vocab, $crosswalk);
    $rows = $mapper->map([
        'resourceType' => 'DocumentReference', 'id' => 'dr1',
        'subject' => ['reference' => 'Patient/pat1'],
        'context' => ['encounter' => [['reference' => 'Encounter/enc1']]],
        'date' => '2024-03-01T10:00:00Z',
        'type' => ['coding' => [['system' => 'http://loinc.org', 'code' => '11506-3', 'display' => 'Progress note']]],
        'content' => [['attachment' => ['contentType' => 'text/plain', 'data' => base64_encode('Patient stable.')]]],
        'author' => [['reference' => 'Practitioner/prac1']],
    ], 'site');

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['cdm_table'])->toBe('note')
        ->and($rows[0]['data']['person_id'])->toBe(42)
        ->and($rows[0]['data']['note_text'])->toBe('Patient stable.')
        ->and($rows[0]['data']['note_date'])->toBe('2024-03-01')
        ->and($rows[0]['data']['visit_occurrence_id'])->toBe(7)
        ->and($rows[0]['data']['note_source_value'])->toBe('11506-3');
});
```

- [ ] **Step 2:** Run → FAIL (class missing).
- [ ] **Step 3: Implement:**

```php
<?php

namespace App\Services\Fhir\Mappers;

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Mappers\Support\FhirMapperSupport;
use App\Services\Fhir\VocabularyLookupService;

class DocumentReferenceMapper implements ResourceMapper
{
    use FhirMapperSupport;

    public function __construct(
        protected readonly VocabularyLookupService $vocab,
        protected readonly CrosswalkService $crosswalk,
    ) {}

    public function resourceType(): string { return 'DocumentReference'; }

    public function map(array $r, string $siteKey): array
    {
        $patientRef = $r['subject']['reference'] ?? '';
        $personId = $this->crosswalk->lookupPersonId($siteKey, str_replace('Patient/', '', $patientRef));
        if ($personId === null) { return []; } // unresolved patient → skip (pass-2 contract)

        $encRef = $r['context']['encounter'][0]['reference'] ?? null;
        $visitId = $encRef ? $this->crosswalk->lookupVisitId($siteKey, str_replace('Encounter/', '', $encRef)) : null;

        $attachment = $r['content'][0]['attachment'] ?? [];
        $noteText = isset($attachment['data']) ? (string) base64_decode((string) $attachment['data'], true) : ($attachment['url'] ?? '');
        $typeCoding = $r['type']['coding'][0] ?? [];

        return [[
            'cdm_table' => 'note',
            'data' => [
                'person_id' => $personId,
                'note_date' => $this->parseDate($r['date'] ?? null),
                'note_datetime' => $this->parseDatetime($r['date'] ?? null),
                'note_type_concept_id' => 32817, // EHR
                'note_class_concept_id' => 0,
                'note_title' => substr($typeCoding['display'] ?? 'Clinical document', 0, 250),
                'note_text' => substr($noteText, 0, 1_000_000),
                'encoding_concept_id' => 32678, // UTF-8
                'language_concept_id' => 4180186, // English
                'visit_occurrence_id' => $visitId,
                'note_source_value' => $typeCoding['code'] ?? null,
            ],
        ]];
    }
}
```

- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Add `assertInsertableOmop('note', $rows[0]['data'])` in the rollback harness; register in `AppServiceProvider`; Pint + PHPStan; commit `feat(fhir): ingest DocumentReference → note`.

### Task 3.2: CoverageMapper → `payer_plan_period`

Same 5-step shape. `map()` body:

```php
public function resourceType(): string { return 'Coverage'; }

public function map(array $r, string $siteKey): array
{
    $beneRef = $r['beneficiary']['reference'] ?? $r['subscriber']['reference'] ?? '';
    $personId = $this->crosswalk->lookupPersonId($siteKey, str_replace('Patient/', '', $beneRef));
    if ($personId === null) { return []; }

    $payor = $r['payor'][0]['display'] ?? ($r['payor'][0]['reference'] ?? null);
    $plan = null;
    foreach ($r['class'] ?? [] as $c) {
        if (($c['type']['coding'][0]['code'] ?? null) === 'plan') { $plan = $c['value'] ?? $c['name'] ?? null; }
    }

    return [[
        'cdm_table' => 'payer_plan_period',
        'data' => [
            'person_id' => $personId,
            'payer_plan_period_start_date' => $this->parseDate($r['period']['start'] ?? null) ?? '1970-01-01',
            'payer_plan_period_end_date' => $this->parseDate($r['period']['end'] ?? null) ?? '2099-12-31',
            'payer_concept_id' => 0,
            'payer_source_value' => $payor ? substr((string) $payor, 0, 50) : null,
            'plan_concept_id' => 0,
            'plan_source_value' => $plan ? substr((string) $plan, 0, 50) : null,
        ],
    ]];
}
```

Test asserts `payer_plan_period` row with `person_id`, start/end dates, `payer_source_value`, `plan_source_value`. Then rollback-assert + register + commit `feat(fhir): ingest Coverage → payer_plan_period`.

### Task 3.3: ServiceRequestMapper → `procedure_occurrence` (status-gated)

Same shape. `map()`:

```php
public function resourceType(): string { return 'ServiceRequest'; }

public function map(array $r, string $siteKey): array
{
    if (! in_array($r['status'] ?? '', ['active', 'completed'], true)) { return []; } // draft/revoked/cancelled skip
    if (! in_array($r['intent'] ?? '', ['order', 'original-order', 'reflex-order'], true)) { return []; }

    $patientRef = $r['subject']['reference'] ?? '';
    $personId = $this->crosswalk->lookupPersonId($siteKey, str_replace('Patient/', '', $patientRef));
    if ($personId === null) { return []; }

    $resolved = $this->vocab->resolve($this->extractCodings($r['code'] ?? []));
    $encRef = $r['encounter']['reference'] ?? null;
    $visitId = $encRef ? $this->crosswalk->lookupVisitId($siteKey, str_replace('Encounter/', '', $encRef)) : null;
    $when = $r['authoredOn'] ?? $r['occurrenceDateTime'] ?? $r['occurrencePeriod']['start'] ?? null;

    return [[
        'cdm_table' => 'procedure_occurrence',
        'data' => [
            'person_id' => $personId,
            'procedure_concept_id' => $resolved['concept_id'],
            'procedure_date' => $this->parseDate($when),
            'procedure_datetime' => $this->parseDatetime($when),
            'procedure_type_concept_id' => 32817, // EHR order
            'quantity' => $r['quantityQuantity']['value'] ?? null,
            'visit_occurrence_id' => $visitId,
            'procedure_source_value' => $resolved['source_value'],
            'procedure_source_concept_id' => $resolved['source_concept_id'],
        ],
    ]];
}
```

Tests: an `active`+`order` SR → a `procedure_occurrence` row with mapped concept; a `draft` SR → `[]`. Rollback-assert + register + commit `feat(fhir): ingest ServiceRequest → procedure_occurrence (order)`.

---

## Phase 4 — Extension mappers

### Task 4.1: CarePlanMapper → `care_plan`

`map()` (concept_ids 0 + source_value where no standard concept; status/intent text → source_value):

```php
public function resourceType(): string { return 'CarePlan'; }

public function map(array $r, string $siteKey): array
{
    $personId = $this->crosswalk->lookupPersonId($siteKey, str_replace('Patient/', '', $r['subject']['reference'] ?? ''));
    if ($personId === null) { return []; }
    $encRef = $r['encounter']['reference'] ?? null;

    return [[
        'cdm_table' => 'care_plan',
        'data' => [
            'person_id' => $personId,
            'care_plan_start_date' => $this->parseDate($r['period']['start'] ?? null),
            'care_plan_end_date' => $this->parseDate($r['period']['end'] ?? null),
            'status_concept_id' => 0,
            'intent_concept_id' => 0,
            'category_concept_id' => 0,
            'visit_occurrence_id' => $encRef ? $this->crosswalk->lookupVisitId($siteKey, str_replace('Encounter/', '', $encRef)) : null,
            'care_plan_source_value' => substr(($r['status'] ?? '').'|'.($r['intent'] ?? ''), 0, 100),
            'care_plan_source_concept_id' => 0,
        ],
    ]];
}
```

Test → `care_plan` row; rollback-assert (real schema catches NOT-NULL); register; commit.

### Task 4.2: GoalMapper → `care_goal`

`map()` extracts `lifecycleStatus`, `description.text`, `target`, links `care_plan_id` if the Goal references a CarePlan we crosswalked (else null). Asserts a `care_goal` row. Commit `feat(fhir): ingest Goal → care_goal`.

### Task 4.3: CareTeamMapper → `care_team` (+ members)

`map()` returns a `care_team` row AND one `care_team_member` row per `participant` (resolving `member` Practitioner→`resolveProviderId` / Organization→`resolveCareSiteId`). Returns a multi-row list. Test asserts the team row + N member rows with provider/care_site FKs. Commit `feat(fhir): ingest CareTeam → care_team + members`.

> **Note for 4.2/4.3:** the processor persists `care_team` before `care_team_member` because they arrive in one `map()` call as an ordered list; if FK ordering matters, return the parent row first (it is). The `care_team_id` for members is resolved post-insert via the crosswalk on the next pass — if that is not yet supported, emit members keyed by the FHIR CareTeam id and resolve in `FhirNdjsonProcessorService` (add an ordered-write note in the task).

---

## Phase 5 — Soft-delete + Bulk `deleted` manifest

### Task 5.1: CrosswalkService::deleteByResource

**Files:** Modify `backend/app/Services/Fhir/CrosswalkService.php` + create `backend/tests/Feature/Fhir/FhirSoftDeleteTest.php`

- [ ] **Step 1: Test** — seed a crosswalk row mapping `(site, 'Condition', 'c1') → (condition_occurrence, 555)`; assert after `deleteByResource('site','Condition','c1')` the `condition_occurrence` row 555 is gone and the crosswalk row has `deleted_at` set.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `deleteByResource(string $siteKey, string $type, string $id): array` — look up the crosswalk row(s) for `(siteKey, type, id)`, `DELETE FROM <cdm_table> WHERE <pk> = <cdm_id>` for each (using the written-rows map `trackWrittenRows` persisted), then `UPDATE` the crosswalk row `deleted_at = now(), deleted_reason = $reason`. Return `['deleted' => n]`.
- [ ] **Step 4:** Run → PASS. Pint/PHPStan. Commit `feat(fhir): crosswalk-resolved hard-delete for entered-in-error`.

### Task 5.2: entered-in-error during hydration

**Files:** Modify `FhirBulkMapper.php` (or the processor) — before mapping, if `($r['status'] ?? null) === 'entered-in-error'` OR `($r['verificationStatus']['coding'][0]['code'] ?? null) === 'entered-in-error'`, return a sentinel that the processor turns into `crosswalk->deleteByResource(...)` instead of an insert. Test both a Condition and an Observation entered-in-error. Commit.

### Task 5.3: processBulkDeletions in RunFhirSyncJob

**Files:** Modify `backend/app/Jobs/Fhir/RunFhirSyncJob.php`

- [ ] **Step 1: Test** (Feature, Http::fake) — a `$export` manifest with a `deleted` output whose NDJSON is a Bundle of `{request:{method:'DELETE',url:'Condition/c1'}}` → after the job, `deleteByResource('site','Condition','c1')` was invoked (assert via a spy/seeded crosswalk row removed).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `processBulkDeletions(array $deletedOutputs)`: for each `deleted` output URL, download the NDJSON, parse each Bundle entry, `extractDeletedReferences()` → `[type, id]`, call `crosswalk->deleteByResource()`. Per-file errors counted (not fatal), recorded in `FhirSyncRun` metadata. Wire it after hydration in `handle()`.
- [ ] **Step 4:** Run → PASS. Commit `feat(fhir): process Bulk $export deleted manifest`.

---

## Phase 6 — Wire `$export _type` + live-EHR validation

### Task 6.1: default export_resource_types

**Files:** Modify `backend/app/Models/App/FhirConnection.php`

- [ ] **Step 1:** Add a `defaultExportResourceTypes(): array` constant/method returning the 16-type set (existing 10 + DocumentReference, Coverage, ServiceRequest, CarePlan, Goal, CareTeam + Practitioner, Organization, Location). Use it when `export_resource_types` is null in `RunFhirSyncJob`. Test the kickoff `_type` includes the new types (Http::fake assert on the request URL). Commit.

### Task 6.2: Live-EHR end-to-end validation

- [ ] **Step 1: [USER]** register the public key for client `66b2fa2f-52c2-4a1e-90a8-3142a4913a79` with the sandbox; confirm the sandbox `fhir_base_url` + `token_endpoint`. **[CLAUDE]** seed a `FhirConnection` row with these (client_id + key from secret config, never hardcoded) via tinker/seeder.
- [ ] **Step 2:** Run `php artisan fhir:sync <connection_id>` (or dispatch `RunFhirSyncJob`) against the sandbox; watch Horizon.
- [ ] **Step 3:** Verify the new OMOP rows: `SELECT count(*) FROM note; … payer_plan_period; … care_plan; …` for the ingested patient, and a spot-check that a `deleted` manifest soft-deleted a row. Capture counts.
- [ ] **Step 4: Closeout** — write `docs/devlog/2026-06-21-fhir-ingestion-medgnosis-parity.md` with per-resource counts + the live-run evidence; check off the FHIR-ingestion items in the completion + ingestion-template plans; move this plan toward `plans/closed/`.

---

## Self-Review

- **Spec coverage:** 6 resources (Tasks 3.1–3.3, 4.1–4.3) ✓; reference dims (Phase 2 + used in 3.1/4.3) ✓; extension tables (1.4) ✓; soft-delete + deleted-manifest (5.1–5.3) ✓; live validation (6.2) ✓; 3-level test rigor (mock per mapper + rollback harness 1.3 + live 6.2) ✓.
- **Placeholder scan:** the only deliberate "read the existing pattern then match" steps are 1.1 (paste exact helper bodies) and 1.4 (match the imaging/genomics extension migration) — these require reading real code, not inventing, and are explicit, not vague.
- **Type consistency:** all mappers `implements ResourceMapper`, `use FhirMapperSupport`, ctor `(VocabularyLookupService $vocab, CrosswalkService $crosswalk)`, return `list<{cdm_table,data}>`; `mapResource` stamps fhir metadata; crosswalk methods match the read signatures (`lookupPersonId`, `lookupVisitId`, `resolveProviderId`, `resolveCareSiteId`).
