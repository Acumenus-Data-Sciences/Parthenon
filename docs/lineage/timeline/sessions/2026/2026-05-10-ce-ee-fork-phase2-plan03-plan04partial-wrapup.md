---
doc_type: lineage
status: historical
date: 2026-05-10
owner: acumenus
module: docs
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---
# CE/EE Fork — Phase 2 + Plan 03 + Plan 04 partial: Wrap-up

**Date:** 2026-05-10
**Status:** Phase 2 complete; Plan 03 autonomous portion complete; Plan 04 Tasks 0/3/7 complete; remaining work catalogued below.
**Repos touched:** `Acumenus-Data-Sciences/Parthenon` (CE, public, AGPL-3.0-only), `Acumenus-Data-Sciences/Parthenon-EE` (EE, private, proprietary).

---

## TL;DR

The CE/EE fork is now structurally complete. CE exposes eight documented extension-point seams (auth driver, tenant resolver, crypto provider, audit sink, observability shipper, frontend feature flags + EnterpriseGate, Acropolis installer phase registry, compose composition contract). The private `Parthenon-EE` repo exists with CE merged in via `git subtree`, daily sync tooling, three CI workflows, and the EE packaging foundation in place. Three EE features are implemented end-to-end against the seams: license verification, multi-tenant request resolution + queue middleware, and the entitlement-gated service provider that wires every other EE driver behind the license check.

What is **not** done: counsel-finalized `LICENSE-EE`, self-hosted runner registration on `beastmode`, cosign key generation + secret push, and six remaining EE drivers (Keycloak, SAML, SCIM, FIPS crypto, signed audit, observability shippers) — each of which depends on either a credentials-handling action only Sanjay can perform or a real external service to validate against.

CE behavior is unchanged in any deployment that doesn't bundle the EE overlay; the entire fork is additive.

---

## 1. What landed on CE main (`Acumenus-Data-Sciences/Parthenon`)

### Phase 2 — eight extension-point seams

Every extension point ships with a documented interface, a default CE implementation that preserves CE behavior byte-for-byte, and tests that prove pluggability via at least one alternate driver.

| # | Extension point | Plan | Merge commit | New tests |
|---|-----------------|------|--------------|-----------|
| 1 | AuthDriver | 02-01 | `077a492c5` | Pest |
| 2 | TenantResolver (+ R2 queue serialize) | 02-02 | `6607f8241` | Pest |
| 3 | CryptoProvider | 02-03 | `07332fd4b` | Pest |
| 4 | AuditSink (+ R4 canonical JSON) | 02-04 | `fe4fc66b7` | 12 Pest cases, 46 assertions |
| 5 | ObservabilityShipper (+ R5 unit hint) | 02-05 | `97ea309eb` | 16 Pest cases, 65 assertions |
| 6 | FeatureFlags + EnterpriseGate (R6 closed union) | 02-06 | `576a288e8` | 12 Pest + 13 Vitest = 25 |
| 7 | Acropolis installer phase registry | 02-07 | `c5f7553d9` | 19 pytest cases |
| 8 | Compose composition contract | 02-08 | `a38f285ce` | 13 pytest cases |

Seven Cross-Plan Revisions were folded in during execution: R2 (`TenantResolver::snapshot/restore` for queue boundaries), R3 (CryptoProvider key-rotation contract), R4 (AuditEvent canonical JSON for chain interop), R5 (`MetricEvent::unit` UCUM hint for OTel/Prom/DD parity), R6 (closed `FlagName` union via `FlagNameRegistry` + module augmentation), R7 (`PhaseResult::warnings` for non-fatal advisories), R8 (compose `extra_hosts` additive merge).

Each Phase 2 PR went through full CI (license-guard, OpenAPI Scribe, Backend Laravel, Frontend React, Documentation Docusaurus, AI Service Python, build matrix). PR #320 (Plan 02-06) hit one CI failure caused by `Button variant="default"` (only `primary | secondary | ghost | danger` are valid in `tsc -b` build mode); fix `f0547950b` re-merged clean.

**Headline contract:** CE never references EE classes; EE never patches CE files. The eight seams + the documented compose contract enforce this in code, in tests, and in CI.

### Documentation deliverables

`docs/architecture/extension-points.md` is the single index page with rows linking to detail pages:

- `extension-points/auth-driver.md`
- `extension-points/tenant-resolver.md`
- `extension-points/crypto-provider.md`
- `extension-points/audit-sink.md`
- `extension-points/observability-shipper.md`
- `extension-points/feature-flags.md`
- `extension-points/installer-phase-registry.md`
- `extension-points/compose-composition.md`

Every detail page includes EE wiring sketches so a contributor authoring an EE driver has a concrete reference.

### CI / governance touched on CE

- `scripts/verify_compose_contract.py` + `scripts/verify_compose_contract_test.py`
- `.github/workflows/compose-contract.yml` (runs on every PR touching compose files)
- 73 net-new tests across PHP/TypeScript/Python on CE main

---

## 2. What landed on EE main (`Acumenus-Data-Sciences/Parthenon-EE`)

The private repo was bootstrapped from scratch on 2026-05-09. Merge order:

| Commit | Plan / task | Summary |
|---|---|---|
| `06349f1fc` | Plan 03 §2.1 | Initial empty commit |
| `13bf247db` | Plan 03 §2.2 | Subtree merge — CE pinned at `a38f285ce` (Phase 2 #8 final) |
| `9458db0a2` | Plan 03 §2.3 | `CE_VERSION` pin recorded |
| `08028259e` | Plan 03 Tasks 3+4 | License-EE DRAFT, COMMERCIAL.md, THIRD_PARTY_LICENSES.md, README, sync scripts |
| `fe807e789` | Plan 03 Tasks 5–9 | Three GH workflows + CODEOWNERS + .gitignore + .git-blame-ignore-revs + enterprise/ scaffold |
| `a712e4c24` | Plan 03 closeout | `PLAN-03-HANDOFF.md` for remaining USER ACTIONS |
| `e33dc897c` | Plan 04 Task 0 | EE packaging foundation |
| `98859ee2a` | Plan 04 Task 3 | License module (LicenseService + entitlement-gated provider) |
| `5f57fd14c` | Plan 03 follow-up | Branch-protection blocker documented |
| `f13d7dbc6` | Plan 04 Task 7 | MultiTenantResolver + tenant-aware queue middleware |

### Subtree integration

CE's full source tree lives at `parthenon/` inside the EE repo, merged via `git subtree` at the pinned commit. The merge required a plumbing-level workaround: modern `git checkout` rejects path entries with leading dots (`.Jules/palette.md`, `.dockerignore`), and `git subtree add`'s shell script chokes on this. The fix was a manual `git read-tree --prefix=parthenon/ -u FETCH_HEAD` followed by hand-built `commit-tree` with the proper `git-subtree-dir` / `git-subtree-mainline` / `git-subtree-split` trailers so subsequent `git subtree pull` operations recognize the merge.

The hard rule "EE never patches files under `parthenon/`" is enforced in three places:

1. **`scripts/verify-no-ce-patches.sh`** — runs as a pre-commit hook (rejects staged parthenon/ edits) and as a CI gate (PR mode walks every commit and verifies any parthenon/-touching commit has a `[ce-sync]` marker).
2. **`.github/CODEOWNERS`** — `parthenon/` and high-sensitivity paths require explicit maintainer review.
3. **`.github/workflows/ee-ci.yml`** — `verify-no-ce-patches` job runs on ubuntu and is the one always-green status check.

### Sync, CI, and release pipelines

- **`.github/workflows/ce-sync.yml`** — Daily 06:00 UTC scheduled run + `workflow_dispatch`. Calls `scripts/sync-from-ce.sh`. Clean merge → push to main with `[ce-sync] CE main @ <sha>` commit + updated `CE_VERSION`. Conflict → push the sync branch and open a `sync-conflict`-labelled PR (deduplicated so only one is open at a time). **Smoke-tested green:** "Already up to date with CE main at a38f285ce…".
- **`.github/workflows/ee-ci.yml`** — Triggers on every PR + push to main. Jobs: `verify-no-ce-patches` (ubuntu, always-green) → `ce-tests` (self-hosted on `beastmode`, full Pest + Vitest + pytest against the merged tree) → `ee-tests` (self-hosted, EE-specific tests under `enterprise/*/tests/` + `docker compose -f parthenon/docker-compose.yml -f docker-compose.ee.yml`) → `build-ee-images` (self-hosted, no-push image build).
- **`.github/workflows/ee-release.yml`** — Triggers on `vEE-*` tags. Logs into GHCR via `GITHUB_TOKEN`, calls `scripts/build-ee.sh --tag $TAG --push`, signs every image with cosign using `COSIGN_PRIVATE_KEY` + `COSIGN_PASSWORD` secrets, generates SBOMs via syft (SPDX-JSON), attaches SBOMs as cosign attestations, and uploads them as GH release assets.

### EE packaging foundation (Plan 04 Task 0)

- `enterprise/backend/composer.json` — proprietary library, PSR-4 `Acumenus\Parthenon\Enterprise\` → `src/`, `EnterpriseServiceProvider` declared via Laravel auto-discovery. Dropped `stevenmaguire/oauth2-keycloak` (requires `firebase/php-jwt ^6.0`, conflicts with CE's `^7.0` — Plan 04 §0.2 forbids EE overriding shared CE deps; Keycloak adapter selection deferred to Task 4).
- `enterprise/backend/Dockerfile.layer` — overlay image building on top of `ghcr.io/acumenus-data-sciences/parthenon-php:${PARTHENON_IMAGE_TAG}` via `wikimedia/composer-merge-plugin`. Embeds `CE_PIN` + `EE_TAG` labels.
- `enterprise/frontend/vite.config.overlay.ts` — vite overlay config; EE devs build via this, sets `resolve.alias` for `@enterprise/*` (EE) and `@` (CE), writes dist to the EE working tree, never touches CE files.
- `enterprise/frontend/src/registerRoutes.ts` — entry point for EE-only React routes (currently empty; Tasks 4+ will append).
- `enterprise/templates/commercial/` — migrated from `parthenon/templates/commercial/` (CE pinned subtree); package renamed `parthenon-templates-commercial` → `acumenus-data-sciences-parthenon-templates-commercial`, bumped to 0.2.0. **The CE-side deletion is a paired PR pending customer-success coordination per Plan 04 §0.4 deprecation pattern.**

### License module (Plan 04 Task 3)

- `LicenseClaims` — readonly value object with safe defaults (`tier=enterprise`, `support=standard`, `max_users=PHP_INT_MAX`, `max_tenants=PHP_INT_MAX`).
- `InvalidLicenseException` — single error type for missing / expired / tampered / not-yet-valid tokens.
- `LicenseService` — RS256 JWT verification with belt-and-braces nbf/exp checks, `Illuminate\Contracts\Cache\Repository` integration cached at clamped 30..3600 s (default 60 s) to bound the revocation window. `hasEntitlement()` swallows `InvalidLicenseException` so EE drivers can probe entitlement presence without try/catch noise; `assertEntitlement()` re-raises for code paths that must not silently degrade.
- `EnterpriseServiceProvider` — singleton-binds `LicenseService`, then in `boot()` walks an entitlement → registration map and invokes each registrar ONLY when the matching entitlement is present AND the driver class exists (`class_exists()` guards protect against incomplete EE trees during incremental rollout). Registrars are wrapped in try/catch + warning log so a single misbehaving driver can't take the request down.
- **11 Pest tests, 52 assertions** — each test forges its own RSA keypair + JWT so the suite has no dependency on the Acumenus license server private key.

### Multi-tenant resolver (Plan 04 Task 7)

- `MultiTenantResolver` — implements `App\Contracts\TenantResolverInterface`. Resolution order: subdomain → `X-Tenant-Slug` header → JWT `tenant` claim (RS256) → authenticated user's primary tenant. Reserved subdomains (`www`, `api`, `admin`, `static`, `cdn`) and invalid slug shapes return null; hostname matching is case-insensitive.
- `setCurrent()` / `clear()` for impersonation flows; `snapshot()` / `restore()` for queue boundaries (Plan 02-02 R2).
- `SetTenantContextMiddleware` — queue-job middleware. Calls `$resolver->restore($job->tenantSnapshot)` before `next($job)`, calls `$resolver->clear()` in `finally` so worker processes don't leak tenant context between jobs even when handlers throw. Defensive: missing container, missing snapshot, resolver throwing during restore, and missing `tenantSnapshot` property all no-op cleanly.
- **22 new Pest tests, 34 new assertions** (33 total tests, 86 assertions when added to the License module suite). Covers every `resolveFrom*` helper across positive + negative cases plus six middleware behaviors (restore-then-handler-then-clear order, clear-on-throw, missing-property no-op, null snapshot no-op, restore-throws-swallowed, missing-container-graceful).
- PHPStan stub at `phpstan-stubs/ce-classes.stub` declares `App\Contracts\TenantResolverInterface` + `App\Tenancy\Tenant` so EE-only static analysis works against them. Real classes shadow these stubs in the merged container; PHPStan level 6 clean on `src/License/` + `src/Tenant/`.

---

## 3. Architecture decisions worth flagging

### CE/EE boundary in a single repo

The fork uses **Approach B from the spec**: one working tree, CE merged in as a `git subtree` at a pinned commit under `parthenon/`, EE-only code under `enterprise/`. EE never modifies `parthenon/` files; subtree pulls bring CE updates in atomically with `[ce-sync]` markers. Approach C (proper packages) is the v2.5 path; Approach B was selected for shorter time-to-first-paid-customer.

### License is the gate, not the deploy switch

Every EE feature registers ONLY when the customer's license token carries the matching entitlement. Missing entitlement = feature stays unregistered = the CE default surfaces. This means a Parthenon-EE container running without a license behaves identically to CE — no separate "EE-disabled" code path to maintain.

### Class-exists guards in the service provider

`EnterpriseServiceProvider`'s entitlement → registrar map is `class_exists()`-guarded so the provider boots cleanly against an incomplete EE tree. Tasks 4–10 land additional driver classes; the provider doesn't need to be touched as each one merges. This is the same pattern Plan 02-08's Compose Composition Contract uses for forward-compatible additions.

### EE composer install layered over CE via composer-merge-plugin

EE never overrides shared CE dependencies. The `Dockerfile.layer` runs `composer install` against the merged manifest (CE's + EE's via `wikimedia/composer-merge-plugin`), so any EE dep version conflicting with CE's pin is a *contract breach* that must be resolved by upstreaming the bump to CE first. This bit during Task 0 — `stevenmaguire/oauth2-keycloak` requires `firebase/php-jwt ^6.0` while CE pins `^7.0`; the package was dropped from EE's manifest and the Keycloak adapter selection deferred.

### EE-only Pest with PHPStan stubs for CE classes

The EE-only composer install does NOT pull `laravel/framework` (per Plan 04 §0.2). Pure-PHP EE classes (License module, value objects) test cleanly from the EE working tree alone. Classes that reference CE-owned types (e.g. `App\Tenancy\Tenant`) get a PHPStan stub at `phpstan-stubs/ce-classes.stub` for static analysis and a top-of-file `eval` in tests for runtime resolution. Full integration coverage runs in the merged CE+EE container under `ee-ci.yml`.

### Resume-preserving installer phase registry

Plan 02-07 lifted the Acropolis installer's 9-step inline `if not state.is_completed(N)` flow into a `PhaseRegistry` with topological sort. Every CE phase keeps its original `legacy_state_id` (1..9) so an installer interrupted mid-flow on the prior code base resumes correctly after the refactor. EE phases use entry-point group `parthenon.acropolis.phases` for runtime registration.

### Compose contract is documentation + machine verification

Plan 02-08 captured the Docker Compose composition rules (stable service names, container/volume/network naming, `${VAR:-default}` interpolation only, no profile gating for EE, `extra_hosts` additive merge) as both a doc page and a static verifier (`scripts/verify_compose_contract.py`). The verifier runs in CI on every PR touching a compose file. CE behavior is unchanged.

---

## 4. What is **not** done — pending follow-up tasks

The pending work breaks into four categories.

### A. Plan 03 follow-ups (USER ACTIONS — credentials / infra)

**Plan 03 Task 7 — Self-hosted runner on `beastmode`.** The `ee-ci.yml` workflow's `ce-tests`, `ee-tests`, and `build-ee-images` jobs target `runs-on: [self-hosted, beastmode]`. Until a runner with that label is registered against the Parthenon-EE repo, those jobs never start and EE PRs only get the always-green `Guard - EE never patches CE` check. The full registration command is in `Parthenon-EE/PLAN-03-HANDOFF.md`. The runner will execute under your `smudoshi` user with `sudo` access, so this is a security-meaningful action — not just a DevOps step.

**Plan 03 Task 8.2 — Cosign keypair + secret push.** The `ee-release.yml` workflow expects `COSIGN_PRIVATE_KEY` and `COSIGN_PASSWORD` repo secrets. Generation must happen on a trusted host (NOT in CI) — `cosign generate-key-pair` prompts for a passphrase that only you should know. Without these secrets, the first `vEE-*` tag push will fail at the "Sign images with cosign" step. Public key needs to be committed at `.acumenus/cosign/cosign.pub` so customers can verify signed images locally.

**Plan 03 Task 9.3 — Branch protection ruleset.** **Blocked.** Both `POST /repos/.../rulesets` and `PUT /repos/.../branches/main/protection` return `403 Upgrade to GitHub Pro or make this repository public to enable this feature.` for the current `Acumenus-Data-Sciences` org plan tier. Options: upgrade to GitHub Team (~$4/user/month), defer branch protection (CODEOWNERS becomes advisory-only), or check whether a different paid Acumenus org should host this repo. Documented in `PLAN-03-HANDOFF.md`.

### B. Counsel + business-coordination items

**Counsel-finalized `LICENSE-EE`.** Currently a DRAFT placeholder copied from `~/Documents/acumenus-legal/LICENSE-EE-draft-v1.md`. The header marks it `STATUS: DRAFT — NOT LEGALLY EXECUTABLE. PENDING COUNSEL REVIEW.` This file gates any actual sale or distribution of EE.

**Plan 04 Tasks 1–2 — CE→EE migrations.** Each migration is a paired PR: an EE addition (already non-blocking — `enterprise/templates/commercial/` is in EE main) and a CE deletion (breaking change for any existing customer using the asset). The CE deletions explicitly require customer-success coordination per Plan 04 §0.4 and §1.2 deprecation pattern. Assets to migrate: `acropolis/docker-compose.enterprise.yml`, the existing `templates/commercial/` directory, and the `community-wheel-isolation` CI job that becomes redundant once the proprietary code is no longer in CE.

### C. Plan 04 driver implementations (need real external services to validate)

Each remaining Plan 04 task ships an EE driver that consumes a CE extension-point seam. Code can be written without external services using mocks; functional validation needs the real backend.

| Task | Driver | External dependency |
|---|---|---|
| **4** | `KeycloakAuthDriver` | Real Keycloak server with a configured realm + client. Adapter library still needs selection (the `oauth2-keycloak` package conflicted with CE's JWT pin). |
| **5** | `SamlAuthDriver` | `aacotroneo/laravel-saml2` package + a SAML 2.0 IdP for ACS endpoint testing. |
| **6** | `ScimSyncService` + SCIM 2.0 controllers | Bearer-token-authenticated SCIM endpoints for `/Users` and `/Groups`. |
| **8** | `FipsCryptoProvider` | FIPS-validated OpenSSL 3.x build for the `Dockerfile.fips` overlay. |
| **9** | `SignedAuditSink` | S3 Object Lock or Azure Blob immutable storage for WORM retention; HMAC chain implementation atop the `AuditEvent` canonical-JSON format from R4. |
| **10** | `DatadogShipper`, `SplunkShipper`, `OtelShipper` | HTTP intake endpoints (DD `http-intake.logs.datadoghq.com`, Splunk HEC, OTLP-HTTP collector). |

### D. Plan 04 Tasks 11–14 (operator + installer + bookkeeping)

**Task 11 — Parthenon Operator skeleton.** Kubernetes CRDs for `Source`, `Cohort`, `Analysis`; reconciler stubs (full controller logic deferred to v1.2). Helm + Kustomize overlays under `enterprise/k8s/`.

**Task 12 — EE installer phases.** Concrete `Phase` subclasses for the Acropolis installer phase registry from Plan 02-07: `FipsBootstrapPhase`, `MultiTenantInitPhase`, `KeycloakSetupPhase`, `SignedAuditSetupPhase`. Each registers via setuptools entry-point group `parthenon.acropolis.phases`.

**Task 13 — CE README/ROADMAP updates.** Mention that EE exists, point at `Acumenus-Data-Sciences/Parthenon-EE` (private) and `licensing@acumenus.net`, link to the eight extension-point detail pages.

**Task 14 — Smoke release.** Cut `vEE-0.0.1-bootstrap` to validate the full signed-image + SBOM pipeline. Requires Tasks 7 + 8.2 done first.

---

## 5. How to verify the current state

```bash
# CE main contains the eight extension points
cd /home/smudoshi/Github/Parthenon
git checkout main && git pull
ls docs/architecture/extension-points/
# Expect: auth-driver.md audit-sink.md compose-composition.md crypto-provider.md
#         feature-flags.md installer-phase-registry.md observability-shipper.md
#         tenant-resolver.md

# EE has CE merged in via subtree at the right pin
cd /home/smudoshi/Github/Parthenon-EE
git checkout main && git pull
head -1 CE_VERSION
# Expect: a38f285cea971165c25c8ea8f877a1d5cdfa4873  (Phase 2 #8 final)

# License + Tenant modules pass standalone
cd enterprise/backend && php vendor/bin/pest
# Expect: Tests: 33 passed (86 assertions)

# PHPStan green on EE source
php vendor/bin/phpstan analyse --no-progress
# Expect: [OK] No errors

# CE→EE sync workflow has run successfully
gh run list --repo Acumenus-Data-Sciences/Parthenon-EE --workflow=ce-sync.yml --limit 1
# Expect: completed success ... "Already up to date with CE main at a38f285ce..."
```

---

## 6. Lessons learned

**`tsc --noEmit` is laxer than CI's `tsc -b`.** PR #320 hit a CI failure because `tsc --noEmit` accepted `Button variant="default"` (the default JSX behavior) but `tsc -b` (build-mode with composite refs) rejected it against the closed `"primary" | "secondary" | "ghost" | "danger"` union. Lesson: always run `npx vite build` locally before pushing — vite build is stricter than the type-only check.

**`COMPOSE_PROJECT_NAME=parthenon` when committing from a `/tmp/parthenon-*` worktree.** The pre-commit hook calls `docker compose exec -T php sh -c "... vendor/bin/pint --test"`. Without `-p parthenon`, Compose uses the cwd directory name as the project name and can't find the running stack. Saved to memory at `~/.claude/memory/feedback_worktree_compose_project.md`.

**Modern `git checkout` rejects path entries with leading dots.** The CE codebase has `.Jules/palette.md` and `.dockerignore` files. `git subtree add` shells out to `git checkout` and chokes on these. Workaround: use `git read-tree --prefix=parthenon/ -u FETCH_HEAD` followed by manual `git commit-tree` calls with the proper subtree merge trailers. The trailer format that future `git subtree pull` operations look for:

```
Merge commit '<squash-sha>' as 'parthenon'

git-subtree-dir: parthenon
git-subtree-mainline: <main-head-sha>
git-subtree-split: <ce-pin-sha>
```

**EE composer install layering needs the right host PHP version.** Some Phase 2 work (and Plan 04 Task 7) ran tests via host PHP 8.4. Vendor copies cross-device from `/home/...` to `/tmp/...` worktrees fail with `Invalid cross-device link` if you try `cp -al`; plain `cp -r` works.

**Branch protection on private repos requires GitHub Pro/Team.** Caught at Plan 03 Task 9.3 attempt. Blocking the ruleset deployment until the org plan upgrades or a different paid org hosts the repo.

**A misbehaving EE driver registration MUST NOT break the request.** `EnterpriseServiceProvider::boot()` wraps every registrar in try/catch + warning log. Fail-open is the right default for telemetry / signing / audit drivers; fail-closed would let a single bad config take the whole app down. (`SignedAuditSink` is the documented exception — Plan 04 §9 allows it to throw under "no-audit-no-action" customer policy.)

---

## 7. Suggested next move

The two repos are in a self-consistent state at every merged commit. CE-side work is structurally complete; EE-side is at the point where the **license-aware service provider** correctly gates every future driver behind an entitlement check, and **two real EE features** (license verification, multi-tenant resolution) are implemented end-to-end against the Phase 2 seams.

The most valuable next chunk of autonomous work is **Plan 04 Task 12 — EE installer phases**. It's pure Python, has no external service dependencies, registers via setuptools entry points (the `parthenon.acropolis.phases` group from Plan 02-07), and exercises the registry contract end-to-end. After that, Task 11 (operator skeleton) is similarly self-contained.

The work that **shouldn't proceed without you** is anything that touches credentials (cosign keys, license-server private key), public CE behavior (the paired CE→EE migration PRs that delete proprietary content from public CE), or the GitHub plan tier (branch protection).

**Recommended sequence to fully unblock the fork:**

1. Decide on the GitHub org plan tier (so branch protection can be applied).
2. Register the self-hosted runner on `beastmode` (so EE CI can validate driver work on PR).
3. Generate cosign keys + push secrets (so a smoke `vEE-0.0.1-bootstrap` release can validate signed images + SBOMs end-to-end).
4. Get counsel sign-off on `LICENSE-EE` (so the DRAFT marker comes off and the file becomes legally executable).

After those four, Plan 04 Tasks 4–10 can land iteratively — each driver gets its own PR, gets exercised by the green ee-ci pipeline, and lands behind its license entitlement gate.
