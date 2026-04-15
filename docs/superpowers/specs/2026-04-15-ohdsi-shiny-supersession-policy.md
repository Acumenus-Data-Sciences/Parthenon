# OHDSI Shiny Supersession Policy

Date: 2026-04-15

## Decision

Parthenon does not expose hosted OHDSI Shiny applications.

`OhdsiShinyAppBuilder` and `OhdsiShinyModules` may remain installed in Darkstar for artifact compatibility, package completeness, and reference semantics, but they are not product surfaces. Parthenon supersedes them with native React, Laravel, and Darkstar workflows.

## Non-Goals

- Do not add a Shiny hosting route.
- Do not iframe Shiny sessions into Parthenon.
- Do not allow user-supplied Shiny app paths or dynamically mounted app directories.
- Do not treat Shiny package presence as permission to expose Shiny runtime UI.
- Do not build new workflows whose primary UI dependency is Shiny.

## Runtime Policy

The HADES package capability inventory must mark both Shiny packages as:

- `surface`: `native_replacement_no_hosting`
- `priority`: `superseded`
- `hosted_surface`: `false`
- `exposure_policy`: `not_exposed`
- `decision`: `superseded_by_native_parthenon`

The inventory response must also include a top-level `shiny_policy` object with:

- `expose_hosted_surfaces`: `false`
- `allow_iframe_embedding`: `false`
- `allow_user_supplied_app_paths`: `false`
- `decision`: `superseded_by_native_parthenon`

Laravel enforces this policy at the API boundary even if Darkstar reports older Shiny metadata.

Study artifacts also enforce the policy:

- Existing `shiny_app_url` artifacts are not returned by the study artifact listing API.
- New `shiny_app_url` artifacts are rejected.
- The study artifact UI does not offer Shiny URL artifacts as a selectable type.

## Native Replacement Surfaces

Parthenon replaces and enhances Shiny-style OHDSI application workflows through native surfaces:

- Cohort definitions: React cohort builder, Circe validation, SQL rendering, Atlas import/export, Capr/CirceR handoff artifacts.
- Cohort diagnostics: native diagnostics dashboards, patient lists, patient context, and exportable review evidence.
- Phenotype validation: PheValuator execution, adjudication sessions, conflict resolution, agreement metrics, and validated-tier governance.
- Prediction: first-class PLP/deep PLP design surfaces and normalized results.
- Treatment pathways: native pathway designer, TreatmentPatterns execution options, provenance, Sankey/table drilldowns, and artifact downloads.
- Publish: report bundle export/import, OHDSI ReportGenerator handoff scripts, OHDSI Sharing bundles, and Parthenon-native publication workflows.
- System administration: package capability inventory with explicit no-hosting Shiny policy.
- Study artifacts: native reports, documents, packages, and data dictionaries only; no Shiny URL artifact surface.

## Implementation Guardrail

Any future request to add Shiny hosting must be treated as a new architecture decision, not an implementation detail. The default answer remains no hosted Shiny surfaces unless the policy document is intentionally revised.
