# OMOP Extension Handoff

Date: 2026-04-10

## Executive Summary

This handoff captures the localhost PostgreSQL 17 OMOP extension work completed against the `parthenon` database, the exact live state now present in `omop` and `app`, the scripts and repo files that were added or modified, the verification results, and the remaining work boundaries for the next agent.

The important high-level result is:

- the additive OHDSI-aligned extension structures for Imaging, Genomics, GIS, and Oncology support are now present in localhost `omop`
- the imaging backfill is complete for every OMOP-eligible Acumenus acquisition series currently present on localhost
- the genomics backfill is complete for the only clinically person-linked upload currently present on localhost
- no destructive operations were used
- no existing source rows in `app.imaging_*` or `app.genomic_*` were deleted or overwritten

The next agent should think in terms of:

- not redoing already-complete imaging backfill work
- respecting the current completion boundaries
- focusing any further imaging work on upstream person-link remediation or future `image_feature` backfill
- treating the seven GIAB benchmark uploads as intentionally out of scope for OMOP materialization unless the user explicitly decides to model non-clinical benchmark data differently

## User Intent and Non-Destructive Constraint

The user explicitly asked for:

- evaluation of the localhost PostgreSQL 17 OMOP schema
- comparison against current public OHDSI extension work
- additive implementation on localhost
- no data loss
- methodical migration from app-layer imaging/genomics structures into OMOP-aligned extension tables

Those constraints were followed throughout:

- no `DROP` of source tables
- no destructive `git` operations
- no delete of source app rows
- only additive tables, additive columns, xref tables, inserts, and updates to nullable bridge fields

## Localhost Database Target

- PostgreSQL: `17.9`
- Database: `parthenon`
- Primary source schema evaluated and extended: `omop`
- App-layer staging/support schema used for source data and crosswalks: `app`

`omop.cdm_source` still advertises `cdm_version = 5.3`. That label has not been changed.

## What Was Added Structurally

### OMOP additive tables/columns

Applied live on localhost:

- `omop.image_occurrence`
- `omop.image_feature`
- `omop.genomic_test`
- `omop.target_gene`
- `omop.variant_occurrence`
- `omop.variant_annotation`
- `omop.location_history`
- `omop.external_exposure`
- `omop.concept_numeric`
- `omop.measurement.modifier_of_event_id`
- `omop.measurement.modifier_of_field_concept_id`

### App-side additive bridge/xref tables

Applied live on localhost:

- `app.imaging_series_omop_xref`
- `app.imaging_procedure_omop_xref`
- `app.omop_genomic_test_map`
- `app.omop_gene_symbol_map`
- `app.genomic_variant_omop_xref`
- `app.genomic_upload_omop_context_xref`

### App-side additive columns

Applied live on localhost:

- `app.imaging_series.image_occurrence_id`

Pre-existing nullable compatibility fields that were populated selectively:

- `app.imaging_studies.image_occurrence_id`

## Scripts and Artifacts Added

Main package:

- [001_preflight_inventory.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/001_preflight_inventory.sql)
- [010_core_oncology_additive.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/010_core_oncology_additive.sql)
- [011_core_oncology_indexes.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/011_core_oncology_indexes.sql)
- [020_imaging_extension.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/020_imaging_extension.sql)
- [021_imaging_series_bridge.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/021_imaging_series_bridge.sql)
- [030_genomics_extension.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/030_genomics_extension.sql)
- [040_gis_extension.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/040_gis_extension.sql)
- [050_crosswalks_and_backfill.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/050_crosswalks_and_backfill.sql)
- [052_imaging_safe_backfill.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/052_imaging_safe_backfill.sql)
- [053_imaging_complete_backfill.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/053_imaging_complete_backfill.sql)
- [054_genomics_foundationone_backfill.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/054_genomics_foundationone_backfill.sql)
- [060_validation_queries.sql](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package/060_validation_queries.sql)

Supporting documentation:

- [2026-04-10-omop-extension-remediation-package.md](/home/smudoshi/Github/Parthenon/docs/architecture/2026-04-10-omop-extension-remediation-package.md)
- [2026-04-10-omop-next-agent-remediation-plan.md](/home/smudoshi/Github/Parthenon/docs/devlog/2026-04-10-omop-next-agent-remediation-plan.md)

Repo-side migration/model updates:

- [2026_04_10_164500_add_imaging_series_omop_bridge.php](/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_04_10_164500_add_imaging_series_omop_bridge.php)
- [ImagingSeries.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/ImagingSeries.php)

### Continuation update: Parthenon app integration

After this handoff was first written, the repo-side integration was extended so Parthenon can read the new OMOP bridge data without re-running the database backfills.

Additional migration artifacts:

- [2026_04_10_164500_add_imaging_series_omop_bridge.php](/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_04_10_164500_add_imaging_series_omop_bridge.php)
- [2026_04_10_164600_add_genomics_omop_bridge.php](/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_04_10_164600_add_genomics_omop_bridge.php)

Important migration safety note:

- both migration `down()` methods are intentionally non-destructive
- they do not drop OMOP bridge tables, xref tables, or link columns on rollback
- this protects backfilled clinical linkage data from accidental loss

Additional app bridge models:

- [ImagingSeriesOmopXref.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/ImagingSeriesOmopXref.php)
- [ImagingProcedureOmopXref.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/ImagingProcedureOmopXref.php)
- [GenomicUploadOmopContextXref.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/GenomicUploadOmopContextXref.php)
- [GenomicVariantOmopXref.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/GenomicVariantOmopXref.php)
- [OmopGenomicTestMap.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/OmopGenomicTestMap.php)
- [OmopGeneSymbolMap.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/OmopGeneSymbolMap.php)

Additional read-only CDM extension models:

- [ImageOccurrence.php](/home/smudoshi/Github/Parthenon/backend/app/Models/Cdm/ImageOccurrence.php)
- [ImageFeature.php](/home/smudoshi/Github/Parthenon/backend/app/Models/Cdm/ImageFeature.php)
- [GenomicTest.php](/home/smudoshi/Github/Parthenon/backend/app/Models/Cdm/GenomicTest.php)
- [TargetGene.php](/home/smudoshi/Github/Parthenon/backend/app/Models/Cdm/TargetGene.php)
- [VariantOccurrence.php](/home/smudoshi/Github/Parthenon/backend/app/Models/Cdm/VariantOccurrence.php)
- [VariantAnnotation.php](/home/smudoshi/Github/Parthenon/backend/app/Models/Cdm/VariantAnnotation.php)

Additional app model relationships:

- [ImagingSeries.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/ImagingSeries.php) now exposes `omopXref()`
- [ImagingStudy.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/ImagingStudy.php) now exposes `omopProcedureXrefs()`
- [GenomicUpload.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/GenomicUpload.php) now exposes `omopContext()` and `omopGenomicTestMap()`
- [GenomicVariant.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/GenomicVariant.php) now exposes `omopXref()`

API read-path changes:

- [ImagingController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/ImagingController.php) now returns imaging OMOP link counts and eager-loads study/series xrefs where appropriate
- [ImagingTimelineController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/ImagingTimelineController.php) now loads imaging OMOP xrefs for patient timelines
- [GenomicsController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/GenomicsController.php) now returns OMOP context/test/variant counts and eager-loads genomics bridge records

Frontend read-path/type changes:

- [frontend/src/features/imaging/types/index.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/imaging/types/index.ts) now includes imaging OMOP xref types and stats fields
- [frontend/src/features/genomics/types/index.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/genomics/types/index.ts) now includes genomics OMOP context/test/variant xref types and stats fields
- [genomicsApi.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/genomics/api/genomicsApi.ts), [useGenomics.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/genomics/hooks/useGenomics.ts), and [UploadDialog.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/genomics/components/UploadDialog.tsx) distinguish persisted `foundation_one` uploads from uploadable parser formats, so existing FoundationOne data can be represented without making FoundationOne an upload option

Verification for this continuation:

- PHP syntax lint passed for the new migrations, new bridge models, new read-only CDM models, modified app models, and modified API controllers
- targeted ESLint passed for the touched genomics and imaging frontend files
- full frontend TypeScript build was attempted and failed on pre-existing unrelated errors outside this OMOP work, including patient-similarity component/type errors and duplicate generated API type identifiers
- Laravel `migrate --pretend --force --path=database/migrations/2026_04_10_164600_add_genomics_omop_bridge.php` was attempted but could not validate because this shell could not connect through the app database configuration; no live migration was executed during this continuation step

## Live Execution Summary

### Read-only preflight and analysis

Executed:

- `001_preflight_inventory.sql`
- multiple direct `psql` inspections of `omop`, `app`, and `vocab`

### Additive DDL applied live

Executed successfully:

- `010_core_oncology_additive.sql`
- `020_imaging_extension.sql`
- `021_imaging_series_bridge.sql`
- `030_genomics_extension.sql`
- `040_gis_extension.sql`
- `050_crosswalks_and_backfill.sql`

Not executed:

- `011_core_oncology_indexes.sql`

Reason:

- it adds heavyweight indexes to the very large `omop.measurement` table
- it was intentionally deferred

### Imaging backfill

Executed in two stages:

1. `052_imaging_safe_backfill.sql`
2. `053_imaging_complete_backfill.sql`

Important implementation note:

- `053` originally failed in dry-run because `omop.procedure_occurrence_id` is `integer`, not `bigint`
- the script was corrected to use a derived sequence seeded safely inside integer headroom
- the existing oversized failed sequence state was normalized in the script before live commit

### Genomics backfill

Executed:

- `054_genomics_foundationone_backfill.sql`

Important implementation note:

- the local `omop.care_site` data is not clean enough to rely on uniqueness by name
- the script resolves the UPenn care site deterministically with `min(care_site_id)` for `HOSPITAL OF UNIV OF PENNSYLVANIA`
- the script explicitly marks benchmark GIAB uploads as `excluded_benchmark`

## Current Live State

Verified on localhost after commit:

- `omop.image_occurrence`: `925`
- `omop.image_feature`: `0`
- `app.imaging_series.image_occurrence_id IS NOT NULL`: `925`
- `app.imaging_studies.image_occurrence_id IS NOT NULL`: `8`
- `app.imaging_series_omop_xref`: `925`
- `app.imaging_procedure_omop_xref`: `112`
- `omop.specimen`: `1`
- `omop.genomic_test`: `1`
- `omop.target_gene`: `0`
- `omop.variant_occurrence`: `4`
- `omop.variant_annotation`: `37`
- `app.genomic_upload_omop_context_xref`: `1`
- `app.genomic_variant_omop_xref`: `4`

## Imaging Status

### What is complete

Imaging is complete for all OMOP-eligible Acumenus acquisition series currently on localhost.

Specifically:

- all source `47` acquisition series with non-null `person_id`
- non-null `study_date`
- modality in `CT`, `MR`, `PT`, `CR`, or `US`

are now represented in `omop.image_occurrence`.

Per-modality linked series counts:

- `CT`: `656`
- `MR`: `258`
- `PT`: `6`
- `CR`: `2`
- `US`: `3`

Total linked eligible acquisition series:

- `925`

There are no remaining eligible supported-modality acquisition series with non-null `person_id` and non-null `study_date` that are missing `image_occurrence_id`.

### How imaging was backfilled

There are two imaging linkage patterns in the live system:

1. Strict safe matches from existing OMOP procedure context
2. Derived OMOP `procedure_occurrence` rows for unresolved study+modality groups

Derived imaging procedure rows were created non-destructively and audited through:

- `app.imaging_procedure_omop_xref`

Current derived procedure bridge count:

- `112`

Study-level compatibility linkage was intentionally limited:

- `app.imaging_studies.image_occurrence_id` is only populated where a study had exactly one linked series

That means downstream logic should prefer:

- `app.imaging_series.image_occurrence_id`
- `app.imaging_series_omop_xref`

and not rely on `app.imaging_studies.image_occurrence_id` as a lossless MI-CDM bridge.

### What is not complete in imaging

The remaining unlinked Acumenus imaging rows are not a failed backfill. They are currently impossible to materialize into OMOP without upstream remediation.

Current remaining unlinked imaging bucket:

- `6568` Acumenus series with missing `person_id`

These rows are not OMOP-eligible as-is because `omop.image_occurrence.person_id` is required semantically.

### Imaging caveats for the next agent

- Do not rerun imaging work under the assumption that there are still eligible supported-modality rows to map. There are not.
- If the user asks to “finish imaging,” the correct answer is that the eligible imaging set is already complete.
- The only legitimate next imaging tasks are:
  - upstream person matching for currently anonymous imaging studies/series
  - future `app.imaging_features` to `omop.image_feature` backfill if feature rows appear
  - app read-path changes to consume the new series-level OMOP linkage

## Genomics Status

### What is complete

The only clinically person-linked genomics upload on localhost has been materialized into OMOP.

That upload is:

- `app.genomic_uploads.id = 10`
- file: `TRF091836.pdf`
- format: `foundation_one`
- sample/case: `TRF091836`
- person: `1005788`

The live OMOP backfill for that upload created:

- `1` derived OMOP specimen
- `1` OMOP genomic test
- `4` OMOP variant occurrences
- `37` OMOP variant annotations

The four linked genes are:

- `KRAS`
- `TP53`
- `APC`
- `SETD2`

HGNC identifiers were seeded explicitly:

- `KRAS` → `HGNC:6407`
- `TP53` → `HGNC:11998`
- `APC` → `HGNC:583`
- `SETD2` → `HGNC:18420`

Important correction:

- an earlier remembered `SETD2` HGNC ID was wrong
- the final inserted ID is `HGNC:18420`, verified against the HGNC REST API on 2026-04-10

### Clinical anchor used

The FoundationOne case includes source metadata:

- report date: `2015-05-23`
- specimen date: `2012-03-06`
- tumor type: `Colon adenocarcinoma (CRC)`

That specimen date was safely anchored to the patient’s same-day OMOP procedure:

- `procedure_occurrence_id = 110902954`
- `procedure_source_value` starting with `Sigmoid colectomy`

The derived specimen is therefore traceable to an actual same-day clinical procedure instead of a guessed encounter.

### What is intentionally not complete in genomics

`omop.target_gene` remains empty on purpose.

Reason:

- the local data does not contain the full FoundationOne panel manifest
- populating `target_gene` with only the four observed mutated genes would overstate assay target coverage

The seven GIAB benchmark uploads also remain out of OMOP on purpose.

Current benchmark status:

- `7` uploads are marked `excluded_benchmark` in `app.omop_genomic_test_map`
- they remain in `app.genomic_uploads` and `app.genomic_variants`
- they have no person linkage on localhost
- they should not be represented as clinical OMOP genomics records without an explicit product decision

### Genomics caveats for the next agent

- Do not treat the GIAB uploads as “unfinished clinical genomics.”
- Do not populate `omop.target_gene` unless you have a true assay panel manifest or another defensible source of full target coverage.
- If more clinical genomics uploads are added later, follow the same pattern used in `054`:
  - derive upload context
  - anchor to a real procedure and specimen
  - seed gene identifiers explicitly
  - materialize `variant_occurrence`
  - add provenance into `variant_annotation`

## Important Data Quality Findings

### `omop.procedure_occurrence_id` and `omop.specimen_id` are integers

Do not assume bigint headroom for derived IDs in those tables.

The scripts now handle this correctly:

- imaging derived procedures use a safe integer-range sequence
- genomics derived specimens use a safe integer-range sequence

If you add more derived-row scripts, follow the same pattern.

### `omop.care_site` is dirty locally

There are duplicate names and even duplicated `care_site_id` values paired with different names in the raw query output.

This means:

- do not rely on care-site name uniqueness
- if you must resolve by name, use a deterministic rule and document it

### `app.imaging_studies.image_occurrence_id` is not a full-fidelity MI-CDM bridge

This field is only a backward-compatible convenience for single-series studies.

Lossless imaging linkage is at series grain:

- `app.imaging_series.image_occurrence_id`
- `app.imaging_series_omop_xref`

## Backup and Snapshot Files

### Schema snapshots

- [parthenon-app-omop-schema-pre.sql](/tmp/omop-extension-backups/20260410-163400/parthenon-app-omop-schema-pre.sql)
  - SHA-256: `804bbdda012a7ea359ba43faec806b0e61c50ff6757cbaa9984c787f358591e7`
- [parthenon-app-omop-schema-post.sql](/tmp/omop-extension-backups/20260410-163400/parthenon-app-omop-schema-post.sql)
  - SHA-256: `75fef97c1a31b8777ebb32e0086713bf3f3291f7dd1b8385a5472b3ddd686c04`

### Imaging data snapshots

- [imaging-phase-data-post.sql](/tmp/omop-extension-backups/20260410-163400/imaging-phase-data-post.sql)
  - SHA-256: `21f095a78b85f4cde8c5849453f97c2221cc44d296eb6b343d7f51d1400c3d7f`
- [imaging-phase-complete-data-post.sql](/tmp/omop-extension-backups/20260410-163400/imaging-phase-complete-data-post.sql)
  - SHA-256: `9d7b6043b4e9d903e511990c208f648995e340e510dc282df34992e257807a04`

### Genomics data snapshots

- [genomics-phase-pre.sql](/tmp/omop-extension-backups/20260410-163400/genomics-phase-pre.sql)
  - SHA-256: `3740c3428fb2ef76d4fae31b2c58b75b9d82e6436b947b93ea355006e30a2762`
- [genomics-phase-post.sql](/tmp/omop-extension-backups/20260410-163400/genomics-phase-post.sql)
  - SHA-256: `f31a150c7293baaa6fe22cd04b678f2dd7d41806ececfc956552ae0ed563c0af`

## Repo State and Working Tree Notes

Relevant current working-tree status:

- [ImagingSeries.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/ImagingSeries.php) is modified
- [2026_04_10_164500_add_imaging_series_omop_bridge.php](/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_04_10_164500_add_imaging_series_omop_bridge.php) is untracked
- [2026-04-10-omop-extension-remediation-package.md](/home/smudoshi/Github/Parthenon/docs/architecture/2026-04-10-omop-extension-remediation-package.md) is untracked
- the entire [scripts/omop-extension-package](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package) directory is untracked

There are also unrelated user changes elsewhere in the repo. Do not reset or clean the working tree.

## Recommended Next Steps for the Next Agent

### If the user asks about imaging

Use this framing:

- the OMOP-eligible imaging backfill is already complete
- remaining gaps are upstream person-linkage gaps, not missed OMOP backfill work

Concrete next steps only if requested:

1. implement or improve person matching for anonymous imaging rows
2. build `image_feature` backfill if `app.imaging_features` starts receiving data
3. update Parthenon read paths to use `app.imaging_series.image_occurrence_id` or `app.imaging_series_omop_xref`

### If the user asks about genomics

Use this framing:

- the single clinical FoundationOne case is now in OMOP
- benchmark GIAB uploads are intentionally excluded

Concrete next steps only if requested:

1. define a durable assay manifest strategy before populating `omop.target_gene`
2. decide whether future ingestion should dual-write directly into OMOP genomics extension tables
3. establish specimen creation rules for future report-derived or VCF-derived clinical uploads

### If the user asks for full compliance work

The remaining significant compliance items are:

1. optional `011_core_oncology_indexes.sql`
2. GIS backfill if `app.location_history` or `app.external_exposure` get populated
3. oncology extension semantics beyond additive columns
4. a deliberate decision about whether to update `omop.cdm_source.cdm_version`

## Suggested Verification Queries

These are safe read-only checks the next agent can run immediately:

```sql
select count(*) from omop.image_occurrence;
select count(*) from app.imaging_series where image_occurrence_id is not null;
select count(*) from app.imaging_series_omop_xref where image_occurrence_id is null;
select count(*) from app.imaging_procedure_omop_xref;

select count(*) from omop.specimen;
select count(*) from omop.genomic_test;
select count(*) from omop.target_gene;
select count(*) from omop.variant_occurrence;
select count(*) from omop.variant_annotation;

select count(*)
from app.genomic_variants v
left join app.genomic_variant_omop_xref x on x.variant_id = v.id
where v.person_id is not null
  and x.variant_occurrence_id is null;

select mapping_status, count(*)
from app.omop_genomic_test_map
group by 1
order by 1;
```

## Bottom Line

Another agent taking over should assume:

- imaging is done for all currently OMOP-eligible localhost Acumenus series
- genomics is done for the only currently person-linked clinical upload
- the benchmark GIAB uploads are intentionally held in app staging
- the repo contains the exact scripts and runbook needed to understand and extend the work

The main risk now is not incomplete migration. It is a future agent mistaking deliberate boundaries for unfinished work and pushing lossy or semantically dishonest backfills.
