# Claims Solr Core + Clinical Notes Indexing — Design

**Date:** 2026-03-09

## Overview

Add a new `claims` Solr core for searching healthcare claims and claims_transactions, and extend the existing `clinical` core to index clinical notes from `omop.note`.

## New `claims` Core Schema

- `claim_id` (uniqueKey, string) — UUID
- `patient_id` (plong), `patient_name` (text_general)
- `provider_id` (plong)
- `service_date` (pdate) — range queries
- `diagnosis_codes` (string, multiValued), `diagnosis_names` (text_general, multiValued)
- `claim_status` (string), `claim_type` (string) — facets
- `total_charge`, `total_payment`, `total_adjustment`, `outstanding` (pfloat)
- `department_id` (plong), `transaction_count` (pint)
- `procedure_codes` (string, multiValued), `place_of_service` (string)
- `line_notes` (text_general) — concatenated transaction notes

Facets: claim_status, claim_type, place_of_service, diagnosis_codes

## Clinical Core Extension (Notes)

Add to existing clinical schema: `note_title`, `note_text` (text_general), `note_class` (string), `provider_id` (plong). Indexed as `event_type: "note"`.

## Backend Components

- `solr/configsets/claims/conf/schema.xml` + `solrconfig.xml`
- `SolrIndexClaims.php` — Artisan command
- `SolrIndexClinical.php` — Add note domain
- `ClaimsSearchService.php` — Search service
- `ClaimsSearchController.php` — API endpoints
- `docker-compose.yml` — 7th precreated core
- `config/solr.php` — Add claims core

## API

`GET /api/v1/claims/search?q=&status=&date_from=&date_to=&min_amount=&max_amount=`
