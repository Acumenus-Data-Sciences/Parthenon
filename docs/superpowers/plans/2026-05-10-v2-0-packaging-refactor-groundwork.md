# v2.0 Plan 05-04 — Packaging Refactor Groundwork (Umbrella)

> **For agentic workers:** REQUIRED SUB-SKILL: This is an **umbrella plan**. Use superpowers:writing-plans to author each child plan (05-04-01 through 05-04-04) just-in-time; once a child plan exists, use superpowers:subagent-driven-development to execute it. The umbrella's own checkboxes track the overall extraction sequence.

**Goal:** Extract Parthenon's runtime code into four versioned, publicly-published packages (`parthenon-core` for Composer, `@parthenon/ui` for npm, `parthenon-ai` for PyPI, `parthenon.r` as an R package), each with independent SemVer releases and CI. This puts the building blocks on registries during v2.0 so the actual subtree→package consumption swap in v2.5 (plan 10-02) is incremental, not big-bang. **The monorepo continues to be the source of truth through v2.5** — extraction is non-destructive; the original code stays in place; package builds happen via reproducible source paths.

**Architecture:** A **monorepo-publishing pattern**: each package's source remains in its current location inside `Parthenon`, with a small `package.json` / `composer.json` / `pyproject.toml` / `DESCRIPTION` file added to its directory. A GitHub Actions release workflow per package tags, builds, and publishes to its registry on dedicated tags (`core-v0.1.0`, `ui-v0.1.0`, `ai-v0.1.0`, `r-v0.1.0`). The packages are **deliberately overlapping with the monorepo** at v2.0 — both work; only at v2.5 does EE swap to consuming packages.

**Tech Stack:** Composer + Packagist (PHP backend), npm + npm registry (frontend workspace), uv + PyPI (Python AI), pak + r-universe (R). GitHub Actions for release pipelines; Cosign keyless signing (consistent with plan 05-01) for package release artifacts where the ecosystem supports attestation.

**Parent umbrella:** [2026-05-10-v2-5-roadmap-umbrella.md](2026-05-10-v2-5-roadmap-umbrella.md), workstream **05-04**.

**Sibling Phase 1 plans:** 05-01 signed-images (committed), 05-02 helm GA, 05-03 license server, 05-05 workstation Edition GA, 05-06 OpenAPI SDK strategy.

**Why an umbrella, not a single plan:** Each package has a distinct ecosystem (Composer is not npm is not PyPI is not CRAN). A single plan would either be 4× longer than 05-01 or compromise per-package fidelity. Splitting into 4 child plans + this umbrella lets each ecosystem get appropriate depth.

---

## Child Plans

| ID | Plan | Package | Registry | Source path | Estimated effort |
|---|---|---|---|---|---|
| 05-04-01 | `2026-XX-XX-v2-0-package-parthenon-core.md` | `parthenon-core` | Packagist | `backend/src/Core/` (extracted from `backend/app/`) | ~15 tasks; 2 weeks |
| 05-04-02 | `2026-XX-XX-v2-0-package-parthenon-ui.md` | `@parthenon/ui` | npm | `frontend/src/ui/` (extracted from `frontend/src/components/`) | ~12 tasks; 1.5 weeks |
| 05-04-03 | `2026-XX-XX-v2-0-package-parthenon-ai.md` | `parthenon-ai` | PyPI | `ai/parthenon_ai/` (extracted from `ai/app/`) | ~10 tasks; 1 week |
| 05-04-04 | `2026-XX-XX-v2-0-package-parthenon-r.md` | `parthenon.r` | r-universe (Acumenus) | `r-runtime/parthenon.r/` (extracted from `r-runtime/`) | ~10 tasks; 1 week |

Each child plan follows the same task template (defined below) so the four extractions look structurally identical.

---

## Package Boundary Rules

These rules govern what goes into each package vs. what stays in the app. They are the single most important up-front decision per child plan.

### What goes IN a package (extracted)

1. **Domain models** with no app-layer dependencies — Eloquent models that only depend on Eloquent itself, not on app config or middleware.
2. **Pure-logic services** — anything that takes data in and returns data out, with no I/O coupling beyond its declared interface.
3. **Validation rules, value objects, DTOs** — Form Request classes are app-layer; the rules themselves can be extracted.
4. **Extension point interfaces** (per `docs/architecture/extension-points.md`) — `AuthDriver`, `TenantResolver`, `CryptoProvider`, `AuditSink`, `ObservabilityShipper` interfaces all live in `parthenon-core` so EE consumes them via the same package.
5. **Shared UI primitives** — for the frontend, the dark-clinical-theme tokens, base buttons, modals, table primitives that don't bind to specific routes.
6. **Pure Python utilities** — embeddings helpers, concept-mapping logic, validation functions.

### What STAYS in the app (not extracted)

1. **Routes, controllers, middleware** — these wire the app together; not reusable.
2. **Configuration files** (`backend/config/*.php`) — these define the app, not the library.
3. **Migrations** — schema is app-owned, not library-owned.
4. **Feature-specific React pages** (`frontend/src/features/<feature>/pages/`) — these are the app's UI assembly, not reusable primitives.
5. **Tests for app-level integration** — but per-package unit tests move into the package.
6. **`docker-compose.yml`** and service Dockerfiles — these compose the app, not the library.

### Conflict resolution

If a class straddles "domain model" and "app behavior", split it:
- Domain interface in the package (`parthenon-core`).
- App-specific implementation in `backend/app/` (or wherever).
- The app implementation uses the package interface; EE provides a different implementation later.

This rule is enforced via a static analysis check added in 05-04-01's first task and reused across child plans.

---

## Common Task Template (used by each 05-04-0N child plan)

Each child plan instantiates the following 12+ tasks. The number 12+ accounts for package-specific tasks (e.g., setting up r-universe for R, configuring the Composer autoloader for PHP).

```
Task  1: Add package manifest + minimal directory structure
Task  2: Add `verify-package-boundaries.sh` static check (or extend the existing one)
Task  3: Extract first module into the package + write its unit tests
Task  4: Update the app to consume from the package via the package import path
Task  5: Verify nothing broke in CI
Task  6: Extract remaining modules in batches (one batch per commit)
Task  7: Add package release CI workflow (GitHub Actions → registry)
Task  8: Publish v0.1.0-rc1 to the registry (or to a test registry first)
Task  9: Verify a separate consumer project can install + import
Task 10: Update internal docs
Task 11: Cut v0.1.0 release; tag, push, publish
Task 12: Verify the monorepo consumes from the registry-published version (round-trip)
```

Each task has the standard 5-step structure (test → run → impl → verify → commit) per the writing-plans skill.

---

## Order of Operations

The four child plans are **independent** of each other (different languages, different registries). They CAN run in parallel if you have 4 engineers; with 1 engineer, do them sequentially in this order to minimize cognitive context switching:

1. **05-04-01 parthenon-core** first — establishes the boundary-check tooling pattern; biggest payoff because backend has the most extractable surface (extension point interfaces, domain models, validation rules).
2. **05-04-03 parthenon-ai** second — Python's packaging is the most modern, easiest second case to reinforce the pattern.
3. **05-04-02 parthenon-ui** third — npm workspaces are well-understood; the tooling carries over from any modern frontend dev workflow.
4. **05-04-04 parthenon.r** last — r-universe / R package conventions are the most niche; doing it last means the team has the most pattern experience.

---

## Cross-Child Tasks

These are the umbrella-level concerns shared by every child plan.

### CT-1: Static boundary check

**Files:** `scripts/verify-package-boundaries.sh`, `tests/packaging/boundary-rules.yaml`

- [ ] **Step 1: Write the failing test.**

```bash
# tests/packaging/test_boundary_check.bats
#!/usr/bin/env bats

@test "boundary check rejects an extraction that violates the rules" {
  run scripts/verify-package-boundaries.sh tests/packaging/fixtures/violating-extraction
  [ "$status" -ne 0 ]
  [[ "$output" == *"violation"* ]]
}

@test "boundary check accepts a compliant extraction" {
  run scripts/verify-package-boundaries.sh tests/packaging/fixtures/compliant-extraction
  [ "$status" -eq 0 ]
}
```

- [ ] **Step 2: Run test to verify it fails.** `bats tests/packaging/test_boundary_check.bats` → FAIL (script not found).

- [ ] **Step 3: Implement.** A boundary check script that walks a candidate package directory and flags any imports / `use` statements / `import`s that reach into app-layer paths (routes, controllers, middleware, migrations). Rules in `tests/packaging/boundary-rules.yaml`. Implementation deferred to 05-04-01 Task 2.

- [ ] **Step 4: Run test to verify it passes.**

- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(packaging): add static boundary-rule check shared across package extractions"
```

### CT-2: Per-package release workflow template

**Files:** `.github/workflows/release-package-template.yml` (a workflow template, not directly invoked)

- [ ] **Step 1: Define the template** with placeholders for `PACKAGE_NAME`, `PACKAGE_REGISTRY`, `PACKAGE_DIR`, `BUILD_COMMAND`, `PUBLISH_COMMAND`. Each child plan instantiates this template into a real workflow file (`release-parthenon-core.yml`, `release-parthenon-ui.yml`, etc.).

- [ ] **Step 2: Each child plan's Task 7 references this template.**

- [ ] **Step 3: All four release workflows trigger on `<package-prefix>-v*` tags only**, so a `v2.0.0` tag for the main app does not accidentally cut a package release.

### CT-3: Registry account provisioning

Manual gate before any child plan's Task 7 can complete.

- [ ] **Step 1: Packagist organization** `acumenus-data-sciences` created and connected to the GitHub repo (Composer auto-discovery webhook).
- [ ] **Step 2: npm organization** `@parthenon` (or `@acumenus`) created, 2FA enforced, automation token issued and stored in GitHub Secrets as `NPM_PUBLISH_TOKEN`.
- [ ] **Step 3: PyPI** project owners include both Sanjay and an `acumenus-ops` machine account; trusted publisher (OIDC) configured against the release workflow.
- [ ] **Step 4: r-universe** monorepo registry created at `https://acumenus.r-universe.dev/`.

These are external-system operations, not commits. Document them in `docs/devlog/2026-XX-XX-packaging-registries-provisioned.md` when complete.

### CT-4: Cross-package version coordination

At v2.0, each package starts at `v0.1.0`. They version independently (a `parthenon-core` bugfix bumps to `v0.1.1` without touching `@parthenon/ui`). At v2.5 (plan 10-02 packaging-swap), all four packages must be at `>=v1.0.0` and the consumed versions are pinned in the EE repo's manifest files.

A `docs/packaging/versions.md` table tracks the current published version of each package and gets updated on every release.

### CT-5: CLA continuity for new packages

Per umbrella CP-4: when each package's first release publishes to Packagist / npm / PyPI / r-universe, its README links to the same CLA used by the main `Parthenon` repo. No package gets a divergent CLA.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Boundary rules too strict, blocks legitimate extractions | Medium | Child plans stall on Task 2 | Boundary rules YAML is iterative; first child plan (05-04-01) refines the rules before the others start |
| Composer/npm/PyPI/r-universe accounts not yet provisioned when child plan needs them | High | Child plans block on Task 7 | CT-3 done up front, before any child plan starts |
| Monorepo + package dual-source diverges (someone edits the in-app copy instead of the package source) | Medium | Confusing bugs in EE consumers | Boundary check (CT-1) runs in CI and flags duplicate files between app path and package path |
| Package consumers (initially EE in v2.5) hit unexpected breaking changes | Medium | EE customer escapes | Strict SemVer + a deprecation policy doc in each child plan |
| R package extraction is unfamiliar territory | High | 05-04-04 slips | Do it last; engage an external R-package consultant if needed |

---

## Definition of Done (umbrella)

This umbrella is complete when:

- [ ] CT-1, CT-2, CT-3, CT-4, CT-5 all checked off.
- [ ] All four child plans (05-04-01 through 05-04-04) have shipped their respective `v0.1.0` releases to their registries.
- [ ] The Parthenon monorepo consumes each published package via its registry path, with a passing CI green-build.
- [ ] `docs/packaging/versions.md` documents the current version of each package.
- [ ] The umbrella plan's Status Tracking table is updated: `05-04 packaging-refactor | Completed | <date>`.

Note: this umbrella's "Done" state is the **foundation**, not the consumption swap. The actual consumption swap (EE drops the subtree, pulls packages instead) is plan **10-02 packaging-swap** at v2.5.

---

## Open Questions (resolved during child plan authoring)

- Whether to use **npm workspaces** or **pnpm workspaces** for `@parthenon/ui` — 05-04-02 picks based on current `frontend/` tooling (Vite 7 supports both; tooling consensus picks pnpm if migration cost is low).
- Whether the **R package goes to CRAN** (months of review) or stays on r-universe — 05-04-04 picks r-universe for v2.0 launch; CRAN as a v3.0 followup if customer demand justifies it.
- Whether `parthenon-core` includes the **OpenAPI spec** — 05-04-01 cross-references 05-06 (OpenAPI SDK strategy) and picks the cleanest split.
- Naming conflict: if `parthenon-core` or `parthenon-ai` are already taken on their registries, fall back to `acumenus/parthenon-core` and `acumenus-parthenon-ai`. Verified during CT-3.

---

## Status Tracking

| Child plan | Status | Started | Completed | Notes |
|---|---|---|---|---|
| 05-04-01 parthenon-core | Not started | — | — | Authorable now; first to execute |
| 05-04-02 parthenon-ui | Not started | — | — | Authorable now |
| 05-04-03 parthenon-ai | Not started | — | — | Authorable now |
| 05-04-04 parthenon.r | Not started | — | — | Authorable now |

Cross-tasks:

| Cross-task | Status |
|---|---|
| CT-1 boundary check | Not started |
| CT-2 release workflow template | Not started |
| CT-3 registry provisioning | Not started |
| CT-4 version coordination | Not started |
| CT-5 CLA continuity | Not started |

Updated when each child plan's Task 11 publishes its respective `v0.1.0`.
