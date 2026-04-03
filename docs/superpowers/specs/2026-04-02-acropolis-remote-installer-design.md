# Acropolis Remote Installer — Design Spec

**Date:** 2026-04-02
**Status:** Approved
**Author:** Dr. Sanjay Udoshi + Claude

## Problem

The Parthenon installer (`installer/webapp.py`) requires the repository to already be cloned, Python to be installed, and Docker to be running. A user visiting `parthenon.acumenus.net` has no path from "interested" to "running instance" without manually cloning the repo, installing dependencies, and running `python3 install.py`.

## Goal

A user visits `parthenon.acumenus.net/install`, downloads a single binary (or runs a one-liner), and arrives at the Parthenon login screen with zero prior setup. The installer handles Docker, repo acquisition, and configuration automatically.

## Target Audience

Both clinical researchers (non-technical, need hand-holding) and IT/DevOps teams (technical, want control). The existing Beginner/Experienced modal routes each audience to the appropriate workflow.

## Platforms

- Linux (Ubuntu/Debian/RHEL) — primary deployment target
- macOS — developer and research workstations
- Windows via WSL2 — full coverage

## Architecture

```
parthenon.acumenus.net/install
    │
    ├── Landing page (static HTML, platform detection)
    │   └── Download button → acropolis-install.com (Cosmopolitan APE)
    │       └── Fallback links → per-platform PyInstaller binaries
    │
    └── One-liner: curl -fsSL https://install.acumenus.net | sh
        └── Downloads binary, verifies checksum, runs it
            │
            ▼
┌──────────────────────────────────────────────────┐
│  acropolis-install binary                        │
│                                                  │
│  Phase 0: Environment Bootstrap (NEW)            │
│    ├─ Docker: detect → auto-install (Linux)      │
│    │                    or guide (Mac/Windows)    │
│    ├─ Repo: git clone → or tarball download      │
│    └─ Target dir: ~/Parthenon (overridable)      │
│                                                  │
│  Phase 1+: Existing Installer (UNCHANGED)        │
│    ├─ webapp.py serves UI on localhost            │
│    ├─ Modal: Beginner (3-step) / Experienced     │
│    └─ 9-phase install: preflight → config →      │
│       docker → bootstrap → datasets → frontend → │
│       solr → admin → complete                    │
└──────────────────────────────────────────────────┘
```

The binary is a bootstrap wrapper. It handles Phase 0 (get Docker, get the repo), then delegates to the existing `webapp.py` + `cli.py` installer. No rewrite of installation logic.

## Phase 0: Environment Bootstrap

New module: `installer/bootstrap_remote.py` (~150 lines).

### Step 1: Docker Detection & Install

```
Detect: shutil.which("docker") + "docker compose version"

Linux (auto-install with consent):
  → "Docker not found. Install now? [Y/n]"
  → curl -fsSL https://get.docker.com | sh
  → sudo usermod -aG docker $USER
  → Prompt to log out/back in or newgrp docker

macOS (guide):
  → "Docker Desktop required."
  → Link: https://docs.docker.com/desktop/install/mac-install/
  → Exit with instructions to re-run after install

Windows (guide):
  → "Docker Desktop + WSL2 required."
  → Link: https://docs.docker.com/desktop/install/windows-install/
  → Exit with instructions to re-run after install
```

### Step 2: Repo Acquisition

```
Default target: ~/Parthenon (overridable via --dir flag)

If target exists with docker-compose.yml:
  → "Existing Parthenon found. Using it."
  → Skip clone

If git available:
  → git clone --depth 1 https://github.com/sudoshi/Parthenon.git ~/Parthenon

If git not available:
  → Download tarball from GitHub Releases (main.tar.gz)
  → Extract to ~/Parthenon
```

### Step 3: Launch Webapp

```
os.chdir(target_dir)
from installer.webapp import main
main()  # Opens browser, modal appears
```

Phase 0 is idempotent. If Docker is installed and the repo exists, it completes in <1 second and goes straight to the modal.

## Binary Packaging

### Cosmopolitan APE (primary)

A single Actually Portable Executable that runs natively on Linux, macOS, and Windows. Bundles CPython 3.11 + the `installer/` package.

- Build: `cosmocc` toolchain on Linux GitHub Actions runner
- Output: `acropolis-install.com` (~30-40MB)
- One build, one binary, all platforms

Risk: Cosmopolitan Python may not support all stdlib modules. Mitigation: validate `http.server`, `threading`, `subprocess`, `json`, `socket` early. If blockers found, ship PyInstaller-only for that release.

### PyInstaller (fallback, per-platform)

Three binaries built via GitHub Actions matrix:

| Runner | Output |
|--------|--------|
| `ubuntu-22.04` | `acropolis-install-linux` |
| `macos-13` | `acropolis-install-macos` |
| `windows-2022` | `acropolis-install-win.exe` |

PyInstaller spec bundles `installer/*.py` + `installer/web/*`. The existing `launcher.py` already handles `sys._MEIPASS` for resolving bundled files.

### Release Artifacts

```
GitHub Release v1.1.0:
  ├── acropolis-install.com          # Cosmopolitan universal
  ├── acropolis-install-linux        # PyInstaller Linux
  ├── acropolis-install-macos        # PyInstaller macOS
  ├── acropolis-install-win.exe      # PyInstaller Windows
  ├── install.sh                     # curl one-liner bootstrap
  └── checksums.sha256               # Integrity verification
```

## Distribution

### Landing Page: `parthenon.acumenus.net/install`

Static HTML matching Acropolis glassmorphic design language:
- Primary download button with JavaScript platform detection → serves cosmo binary
- `curl -fsSL https://install.acumenus.net | sh` one-liner for terminal users
- Fallback links for per-platform PyInstaller binaries
- Requirements listed: 8 GB RAM, 20 GB disk, Docker (will be installed if missing on Linux)

### One-Liner: `install.sh`

~50-line shell script:
1. Detect OS/arch
2. Query GitHub Releases API for latest version
3. Download cosmo binary (fall back to platform-specific if cosmo fails)
4. Verify SHA-256 checksum
5. Execute binary

Security: checksum verification before execution. Binaries built in auditable GitHub Actions CI.

## Changes to Existing Code

### New Files

| File | Purpose | Lines |
|------|---------|-------|
| `installer/bootstrap_remote.py` | Phase 0: Docker detect, repo acquire, launch webapp | ~150 |
| `installer/acropolis-install.spec` | PyInstaller spec | ~30 |
| `installer/install.sh` | curl one-liner bootstrap script | ~50 |
| `.github/workflows/build-installer.yml` | CI: build binaries on release | ~80 |
| Landing page HTML | Install page for parthenon.acumenus.net | ~150 |

### Modified Files

| File | Change |
|------|--------|
| `installer/webapp.py` | `bootstrap()` returns `remote: True/False` flag; accept `repo_path` override |
| `installer/web/app.js` | When `remote: true`, beginner shows repo path as confirmation not editable field |
| `installer/launcher.py` | Add `COSMO_RESOURCE_ROOT` env var check alongside `sys._MEIPASS` |

### Unchanged

- `installer/cli.py` — 9-phase flow untouched
- `installer/config.py` — defaults and validation unchanged
- `installer/preflight.py` — checks unchanged
- `installer/web/styles.css` — no style changes
- `installer/web/index.html` — no HTML changes

## Implementation Phases

### Phase 1: bootstrap_remote.py + CLI entry point

- New `installer/bootstrap_remote.py` with Docker detection, repo acquisition, webapp handoff
- `python3 -m installer.bootstrap_remote` as standalone entry point
- Testable locally without packaging

### Phase 2: PyInstaller packaging + GitHub Actions

- `acropolis-install.spec` for PyInstaller
- `.github/workflows/build-installer.yml` with 3-platform matrix
- `installer/install.sh` one-liner
- Release tag triggers build → uploads to GitHub Release
- `launcher.py` Cosmopolitan resource path prep

### Phase 3: Cosmopolitan APE binary

- Add cosmocc build step to GitHub Actions
- Validate Python stdlib modules under Cosmopolitan
- If validation fails → skip cosmo, PyInstaller binaries still ship
- Test on Linux, macOS, Windows

### Phase 4: Landing page + production deployment

- Static HTML install page (Acropolis design)
- Platform detection JavaScript
- Deploy to `parthenon.acumenus.net/install`
- `install.acumenus.net` DNS alias for curl one-liner
- Documentation updates

### Phase Dependencies

```
Phase 1 ──→ Phase 2 ──→ Phase 3
                  └──→ Phase 4 (parallel with Phase 3)
```

Phase 1 is the core. Phase 2 makes it distributable. Phases 3 and 4 polish the experience. A fully functional remote installer exists after Phase 2.

## Success Criteria

1. A user with no prior setup runs `curl -fsSL https://install.acumenus.net | sh` and reaches the Parthenon login screen
2. Docker is auto-installed on Linux; macOS/Windows users get clear guidance
3. The repo is cloned (or tarball downloaded) automatically to `~/Parthenon`
4. The existing Beginner/Experienced webapp flows work identically to a local install
5. Binaries are built automatically on every GitHub Release
6. SHA-256 checksums are verified before execution
7. The whole process works offline after the initial download + clone (no pip installs needed at runtime)
