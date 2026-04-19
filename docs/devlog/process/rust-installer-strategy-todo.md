# Rust Installer Strategy TODO

**Date:** 2026-04-18
**Goal:** Make the Rust/Tauri installer a dependable double-click Community
installer without creating an untested second install engine.

## Strategy Decision

- [x] Keep the Python installer as the installation source of truth for now.
- [x] Use Rust/Tauri for native desktop UX, platform-specific launch flow,
      progress streaming, and bundled app distribution.
- [x] Use the Python installer contract for defaults, service planning,
      validation, and preflight wherever the Rust app needs installer truth.
- [ ] Revisit a native Rust install engine only after the install contract,
      phase state model, smoke tests, and rollback/resume semantics are stable.

## Native Rust Port Assessment

- [x] Confirm feasibility: a full Rust installer is possible.
- [x] Confirm recommendation: do not port the full installer to native Rust yet.
- [ ] If revisited, define a manifest-first installer model before porting:
      config schema, phases, idempotency keys, Docker Compose service plan,
      health checks, credentials handling, resume/rollback behavior, and OS
      adapters.
- [ ] Require feature parity proof before any Rust-native engine replaces
      `install.py`.

## Double-Click App Parity

- [x] Rust preview uses Python-normalized Community defaults.
- [x] Rust dry run uses Python-normalized redacted defaults.
- [x] Rust real install writes Python-normalized defaults before launching
      `install.py`.
- [x] Rust preflight delegates to the Python contract.
- [x] Rust validation delegates to the Python contract.
- [x] Rust UI can surface Python contract failures clearly.
- [x] Rust bundle includes the current Acropolis icon assets.
- [x] Rust UI uses a guided configure, check, install, done flow instead of
      exposing defaults JSON.

## Packaging Gates

- [x] Linux `.deb`, `.rpm`, and `.AppImage` artifacts build locally.
- [x] Linux release binary starts under a virtual X display.
- [x] Linux AppImage starts under a virtual X display.
- [x] GitHub Actions workflow builds Linux, macOS, and Windows Tauri artifacts.
- [ ] Linux bundled app launches from file manager.
- [ ] macOS `.app` launches with Docker Desktop installed.
- [ ] Windows app launches and runs WSL-backed contract preflight.
- [ ] Windows app launches installer through WSL with Docker Desktop WSL
      integration enabled.
- [ ] Bundles are signed/notarized where required.
- [x] CI includes Rust GUI dry-run smoke coverage.

## Real Install Gates

- [ ] Ubuntu 22.04/24.04 Community install completes from Rust app.
- [ ] macOS Community install completes from Rust app.
- [ ] Windows WSL 2 Community install completes from Rust app.
- [ ] Failed Rust-launched installs resume through `.install-state.json`.
- [ ] Generated `.install-credentials` works for admin login.
