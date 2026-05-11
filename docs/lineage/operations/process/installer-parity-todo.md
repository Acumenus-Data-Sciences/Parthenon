# Installer Parity TODO

**Date:** 2026-04-18
**Goal:** Keep the Python CLI, browser installer, Rust/Tauri shell, and public
source bootstrap coordinated around the same Parthenon Community install
contract.

## Source of Truth

- [x] Keep `install.py` and `installer.cli` as the only real install engine.
- [x] Expose Python-normalized Community defaults as machine-readable JSON.
- [x] Expose selected Compose services, health checks, ports, datasets, and
      module groups as an installer contract.
- [x] Make the browser installer consume Python-normalized Community defaults
      and service planning.
- [x] Make the Rust GUI consume the Python contract for defaults, dry-run
      preview, and real-install defaults JSON.
- [x] Make the Rust GUI delegate preflight/validation to the Python contract.
- [ ] Treat any future duplicated install defaults in JavaScript or Rust as
      test failures.

## Local Gates

- [x] Python installer tests: `python3 -m pytest installer/tests tests/installer`
- [x] Rust GUI format: `cargo fmt --check`
- [x] Rust GUI unit tests: `cargo test`
- [x] Rust GUI lint: `cargo clippy --all-targets -- -D warnings`
- [x] Bootstrap script parity: `sh -n installer/install.sh frontend/public/install.sh`
- [x] Bootstrap copy parity: `cmp installer/install.sh frontend/public/install.sh`

## Install Smoke Tests

- [ ] Ubuntu 22.04/24.04 Docker Engine fresh install with
      `install.py --community`.
- [ ] Source bootstrap fresh install with
      `curl -fsSL https://parthenon.acumenus.net/install.sh | sh -s -- --cli -- --community`.
- [ ] Browser installer Express path dry run and one Linux real install.
- [ ] macOS Docker Desktop fresh install.
- [ ] Windows WSL 2 fresh install with Docker Desktop WSL integration.
- [x] Rust GUI dry run in CI.
- [x] Linux `.deb`, `.rpm`, and `.AppImage` artifacts build locally.
- [x] Linux release binary and AppImage start under a virtual X display.
- [x] GitHub Actions workflow builds Linux, macOS, and Windows Rust GUI artifacts.
- [ ] Rust GUI real install after defaults, validation, and preflight all use
      the Python contract.

## Acceptance Checks

- [ ] Selected Docker services become healthy.
- [ ] `http://localhost:8082` serves the React login page.
- [ ] `/api/v1/sources` returns the expected unauthenticated response before login.
- [ ] `.install-credentials` exists and contains admin credentials.
- [ ] Admin login succeeds.
- [ ] Eunomia source exists when selected.
- [ ] Phenotype Library load completes or reports a clear skipped state.
- [ ] Solr ping/index checks pass when enabled.
- [ ] Hecate/Qdrant health and search checks pass when enabled.
- [ ] Failed installs resume from `.install-state.json` without redoing completed phases.

## Release Rule

- [ ] Keep native installer assets, package-manager manifests, and checksums off
      GitHub releases until they are signed, reproducible, and covered by the
      smoke tests above.
