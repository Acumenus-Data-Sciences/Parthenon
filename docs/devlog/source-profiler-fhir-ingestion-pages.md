# Source Profiler & FHIR Ingestion Standalone Pages — Devlog

**Date:** 2026-03-12
**Branch:** feature/fhir-omop-ig-compliance

## What Was Built

Extracted the Source Profiler and FHIR Ingestion features from the ETL Tools tab into full standalone pages with significant enhancements.

### Source Profiler (`/source-profiler`)

Promoted from a simple tab in ETL Tools to a dedicated data quality profiling page.

**New features:**
- **Data Quality Scorecard** — overall A-F grade based on average null fraction, with 5 check categories (high-null >50%, nearly-empty >99%, low cardinality <5 distinct, single-value columns, empty tables)
- **Completeness Heatmap** — interactive table-by-column grid visualization showing null rates with color-coded cells and hover tooltips (up to 30 columns)
- **Table Size Distribution** — horizontal bar chart of top 20 tables by row count with per-table quality grades
- **Scan History** — localStorage-persisted (up to 20 entries) with select/delete/clear in a collapsible sidebar
- **Table search + sort** — filter tables by name, sort by name/rows/columns/grade in both directions
- **Dual view modes** — list (accordion with column detail) or compact card grid with mini completeness bars
- **Dual export** — JSON and CSV download buttons
- **Advanced scan options** — expandable section with sample row limit configuration

### FHIR Ingestion (`/fhir-ingestion`)

Promoted from a tab in ETL Tools to a dedicated FHIR R4 ingestion page.

**New features:**
- **Resource Preview** — live pre-ingestion analysis showing resource type breakdown with emoji icons, ID completeness %, and coding coverage % per resource type
- **Ingestion History** — localStorage-persisted (up to 30 entries) with status indicators (success/partial/error), resource/record counts, timestamps
- **Mapping Coverage Card** — CDM records-per-resource ratio with progress bar, success rate visualization, CDM table population count
- **Enhanced Error Log** — errors grouped by FHIR resource type, searchable/filterable when >5 errors, with resource type emoji badges
- **Load Example** button — pre-fills a 3-resource Bundle (Patient + Condition + MedicationRequest)
- **Export + Copy** — download result JSON or copy to clipboard with feedback
- **Related Links sidebar** — quick navigation to FHIR Connections, Sync Monitor, FHIR Export, ETL Tools
- **NDJSON auto-detection** — automatically detects format and switches between Bundle and batch ingestion

### Sidebar Refactoring

The Sidebar was refactored (by linter) into accordion-grouped navigation:
- **Data** group: Data Sources, Data Ingestion, Data Explorer, Source Profiler, FHIR Ingestion, ETL Tools
- **Vocabulary** group: Vocabulary Search, Mapping Assistant
- **Research** group: Cohort Definitions, Concept Sets, Analyses, Studies, Study Designer, Study Packages, Phenotype Library
- **Evidence** group: Patient Profiles, Genomics, Imaging, HEOR, GIS Explorer
- **Tools** group: Query Assistant, Publish, Jobs
- **Administration** group: Users, Roles & Permissions, Auth Providers, Notifications

### Sidebar Fix: Missing Admin Pages

During the accordion group refactoring, the **Admin Dashboard** (`/admin`) and **System Health** (`/admin/system-health`) entries were inadvertently dropped from the Administration group's children array. Both were restored with their original icons (Settings and Activity respectively).

Updated **Administration** group now includes:
- Admin Dashboard, System Health, Users, Roles & Permissions, Auth Providers, Notifications

## Files Changed

- `frontend/src/features/etl/pages/SourceProfilerPage.tsx` — new (standalone page)
- `frontend/src/features/etl/pages/FhirIngestionPage.tsx` — new (standalone page)
- `frontend/src/app/router.tsx` — added `/source-profiler` and `/fhir-ingestion` routes
- `frontend/src/components/layout/Sidebar.tsx` — added nav items, refactored to accordion groups, restored missing admin entries
