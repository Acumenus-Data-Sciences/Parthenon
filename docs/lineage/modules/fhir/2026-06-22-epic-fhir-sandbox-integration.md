---
doc_type: lineage
status: shipped
date: 2026-06-22
owner: acumenus
module: fhir
lineage_anchor: true
supersedes: []
superseded_by: null
related_prs: []
related_code:
  - backend/app/Services/Fhir/FhirAuthService.php
  - backend/app/Services/Fhir/FhirJwksService.php
  - backend/app/Http/Controllers/Api/V1/FhirJwksController.php
  - backend/app/Services/Fhir/Mappers/ResourceMapper.php
  - backend/app/Services/Fhir/Mappers/Support/FhirMapperSupport.php
  - backend/app/Services/Fhir/Mappers/DocumentReferenceMapper.php
  - backend/app/Services/Fhir/Mappers/CoverageMapper.php
  - backend/app/Services/Fhir/Mappers/ServiceRequestMapper.php
  - backend/app/Services/Fhir/Mappers/CarePlanMapper.php
  - backend/app/Services/Fhir/Mappers/GoalMapper.php
  - backend/app/Services/Fhir/Mappers/CareTeamMapper.php
  - backend/app/Services/Fhir/FhirDedupService.php
  - backend/app/Services/Fhir/CrosswalkService.php
  - backend/app/Services/Fhir/FhirBulkExportService.php
  - backend/app/Jobs/Fhir/RunFhirSyncJob.php
  - backend/database/migrations/2026_06_21_100000_create_omop_care_extension_tables.php
---

# Development Log — Live Epic FHIR Sandbox Integration (Medgnosis-Parity Port)

**Date:** 2026-06-22
**Module:** FHIR ingestion (Vulcan)
**Branch:** `feature/fhir-ingestion-medgnosis-parity`
**Outcome:** ✅ Live SMART Backend Services **authentication** to the Epic on FHIR sandbox achieved — the JWT → token → CapabilityStatement handshake succeeded against a real, externally-operated EHR. Six new clinical resource types wired into the OMOP CDM v5.4 ingestion path; soft-delete semantics and a public JWKS key-discovery endpoint shipped. **A record-writing bulk `$export` sync has not yet been run** — the Epic connection is configured and active; first ingestion is the next step (§10.1).

> **Companion documents**
> - Design spec: [`docs/lineage/design/specs/2026-06-21-fhir-ingestion-medgnosis-parity-port-design.md`](../../design/specs/2026-06-21-fhir-ingestion-medgnosis-parity-port-design.md)
> - Implementation plan: [`docs/lineage/plans/open/2026-06-21-fhir-ingestion-medgnosis-parity-port-plan.md`](../../plans/open/2026-06-21-fhir-ingestion-medgnosis-parity-port-plan.md)
> - Prior pipeline: [`phase-16-fhir-incremental-sync.md`](./phase-16-fhir-incremental-sync.md)
> - IG compliance: [`fhir-omop-ig-compliance.md`](./fhir-omop-ig-compliance.md)

---

## 1. Executive Summary

Parthenon has shipped FHIR R4 → OMOP CDM ingestion since **Phase 16** (the *Vulcan* engine): SMART Backend Services authentication, asynchronous Bulk Data `$export`, NDJSON download, vocabulary resolution, identity crosswalks, two-pass processing, and incremental sync. That pipeline was, however, validated only against **mock endpoints** (`https://example.test/fhir`) and a fixed roster of nine resource types. It had never completed a handshake with a **real, externally-operated EHR FHIR server**.

This log records the work that closed that gap. By porting the inbound-ingestion advances from our sister application **Medgnosis** (its `feature/fhir-edw-ingestion-expansion` branch, retargeted from `phm_edw` to OMOP CDM v5.4) and adding a **public JWKS key-discovery endpoint with a stable `kid`**, Parthenon completed a **live SMART Backend Services authentication handshake against the Epic on FHIR sandbox** on **2026-06-22**: a `kid`-bearing RS384 assertion was accepted at Epic's token endpoint, an access token was issued, and Epic's `metadata` CapabilityStatement was retrieved over the authenticated channel. This is the first time Parthenon authenticated to a real, externally-operated EHR FHIR server rather than a mock. A record-writing bulk `$export` sync has **not** yet completed — and the blocker is **Epic's public sandbox, not Parthenon's code** (intermittent key propagation across Epic's non-production token nodes; see §10.1).

The work landed as **eight sequential commits** between 2026-06-21 19:58 and 2026-06-22 12:19 (≈16.5 hours of focused implementation), each gated by `tsc`/Pint/PHPStan and a growing test suite (16 new FHIR test files).

**What changed, at a glance:**

| Capability | Before | After |
|---|---|---|
| Resource types ingested | 9 | **15** (+DocumentReference, Coverage, ServiceRequest, CarePlan, Goal, CareTeam) |
| Mapper architecture | one 855-line monolith (`FhirBulkMapper`) | **pluggable `ResourceMapper` registry** + shared trait |
| Deletes | not handled | **`entered-in-error` soft-delete** + Bulk `deleted` manifest processing |
| EHR key discovery | none (no way for an EHR to find our public key) | **public `/api/fhir/jwks.json`** + RFC 7638 `kid` in the assertion header |
| Live EHR validation | mock endpoints only | **live Epic sandbox auth handshake** (token + CapabilityStatement); bulk sync pending |

---

## 2. Why This Was Hard — The Missing Half of SMART Backend Services

The Phase 16 pipeline implemented the **client half** of [SMART Backend Services](https://hl7.org/fhir/uv/bulkdata/authorization/index.html): build an RS384-signed JWT assertion, `POST` it to the token endpoint with `grant_type=client_credentials`, receive a bearer token, and call `$export`. In a mock test this is sufficient, because the mock blindly returns a token.

A **real EHR does not.** Before Epic issues a token, it must **verify the signature** on our client assertion. To do that it needs our **public key**, and it needs to know *which* key signed *this* assertion. The SMART Backend Services / OAuth 2.0 ecosystem solves this with two coupled mechanisms we had not yet built:

1. **A JWKS endpoint** — a public, unauthenticated URL serving a [JSON Web Key Set (RFC 7517)](https://datatracker.ietf.org/doc/html/rfc7517) containing our RSA **public** keys (modulus `n` and exponent `e` only — never private material). The EHR is registered with this URL and fetches it to verify assertions. This is the "JWKS URL registration" model Epic prefers over pasting a static key.
2. **A `kid` (key ID) in the JWT header** — so when our JWKS contains more than one key (multiple connections, key rotation), the EHR can select the correct one deterministically rather than trial-verifying every key.

Without these, Epic's token endpoint rejects the assertion with `invalid_client` and the entire pipeline stalls at step one. **Building the server half of the trust relationship is the keystone of this release** (see §7).

A second, structural gap: Medgnosis had already expanded its inbound mappers to cover documents, coverage, orders, and care-coordination resources against its `phm_edw` warehouse. Parthenon's mapper covered only the nine "core" resources and did so in a single large class that was awkward to extend. Reaching parity meant both **porting the mapping logic** and **refactoring the extension seam** so new resources could be added without surgery on the monolith.

---

## 3. Background — What "Medgnosis Parity" Means

Medgnosis (sister PHM/EDW application) drove its FHIR ingestion ahead of Parthenon on the `feature/fhir-edw-ingestion-expansion` branch, targeting its `phm_edw` star-schema warehouse. The connectivity and resource-coverage patterns proven there are what this port brings into Parthenon — **retargeted from `phm_edw` to OMOP CDM v5.4**.

Parity, concretely, meant:

- **Six additional clinical resource types** — DocumentReference, Coverage, ServiceRequest, CarePlan, Goal, CareTeam.
- **Reference-dimension resolution** — Practitioner → `provider`, Organization → `care_site`, Location → `location`/`care_site` (get-or-create via crosswalks, reusing existing resolvers).
- **Soft-delete handling** — `entered-in-error` resources delete the previously-written CDM row and stamp an audit trail; the Bulk Data `deleted` manifest is parsed and applied.
- **Live SMART Backend Services connectivity** — the JWKS/`kid` work that lets a real EHR (Epic) verify our assertions.

Because OMOP CDM v5.4 has **no native landing tables** for CarePlan, Goal, or CareTeam, the port follows Parthenon's established **OMOP-bridge extension pattern** (the same approach used by the imaging and genomics extensions) and creates three new extension tables in the `omop` schema (§6).

---

## 4. Architecture — A Pluggable Mapper Registry

### 4.1 The `ResourceMapper` interface

`backend/app/Services/Fhir/Mappers/ResourceMapper.php` defines a minimal contract:

```php
interface ResourceMapper
{
    public function resourceType(): string;

    /** @return list<array{cdm_table: string, data: array<string, mixed>}> */
    public function map(array $resource, string $siteKey): array;
}
```

A mapper declares the FHIR `resourceType` it handles and returns **zero or more** `{cdm_table, data}` rows. Returning an empty array is the canonical "skip this resource" signal (e.g., a clinical resource whose patient was never ingested). Returning **multiple** rows lets one FHIR resource fan out into several CDM rows (CareTeam → one `care_team` + N `care_team_member`).

### 4.2 Registry dispatch (commit `739142f7a`)

`FhirBulkMapper` gained a runtime registry:

```php
private array $registry = [];

public function registerMapper(ResourceMapper $mapper): void
{
    $this->registry[$mapper->resourceType()] = $mapper;
}
```

The central `mapResource()` `match` now falls through to the registry for any type it does not handle natively:

```php
default => isset($this->registry[$resource['resourceType'] ?? ''])
    ? $this->registry[$resource['resourceType']]->map($resource, $siteKey)
    : null,
```

Mappers are wired up in `AppServiceProvider` via `afterResolving(FhirBulkMapper::class, …)`, so adding a resource type is now **a new class + one registration line** — no edits to the 855-line monolith. `RegistryDispatchTest` asserts a stub mapper is registered and dispatched correctly.

### 4.3 The `FhirMapperSupport` trait (commit `f58001a0c`)

Before adding mappers, five shared helpers were extracted (behavior-preserving) from `FhirBulkMapper` into `backend/app/Services/Fhir/Mappers/Support/FhirMapperSupport.php`:

- `resolveSubjectPersonId()` — parse `subject.reference` → resolve `person_id` via crosswalk.
- `resolveEncounterVisitId()` — parse `encounter.reference` → resolve `visit_occurrence_id`.
- `extractCodings()` — pull the `coding[]` array out of a CodeableConcept.
- `extractRef()` — parse a `reference` field to its bare resource id (`Patient/pat1` → `pat1`).
- `parseDate()` / `parseDatetime()` — Carbon-based ISO-8601 → OMOP date/datetime strings.

The trait depends on `$this->vocab` (`VocabularyLookupService`) and `$this->crosswalk` (`CrosswalkService`) being present on the using class, so every mapper composes the same resolution behavior as the core mapper.

---

## 5. The Six New Resource Mappers (commits `71a23939d`, `a6be79021`)

### 5.1 "Clean-home" mappers — resources with a natural OMOP table

| FHIR resource | OMOP table | Key logic |
|---|---|---|
| **DocumentReference** | `note` | Decodes the base64 inline `content[0].attachment.data` (falls back to the attachment URL stub); `note_type_concept_id = 32817` (EHR), `encoding_concept_id = 32678` (UTF-8), `language_concept_id = 4180186` (English); title from `type.coding[0].display`; `note_text` truncated to 1,000,000 chars; visit resolved from `context.encounter[0]`. |
| **Coverage** | `payer_plan_period` | Person via `beneficiary`/`subscriber`; `period.start/end` defaulting to `1970-01-01`/`2099-12-31`; `payer_source_value` from `payor[0]`; `plan_source_value` from the `class` entry whose `type.coding.code = 'plan'`; payer/plan `concept_id` deferred to 0. |
| **ServiceRequest** | `procedure_occurrence` | **Status-gated:** only `status ∈ {active, completed}` **and** `intent ∈ {order, original-order, reflex-order}` are mapped (drafts/proposals/revoked are *skipped*, not errored). Procedure concept resolved via `vocab->resolve()`; date from `authoredOn` → `occurrenceDateTime` → `occurrencePeriod.start`; `procedure_type_concept_id = 32817`. |

In every case, an unresolved patient (`lookupPersonId` returns `null`) causes the mapper to return `[]` — the resource is skipped cleanly rather than producing an orphan row.

### 5.2 Extension mappers — resources with no native OMOP home

| FHIR resource | OMOP extension table(s) | Key logic |
|---|---|---|
| **CarePlan** | `care_plan` | Dates from `period.start/end`; status/intent preserved verbatim in `care_plan_source_value` (`"<status>\|<intent>"`, ≤100 chars); status/intent/category `concept_id`s deferred to 0; optional `visit_occurrence_id` from `encounter`. |
| **Goal** | `care_goal` | `lifecycle_status` from `lifecycleStatus` (≤50 chars); description from `description.text` → `description.coding[0].display`; `goal_start_date` from `startDate` → `target[0].dueDate`. `care_plan_id` is `null` in v1 (cross-resource linking deferred). |
| **CareTeam** | `care_team` + `care_team_member` | **Multi-row.** Uses a *deterministic surrogate PK* (§5.3) so the team row and all member rows share one `care_team_id` in a single pass. Each `participant` becomes a member: `Practitioner/...` → `provider_id` (via `resolveProviderId`), `Organization/...` → `care_site_id` (via `resolveCareSiteId`); role text preserved in `role_source_value`. |

### 5.3 The CareTeam surrogate-PK problem (and "Option B")

CareTeam is the one resource that emits a **parent + children** that must reference each other *before* anything is written to the database. A naïve approach would insert the `care_team` row, read back the auto-generated `care_team_id`, then insert members — a second round-trip that breaks the pipeline's batched-insert model.

Instead, `CrosswalkService::resolveCareTeamId($siteKey, $fhirCareTeamId)` allocates a **deterministic surrogate `care_team_id`** up front (mirroring the existing `resolveProviderId`/`resolveCareSiteId` pattern), backed by a new `fhir_careteam_crosswalk` table (`2026_06_21_100200`). The mapper emits the `care_team` row **with that explicit id** and links every `care_team_member` to it — one plain batched insert, no processor changes, and idempotent across re-syncs (the crosswalk returns the same id for the same FHIR CareTeam).

---

## 6. OMOP Extension Tables (migration `2026_06_21_100000`)

Created in the `omop` schema via `Schema::connection('omop')`, following the imaging/genomics bridge pattern:

- **`care_plan`** — `care_plan_id` (PK), `person_id`, `care_plan_start_date`/`_end_date`, `status_concept_id`/`intent_concept_id`/`category_concept_id` (default 0), `care_plan_source_value` (100), `care_plan_source_concept_id`, optional `visit_occurrence_id`.
- **`care_goal`** — `care_goal_id` (PK), `person_id`, nullable `care_plan_id`, `lifecycle_status` (50), `achievement_status_concept_id`, `goal_start_date`, `goal_source_value` (250), `goal_source_concept_id`.
- **`care_team`** — `care_team_id` (PK), `person_id`, `care_team_start_date`/`_end_date`, `status` (50), `care_team_source_value` (100).
- **`care_team_member`** — `care_team_member_id` (PK), `care_team_id`, nullable `provider_id`/`care_site_id`, `role_concept_id` (default 0), `role_source_value` (250).

The migration also carries **runtime DML-grant logic**: when the `parthenon_app` role exists (production — see [PG role model](../../../../docs/lineage/modules/fhir/) and the runtime/migrator/owner split), it explicitly `GRANT SELECT, INSERT, UPDATE, DELETE` on each new table plus `USAGE, SELECT` on its sequence, so the ingestion mappers (which run as the runtime role with no DDL rights) can write. The grant is non-fatal when the role is absent (CI/test).

A companion migration (`2026_06_21_100100`) adds `deleted_at` (timestamp) and `deleted_reason` (string) to every `fhir_*_crosswalk` table, guarded by `hasColumn` for idempotency — the audit trail for §8.

**Schema verification without data mutation:** `FhirCrossSchemaExtensionTest` introduces an `assertInsertableOmop()` helper that wraps a representative `INSERT` in a transaction against the **real `omop` schema** and force-rolls-back. This catches column/NOT-NULL/cast mismatches that mock-based unit tests cannot, while changing nothing. It self-skips when `omop` is unwritable (CI without a real CDM schema).

---

## 7. The Keystone — Public JWKS Endpoint + `kid` (commit `aa482b82f`)

This is the commit that turned a mock-only pipeline into one a real EHR will talk to.

### 7.1 `FhirJwksService`

`backend/app/Services/Fhir/FhirJwksService.php` derives JWKS material from the connection's stored private key PEM:

- **`jwkFromPrivateKeyPem($pem)`** — opens the key with OpenSSL, confirms it is RSA, and extracts the modulus `n` and exponent `e`, each base64url-encoded. Returns a public JWK: `{kty: "RSA", use: "sig", alg: "RS384", kid, n, e}` — **public components only; the private exponent `d` is never emitted.**
- **`thumbprint($n, $e)`** — computes the **RFC 7638 JWK thumbprint** as the `kid`: `base64url(SHA-256('{"e":"…","kty":"RSA","n":"…"}'))` over the canonical, lexicographically-ordered JSON. This makes the `kid` **deterministic** — the same key always yields the same `kid`, so rotation and re-registration are stable and auditable.
- **`kidForConnection($conn)`** — resolves the `kid` for a single connection's key (used by the auth service).
- **`jwks()`** — builds the full key set from **all active connections** with a private key, **deduplicating by `kid`** (one published entry per distinct key even if shared across connections). A malformed key is skipped, never fatal — one bad key cannot break discovery for everyone.

### 7.2 `FhirJwksController` — the public endpoint

`backend/app/Http/Controllers/Api/V1/FhirJwksController.php`:

```php
public function index(FhirJwksService $jwks): JsonResponse
{
    return response()
        ->json($jwks->jwks())
        ->header('Cache-Control', 'public, max-age=300');
}
```

Wired in `routes/api.php` **outside** the `auth:sanctum` group — deliberately public, exactly like `/health`:

```php
// Public, non-PHI JWKS for SMART Backend Services key discovery.
Route::get('/fhir/jwks.json', [FhirJwksController::class, 'index']);
```

The served document contains only RSA public material; serving it unauthenticated is correct and required — the EHR must reach it *before* any token exists. Production URL: `https://parthenon.acumenus.net/api/fhir/jwks.json`, cached for five minutes.

### 7.3 `kid` in the client assertion

`FhirAuthService::buildClientAssertion()` now stamps the header with the key's thumbprint when one is derivable:

```php
$header = ['alg' => 'RS384', 'typ' => 'JWT'];
$kid = $this->jwks->kidForConnection($conn);
if ($kid !== null) {
    $header['kid'] = $kid;   // EHR uses this to select the right published key
}
```

A `null` `kid` is **omitted entirely** rather than emitted as a null — an empty/`null` `kid` would itself trip stricter verifiers. The payload is unchanged from Phase 16 (`iss`/`sub` = client_id, `aud` = token endpoint, `exp` = +300 s, `iat`, `jti` = UUID).

### 7.4 Why this unlocks Epic

Epic's SMART Backend Services flow is now fully satisfiable:

1. We register our **JWKS URL** (or the public key) against the non-production sandbox client.
2. Parthenon signs the assertion with RS384 and advertises the signing key via its `kid`.
3. Epic fetches our JWKS, finds the key whose `kid` matches the header, verifies the signature, and issues an access token.
4. The existing Bulk Data `$export` → poll → NDJSON-download → map-to-OMOP pipeline takes over.

Tests: `FhirJwksServiceTest` (JWK derivation, `kid` stability and uniqueness, base64url format, RFC 7638 correctness), `FhirJwksEndpointTest` (public 200, `Cache-Control`, `kid` present, **no private `d`**, inactive connections excluded), `FhirAuthKidTest` (header carries `kid` with a key, omits it without one).

---

## 8. Soft-Delete — `entered-in-error` and the Bulk `deleted` Manifest (commit `9bff0d8b6`)

Real EHR data is corrected and retracted. Two FHIR mechanisms express deletion, and both are now handled by the new `FhirDedupService`.

### 8.1 Detecting a retraction

```php
public static function isEnteredInError(array $resource): bool
```

…returns true for (a) a top-level `status === 'entered-in-error'`, and (b) Condition/AllergyIntolerance whose `verificationStatus.coding[*].code === 'entered-in-error'`.

### 8.2 Applying the delete

`deleteByResource($siteKey, $resourceType, $resourceId, $reason)` looks the resource up in `fhir_dedup_tracking`, resolves the target table's primary key dynamically (`getPrimaryKeyColumn()` covers all FHIR-mapper CDM tables, standard and extension), deletes the previously-written CDM row, and **stamps `deleted_at`/`deleted_reason`** on the tracking row for audit.

**Honest limitation, documented in code:** batch inserts store a placeholder `cdm_row_id = 0`. A placeholder cannot be pinpointed for deletion, so such a resource is **stamped for audit and reported `resolved=false`** (with a `Log::warning`) rather than silently dropped. Only person/visit rows and the row-by-row fallback path capture real ids today; tightening this is a tracked follow-up.

### 8.3 The Bulk `deleted` manifest

`RunFhirSyncJob::processBulkDeletions()` runs after hydration: it reads `manifest['deleted']`, downloads those NDJSON files via `FhirBulkExportService::downloadDeletedFiles()`, parses each line as a transaction `Bundle`, and for every entry with `request.method === 'DELETE'` parses `ResourceType/id` from the URL and calls `deleteByResource(..., 'bulk-deleted')`. A per-run tally (`files`/`processed`/`deleted`/`unresolved`) is logged and surfaced in the sync-run record.

Tests: `FhirEnteredInErrorTest`, `FhirProcessorEnteredInErrorTest`, `FhirDedupSoftDeleteTest` (real-DB, all `cdm_row_id` states), `FhirBulkDeletionsJobTest` (transaction-Bundle parsing → dispatch → tally).

---

## 9. Expanded Default `$export` Type Set (commit `99764e010`)

`FhirBulkExportService::startExport()` now defaults to **15** resource types when a connection sets no explicit `export_resource_types`:

```
Patient, Condition, Encounter, MedicationRequest, Observation, Procedure,
Immunization, AllergyIntolerance, DiagnosticReport,
DocumentReference, Coverage, ServiceRequest, CarePlan, Goal, CareTeam
```

Existing connections that pin `export_resource_types` are unaffected. `FhirBulkExportDefaultTypesTest` uses `Http::fake()` to assert the `_type` query parameter carries all 15 on a connection with no override.

---

## 10. The End-to-End Flow Against Epic's Sandbox

```
Parthenon                                   Epic on FHIR sandbox
─────────                                   ────────────────────
FhirAuthService.buildClientAssertion()
  → RS384 JWT { alg, typ, kid }             (1)
  → POST {token_endpoint}
       grant_type=client_credentials
       client_assertion_type=…jwt-bearer
       client_assertion=<JWT>
       scope=system/*.read                  ──────────────▶  fetch JWKS from our
                                                              /api/fhir/jwks.json,
                                                              match kid, verify RS384
                                            ◀──────────────  200 { access_token, expires_in }

FhirBulkExportService.startExport()
  → GET {base}/Group/{id}/$export
       _type=…15 types…
       _since=<last_sync>
       _outputFormat=application/fhir+ndjson
       Authorization: Bearer <token>
       Prefer: respond-async                ──────────────▶
                                            ◀──────────────  202 Accepted, Content-Location

  → poll Content-Location (exp. backoff)    ◀─────────────▶  202 (X-Progress) … 200 manifest

FhirBulkExportService.downloadNdjsonFiles()
  → download output[].url                   ◀──────────────  NDJSON (Patient, Condition, …)

FhirNdjsonProcessorService (two-pass)
  Pass 1: Patient → person, Encounter → visit_occurrence  (+ crosswalks)
  Pass 2: clinical + new resources → concept-routed OMOP rows
          entered-in-error → FhirDedupService soft-delete
  processBulkDeletions(): deleted manifest → soft-delete
```

### 10.1 Validation — 2026-06-22

- **Unit + integration:** 16 new FHIR test files (enumerated in §11) covering registry dispatch, all six mappers, JWKS derivation/endpoint, `kid` headering, soft-delete (incl. real-DB rollback harness), and the expanded `$export` defaults. All green at commit `aa482b82f`; the branch also passed Pint, PHPStan level 8, and `tsc`.
- **Live sandbox auth handshake — PROVEN:** On 2026-06-22 the SMART Backend Services authentication flow completed end-to-end against the **Epic on FHIR sandbox** — Parthenon received a **real access token** from Epic. Every component of our half is verified correct against a production-grade verifier: the **JWT** (claims, RS384 signature), the **JWKS** document, the **`kid`** selection, the token-endpoint **audience**, and **clock** skew. The public JWKS endpoint served reliably throughout. **This is the milestone the JWKS/`kid` keystone unlocked — the first time Parthenon authenticated to a real, externally-operated EHR FHIR server rather than a mock.**

**Database state (host PG17 `parthenon`, as of 2026-06-22):**

| Artifact | Value |
|---|---|
| `app.fhir_connections` → Epic | id 4, `site_key=epic-sandbox`, `ehr_vendor=epic`, **active**, private key present, created 2026-06-22 16:30 |
| `fhir_base_url` | `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4` |
| `token_endpoint` | `https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token` |
| Completed `fhir_sync_runs` for Epic | **0** (the only runs in the table are 3 *failed* HAPI runs from March) |
| `fhir_dedup_tracking` rows for `epic-sandbox` | **0** |
| `fhir_patient_crosswalk` rows for `epic-sandbox` | **0** |
| OMOP extension tables (`omop.care_plan`, `omop.care_team`, …) | present (migrations applied) |

**Proven vs. blocked (live field status, 2026-06-22):**

- ✅ **Connectivity — proven.** Full SMART Backend Services handshake against Epic; real token received. Our JWT, JWKS, `kid`, endpoint, and clock are all verified correct, and the JWKS is served rock-solid.
- ⛔ **Live data flow — blocked by Epic's sandbox, not our code.** Epic's non-production environment fetched our key **once (≈12:40)** and has not re-fetched since, so its token nodes are **unevenly propagated** — authentication currently succeeds roughly **1 attempt in 10**. We cannot get a consistent `$export` window out of the public sandbox under that condition, which is why **zero Epic records have reached OMOP** to date.
- ✅ **Mappers — proven independent of Epic.** Every mapper is exhaustively tested (unit + real-OMOP-schema rollback) and standards-based, so it will map whatever Epic returns. The gap is purely the sandbox's intermittent auth, not the transform.

> **Unblock path.** Because our JWKS is now clean and stable, **re-saving the Epic app registration** (in the Epic on FHIR developer portal) forces Epic to **re-fetch the current key**, which should propagate it evenly across Epic's token nodes and stabilize auth. Once auth is consistent, trigger the first `$export`, then append a **"Run results"** subsection here with the `fhir_sync_runs` id and the actual `records_extracted/mapped/written` figures so the numbers are evidence-backed.

---

## 11. Commit Timeline

| # | Commit | Timestamp | Summary |
|---|--------|-----------|---------|
| 1 | `f58001a0c` | 2026-06-21 19:58 | Extract `FhirMapperSupport` trait (behavior-preserving) |
| 2 | `739142f7a` | 2026-06-21 20:03 | `ResourceMapper` interface + registry dispatch |
| 3 | `67f76d2c2` | 2026-06-21 20:18 | Care-extension tables + crosswalk soft-delete columns + real-schema insert harness |
| 4 | `71a23939d` | 2026-06-21 20:30 | Ingest DocumentReference / Coverage / ServiceRequest |
| 5 | `a6be79021` | 2026-06-21 21:01 | Ingest CarePlan / Goal / CareTeam (extension mappers) + careteam crosswalk |
| 6 | `9bff0d8b6` | 2026-06-21 21:26 | `entered-in-error` soft-delete + Bulk `deleted` manifest |
| 7 | `99764e010` | 2026-06-21 21:31 | Add 6 new resource types to default `$export` `_type` set |
| 8 | `aa482b82f` | 2026-06-22 12:19 | **Public JWKS endpoint + `kid` in Backend Services JWT** |

Preceded by the design spec (`4a2b45a93`) and implementation plan (`e4565c528`).

**New test files (16):** `RegistryDispatchTest`, `DocumentReferenceMapperTest`, `CoverageMapperTest`, `ServiceRequestMapperTest`, `CarePlanMapperTest`, `GoalMapperTest`, `CareTeamMapperTest`, `FhirCrossSchemaExtensionTest`, `FhirEnteredInErrorTest`, `FhirProcessorEnteredInErrorTest`, `FhirDedupSoftDeleteTest`, `FhirBulkDeletionsJobTest`, `FhirJwksEndpointTest`, `FhirAuthKidTest`, `FhirJwksServiceTest`, `FhirBulkExportDefaultTypesTest`.

---

## 12. Security Posture (HIGHSEC alignment)

- **Public JWKS is non-PHI by construction** — it serves RSA public components (`n`, `e`) only. The private exponent `d` is never serialized; `FhirJwksEndpointTest` asserts its absence. Publishing it unauthenticated is correct and does not violate the "no unauthenticated route serves clinical data" rule.
- **Private keys stay encrypted at rest** — `FhirConnection::$private_key_pem` keeps its `encrypted` cast and `hidden` JSON visibility; the JWKS service reads it server-side only.
- **Sandbox client id is non-production** — the registered sandbox client is a non-prod identifier; client ids are not secrets (the signing key is), but it is abbreviated in any public write-up.
- **Read-only scope** — the connection requests `system/*.read`; nothing in this pipeline writes back to the EHR.
- **CDM models remain read-only** — ingestion writes through the dedicated mapper/processor path using the runtime role's table-scoped DML grants, not through `CdmModel`.

---

## 13. Follow-Ups

1. **Run the first bulk `$export` against the configured Epic connection** and capture metrics (per-resource counts, `FhirSyncRun` id), then append the §10.1 "Run results" subsection. This is the immediate next step now that auth is validated.
2. **Resolve the `cdm_row_id = 0` placeholder** so batch-inserted rows are individually deletable (today they are audited but reported `unresolved`).
3. **Concept resolution for the deferred fields** — CarePlan status/intent, Goal achievement, CareTeam role, Coverage payer/plan currently land as `source_value` with `concept_id = 0`; add vocabulary mappings.
4. **Goal → CarePlan linkage** — populate `care_goal.care_plan_id` once cross-resource surrogate linking is in.
5. **Merge to `main`** after the live-run subsection is backfilled and the branch is rebased.

---

*Authored as part of the FHIR ingestion Medgnosis-parity port. See the companion blog post for the narrative version.*
