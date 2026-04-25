# Installer Phase 6 — Cross-Platform Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Signed by Acumenus Data Sciences ✓" trust indicator to the GUI header (with platform-appropriate cert details on hover), and surface one-time first-launch banners explaining macOS Gatekeeper and Windows SmartScreen friction. Spec areas E2, E3, E4. Phase 2 already covered E1 (replaced platform pickers with Tauri dialog plugin).

**Architecture:** Two new Rust commands (`signing_info`, `dismiss_first_launch_banner`), three small UI additions (header trust pill, Gatekeeper banner, SmartScreen banner). Banners use `localStorage` for dismissal state. The trust indicator is informational — it does not perform a cryptographic verification at runtime (the OS already did that at install time).

**Spec reference:** `docs/superpowers/specs/2026-04-24-installer-first-run-comprehensive-design.md` — Areas E2, E3, E4.

**Plan reference:** Phases 1–5 shipped. Phase 6 is independent of Phase 7 + 8.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `installer/rust-gui/src/main.rs` | MODIFY | `signing_info` Tauri command (platform-specific subprocess) |
| `installer/rust-gui/ui/index.html` | MODIFY | Header trust pill; Gatekeeper + SmartScreen banner markup |
| `installer/rust-gui/ui/app.js` | MODIFY | Boot-time signing info fetch + banner show/dismiss logic |
| `installer/rust-gui/ui/styles.css` | MODIFY | Trust pill, banner styles |

---

### Task 1 — Trust indicator + signing_info command + first-launch banners

**Files:** all four UI files + main.rs.

**Rust addition** (place near other commands like `bootstrap`):

```rust
#[derive(Debug, Serialize)]
struct SigningInfo {
    platform: String,
    signed: bool,
    signer: Option<String>,
    detail: String,
    error: Option<String>,
}

#[tauri::command]
fn signing_info() -> SigningInfo {
    let platform = env::consts::OS.to_string();

    if platform == "macos" {
        return signing_info_macos();
    }
    if platform == "windows" {
        return signing_info_windows();
    }
    SigningInfo {
        platform,
        signed: false,
        signer: None,
        detail: "Linux installer signatures are detached .asc files. See docs/install/verifying-signatures.".to_string(),
        error: None,
    }
}

#[cfg(target_os = "macos")]
fn signing_info_macos() -> SigningInfo {
    // Locate the .app bundle by walking up from current_exe()
    // Inside Foo.app/Contents/MacOS/foo — go up 3 levels to reach Foo.app
    let app_path = match env::current_exe() {
        Ok(exe) => exe.parent().and_then(|p| p.parent()).and_then(|p| p.parent()).map(|p| p.to_path_buf()),
        Err(_) => None,
    };
    let target = match app_path {
        Some(p) if p.extension().is_some_and(|e| e == "app") => p,
        _ => {
            return SigningInfo {
                platform: "macos".to_string(),
                signed: false,
                signer: None,
                detail: "Could not locate .app bundle (running outside an installed bundle?)".to_string(),
                error: None,
            };
        }
    };

    let output = Command::new("codesign")
        .args(["-dv", "--verbose=2"])
        .arg(&target)
        .output();

    let output = match output {
        Ok(o) => o,
        Err(err) => {
            return SigningInfo {
                platform: "macos".to_string(),
                signed: false,
                signer: None,
                detail: String::new(),
                error: Some(format!("codesign not available: {err}")),
            };
        }
    };

    // codesign -dv writes to stderr by convention
    let text = String::from_utf8_lossy(&output.stderr).to_string();
    if !output.status.success() {
        return SigningInfo {
            platform: "macos".to_string(),
            signed: false,
            signer: None,
            detail: text.trim().to_string(),
            error: None,
        };
    }

    let signer = text
        .lines()
        .find(|line| line.starts_with("Authority="))
        .and_then(|line| line.split_once('='))
        .map(|(_, v)| v.to_string());

    SigningInfo {
        platform: "macos".to_string(),
        signed: signer.is_some(),
        signer,
        detail: text.trim().to_string(),
        error: None,
    }
}

#[cfg(not(target_os = "macos"))]
fn signing_info_macos() -> SigningInfo {
    SigningInfo {
        platform: env::consts::OS.to_string(),
        signed: false,
        signer: None,
        detail: String::new(),
        error: Some("macOS-only".to_string()),
    }
}

#[cfg(target_os = "windows")]
fn signing_info_windows() -> SigningInfo {
    let exe = match env::current_exe() {
        Ok(p) => p,
        Err(err) => {
            return SigningInfo {
                platform: "windows".to_string(),
                signed: false,
                signer: None,
                detail: String::new(),
                error: Some(format!("could not locate exe: {err}")),
            };
        }
    };

    // Use PowerShell Get-AuthenticodeSignature
    let script = format!(
        "(Get-AuthenticodeSignature '{}' | Select-Object -Property Status, SignerCertificate | ConvertTo-Json -Compress)",
        exe.display()
    );
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-Command", &script])
        .output();

    let output = match output {
        Ok(o) => o,
        Err(err) => {
            return SigningInfo {
                platform: "windows".to_string(),
                signed: false,
                signer: None,
                detail: String::new(),
                error: Some(format!("PowerShell unavailable: {err}")),
            };
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::Value::Null);
    let status = parsed
        .get("Status")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let subject = parsed
        .get("SignerCertificate")
        .and_then(|c| c.get("Subject"))
        .and_then(|v| v.as_str())
        .map(str::to_string);

    let signed = status.as_deref() == Some("Valid");
    SigningInfo {
        platform: "windows".to_string(),
        signed,
        signer: subject.clone(),
        detail: stdout,
        error: None,
    }
}

#[cfg(not(target_os = "windows"))]
fn signing_info_windows() -> SigningInfo {
    SigningInfo {
        platform: env::consts::OS.to_string(),
        signed: false,
        signer: None,
        detail: String::new(),
        error: Some("Windows-only".to_string()),
    }
}
```

Register in `tauri::generate_handler![...]`:

```rust
            signing_info,
```

**HTML — add header trust pill.** In `installer/rust-gui/ui/index.html`, find the existing `<div class="intro">` block at the top of the workspace. Add a header element above (or modify the existing one) to include a trust pill:

Find:

```html
<div class="intro">
  <p class="eyebrow">Community Edition</p>
  <h1>Install Parthenon</h1>
  <p>Set the admin account, check the machine, then start the Community installer. The app handles the installer details for you.</p>
</div>
```

Replace with:

```html
<div class="intro">
  <div class="intro-row">
    <p class="eyebrow">Community Edition</p>
    <span id="trust-pill" class="trust-pill" hidden title="Loading signing info…">
      <span id="trust-pill-icon">·</span>
      <span id="trust-pill-text">Checking signature…</span>
    </span>
  </div>
  <h1>Install Parthenon</h1>
  <p>Set the admin account, check the machine, then start the Community installer. The app handles the installer details for you.</p>
</div>
```

**HTML — add Gatekeeper + SmartScreen banner.** Place these inside `<main class="app-shell">` near the top, before the existing form:

```html
<aside id="gatekeeper-banner" class="trust-banner trust-banner-mac" hidden>
  <span class="trust-banner-icon">🛡</span>
  <div class="trust-banner-content">
    <strong>This app is signed by Acumenus Data Sciences and notarized by Apple.</strong>
    If macOS ever shows "cannot be opened because the developer cannot be verified", control-click the .app and choose Open.
    <a href="#" id="gatekeeper-docs">Learn more</a>
  </div>
  <button id="gatekeeper-dismiss" type="button" class="trust-banner-dismiss" title="Don't show again">×</button>
</aside>

<aside id="smartscreen-banner" class="trust-banner trust-banner-win" hidden>
  <span class="trust-banner-icon">🛡</span>
  <div class="trust-banner-content">
    <strong>This installer is Authenticode-signed via Azure Trusted Signing.</strong>
    Until our SmartScreen reputation accrues, Windows may show "Microsoft Defender SmartScreen prevented...". Click "More info" → "Run anyway".
    <a href="#" id="smartscreen-docs">Learn more</a>
  </div>
  <button id="smartscreen-dismiss" type="button" class="trust-banner-dismiss" title="Don't show again">×</button>
</aside>
```

**CSS — append**:

```css
.intro-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.trust-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #181820;
  border: 1px solid #2a2a35;
  color: #94a3b8;
  cursor: help;
}
.trust-pill.signed {
  border-color: #2DD4BF;
  color: #2DD4BF;
}
.trust-pill.unsigned {
  border-color: #C9A227;
  color: #C9A227;
}
.trust-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #181820;
  border: 1px solid #2a2a35;
  border-left: 3px solid #2DD4BF;
  border-radius: 6px;
  padding: 12px 16px;
  margin: 12px 0;
  font-size: 13px;
  color: #cbd5e1;
}
.trust-banner-icon {
  font-size: 18px;
  margin-top: 2px;
}
.trust-banner-content {
  flex: 1;
  line-height: 1.5;
}
.trust-banner-content strong {
  display: block;
  color: #fafafa;
  margin-bottom: 4px;
}
.trust-banner-content a {
  color: #2DD4BF;
  text-decoration: underline;
  margin-left: 4px;
}
.trust-banner-dismiss {
  background: transparent;
  border: 0;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}
.trust-banner-dismiss:hover {
  color: #fafafa;
}
.trust-banner-mac {
  border-left-color: #2DD4BF;
}
.trust-banner-win {
  border-left-color: #C9A227;
}
```

**JS — add to `app.js`**. Place near the top of `boot()`:

```javascript
async function setupTrustIndicators() {
  // Trust pill in header
  let info;
  try {
    info = await invoke("signing_info", {});
  } catch (err) {
    return; // Silent — non-essential
  }

  const pill = document.querySelector("#trust-pill");
  const pillIcon = document.querySelector("#trust-pill-icon");
  const pillText = document.querySelector("#trust-pill-text");
  if (pill && pillIcon && pillText) {
    pill.hidden = false;
    if (info.signed && info.signer) {
      pill.classList.add("signed");
      pill.classList.remove("unsigned");
      pillIcon.textContent = "✓";
      pillText.textContent = `Signed: ${info.signer.split(",")[0].replace(/^CN=/, "")}`;
      pill.title = info.detail || "Verified signature";
    } else if (info.platform === "linux") {
      pill.classList.remove("signed", "unsigned");
      pillIcon.textContent = "·";
      pillText.textContent = "Linux: verify via SIGNING-KEY.asc";
      pill.title = info.detail || "See docs/install/verifying-signatures";
    } else {
      pill.classList.add("unsigned");
      pill.classList.remove("signed");
      pillIcon.textContent = "?";
      pillText.textContent = "Signature not detected";
      pill.title = info.error || info.detail || "No signature found on this binary";
    }
  }

  // First-launch banners — show once per platform unless dismissed
  const dismissedKey = "parthenon_trust_banner_dismissed";
  const dismissed = JSON.parse(localStorage.getItem(dismissedKey) || "{}");

  if (info.platform === "macos" && !dismissed.gatekeeper) {
    const banner = document.querySelector("#gatekeeper-banner");
    if (banner) banner.hidden = false;
  }
  if (info.platform === "windows" && !dismissed.smartscreen) {
    const banner = document.querySelector("#smartscreen-banner");
    if (banner) banner.hidden = false;
  }
}

function dismissBanner(bannerId, key) {
  const banner = document.querySelector(`#${bannerId}`);
  if (banner) banner.hidden = true;
  const dismissedKey = "parthenon_trust_banner_dismissed";
  const dismissed = JSON.parse(localStorage.getItem(dismissedKey) || "{}");
  dismissed[key] = true;
  localStorage.setItem(dismissedKey, JSON.stringify(dismissed));
}

document.querySelector("#gatekeeper-dismiss")?.addEventListener("click", () => {
  dismissBanner("gatekeeper-banner", "gatekeeper");
});
document.querySelector("#smartscreen-dismiss")?.addEventListener("click", () => {
  dismissBanner("smartscreen-banner", "smartscreen");
});
document.querySelector("#gatekeeper-docs")?.addEventListener("click", async (event) => {
  event.preventDefault();
  const shell = window.__TAURI__?.shell;
  if (shell?.open) {
    await shell.open("https://github.com/sudoshi/Parthenon/blob/main/docs/site/docs/install/first-launch-trust.mdx");
  }
});
document.querySelector("#smartscreen-docs")?.addEventListener("click", async (event) => {
  event.preventDefault();
  const shell = window.__TAURI__?.shell;
  if (shell?.open) {
    await shell.open("https://github.com/sudoshi/Parthenon/blob/main/docs/site/docs/install/first-launch-trust.mdx");
  }
});
```

Call `setupTrustIndicators()` from `boot()` after the existing initialization (e.g., after the WSL block or near the bottom of `boot()`).

**Verify + commit**:

```
cd installer/rust-gui
cargo fmt --check
cargo clippy --all-targets -- -D warnings 2>&1 | tail -3
cargo test 2>&1 | tail -3
cargo build --release 2>&1 | tail -3
```

Single commit:

```
git add installer/rust-gui/src/main.rs installer/rust-gui/ui/index.html installer/rust-gui/ui/app.js installer/rust-gui/ui/styles.css
git commit -m "feat(installer-gui): cross-platform trust indicators + first-launch banners

Header now shows a 'Signed: <CN>' pill when a code signature is
detected. macOS uses 'codesign -dv' on the resolved .app bundle.
Windows uses PowerShell Get-AuthenticodeSignature on the running exe.
Linux shows a neutral 'verify via SIGNING-KEY.asc' hint (signatures
are detached .asc files).

First-launch banners on macOS (Gatekeeper) and Windows (SmartScreen)
explain the OS warnings users may see and link to the verifying-
signatures docs page. Banners are dismissible and remembered via
localStorage per platform.

Spec E2, E3, E4. (E1 was completed in Phase 2 with the Tauri dialog
plugin.)"
```

---

### Task 2 — Final verification

```
cd installer/rust-gui
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build --release 2>&1 | tail -3

cd /home/smudoshi/Github/Parthenon/.worktrees/installer-phase-6
python -m pytest installer/tests/ 2>&1 | tail -3
```

Expected: all green; 31 cargo tests pass; 202 Python tests pass.

Verify 18 Tauri commands now registered (17 + signing_info):

```
bootstrap, validate_environment, preview_defaults, start_install,
wsl_distros, check_for_updates, health_check, service_status_check,
cancel_install, credentials_check, open_app_url,
runtime_image_check, runtime_image_pull,
recover_check, diagnose_check, try_fix, reset_install,
signing_info
```

---

## Phase 6 Done Criteria

- [ ] cargo build --release clean; clippy clean; fmt clean
- [ ] cargo test 31 passed; pytest 202 passed
- [ ] `signing_info` Tauri command exists and is registered
- [ ] Header has a `#trust-pill` element that updates from boot
- [ ] Gatekeeper banner shows on macOS, dismissible, remembered via localStorage
- [ ] SmartScreen banner shows on Windows, dismissible, remembered via localStorage
- [ ] Linux pill shows "verify via SIGNING-KEY.asc" hint
- [ ] No false positives on signing detection (test by running unsigned dev build — pill should show "Signature not detected" or hide)

## What Phase 6 Does NOT Include

- The actual `first-launch-trust.mdx` docs page (Phase 8)
- CI release plumbing changes (Phase 7)
- Real cryptographic verification of the running binary (the OS already did this; the indicator is informational only)
- Any change to the Phase 4 Done page or Phase 5 recovery panel
