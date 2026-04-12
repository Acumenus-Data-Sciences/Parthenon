---
slug: v1-0-5-data-quality-validation
title: "Parthenon v1.0.5 — Data Quality & Validation"
description: "Second stabilization release — programmatic audits across Achilles, DQD, vocabulary, ingestion, FHIR, migrations, and cross-schema FK integrity. 68 new tests, 4,916 assertions."
authors: [mudoshi]
tags: [release, data-quality, validation, stabilization]
date: 2026-04-11
---

## v1.0.5 — Data Quality & Validation

v1.0.5 is the second stabilization release in the v1.0.x arc. With test
infrastructure in place from v1.0.4, this release focuses on **data integrity
across the platform** — programmatic audits that verify correctness of SQL
generation, schema routing, vocabulary resolution, FHIR transformation,
migration safety, and cross-schema referential integrity.

<!--truncate-->

### Why data quality matters

Parthenon queries OMOP CDM data across 5 sources, each in its own PostgreSQL
schema but sharing a single `vocab` schema for vocabulary. Every SQL template,
every DQD check, every concept set resolution must correctly substitute the
right schema name — a single hardcoded `omop.` in a template breaks silently
for SynPUF, IRSF, Pancreas, and Eunomia. v1.0.5 adds programmatic guards
that catch these issues automatically.

### Achilles & DQD audit

- **128 Achilles SQL templates audited** — every analysis verified for correct
  `{@cdmSchema}`, `{@resultsSchema}`, and `{@vocabSchema}` placeholder usage.
  No vocabulary tables using `{@cdmSchema}`, no hardcoded schema names, no
  unresolved placeholders. Zero violations found; test serves as regression guard.
- **170+ DQD checks validated across all 5 CDM sources** — each check's
  `sqlTotal()` and `sqlViolated()` verified for correct schema substitution
  with Acumenus (omop/vocab), SynPUF (synpuf/vocab), IRSF (irsf/vocab),
  Pancreas (pancreas/vocab), and Eunomia (eunomia/eunomia). 4,770 assertions.
- **Results schema routing validated** — confirmed each source resolves to a
  distinct results schema (results, synpuf_results, irsf_results,
  pancreas_results, eunomia_results) with no collisions, and that
  `SET search_path` succeeds for each.

### Vocabulary validation

- **Solr index completeness command** (`solr:validate-vocabulary`) — compares
  Solr `vocabulary` core document count against `vocab.concept` standard
  concepts, with spot-check sampling. Reports coverage % and exits non-zero
  if below 95%.
- **Concept set resolution schema audit** — verified `resolveToSql()` generates
  correct `vocab.concept_ancestor` and `vocab.concept_relationship` references,
  uses singular OMOP table names, and correctly substitutes `eunomia` schema
  for the Eunomia demo source.

### Ingestion & ETL validation

- **Row count verification infrastructure** — validated that
  `PostLoadValidationService`, `ValidationResult`, and `IngestionJob` have
  the correct method signatures, column schemas, and relationship wiring for
  end-to-end row count tracking through the pipeline.
- **FHIR-to-CDM transformation fidelity** — 31 tests covering Patient (gender
  mapping to OMOP concept IDs, birth date parsing, US Core race/ethnicity
  extensions), Condition (SNOMED/ICD-10-CM mapping, onset/abatement dates),
  MedicationRequest (RxNorm mapping), Observation (category-based routing to
  measurement vs observation), and code system URI resolution.

### Database integrity

- **242 migrations audited for idempotency** — verified all have both `up()`
  and `down()` methods, no unsafe `DROP TABLE` without `IF EXISTS` in rollback,
  no `$guarded = []` HIGHSEC violations. 3 advisory `dropIfExists` warnings
  in `up()` (all intentional cleanup migrations).
- **Cross-schema FK integrity validated** — live queries against localhost PG17
  verifying person.gender_concept_id, condition_concept_id,
  measurement_concept_id, and visit_occurrence.person_id all resolve to valid
  vocab.concept or person records. **Finding:** orphan drug_concept_ids in the
  40213xxx range (SynPUF vocabulary version mismatch) — flagged as warning,
  investigation pending.
- **OMOP CDM CHECK constraints migration** — adds 24 database-level CHECK
  constraints across 4 CDM schemas (omop, synpuf, irsf, pancreas) enforcing
  required fields: person gender/year_of_birth, visit/condition/drug start
  dates, and observation_period date ordering. Idempotent via DO/EXCEPTION.

### OMOP Extension Bridge validation

- **1,715 imaging + 47 genomics records validated** — read-only count
  verification of the OMOP extension bridge (image_occurrence, specimen,
  genomic_test, variant_occurrence, variant_annotation) and all app-layer
  xref tables. 10 Pest smoke tests for bridge model queryability.

### By the numbers

- **New test files:** 11
- **New tests:** 68
- **New assertions:** 4,916
- **Achilles analyses audited:** 128
- **DQD checks validated:** 170+
- **CDM sources cross-validated:** 5
- **Migrations audited:** 242 (now 243)
- **CHECK constraints added:** 24

### Data quality finding

The cross-schema FK audit discovered orphan `drug_concept_id` values in the
40213xxx range within `omop.drug_exposure`. These are SynPUF-era concept IDs
that don't exist in the current `vocab.concept` table — a vocabulary version
mismatch. This is flagged as a warning and will be resolved in a future
vocabulary re-index or concept remapping pass.

### Upgrade notes

One new migration: `2026_04_11_000001_add_omop_cdm_check_constraints.php`.
Run `php artisan migrate` to apply the CHECK constraints. The migration is
idempotent — safe to re-run.

New Artisan command: `php artisan solr:validate-vocabulary` for operational
Solr index validation.

All other changes are test files — no API changes, no frontend changes, no
breaking changes.

### Contributors

Claude Code + @sudoshi
