# Study Designer — OHDSI-Aligned Workflow Foundation

**Date:** 2026-04-15
**Branch:** main
**Status:** Study Designer package workflow, verifier hardening, and frontend diagnostics deployed

## What Shipped

- Added Study Design sessions, versions, AI events, and assets as durable app-schema tables.
- Added Study Designer API flow for intent generation, bottom-up study import, critique assets, concept set drafts, cohort drafts, feasibility evidence, analysis plans, readiness checks, and locked package artifacts.
- Added strict verifier services for Study Designer concept sets and cohorts:
  - concept set drafts must contain positive current OMOP concept IDs from `vocab.concept`;
  - missing or deprecated concepts block materialization;
  - deprecated imported cohorts block feasibility and package lock;
  - package lock requires accepted intent, verified materialized cohorts, feasibility evidence, and a verified analysis plan.
- Added local package artifact downloads with study ownership checks.
- Added frontend Study Designer API hooks, readiness panels, package provenance, and verifier diagnostics for missing/deprecated OMOP concept IDs.
- Restored related cohort authoring, phenotype validation, and self-controlled cohort controller/model/migration files needed by registered routes.

## Migrations Added

- `2026_04_14_000002_create_self_controlled_cohort_analyses_table.php`
- `2026_04_14_000006_create_cohort_phenotype_validations_table.php`
- `2026_04_14_000007_create_cohort_phenotype_adjudications_table.php`
- `2026_04_14_000011_create_cohort_phenotype_promotions_table.php`
- `2026_04_15_000001_create_study_design_sessions_table.php`
- `2026_04_15_000002_create_study_design_versions_table.php`
- `2026_04_15_000003_create_study_design_ai_events_table.php`
- `2026_04_15_000004_create_study_design_assets_table.php`

## Verification

- `docker exec parthenon-php sh -lc 'cd /var/www/html && ./vendor/bin/pest tests/Feature/Api/V1/StudyDesignTest.php'`
  - 6 tests, 51 assertions passing.
- `docker exec parthenon-php sh -lc 'cd /var/www/html && ./vendor/bin/phpstan analyse app/Services/StudyDesign app/Http/Controllers/Api/V1/StudyDesignController.php --memory-limit=1G'`
  - no errors.
- `docker exec parthenon-php sh -lc 'cd /var/www/html && ./vendor/bin/pint --test app/Services/StudyDesign app/Http/Controllers/Api/V1/StudyDesignController.php tests/Feature/Api/V1/StudyDesignTest.php'`
  - passed.
- `cd frontend && npm run build`
  - passed; Vite retained existing large chunk warnings.
- `cd frontend && npx eslint src/features/studies/components/StudyDesigner.tsx src/features/studies/types/study.ts`
  - passed.
- `./deploy.sh --frontend`
  - completed; smoke checks for `/`, `/login`, and `/jobs` returned 200.

## Follow-Ups

- Wire more Study Designer actions into the frontend for drafting/verifying/materializing concept sets, cohorts, and analysis plans from the UI.
- Add real AI-assisted concept set/cohort drafting behind the deterministic verifier boundary.
- Add visual regression coverage for the Study Designer diagnostics panels.
