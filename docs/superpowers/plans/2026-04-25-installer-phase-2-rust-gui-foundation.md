# Installer Phase 2 — Rust GUI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Rust GUI's platform-specific shell-out pickers (zenity / osascript / PowerShell) with the Tauri 2 dialog plugin, add the shell + updater + store plugins, and add a Rust-side `wsl_distros` command so the Windows Configure step can show a real WSL distro dropdown instead of a free-text field.

**Architecture:** All changes live in `installer/rust-gui/`. Three Tauri plugins are added (`dialog`, `shell`, `updater`, `store` for the 24h cache). Existing `browse_path_*` platform helpers in `src/main.rs` are deleted (~120 LOC) and replaced with a single thin `browse_path` command that the frontend invokes via the JS dialog API. A new `wsl_distros` command runs `wsl.exe --list -q` on Windows. Updater integration is wired but the keypair is generated out-of-band per a documented one-time procedure.

**Tech Stack:** Rust + Tauri 2.x, `tauri-plugin-dialog`, `tauri-plugin-shell`, `tauri-plugin-updater`, `tauri-plugin-store`. No new Python dependencies.

**Spec reference:** `docs/superpowers/specs/2026-04-24-installer-first-run-comprehensive-design.md` — Areas A1, B4, E1, F6 plus the Architecture section's "Three new Tauri plugins" subsection.

**Plan reference:** This is the second of 8 phase plans. Phase 1 (`2026-04-24-installer-phase-1-contract-surface.md`) shipped to main as commit `b2ef2fe18` and is a hard prerequisite — Phase 2 does not call any of the new contract actions, but it sets up the GUI surface that Phases 3-6 will use to call them.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `installer/rust-gui/Cargo.toml` | MODIFY | Add 4 plugin deps |
| `installer/rust-gui/tauri.conf.json` | MODIFY | Plugin config (updater endpoints, shell open allowlist) |
| `installer/rust-gui/capabilities/default.json` | MODIFY | New permissions for dialog, shell, updater |
| `installer/rust-gui/src/main.rs` | MODIFY | Remove ~120 LOC of platform pickers; add `wsl_distros` command (~40 LOC); add `check_for_updates` command (~60 LOC); register plugins |
| `installer/rust-gui/ui/index.html` | MODIFY | WSL distro `<input>` becomes `<select>` |
| `installer/rust-gui/ui/app.js` | MODIFY | Use Tauri dialog plugin for browse buttons; populate WSL distro dropdown on bootstrap |
| `docs/site/docs/install/key-rotation.mdx` | NEW | Updater keypair generation + rotation procedure |

**Net LOC delta:** roughly -120 (delete platform pickers) + 100 (new commands) = -20 in `main.rs`. Lower complexity overall — the plugin replaces cross-platform code we owned.

---

## Pre-Phase Notes

**Updater keypair is generated manually, NOT in CI.** The private key never lives in the repo; it goes in a GitHub repo secret (`TAURI_UPDATER_PRIVATE_KEY`) and the public key is committed to `tauri.conf.json`. Keypair generation is a one-time manual step, documented in Task 7's docs file. **Until the keypair exists, the updater will fail at runtime — but the build succeeds and the GUI works for everything else.**

Decision: Phase 2 wires the *plugin*. The keypair is generated as part of the v0.2.0 release prep, not Phase 2 itself. Task 6 places a placeholder pubkey in `tauri.conf.json` with a comment that ties it to Task 7's docs page.

---

### Task 1: Add Tauri plugin dependencies

**Files:**
- Modify: `installer/rust-gui/Cargo.toml`

- [ ] **Step 1: Read current Cargo.toml**

```
cat installer/rust-gui/Cargo.toml
```

You should see existing deps: `flate2`, `serde`, `serde_json`, `sha2`, `tar`, `tauri`, `ureq`.

- [ ] **Step 2: Add the 4 plugin deps**

Edit `installer/rust-gui/Cargo.toml`. After the existing `[dependencies]` block, ensure the following deps are present:

```toml
[dependencies]
flate2 = "1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sha2 = "0.10"
tar = "0.4"
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
tauri-plugin-store = "2"
tauri-plugin-updater = "2"
ureq = "2"
```

The plugins are alphabetized between `tauri` and `ureq` for clean diff readability.

- [ ] **Step 3: Verify the build still compiles**

```
cd installer/rust-gui
cargo build 2>&1 | tail -20
```

Expected: build succeeds (downloads new crates, compiles). Errors at this stage usually mean a Tauri 2 minor-version mismatch — try `cargo update -p tauri-plugin-dialog` if dependency resolution complains.

- [ ] **Step 4: Run cargo test (sanity)**

```
cargo test 2>&1 | tail -10
```

Expected: existing tests still pass (we haven't changed any code yet, just added deps).

- [ ] **Step 5: Commit**

```
git add installer/rust-gui/Cargo.toml installer/rust-gui/Cargo.lock
git commit -m "feat(installer-gui): add Tauri 2 plugin deps (dialog/shell/store/updater)

Wires four new Tauri plugins as dependencies — they're not yet registered
on the App builder (Task 6) and not yet used (Tasks 2-7). Pure dep addition
so the rest of Phase 2 has a clean cargo lock baseline."
```

---

### Task 2: Register Tauri plugins on the App builder

**Files:**
- Modify: `installer/rust-gui/src/main.rs` (the `fn main()` at the bottom)

- [ ] **Step 1: Read the current main()**

```
grep -n "fn main()" installer/rust-gui/src/main.rs
```

The current `main()` looks like:

```rust
fn main() {
    tauri::Builder::default()
        .manage(InstallerState::default())
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            browse_directory,
            browse_file,
            validate_environment,
            preview_defaults,
            start_install
        ])
        .run(tauri::generate_context!())
        .expect("error while running Parthenon installer GUI");
}
```

- [ ] **Step 2: Register the four plugins**

Insert plugin builders before `.manage(...)`:

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(InstallerState::default())
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            browse_directory,
            browse_file,
            validate_environment,
            preview_defaults,
            start_install
        ])
        .run(tauri::generate_context!())
        .expect("error while running Parthenon installer GUI");
}
```

The order is alphabetical for readability. `tauri_plugin_updater::Builder::new().build()` will fail at runtime without an `updater` config block in `tauri.conf.json` — Task 6 adds that. For now, building is fine; runtime will degrade gracefully.

- [ ] **Step 3: Build**

```
cd installer/rust-gui
cargo build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 4: Run tests**

```
cargo test 2>&1 | tail -10
```

Expected: existing tests still pass — none of them exercise `main()` or the Tauri runtime.

- [ ] **Step 5: Commit**

```
git add installer/rust-gui/src/main.rs
git commit -m "feat(installer-gui): register dialog/shell/store/updater plugins

Wires the four plugins on the Tauri App builder. Plugins are inert until
Tasks 3-6 add their permissions, configs, and frontend invocations.
The updater plugin will warn at runtime until the keypair is provisioned
(documented in Task 7)."
```

---

### Task 3: Add plugin permissions to capabilities

**Files:**
- Modify: `installer/rust-gui/capabilities/default.json`

- [ ] **Step 1: Read the current capabilities**

```
cat installer/rust-gui/capabilities/default.json
```

Current state:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for the Parthenon installer window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:allow-listen",
    "core:event:allow-unlisten"
  ]
}
```

- [ ] **Step 2: Add plugin permissions**

Replace the `permissions` array with:

```json
  "permissions": [
    "core:default",
    "core:event:allow-listen",
    "core:event:allow-unlisten",
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "shell:default",
    "shell:allow-open",
    "store:default",
    "updater:default"
  ]
```

`dialog:allow-open` covers folder/file picker invocations. `shell:allow-open` permits `shell.open(url)` for the "Open Parthenon" CTA in Phase 4. `updater:default` enables the updater check + download flow that Task 6 wires up. `store:default` is for the 24h cache backing the updater's check-throttling.

- [ ] **Step 3: Validate JSON**

```
python -c "import json; json.load(open('installer/rust-gui/capabilities/default.json'))" && echo "JSON valid"
```

- [ ] **Step 4: Build (Tauri validates capability schemas at build time)**

```
cd installer/rust-gui
cargo build 2>&1 | tail -10
```

Expected: build succeeds. If a permission identifier is unrecognized, Tauri will reject it at build time with a schema error pointing to the invalid line — fix by checking the actual permission name in the plugin's published manifest.

- [ ] **Step 5: Commit**

```
git add installer/rust-gui/capabilities/default.json
git commit -m "feat(installer-gui): grant capabilities for new Tauri plugins

dialog:allow-open + dialog:allow-save unlock the native file picker.
shell:allow-open enables the 'Open Parthenon' CTA (Phase 4).
updater:default + store:default back the auto-update + 24h cache flow."
```

---

### Task 4: Replace `browse_path_*` platform pickers with Tauri dialog plugin

**Files:**
- Modify: `installer/rust-gui/src/main.rs` (delete ~120 LOC, add ~10)
- Modify: `installer/rust-gui/ui/app.js` (replace Rust-side `browseDirectory`/`browseFile` invocations with the Tauri dialog plugin's JS API)

- [ ] **Step 1: Read the current pickers**

```
grep -n "browse_directory\|browse_file\|browse_path\|fn browse_path" installer/rust-gui/src/main.rs
```

You should see:
- `browse_directory` and `browse_file` Tauri commands
- `enum PathPickerMode { Directory, File }`
- `fn browse_path(mode, title, current_path)` dispatching to platform-specific helpers
- `fn browse_path_linux(...)` (zenity / kdialog shell-out)
- `fn browse_path_macos(...)` (osascript shell-out)
- `fn browse_path_windows(...)` (PowerShell shell-out)
- `fn run_picker(...)` and `fn applescript_quote(...)` helpers

- [ ] **Step 2: Read app.js to find the dialog usage**

```
grep -n "browse_directory\|browse_file\|browsePath\|data-browse" installer/rust-gui/ui/app.js
```

Note the existing `browsePath(button)` function and the event-listener loop that wires `[data-browse]` buttons.

- [ ] **Step 3: Delete the Rust-side picker code**

In `installer/rust-gui/src/main.rs`, delete (do not comment out) the following:

- The `#[tauri::command] fn browse_directory(...)` function
- The `#[tauri::command] fn browse_file(...)` function
- The `enum PathPickerMode { ... }`
- `fn browse_path(...)` and all three platform helpers (`browse_path_linux`, `browse_path_macos`, `browse_path_windows`)
- `fn run_picker(...)` (only used by these pickers)
- `fn applescript_quote(...)` (only used by `browse_path_macos`)
- The `command_available` function — IF AND ONLY IF nothing else in `main.rs` uses it. If `command_available` is also called by the WSL preflight code (Task 5 will reuse it), keep it.

Also remove `browse_directory` and `browse_file` from the `tauri::generate_handler![...]` array in `fn main()`.

- [ ] **Step 4: Verify Rust still builds**

```
cd installer/rust-gui
cargo build 2>&1 | tail -10
```

Expected: build succeeds. Compiler will catch any dangling references (e.g., if `command_available` is still used and you accidentally deleted it).

- [ ] **Step 5: Replace the JS browse logic**

In `installer/rust-gui/ui/app.js`, find and replace the `browsePath(button)` function:

```javascript
async function browsePath(button) {
  const input = document.querySelector(button.dataset.target);
  if (!input) return;

  const isFile = button.dataset.browse === "file";
  const title = input.closest("label")?.textContent.replace(/\s+/g, " ").trim() || "Select path";

  try {
    const dialog = window.__TAURI__?.dialog;
    if (!dialog) {
      throw new Error("Tauri dialog plugin not available — run inside the desktop app");
    }
    const selected = isFile
      ? await dialog.open({
          title,
          multiple: false,
          directory: false,
          defaultPath: input.value || undefined,
        })
      : await dialog.open({
          title,
          multiple: false,
          directory: true,
          defaultPath: input.value || undefined,
        });
    if (selected && typeof selected === "string") {
      input.value = selected;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } catch (err) {
    setStatus(String(err), "error");
  }
}
```

The Tauri 2 dialog plugin's JS API is at `window.__TAURI__.dialog.open(options)`. `options.directory: true` for folder selection, `false` (or omitted) for file selection.

- [ ] **Step 6: Smoke test the dev build**

```
cd installer/rust-gui
cargo tauri dev 2>&1 | head -30
```

Expected: the GUI window opens. Click a "Browse" button → native dialog opens via the Tauri plugin (NSOpenPanel on macOS, GTK on Linux, WinUI on Windows). On a headless Linux box, this step is informational — Tauri may exit immediately with no display. In that case, just confirm the Rust binary builds and tests pass.

- [ ] **Step 7: Run cargo test + cargo clippy**

```
cd installer/rust-gui
cargo test
cargo clippy --all-targets -- -D warnings
```

Expected: tests pass; clippy clean.

- [ ] **Step 8: Commit**

```
git add installer/rust-gui/src/main.rs installer/rust-gui/ui/app.js
git commit -m "refactor(installer-gui): replace platform pickers with Tauri dialog plugin

Removes ~120 LOC of zenity/kdialog (Linux), osascript (macOS), and
PowerShell FolderBrowserDialog (Windows) shell-outs. Replaces them with
a single window.__TAURI__.dialog.open() call from the frontend.

Benefits:
- Works on headless Linux servers (no zenity/kdialog dependency)
- Native NSOpenPanel on macOS, no AppleScript dialog
- Faster Windows picker (no 2-3s PowerShell start cost)
- Less code surface to sign and notarize

Spec E1."
```

---

### Task 5: Add `wsl_distros` Rust command for Windows

**Files:**
- Modify: `installer/rust-gui/src/main.rs` (add ~40 LOC)
- Modify: `installer/rust-gui/ui/app.js` (consume the new command)
- Modify: `installer/rust-gui/ui/index.html` (convert WSL distro `<input>` to `<select>`)

- [ ] **Step 1: Add the Rust command**

In `installer/rust-gui/src/main.rs`, add a new Tauri command anywhere in the command-definition area (e.g., near `bootstrap`):

```rust
#[derive(Debug, Serialize)]
struct WslDistros {
    available: bool,
    distros: Vec<String>,
    error: Option<String>,
}

#[tauri::command]
fn wsl_distros() -> WslDistros {
    if !cfg!(target_os = "windows") {
        return WslDistros {
            available: false,
            distros: vec![],
            error: Some("WSL distro enumeration only runs on Windows hosts".to_string()),
        };
    }

    let output = match Command::new("wsl.exe")
        .args(["--list", "--quiet"])
        .output()
    {
        Ok(output) => output,
        Err(err) => {
            return WslDistros {
                available: false,
                distros: vec![],
                error: Some(format!("wsl.exe not found or failed: {err}")),
            };
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return WslDistros {
            available: false,
            distros: vec![],
            error: Some(if stderr.is_empty() {
                "wsl.exe --list --quiet exited with non-zero status".to_string()
            } else {
                stderr
            }),
        };
    }

    // wsl.exe --list emits UTF-16 LE text on Windows; decode best-effort
    let raw = output.stdout;
    let text = if raw.len() >= 2 && raw[0] == 0xFF && raw[1] == 0xFE {
        String::from_utf16_lossy(
            &raw[2..]
                .chunks_exact(2)
                .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                .collect::<Vec<_>>(),
        )
    } else {
        String::from_utf8_lossy(&raw).to_string()
    };

    let distros: Vec<String> = text
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();

    WslDistros {
        available: true,
        distros,
        error: None,
    }
}
```

Register in `tauri::generate_handler![...]` in `fn main()`:

```rust
            wsl_distros,
```

- [ ] **Step 2: Add a unit test for the non-Windows path**

In the existing `mod tests { ... }` block in `installer/rust-gui/src/main.rs`, add:

```rust
#[cfg(not(target_os = "windows"))]
#[test]
fn wsl_distros_returns_unavailable_on_non_windows() {
    let result = wsl_distros();
    assert!(!result.available);
    assert!(result.distros.is_empty());
    assert!(result.error.is_some());
    assert!(result.error.as_deref().unwrap().contains("Windows"));
}
```

The Windows code path can't be unit-tested from a Linux/macOS CI runner, so this test only validates the early-return guard. Manual smoke testing on a Windows runner (Task 8) covers the rest.

- [ ] **Step 3: Run cargo test**

```
cd installer/rust-gui
cargo test
```

Expected: existing tests + the new `wsl_distros_returns_unavailable_on_non_windows` test pass.

- [ ] **Step 4: Update the HTML — convert WSL distro field to `<select>`**

In `installer/rust-gui/ui/index.html`, find the existing WSL fields block:

```html
            <div id="windows-fields" class="windows-fields" hidden>
              <label>
                WSL distro
                <input id="wsl-distro" name="wsl_distro" placeholder="Ubuntu-24.04" autocomplete="off" />
              </label>
              ...
            </div>
```

Replace the `<input>` with `<select>`:

```html
            <div id="windows-fields" class="windows-fields" hidden>
              <label>
                WSL distro
                <select id="wsl-distro" name="wsl_distro">
                  <option value="">Detecting WSL distros…</option>
                </select>
                <span id="wsl-distro-help" class="field-help"></span>
              </label>
              <label>
                WSL install path
                <input id="wsl-repo-path" name="wsl_repo_path" placeholder="/home/user/Parthenon" autocomplete="off" />
              </label>
            </div>
```

- [ ] **Step 5: Update app.js bootstrap to populate the dropdown**

In `installer/rust-gui/ui/app.js`, modify the `boot()` function. After the existing `windowsFields.hidden = !data.windows;` line, append:

```javascript
    if (data.windows) {
      try {
        const wsl = await invoke("wsl_distros", {});
        const select = document.querySelector("#wsl-distro");
        const help = document.querySelector("#wsl-distro-help");
        if (!wsl.available) {
          select.innerHTML = '<option value="">WSL not detected</option>';
          if (help) {
            help.textContent = "WSL2 is required. Run `wsl --install` from an Administrator PowerShell, then reboot.";
            help.classList.add("warn");
          }
        } else if (wsl.distros.length === 0) {
          select.innerHTML = '<option value="">No distros installed</option>';
          if (help) {
            help.textContent = "WSL is installed but no Linux distribution is set up. Run `wsl --install -d Ubuntu-24.04`.";
            help.classList.add("warn");
          }
        } else {
          select.innerHTML = wsl.distros
            .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
            .join("");
          if (help) {
            help.textContent = `Detected ${wsl.distros.length} WSL distro(s).`;
            help.classList.remove("warn");
          }
        }
      } catch (err) {
        // Best-effort — keep going if enumeration itself errors
        const select = document.querySelector("#wsl-distro");
        select.innerHTML = '<option value="">WSL enumeration failed</option>';
      }
    }
```

`escapeHtml` already exists in `app.js` (used by `renderChecks` etc.). The `invoke("wsl_distros", {})` call returns the `WslDistros` struct serialized as JSON.

- [ ] **Step 6: Run cargo build + cargo clippy**

```
cd installer/rust-gui
cargo build
cargo clippy --all-targets -- -D warnings
```

Expected: green.

- [ ] **Step 7: Commit**

```
git add installer/rust-gui/src/main.rs installer/rust-gui/ui/app.js installer/rust-gui/ui/index.html
git commit -m "feat(installer-gui): enumerate WSL distros into a dropdown

Adds a wsl_distros Tauri command that runs 'wsl.exe --list --quiet' on
Windows hosts and parses the UTF-16 LE output. The Configure step's
WSL distro field becomes a <select> populated at boot, with helpful
error states ('WSL not detected' / 'No distros installed') that point
the user at the right wsl --install command.

Spec B4 — removes the manual 'type Ubuntu-24.04 exactly' failure mode."
```

---

### Task 6: Configure the updater plugin (without keypair)

**Files:**
- Modify: `installer/rust-gui/tauri.conf.json`
- Modify: `installer/rust-gui/src/main.rs` (add `check_for_updates` command)

- [ ] **Step 1: Read the current tauri.conf.json**

```
cat installer/rust-gui/tauri.conf.json
```

- [ ] **Step 2: Add the `plugins` block**

Edit `installer/rust-gui/tauri.conf.json`. After the `bundle` block, before the closing `}`, add a `plugins` key:

```jsonc
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Parthenon Installer",
  "version": "0.1.0",
  "identifier": "io.acumenus.parthenon.installer",
  "build": { "frontendDist": "ui" },
  "app": { ... existing ... },
  "bundle": { ... existing ... },
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/sudoshi/Parthenon/releases/latest/download/latest.json"
      ],
      "pubkey": "REPLACE_WITH_REAL_PUBKEY_BEFORE_RELEASE",
      "windows": { "installMode": "passive" }
    },
    "shell": { "open": true }
  }
}
```

The `pubkey` placeholder is intentional — Task 7 documents the keypair generation procedure that produces the real pubkey. Until then, the updater plugin loads the config but `check_for_updates` will fail signature verification on any downloaded update. That's safe (refuses to install) and intended for v0.2.0 release prep.

- [ ] **Step 3: Add the `check_for_updates` Rust command**

In `installer/rust-gui/src/main.rs`, add:

```rust
#[derive(Debug, Serialize)]
struct UpdateCheckResult {
    has_update: bool,
    latest_version: Option<String>,
    current_version: String,
    notes: Option<String>,
    error: Option<String>,
}

#[tauri::command]
async fn check_for_updates(app: AppHandle) -> UpdateCheckResult {
    use tauri_plugin_updater::UpdaterExt;

    let current = env!("CARGO_PKG_VERSION").to_string();

    let updater = match app.updater() {
        Ok(u) => u,
        Err(err) => {
            return UpdateCheckResult {
                has_update: false,
                latest_version: None,
                current_version: current,
                notes: None,
                error: Some(format!("updater unavailable: {err}")),
            };
        }
    };

    match updater.check().await {
        Ok(Some(update)) => UpdateCheckResult {
            has_update: true,
            latest_version: Some(update.version.clone()),
            current_version: current,
            notes: update.body.clone(),
            error: None,
        },
        Ok(None) => UpdateCheckResult {
            has_update: false,
            latest_version: None,
            current_version: current,
            notes: None,
            error: None,
        },
        Err(err) => UpdateCheckResult {
            has_update: false,
            latest_version: None,
            current_version: current,
            notes: None,
            error: Some(err.to_string()),
        },
    }
}
```

Register in `tauri::generate_handler![...]`:

```rust
            check_for_updates,
```

- [ ] **Step 4: Build**

```
cd installer/rust-gui
cargo build 2>&1 | tail -10
```

Expected: build succeeds. The `tauri_plugin_updater::UpdaterExt` trait should resolve since the dep is in Cargo.toml.

- [ ] **Step 5: Run cargo clippy**

```
cargo clippy --all-targets -- -D warnings
```

Expected: clean. If clippy complains about `dead_code` for `UpdateCheckResult`, that's because we haven't yet wired the command into the JS frontend — add `#[allow(dead_code)]` to the struct OR proceed with confidence; the command will be invoked in Phase 4's Done page.

- [ ] **Step 6: Validate JSON**

```
python -c "import json; json.load(open('installer/rust-gui/tauri.conf.json'))" && echo "JSON valid"
```

- [ ] **Step 7: Commit**

```
git add installer/rust-gui/tauri.conf.json installer/rust-gui/src/main.rs
git commit -m "feat(installer-gui): wire updater plugin with placeholder pubkey

Configures tauri-plugin-updater to point at the GitHub Releases latest.json.
Adds a check_for_updates Tauri command (async — uses the updater extension
trait) that returns has_update + latest_version for the GUI's banner.

The pubkey is a placeholder. Task 7's docs page documents the one-time
keypair generation procedure; the real pubkey replaces this string during
v0.2.0 release prep, and the private key goes in TAURI_UPDATER_PRIVATE_KEY
GitHub secret."
```

---

### Task 7: Document the updater keypair generation procedure

**Files:**
- Create: `docs/site/docs/install/key-rotation.mdx`

- [ ] **Step 1: Create the docs page**

Create `docs/site/docs/install/key-rotation.mdx`:

```mdx
---
title: Updater Keypair & Rotation
sidebar_position: 90
---

# Updater Keypair & Rotation

The Parthenon Installer's auto-updater uses Tauri's signed-update mechanism. Each release publishes a `latest.json` file signed with an Ed25519 private key; the installer verifies that signature against the public key compiled into the binary.

This page documents the one-time keypair generation, secret storage, and rotation procedure.

## One-Time Generation

Run this on a trusted local machine — never in CI, never in a shared shell session.

```bash
mkdir -p ~/.tauri
tauri signer generate -w ~/.tauri/parthenon-updater.key
```

The command outputs:
- The **private key** is written to `~/.tauri/parthenon-updater.key` (passphrase-protected during generation).
- The **public key** is printed to stdout. It looks like:
  ```
  dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDFGRUM2NDY1...
  ```

## Storage

| Material | Location | Purpose |
|---|---|---|
| Private key | GitHub repo secret `TAURI_UPDATER_PRIVATE_KEY` | CI signs `latest.json` per release |
| Private key passphrase | GitHub repo secret `TAURI_UPDATER_KEY_PASSWORD` | Unlocks the key in CI |
| Private key (encrypted backup) | 1Password vault `Parthenon — Release Keys` | Disaster recovery |
| Public key | `installer/rust-gui/tauri.conf.json` `plugins.updater.pubkey` | Installer verifies signatures |
| Public key | acumenus.net release-keys page | Independent publication channel |

Until `TAURI_UPDATER_PRIVATE_KEY` is set, CI cannot generate `latest.json` and the updater banner in the GUI will report "no update available" forever — that is the safe failure mode.

## Replacing the Placeholder

After running `tauri signer generate`:

1. Copy the printed public key.
2. Open `installer/rust-gui/tauri.conf.json`.
3. Replace `"REPLACE_WITH_REAL_PUBKEY_BEFORE_RELEASE"` with the real key string.
4. Commit:
   ```bash
   git add installer/rust-gui/tauri.conf.json
   git commit -m "chore(installer-gui): set production updater pubkey"
   ```
5. Add the private key file's contents to GitHub repo secret `TAURI_UPDATER_PRIVATE_KEY`.
6. Add the passphrase to GitHub repo secret `TAURI_UPDATER_KEY_PASSWORD`.

## Rotation

Rotate the keypair **every 5 years** OR immediately after a suspected compromise.

Rotation is non-disruptive when done correctly: Tauri 2 supports an array of pubkeys in `tauri.conf.json` so old releases can still be verified by users running newer installers, and new releases signed by the new key are accepted.

### Rotation Procedure

1. Generate a new keypair on a trusted machine: `tauri signer generate -w ~/.tauri/parthenon-updater-2.key`.
2. Edit `installer/rust-gui/tauri.conf.json` and convert `pubkey` to an array containing both keys, newest first:
   ```jsonc
   "pubkey": [
     "<new-pubkey>",
     "<old-pubkey>"
   ]
   ```
3. Update GitHub secrets `TAURI_UPDATER_PRIVATE_KEY` and `TAURI_UPDATER_KEY_PASSWORD` with the new key.
4. Tag a release. CI signs `latest.json` with the new key.
5. After 90 days (covering one full update cycle), drop the old pubkey from the array.

### After Suspected Compromise

If the private key is suspected exposed:
1. Immediately rotate to a new keypair (above).
2. Issue a security advisory on GitHub.
3. Bump the installer's minimum supported version (`tauri.conf.json` `version`) so existing installs are forced to update through the new key.
4. Notify acumenus.net release-keys page subscribers via the maintained mailing list.

## Verification (User-Facing)

End users do not interact with the updater key directly — the installer verifies signatures automatically. Users who want independent verification can compare the bundled pubkey against the version published at https://acumenus.net/security/release-keys before running the installer for the first time.

The published fingerprint is reproducible from the public key:

```bash
echo "<pubkey-string>" | sha256sum
```
```

- [ ] **Step 2: Verify Docusaurus builds without errors**

```
cd docs/site
npx docusaurus build 2>&1 | tail -20
```

Expected: build succeeds. If the doc fails for frontmatter reasons, double-check the `sidebar_position` key.

If Docusaurus is not available locally (CI handles it), skip this step and rely on the docs CI job.

- [ ] **Step 3: Commit**

```
git add docs/site/docs/install/key-rotation.mdx
git commit -m "docs(install): updater keypair generation, storage, and rotation

Documents the one-time procedure for provisioning the Tauri updater
keypair: where to generate it (trusted local machine, never in CI),
what to commit (the public key in tauri.conf.json), and what NOT to
commit (the private key — goes in TAURI_UPDATER_PRIVATE_KEY secret).
Also documents 5-year rotation cadence and emergency-rotation procedure
after suspected compromise."
```

---

### Task 8: Final verification

- [ ] **Step 1: Full Rust build + tests + lint**

```
cd installer/rust-gui
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build --release 2>&1 | tail -5
```

Expected: all green. The release build is informational (catches release-only optimizations); it should succeed.

- [ ] **Step 2: Run all installer Python tests for no-regressions**

The Python contract surface (Phase 1) is unchanged but should still work:

```
cd /home/smudoshi/Github/Parthenon
python -m pytest installer/tests/ 2>&1 | tail -3
```

Expected: 202 passed (same as Phase 1's final state).

- [ ] **Step 3: Smoke test the dev shell on the host platform**

```
cd installer/rust-gui
cargo tauri dev 2>&1 | head -30
```

If you have a display, the GUI window should open. Click a Browse button → the native dialog should appear (NSOpenPanel / GTK / WinUI). If headless, just confirm the binary builds.

- [ ] **Step 4: Verify all five Tauri commands are registered**

```
grep -A 12 "generate_handler" installer/rust-gui/src/main.rs | head -15
```

Should show:
```
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            validate_environment,
            preview_defaults,
            start_install,
            wsl_distros,
            check_for_updates
        ])
```

(`browse_directory` and `browse_file` should be ABSENT — replaced by the Tauri dialog plugin's JS API.)

- [ ] **Step 5: Phase done**

No commit at this step — verification only.

---

## Phase 2 Done Criteria

- [ ] All 8 tasks complete with their commits
- [ ] `cargo build --release` succeeds in `installer/rust-gui/`
- [ ] `cargo test` passes in `installer/rust-gui/`
- [ ] `cargo clippy --all-targets -- -D warnings` clean
- [ ] `python -m pytest installer/tests/` still 202 passing
- [ ] Tauri capabilities include `dialog`, `shell`, `updater`, `store` permissions
- [ ] `wsl_distros` and `check_for_updates` Tauri commands registered
- [ ] zenity / osascript / PowerShell shell-out code deleted
- [ ] `docs/site/docs/install/key-rotation.mdx` exists with full procedure

## What Phase 2 Does NOT Include

- Real updater pubkey (placeholder until v0.2.0 release prep — Task 7 documents the procedure)
- Actually using `check_for_updates` from the GUI (Phase 4 wires the banner)
- New step structure or progressive disclosure (Phase 3)
- Hero Done page (Phase 4)
- Recovery panel UI (Phase 5)
- Gatekeeper / SmartScreen banners (Phase 6)
- CI workflow signing changes — F1, F2, F3, F4, F5, F6 land in Phase 7
- E1's claim of "headless Linux works via Tauri dialog fallback" is verified manually on a CI runner; we don't add an automated test for this in Phase 2

The Phase 2 commit set should be self-contained — pass CI on its own, not block any other phase, and leave the GUI in a state where every Phase 1 contract action is still callable but no new UI is exposed yet (those land in Phases 3-5).
