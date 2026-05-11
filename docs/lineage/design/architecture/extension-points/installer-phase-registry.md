---
doc_type: spec
status: historical
date: 2026-05-09
owner: acumenus
module: extension-points
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - acropolis/installer/phases
related_prs: []
---
# Extension Point: Acropolis Installer Phase Registry

**Backend (Python):** `acropolis.installer.phases`
**Phase ABC:** `acropolis.installer.phases.base.Phase`
**Result type:** `acropolis.installer.phases.base.PhaseResult`
**Error type:** `acropolis.installer.phases.base.PhaseError`
**Context object:** `acropolis.installer.phases.base.InstallerContext`
**Registry:** `acropolis.installer.phases.registry.PhaseRegistry`
**CE phases:** `acropolis.installer.phases.community.*`
**Entry-point group (EE):** `parthenon.acropolis.phases`
**Status:** Live since [Phase 2 #7](../../../plans/closed/2026-05-09-ce-ee-fork-plan-02-07-installer-phase-registry.md)

## Purpose

Decouple the Acropolis installer's flow from a hardcoded sequence of inline `if not state.is_completed(N)` blocks. Each step is now a `Phase` subclass with declarative metadata (`id`, `order`, `depends_on`, `requires_enterprise`, `legacy_state_id`). The CLI builds a registry, lets EE register additional phases via setuptools entry points, topologically sorts, and runs everything in order.

CE preserves byte-for-byte behavior — the legacy `.install-state.json` contract is intact (each CE phase carries the same numeric `legacy_state_id` it had before), so an installer interrupted mid-flow on the previous code base still resumes correctly after this refactor.

EE plugs in by:

1. Implementing `Phase` for each enterprise-only step (`FipsBootstrapPhase`, `MultiTenantInitPhase`, `KeycloakSetupPhase`, `SignedAuditSetupPhase`, ...).
2. Declaring entry points in EE's `pyproject.toml`:
   ```toml
   [project.entry-points."parthenon.acropolis.phases"]
   fips_bootstrap = "enterprise.installer.phases.fips:FipsBootstrapPhase"
   multi_tenant_init = "enterprise.installer.phases.multi_tenant:MultiTenantInitPhase"
   keycloak_setup = "enterprise.installer.phases.keycloak:KeycloakSetupPhase"
   ```
3. Setting `requires_enterprise=True` so CE deployments skip the phase even if the EE bundle is on the install path.

## Architecture

```
                  ┌─────── PhaseRegistry ───────┐
                  │  (one instance per run)     │
   register_into  │                             │  discover_entry_points()
   (CE phases) ──▶│  ordered list of Phases     │◀── EE entry points
                  │                             │
                  │  topological sort           │
                  │   tied by .order, .id       │
                  │                             │
                  │  filter by edition          │
                  │   skip requires_enterprise  │
                  │   in community installs     │
                  │                             │
                  └─────────────┬───────────────┘
                                │
                                ▼
                  ┌─────── run_all(ctx, edition) ──────┐
                  │  for phase in sorted_phases:       │
                  │    phase.run(ctx)  ── mutates ctx  │
                  │  on PhaseError → halt + report     │
                  └────────────────────────────────────┘
```

`InstallerContext` is the mutable bag every phase reads & writes — replaces the implicit local-variable bag the inline `cli.run()` flow used.

## Phase contract

```python
class Phase(ABC):
    id: str = ""                       # 'community.preflight', 'enterprise.fips_bootstrap'
    order: int = 0                     # tie-breaker within depends_on cohort
    editions: list[str] = []           # empty = all editions
    depends_on: list[str] = []         # other phase ids
    requires_enterprise: bool = False
    legacy_state_id: int | None = None # for resume from old .install-state.json

    @abstractmethod
    def run(self, ctx: InstallerContext) -> PhaseResult: ...
```

### Resume contract (`legacy_state_id`)

CE phases keep the same integer they had in the legacy state machine:

| Phase | legacy_state_id |
|-------|-----------------|
| `community.preflight` | 1 |
| `community.topology` | 2 |
| `community.edition` | 3 |
| `community.discovery` | 4 |
| `community.configuration` | 5 |
| `community.parthenon_install` | None (intentionally unnumbered) |
| `community.network` | 6 |
| `community.deploy` | 7 |
| `community.traefik` | 8 |
| `community.verify` | 9 |

When a phase finds its `legacy_state_id` in `state.completed_phases`, its `run()` re-hydrates derived data from `state.data` and returns `PhaseResult(success=True, skipped=True)`. The registry treats this as a successful no-op and proceeds.

EE phases that don't predate this refactor leave `legacy_state_id=None` and write their own resume markers in `state.data`.

### Best-effort discovery

`PhaseRegistry.discover_entry_points()` is defensive — a single misbehaving EE plugin can't take the installer down. Failed entry-point loads emit a warning to the registry's console and discovery continues.

## CE phase wiring

`acropolis/installer/phases/community/__init__.py` imports each phase class and exposes `register_into(registry)`:

```python
from acropolis.installer.phases import PhaseRegistry
from acropolis.installer.phases.community import register_into

registry = PhaseRegistry()
register_into(registry)
registry.discover_entry_points()  # adds EE phases if installed
```

`acropolis.installer.cli.build_registry()` does the above and is the public helper EE wrappers / tests use.

## Pluggability proof

`acropolis/tests/test_phase_registry.py::test_pluggability_proof_stub_fips_phase_runs_when_registered_at_runtime` is the headline test. It:

1. Builds a registry pre-populated with all 10 CE phases.
2. Registers `StubFipsBootstrapPhase` (a synthetic EE-shaped phase: `requires_enterprise=True`, `depends_on=['community.preflight']`, `order=350`).
3. Calls `sorted_phases('enterprise')` and verifies the stub appears in order, after `community.preflight`, before any phase whose `order > 350`.

The test passes without a single line of CE code modified — that's the contract.

`test_phases_smoke.py` verifies the canonical CE phase list resolves to the expected order, every CE phase has correct metadata, and `build_registry()` includes all CE phases.

## EE phase sketches

```python
# enterprise/installer/phases/fips.py
from acropolis.installer.phases.base import InstallerContext, Phase, PhaseResult

class FipsBootstrapPhase(Phase):
    id = "enterprise.fips_bootstrap"
    order = 350                              # Between configuration (500) and parthenon_install (550)
    requires_enterprise = True
    depends_on = ["community.configuration"]

    def run(self, ctx: InstallerContext) -> PhaseResult:
        # Validate FIPS-validated openssl, install crypto provider, etc.
        ...
        return PhaseResult(self.id, success=True)
```

```toml
# enterprise/pyproject.toml
[project.entry-points."parthenon.acropolis.phases"]
fips_bootstrap = "enterprise.installer.phases.fips:FipsBootstrapPhase"
```

CE installer scans the entry-point group on every run; if EE is installed, the phase appears automatically.

## Out of scope

- **Per-phase parallel execution** — the installer is sequential by design (Docker network changes affect downstream services).
- **Phase resumability inside a single phase** — phases are atomic units of work; a partially-complete phase re-runs from the start on resume.
- **Web UI for phase progress** — operators see `rich.console` rules + status; a UI shell is a separate plan.
- **EE phase implementations** (FIPS, multi-tenant init, Keycloak setup, signed audit shipper config) — Plan 04.

## Anti-patterns

- ❌ Don't read or mutate `state.data` outside of phases. Every state read/write goes through the phase.
- ❌ Don't introduce hidden dependencies between phases through global module-level state. Use `InstallerContext` fields.
- ❌ Don't raise plain `RuntimeError` from a phase — wrap in `PhaseError(phase_id, ...)` so the registry can attribute the failure correctly.
- ❌ Don't skip the legacy resume contract on a CE phase. Old installations in the field have `.install-state.json` files keyed by integer phase id; preserving `legacy_state_id` is what keeps them resumable.
