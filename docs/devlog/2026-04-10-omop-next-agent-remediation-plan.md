# OMOP Extension Next-Agent Remediation Plan

Date: 2026-04-10

## Purpose

This document is the execution handoff for the next agent continuing the OMOP extension work on localhost PostgreSQL 17.

The core database backfill work is already complete for the currently eligible data. The next agent should focus on validation, app integration hardening, packaging the repo changes cleanly, and documenting deliberate semantic boundaries. The next agent should not re-run imaging or genomics backfill scripts unless a new data set has been loaded or the user explicitly requests a controlled replay after reviewing backups.

## Non-Destructive Operating Rules

- Do not drop, truncate, or delete data from `app.*` or `omop.*`.
- Do not run rollback paths expecting them to remove OMOP bridge data; the new Laravel migration `down()` methods are intentionally non-destructive.
- Do not run `011_core_oncology_indexes.sql` casually; it targets the large `omop.measurement` table and should be treated as maintenance-window work.
- Do not populate `omop.target_gene` from observed variants alone. It requires a true assay panel manifest or another defensible full target-coverage source.
- Do not materialize the seven GIAB benchmark uploads into clinical OMOP genomics tables unless the user makes a product decision to model non-clinical benchmark data separately.
- Do not change `omop.cdm_source.cdm_version` from `5.3` until the broader CDM-version implications are reviewed and accepted.
- Do not reset, clean, or revert unrelated working-tree changes.

## Current Known State

Database target:

- host: localhost
- PostgreSQL: 17
- database: `parthenon`
- primary CDM schema: `omop`
- app support schema: `app`

Imaging is complete for the currently OMOP-eligible Acumenus acquisition series:

- `omop.image_occurrence`: `925`
- `app.imaging_series.image_occurrence_id IS NOT NULL`: `925`
- `app.imaging_series_omop_xref`: `925`
- `app.imaging_procedure_omop_xref`: `112`
- `app.imaging_studies.image_occurrence_id IS NOT NULL`: `8`
- `omop.image_feature`: `0`, because `app.imaging_features` is currently empty
- remaining unlinked imaging rows are missing `person_id` and therefore are not OMOP-compliant as-is

Genomics is complete for the only clinically person-linked upload:

- upload: `app.genomic_uploads.id = 10`
- file: `TRF091836.pdf`
- format: `foundation_one`
- person: `1005788`
- `omop.specimen`: `1`
- `omop.genomic_test`: `1`
- `omop.target_gene`: `0`, intentionally
- `omop.variant_occurrence`: `4`
- `omop.variant_annotation`: `37`
- `app.genomic_upload_omop_context_xref`: `1`
- `app.genomic_variant_omop_xref`: `4`
- `app.omop_genomic_test_map`: `8`, with `7` benchmark uploads marked `excluded_benchmark`

## Repo Work Completed Before This Handoff

SQL and documentation artifacts:

- [scripts/omop-extension-package](/home/smudoshi/Github/Parthenon/scripts/omop-extension-package)
- [OMOP extension remediation package](/home/smudoshi/Github/Parthenon/docs/architecture/2026-04-10-omop-extension-remediation-package.md)
- [OMOP extension handoff](/home/smudoshi/Github/Parthenon/docs/devlog/2026-04-10-omop-extension-handoff.md)

Laravel migrations:

- [2026_04_10_164500_add_imaging_series_omop_bridge.php](/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_04_10_164500_add_imaging_series_omop_bridge.php)
- [2026_04_10_164600_add_genomics_omop_bridge.php](/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_04_10_164600_add_genomics_omop_bridge.php)

App bridge models:

- [ImagingSeriesOmopXref.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/ImagingSeriesOmopXref.php)
- [ImagingProcedureOmopXref.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/ImagingProcedureOmopXref.php)
- [GenomicUploadOmopContextXref.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/GenomicUploadOmopContextXref.php)
- [GenomicVariantOmopXref.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/GenomicVariantOmopXref.php)
- [OmopGenomicTestMap.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/OmopGenomicTestMap.php)
- [OmopGeneSymbolMap.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/OmopGeneSymbolMap.php)

Read-only CDM extension models:

- [ImageOccurrence.php](/home/smudoshi/Github/Parthenon/backend/app/Models/Cdm/ImageOccurrence.php)
- [ImageFeature.php](/home/smudoshi/Github/Parthenon/backend/app/Models/Cdm/ImageFeature.php)
- [GenomicTest.php](/home/smudoshi/Github/Parthenon/backend/app/Models/Cdm/GenomicTest.php)
- [TargetGene.php](/home/smudoshi/Github/Parthenon/backend/app/Models/Cdm/TargetGene.php)
- [VariantOccurrence.php](/home/smudoshi/Github/Parthenon/backend/app/Models/Cdm/VariantOccurrence.php)
- [VariantAnnotation.php](/home/smudoshi/Github/Parthenon/backend/app/Models/Cdm/VariantAnnotation.php)

Modified read paths:

- [ImagingController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/ImagingController.php)
- [ImagingTimelineController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/ImagingTimelineController.php)
- [GenomicsController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/GenomicsController.php)
- [ImagingSeries.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/ImagingSeries.php)
- [ImagingStudy.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/ImagingStudy.php)
- [GenomicUpload.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/GenomicUpload.php)
- [GenomicVariant.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/GenomicVariant.php)

Frontend type/read-path updates:

- [frontend/src/features/imaging/types/index.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/imaging/types/index.ts)
- [frontend/src/features/genomics/types/index.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/genomics/types/index.ts)
- [genomicsApi.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/genomics/api/genomicsApi.ts)
- [useGenomics.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/genomics/hooks/useGenomics.ts)
- [UploadDialog.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/genomics/components/UploadDialog.tsx)

## Remaining Imperatives

### 1. Validate database state, read-only

Run the safe count checks before making any further changes:

```bash
psql postgresql://smudoshi:acumenus@localhost/parthenon -P pager=off -v ON_ERROR_STOP=1 -c "
select 'omop.image_occurrence' metric, count(*) value from omop.image_occurrence
union all select 'app.imaging_series.linked', count(*) from app.imaging_series where image_occurrence_id is not null
union all select 'app.imaging_series_omop_xref', count(*) from app.imaging_series_omop_xref
union all select 'app.imaging_procedure_omop_xref', count(*) from app.imaging_procedure_omop_xref
union all select 'omop.image_feature', count(*) from omop.image_feature
union all select 'omop.specimen', count(*) from omop.specimen
union all select 'omop.genomic_test', count(*) from omop.genomic_test
union all select 'omop.target_gene', count(*) from omop.target_gene
union all select 'omop.variant_occurrence', count(*) from omop.variant_occurrence
union all select 'omop.variant_annotation', count(*) from omop.variant_annotation
union all select 'app.genomic_upload_omop_context_xref', count(*) from app.genomic_upload_omop_context_xref
union all select 'app.genomic_variant_omop_xref', count(*) from app.genomic_variant_omop_xref
order by metric;"
```

Expected result:

- counts match the current known state above
- no missing app bridge tables
- no unexplained drop in linked imaging/genomics rows

### 2. Fix Laravel migration dry-run validation

The previous agent attempted `migrate --pretend --force` for the genomics bridge migration, but the shell could not connect through the app DB configuration. No live migration was executed.

Next agent should validate, not apply, the two migrations:

```bash
cd /home/smudoshi/Github/Parthenon/backend
DB_HOST=127.0.0.1 DB_PORT=5432 DB_DATABASE=parthenon DB_USERNAME=smudoshi DB_PASSWORD=acumenus \
php artisan migrate --pretend --force --path=database/migrations/2026_04_10_164500_add_imaging_series_omop_bridge.php

DB_HOST=127.0.0.1 DB_PORT=5432 DB_DATABASE=parthenon DB_USERNAME=smudoshi DB_PASSWORD=acumenus \
php artisan migrate --pretend --force --path=database/migrations/2026_04_10_164600_add_genomics_omop_bridge.php
```

If this still cannot connect:

- inspect `backend/config/database.php` and `.env` connection names
- check whether Laravel expects a different app DB connection than direct `psql`
- do not fall back to live migration just to test connectivity

Acceptance criteria:

- migration pretend output is produced successfully, or the connection blocker is documented with exact error text
- no live `php artisan migrate` is run without explicit user approval

### 3. Smoke-test app API read paths

The API read paths now expose OMOP linkage data. They need authenticated smoke checks against the running local app.

Routes to test:

- `GET /api/v1/imaging/stats`
- `GET /api/v1/imaging/studies?source_id=47`
- `GET /api/v1/imaging/studies/{study}`
- `GET /api/v1/imaging/patients/1005788/studies`
- `GET /api/v1/genomics/stats`
- `GET /api/v1/genomics/uploads`
- `GET /api/v1/genomics/uploads/10`
- `GET /api/v1/genomics/variants?upload_id=10`

Expected API behavior:

- imaging stats include `omop_linked_studies`, `total_series`, and `omop_linked_series`
- genomics stats include `omop_context_uploads`, `omop_variant_occurrences`, and `excluded_benchmark_uploads`
- imaging study responses include `series[].omop_xref` where available
- genomics upload `10` includes `omop_context` and `omop_genomic_test_map`
- linked variants for upload `10` include `omop_xref`
- API responses do not attempt to serialize full cross-connection CDM objects by default

If local auth is cumbersome, validate the controllers through a targeted Laravel feature test instead of bypassing auth manually.

### 4. Re-run targeted static checks

Backend checks:

```bash
cd /home/smudoshi/Github/Parthenon
php -l backend/database/migrations/2026_04_10_164500_add_imaging_series_omop_bridge.php
php -l backend/database/migrations/2026_04_10_164600_add_genomics_omop_bridge.php
find backend/app/Models/App backend/app/Models/Cdm -maxdepth 1 -name '*Omop*.php' -o -name 'ImageOccurrence.php' -o -name 'ImageFeature.php' -o -name 'GenomicTest.php' -o -name 'TargetGene.php' -o -name 'VariantOccurrence.php' -o -name 'VariantAnnotation.php'
```

Frontend targeted checks:

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npm exec eslint -- \
  src/features/imaging/types/index.ts \
  src/features/genomics/types/index.ts \
  src/features/genomics/api/genomicsApi.ts \
  src/features/genomics/hooks/useGenomics.ts \
  src/features/genomics/components/UploadDialog.tsx
```

Known caveat:

- full `tsc -b` currently fails on unrelated existing errors outside this OMOP work, including patient-similarity component/type errors and duplicate generated API type identifiers
- the next agent should not mix those unrelated fixes into the OMOP handoff unless explicitly asked

### 5. Cleanly package the repo diff

The working tree contains unrelated changes. The next agent must not blindly stage everything.

Known unrelated or likely unrelated paths in the current working tree:

- `.planning/STATE.md`
- `frontend/src/features/cohort-definitions/components/CohortOverlapPanel.tsx`
- `frontend/src/features/cohort-definitions/utils/`
- `backend/database/fixtures/designs/cohort_definitions/*.json`

Expected OMOP-related paths to stage for the OMOP package:

- `scripts/omop-extension-package/`
- `docs/architecture/2026-04-10-omop-extension-remediation-package.md`
- `docs/devlog/2026-04-10-omop-extension-handoff.md`
- `docs/devlog/2026-04-10-omop-next-agent-remediation-plan.md`
- `backend/database/migrations/2026_04_10_164500_add_imaging_series_omop_bridge.php`
- `backend/database/migrations/2026_04_10_164600_add_genomics_omop_bridge.php`
- `backend/app/Models/App/ImagingSeriesOmopXref.php`
- `backend/app/Models/App/ImagingProcedureOmopXref.php`
- `backend/app/Models/App/GenomicUploadOmopContextXref.php`
- `backend/app/Models/App/GenomicVariantOmopXref.php`
- `backend/app/Models/App/OmopGenomicTestMap.php`
- `backend/app/Models/App/OmopGeneSymbolMap.php`
- `backend/app/Models/Cdm/ImageOccurrence.php`
- `backend/app/Models/Cdm/ImageFeature.php`
- `backend/app/Models/Cdm/GenomicTest.php`
- `backend/app/Models/Cdm/TargetGene.php`
- `backend/app/Models/Cdm/VariantOccurrence.php`
- `backend/app/Models/Cdm/VariantAnnotation.php`
- `backend/app/Models/App/ImagingSeries.php`
- `backend/app/Models/App/ImagingStudy.php`
- `backend/app/Models/App/GenomicUpload.php`
- `backend/app/Models/App/GenomicVariant.php`
- `backend/app/Http/Controllers/Api/V1/ImagingController.php`
- `backend/app/Http/Controllers/Api/V1/ImagingTimelineController.php`
- `backend/app/Http/Controllers/Api/V1/GenomicsController.php`
- `frontend/src/features/imaging/types/index.ts`
- `frontend/src/features/genomics/types/index.ts`
- `frontend/src/features/genomics/api/genomicsApi.ts`
- `frontend/src/features/genomics/hooks/useGenomics.ts`
- `frontend/src/features/genomics/components/UploadDialog.tsx`

Use `git diff -- <path>` and `git status --short` before staging. Do not use `git add .`.

### 6. Decide deferred work explicitly

The next agent should ask for a decision before doing any of these:

- apply `011_core_oncology_indexes.sql`
- change `omop.cdm_source.cdm_version`
- create or infer a FoundationOne target panel manifest
- materialize GIAB benchmark uploads into OMOP
- build new person-linking logic for the 6,568 currently unlinked imaging series
- backfill GIS tables from app-layer GIS data if new data appears
- change frontend UI beyond exposing typed data and preserving existing upload behavior

## Definition of Done

The remediation handoff is complete when:

- read-only DB counts match the known state or any differences are explained
- Laravel migration dry-runs either pass or have a documented connection blocker
- API smoke tests confirm OMOP xref fields and stats serialize correctly
- targeted PHP and frontend checks pass
- unrelated working-tree changes are excluded from the OMOP package
- the user is told that no data-destructive operations were run
- deferred semantic decisions are listed clearly rather than silently forced

## Safe Final Message Template

Use this framing when handing back to the user:

```text
The OMOP extension handoff is ready for the next agent. Imaging and the single clinical FoundationOne genomics upload are already backfilled on localhost; the remaining work is validation, API smoke testing, migration dry-run connectivity, and packaging the repo diff without unrelated files. No destructive database operations were run.
```
