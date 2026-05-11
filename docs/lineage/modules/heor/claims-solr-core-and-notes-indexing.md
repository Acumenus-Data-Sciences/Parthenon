# Claims Solr Core & Clinical Notes Indexing

**Date:** 2026-03-09
**Commits:** `d45ef6bc`, `abf9dce0`

## What Was Built

### New `claims` Solr Core

Added a 7th Solr core dedicated to healthcare claims search across 26.3M claims and their transaction line items.

**Schema (20 fields):**
- Claim header: `claim_id`, `patient_id`, `provider_id`, `service_date`, `last_billed_date`
- Diagnoses: `diagnosis_codes` (multiValued, up to 8), `diagnosis_names` (resolved from concept table)
- Financials: `total_charge`, `total_payment`, `total_adjustment`, `outstanding`
- Transactions: `transaction_count`, `procedure_codes` (multiValued), `place_of_service`
- Full-text: `line_notes` (concatenated transaction notes), `patient_name` (with suggest/autocomplete)
- Facets: `claim_status`, `claim_type`, `place_of_service`, `diagnosis_codes`

**Backend components:**
- `SolrIndexClaims.php` — Artisan command with `--fresh`, `--limit`, `--schema` options. Joins claims → person for patient data, aggregates transactions per claim (CHARGE/PAYMENT/ADJUSTMENT), resolves diagnosis codes to concept names.
- `ClaimsSearchService.php` — edismax search with weighted fields (patient_name^3, diagnosis_names^2, line_notes^1), financial range filters (`min_charge`, `max_charge`, `has_outstanding`), date range filters, Solr stats for financial aggregates.
- `ClaimsSearchController.php` — `GET /api/v1/claims/search` with query params: `q`, `status`, `type`, `diagnosis`, `date_from`, `date_to`, `min_charge`, `max_charge`, `has_outstanding`, `patient_id`, `limit`, `offset`.

**Response includes:**
- Paginated items with highlights
- Faceted counts (status, type, place of service, diagnosis codes)
- Statistical aggregates (min/max/sum/mean for charge, payment, outstanding)

### Clinical Notes in Existing `clinical` Core

Extended the clinical Solr core to index OMOP `note` table (52.6M notes).

**Schema additions:** `note_title`, `note_text` (full clinical text), `note_class`, `provider_id`

**Indexer:** Added `note` as 7th domain in `SolrIndexClinical.php` with dedicated `indexNotes()` method. Notes join to concept table for note type and class resolution. Indexed as `event_type: "note"` with `event_id: "note_{source_id}_{note_id}"`.

**Search:** Updated `ClinicalSearchService` query fields to include `note_text^2` and `note_title^2`, added note fields to `fl` and `hl.fl`.

### Infrastructure Changes

- `docker-compose.yml` — 7th precreated core (`claims`), configset volume mount
- `backend/config/solr.php` — Added `claims` core entry
- `backend/routes/api.php` — `GET /api/v1/claims/search` route

## Data Volumes

| Table | Rows | Source |
|-------|------|--------|
| `omop.claims` | 26,293,465 | Generated from OMOP CDM visit data |
| `omop.claims_transactions` | ~78M (3 per claim) | CHARGE + ADJUSTMENT + PAYMENT |
| `omop.note` | 52,586,900 | Generated clinical notes with full text |

## Gotchas

- **Type mismatch:** `claims.patientid` is `varchar`, `person.person_id` is `bigint` — need explicit `::bigint` cast in JOIN
- **Solr schema reload:** `precreate-core` copies configset at creation time — updating the mounted configset requires UNLOAD + re-precreate (not just RELOAD)
- **Eunomia has no `note` table** — the indexer gracefully handles this per-source, but logs an error. Use `--source=2` to target only Acumenus.
- **Full index is long-running** — 26M claims with per-claim transaction aggregation. Run with `docker compose exec -d php` for background execution.

## Usage

```bash
# Index claims (limited for testing)
docker compose exec php php artisan solr:index-claims --limit=1000 --fresh

# Full claims index (background, ~hours for 26M)
docker compose exec -d php php artisan solr:index-claims --fresh --schema=omop

# Index clinical notes
docker compose exec php php artisan solr:index-clinical --domain=note --source=2

# Search claims via API
curl "http://localhost:8082/api/v1/claims/search?q=diabetes&status=CLOSED&min_charge=1000"
```
