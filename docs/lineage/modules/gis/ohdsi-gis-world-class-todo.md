# OHDSI GIS World-Class Execution Todo

**Date:** 2026-04-28

## North Star

Make Parthenon the strongest OHDSI GIS implementation by combining OMOP-native cohort/condition analytics, global administrative boundaries, environmental and access layers, spatial statistics, and research workflow handoff in one operational GIS Explorer.

The GIS page should not be only a map. It should be a spatial study workbench that answers:

- Where is disease burden concentrated?
- Which administrative level is appropriate for the evidence?
- Which social, rurality, environmental, and access factors co-vary with outcomes?
- Which regions deserve cohort review, study design, or intervention planning?
- What is the provenance, geography, suppression, and statistical confidence behind the map?

## Immediate Reliability Blockers

- [ ] Make `/gis/stats`, `/gis/countries`, `/gis/boundaries`, and `/gis/choropleth` work through the same route the frontend uses.
- [ ] Fix Python AI PostGIS access for the database role used by `GIS_DATABASE_URL`.
- [ ] Use topology-preserving simplification for browser GeoJSON.
- [ ] Prevent global `ADM2` and `ADM3` downloads unless constrained by country, parent boundary, bbox, or tile.
- [ ] Make CDM choropleth use the working Solr-first path or ensure `app.cdm_county_stats` exists and is populated.
- [ ] Make host Apache and Docker routes agree on DB and AI service connectivity.
- [ ] Add health diagnostics that distinguish data-missing, route-missing, PostGIS-permission, and AI-service failures.

## Boundary Explorer

- [ ] Add `Disease layers` / `Administrative boundaries` mode to the GIS page.
- [ ] Add a country selector backed by `/gis/countries`.
- [ ] Add an admin-level control backed by `/gis/stats`, with unavailable levels disabled.
- [ ] Default global map to `ADM0`.
- [ ] Permit `ADM1` globally only with clear feature-count guardrails.
- [ ] Require country, parent, bbox, or vector tiles for `ADM2` and `ADM3`.
- [ ] Add boundary drilldown: country -> ADM1 -> ADM2 -> ADM3 where children exist.
- [ ] Add breadcrumbs for the current boundary hierarchy.
- [ ] Reuse `RegionDetail` for area, type, country, child count, exposures, and drill-down action.
- [ ] Add map click selection by boundary id/gid, not legacy county FIPS only.
- [ ] Fit map viewport to selected country or boundary.
- [ ] Add boundary search by name/gid within the selected level and country.
- [ ] Add source/version/provenance display for GADM and future geoBoundaries alternatives.

## Disease And OMOP Analytics

- [ ] Keep disease selection disease-agnostic across all OMOP condition concepts.
- [ ] Make disease choropleth use GADM `gid` consistently, not only legacy `fips`.
- [ ] Support metrics: cases, prevalence, incidence, deaths, CFR, hospitalization, denominator, and date-windowed rates.
- [ ] Add metric selector to the main GIS page.
- [ ] Add time-period selector when monthly stats are available.
- [ ] Add cohort denominator selection: all patients, active patients, study cohort, custom concept set, or source population.
- [ ] Add minimum-cell suppression and visible suppression state.
- [ ] Add cohort export/action handoff from a selected region into cohort definitions and Study Designer.
- [ ] Add study creation with region, boundary level, concept id, metric, time range, and active layers prefilled.

## Global Geography Strategy

- [ ] Treat USA `ADM2` as county-equivalent for current OMOP ZIP crosswalk analytics.
- [ ] Do not assume every country has every admin level.
- [ ] Support country-specific mappings for county/district/province semantics.
- [ ] Add compatibility mapping between `gis.geographic_location`, GADM `gid`, FIPS, ZIP, tract, and imported exposure geographies.
- [ ] Add ingestion paths for country-specific crosswalks beyond US ZIP-to-county.
- [ ] Add a data coverage matrix by country and level.
- [ ] Clearly separate boundary coverage from clinical-data coverage.

## Spatial Statistics

- [ ] Expose Moran's I with server-side assembly of values and centroids.
- [ ] Expose Getis-Ord Gi* hot/cold spots as a map layer.
- [ ] Expose correlation between disease metrics and selected exposure/access layers.
- [ ] Expose spatial regression with residual diagnostics.
- [ ] Add nearest-neighbor configuration with conservative defaults.
- [ ] Add significance, p-value, and multiple-comparison notes in analysis panels.
- [ ] Add exportable statistical summary for reports.

## Layer System

- [ ] Keep SVI, RUCC, comorbidity, air quality, and hospital access as first-class layers.
- [ ] Add boundary layer as a neutral base overlay that can work without disease selection.
- [ ] Add layer-specific loading, empty, error, and coverage states.
- [ ] Add composite tooltip instead of one-layer-only hover behavior.
- [ ] Add opacity controls per layer.
- [ ] Add legend normalization that respects metric scale and selected geography.
- [ ] Add a user-visible layer provenance panel.

## Performance And Delivery

- [ ] Add hard server-side feature-count limits for GeoJSON responses.
- [ ] Add `limit` and returned-feature-count metadata to boundary responses.
- [ ] Add bbox-aware frontend queries based on viewport.
- [ ] Add vector tile endpoint for boundaries before global ADM2/ADM3 is enabled.
- [ ] Consider materialized simplified geometries per level and tolerance.
- [ ] Cache stats/countries/boundary metadata separately from geometries.
- [ ] Add browser-side abort/debounce for pan/zoom boundary refresh.
- [ ] Keep initial GIS load fast enough for operational daily use.

## Data Management

- [ ] Show current live boundary source and counts in the GIS page.
- [ ] Keep dataset history honest when `--clear` replaces live rows.
- [ ] Add dataset activation semantics instead of relying only on historical `gis_datasets` rows.
- [ ] Add import provenance to GIS layers and exposures.
- [ ] Add rollback/reload affordances for boundary and imported exposure data.
- [ ] Add admin warnings for mixed-source duplicate levels.

## Quality Gates

- [ ] Python API smoke: `/gis/stats`, `/gis/countries`, `/gis/boundaries?level=ADM0`, constrained ADM2, and constrained ADM3 where available.
- [ ] Laravel proxy smoke through Docker route and host route.
- [ ] Frontend typecheck and focused lint for GIS files.
- [ ] Browser smoke for `/gis`: initial load, mode switch, country select, level select, boundary click, drilldown.
- [ ] API tests for PostGIS query construction and route validation.
- [ ] Regression test for geoBoundaries ADM3 rejection.
- [ ] Guard against global unconstrained ADM3 fetches.

## Execution Order

1. Repair the generic GIS API and CDM choropleth plumbing.
2. Add the first administrative boundary explorer slice to the GIS page.
3. Add conservative performance guardrails.
4. Add spatial statistics panels once data assembly is server-side.
5. Expand global crosswalk coverage beyond the current US-centric disease analytics.
6. Add vector tiles/materialized simplified geometries for large-scale usage.
7. Deploy with live smoke checks on `/`, `/login`, `/jobs`, and `/gis`.
