# OHDSI Shiny Compatibility Policy

Date: 2026-04-15
Revised: 2026-05-08

## Decision

Parthenon no longer treats `OhdsiShinyAppBuilder` and `OhdsiShinyModules`
as suppressed legacy packages. They are managed compatibility surfaces for
canonical OHDSI result exploration.

Native Parthenon React workflows remain the primary product experience.
Managed OHDSI Shiny viewers may be surfaced when they help users inspect
standard OHDSI results, compare Parthenon output to community-standard viewers,
or cover HADES result modules that Parthenon has not yet fully reimplemented.

## Policy

- Allow vetted OHDSI Shiny viewers launched from Parthenon-owned registry entries.
- Allow embedded or full-page launch modes only through the managed compatibility
  runtime.
- Continue blocking arbitrary user-supplied Shiny app paths.
- Continue blocking raw `shiny_app_url` study artifacts.
- Require Parthenon authorization before a Shiny session can see a study,
  source, result bundle, or artifact.
- Prefer ShinyProxy for the open-source runtime and Posit Connect for licensed
  enterprise deployments.
- Do not expose the Darkstar RStudio process as a Shiny hosting surface.

## Runtime Contract

The HADES package capability inventory marks both Shiny packages as:

- `surface`: `managed_shiny_compatibility`
- `priority`: `high`
- `hosted_surface`: `true`
- `exposure_policy`: `managed_compatibility_layer`
- `decision`: `managed_ohdsi_shiny_compatibility`

The inventory response includes a top-level `shiny_policy` object:

- `expose_hosted_surfaces`: `true`
- `allow_iframe_embedding`: `true`
- `allow_user_supplied_app_paths`: `false`
- `decision`: `managed_ohdsi_shiny_compatibility`
- `default_runtime`: `shinyproxy`
- `supported_runtimes`: `shinyproxy`, `posit_connect`
- `allowed_scope`: `vetted_ohdsi_modules_only`

The inventory response also includes `shiny_apps`, the managed app registry used
by Parthenon UI and launch flows.

## Initial Managed App Registry

- PatientLevelPrediction Results
- CohortMethod, SCCS, and Evidence Synthesis Results
- Cohort Diagnostics Explorer
- Characterization and Incidence Results
- PheValuator Results
- OHDSI Report Viewer

Each registry entry must declare its package, module family, result types,
launch modes, runtime preference, permission scope, and R entrypoint.

## Implementation Guardrail

This policy allows only managed OHDSI Shiny compatibility. A request to host
arbitrary Shiny applications, mount user-provided app directories, or store raw
Shiny URLs as study artifacts remains out of scope unless this policy is revised
again.
