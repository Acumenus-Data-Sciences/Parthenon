---
phase: quick-13
plan: 01
subsystem: installer
tags: [security, robustness, webapp, installer]
dependency_graph:
  requires: []
  provides: [port-fallback, secure-passwords, step-validation, csrf-protection, subprocess-cleanup]
  affects: [installer/webapp.py, installer/web/app.js]
tech_stack:
  added: []
  patterns: [crypto.getRandomValues, path-traversal-prevention, origin-check]
key_files:
  created: []
  modified:
    - installer/webapp.py
    - installer/web/app.js
decisions:
  - Charset for password generation excludes I, l, O, 0, 1 (ambiguous characters) per auth convention
  - Generalized static serving uses extension whitelist instead of hardcoded paths
  - STATIC_DIR uses launcher.resource_path for PyInstaller compatibility
metrics:
  duration: 2min
  completed: "2026-04-02T21:58:33Z"
---

# Quick Task 13: Webapp Installer Refinement Summary

Port fallback via OS socket binding, crypto.getRandomValues password generation, step 3/4 validation gates, generalized static file serving with path traversal prevention, subprocess cleanup on shutdown, CSRF origin check, and poll error handling.

## What Was Done

### Task 1: Harden webapp.py (c5f98b23b)

Five changes applied to the Python installer backend:

1. **Port fallback** -- `_find_port()` tries port 7777 first, falls back to OS-assigned free port via `socket.bind(("127.0.0.1", 0))` if occupied.

2. **Generalized static file serving** -- Replaced chain of if-statements with an extension-to-content-type map (`_CONTENT_TYPES`). Resolves requested paths against `STATIC_DIR` with `Path.resolve()` and verifies the resolved path starts with `STATIC_DIR.resolve()` to prevent path traversal. Special case preserved for `/assets/parthenon-login-bg.png` which uses `launcher.resource_path()`.

3. **Subprocess cleanup** -- Added `proc: subprocess.Popen | None` field to `InstallState`. Stored process handle after creation in `_run_install`. Added termination logic in `main()` finally block that calls `proc.terminate()` + `proc.wait(timeout=5)` if the process is still running.

4. **CSRF origin check** -- Added origin header validation at the top of `do_POST`. Rejects requests with non-localhost origins (not starting with `http://127.0.0.1` or `http://localhost`) with a 403 response.

5. **STATIC_DIR packaging compat** -- Changed `STATIC_DIR` from `Path(__file__).resolve().parent / "web"` to `launcher.resource_path("installer/web")` which handles both PyInstaller (`sys._MEIPASS`) and normal execution.

### Task 2: Harden app.js (bbdd1fa3e)

Three changes applied to the JavaScript frontend:

1. **Secure password generation** -- Replaced two `Math.random().toString(36)` calls with `crypto.getRandomValues` using a `generateSecurePassword()` helper. Charset excludes ambiguous characters (I, l, O, 0, 1) per auth system convention. Admin passwords are 16 chars, DB passwords are 24 chars.

2. **Step validation for credentials and modules** -- Added validation in `validateCurrentStep()`:
   - Step 3 (credentials): validates admin email contains @, admin password >= 8 chars, DB password >= 8 chars
   - Step 4 (modules): validates at least one module group is selected

3. **Poll error handling** -- Wrapped the `setInterval` callback in `pollInstall()` with try/catch. On fetch error, clears the interval and shows a "Lost connection to installer server" error banner.

## Issues Addressed

| # | Issue | Status | Fix |
|---|-------|--------|-----|
| 1 | Port 7777 hardcoded, no fallback | Fixed | OS socket fallback |
| 2 | Math.random for passwords | Fixed | crypto.getRandomValues |
| 3 | Steps 3/4 no validation | Fixed | Email/password/module gates |
| 4 | Hardcoded static file paths | Fixed | Extension whitelist + path traversal check |
| 5 | Subprocess not cleaned up | Fixed | proc.terminate() on shutdown |
| 6 | Poll fetch errors unhandled | Fixed | try/catch with banner |
| 7 | Onboarding modal UX | Deferred | LOW priority, requires HTML template + UX design |
| 8 | No CSRF origin check | Fixed | Origin header validation on POST |
| 9 | STATIC_DIR breaks in PyInstaller | Fixed | launcher.resource_path() |
| 10 | Thread safety note | N/A | Observational, no code change needed |

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | c5f98b23b | fix(quick-13): harden webapp.py |
| 2 | bbdd1fa3e | fix(quick-13): harden app.js |
