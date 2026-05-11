# Installer First-Run Comprehensive Improvement — Design Spec

**Date:** 2026-04-24
**Sub-project:** v0.2.0 Installer Comprehensive Quality Bar
**Status:** Approved, pending implementation plans

---

## Goal

A signed Parthenon Community Installer, on macOS / Windows / Linux, takes a non-technical user from "double-click the installer" to "logged into Parthenon in a browser" without ever opening a terminal. A DevOps user gets the same outcome with full CLI parity, log access, signature verification, and resumable failures.

The signed-release work shipped in v0.1.0 (`2026-04-23-signed-release-packaging-design.md`) and the engine v2 work (`2026-04-23-installer-v2-engine-design.md`) are the foundation. This spec is the comprehensive *first-run user experience* improvement on top of that foundation.

### Concrete v0.2.0 ship state

- **macOS** — signed + notarized .dmg with stapled .app, opens cleanly past Gatekeeper, downloads bundle, runs install.py, reveals admin password in-app, opens browser to login screen — all from the GUI.
- **Windows** — signed .msi via Azure Trusted Signing, no SmartScreen warning after rep accrues, GUI shepherds the user through WSL setup if missing, then identical flow.
- **Linux** — signed .deb / .rpm / .AppImage with detached GPG signatures and a published `SIGNING-KEY.asc`, plus SHA-256 sidecars and SLSA attestations, identical flow.
- **All three** — in-GUI service health view, notify-only auto-updater on stable channel, zero telemetry, three-mode failure recovery (Resume / Retry / Reset), post-install runtime-image upgrade prompt, structured-error diagnostic engine.

---

## Non-Goals

- **No SaaS / hosted Parthenon.** Local-first only.
- **No replacement of `install.py`.** The Rust GUI remains a thin shell that delegates to the Python contract surface.
- **No new install paths.** WSL-only on Windows. `python3` + Docker required everywhere.
- **No telemetry pipeline.** Zero analytics, zero crash reporting, zero usage tracking. Passive feedback link to GitHub Discussions only.
- **No background daemon.** The Rust GUI does not spawn a long-running helper process. Subprocess + 2-second polling is the contract pattern.
- **No upgrade orchestration via the Rust GUI.** Existing installs upgrade via `python install.py --upgrade`. The Rust GUI surfaces "newer installer available" only — not "newer Parthenon."
- **No embedded LLM in v0.2.0.** Layer 2 (opt-in BYO-key Claude diagnostic assist) is deferred to a sibling sub-project with its own design doc and threat model. Layer 3 (local Ollama) is parking-lot.

---

## Decisions Captured (brainstorming output)

| Decision | Choice | Rationale |
|---|---|---|
| Scope tier | **Tier 4 — comprehensive** | User explicitly requested "comprehensive and complete." |
| Audience | **C — both novice + DevOps, parity** | GUI must hold the novice's hand all the way to login; CLI must remain a first-class path. |
| Architecture | **A — thin Rust shell, extend Python contract** | Existing pattern works. Single source of truth. No GUI/CLI drift. Reversible if a hot-loop endpoint ever needs a daemon (it won't at human-paced UI). |
| Windows execution | **A — WSL-only, GUI shepherds setup** | install.py is Bash-flavored Python and needs Linux. WSL is unavoidable. Improvement is to remove manual setup pain, not the WSL dependency. |
| Auto-updater | **Notify-only, stable channel, 24h cache** | Healthcare informatics tools should not silently replace themselves. Audit trail matters more than friction. |
| Telemetry | **Zero + passive GitHub Discussions link** | Healthcare buyers + nonprofit + trust capital. No analytics SDK, no Sentry, no Mixpanel. |
| Failure recovery | **3-mode hierarchy: Resume primary, Retry secondary, Reset tertiary** | ~80% of failures are transient and Resume works. Different visual weight, not equal-weight buttons. |
| Done-page layout | **Hero with progressive disclosure** | Single big "Open Parthenon" CTA, masked password with reveal/copy, advanced features collapsed. Novice-first with engineer escape hatches. |
| Diagnostic AI | **Layer 1 only (structured KB) for v0.2.0** | Layer 2/3 deferred. Layer 1 is good engineering hygiene. |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Rust + Tauri 2 GUI  (signed, notarized binary)     │
│  ─ ui/ : HTML/CSS/JS, Tauri dialog plugin           │
│  ─ src/main.rs : ~2.6k LOC, +~800 LOC for new       │
│  ─ Tauri updater plugin (latest.json on releases)   │
│  ─ Tauri shell plugin (shell.open(url))             │
└────────────────┬────────────────────────────────────┘
                 │  subprocess (stdin/stdout, JSON)
                 ▼
┌─────────────────────────────────────────────────────┐
│  install.py --contract <action> ...                 │
│  ─ EXISTING: validate, plan, preflight, data-check, │
│    bundle-manifest                                  │
│  ─ NEW: health, credentials, service-status,        │
│    open-app, port-holder, recover, diagnose         │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
        Docker Compose / PostgreSQL / etc.
```

### Three new Tauri plugins

1. **`tauri-plugin-dialog`** — replaces zenity / osascript / PowerShell pickers with native NSOpenPanel / WinUI / GTK. Works on headless Linux via fallback.
2. **`tauri-plugin-shell`** — for `shell.open(url)` on the Done page. Already in the Tauri 2 capabilities surface.
3. **`tauri-plugin-updater`** — points at `https://github.com/sudoshi/Parthenon/releases/latest/download/latest.json`. Notify-only, 24h cache.

### Seven new Python contract actions

| Action | Purpose | Returns |
|---|---|---|
| `health` | Probe `http://localhost:8082/api/v1/health` from inside the host | `{ready, attempt, last_status}` |
| `credentials` | Read `.install-credentials` (chmod 600) | `{admin_email, admin_password}` |
| `service-status` | `docker compose ps --format json`, normalize | `{services: [{name, state, health}]}` |
| `open-app` | Resolve canonical app URL | `{url}` |
| `port-holder` | Identify process holding a port (`lsof` / `ss` / `netstat`) | `{pid, name, command}` |
| `recover` | Inspect `.install-state.json` and recommend Resume / Retry / Reset | `{mode, last_phase, can_resume, message}` |
| `diagnose` | Match error streams against the diagnostic KB | `[{id, severity, message, fix_action, fix_args, learn_more}]` |

`wsl-distros` is the one Rust-side helper (Windows only) — `wsl.exe --list -q` runs on the Windows host, not inside WSL.

---

## The 7-Area Improvement Plan

### Area A — First-login UX (showstoppers)

| # | Deficiency | Fix |
|---|---|---|
| A1 | After install, user has to copy/paste URL into a browser | Tauri `shell.open(url)` triggered by big "Open Parthenon" CTA on Done page |
| A2 | Admin password buried in log line `(saved to .install-credentials)` | New contract action `credentials`; GUI shows masked field with **[👁 reveal]** and **[⎘ copy]** buttons |
| A3 | "Install complete" fires the moment `install.py` exits — but services are still warming, browser hits 502 | New `health` contract action polling `http://localhost:8082/api/v1/health` every 2 s, default timeout 120 s (60 attempts). UI shows "Waiting for Parthenon to come online…" with attempt counter. Done page only enables Open button when `ready: true`. On timeout, the Verify-fail panel offers "Wait another 60 s" |
| A4 | The "Done" stepper page just shows `event.payload.message` — no real UX | Hero layout (see Area D) |
| A5 | Novice closes installer thinking they closed Parthenon | Explicit copy: *"Parthenon now runs as Docker services. You can close this installer — Parthenon stays at http://localhost:8082 every time Docker is running."* |
| A6 | On Windows, browser opens on host but Docker Compose listens inside WSL — for users without Docker Desktop loopback this fails | Detect Docker Desktop integration vs WSL-native Docker; warn at preflight; surface a "Use Docker Desktop with WSL2 integration" doc link |

### Area B — Preflight & install-time depth

| # | Deficiency | Fix |
|---|---|---|
| B1 | macOS Docker daemon not running passes `docker --version` check | Replace with `docker info` for daemon liveness; existing version check stays for plugin version |
| B2 | "Port 8082 in use" — user has no idea what's holding it | New contract action `port-holder` runs `lsof -i :PORT` (mac/Linux) or `Get-NetTCPConnection` (Windows-WSL). Returns `{pid, name, command}`. UI shows: *"Port 8082 in use by `nginx` (pid 1234) — `kill 1234` to free it"* with a copy-button |
| B3 | No time/disk forecast — user commits blind | Preflight surfaces a "What this install does" panel: bundle size (~80 MB), image pull estimate (~6 GB first run), disk delta after install (~12 GB), expected duration on a 100 Mbps link (~15–25 min) |
| B4 | WSL distros not enumerated — user must type `Ubuntu-24.04` exactly | Rust runs `wsl.exe --list -q` on bootstrap; populates a dropdown. Empty list → "WSL not detected, run `wsl --install`" with copy-button + MS docs link |
| B5 | Bundle download is synchronous with no progress | Replace the `ureq::get(url).call() / io::copy` block with a chunked read loop emitting `download-progress` events `{bytes, total, percent, mb_per_sec, eta}`; UI shows progress bar and ETA |
| B6 | Single download attempt on transient network blip | 3 attempts with exponential backoff (1 s, 4 s, 16 s). Final failure shows actionable message + retry button |
| B7 | Hecate bootstrap missing → preflight warn, but no in-GUI fix | Add "Download Hecate bootstrap assets" button next to the warn — runs `installer.hecate_bootstrap.fetch()` via contract |
| B8 | If `python3` missing inside WSL distro, preflight fails with raw error | Detect missing `python3` specifically; show "Install python3 in `<distro>`" button → runs `wsl.exe -d <distro> -- sudo apt-get install -y python3 python3-pip` after consent modal |

### Area C — Install-time UX

| # | Deficiency | Fix |
|---|---|---|
| C1 | All 9 phases dump into one `<pre>` log | Parse Rich-formatted `console.rule("[bold]Phase N — …[/bold]")` lines from stdout; surface as a 9-step progress strip across the top with current phase highlighted. Log panel becomes collapsible "Show full log" |
| C2 | No way to cancel mid-install | Cancel button. On click: SIGTERM the subprocess, wait 5 s, SIGKILL. Run `docker compose down` cleanup if past Phase 4. State is left intact for Resume |
| C3 | Stderr blanket-marked `[error]` red, even routine progress | Stop categorizing by stream. Mark a line "error" only if it matches a regex (e.g., starts with `[red]✗`, `Error:`, `FATAL:`, `Traceback`) |
| C4 | UI lets user submit with empty admin email; preflight catches later | Client-side validation before "Check System": email format, required fields, port collisions in form |
| C5 | If install fails mid-flight, no in-GUI Resume button | New contract action `recover` reads `.install-state.json`, returns `{mode, last_phase, can_resume, message}`. Drives the 3-button recovery hierarchy |
| C6 | `--non-interactive` only — engineer wanting `--upgrade` has no path | Add Source mode option: "Fresh install" / "Upgrade existing install". Upgrade routes through `install.py --upgrade` |

### Area D — Post-install / Done page (the Hero)

| # | Element | Behavior |
|---|---|---|
| D1 | URL block | Single line, monospace, copy button |
| D2 | Admin email | Plain text, copy button |
| D3 | Admin password | Masked by default; **[👁 reveal]** flips to plaintext for 30 s then re-masks; **[⎘ copy]** copies without revealing |
| D4 | "Open Parthenon" CTA | Crimson button; only enabled when `health` returns `ready: true`; click → Tauri `shell.open(url)` |
| D5 | First-login pre-warning | Below CTA: *"On first login, Parthenon will require you to change this password — that's the expected flow."* |
| D6 | "You can close this" copy | Below CTA, italic: explicit close-the-installer messaging |
| D7 | No-telemetry banner | Footer: *"✓ Zero telemetry. This installer connects to GitHub Releases and Docker Hub only."* with link to docs |
| D8 | GH Discussions feedback link | Tiny passive link: *"Was this install painful? Tell us at github.com/sudoshi/Parthenon/discussions"* |
| D9 | Advanced disclosure (▼) | Expands to: service-status grid, full log toggle, "Reset everything" button (red, gated by confirmation modal listing what gets destroyed), runtime-image-upgrade prompt |
| D10 | Service status grid | Calls `service-status` contract every 5 s while expanded; pip per service: `nginx ✓`, `postgres ✓`, etc. Click pip → tail last 20 log lines |
| D11 | Runtime-image-upgrade prompt | Compares installed image SHA vs latest tag (only on community-release runtime profile); if drift, shows "Pull newer images" button → `docker compose pull` |

### Area E — Cross-platform polish & first-run trust

| # | Deficiency | Fix |
|---|---|---|
| E1 | Linux file pickers fail without zenity/kdialog | Adopt `tauri-plugin-dialog`; remove zenity/osascript/PowerShell shell-outs |
| E2 | macOS first-launch Gatekeeper friction | One-time persistent banner on macOS: *"This app is signed by Acumenus Data Sciences and notarized by Apple. If you ever see 'macOS cannot check this app', control-click the .app → Open."* Link to docs |
| E3 | Windows SmartScreen warning until reputation accrues | Docs page describes "Why does Windows say 'Unrecognized'?" with screenshot of SmartScreen and the "More info → Run anyway" path |
| E4 | First-launch shows raw "Welcome to Parthenon Installer" with no signing/verification info | Header shows *"Signed by Acumenus Data Sciences ✓"* with tooltip showing certificate validity (read from running binary's signature on macOS via `codesign -dv`, on Windows via Authenticode API; on Linux skipped — verification is via .asc) |

### Area F — CI / release plumbing

| # | Deficiency | Fix |
|---|---|---|
| F1 | macOS .dmg embeds .app that was stapled *after* dmg creation — stale ticket inside dmg | Re-order CI steps: build → notarize+staple .app → **rebuild .dmg** wrapping the now-stapled .app → notarize+staple .dmg. Validate with `xcrun stapler validate` on both, plus mounted-dmg .app |
| F2 | No SHA-256 sidecars per asset | `sha256sum * > SHA256SUMS.txt` per platform; per-asset `.sha256` files; both uploaded to release |
| F3 | No `latest.json` for auto-updater | New CI job generates `latest.json` per release with platform-specific URLs and Tauri-updater Ed25519 signatures. Upload to releases |
| F4 | GPG signing key fingerprint not published anywhere user-readable | Upload `SIGNING-KEY.asc` to every release; new docs page `verifying-signatures.mdx` with fingerprint, import command, per-platform verify commands; publish fingerprint to acumenus.net (separate channel) |
| F5 | No provenance / SLSA attestation | `actions/attest-build-provenance@v2` per artifact for SLSA Build L3 |
| F6 | Tauri updater public key not yet generated | Generate updater key one-time. Private → `TAURI_UPDATER_PRIVATE_KEY` secret. Public → `tauri.conf.json` `plugins.updater.pubkey`. Document key-rotation procedure |

A new `verify-release` CI job gates the upload step: every artifact's signature, attestation, and checksum must verify before any release asset is published.

### Area G — Diagnostic Knowledge Engine (Layer 1)

| # | Element | Behavior |
|---|---|---|
| G1 | Knowledge base file | New `installer/diagnostics-kb.json` — JSON array of fingerprint entries. Bundled into the source tree, validated in CI, ships inside the installer bundle |
| G2 | Fingerprint schema | `{id, fingerprint (regex), category, severity, fix_action, fix_args, user_message (template), learn_more, platforms}` |
| G3 | Initial seed (~50 entries) | Port conflicts, Docker daemon down, Docker Desktop not running, WSL not installed, WSL distro empty, missing python3 in distro, missing pip, image pull denied (rate limit / auth), DNS failures, network proxy required, certificate errors, disk full at /var/lib/docker, OOM during `compose up`, permission denied on Docker socket (Linux user not in `docker` group), backend/.env missing, env file unreadable, port already mapped to wrong container, postgres password mismatch on existing DB, Achilles SQL error, Solr OOM, etc. |
| G4 | New contract action `diagnose` | Takes `{stdout, stderr, exit_code, phase, platform}`; runs each fingerprint regex; returns ranked list `[{id, severity, message, fix_action, fix_args, learn_more}]` |
| G5 | Rust GUI hookup | When `install.py` subprocess exits non-zero, GUI auto-fires `diagnose`. Results render at the top of the recovery panel — *above* the Resume/Retry/Reset buttons. Each entry has a "Try this fix" button wiring through existing fix-up contract actions |
| G6 | "Try this fix" execution model | Each fix is a *reversible* contract action with a confirm modal showing the exact command(s) to be run. Never auto-runs. After fix completes, GUI offers "Resume install" |
| G7 | Coverage feedback loop | Every CI failure that doesn't match an existing fingerprint creates a GitHub Issue tagged `diagnostic-gap`. Adding a fingerprint to `diagnostics-kb.json` is part of every CI bug fix — codified in `CONTRIBUTING.md` |
| G8 | Tests | `installer/tests/test_diagnostics.py` — for each KB entry, a fixture with a known-bad log → assert correct fingerprint matches. Prevents regex regressions |
| G9 | Future hook (deferred) | The `diagnose` action returns an `{ai_assist_eligible: bool}` flag — true when no fingerprint matched and the failure is non-trivial. Layer 2 (BYO-key Claude) will read this flag in v0.3.0 |

---

## Step Structure & Failure Recovery Flow

### Revised step structure

Adding **Verify** as a distinct fifth step. "Code ran successfully" and "services are healthy and reachable" are different facts.

```
┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐
│  Configure   │→ │   Check  │→ │  Install │→ │  Verify  │→ │ Done │
└──────────────┘  └──────────┘  └──────────┘  └──────────┘  └──────┘
   progressive       fix-ups       phase         health      Hero
   disclosure        live          strip +       probe       layout
                                   diagnose      loop
```

**Step 1 · Configure** — Progressive disclosure. Novice sees Admin email, password (auto-generate option checked by default), and "Use recommended defaults for everything else." A `▼ Customize` disclosure exposes the existing 6 sub-sections. Client-side validation blocks "Check System" when required fields are empty or malformed.

**Step 2 · Check** — Each preflight check has three affordances:
- ✓ pass — collapsed by default
- ⚠ warn — expanded; if a fix-up exists, shows a "Fix this" button
- ✗ fail — expanded; fix-up button if available; "Re-check" button after the fix

A new **"What this install does"** panel sits above the check list: time forecast, disk delta, network volume, list of services that will start.

**Step 3 · Install** — A 9-cell phase strip across the top, fed by parsing `console.rule("Phase N — …")` from stdout. Compact streaming log (~10 visible lines, "Show full log" expander). Cancel button with confirm modal: *"This will stop the install. Resume is preserved if past Phase 4."* Per-phase live indicator (e.g., "Phase 5 of 9 · PHP container starting · 23 s elapsed"). On non-zero exit: subprocess streams pass to `diagnose`; matched fingerprints render at the top of the recovery panel.

**Step 4 · Verify** — Single screen with a health-probe loop. Calls `health` every 2 s; shows attempt counter. Five sub-checks render as a checklist as they pass:
1. nginx accepting connections
2. PHP-FPM responding
3. PostgreSQL ready
4. `/api/v1/health` returns 200
5. Frontend assets served

On all-green: auto-advance to Done after 1 s. Timeout (default 120 s): show last status and offer "Wait another 60 s" or "Show service status" (jumps to Verify-fail panel).

**Step 5 · Done** — Hero layout. D1–D11 from Area D.

### Failure recovery flow

Two distinct failure surfaces, handled differently.

**Install fails:**

```
                    Install fails
                          │
                          ▼
              ┌───────────────────────┐
              │  diagnose (G4)         │
              │  + recover (C5)        │
              └───────────────────────┘
                          │
                          ▼
        ┌───────────────────────────────┐
        │  Recovery Panel                │
        │                                │
        │  📋 Diagnostic match            │
        │     "Port 8082 held by ..."    │
        │     [Try this fix]             │
        │                                │
        │  ━━━━━━━━━━━━━━━━━━━           │
        │                                │
        │  PRIMARY:   [Resume from N]    │ ← can_resume: true
        │  Secondary: ▼ Different config │ ← Retry from start
        │  Tertiary:  Reset everything   │ ← red, confirm modal
        └───────────────────────────────┘
```

`recover` logic:
- `can_resume: true` (state intact, Resume primary) — typical case
- `can_resume: false, mode: retry` — state corrupted or config changed; Retry primary, Resume hidden
- Reset always visible as tertiary, behind a confirm modal listing exactly what gets destroyed: `docker compose down -v`, `.install-state.json`, the bundle cache, `.install-credentials`. **Not** any database the user explicitly chose not to drop.

**Verify fails (different flow):**

The install *succeeded*; the services are slow. Resume/Retry/Reset are *not* shown.

```
        ┌───────────────────────────────┐
        │  Verify-fail panel             │
        │                                │
        │  Health probe timed out         │
        │  Last status: 502              │
        │                                │
        │  Service status:               │
        │   ✓ nginx, ✓ postgres,         │
        │   ⚠ php (restarting)           │
        │                                │
        │  [Wait another 60 s]           │
        │  [Show last 50 nginx log lines]│
        │  [Show last 50 php log lines]  │
        │  ▼ Diagnostic suggestions      │
        └───────────────────────────────┘
```

### Pre-login UX bridge

The "Open Parthenon" CTA on Done does three things, in order:
1. Final health probe (single-shot)
2. Tauri `shell.open(url)`
3. Updates a footer indicator: *"Browser opened. The login screen will ask for the email and password shown above. After login, Parthenon will require you to change the password — this is the expected flow."*

The GUI window stays open by default — closing it does not affect the running app, but novices need the password and URL to remain visible until they're confidently logged in. A "Close installer" button is in the Advanced disclosure.

---

## CI / Release Plumbing & Auto-Updater

### CI workflow changes — `build-rust-installer-gui.yml`

The existing 548-line workflow gets ~200 LOC added across six surgical changes plus one new `verify-release` job.

**F1 · macOS .dmg stapling order**

Old order: build → notarize+staple .app → notarize+staple .dmg. Problem: the .app inside the .dmg was copied at .dmg-build time and is unstapled. Stapling the source .app doesn't touch the dmg copy.

New order: build → notarize+staple .app → **rebuild .dmg wrapping the stapled .app** → notarize+staple .dmg. Validation:

```bash
xcrun stapler validate "$app_bundle"            # ticket present
xcrun stapler validate "$dmg"                    # ticket present
hdiutil attach "$dmg" -mountpoint /tmp/dmgcheck
xcrun stapler validate "/tmp/dmgcheck/Parthenon Installer.app"  # ticket present inside dmg
hdiutil detach /tmp/dmgcheck
```

**F2 · SHA-256 sidecars**

After all artifacts are signed and packaged:

```bash
sha256sum * > SHA256SUMS.txt
for f in *.dmg *.msi *.deb *.rpm *.AppImage; do
  sha256sum "$f" | cut -d' ' -f1 > "$f.sha256"
done
```

Both `SHA256SUMS.txt` and per-asset `.sha256` files upload to the release.

**F3 · Generate `latest.json` for the auto-updater**

A new `publish-updater-manifest` job runs after all platform builds succeed (release events only):

```jsonc
{
  "version": "0.2.0",
  "notes": "https://github.com/sudoshi/Parthenon/releases/tag/v0.2.0",
  "pub_date": "2026-05-01T12:00:00Z",
  "platforms": {
    "darwin-x86_64":   { "signature": "<base64>", "url": "https://github.com/.../macos-universal.dmg" },
    "darwin-aarch64":  { "signature": "<base64>", "url": "https://github.com/.../macos-universal.dmg" },
    "windows-x86_64":  { "signature": "<base64>", "url": "https://github.com/.../windows-x64.msi" },
    "linux-x86_64":    { "signature": "<base64>", "url": "https://github.com/.../linux-x64.AppImage" }
  }
}
```

Each `signature` is generated with `tauri signer sign` against the corresponding artifact. `.deb` and `.rpm` are not in `latest.json` — package managers own those upgrade paths.

**F4 · GPG SIGNING-KEY publication**

- Upload `SIGNING-KEY.asc` (public key) as a release asset on every release.
- New docs page `docs/site/docs/install/verifying-signatures.mdx` with fingerprint, import command, per-platform verify commands.
- Publish fingerprint to acumenus.net (separate channel — anti-tampering signal).
- Key rotation: every 2 years; old keys remain valid for verifying historical releases.

**F5 · SLSA Build L3 provenance attestation**

```yaml
- uses: actions/attest-build-provenance@v2
  with:
    subject-path: |
      installer/rust-gui/dist-artifacts/*.dmg
      installer/rust-gui/dist-artifacts/*.msi
      installer/rust-gui/dist-artifacts/*.deb
      installer/rust-gui/dist-artifacts/*.rpm
      installer/rust-gui/dist-artifacts/*.AppImage
```

Verifiable via `gh attestation verify --owner sudoshi $artifact`.

**F6 · Tauri updater key bootstrap**

```bash
tauri signer generate -w ~/.tauri/parthenon-updater.key
```

- Private key file → `TAURI_UPDATER_PRIVATE_KEY` GitHub secret
- Private key passphrase → `TAURI_UPDATER_KEY_PASSWORD` secret
- Public key → committed to `installer/rust-gui/tauri.conf.json` under `plugins.updater.pubkey`
- Encrypted backup → 1Password / similar
- Key rotation procedure → `docs/install/key-rotation.mdx`. Rotate every 5 years OR after suspected compromise.

### `verify-release` gate

A new job runs after build completes and before any release-upload step:

```yaml
verify-release:
  needs: [build, installer-bundle]
  steps:
    - download SHA256SUMS.txt + all artifacts
    - sha256sum -c SHA256SUMS.txt
    - codesign --verify .app
    - signtool verify .msi
    - gpg --verify *.asc
    - tauri signer verify latest.json *.dmg *.msi *.AppImage
    - gh attestation verify --owner sudoshi $each_artifact
```

If any check fails, the release upload step does not run. This is the difference between "we built artifacts" and "we built artifacts that pass every verification step a security-conscious user will run."

### GUI changes for the auto-updater

**`installer/rust-gui/Cargo.toml`** — add `tauri-plugin-updater = "2"` and `tauri-plugin-shell = "2"`.

**`installer/rust-gui/tauri.conf.json`** — add `plugins.updater` and `plugins.shell`.

**`installer/rust-gui/capabilities/default.json`** — add `updater:default` and `shell:allow-open` permissions.

**`src/main.rs`** — single new Tauri command `check_for_updates`, cached for 24h via `tauri-plugin-store`. Three UI states: `Up to date ✓` / `Checking…` / `New version 0.3.0 available [Download & install]`. Click → Tauri updater downloads → verifies signature → relaunches. Never auto-installs without explicit click.

---

## Phasing

One cohesive spec, multiple plans. Each phase is a candidate for its own `/gsd-plan-phase` and atomic execution.

```
   Foundation                  Visible Surface              Polish
   ──────────                  ───────────────              ──────
   Phase 1                     Phase 3                       Phase 7
   Contract surface  ─────────► Step structure   ─────────► CI plumbing
   (health, creds,             (Verify step,                + verify-release
   recover, diagnose,          phase strip,                 gate
   port-holder, ...)           cancel)
                                  │
   Phase 2                        ▼                          Phase 8
   Rust GUI foundation         Phase 4                       Docs
   (Tauri plugins:             Hero Done page                (signing,
   dialog, shell,              (password reveal,             rotation,
   updater) +                  Open CTA, service             trust banners)
   WSL enum                    grid, all D1–D11)
                                  │
                                  ▼
                              Phase 5
                              Failure recovery
                              (Resume/Retry/Reset
                              + Diagnose UI)
                                  │
                                  ▼
                              Phase 6
                              Cross-platform polish
                              (Gatekeeper banner,
                              trust indicator)
```

| Phase | Title | Deliverables | Est | Blocks |
|---|---|---|---|---|
| 1 | Contract surface extension | 7 new contract actions; `installer/diagnostics-kb.json` with ~50 entries; pytest coverage per action | 1 wk | 3, 4, 5 |
| 2 | Rust GUI foundation | tauri-plugin-dialog/shell/updater wired in; replace zenity/osascript/PowerShell; WSL distro enum; updater key bootstrapped | 1 wk | 3, 4, 6, 7 |
| 3 | Step structure refactor | Add Verify step; progressive disclosure on Configure; phase strip on Install; client-side validation; Cancel button | 1 wk | 4, 5 |
| 4 | Hero Done page | Full D1–D11 implementation; health probe loop; Open Parthenon CTA; service status grid | 1 wk | — |
| 5 | Failure recovery | Recovery panel; Resume/Retry/Reset hierarchy; Diagnose hookup with "Try this fix" buttons | 1 wk | — |
| 6 | Cross-platform polish | Gatekeeper/SmartScreen banner copy; trust indicator in header; native dialogs verified on all 3 platforms | 0.5 wk | — |
| 7 | CI plumbing + verify-release | F1–F6 + verify-release gate; latest.json signing; SHA256 sidecars; SIGNING-KEY publication; SLSA attestation | 1.5 wk | — |
| 8 | Documentation | `verifying-signatures.mdx`, `key-rotation.mdx`, `first-launch-trust.mdx`, CONTRIBUTING.md additions for KB entries | 0.5 wk | — |

**Total: ~7.5 engineer-weeks.** Phases 1+2 are parallelizable (Python contract work and Rust plugin work are independent). Recombine on commit to main. Compresses to ~6.5 weeks.

---

## Testing Strategy

### Layer-by-layer

| Layer | Test type | What it covers |
|---|---|---|
| Contract actions | `installer/tests/test_*.py` (pytest) | Each new action: input schemas, expected output shapes, error cases |
| Diagnostic KB | `installer/tests/test_diagnostics.py` | Per-entry fixture: known-bad log → expected fingerprint match |
| Rust GUI logic | `cargo test` | Path validation, state-machine transitions, defaults file uniqueness |
| Tauri integration | `cargo test python_contract_ -- --ignored` (existing pattern) | End-to-end Rust ↔ Python contract round-trips on Linux + macOS |
| CI workflow | `verify-release` job | Every artifact's signature, attestation, checksum |
| Auto-updater | Manual + CI | Mock `latest.json` in a fixture release; verify download → signature check → relaunch |

### Manual platform matrix (gate before tagging release)

- macOS Apple Silicon — fresh install, clean Docker Desktop
- macOS Intel — same
- Windows 11 with WSL2 + Ubuntu-24.04 + Docker Desktop integration on
- Windows 11 with no WSL (verify shepherd flow)
- Ubuntu 22.04 LTS — fresh install via .deb
- Fedora 40 — fresh install via .rpm
- Headless Linux (no GUI) — install via .AppImage with Tauri dialog fallback

For each: install end-to-end → first-login screen → confirm SetupWizard appears as expected.

### Deliberate failure-mode tests

- Port 8082 held → diagnostic should match, "Try this fix" should kill the holder
- Docker daemon stopped mid-install → cancel cleanly, Resume works
- Kill the installer process during Phase 5 → Resume picks up at Phase 5
- Corrupt `.install-state.json` → Reset path is clean
- Network blip during bundle download → 3-attempt retry succeeds
- WSL distro deleted between Configure and Install → preflight catches it

---

## Acceptance Verification — Three Novice Journeys

Before declaring v0.2.0 ready, three end-to-end journeys must pass — recorded as videos for marketing and as acceptance criteria.

1. **macOS journey** — Researcher with no terminal experience opens .dmg, drags to Applications, double-clicks. From this point, no terminal, ever. Reaches login screen in < 30 minutes on a 100 Mbps link.

2. **Windows journey** — Same researcher on a fresh Windows 11 with no WSL installed. The shepherd flow guides them through `wsl --install`, distro selection, python3 setup, all from inside the Rust GUI. Reaches login screen.

3. **Linux journey** — DevOps user installs via `sudo apt install ./Parthenon-Installer-0.2.0-linux-x64.deb`. After install, runs `gpg --verify *.asc`, `sha256sum -c SHA256SUMS.txt`, and `gh attestation verify` — all pass. Reaches login screen.

If any journey fails, the spec hasn't shipped its goal.

---

## Future Work (Deferred)

- **Layer 2 · BYO-key Claude diagnostic assist** — opt-in, user-supplied Anthropic API key, sanitized log forwarding with preview-before-send. Target: v0.3.0 as a sibling sub-project with its own design doc + threat model. The `diagnose` contract action's `ai_assist_eligible` flag is the future hook.
- **Layer 3 · Local LLM via Ollama** — for users who can't allow third-party APIs. Lower priority; community demand will signal.
- **Tauri updater on Linux .deb / .rpm** — package managers should own this; revisit if community asks.
- **Multi-tenant / fleet install** — install N machines from one config file. Different problem space.
- **GUI-native upgrade orchestration** — driving `install.py --upgrade` from the GUI. Currently CLI-only; revisit when v0.3.0 lands.
- **Telemetry of any form** — explicit no, including opt-in failure reporting. The GitHub Discussions feedback link is the only signal channel.
- **Automatic Docker Desktop install** — too invasive; we shepherd, we don't install third-party software automatically.

---

## Appendix — Files Touched

**Rust GUI**

- `installer/rust-gui/src/main.rs` — new Tauri commands (~+800 LOC)
- `installer/rust-gui/ui/index.html` — new step structure, Hero Done page
- `installer/rust-gui/ui/app.js` — phase strip, recovery panel, health-probe loop, password reveal
- `installer/rust-gui/ui/styles.css` — Hero layout, progressive disclosure, status grid
- `installer/rust-gui/ui/done.html` — new partial for Done page
- `installer/rust-gui/Cargo.toml` — `tauri-plugin-dialog`, `tauri-plugin-shell`, `tauri-plugin-updater`, `tauri-plugin-store`
- `installer/rust-gui/tauri.conf.json` — plugins config + updater pubkey
- `installer/rust-gui/capabilities/default.json` — new permissions

**Python**

- `install.py` — new `--contract` actions: health, credentials, service-status, open-app, port-holder, recover, diagnose
- `installer/contract.py` — handler functions
- `installer/health.py` — new file, health probe
- `installer/recovery.py` — new file, state inspector
- `installer/diagnostics.py` — new file, KB matcher
- `installer/diagnostics-kb.json` — new file, ~50 fingerprint entries
- `installer/tests/test_health.py` — new
- `installer/tests/test_credentials.py` — new
- `installer/tests/test_service_status.py` — new
- `installer/tests/test_recovery.py` — new
- `installer/tests/test_diagnostics.py` — new (one fixture per KB entry)

**CI**

- `.github/workflows/build-rust-installer-gui.yml` — F1 stapling order, F2 SHA256 sidecars, F3 latest.json job, F4 SIGNING-KEY upload, F5 attestations, F6 updater key wiring, verify-release gate

**Docs**

- `docs/site/docs/install/verifying-signatures.mdx` — new
- `docs/site/docs/install/key-rotation.mdx` — new
- `docs/site/docs/install/first-launch-trust.mdx` — new
- `docs/site/docs/install/community-installer-walkthrough.mdx` — new (3 platform journeys)
- `CONTRIBUTING.md` — new section "Adding a diagnostic-kb fingerprint"
