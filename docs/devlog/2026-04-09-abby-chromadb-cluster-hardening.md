# Abby ChromaDB Cluster Hardening

Date: 2026-04-09

## Summary

This pass treated ChromaDB as Abby's knowledge substrate and cleaned the collections that were still producing weak or misleading cluster labels.

The work landed in three layers:

- metadata cleanup and gating so low-value or stale content does not stay in the live collections
- projection/labeling improvements so the explorer uses the most meaningful fields available per collection
- live rebuilds and refreshes so the running Chroma collections match the current code and metadata model

The largest practical outcomes are:

- `docs` no longer contains `site/node_modules` / generated content in the live collection
- `clinical_reference` was rebuilt from the authoritative OMOP query and no longer contains `RxNorm Extension`
- `ohdsi_papers` now carries broad domain plus subtopic metadata instead of clustering mostly by journal/year/author

## What Changed

### Docs cluster cleanup

Primary files:

- `ai/app/chroma/docs_taxonomy.py`
- `ai/app/chroma/ingestion.py`
- `ai/app/services/projection.py`
- `ai/tests/test_chroma_ingestion.py`
- `ai/tests/test_projection_service.py`

Key changes:

- added docs path taxonomy derivation for `category`, `subcategory`, `page_type`, and `workspace`
- skipped generated/vendor trees including `build-root`
- added stale-row purging for docs ingestion
- made docs reingest refresh unchanged files when stored chunks are missing newer metadata fields
- made projection recover useful docs labels from legacy `source_file` paths

Live result:

- before: `68,849` docs chunks with `44,113` `node_modules` chunks and effectively no cluster taxonomy fields
- after: `24,756` docs chunks from `480` source files, with `0` vendor/generated rows left and full `type` / `category` / `workspace` coverage

### Clinical reference rebuild

Primary files:

- `ai/app/chroma/clinical.py`
- `ai/app/services/projection.py`
- `ai/tests/test_chroma_clinical.py`
- `ai/tests/test_projection_service.py`

Key changes:

- enriched clinical concept metadata with `category`, `type=clinical_concept`, `source_type=omop_concept`, `source=clinical_reference`, and `concept_class_id`
- added resilient batch upserts for Chroma disconnects
- added resumable full rebuild support so a partial clean load can continue from the current offset without dropping the collection again
- taught projection to use clinical metadata even for legacy rows

Live result:

- before: `985,299` rows, with sampled `RxNorm Extension` contamination and no cluster metadata fields
- after: `624,821` rows, exactly matching the authoritative OMOP query
- direct live lookup for `vocabulary_id='RxNorm Extension'` returned `0`

### OHDSI paper gating and topical enrichment

Primary files:

- `OHDSI-scraper/merge_corpus.py`
- `OHDSI-scraper/corpus/metadata.csv`
- `OHDSI-scraper/corpus/quarantine.csv`
- `ai/app/chroma/ingestion.py`
- `ai/app/chroma/quality.py`
- `ai/app/services/projection.py`
- `ai/tests/test_merge_corpus_gate.py`
- `ai/tests/test_chroma_ingestion.py`

Key changes:

- kept the upstream paper gate for `allow` / `quarantine` / `reject`
- preserved trust/provenance fields into Chroma
- added broad-domain and subtopic enrichment for allowed papers:
  - `ehr-data-infrastructure`
  - `clinical-applications`
  - `network-studies`
  - `methods-statistics`
  - `patient-level-prediction`
  - `vocabulary-mapping`
  - `genomics`
  - `data-quality`
  - `imaging`
- wrote `Primary Domain`, `Category`, and `Topic Signals` into the merged corpus
- made paper ingest refresh unchanged PDFs when the topical metadata schema improves
- taught projection to label paper clusters as `primary_domain + category` for research papers

Live result:

- allowed paper corpus remains `493` PDFs / `19,493` chunks
- all live paper chunks now have `primary_domain`, `category`, and `topic_signals`
- top paper domains after enrichment:
  - `ehr-data-infrastructure`: `166`
  - `clinical-applications`: `108`
  - `network-studies`: `55`
  - `methods-statistics`: `54`
  - `patient-level-prediction`: `48`
  - `vocabulary-mapping`: `31`

## Verification

Focused suites that passed during this pass:

- `pytest ai/tests/test_merge_corpus_gate.py ai/tests/test_chroma_ingestion.py ai/tests/test_projection_service.py ai/tests/test_chroma_retrieval.py`
- `pytest ai/tests/test_chroma_clinical.py ai/tests/test_projection_service.py ai/tests/test_chroma_retrieval.py`
- `pytest ai/tests/test_chroma_ingestion.py ai/tests/test_projection_service.py ai/tests/test_chroma_memory.py ai/tests/test_chroma_clinical.py ai/tests/test_chroma_retrieval.py`

Live checks completed:

- docs collection reingested and purged
- clinical collection rebuilt and resumed successfully after a transient Chroma disconnect
- paper corpus reingested from enriched staged metadata
- Solr vector explorer refreshed for:
  - `docs`
  - `clinical_reference`
  - `conversation_memory`
  - `medical_textbooks`
  - `ohdsi_papers`

## Remaining Work

The main remaining collection hygiene task is `conversation_memory`.

New conversation rows now carry richer metadata, and projection can recover missing fields for legacy rows, but the collection has not yet had a full normalization/backfill pass comparable to `clinical_reference`.
