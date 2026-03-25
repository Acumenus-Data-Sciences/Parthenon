# FINNGEN Workbench How-To

## Purpose

This guide explains how to use the four FINNGEN workbench tools in Parthenon against a CDM-backed source such as the Acumenus OHDSI CDM.

The tools are designed to be used together:

1. `ROMOPAPI`
2. `HADES Extras`
3. `Cohort Ops`
4. `CO2 Modules`

Use that order unless you already know the exact cohort and analysis path you want.

## Before You Start

Open [`/workbench`](/home/smudoshi/Github/Parthenon/frontend/src/features/finngen/pages/FinnGenToolsPage.tsx) in the app and confirm:

- the source selector is pointed at the correct CDM source
- the `Runtime Path` panel shows the service is available
- the tab you want is enabled

For all four tools:

- use the selected source as the scope of truth
- run the preview first
- inspect the visual output
- use `Run Inspector` to review, replay, compare, or export a prior run

## Recommended Workflow

### 1. Explore the source with ROMOPAPI

Start here when you need to understand what is available in the CDM before building cohorts or analyses.

What to do:

- open `ROMOPAPI`
- confirm `Schema scope`
- choose or edit a `Query template`
- click `Run Query Plan Preview`

What to review:

- `Metadata Summary`
- `Schema Graph`
- `Hierarchy Map`
- `Query Plan`
- `Code Counts`
- `Stratified Counts`
- `Report Preview`

What to export:

- markdown report
- HTML report
- manifest
- JSON result

Use this step to decide:

- which tables and domains matter
- whether the result profile is plausible
- what concepts or schema path should feed your cohort or analysis work

### 2. Prepare SQL and package artifacts with HADES Extras

Use this when you need SQL rendering, package structure, artifact planning, or source-specific render diagnostics.

What to do:

- open `HADES Extras`
- review or replace the SQL template
- optionally change the package name
- click `Render Preview`

What to review:

- `Render Summary`
- `Connection Context`
- `SQL Diff Lens`
- `Config Summary`
- `Cohort Summary`
- `Operation Lineage`
- `SQL Preview`
- `Artifact Pipeline`
- `Package Manifest`
- `Package Bundle`

What to export:

- package bundle metadata
- package manifest
- stored run bundle from `Run Inspector`

Use this step to confirm:

- schema substitutions are correct
- the rendered SQL is plausible for the selected dialect
- the package/export shape is what downstream workflows expect

### 3. Build and review cohorts in Cohort Ops

Use this to assemble a cohort workflow from existing Parthenon cohorts, Atlas-style IDs, a cohort table, or a direct JSON definition.

What to do:

- open `Cohort Ops`
- click `Open Operation Builder`
- select the import path
- if using Parthenon cohorts:
  - choose one or more existing cohorts
  - select `union`, `intersect`, or `subtract`
- configure matching:
  - enable or disable matching
  - choose the matching strategy
  - set match covariates
  - set ratio and caliper when needed
- choose the export target
- click `Apply Builder`
- click `Run Cohort Preview`

What to review:

- `Compile Summary`
- `Attrition Funnel`
- `Criteria Timeline`
- `Import & Export`
- `Matching Review`
- `Operation Summary`
- `Operation Evidence`
- `Selected Cohorts`
- `Import Review`
- `Export Summary`
- `Compiled SQL`
- `Sample Rows`

Use this step to confirm:

- the selected cohort inputs are correct
- the set operation is behaving as expected
- matched and excluded patients look plausible
- the derived cohort label and export target are correct

When the result looks right:

- use `Hand Off To CO2 Modules`

### 4. Run downstream analysis in CO2 Modules

Use this after you have a reasonable cohort reference or handoff label.

What to do:

- open `CO2 Modules`
- confirm the cohort label that was handed off from `Cohort Ops`
- choose the module family
- set the outcome name if needed
- click `Run Module Preview`

What to review:

- `Analysis Summary`
- `Module Validation`
- `Family Evidence`
- `Family Notes`
- `Module Gallery`
- `Forest Plot`
- `Heatmap`
- `Time Profile`
- `Overlap Matrix`
- `Top Signals`
- `Execution Timeline`

Use this step to confirm:

- the chosen module family matches the study question
- the analysis evidence is plausible for the selected source and cohort
- the trend, overlap, and top-signal views look directionally correct

## Run Inspector

Use `Run Inspector` on every tab when you want to work from stored executions instead of rerunning everything from scratch.

You can:

- inspect stored request payloads
- inspect stored result payloads
- inspect persisted artifacts
- replay a run
- export a run bundle
- compare two runs from the same service/source

Recommended use:

- run a preview
- inspect the result
- replay if you change only one input
- compare two runs when validating changes in cohort logic, SQL rendering, or analysis framing

## Fastest End-To-End Path

If you want a practical default:

1. `ROMOPAPI`: run a query-plan preview for the target schema path
2. `HADES Extras`: render the SQL and inspect the package/export surface
3. `Cohort Ops`: select existing Parthenon cohorts, use the operation builder, and run the preview
4. `CO2 Modules`: accept the cohort handoff and run the chosen module family

## Current Boundaries

The Workbench is already useful, but not every upstream FINNGEN workflow is fully ported yet.

Current strongest paths:

- `ROMOPAPI` reporting and code-count review
- `HADES Extras` render/package inspection
- `Cohort Ops` Parthenon cohort selection, operation builder, matching review, export handoff
- `CO2 Modules` module-family preview and evidence review

Remaining parity gaps are tracked in:

- [`finngen-parity-gap-analysis-and-backlog.md`](/home/smudoshi/Github/Parthenon/docs/finland/finngen-parity-gap-analysis-and-backlog.md)
