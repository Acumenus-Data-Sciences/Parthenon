# CE/EE Fork — Plan 02 (Umbrella): Phase 2 CE Extension Points

> **For agentic workers:** this is the umbrella for Phase 2. Each of the 8 extension points has its own detailed sub-plan (`Plan 02-01` through `Plan 02-08`). Sub-plans are written close to execution time so they reflect current `Acumenus-Data-Sciences/Parthenon` main state.

**Goal:** Add 8 stable extension-point seams to Parthenon Community Edition so Enterprise Edition can plug in via the `enterprise/` overlay without patching CE files. All work is **AGPL-3.0-only, public**, lands in `Acumenus-Data-Sciences/Parthenon` main as a sequence of independent PRs.

**Spec reference:** [docs/superpowers/specs/2026-05-08-ce-ee-fork-and-agplv3-relicense-design.md](../specs/2026-05-08-ce-ee-fork-and-agplv3-relicense-design.md) §5 (CE Extension Points) and §7 Phase 2.

**Estimated execution window:** ~4 weeks, ~2 PRs/week.

**Prerequisites:** Plan 01 fully merged (PRs #311, #312, #313), AGPLv3 live in CE main, CLA Assistant gating contributors.

---

## The 8 extension points

Each is its own PR with its own sub-plan. Each preserves CE behavior byte-for-byte via a default implementation. Each documents the extension surface so a community user could write their own driver.

| # | Extension point | Sub-plan | Foundational? | EE consumes via |
|---|---|---|---|---|
| 1 | **AuthDriver registry** | Plan 02-01 | ✅ Yes — foundational | `keycloak`, `saml`, `scim` drivers in `enterprise/backend/src/Auth/` |
| 2 | **TenantResolver + tenant-aware Eloquent scopes** | Plan 02-02 | ✅ Yes — foundational | `MultiTenantResolver` in `enterprise/backend/src/Tenant/` |
| 3 | **CryptoProvider** | Plan 02-03 | ❌ Independent | `FipsCryptoProvider` |
| 4 | **AuditSink** | Plan 02-04 | Depends on 1, 2 | `SignedAuditSink` (S3/Azure WORM) |
| 5 | **ObservabilityShipper** | Plan 02-05 | ❌ Independent | Datadog, Splunk, OpenTelemetry shippers |
| 6 | **Frontend featureFlags + EnterpriseGate** | Plan 02-06 | Depends on 1-5 (admin UIs gated) | Reveals EE admin panels, multi-tenant switcher, SAML/SCIM UI |
| 7 | **Acropolis installer phase registry** | Plan 02-07 | ❌ Independent | EE phases (FIPS bootstrap, multi-tenant init, Keycloak setup) |
| 8 | **Compose composition contract** | Plan 02-08 | Independent (mostly docs) | `docker-compose.ee.yml` extends CE compose |

## Suggested execution order

Two parallelizable tracks:

**Track A (sequential, foundational):**
1. **02-01: AuthDriver** (week 1) — most foundational; downstream extension points read auth context
2. **02-02: TenantResolver** (week 1-2) — second foundational; many things become tenant-aware after this
3. **02-04: AuditSink** (week 2-3) — depends on auth + tenant context
4. **02-06: Frontend featureFlags + EnterpriseGate** (week 3) — EE admin UIs gated by these flags

**Track B (parallel, can run any time):**
- 02-03: CryptoProvider
- 02-05: ObservabilityShipper
- 02-07: Acropolis installer phase registry
- 02-08: Compose composition contract

**Don't start Plan 02-04 (AuditSink) until 02-01 + 02-02 merge** — AuditSink uses both auth user context and tenant context.

**Don't start Plan 02-06 (frontend gates) until at least one backend extension point merges** — the EnterpriseGate component needs at least one feature flag to gate against.

## Per-extension-point common structure

Every sub-plan follows this template:

1. **Pre-flight** — verify main is clean, branch off main, no concurrent USER WIP in target files.
2. **Define the contract** — interface in `backend/app/Contracts/` (PHP), `frontend/src/contracts/` (TS), or equivalent. Include docblock describing what an EE driver must implement.
3. **Refactor existing CE code** to use the contract — extract current implementation into a default driver class. Behavior must be byte-identical.
4. **Wire driver registry** — `config/<feature>-drivers.php` with array map `string => DriverClass`. Service provider binds the active driver from config.
5. **Tests** — TDD:
   - Unit test for the default driver
   - Integration test proving the registry resolves the right driver
   - Integration test with a stub alternate driver, proving pluggability
6. **Documentation** — `docs/architecture/extension-points/<feature>.md` (per-extension doc), plus an index entry in `docs/architecture/extension-points.md`.
7. **Commit, push, PR** — full CI required green before merge. Pre-commit hook must pass without `--no-verify` (these are real code changes, not docs-only).

## Exit criteria for Phase 2

When all 8 sub-plans land:

- [ ] All 8 extension-point interfaces exist in `backend/app/Contracts/` (or appropriate per-language locations)
- [ ] All 8 default implementations preserve CE behavior — integration tests prove byte-identical output for current users
- [ ] All 8 documented in `docs/architecture/extension-points.md` with index + per-extension detail pages
- [ ] All 8 have ≥1 alternate stub implementation in tests proving pluggability
- [ ] CE main has no behavior regression (smoke test on `parthenon.acumenus.net` staging)
- [ ] ROADMAP.md updated to reflect Phase 2 complete
- [ ] Spec ROADMAP table marks Phase 2 done

## Out of scope for Phase 2 sub-plans

- Implementing any EE driver. EE drivers live in `Acumenus-Data-Sciences/Parthenon-EE` (Plan 04).
- Wiring multi-tenant data migrations. The TenantResolver default is single-tenant; actual multi-tenancy ships in EE.
- FIPS validation. CryptoProvider abstracts the crypto layer; the actual FIPS provider is EE.
- Building the `<EnterpriseGate>` component on top of a non-existent EE feature. Gate ships first; EE features that use it ship in Plan 04.

## How to execute a sub-plan

When you're ready to start one:

1. Tell me which sub-plan number (e.g., "Start Plan 02-01 — AuthDriver").
2. I'll fetch the latest `main` from `Acumenus-Data-Sciences/Parthenon` to ground the plan in current repo state.
3. I'll write the detailed sub-plan (`docs/superpowers/plans/2026-05-XX-ce-ee-fork-plan-02-NN-<feature>.md`) with full TDD tasks.
4. We'll execute via the executing-plans skill (inline).

Plan 02-01 (AuthDriver) is written and ready. See [2026-05-08-ce-ee-fork-plan-02-01-auth-driver.md](2026-05-08-ce-ee-fork-plan-02-01-auth-driver.md).

---

*End of Plan 02 umbrella.*
