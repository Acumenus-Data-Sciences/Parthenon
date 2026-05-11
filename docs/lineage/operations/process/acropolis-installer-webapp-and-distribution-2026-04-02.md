# Acropolis Installer — Webapp Redesign & Cross-Platform Distribution

**Date:** 2026-04-02 / 2026-04-03
**Author:** Dr. Sanjay Udoshi
**Status:** Shipped
**Scope:** `installer/`, `frontend/public/install/`, `.github/workflows/build-installer.yml`, `snap/`, Homebrew tap

---

## 2026-04-17 Status Update

The package distribution portion of this devlog is retired. The v1.0.5 and
v1.0.6 release assets showed that the native archives and package-manager
wrappers were not reliable enough to publish. Current releases are source-only:
GitHub provides the source archives, and `installer/install.sh` is the supported
bootstrap path. Native packages should not return until they are signed,
reproducible, and covered by install smoke tests.

---

## Summary

The Parthenon installer webapp (`installer/webapp.py`) was redesigned from scratch and extended into a full cross-platform distribution system. What started as a refinement of the existing web-based installer evolved into Acropolis — a universal installer and deployment platform that can be distributed via Homebrew, Snap, APT/DEB, Winget, and direct download, with conditional Apple and Windows code signing in CI.

This devlog covers three major workstreams completed in a single session:

1. **Webapp installer UX overhaul** — dual-path onboarding, enterprise service toggles, consistent glassmorphic UI
2. **Remote installer architecture** — Phase 0 bootstrap module, Cosmopolitan APE universal binary, `install.py --webapp` handoff
3. **Package manager distribution** — Homebrew tap, Snap, DEB, Winget manifest, CI pipeline with 7 parallel jobs

---

## Part 1: Webapp Installer UX Overhaul

### Starting Point

The existing `installer/webapp.py` served a functional but rough web UI for the Parthenon installer. It had hardcoded port 7777 with no fallback, weak `Math.random()` password generation in the frontend, no validation on several wizard steps, brittle static file serving, and no subprocess cleanup on shutdown.

### Security & Robustness Fixes (10 Issues)

| Priority | Issue | Fix |
|----------|-------|-----|
| HIGH | Port 7777 hardcoded, crashes if occupied | `_find_port()` tries 7777, falls back to OS-assigned |
| HIGH | `Math.random()` for password generation | `crypto.getRandomValues()` with ambiguous-char-free charset |
| HIGH | No validation on credentials/modules steps | `validateCurrentStep()` checks email format, password length, module selection |
| MEDIUM | Static file serving: chain of if-statements | Extension whitelist with path traversal prevention |
| MEDIUM | Subprocess orphaned on server kill | `proc` stored on `InstallState`, terminated in `finally` |
| MEDIUM | `pollInstall()` no error handling | try/catch in setInterval, shows "Lost connection" banner |
| LOW | CSRF: any local page can trigger install | Origin header check, rejects non-localhost |
| LOW | `STATIC_DIR` breaks with PyInstaller | Uses `launcher.resource_path()` |

### Hero Panel Rebrand

The left-side hero panel was rebranded from "Parthenon" to "Welcome to Acropolis" — reflecting that Acropolis is not just the enterprise Docker suite but the universal installer and deployment platform from Acumenus Data Sciences. The glassmorphic card design was elevated to match the Parthenon login page:

- Centered vertically and horizontally over the background image
- Richer glass effect: `backdrop-filter: blur(28px) saturate(1.4)`, `border-top: 1px solid rgba(255,255,255,0.20)`, inset shadow
- Inline links to GitHub, Discord, and Acumenus
- "OMOP CDM v5.4" version badge and attribution footer
- Animated crimson pulse divider with sweeping highlight between panels

### Workspace Panel

The right-side workspace panel was restructured:
- 95% viewport width/height with internal scrolling only — no page scroll
- Content card scrolls independently within the panel
- All content anchored to top (fixed `align-self: start` issue on Confirm step)

### Dual-Path Onboarding

The onboarding modal was redesigned as a fork between two installation modes:

**Express Install (Beginner) — 3 steps:**
1. **Setup** — admin email, display name, optional password, repo path (pre-filled)
2. **Check** — auto-run preflight, must pass to continue
3. **Install** — summary card, big "Install Parthenon" button, inline progress log, "Open Parthenon" link on completion

Community Edition with all defaults, Eunomia demo included, UMLS key validation skipped (configured post-login via setup wizard). The action bar's Validate, Install, Dry Run, and Upgrade controls are hidden — everything is inline.

**Advanced Setup (Experienced) — 6 steps:**
1. **Environment** — repo path, WSL config
2. **Readiness** — preflight checks with sectioned results
3. **Install Path & Keys** — edition dropdown, enterprise key, UMLS API key, Athena vocab ZIP with Browse button, AI services (frontier API key, Ollama URL with auto-detection, install checkbox)
4. **Access** — admin account (identity) + security (passwords with eye toggles, regenerate buttons)
5. **Services** — platform modules, add-on services (parent-child gating), Acropolis enterprise services (Authentik, Superset, DataHub, Wazuh, n8n, Portainer, pgAdmin, Grafana — opt-out model), service credentials & ports
6. **Confirm** — structured key-value review grid with grouped cards, installer log with placeholder

### Consistent Design System

Every step section now follows a uniform pattern:
- `section-kicker` (gold mono uppercase label)
- `h4` heading
- `section-copy` description
- Content (fields, checkboxes, choice cards)

All password/secret fields have eye toggle buttons for show/hide. The dry run toggle moved from the action bar to the onboarding modal, enforced across both paths.

### Enterprise Services

When Enterprise Edition is selected in step 3, step 5 shows the Acropolis enterprise services in a single consolidated panel:
- Authentik SSO, Apache Superset, DataHub Catalog, Wazuh SIEM, n8n Workflows, Portainer CE, pgAdmin 4, Grafana Monitoring
- All checked by default (opt-out model)
- Gated by edition — Community Edition users never see these

### Review Step

The Confirm step replaced the raw textarea with a structured review grid:
- Grouped cards: Environment, Edition, Access, AI Services, Acropolis Enterprise (when applicable), Platform
- Key-value rows with proper labels
- Passwords masked with bullet characters
- Services listed by name

### Backend Changes

- `config.py`: `frontier_api_key`, `install_ollama`, enterprise service flags (`enable_authentik`, `enable_superset`, etc.)
- `webapp.py`: Ollama detection in bootstrap API (installed + running status), `remote` flag, `repo_path` override
- Beginner experience skips UMLS validation in `validate_config()`

---

## Part 2: Remote Installer Architecture

### Problem

The webapp installer requires the repo to be cloned, Python installed, and Docker running. A user visiting `parthenon.acumenus.net` has no path from "interested" to "running instance" without manual setup.

### Design

A "Phase 0" bootstrap module (`installer/bootstrap_remote.py`) handles environment setup before the existing installer takes over:

1. **Docker Detection & Install** — `shutil.which("docker")` + `docker compose version`. On Linux, offers auto-install via `get.docker.com` with user consent. On macOS/Windows, prints guidance and exits.
2. **Repo Acquisition** — If target has `docker-compose.yml`, use it. If git available, `git clone --depth 1`. Otherwise download tarball from GitHub and extract.
3. **Webapp Handoff** — Spawns system Python with `install.py --webapp`, which bootstraps pip deps (rich, questionary) and runs `webapp.main(remote=True)`.

Key design decision: the binary spawns the repo's own `install.py` as a subprocess rather than importing `installer.webapp` directly. This avoids bundling third-party deps in the binary — `install.py` bootstraps its own pip deps before importing the installer package.

### Cosmopolitan APE Binary

The macOS cross-compilation problem (PyInstaller on Apple Silicon can't produce x86_64 binaries) led to adopting Cosmopolitan Libc for the macOS distribution:

- **What it is:** A single Actually Portable Executable (APE) that runs natively on Linux x86_64/ARM64, macOS Intel/Apple Silicon, and Windows — one file, all platforms.
- **How it works:** The `apelink` linker weaves x86_64 and aarch64 ELF binaries into a polyglot shell/PE/ELF/PKZIP file. On first execution, it extracts a ~10KB APE Loader for the current platform.
- **Build process:** `installer/build_cosmo.py` downloads the cosmo Python binary (~35MB), appends the installer package with correct package structure (`Lib/site-packages/installer/`), and writes a `.args` file for the entry point.

CI lesson learned: GitHub Actions runners register a `.NET` binfmt_misc handler that intercepts APE binaries. The fix is `--assimilate` which converts the APE to a native ELF for testing.

### install.py --webapp

Added a `--webapp` flag to `install.py` that bootstraps pip deps then calls `webapp.main(remote=True)`. This is the bridge between the binary (Phase 0) and the existing installer (Phase 1+).

### Cosmopolitan Resource Path

`installer/launcher.py` now checks `COSMO_RESOURCE_ROOT` environment variable alongside `sys._MEIPASS` for PyInstaller, enabling static asset resolution in both packaging systems.

---

## Part 3: Cross-Platform Distribution

### The Double-Click Problem

Every modern OS blocks downloaded executables: macOS Gatekeeper, Linux execute-bit stripping, Windows SmartScreen. The direct-download binary approach fails at the last mile for non-technical users. The solution is distribution through trusted channels.

### Homebrew (macOS + Linux) — Phase 1, Shipped

Created `github.com/sudoshi/homebrew-parthenon` with a formula that downloads the platform-appropriate binary from the GitHub Release:

```bash
brew tap sudoshi/parthenon
brew install parthenon-installer
parthenon-install
```

The formula installs the cosmo APE on macOS (both Intel and Apple Silicon) and the PyInstaller binary on Linux. Homebrew handles permissions, PATH, and updates automatically.

### Snap (Ubuntu/Linux) — Shipped

`snap/snapcraft.yaml` using the `dump` plugin with `nil` build — downloads the pre-built PyInstaller binary from the GitHub Release, wraps it in a snap with `classic` confinement (needed for Docker socket access):

```bash
sudo snap install parthenon-installer --classic
parthenon-install
```

CI builds the snap via `snapcore/action-build@v1` and uploads it to the release.

### APT/DEB (Debian/Ubuntu) — Shipped

`installer/nfpm.yaml` builds a `.deb` package using nfpm in CI. Includes a `.desktop` file for Linux application menus:

```bash
sudo dpkg -i parthenon-installer_1.0.3_amd64.deb
parthenon-install
```

### Winget (Windows) — Manifest Ready

`installer/winget/Acumenus.ParthenonInstaller.yaml` is ready for submission to `microsoft/winget-pkgs`. Once accepted:

```powershell
winget install Acumenus.ParthenonInstaller
parthenon-install
```

### Code Signing — Conditional CI Jobs

Two signing jobs are configured but dormant until certificates are purchased:

**Apple (macOS):**
- Gated on `vars.APPLE_SIGNING_ENABLED == 'true'`
- Imports Developer ID certificate, `codesign` with runtime hardening
- Builds `.pkg` with `pkgbuild` + `productsign`
- Notarizes via `xcrun notarytool submit --wait`
- Staples ticket for offline verification
- Cost: $99/year Apple Developer Program

**Windows:**
- Gated on `vars.WINDOWS_SIGNING_ENABLED == 'true'`
- Imports PFX certificate, signs with `Set-AuthenticodeSignature`
- DigiCert timestamp for long-term validity
- Cost: ~$50/year (Certum Open Source) or free (SignPath.io)

Both jobs use `continue-on-error: true` — CI stays green regardless. The release job prefers signed artifacts when available, falls back to unsigned.

### CI Pipeline

The final `build-installer.yml` runs 7 parallel jobs on release:

| Job | Runner | Output | Status |
|-----|--------|--------|--------|
| Linux installer | ubuntu-22.04 | `acropolis-install-linux.tar.gz` | Green |
| macOS installer (universal) | ubuntu-22.04 | `acropolis-install-macos.zip` (cosmo APE) | Green |
| Windows installer (WSL) | windows-2022 | `acropolis-install-win.exe` | Green |
| Snap package | ubuntu-22.04 | `parthenon-installer_1.0.3_amd64.snap` | Green |
| Debian package | ubuntu-22.04 | `parthenon-installer_1.0.3_amd64.deb` | Green |
| Sign + notarize macOS | macos-14 | Signed .zip + .pkg | Skipped (awaiting certs) |
| Sign Windows exe | windows-2022 | Signed .exe | Skipped (awaiting certs) |
| Release upload | ubuntu-22.04 | All artifacts → GitHub Release | Green |

### Landing Page

`parthenon.acumenus.net/install` shows package manager commands as the primary install method:

- **macOS + Linux:** Homebrew tap + install
- **Ubuntu / Debian:** Snap install (+ DEB on releases page)
- **Windows:** Winget install
- **Fallback:** `curl -fsSL https://parthenon.acumenus.net/install.sh | sh`

Each command block has a Copy button. The login page hero panel links to this page via "Install on a New Machine →".

---

## Files Created/Modified

### New Files

| File | Purpose |
|------|---------|
| `installer/bootstrap_remote.py` | Phase 0: Docker detect, repo acquire, webapp handoff |
| `installer/build_cosmo.py` | Builds Cosmopolitan APE binary |
| `installer/acropolis-install.spec` | PyInstaller spec |
| `installer/install.sh` | curl one-liner bootstrap script |
| `installer/test_cosmo_compat.py` | Cosmopolitan stdlib compatibility checker |
| `installer/nfpm.yaml` | Debian package config |
| `installer/parthenon-installer.desktop` | XDG desktop entry |
| `installer/winget/Acumenus.ParthenonInstaller.yaml` | Winget manifest |
| `snap/snapcraft.yaml` | Snap package config |
| `frontend/public/install/` | Landing page (HTML + CSS + JS) |
| `tests/installer/test_bootstrap_remote.py` | 12 unit tests for bootstrap module |
| `.github/workflows/build-installer.yml` | CI: 7 build jobs + release upload |

### Modified Files

| File | Change |
|------|--------|
| `installer/webapp.py` | Port fallback, static serving, subprocess cleanup, CSRF, Ollama detection, remote flag |
| `installer/web/app.js` | Dual-path onboarding, enterprise services, eye toggles, review grid, beginner flow |
| `installer/web/index.html` | Acropolis rebrand, modal redesign, dry run toggle, experimental installer link |
| `installer/web/styles.css` | Glassmorphic hero card, 95% workspace, internal scrolling, review grid, eye toggles |
| `installer/config.py` | Enterprise service flags, frontier API key, install_ollama, beginner UMLS skip |
| `installer/launcher.py` | Cosmopolitan resource path support |
| `install.py` | `--webapp` flag |
| `frontend/src/features/auth/pages/LoginPage.tsx` | "Install on a New Machine" link |

### External Repos

| Repo | Purpose |
|------|---------|
| `sudoshi/homebrew-parthenon` | Homebrew tap with formula for parthenon-installer |

---

## Design Decisions

### Why Cosmopolitan APE over PyInstaller for macOS?

PyInstaller on macOS-14 (Apple Silicon) produces ARM64-only binaries. Cross-compilation to x86_64 is not supported — `actions/setup-python` with `architecture: x64` silently falls back to ARM64 on Apple Silicon runners. Cosmopolitan solves this with a single binary that contains both architectures, but it requires the host to have system Python for the webapp handoff (the APE binary handles Phase 0 only).

### Why subprocess handoff instead of direct import?

The binary's Phase 0 code is pure stdlib — no third-party deps. But `installer.webapp` → `installer.config` immediately imports `rich` at module level. If we imported directly from the binary, we'd need to bundle rich/questionary in PyInstaller or the cosmo zip. Instead, the binary spawns `install.py --webapp` via system Python, which bootstraps its own pip deps via the existing `_ensure_deps()` mechanism in `install.py`.

### Why package managers over direct download?

Modern OS security prevents downloaded executables from running without friction. Code signing ($99-$200/year) eliminates warnings but requires ongoing maintenance. Package managers (Homebrew, Snap, APT, Winget) are trusted distribution channels that handle signing, permissions, and PATH automatically. They're also the standard expectation for developer tools.

### Why conditional signing jobs?

The signing certificates aren't purchased yet. Rather than blocking the pipeline or requiring manual intervention, the signing jobs gate on repository variables (`APPLE_SIGNING_ENABLED`, `WINDOWS_SIGNING_ENABLED`). They're completely invisible until activated — no skipped badges, no red X marks. When certs are added, the release job automatically prefers signed artifacts.

---

## What's Next

1. **Apple Developer enrollment** — $99/year, enables signed .pkg and notarization
2. **Windows code signing** — Certum ($50/year) or SignPath (free for OSS)
3. **Snap Store submission** — register `parthenon-installer` name, publish to `stable` channel
4. **Winget PR** — submit manifest to `microsoft/winget-pkgs`
5. **Homebrew formula auto-update** — CI step to PR new version + SHA256 to tap repo on release
6. **In-app setup wizard** — extend the existing `SetupWizard` to handle vocabulary import, data sources, and AI configuration post-login (completing the beginner flow)
