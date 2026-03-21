# VM Integration Test Report — Unified Installer

**Date:** 2026-03-21
**Tester:** Claude Opus 4.6 (test agent)
**VM:** 192.168.1.48 (Ubuntu 24.04 LTS, 4 cores, 16GB RAM, 126GB disk)
**Branch:** `feature/unified-installer`
**Parthenon:** v1.0.2 (shallow clone, core services only)

---

## Tests Executed

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | Unit tests (local) | **PASS** | 50/50 in 0.06s |
| 2 | Community tier, standalone | **PASS** | 3/3 services healthy after Bug #1 and #2 fixed |
| 3 | Community tier, local Parthenon | **PASS** | 6/6 services healthy after Bug #3 fixed |
| 4 | Resume-on-failure | **PASS** | State persists phases 1-3, resumes at phase 4 |
| 5 | Generated `acropolis.sh` | **PASS** | All commands verified: status, urls, up, down, backup, update, help |
| 6 | Traefik→Parthenon routing | **PASS** | Grafana and Prometheus reachable from inside Traefik container via Docker DNS |
| — | Enterprise tier | **NOT TESTED** | Needs license key infrastructure |
| — | Remote topology | **NOT TESTED** | Needs second host |

---

## Bug #1: `is_port_free()` false positive on privileged ports

**File:** `installer/utils.py:76-83`
**Severity:** CRITICAL — blocks installation on any Linux system where the installer runs as non-root
**Symptom:** Preflight reports ports 80, 443 as "in use" when they are actually free

**Root cause:** The function uses `socket.bind(("127.0.0.1", port))` to test port availability. On Linux, binding to ports < 1024 requires `CAP_NET_BIND_SERVICE` (typically root). When run as a normal user, `bind()` raises `PermissionError` (a subclass of `OSError`), which the blanket `except OSError` catch treats as "port in use."

**Before:**
```python
def is_port_free(port: int) -> bool:
    """Check if a TCP port is available on localhost."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", port))
            return True
    except OSError:
        return False
```

**After:**
```python
def is_port_free(port: int) -> bool:
    """Check if a TCP port is available on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        result = s.connect_ex(("127.0.0.1", port))
        # connect_ex returns 0 if connection succeeded (port in use)
        return result != 0
```

**Why `connect_ex` is correct:** It checks whether something is *listening* on the port (which doesn't require privileges), rather than trying to *bind* (which does). Returns 0 if a connection was established (port in use), non-zero otherwise (port free).

---

## Bug #2: Standalone mode fails — missing `parthenon` external network

**File:** `installer/network.py` (Phase 6) and `docker-compose.yml`
**Severity:** CRITICAL — `docker compose up` fails in standalone mode
**Symptom:** `network parthenon declared as external, but could not be found`

**Root cause:** `docker-compose.yml` declares the `parthenon` network as `external: true`:

```yaml
networks:
  parthenon:
    external: true
    name: parthenon
```

In standalone mode (no Parthenon), this network does not exist. Phase 6 (`setup_network`) created `acropolis_network` but never created the `parthenon` network. When Phase 7 runs `docker compose up -d`, compose fails because it can't find the external network.

**Fix:** Phase 6 must **always** ensure a network named `parthenon` exists, regardless of topology mode. This is a compose infrastructure requirement, not a Parthenon connectivity requirement.

**Added to `installer/network.py` after acropolis_network creation:**
```python
# docker-compose.yml declares 'parthenon' as external (name: parthenon).
# This network MUST exist or docker compose up will fail.
COMPOSE_PARTHENON_NETWORK = "parthenon"
if not network_exists(COMPOSE_PARTHENON_NETWORK):
    console.print(f"[cyan]Creating network: {COMPOSE_PARTHENON_NETWORK}[/]")
    if not create_network(COMPOSE_PARTHENON_NETWORK):
        raise RuntimeError(f"Could not create Docker network {COMPOSE_PARTHENON_NETWORK}")
    console.print(f"[green]Network {COMPOSE_PARTHENON_NETWORK} created.[/]")
else:
    console.print(f"[green]Network {COMPOSE_PARTHENON_NETWORK} already exists.[/]")
```

---

## Bug #3: Network detection fails to find Parthenon containers

**File:** `installer/topology.py:43-47` (`_detect_local_parthenon`)
**Severity:** HIGH — service discovery finds 0 containers when Parthenon is running
**Symptom:** "Found Parthenon network with 0 containers" even though 7+ Parthenon containers are running

**Root cause:** Docker Compose creates networks with the project name as prefix. Parthenon's compose file creates a network named `parthenon` in its config, but compose prefixes it with the project name, resulting in `parthenon_parthenon` (project `parthenon` + network `parthenon`).

The detection function only checked for `parthenon`:

```python
def _detect_local_parthenon() -> Optional[str]:
    if network_exists("parthenon"):
        return "parthenon"
    return None
```

This found the empty `parthenon` network (created by Bug #2 fix) instead of `parthenon_parthenon` (where the actual containers live).

**Fix:** Check multiple candidate network names, preferring networks that actually contain Parthenon containers:

```python
def _detect_local_parthenon() -> Optional[str]:
    candidates = ("parthenon_parthenon", "parthenon_default", "parthenon")
    found_empty: Optional[str] = None
    for name in candidates:
        if network_exists(name):
            containers = containers_on_network(name)
            parthenon_containers = [c for c in containers if c.startswith("parthenon-")]
            if parthenon_containers:
                return name
            if found_empty is None:
                found_empty = name
    return found_empty
```

**Key insight:** The order matters — check `parthenon_parthenon` first (compose-prefixed, most common), and prefer networks with actual `parthenon-*` containers over empty ones.

**Warning about false confidence:** The first test of Bug #3 appeared to pass because the `parthenon` network from the Bug #2 fix was still present from a previous run. The test was passing by coincidence, not correctness. Always test from a clean state (no leftover networks).

---

## Additional Observations (Not Bugs — Installer Agent FYI)

### PEP 668 on Ubuntu 24.04

`install.py`'s `ensure_dependencies()` runs `pip install` system-wide, which fails on Ubuntu 24.04 with "externally-managed-environment." Users must create a venv first. Consider:
- Documenting the venv requirement prominently
- Or having `install.py` auto-create a venv if system pip is blocked

### `docker` group requires re-login

After `usermod -aG docker $USER`, the group isn't active until the user logs out and back in (or uses `newgrp docker` / `sg docker`). The preflight `check_docker_group()` passes, but actual docker commands may still need sudo. Consider noting this in preflight output.

### Traefik TLS on private IPs

The static `traefik.yml` enforces HTTP→HTTPS redirect and uses `certResolver: letsencrypt`. On private/local networks where Let's Encrypt can't validate, all subdomain routing returns 404 (no valid cert). When the installer's TLS mode is set to `none`, the generated `.env` should reflect this, and ideally the `traefik.yml` should be dynamically generated (or use a template) to disable the redirect and cert resolver.

### Parthenon service registry gaps

The curated registry in `discovery.py` lists `parthenon-nginx` but not `parthenon-php`, `parthenon-postgres`, `parthenon-redis`, or `parthenon-loki`. During testing with a real Parthenon, these showed up as "Unknown containers." Consider either:
- Adding them to the registry with `expose: False` (internal services, not routable)
- Or documenting that unknown containers are expected for non-routable services

---

## Files Modified During Testing

All changes are on the local machine, synced to VM via rsync.

| File | Change |
|------|--------|
| `installer/utils.py` | `is_port_free()`: `socket.bind` → `socket.connect_ex` |
| `installer/network.py` | Phase 6: always create `parthenon` network for compose |
| `installer/topology.py` | `_detect_local_parthenon()`: check multiple network names, prefer populated |

All 50 unit tests continue to pass after these changes.
