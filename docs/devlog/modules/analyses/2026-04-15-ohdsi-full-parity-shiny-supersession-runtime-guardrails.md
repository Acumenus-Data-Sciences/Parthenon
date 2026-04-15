# OHDSI Full Parity - Shiny Supersession and Runtime Guardrails

**Date:** 2026-04-15
**Branch:** `feature/finngen-sp1-runtime-foundation`
**Scope:** OHDSI/HADES package parity, Darkstar runtime capability reporting, Parthenon-native Shiny replacement policy, Study artifact hardening, admin observability, Docker runtime layering, deploy smoke checks, and production frontend/PHP deployment.
**Significance:** Parthenon now has a verified OHDSI parity foundation without exposing legacy Shiny applications. The platform can report its HADES package state, enforce the product boundary in Laravel and React, fail deployment if required runtime packages disappear, and document the operational contract for future OHDSI capability work.

---

## Executive Summary

This milestone closes the practical OHDSI package parity gap while preserving Parthenon's architecture: React for user workflows, Laravel for product APIs and governance, and Darkstar for R/HADES execution.

The central product decision was explicit: Shiny packages may remain installed for artifact compatibility, but no Shiny application hosting surface is exposed to users. Parthenon must subsume and enhance those workflows with native product surfaces rather than embedding or proxying Shiny apps.

The implementation now enforces that decision at four levels:

1. Darkstar marks Shiny-related OHDSI packages as superseded compatibility dependencies, not hosted capabilities.
2. Laravel proxies HADES capability metadata defensively and prevents Shiny app artifact exposure.
3. React removes Shiny artifact creation/display paths and shows the no-hosting policy in System Health.
4. Deployment includes a HADES package smoke check that fails if required first-class runtime packages are missing.

The live runtime reported full parity after deployment:

| Runtime Signal | Value |
| --- | --- |
| HADES parity status | `ready` |
| Installed packages checked | 40 / 40 |
| Required first-class packages | 23 |
| Required packages missing | 0 |
| Shiny hosting policy | `not_exposed` |
| Shiny packages installed | Yes, compatibility only |
| Shiny app user surface | None |

---

## What Changed

### Darkstar HADES Capability Endpoint

Darkstar now exposes a package capability matrix through `/hades/packages`. The response is no longer just a package-installed list. It is now a product contract that includes:

- package display name
- R package name
- installed status
- installed version
- package category
- product surface classification
- priority
- install source
- pinned ref, where applicable
- inclusion reason
- first-class parity requirement flag
- Shiny exposure policy
- missing required package summary
- top-level parity status

This matters because OHDSI parity is not only a build-time concern. Operators and product code need to know whether the runtime is capable of executing the workflows Parthenon claims to support. The capability endpoint now gives Laravel, React, deploy scripts, and future monitoring one shared source of truth.

### Laravel API Proxy and Defensive Policy Enforcement

Laravel now exposes `/api/v1/hades/packages` through `HadesCapabilityController`. The controller proxies Darkstar's capability response while preserving the no-hosted-Shiny policy even if the upstream runtime changes.

That defensive normalization is intentional. Product policy belongs in Parthenon as well as Darkstar. If a future Darkstar package metadata change accidentally marks `OhdsiShinyAppBuilder` or `OhdsiShinyModules` as hostable, Laravel still returns:

- `product_surface: native_replacement_no_hosting`
- `superseded: true`
- `hosted_surface: false`
- `exposure_policy: not_exposed`

The API contract is therefore stable for the frontend and for administrators reviewing runtime status.

### Study Artifact Shiny Guardrail

Legacy `shiny_app_url` artifacts are no longer part of the product surface.

The Study artifact API now:

- filters existing `shiny_app_url` artifacts out of index responses
- rejects creation of new `shiny_app_url` artifacts
- rejects updates that attempt to convert another artifact into `shiny_app_url`

The frontend study artifact tab mirrors that boundary:

- `shiny_app_url` is no longer offered as a selectable artifact type
- legacy rows of that type are filtered before display

The seeder and migration comments were also cleaned up so new demo data and schema documentation do not advertise Shiny app URLs as a supported Parthenon artifact type.

### Admin System Health Visibility

System Health now includes an OHDSI Package Parity panel. Administrators can see:

- total HADES packages checked
- installed package count
- missing package count
- required package count
- required missing package count
- parity status
- legacy Shiny policy
- missing package detail, including install source when available

The frontend API types were extended to model the expanded HADES metadata, and the administration hook now loads package capability state alongside the existing provider/runtime health information.

### Runtime Build Hardening

The Darkstar Dockerfile HADES parity layer was split into cacheable package clusters instead of one large monolithic install block.

The runtime image now separates:

- r-universe parity packages
- method and authoring GitHub packages
- sharing, exploration, method evaluation, Shiny compatibility packages, and Keeper

This gives future builds a better failure surface. A package install failure now points to a smaller cluster, Docker cache reuse is more practical, and package verification is tied to the layer that introduced the packages.

Important operational note: this Dockerfile change was not rebuilt into a new Darkstar image during this session. The current live service already has all checked packages installed. The Dockerfile layering change applies to the next image build or CI rebuild.

### Deploy Smoke Check

`deploy.sh` now includes a HADES required package smoke check for PHP/database deployment paths.

The check calls Darkstar's `/hades/packages` endpoint and fails deployment if any package marked `required_for_parity` is missing. This moves HADES parity from an informal runtime assumption into an explicit deployment gate.

During deployment the smoke check reported:

```text
Smoke: HADES required packages -> ready; required=23; installed=40/40
```

This is the right failure mode. If a future package rebuild drops a required OHDSI runtime dependency, deploy should stop immediately instead of letting users discover the gap through failed analyses.

---

## Shiny Supersession Policy

The policy is now documented in `docs/superpowers/specs/2026-04-15-ohdsi-shiny-supersession-policy.md`.

The product decision:

- Parthenon does not expose hosted Shiny apps.
- Parthenon does not add iframe/proxy/managed Shiny app URLs as a supported user path.
- Shiny packages may remain installed only for artifact compatibility, package interoperability, or future conversion workflows.
- Native React/Laravel/Darkstar surfaces are the official replacement for OHDSI Shiny workflows.

This avoids creating a split product where some workflows live in Parthenon and others escape into separately hosted Shiny applications. It also avoids the operational burden of per-study Shiny hosting, authentication bridging, iframe security policy, lifecycle management, and ungoverned artifact links.

The policy is encoded in runtime metadata and API behavior, not just documentation.

---

## Why This Matters

### Parity Is Now Observable

Before this work, package parity required shelling into the R container or relying on build history. Now it is visible through a product API and admin UI.

That is a major operational improvement. The platform can distinguish:

- installed but not user-facing packages
- first-class Parthenon features
- native replacements for legacy OHDSI surfaces
- package-native execution support
- compatibility-only dependencies
- required runtime dependencies that must block deployment if missing

### Parity Is Now Governed

The Shiny decision is no longer tribal knowledge. It is present in:

- Darkstar metadata
- Laravel controller behavior
- Study artifact validation
- React artifact UI
- System Health
- test coverage
- policy documentation

That matters because package parity could otherwise be misread as product exposure parity. Installing `OhdsiShinyAppBuilder` does not mean Parthenon should host Shiny apps. The implementation now makes that distinction explicit.

### Parity Is Now Deployable

The deploy guard closes a high-risk operational gap. OHDSI package installs are dependency-heavy, and R package availability can change over time. By checking required package availability at deploy time, Parthenon catches runtime drift before users hit broken analysis paths.

### Parity Remains Native

The no-Shiny rule keeps the platform coherent. Users get a single native Parthenon experience for:

- cohort authoring
- prediction
- treatment pathways
- self-controlled analyses
- phenotype validation and adjudication
- reporting and sharing
- study artifacts
- admin runtime visibility

The OHDSI ecosystem remains deeply supported, but Parthenon is not reduced to a launcher for legacy app surfaces.

---

## Verification

The work was verified across PHP, R, frontend TypeScript, Laravel feature tests, deploy scripts, and live service smoke checks.

### Static and Syntax Checks

```text
php -l backend/app/Http/Controllers/Api/V1/HadesCapabilityController.php
php -l backend/app/Http/Controllers/Api/V1/StudyArtifactController.php
php -l backend/tests/Feature/Api/V1/HadesCapabilityTest.php
php -l backend/tests/Feature/Api/V1/StudyArtifactShinyPolicyTest.php
Rscript -e "parse(file='darkstar/api/hades_packages.R')"
bash -n deploy.sh
npx tsc -b --pretty false
```

### Feature Tests

Focused Docker/Laravel tests passed:

```text
HadesCapabilityTest
StudyArtifactShinyPolicyTest
```

The policy coverage verifies:

- HADES package metadata is proxied through Laravel
- Shiny packages are marked no-hosting
- legacy Shiny artifacts are hidden from Study artifact listings
- new Shiny app URL artifacts are rejected

### Deployment

Both PHP and frontend deployment paths completed successfully:

```text
./deploy.sh --php
./deploy.sh --frontend
```

The frontend deployment used the repository-required deployment path, not `npm run build` as the shipped asset path.

### Live Runtime Check

The live Darkstar service reported:

```json
{
  "parity_status": "ready",
  "required_missing_count": 0,
  "required_count": 23,
  "installed_count": 40,
  "total": 40
}
```

The same live response showed Shiny packages as installed compatibility dependencies with `hosted_surface` disabled and `exposure_policy` set to `not_exposed`.

---

## Files Changed

### Runtime and Deploy

- `darkstar/api/hades_packages.R`
- `docker/r/Dockerfile`
- `deploy.sh`

### Backend

- `backend/app/Http/Controllers/Api/V1/HadesCapabilityController.php`
- `backend/app/Http/Controllers/Api/V1/StudyArtifactController.php`
- `backend/routes/api.php`
- `backend/database/seeders/StudySeeder.php`
- `backend/database/migrations/2026_03_04_200007_create_study_artifacts_table.php`

### Backend Tests

- `backend/tests/Feature/Api/V1/HadesCapabilityTest.php`
- `backend/tests/Feature/Api/V1/StudyArtifactShinyPolicyTest.php`

### Frontend

- `frontend/src/features/administration/api/adminApi.ts`
- `frontend/src/features/administration/hooks/useAiProviders.ts`
- `frontend/src/features/administration/pages/SystemHealthPage.tsx`
- `frontend/src/features/studies/components/StudyArtifactsTab.tsx`

### Documentation

- `docs/superpowers/plans/2026-04-13-ohdsi-full-parity.md`
- `docs/superpowers/specs/2026-04-15-ohdsi-shiny-supersession-policy.md`
- `docs/devlog/modules/analyses/2026-04-15-ohdsi-full-parity-shiny-supersession-runtime-guardrails.md`

---

## Remaining Work

The major parity foundation is complete. The remaining work is follow-on product enhancement, not parity rescue.

Recommended next items:

1. Rebuild the Darkstar image in CI or a controlled maintenance window so the Dockerfile layer split is proven from a clean image build.
2. Add scheduled monitoring around `/api/v1/hades/packages` so required package drift creates an alert outside deployment windows.
3. Extend Prediction UI/API for `EnsemblePatientLevelPrediction` settings and result metadata.
4. Decide whether advanced method packages such as `BigKNN`, `BrokenAdaptiveRidge`, and `IterativeHardThresholding` should become direct user choices or remain implementation dependencies.
5. Add an admin export of the HADES package matrix for release evidence and regulated deployment records.

---

## Final State

Parthenon now has a verified OHDSI parity runtime with native product governance.

The platform can say all checked OHDSI packages are installed, required packages are present, Shiny packages are intentionally not exposed, and deployment will fail if required HADES runtime capabilities disappear.

That is the critical line: Parthenon has OHDSI capability parity without inheriting legacy Shiny hosting as a product architecture.
