# HADES Parity and Managed OHDSI Shiny Runtime

**Date:** 2026-05-09  
**Commits:** `6ed9bd811`, `1830986fb`, `b470e44e9`, `c11aa2825`  
**Scope:** HADES package freshness, Darkstar runtime capability inventory, Study Designer endpoint guidance, revised OHDSI Shiny policy, managed Shiny app registry, artifact launch broker, ShinyProxy runtime, frontend embedded viewer, deployment/runtime hardening, and live smoke verification.  
**Status:** Shipped to `main` and pushed to `origin/main`.

---

## Executive Summary

This feature set upgrades Parthenon's OHDSI/HADES integration from package-presence parity to governed, observable, launchable OHDSI compatibility.

The earlier platform stance was intentionally strict: Shiny packages could be installed as compatibility dependencies, but Parthenon would not expose hosted Shiny apps. That was a clean product boundary, but it was too rigid for the OHDSI ecosystem. OHDSI users expect canonical Shiny viewers for result exploration, validation, sharing, and comparison against community-standard workflows. The new stance keeps Parthenon's native React/Laravel/Darkstar experience as the primary product path while adding a managed, vetted, Parthenon-authorized Shiny compatibility layer.

The result is a controlled middle path:

- Parthenon still blocks arbitrary user-supplied Shiny app URLs.
- Legacy `shiny_app_url` artifacts remain prohibited.
- Users can launch only registry-approved OHDSI viewers.
- Launches are issued from Parthenon study artifacts after normal authorization.
- Shiny app containers receive short-lived signed launch context, not broad application credentials.
- The runtime is observable through HADES package metadata, System Health, Docker health checks, and deploy smoke checks.

At the end of the remediation, the live Darkstar inventory reported:

| Signal | Value |
| --- | --- |
| HADES packages tracked | 40 |
| Installed packages | 40 |
| Missing packages | 0 |
| Required packages | 25 |
| Required missing packages | 0 |
| Required outdated packages | 0 |
| Parity status | `ready` |
| Freshness status | `current` |
| Managed Shiny apps | 6 |
| Default managed runtime | `shinyproxy` |
| User-supplied Shiny paths | Not allowed |

---

## Why This Was Needed

The remediation began from two related gaps.

First, package parity was visible but not fresh enough. A package could be installed and still be stale relative to the target OHDSI/HADES version profile. That mattered for method reproducibility and for confidence that Parthenon's R runtime matched the current community package landscape.

Second, the blanket Shiny suppression policy was no longer aligned with the way OHDSI users actually inspect results. OHDSI has a large set of package-native and Shiny-backed result exploration workflows. Reimplementing all of them natively remains the long-term Parthenon direction, but suppressing every Shiny surface left a short-term usability gap for canonical OHDSI result viewers.

The revised design treats managed Shiny viewers as compatibility surfaces, not as an escape hatch from Parthenon's product model.

---

## Policy Change

The OHDSI Shiny policy was revised from "installed but never exposed" to "managed compatibility only."

Allowed:

- Vetted OHDSI Shiny viewers registered by Parthenon.
- Embedded and full-page launches through managed runtimes.
- ShinyProxy as the open-source runtime.
- Posit Connect as a future licensed enterprise runtime.
- Artifact-scoped launch context issued by Parthenon.

Still prohibited:

- Arbitrary user-supplied Shiny app paths.
- Raw `shiny_app_url` study artifacts.
- Exposing Darkstar RStudio as a Shiny hosting process.
- Mounting user-provided app directories into the runtime.
- Letting Shiny app containers infer access to studies, sources, or artifacts without Parthenon-issued context.

This is the key architectural distinction: Parthenon is not becoming a generic Shiny hosting platform. It is exposing a curated compatibility layer for canonical OHDSI result modules.

---

## HADES Package Freshness

Darkstar's `/hades/packages` response now includes a richer package contract:

- installed status
- installed version
- target/latest version
- version status: `current`, `behind`, `ahead`, `missing`, or `unknown`
- target version checked date
- target version source
- install source
- pinned ref
- capability description
- product surface classification
- priority
- required-for-parity flag
- Shiny exposure decision
- top-level parity and freshness counts
- release-profile metadata

The target version snapshot is anchored to the 2026-05-08 review. The inventory intentionally records that provenance instead of implying that the versions are magically timeless.

Notable package pins corrected or canonicalized during this work:

| Package | Target |
| --- | --- |
| `CohortMethod` | `6.0.2` |
| `SelfControlledCaseSeries` | `6.1.5` |
| `Achilles` | `1.7.2` |
| `Keeper` / `KEEPER` | `2.1.0` |
| `OhdsiShinyAppBuilder` | `1.0.0` |
| `OhdsiShinyModules` | `3.5.0` |

`Achilles` deserves a specific note: `1.8` was not treated as a valid upstream package target, so the canonicalized target remains `1.7.2`.

Laravel mirrors the freshness logic in `HadesCapabilityController` so older Darkstar payloads still normalize to the current Parthenon contract. That prevents System Health and frontend consumers from regressing if the R image and PHP code are temporarily out of phase during deployment.

---

## Runtime Capability Contract

The runtime now distinguishes package availability from product exposure.

For most HADES packages, the surface categories describe whether Parthenon already has a native workflow, a package-native runtime workflow, or a future UI gap.

For Shiny packages, the classification is explicit:

| Field | Value |
| --- | --- |
| `surface` | `managed_shiny_compatibility` |
| `priority` | `high` |
| `required_for_parity` | `true` |
| `hosted_surface` | `true` |
| `exposure_policy` | `managed_compatibility_layer` |
| `decision` | `managed_ohdsi_shiny_compatibility` |

The top-level inventory also includes `shiny_policy`:

- `expose_hosted_surfaces: true`
- `allow_iframe_embedding: true`
- `allow_user_supplied_app_paths: false`
- `decision: managed_ohdsi_shiny_compatibility`
- `default_runtime: shinyproxy`
- `supported_runtimes: ["shinyproxy", "posit_connect"]`
- `allowed_scope: vetted_ohdsi_modules_only`

That metadata is used by System Health and should become the long-term source of truth for operator-facing runtime status.

---

## Managed App Registry

The initial managed OHDSI Shiny registry contains six app entries:

| Key | Label | Result Families |
| --- | --- | --- |
| `plp-results` | PatientLevelPrediction Results | `PatientLevelPrediction` |
| `population-estimation-results` | CohortMethod, SCCS, and Evidence Synthesis Results | `CohortMethod`, `SelfControlledCaseSeries`, `EvidenceSynthesis` |
| `cohort-diagnostics` | Cohort Diagnostics Explorer | `CohortDiagnostics` |
| `characterization` | Characterization and Incidence Results | `Characterization`, `CohortIncidence` |
| `phevaluator` | PheValuator Results | `PheValuator` |
| `ohdsi-report` | OHDSI Report Viewer | `OhdsiReportGenerator`, `OhdsiSharing` |

Each registry entry declares:

- app key
- display label
- backing package
- module family
- result types
- compatible artifact types
- allowed launch modes
- runtime preference
- ShinyProxy app id
- permission scope
- R entrypoint reference

The registry exists in both Darkstar package metadata and Laravel application code. Laravel is authoritative for actual artifact launch decisions because it has study, user, and artifact context.

---

## Artifact Launch Broker

The launch flow is intentionally brokered through Parthenon rather than directly through ShinyProxy.

The user path is:

1. A study artifact is listed through the Study Artifacts API.
2. Laravel augments eligible artifacts with `managed_shiny_apps`.
3. The frontend displays a launch action for the first compatible managed app.
4. The user requests a launch through `POST /api/v1/studies/{study}/artifacts/{artifact}/shiny-launch`.
5. Laravel validates that the artifact belongs to the study and is not a legacy Shiny URL artifact.
6. `ManagedShinyLaunchService` selects or validates a registry app.
7. The service creates a short-lived signed launch envelope.
8. The service prepares a per-launch workspace and writes `context.json`.
9. The frontend embeds or links to `/shiny/app/{runtimeApp}?parthenon_launch=...`.
10. The Shiny app calls back to `POST /api/v1/shiny/launch-context`.
11. Laravel validates the token and returns only the scoped study/artifact/workspace context.

This avoids storing app URLs, exposing user-provided runtime paths, or giving Shiny containers privileged Parthenon credentials.

---

## Signed Launch Context

Launch tokens are HMAC-signed payloads with:

- issuer
- user id
- study id
- study slug
- artifact id
- app key
- workspace id
- expiry timestamp
- nonce

The default launch TTL is configurable through `SHINY_LAUNCH_TTL_MINUTES` and defaults to 15 minutes.

The Shiny container receives a launch URL but does not receive a durable user session. Its first meaningful action is to resolve the signed token through Laravel. Invalid, malformed, expired, or mismatched tokens return a structured 401 response from the public resolver.

The launch resolver is public by design because Shiny app containers need to call it before they have Parthenon browser authentication. The security boundary is the signed, short-lived, artifact-scoped launch token.

---

## Workspace Model

Each launch receives a workspace under:

```text
storage/app/managed-shiny/launches/{workspace_id}
```

The Shiny container sees the same launch content at:

```text
/srv/parthenon-shiny/launches/{workspace_id}
```

The workspace contains:

- `context.json`
- an `artifact/` directory
- a materialized artifact file when the study artifact has a local stored file

The Docker runtime mounts this workspace read-only into Shiny app containers. PHP owns workspace creation and context writing. This keeps app containers from mutating Parthenon-owned launch state.

The hardening pass after live testing fixed two important edge cases:

- blank `SHINY_WORKSPACE_ROOT` or `SHINY_CONTAINER_WORKSPACE_ROOT` no longer overrides safe defaults
- PHP container recreates now create and chown `storage/app/managed-shiny/launches`

---

## ShinyProxy Runtime

The runtime foundation adds a ShinyProxy service to both main and community Compose stacks.

Core runtime details:

- ShinyProxy version: `openanalytics/shinyproxy:3.2.4`
- app image: `ghcr.io/acumenus-data-sciences/parthenon-shiny-ohdsi:latest`
- internal Docker networking
- `/shiny/` servlet context
- shared `parthenon_shiny_workspaces` volume
- read-only app workspace mount
- health check against the ShinyProxy catalog
- configurable max instances, max lifetime, memory, and CPU
- configurable `SHINY_PROXY_DOCKER_GID` so ShinyProxy can access the Docker socket without running the service as root

The nginx container now proxies `/shiny/` and WebSocket upgrade traffic to ShinyProxy. The live Apache vhost also proxies public `/shiny/` traffic for `parthenon.acumenus.net`.

The runtime intentionally launches containers per app session. The spawned `sp-container-*` containers are short-lived and were cleaned up after live smoke testing.

---

## Shiny App Image

The `docker/shiny-ohdsi` image provides the first managed OHDSI Shiny shell.

It currently:

- starts a Shiny app on port 3838
- reads `parthenon_launch` from the query string
- posts the launch token to Parthenon's resolver
- renders the managed app label and workspace id
- renders study and artifact metadata
- lists files in the mounted launch workspace
- reports installed package versions for `OhdsiShinyModules` and `OhdsiShinyAppBuilder`
- blocks direct access with a clear message when no launch token is present

This is deliberately a runtime scaffold, not yet a full result-bundle-specific OHDSI viewer for every package family. It proves the governed launch path, mounted context, package availability, and ShinyProxy integration. The next layer is package-specific loaders for PLP, PLE/SCCS/Evidence Synthesis, CohortDiagnostics, Characterization, PheValuator, OHDSI reports, and OHDSI sharing bundles.

---

## Frontend User Experience

The first user-facing surface is the Study Artifacts tab.

Changes:

- `shiny_app_url` is no longer offered as a create/edit artifact type.
- legacy `shiny_app_url` rows remain filtered out of the visible artifact list.
- eligible artifacts expose a managed Shiny launch button.
- launch failures surface inline.
- successful embedded launches render an iframe inside the artifact panel.
- users can also open the managed app in a full page when a launch URL is available.
- iframe sandbox flags are returned by the backend launch envelope.

The frontend does not construct app URLs manually beyond using the backend-provided launch URL. That keeps runtime decisions, token creation, app selection, and setup-gap handling in Laravel.

---

## System Health and Operator Visibility

System Health now has enough HADES metadata to communicate more than "package installed."

The inventory supports:

- package count
- installed count
- missing count
- current count
- outdated count
- required count
- required missing count
- required outdated count
- parity status
- freshness status
- release profile
- target version checked date
- managed Shiny policy
- managed app registry

This gives operators a clear distinction between three different failure states:

- package missing: runtime parity is degraded
- required package stale: runtime parity is stale
- runtime configured but app launch failing: ShinyProxy/launch infrastructure issue

---

## Study Designer Integration

Study Designer guidance was corrected to point at real Darkstar package-native `/analysis/...` routes.

The verifier now warns when a required package is present but behind the target version. That makes package freshness visible earlier in the workflow instead of letting users discover drift at execution time.

This matters because Study Designer increasingly acts like a compiler for OHDSI workflows. Its generated plan metadata must route to actual runtime surfaces and should surface runtime caveats before a user starts execution.

---

## Deployment Guardrails

`deploy.sh` now parses the richer HADES inventory.

The deploy smoke behavior distinguishes:

- missing required packages
- stale required packages
- current required package set

By default, stale required packages warn. Operators can force stale packages to fail deployment with:

```bash
DEPLOY_HADES_REQUIRE_CURRENT=1 ./deploy.sh --php
```

This gives production deploys a practical policy switch. Fast local deploys can tolerate warnings while controlled production deploys can require exact package freshness.

---

## Runtime Configuration

Relevant environment variables:

| Variable | Purpose |
| --- | --- |
| `SHINY_PROXY_BASE_URL` | Public or proxied base path for Shiny launches; defaults to `/shiny` |
| `PARTHENON_SHINY_PROXY_BASE_URL` | Backward-compatible alternate base URL |
| `SHINY_RUNTIME` | Runtime label; defaults to `shinyproxy` |
| `SHINY_LAUNCH_TTL_MINUTES` | Signed launch token TTL; defaults to `15` |
| `SHINY_WORKSPACE_ROOT` | Host/PHP workspace root; defaults to Laravel storage |
| `SHINY_CONTAINER_WORKSPACE_ROOT` | Container-visible workspace root; defaults to `/srv/parthenon-shiny` |
| `PARTHENON_SHINY_APP_IMAGE` | Managed Shiny app image |
| `PARTHENON_SHINY_MAX_INSTANCES` | ShinyProxy max instances per app |
| `PARTHENON_SHINY_MAX_LIFETIME_MINUTES` | ShinyProxy max app lifetime |
| `PARTHENON_SHINY_APP_MEMORY` | Shiny app container memory limit |
| `PARTHENON_SHINY_APP_CPU` | Shiny app container CPU limit |
| `SHINY_PROXY_DOCKER_GID` | Docker socket group id for ShinyProxy |

The hardening patch treats blank workspace/base-url env values as unset. This matters because empty variables in `.env` files can otherwise override Laravel defaults.

---

## Implementation Files

Primary backend files:

- `backend/app/Http/Controllers/Api/V1/HadesCapabilityController.php`
- `backend/app/Http/Controllers/Api/V1/StudyArtifactController.php`
- `backend/app/Http/Controllers/Api/V1/ManagedShinyLaunchController.php`
- `backend/app/Services/Shiny/ManagedShinyAppRegistry.php`
- `backend/app/Services/Shiny/ManagedShinyLaunchService.php`
- `backend/config/services.php`
- `backend/routes/api.php`
- `backend/tests/Feature/Api/V1/HadesCapabilityTest.php`
- `backend/tests/Feature/Api/V1/StudyArtifactShinyPolicyTest.php`

Primary frontend files:

- `frontend/src/features/administration/api/adminApi.ts`
- `frontend/src/features/administration/pages/SystemHealthPage.tsx`
- `frontend/src/features/studies/api/studyApi.ts`
- `frontend/src/features/studies/components/StudyArtifactsTab.tsx`
- `frontend/src/features/studies/hooks/useStudies.ts`
- `frontend/src/features/studies/types/study.ts`
- `frontend/src/i18n/appResources.ts`

Runtime and deployment files:

- `darkstar/api/hades_packages.R`
- `darkstar/api/health.R`
- `docker/r/Dockerfile`
- `docker/php/entrypoint.sh`
- `docker/shinyproxy/application.yml`
- `docker/shiny-ohdsi/Dockerfile`
- `docker/shiny-ohdsi/app.R`
- `docker-compose.yml`
- `docker-compose.community.yml`
- `docker/nginx/default.conf.template`
- `deploy.sh`
- `.env.example`
- `backend/.env.example`

Policy and planning files:

- `docs/superpowers/specs/2026-04-15-ohdsi-shiny-supersession-policy.md`
- `docs/superpowers/plans/2026-05-08-hades-parity-and-shiny-remediation.md`

---

## Verification

The final verification pass covered static checks, focused tests, container runtime behavior, live browser behavior, logs, config validation, and graph refresh.

Static and syntax checks:

```text
php -l app/Services/Shiny/ManagedShinyLaunchService.php
php -l app/Http/Controllers/Api/V1/ManagedShinyLaunchController.php
php -l config/services.php
php -l routes/api.php
sh -n docker/php/entrypoint.sh
Rscript -e "parse('docker/shiny-ohdsi/app.R'); cat('ok\n')"
vendor/bin/pint --test ...
vendor/bin/phpstan analyse --memory-limit=1G
```

Focused backend tests:

```text
vendor/bin/pest tests/Feature/Api/V1/StudyArtifactShinyPolicyTest.php tests/Feature/Api/V1/HadesCapabilityTest.php
```

Result:

```text
11 tests passed, 70 assertions
```

Compose and Apache checks:

```text
docker compose config --quiet
docker compose -f docker-compose.community.yml config --quiet
sudo apache2ctl configtest
```

Apache config validated with the pre-existing Aurora document-root warning:

```text
AH00112: Warning: DocumentRoot [/home/smudoshi/Github/Aurora/public] does not exist
Syntax OK
```

Image and runtime checks:

```text
docker compose build php
docker compose up -d --no-deps --force-recreate php
docker compose exec php php artisan optimize:clear
docker compose build shiny-ohdsi
docker run --rm ghcr.io/acumenus-data-sciences/parthenon-shiny-ohdsi:latest Rscript -e "library(shiny); library(httr2); library(jsonlite); cat(as.character(packageVersion('OhdsiShinyModules')), '\n')"
```

The Shiny image reported:

```text
OhdsiShinyModules 3.5.0
```

Live launch verification:

- generated a signed launch token for a real study artifact
- opened public `/shiny/app/ohdsi-report?...`
- ShinyProxy started a managed app container
- iframe rendered the expected study artifact context
- iframe rendered the launch workspace id
- iframe reported `OhdsiShinyModules 3.5.0` available
- iframe reported `OhdsiShinyAppBuilder 1.0.0` available

Direct-denial verification:

- opened `/shiny/app/plp-results` without a launch token
- Shiny app rendered the expected launch-token denial
- no Parthenon study context was exposed

Final container state:

- `parthenon-php`: healthy
- `parthenon-nginx`: up
- `parthenon-shinyproxy`: healthy
- no leftover `sp-container-*` Shiny app containers after cleanup

Final repo checks:

- `git diff --check`: clean
- `graphify update .`: completed successfully
- pre-commit Pint/PHPStan/graphify hook: passed
- final pushed commit: `c11aa2825`

---

## Bugs Found During Verification

The deep verification pass found two real runtime issues after the initial feature landed.

### Blank Env Values Overrode Defaults

Empty values for `SHINY_PROXY_BASE_URL`, `SHINY_WORKSPACE_ROOT`, or `SHINY_CONTAINER_WORKSPACE_ROOT` could override defaults. For workspace paths this could produce invalid launch paths.

Fix:

- treat blank env/config values as unset
- preserve `/shiny`, Laravel storage, and `/srv/parthenon-shiny` defaults
- add a regression test for blank workspace roots

### PHP Entrypoint Could Lose `www-data` Group

During container recreate, Alpine's `deluser www-data` path could remove the matching group before `adduser -G www-data` ran. The container recovered on a later start, but the startup log showed `unknown group www-data`.

Fix:

- add an `ensure_www_data_group` helper
- re-run it after any user deletion
- create the managed Shiny launch directory before ownership repair
- rebuild and recreate PHP
- confirm FPM starts cleanly and can write launch workspaces as `www-data`

---

## Security and Governance Notes

This feature is intentionally not a generic code-hosting or app-hosting path.

Controls currently in place:

- registry-only app selection
- no arbitrary app path input
- no raw Shiny URL artifacts
- artifact ownership checks
- study/artifact matching checks
- short-lived signed launch tokens
- token signature validation
- token expiry validation
- artifact/app compatibility checks
- read-only workspace mount into app containers
- ShinyProxy internal networking
- frontend iframe sandboxing based on backend launch envelope
- direct app access denial when no Parthenon token is present

Important follow-up:

- persist launch audit records for long-term traceability
- expand permission checks from registry metadata into explicit policy gates for source/study/result scopes
- add rate limiting or abuse controls to the public launch-context resolver
- define workspace retention and cleanup policy

---

## What Is Still Scaffolded

The runtime launch path is real and verified. The package-specific Shiny result loaders are still the next implementation layer.

The current `docker/shiny-ohdsi/app.R` proves:

- ShinyProxy integration
- Parthenon token resolution
- mounted launch workspace access
- study/artifact context rendering
- package availability inside the Shiny app image
- direct access denial

It does not yet fully hydrate every OHDSI result bundle into its corresponding `OhdsiShinyModules` UI. That is the correct next phase.

---

## Follow-Up Backlog

Immediate:

- Add package-specific loaders for PLP result bundles.
- Add package-specific loaders for CohortMethod, SCCS, and Evidence Synthesis bundles.
- Add package-specific loaders for CohortDiagnostics output.
- Add package-specific loaders for Characterization and CohortIncidence output.
- Add package-specific loaders for PheValuator output.
- Add package-specific loaders for OHDSI report and sharing bundles.
- Add Playwright coverage for managed launch success and direct launch denial.
- Add a scheduled HADES version refresh job that opens a PR when target versions drift.
- Add a lockfile-mode check against the HADES-wide `2026Q1` `renv.lock`, distinct from latest-version mode.

Near-term:

- Surface managed Shiny launch actions from PLP, PLE, SCCS, Evidence Synthesis, CohortDiagnostics, Characterization, and PheValuator result pages.
- Add persisted launch audit records.
- Add workspace retention cleanup.
- Add operator metrics for active Shiny sessions, launch failures, token failures, and app startup time.
- Add Posit Connect adapter settings for licensed deployments.
- Add golden Eunomia smoke tests for package-native endpoints and managed Shiny launch manifests.
- Expand Strategus module discovery and add JSON/manual configuration fallbacks for modules without first-class React panels.

Longer-term:

- Continue replacing high-value Shiny workflows with native Parthenon React surfaces.
- Keep managed Shiny viewers as reference/compatibility surfaces for OHDSI network expectations.
- Add result import/export contracts so Shiny, native React views, and publish workflows read the same canonical result bundle descriptors.

---

## Product Takeaway

This feature set makes Parthenon's OHDSI integration more realistic and more useful.

The platform now has full HADES package parity, freshness visibility, deploy-time guardrails, Study Designer runtime warnings, and a governed OHDSI Shiny compatibility layer. It no longer forces a false choice between a pure native product and practical OHDSI community workflows.

The product boundary is still strong: Parthenon owns authorization, artifact selection, launch context, runtime policy, and user experience. Shiny is now a controlled viewer runtime for vetted OHDSI modules, not a parallel unmanaged application platform.
