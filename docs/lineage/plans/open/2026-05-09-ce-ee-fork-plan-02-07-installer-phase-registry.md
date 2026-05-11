# CE/EE Fork — Plan 02-07: Acropolis Installer Phase Registry

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. See [Plan 02-01](2026-05-08-ce-ee-fork-plan-02-01-auth-driver.md) for the canonical TDD pattern.

**Goal:** Refactor the Acropolis installer (`acropolis/installer/cli.py`) from its current hardcoded phase sequence into a discoverable phase registry. CE registers community phases (preflight, edition, network, deploy, traefik, verify). EE plugs in enterprise phases (FIPS bootstrap, multi-tenant init, Keycloak setup, signed audit shipper config) via the same registration mechanism — without patching CE's `cli.py`.

**Architecture:** Plugin discovery pattern. Each phase becomes a `Phase` subclass with metadata (id, order, edition_filter, depends_on) and a `run(config: InstallConfig) -> Result` method. CE phases live under `acropolis/installer/phases/community/`. The CLI imports a `PhaseRegistry`, which auto-discovers via entry points (or a fallback module scan), filters by edition/CLI flags, and topologically sorts by `depends_on`. EE phases live in `enterprise/installer/phases/enterprise/` and are registered via setuptools entry points or a startup-time import in EE's `cli.py` wrapper.

**Tech Stack:** Python 3.12, dataclasses, importlib, questionary, rich, pytest.

**Spec reference:** Spec §5 row 7.

**Umbrella:** [Plan 02 umbrella](2026-05-08-ce-ee-fork-plan-02-extension-points-umbrella.md).

**Prerequisites:** Plan 01 merged. Independent of 02-01..02-06.

---

## File structure

**Refactor (existing files):**

| Path | What changes |
|---|---|
| `acropolis/installer/cli.py` | Replace hardcoded sequence with `PhaseRegistry.run_all(config)` call. ~80 LOC removed, ~30 LOC added. |
| `acropolis/installer/preflight.py`, `discovery.py`, `network.py`, `deploy.py`, `traefik.py`, `verify.py` (and a few others) | Wrap each existing top-level function in a `Phase` subclass. Functions stay the same; the wrapping is mechanical. |

**New files:**

| Path | Purpose | LOC |
|---|---|---|
| `acropolis/installer/phases/__init__.py` | Package init | 5 |
| `acropolis/installer/phases/base.py` | `Phase` ABC + `Result` dataclass + `PhaseError` | ~80 |
| `acropolis/installer/phases/registry.py` | `PhaseRegistry` — discovery, ordering, filtering, run | ~150 |
| `acropolis/installer/phases/community/__init__.py` | Imports each phase to trigger registration | 20 |
| `acropolis/installer/phases/community/preflight.py` | Existing `preflight.run(...)` wrapped as `PreflightPhase` | ~40 |
| `acropolis/installer/phases/community/discovery.py` | `DiscoveryPhase` | ~40 |
| `acropolis/installer/phases/community/edition.py` | `EditionSelectionPhase` | ~40 |
| `acropolis/installer/phases/community/parthenon_install.py` | `ParthenonInstallPhase` (Phase 5.5 today) | ~40 |
| `acropolis/installer/phases/community/network.py` | `NetworkSetupPhase` | ~40 |
| `acropolis/installer/phases/community/deploy.py` | `DeployPhase` | ~40 |
| `acropolis/installer/phases/community/traefik.py` | `TraefikPhase` | ~40 |
| `acropolis/installer/phases/community/verify.py` | `VerifyPhase` | ~40 |
| `acropolis/installer/phases/community/configuration.py` | `ConfigurationPhase` | ~40 |
| `acropolis/tests/test_phase_registry.py` | Registry tests | ~150 |
| `acropolis/tests/test_phases_smoke.py` | Smoke: each phase importable, has metadata | ~80 |
| `acropolis/tests/fixtures/StubFipsBootstrapPhase.py` | Pluggability fixture | ~50 |
| `docs/architecture/extension-points/installer-phase-registry.md` | Detail doc | ~250 |

**Modified:**
- `pyproject.toml` (root) — add entry-points group `parthenon.acropolis.phases` for EE auto-discovery
- `docs/architecture/extension-points.md` — mark row 7 done

---

## Task 1: Phase ABC + Result type

```python
# acropolis/installer/phases/base.py
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class PhaseResult:
    """Outcome of running a phase."""
    phase_id: str
    success: bool
    skipped: bool = False
    duration_s: float = 0.0
    message: str = ""
    diagnostics: dict[str, Any] = field(default_factory=dict)
    # R7: non-fatal issues. Phase still considered successful, but warnings
    # are surfaced to the operator. EE phases like signed_audit_setup or
    # observability shippers use this to report "primary action OK, optional
    # verification (test ship) failed; please check after install."
    warnings: list[str] = field(default_factory=list)


class PhaseError(RuntimeError):
    """Raised when a phase fails fatally and cannot be retried."""
    def __init__(self, phase_id: str, message: str, diagnostics: dict[str, Any] | None = None):
        super().__init__(f"[{phase_id}] {message}")
        self.phase_id = phase_id
        self.diagnostics = diagnostics or {}


class Phase(ABC):
    """Acropolis installer phase. Subclasses define metadata + run()."""

    #: Stable identifier (e.g. 'community.preflight'). EE phases use 'enterprise.<name>'.
    id: str = ""

    #: Sort order within the same edition. Lower runs first. CE phases use 100..1000.
    order: int = 0

    #: Editions this phase applies to. Empty list = all editions.
    editions: list[str] = []

    #: Phase IDs this phase depends on. Registry topologically sorts.
    depends_on: list[str] = []

    #: Whether running this phase requires the user to have selected the EE tier.
    requires_enterprise: bool = False

    @abstractmethod
    def run(self, config: Any) -> PhaseResult: ...

    def is_applicable(self, edition: str) -> bool:
        if self.requires_enterprise and edition != "enterprise":
            return False
        if not self.editions:
            return True
        return edition in self.editions
```

---

## Task 2: PhaseRegistry — discovery, ordering, filtering, run

```python
# acropolis/installer/phases/registry.py
from __future__ import annotations
import importlib
import importlib.metadata
import time
from typing import Any
from rich.console import Console

from acropolis.installer.phases.base import Phase, PhaseResult, PhaseError


class PhaseRegistry:
    """Discovers, orders, and runs Acropolis installer phases.

    Discovery sources (in order):
      1. Built-in CE phases (acropolis.installer.phases.community.*)
      2. Setuptools entry points group 'parthenon.acropolis.phases'
         (EE phases register here via Parthenon-EE's setup.cfg)
      3. Plugins listed in config (rare; for ad-hoc development)
    """

    def __init__(self) -> None:
        self._phases: list[Phase] = []
        self._console = Console()

    def register(self, phase: Phase) -> None:
        if any(p.id == phase.id for p in self._phases):
            raise ValueError(f"Phase id '{phase.id}' already registered")
        self._phases.append(phase)

    def discover(self) -> None:
        # 1. CE built-ins (importing the package triggers @register decorators or module-level register() calls).
        importlib.import_module("acropolis.installer.phases.community")
        # 2. Entry points (EE installs add itself here)
        for ep in importlib.metadata.entry_points(group="parthenon.acropolis.phases"):
            try:
                phase_cls = ep.load()
                self.register(phase_cls())
            except Exception as e:
                self._console.print(f"[yellow]warn:[/] failed to load phase '{ep.name}': {e}")

    def sorted_phases(self, edition: str, *, include_skipped: bool = False) -> list[Phase]:
        """Topologically sort phases by depends_on, breaking ties by order."""
        applicable = [p for p in self._phases if p.is_applicable(edition) or include_skipped]
        # Kahn's algorithm
        indeg = {p.id: 0 for p in applicable}
        graph: dict[str, list[str]] = {p.id: [] for p in applicable}
        for p in applicable:
            for dep in p.depends_on:
                if dep not in indeg:
                    raise PhaseError(p.id, f"depends_on '{dep}' is not registered or not applicable")
                graph[dep].append(p.id)
                indeg[p.id] += 1
        # Order ties broken by .order then .id
        by_id = {p.id: p for p in applicable}
        ready = sorted([pid for pid, d in indeg.items() if d == 0],
                       key=lambda pid: (by_id[pid].order, pid))
        result: list[Phase] = []
        while ready:
            pid = ready.pop(0)
            result.append(by_id[pid])
            for child in graph[pid]:
                indeg[child] -= 1
                if indeg[child] == 0:
                    ready.append(child)
            ready.sort(key=lambda pid: (by_id[pid].order, pid))
        if len(result) != len(applicable):
            cycle = [pid for pid, d in indeg.items() if d > 0]
            raise PhaseError("registry", f"depends_on cycle detected among: {cycle}")
        return result

    def run_all(self, config: Any, edition: str) -> list[PhaseResult]:
        results: list[PhaseResult] = []
        for phase in self.sorted_phases(edition):
            self._console.rule(f"[bold cyan]{phase.id}[/]")
            t0 = time.time()
            try:
                r = phase.run(config)
                r.duration_s = time.time() - t0
                results.append(r)
                if not r.success:
                    raise PhaseError(phase.id, r.message, r.diagnostics)
            except PhaseError:
                raise
            except Exception as e:
                raise PhaseError(phase.id, f"unhandled exception: {e}") from e
        return results
```

---

## Task 3: TDD — Registry tests

```python
# acropolis/tests/test_phase_registry.py
from acropolis.installer.phases.base import Phase, PhaseResult, PhaseError
from acropolis.installer.phases.registry import PhaseRegistry


class StubA(Phase):
    id, order = "stub.a", 100
    def run(self, cfg) -> PhaseResult: return PhaseResult(self.id, True)


class StubB(Phase):
    id, order, depends_on = "stub.b", 200, ["stub.a"]
    def run(self, cfg) -> PhaseResult: return PhaseResult(self.id, True)


class StubEEOnly(Phase):
    id, order, requires_enterprise = "ee.only", 500, True
    def run(self, cfg) -> PhaseResult: return PhaseResult(self.id, True)


def test_register_and_list():
    reg = PhaseRegistry()
    reg.register(StubA()); reg.register(StubB())
    assert {p.id for p in reg.sorted_phases("community")} == {"stub.a", "stub.b"}


def test_topological_order_respected():
    reg = PhaseRegistry()
    reg.register(StubB()); reg.register(StubA())
    sorted_ids = [p.id for p in reg.sorted_phases("community")]
    assert sorted_ids.index("stub.a") < sorted_ids.index("stub.b")


def test_ee_only_phase_excluded_in_community():
    reg = PhaseRegistry()
    reg.register(StubA()); reg.register(StubEEOnly())
    ids = [p.id for p in reg.sorted_phases("community")]
    assert "ee.only" not in ids


def test_ee_only_phase_included_in_enterprise():
    reg = PhaseRegistry()
    reg.register(StubA()); reg.register(StubEEOnly())
    ids = [p.id for p in reg.sorted_phases("enterprise")]
    assert "ee.only" in ids


def test_duplicate_id_raises():
    reg = PhaseRegistry()
    reg.register(StubA())
    import pytest
    with pytest.raises(ValueError, match="already registered"):
        reg.register(StubA())


def test_cycle_detection():
    class C1(Phase):
        id, depends_on = "c.1", ["c.2"]
        def run(self, cfg): return PhaseResult(self.id, True)
    class C2(Phase):
        id, depends_on = "c.2", ["c.1"]
        def run(self, cfg): return PhaseResult(self.id, True)
    reg = PhaseRegistry()
    reg.register(C1()); reg.register(C2())
    import pytest
    with pytest.raises(PhaseError, match="cycle"):
        reg.sorted_phases("community")


def test_run_all_executes_phases_in_order():
    reg = PhaseRegistry()
    log: list[str] = []
    class P1(Phase):
        id, order = "p.1", 100
        def run(self, cfg): log.append(self.id); return PhaseResult(self.id, True)
    class P2(Phase):
        id, order, depends_on = "p.2", 200, ["p.1"]
        def run(self, cfg): log.append(self.id); return PhaseResult(self.id, True)
    reg.register(P2()); reg.register(P1())
    reg.run_all(config={}, edition="community")
    assert log == ["p.1", "p.2"]


def test_run_all_aborts_on_failure():
    reg = PhaseRegistry()
    class Bad(Phase):
        id = "bad"
        def run(self, cfg): return PhaseResult(self.id, False, message="boom")
    reg.register(Bad())
    import pytest
    with pytest.raises(PhaseError, match="boom"):
        reg.run_all({}, "community")
```

---

## Task 4: Wrap existing CE phases

Each existing top-level installer module gets a thin `*Phase` subclass that delegates to its current entry function. Pattern:

```python
# acropolis/installer/phases/community/preflight.py
from acropolis.installer.phases.base import Phase, PhaseResult
from acropolis.installer.preflight import run as _run_preflight  # existing


class PreflightPhase(Phase):
    id = "community.preflight"
    order = 100
    editions = ["community", "enterprise"]

    def run(self, config) -> PhaseResult:
        ok, diagnostics = _run_preflight(config)
        return PhaseResult(self.id, ok, message="" if ok else "preflight checks failed", diagnostics=diagnostics)
```

The `__init__.py` registers them:

```python
# acropolis/installer/phases/community/__init__.py
"""Auto-register all CE phases on import."""
from .preflight import PreflightPhase
from .discovery import DiscoveryPhase
from .edition import EditionSelectionPhase
from .configuration import ConfigurationPhase
from .parthenon_install import ParthenonInstallPhase
from .network import NetworkSetupPhase
from .deploy import DeployPhase
from .traefik import TraefikPhase
from .verify import VerifyPhase

__all_phases__ = [
    PreflightPhase, DiscoveryPhase, EditionSelectionPhase,
    ConfigurationPhase, ParthenonInstallPhase, NetworkSetupPhase,
    DeployPhase, TraefikPhase, VerifyPhase,
]


def register_into(registry) -> None:
    for cls in __all_phases__:
        registry.register(cls())
```

Then in `cli.py`:

```python
from acropolis.installer.phases.registry import PhaseRegistry
from acropolis.installer.phases.community import register_into as register_community_phases

def main() -> None:
    config = ...  # existing config-build
    reg = PhaseRegistry()
    register_community_phases(reg)
    reg.discover()  # picks up EE entry points
    reg.run_all(config, edition=config.tier)
```

---

## Task 5: pyproject.toml entry-points

Add to root `pyproject.toml` (or wherever Acropolis declares its package metadata) the entry-points group definition documentation:

```toml
# Documentation only — CE doesn't ship any EE phases. EE's setup.cfg adds:
#   [project.entry-points."parthenon.acropolis.phases"]
#   fips_bootstrap = "enterprise.installer.phases.fips:FipsBootstrapPhase"
#   multi_tenant_init = "enterprise.installer.phases.multi_tenant:MultiTenantInitPhase"
#   keycloak_setup = "enterprise.installer.phases.keycloak:KeycloakSetupPhase"
```

---

## Task 6: Pluggability proof — StubFipsBootstrapPhase

```python
# acropolis/tests/fixtures/StubFipsBootstrapPhase.py
from acropolis.installer.phases.base import Phase, PhaseResult


class StubFipsBootstrapPhase(Phase):
    id = "stub.enterprise.fips_bootstrap"
    order = 350
    requires_enterprise = True
    depends_on = ["community.preflight"]

    def run(self, config) -> PhaseResult:
        return PhaseResult(self.id, True, message="FIPS provider stub OK")
```

```python
def test_runtime_registered_ee_phase_runs_in_enterprise_mode():
    from acropolis.installer.phases.registry import PhaseRegistry
    from acropolis.tests.fixtures.StubFipsBootstrapPhase import StubFipsBootstrapPhase
    from acropolis.installer.phases.community import register_into

    reg = PhaseRegistry()
    register_into(reg)
    reg.register(StubFipsBootstrapPhase())

    ids = [p.id for p in reg.sorted_phases("enterprise")]
    assert "stub.enterprise.fips_bootstrap" in ids
    # And it appears AFTER preflight per depends_on
    assert ids.index("community.preflight") < ids.index("stub.enterprise.fips_bootstrap")
```

---

## Task 7: Smoke + behavior preservation

The refactor preserves behavior. Verify with an end-to-end smoke:

```bash
# In a clean Docker host (or VM):
python3 install.py --with-infrastructure --tier=community
# Expect: same phase progression as before, identical timings, identical exit state.
```

If you don't have a clean VM handy, the next-best smoke is a dry-run check that the `cli.main()` imports and registers all phases without errors:

```python
def test_cli_registers_all_phases_without_errors():
    from acropolis.installer.phases.registry import PhaseRegistry
    from acropolis.installer.phases.community import register_into
    reg = PhaseRegistry()
    register_into(reg)
    expected = [
        "community.preflight",
        "community.discovery",
        "community.edition",
        "community.configuration",
        "community.parthenon_install",
        "community.network",
        "community.deploy",
        "community.traefik",
        "community.verify",
    ]
    actual = [p.id for p in reg.sorted_phases("community")]
    assert actual == expected
```

---

## Task 8: Documentation + PR

- [ ] Doc page covers: Phase ABC, registry discovery model, dependency declaration, edition filtering, EE entry-point registration, examples.
- [ ] PR title: "feat(installer): Acropolis phase registry (Phase 2 #7 of 8)"

---

## Plan 02-07 completion checklist

- [ ] `Phase` ABC + `PhaseResult` + `PhaseError` defined
- [ ] `PhaseRegistry` with topological sort + edition filter + entry-point discovery
- [ ] All 9 existing CE installer steps wrapped as Phase subclasses
- [ ] `cli.py` refactored to use `PhaseRegistry.run_all(...)` (≤30 LOC)
- [ ] Existing `python3 install.py --with-infrastructure` works unchanged
- [ ] Pytest suite covers registry + sort + cycle detection + EE filtering
- [ ] StubFipsBootstrapPhase proves pluggability via runtime registration
- [ ] Doc page published
- [ ] PR merged

## Out of scope

- EE phases themselves (FIPS bootstrap, multi-tenant init, Keycloak setup) — Plan 04
- Phase resumability (skip-completed-on-rerun) — separate plan
- Parallel phase execution — out of scope (installer is sequential by design)
- Web UI for phase progress — separate plan

*End of Plan 02-07.*
