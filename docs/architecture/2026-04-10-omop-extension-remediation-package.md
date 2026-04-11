# OMOP Extension Remediation Package

## Scope

This package targets the localhost PostgreSQL 17 instance, database `parthenon`, schema `omop`.

As inspected on 2026-04-10, the live `omop` schema:

- is the Acumenus CDM of record on localhost
- advertises `cdm_version = 5.3` in `omop.cdm_source`
- contains populated core clinical tables
- does not contain the current public OHDSI Imaging, Genomics, or GIS extension tables
- contains `episode` and `episode_event`, but both are empty
- does not contain the Oncology modifier columns `modifier_of_event_id` and `modifier_of_field_concept_id` on `omop.measurement`

The repo also already contains app-layer precursor tables:

- `app.imaging_studies`, `app.imaging_series`, `app.imaging_features`
- `app.genomic_uploads`, `app.genomic_variants`
- `app.location_history`, `app.external_exposure`

Those app-layer tables are retained. This package is intentionally additive.

## Goals

1. Add the missing OHDSI-aligned extension structures in `omop` without dropping or rewriting existing data.
2. Preserve source provenance through explicit crosswalk tables.
3. Make backfill reversible and auditable.
4. Keep the existing application operational during migration.

## Non-Destructive Rules

- Do not `DROP` or rename existing `app.*` or `omop.*` tables.
- Do not overwrite source rows in `app.imaging_*`, `app.genomic_*`, or `app.location_history` / `app.external_exposure`.
- Use additive `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Backfill with `NOT EXISTS` guards and crosswalk tables.
- Update application read paths only after reconciliation succeeds.
- Do not change `omop.cdm_source.cdm_version` to `5.4` until the remaining core deltas are formally reviewed and accepted.

## Package Contents

- [2026-04-10-omop-next-agent-remediation-plan.md](/home/smudoshi/Github/Parthenon/docs/devlog/2026-04-10-omop-next-agent-remediation-plan.md)
  Next-agent checklist for the remaining validation, smoke testing, dry-run, packaging, and deferred-decision work.
- [001_preflight_inventory.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/001_preflight_inventory.sql)
  Read-only inventory and gap checks against localhost.
- [010_core_oncology_additive.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/010_core_oncology_additive.sql)
  Adds missing oncology-support columns and optional supporting table.
- [011_core_oncology_indexes.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/011_core_oncology_indexes.sql)
  Builds heavyweight indexes on the large localhost `omop.measurement` table.
- [020_imaging_extension.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/020_imaging_extension.sql)
  Creates `omop.image_occurrence` and `omop.image_feature`.
- [021_imaging_series_bridge.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/021_imaging_series_bridge.sql)
  Adds a lossless series-level bridge from app imaging rows to `omop.image_occurrence`.
- [030_genomics_extension.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/030_genomics_extension.sql)
  Creates `omop.genomic_test`, `omop.target_gene`, `omop.variant_occurrence`, and `omop.variant_annotation`.
- [040_gis_extension.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/040_gis_extension.sql)
  Creates `omop.location_history` and `omop.external_exposure`.
- [050_crosswalks_and_backfill.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/050_crosswalks_and_backfill.sql)
  Creates additive mapping tables in `app` and provides opt-in backfill templates.
- [052_imaging_safe_backfill.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/052_imaging_safe_backfill.sql)
  Executes a first-pass Acumenus-only imaging backfill for strictly safe series matches.
- [053_imaging_complete_backfill.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/053_imaging_complete_backfill.sql)
  Completes acquisition-series imaging backfill by deriving OMOP `procedure_occurrence` rows where no safe native procedure linkage exists.
- [054_genomics_foundationone_backfill.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/054_genomics_foundationone_backfill.sql)
  Materializes the single person-linked FoundationOne upload into OMOP genomics tables and explicitly excludes benchmark GIAB uploads from OMOP backfill.
- [060_validation_queries.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/060_validation_queries.sql)
  Reconciliation, completeness, and compliance checks.

## Gap Matrix

| Area | Live localhost state | Target state | Package |
|---|---|---|---|
| Core CDM label | `omop.cdm_source.cdm_version = 5.3` | Remain labeled `5.3` until full review is complete | Documented only |
| Oncology support | `episode` and `episode_event` exist, but empty; measurement missing modifier columns | Add missing modifier columns and optional `concept_numeric` support table | `010` |
| Imaging WG | No `omop.image_occurrence`, no `omop.image_feature` | Add both tables and crosswalks from `app.imaging_*` | `020`, `050` |
| Genomic-CDM prototype | No `genomic_test`, `target_gene`, `variant_occurrence`, `variant_annotation` | Add all four and crosswalks from `app.genomic_*` | `030`, `050` |
| GIS WG | No `omop.location_history`, no `omop.external_exposure` | Add both in `omop` without touching current app-layer tables | `040`, `050` |

## Recommended Execution Order

1. Run preflight.
2. Create additive structures.
3. Create the series-level imaging bridge before any MI-CDM row inserts.
4. Load vocabulary and concept mappings needed by imaging/genomics.
5. Backfill crosswalks and staged rows.
5. Reconcile counts and null rates.
6. Only then wire app code to use new `omop` extension tables.

## Localhost Execution Status

As of 2026-04-10 on localhost `parthenon`:

- `010`, `020`, `021`, `030`, `040`, and `050` have been applied.
- `052` was applied for the strict first-pass imaging matches.
- `053` was applied after normalizing the derived imaging procedure sequence to stay within the live `omop.procedure_occurrence_id` integer range.
- `054` was applied to backfill the single clinically linked FoundationOne upload into OMOP genomics tables.
- `011` has not been applied yet because it adds heavyweight indexes on `omop.measurement`.

Current imaging state on localhost:

- `omop.image_occurrence`: `925` rows
- `app.imaging_series.image_occurrence_id`: `925` linked rows
- `app.imaging_series_omop_xref`: `925` rows total
- `app.imaging_procedure_omop_xref`: `112` derived study+modality procedure bridges
- `app.imaging_studies.image_occurrence_id`: `8` rows populated for backward-compatible single-series study cases
- `app.imaging_features`: `0` rows, so no `omop.image_feature` backfill was needed

Completion boundary:

- All source `47` Acumenus imaging series with non-null `person_id`, non-null `study_date`, and modality in `CT`, `MR`, `PT`, `CR`, or `US` are now linked into `omop.image_occurrence`.
- The remaining unlinked Acumenus imaging series currently lack `person_id`, which makes OMOP-compliant `image_occurrence.person_id` backfill impossible without upstream remediation.

Current genomics state on localhost:

- `omop.specimen`: `1` row
- `omop.genomic_test`: `1` row
- `omop.target_gene`: `0` rows
- `omop.variant_occurrence`: `4` rows
- `omop.variant_annotation`: `37` rows
- `app.genomic_upload_omop_context_xref`: `1` row
- `app.genomic_variant_omop_xref`: `4` person-linked rows
- `app.omop_genomic_test_map`: `8` rows total, of which `7` are marked `excluded_benchmark`
- `app.omop_gene_symbol_map`: `4` FoundationOne gene mappings verified against the HGNC REST API on 2026-04-10

Completion boundary:

- The only clinically linked upload on localhost, `TRF091836.pdf` for person `1005788`, is now materialized into `omop.specimen`, `omop.genomic_test`, `omop.variant_occurrence`, and `omop.variant_annotation`.
- The seven GIAB benchmark VCF uploads remain in `app.genomic_uploads` and `app.genomic_variants` only. They are intentionally excluded from OMOP backfill because they do not carry person linkage in localhost `parthenon`.
- `omop.target_gene` remains intentionally unpopulated because the FoundationOne panel manifest is not present in source data, and populating only observed genes would overstate assay target coverage.

## Suggested Local Dry-Run

Each DDL file can be syntax-checked safely inside a single transaction:

```bash
psql -d parthenon -v ON_ERROR_STOP=1 \
  -c "begin" \
  -f scripts/omop-extension-package/010_core_oncology_additive.sql \
  -f scripts/omop-extension-package/011_core_oncology_indexes.sql \
  -f scripts/omop-extension-package/020_imaging_extension.sql \
  -f scripts/omop-extension-package/030_genomics_extension.sql \
  -f scripts/omop-extension-package/040_gis_extension.sql \
  -f scripts/omop-extension-package/050_crosswalks_and_backfill.sql \
  -c "rollback"
```

`011_core_oncology_indexes.sql` builds indexes on the very large localhost `omop.measurement` table. Run it in a separate maintenance window if the added columns are not yet query-critical.

## Rollout Guidance

- Run on localhost first.
- Promote to staging before any production work.
- Keep app-layer tables as the system of record until validation passes.
- Switch to dual-write before changing reads.
- Treat the xref seed statements in `050_crosswalks_and_backfill.sql` as opt-in steps. They are commented out by default because `app.genomic_variants` is large enough to make eager seeding an avoidable operational cost.
- Prefer `app.imaging_series.image_occurrence_id` and `app.imaging_series_omop_xref` over `app.imaging_studies.image_occurrence_id` for MI-CDM linkage. `image_occurrence` is study+series grain, so a study-only foreign key is not lossless.

## Notes

- The imaging and genomics backfills are intentionally conservative. They create the standards-aligned target structures and the audit crosswalks, but they do not force lossy assumptions for unresolved vocabulary mappings.
- The genomics public artifacts are still a prototype track rather than a ratified canonical OMOP core extension. This package implements the public prototype structure without destroying the existing application model.
