---
doc_type: spec
status: accepted
date: 2026-06-21
owner: acumenus
module: ingestion
lineage_anchor: false
supersedes: []
superseded_by: null
related_prs: []
related_code:
  - backend/app/Services/Fhir/FhirBulkMapper.php
  - backend/app/Services/Fhir/FhirNdjsonProcessorService.php
  - backend/app/Services/Fhir/CrosswalkService.php
  - backend/app/Jobs/Fhir/RunFhirSyncJob.php
  - backend/app/Models/App/FhirConnection.php
---

# FHIR Ingestion — Medgnosis Parity Port → OMOP CDM (Design Spec)

## Goal

Bring Parthenon's **inbound FHIR ingestion** to parity with the Medgnosis
`feature/fhir-edw-ingestion-expansion` work — adapted from Medgnosis's `phm_edw`
target to Parthenon's **OMOP CDM v5.4** target. Specifically: add 6 clinical
resource types + reference dimensions, add soft-delete / `entered-in-error` /
Bulk-`deleted`-manifest handling, and validate end-to-end against a live EHR
sandbox.

## Context — what already exists in Parthenon

Parthenon's inbound pipeline already mirrors Medgnosis's architecture:

- `RunFhirSyncJob` — SMART Backend Services (JWT) auth + Bulk `$export` pull from
  an external EHR defined by a `FhirConnection` (`fhir_base_url`, `token_endpoint`,
  `client_id`, `export_resource_types`).
- `FhirNdjsonProcessorService` — two-pass, crosswalk-keyed hydration: Pass 1
  Patient + Encounter → `person` / `visit_occurrence` + crosswalks; Pass 2 clinical
  resources resolved against the crosswalks.
- `FhirBulkMapper` (855 lines) — `mapResource()` dispatches a `match` on
  `resourceType` to inline `map*` methods, each returning
  `list<{cdm_table, data, fhir_resource_type, fhir_resource_id}>`. Currently covers
  ~10 types (Patient, Encounter, Condition, Observation, Procedure, Medication*,
  Immunization, AllergyIntolerance, DiagnosticReport).
- Crosswalk tables already present: `fhir_patient_crosswalk`,
  `fhir_encounter_crosswalk`, `fhir_provider_crosswalk`, `fhir_caresite_crosswalk`,
  `fhir_location_crosswalk` (so reference-dimension plumbing partly exists;
  `mapEncounter` already emits provider/location/care_site rows).

**Not present today:** the 6 expansion resource types, soft-delete /
`entered-in-error`, and the Bulk `deleted`-manifest path.

## Architecture

Introduce a small, focused `ResourceMapper` seam rather than growing the
already-oversized `FhirBulkMapper`:

- `interface ResourceMapper { public function resourceType(): string; public function map(array $resource, string $siteKey): array; }`
  returning the same `list<{cdm_table, data, fhir_resource_type, fhir_resource_id}>`
  contract.
- One class per new resource under `backend/app/Services/Fhir/Mappers/`:
  `DocumentReferenceMapper`, `CoverageMapper`, `ServiceRequestMapper`,
  `CarePlanMapper`, `GoalMapper`, `CareTeamMapper`. Reference-dimension
  resolution (Practitioner/Organization/Location) goes through a shared
  `ReferenceDimensionResolver` that wraps the existing provider/care_site/location
  crosswalks.
- `FhirBulkMapper::mapResource()` falls through its existing `match` to a
  registry lookup for the new types — **existing inline mappers are unchanged**
  (no big-bang refactor of the 855-line file; the registry is the extension point
  for all future resources).

This keeps each new unit independently testable with one clear purpose.

## Resource → OMOP mapping (hybrid: standard tables + 3 extension tables)

| FHIR | OMOP target | Key fields |
|---|---|---|
| DocumentReference | `note` | `note_text` from inline `content.attachment.data`/`url` stub; `note_type_concept_id`/`note_class_concept_id` from `type`; `note_date` from `date`; `person_id` via patient crosswalk; `visit_occurrence_id` via `context.encounter`; `provider_id` via author. |
| Coverage | `payer_plan_period` | `payer_plan_period_start_date`/`end_date` from `period`; `payer_source_value` from `payor`; `plan_source_value` from `class[type=plan]`; person via subscriber/beneficiary crosswalk. |
| ServiceRequest | `procedure_occurrence` (status-gated) | only `status ∈ {active, completed}` and `intent ∈ {order, original-order}`; `procedure_concept_id` from `code`; `procedure_date` from `authoredOn`/`occurrence`; `procedure_type_concept_id` = an "EHR order list entry" concept; requester→`provider_id`; `encounter`→`visit_occurrence_id`. Draft/revoked/cancelled are skipped (not errors). |
| Practitioner | `provider` (existing crosswalk) | reference dim; get-or-create, backfill `provider_id` FKs. |
| Organization | `care_site` (existing crosswalk) | reference dim. |
| Location | `location` / `care_site` (existing crosswalk) | reference dim. |
| CarePlan | **extension `care_plan`** | id, person, period, status, intent, category, encounter, addresses (conditions). |
| Goal | **extension `care_goal`** | id, person, lifecycle status, achievement, description, target, `care_plan_id` link (synthetic plan if standalone). |
| CareTeam | **extension `care_team` + `care_team_member`** | id, person, period, status, participants (role + provider/org via crosswalk). |

### Extension tables

Three new tables follow Parthenon's existing OMOP-extension-bridge convention
(per-CDM-schema, FK to `person`/`visit_occurrence`, OMOP-style `*_concept_id` +
`*_source_value` columns), created by Laravel migrations:

- `care_plan` (PK `care_plan_id`, `person_id`, `care_plan_start_date`,
  `care_plan_end_date`, `status_concept_id`, `intent_concept_id`,
  `category_concept_id`, `visit_occurrence_id`, `care_plan_source_value`,
  `care_plan_source_concept_id`).
- `care_goal` (PK `care_goal_id`, `person_id`, `care_plan_id` (nullable FK),
  `lifecycle_status`, `achievement_status_concept_id`, `goal_start_date`,
  `goal_source_value`, `goal_source_concept_id`).
- `care_team` (PK `care_team_id`, `person_id`, `care_team_start_date`,
  `care_team_end_date`, `status`, `care_team_source_value`) +
  `care_team_member` (PK, `care_team_id` FK, `provider_id` (nullable),
  `care_site_id` (nullable), `role_concept_id`, `role_source_value`).

The exact NOT-NULL/concept columns are finalized against the live OMOP schema in
the implementation plan; the migration adds them to each writable CDM schema the
ingestion targets.

## Soft-delete / entered-in-error / Bulk `deleted` manifest

OMOP CDM is append-only and has no soft-delete column, so the OMOP-correct
behavior is to **remove the erroneous row(s)** while preserving an audit trail in
the crosswalk + sync-run metadata (vs Medgnosis's `active_ind='N'`):

- **During hydration:** a resource arriving with `status = entered-in-error` (or
  `Observation.status`/`Condition.verificationStatus = entered-in-error`) →
  `CrosswalkService::deleteByResource(siteKey, resourceType, resourceId)` resolves
  the crosswalk row → deletes the mapped CDM row by `(cdm_table, cdm_id)` →
  stamps the crosswalk (`deleted_at`, `deleted_reason`). The resource is **not**
  also hydrated.
- **Bulk `deleted` output:** `$export` emits a `deleted` output set (NDJSON of
  FHIR Bundles whose entries carry `request.method = DELETE` /
  `request.url = ResourceType/id`). A new `processBulkDeletions()` step in the sync
  job downloads each `deleted` file, extracts the deleted references, and runs the
  same crosswalk-resolve-and-delete path. Per-file fetch errors are counted, not
  fatal; results recorded in the `FhirSyncRun` metadata.
- Crosswalk migration adds `deleted_at` / `deleted_reason` columns where absent.

## Live-EHR end-to-end validation

- A `FhirConnection` is configured for the EHR sandbox using the provided
  **non-prod `client_id` `66b2fa2f-52c2-4a1e-90a8-3142a4913a79`**, the sandbox
  `fhir_base_url` + `token_endpoint`, and a key pair whose public key is registered
  to that client (SMART Backend Services `private_key_jwt`). The client_id and key
  live in the connection/secret config — **never hardcoded**.
- `export_resource_types` is extended to the full 15-type set so the kickoff
  requests the new resources (`$export?_type=…`).
- Validation: run a real Bulk `$export`, hydrate, and verify the new OMOP rows
  (counts + spot-checks per resource) and a `deleted`-manifest soft-delete.

## Test methodology (3 levels, per resource — Medgnosis's "double-check everything")

1. **Pest mock tests** — assert the emitted CDM rows/columns for each mapper
   (insert + update + skip paths), mocking the DB.
2. **Real-schema rollback** — execute each new INSERT/UPDATE inside
   `BEGIN…ROLLBACK` against the live OMOP **test** schema (zero data change) to
   catch column / NOT-NULL / cast errors mocks cannot.
3. **Live `$export` end-to-end** — the sandbox run above.

Every code phase runs the pre-commit gate (Pint, PHPStan L8, tsc/ESLint where
touched) and the bounded Pest lanes before it lands.

## Phasing

1. **Foundations** — extension migrations (`care_plan`/`care_goal`/`care_team`/
   `care_team_member`) + crosswalk `deleted_at`/`deleted_reason`; the
   `ResourceMapper` interface + registry wired into `FhirBulkMapper`; the
   `ReferenceDimensionResolver`.
2. **Reference dimensions** — Practitioner→`provider`, Organization→`care_site`,
   Location→`location`/`care_site` get-or-create + FK backfill (extending the
   existing crosswalk usage).
3. **Clean-home mappers** — DocumentReference→`note`, Coverage→`payer_plan_period`,
   ServiceRequest→`procedure_occurrence`.
4. **Extension mappers** — CarePlan, Goal, CareTeam (+ members).
5. **Soft-delete** — `entered-in-error` hydration path + Bulk `deleted` manifest.
6. **Wire + validate** — extend `$export _type` + connection defaults; live-EHR
   end-to-end with the sandbox client; closeout devlog.

## Acceptance

- Inbound clinical resource coverage **+6** types (DocumentReference, Coverage,
  ServiceRequest, CarePlan, Goal, CareTeam) into OMOP CDM, **plus**
  Practitioner/Organization/Location reference dimensions — each with insert/update
  + entered-in-error delete semantics, verified by Pest mocks + real-schema rollback.
- Bulk `deleted` manifest processed; soft-deletes audited in crosswalk + run
  metadata.
- A live sandbox `$export` (via the provided client) ingests the new resource
  types and the new OMOP rows are verified.
- The "FHIR Bulk Data reader" / inbound-ingestion completeness item in the
  ingestion-templates Phase-4 + completion plans is closed with this evidence.

## Risks / open items

- **ServiceRequest→`procedure_occurrence`** is a known OHDSI compromise (an order
  is not a performed procedure); gated to `active/completed` + an "order" type
  concept, and revisited if it pollutes incidence analytics.
- **Extension table concept_ids** require vocabulary lookups (status/intent/role);
  where no standard concept exists, store `*_source_value` + concept_id 0.
- **Sandbox key registration** — the provided client_id needs its public key
  registered with the sandbox (Workstream prerequisite for Phase 6).
- Exact extension-table column nullability is finalized against the live OMOP
  schema during Phase 1.
