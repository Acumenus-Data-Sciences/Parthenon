# Installer Phase 4 — Hero Done Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Done step with the spec's Hero Done page (D1–D11) — big "Open Parthenon" CTA, masked-with-reveal admin password, copy-to-clipboard buttons, "you can close this" framing, no-telemetry banner, advanced disclosure with service-status grid + runtime-image upgrade prompt, and the auto-updater check-for-updates banner.

**Architecture:** Pure UI work in `installer/rust-gui/ui/{index.html, app.js, styles.css}`. Calls existing contract actions (`credentials`, `service-status`, `health`, `open-app`) via the existing Tauri command shims (`health_check`, `service_status_check`) and existing Phase 2 plugins (`shell.open`, `check_for_updates`). One small Rust addition: a `credentials_check` Tauri shim mirroring Phase 3's `health_check` pattern.

**Tech Stack:** Plain HTML/CSS/JS, Rust + Tauri 2.x. Uses Phase 1 contract surface, Phase 2 plugins (shell, updater), and Phase 3 Rust shim helpers (`contract_payload_with_overrides`, `current_install_request_or_default`).

**Spec reference:** `docs/superpowers/specs/2026-04-24-installer-first-run-comprehensive-design.md` — Block 1 (Hero Done page) + Area D1–D11 + Area F6 (auto-updater banner UX).

**Plan reference:** Phases 1 (`b2ef2fe18`), 2 (`556e0e6ab`), 3 (`6b9daec44`) shipped. The credentials contract action ships in Phase 1; the shell.open plugin ships in Phase 2; the contract subprocess pattern ships in Phase 3.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `installer/rust-gui/src/main.rs` | MODIFY | Add `credentials_check` and `runtime_image_check` Tauri shims |
| `installer/rust-gui/ui/index.html` | MODIFY | New `#done-panel` Hero card; replace minimal Done area |
| `installer/rust-gui/ui/app.js` | MODIFY | `runDone()` orchestrator; service-status polling; updater banner |
| `installer/rust-gui/ui/styles.css` | MODIFY | Hero card, service-status grid, banner, masked-password styles |

No new files. All additive within existing files.

---

### Task 1: Hero Done page HTML scaffold + CSS

**Files:**
- Modify: `installer/rust-gui/ui/index.html` (replace nothing — Done step is currently event-message-only; add a new section)
- Modify: `installer/rust-gui/ui/styles.css`

- [ ] **Step 1: Add the Done panel section**

In `installer/rust-gui/ui/index.html`, near the Verify panel (which Phase 3 added in `<main class="app-shell">`), add a new section AFTER the verify-panel section:

```html
<section id="done-panel" class="form-section done-panel" hidden>
  <header class="done-header">
    <span class="done-eyebrow">Step 5 of 5 · Ready</span>
    <h2>Parthenon is ready</h2>
    <p class="done-tagline">Sign in once, then change the password. Parthenon will keep running as long as Docker is running — you can close this installer when you're done.</p>
  </header>

  <div class="done-card url-card">
    <div class="done-label">Sign in at</div>
    <div class="done-row">
      <code id="done-url">http://localhost:8082</code>
      <button class="copy-btn" data-copy-target="done-url" type="button" title="Copy URL">⎘</button>
    </div>
  </div>

  <div class="done-card credentials-card">
    <div class="done-row">
      <div class="done-col">
        <div class="done-label">Admin email</div>
        <div class="done-row">
          <code id="done-email">admin@example.com</code>
          <button class="copy-btn" data-copy-target="done-email" type="button" title="Copy email">⎘</button>
        </div>
      </div>
      <div class="done-col">
        <div class="done-label">Admin password</div>
        <div class="done-row">
          <code id="done-password" class="masked">••••••••••••</code>
          <button class="reveal-btn" id="reveal-password-btn" type="button" title="Show password (30s)">👁</button>
          <button class="copy-btn" data-copy-target="done-password" data-copy-source="real" type="button" title="Copy password">⎘</button>
        </div>
        <div class="done-hint" id="reveal-hint" hidden>Hidden again in <span id="reveal-countdown">30</span>s</div>
      </div>
    </div>
  </div>

  <button id="open-parthenon-btn" type="button" class="primary open-btn" disabled>Open Parthenon →</button>
  <p class="done-warning">On first sign-in, Parthenon will require you to change this password. That's the expected flow.</p>
  <p class="done-close-hint">You can close this installer once you're signed in. Parthenon runs as Docker services and stays at the URL above every time Docker is running.</p>

  <details class="advanced-disclosure">
    <summary>▼ Advanced · service status, logs, reset</summary>
    <div class="advanced-body">
      <div class="advanced-section">
        <h3>Service status</h3>
        <div id="service-status-grid" class="service-grid">
          <span class="service-status-loading">Loading…</span>
        </div>
      </div>
      <div class="advanced-section">
        <h3>Runtime image</h3>
        <div id="runtime-image-row">
          <span id="runtime-image-status">Checking for newer Parthenon images…</span>
          <button id="runtime-image-pull-btn" type="button" hidden>Pull newer images</button>
        </div>
      </div>
      <div class="advanced-section">
        <h3>Reset</h3>
        <p>Tear down the install (containers + state file + bundle cache + .install-credentials). Does NOT drop databases.</p>
        <button id="reset-everything-btn" type="button" class="danger-btn">Reset everything</button>
      </div>
    </div>
  </details>

  <footer class="done-footer">
    <div class="telemetry-banner">
      ✓ Zero telemetry. This installer connects to GitHub Releases and Docker Hub only.
      <a href="#" id="telemetry-docs-link">Learn more</a>
    </div>
    <div class="feedback-link">
      Was this install painful?
      <a href="#" id="feedback-link">Tell us at github.com/sudoshi/Parthenon/discussions</a>
    </div>
  </footer>
</section>

<aside id="updater-banner" class="updater-banner" hidden>
  <span id="updater-banner-text">Checking for updates…</span>
  <button id="updater-download-btn" type="button" hidden>Download &amp; install</button>
  <button id="updater-dismiss-btn" type="button" class="updater-dismiss" title="Dismiss">×</button>
</aside>
```

- [ ] **Step 2: Append CSS**

Append to `installer/rust-gui/ui/styles.css`:

```css
.done-panel {
  background: linear-gradient(180deg, #181820 0%, #0E0E11 100%);
  border-radius: 12px;
  padding: 32px;
  margin-top: 16px;
  border: 1px solid #2a2a35;
}
.done-header {
  margin-bottom: 24px;
}
.done-eyebrow {
  display: inline-block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: #2DD4BF;
  margin-bottom: 8px;
}
.done-header h2 {
  margin: 0 0 8px 0;
  font-size: 28px;
}
.done-tagline {
  color: #94a3b8;
  font-size: 14px;
  max-width: 56ch;
}
.done-card {
  background: #181820;
  border: 1px solid #2a2a35;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}
.url-card {
  border-color: #2DD4BF;
}
.url-card code {
  color: #2DD4BF;
  font-size: 16px;
  font-weight: 600;
}
.credentials-card .done-row {
  align-items: stretch;
  gap: 24px;
}
.credentials-card .done-col {
  flex: 1;
}
.done-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #64748b;
  margin-bottom: 6px;
}
.done-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.done-row code {
  font-family: ui-monospace, monospace;
  background: #0E0E11;
  padding: 6px 10px;
  border-radius: 4px;
  flex: 1;
  font-size: 13px;
}
.done-row code.masked {
  letter-spacing: 0.2em;
}
.copy-btn,
.reveal-btn {
  background: transparent;
  border: 1px solid #2a2a35;
  color: #94a3b8;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 120ms;
}
.copy-btn:hover,
.reveal-btn:hover {
  border-color: #2DD4BF;
  color: #2DD4BF;
}
.copy-btn.copied {
  border-color: #2DD4BF;
  color: #2DD4BF;
  background: rgba(45, 212, 191, 0.1);
}
.done-hint {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}
.open-btn {
  display: block;
  width: 100%;
  padding: 16px 24px;
  background: #9B1B30;
  color: #fafafa;
  border: 0;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin: 24px 0 8px 0;
  transition: all 120ms;
}
.open-btn:enabled:hover {
  background: #b71c3a;
}
.open-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.done-warning {
  font-size: 13px;
  color: #C9A227;
  margin: 8px 0 4px 0;
}
.done-close-hint {
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
  margin: 0 0 24px 0;
}
.advanced-disclosure {
  margin-top: 24px;
  border-top: 1px solid #2a2a35;
  padding-top: 16px;
}
.advanced-disclosure > summary {
  cursor: pointer;
  font-size: 14px;
  color: #94a3b8;
  user-select: none;
  list-style: none;
  padding: 8px 0;
}
.advanced-disclosure > summary::-webkit-details-marker {
  display: none;
}
.advanced-disclosure[open] > summary {
  color: #cbd5e1;
}
.advanced-body {
  padding: 16px 0;
}
.advanced-section {
  margin-bottom: 24px;
}
.advanced-section h3 {
  font-size: 13px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0 0 12px 0;
}
.service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
.service-pip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: #181820;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
.service-pip.healthy {
  color: #2DD4BF;
}
.service-pip.starting {
  color: #C9A227;
}
.service-pip.unhealthy,
.service-pip.exited {
  color: #f87171;
}
.service-pip-icon {
  font-weight: bold;
  width: 1em;
}
.service-status-loading {
  color: #94a3b8;
  font-size: 12px;
}
#runtime-image-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #cbd5e1;
}
#runtime-image-pull-btn {
  background: #2DD4BF;
  color: #0E0E11;
  border: 0;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
.danger-btn {
  background: transparent;
  color: #f87171;
  border: 1px solid #f87171;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.danger-btn:hover {
  background: rgba(248, 113, 113, 0.1);
}
.done-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #2a2a35;
}
.telemetry-banner {
  font-size: 12px;
  color: #2DD4BF;
  margin-bottom: 8px;
}
.telemetry-banner a {
  color: #94a3b8;
  margin-left: 8px;
  text-decoration: underline;
}
.feedback-link {
  font-size: 11px;
  color: #64748b;
}
.feedback-link a {
  color: #94a3b8;
  text-decoration: underline;
}
.updater-banner {
  position: fixed;
  top: 16px;
  right: 16px;
  background: #181820;
  border: 1px solid #C9A227;
  border-radius: 8px;
  padding: 12px 16px;
  color: #C9A227;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.updater-banner button {
  background: #C9A227;
  color: #0E0E11;
  border: 0;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
.updater-banner .updater-dismiss {
  background: transparent;
  color: #94a3b8;
  font-size: 16px;
  padding: 0 4px;
}
```

- [ ] **Step 3: Build & smoke**

```
cd installer/rust-gui && cargo build 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```
git add installer/rust-gui/ui/index.html installer/rust-gui/ui/styles.css
git commit -m "feat(installer-gui): Hero Done page HTML + CSS scaffold

Builds the visual chassis for spec D1–D11 — URL card, credentials card,
'Open Parthenon' CTA, pre-warning + close-installer copy, advanced
disclosure (service grid + runtime image + reset), no-telemetry banner,
GH Discussions feedback link, and floating auto-updater banner.

JS wiring + behavior land in Tasks 2-5 of this phase. Spec D1-D11 + F6."
```

---

### Task 2: Credentials display + reveal/copy + Open CTA

**Files:**
- Modify: `installer/rust-gui/src/main.rs` (add `credentials_check` Tauri shim)
- Modify: `installer/rust-gui/ui/app.js`

- [ ] **Step 1: Add `credentials_check` Tauri shim**

In `installer/rust-gui/src/main.rs`, near `health_check` and `service_status_check`, add:

```rust
#[tauri::command]
fn credentials_check() -> Result<serde_json::Value, String> {
    let request = current_install_request_or_default();
    // credentials action bypasses --contract-redact via NON_REDACTABLE_ACTIONS,
    // so passing redact=true is safe and keeps everything else (config, etc.) redacted.
    let payload = contract_payload_with_overrides(&request, "credentials", true, None)?;
    serde_json::from_str(&payload).map_err(|e| format!("parse error: {e}"))
}

#[tauri::command]
fn open_app_url() -> Result<String, String> {
    let request = current_install_request_or_default();
    let payload = contract_payload_with_overrides(&request, "open-app", true, None)?;
    let parsed: serde_json::Value =
        serde_json::from_str(&payload).map_err(|e| format!("parse error: {e}"))?;
    parsed
        .get("url")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .ok_or_else(|| "open-app payload missing 'url' field".to_string())
}
```

Add `validate_contract_action` allowance for `"credentials"` and `"open-app"` (check the existing function — these may already be allowed since they're in the contract). If not, add them to the match arm.

Register both in `tauri::generate_handler![...]`:

```rust
            credentials_check,
            open_app_url,
```

- [ ] **Step 2: Verify Rust still builds**

```
cd installer/rust-gui && cargo build 2>&1 | tail -3
cargo clippy --all-targets -- -D warnings 2>&1 | tail -3
cargo fmt --check
```

- [ ] **Step 3: Add Done-page state + setup function in `app.js`**

Near the top of `app.js`, after the existing state object:

```javascript
const doneState = {
  realPassword: null,
  appUrl: null,
  revealTimer: null,
  revealCountdownTimer: null,
};
```

Add a `runDone()` function that the existing `setStep("done")` call should trigger. Modify the Verify-pass path in `pollHealth()` and `runVerify()`:

In `pollHealth`, replace the success block:

```javascript
    if (result.ready) {
      ["nginx", "php", "postgres", "health", "frontend"].forEach((name) => setVerifyRow(name, true));
      setStatus("Parthenon is ready", "success");
      setTimeout(() => {
        setStep("done");
        runDone();
      }, 1000);
      return;
    }
```

Add `runDone()`:

```javascript
async function runDone() {
  const panel = document.querySelector("#done-panel");
  if (panel) panel.hidden = false;

  // Fetch credentials
  try {
    const creds = await invoke("credentials_check", {});
    if (creds && creds.admin_email) {
      const emailEl = document.querySelector("#done-email");
      if (emailEl) emailEl.textContent = creds.admin_email;
    }
    if (creds && creds.admin_password) {
      doneState.realPassword = creds.admin_password;
    } else if (creds && creds.error) {
      const passwordEl = document.querySelector("#done-password");
      if (passwordEl) passwordEl.textContent = creds.error;
    }
  } catch (err) {
    setStatus(`Could not read credentials: ${err}`, "error");
  }

  // Resolve canonical URL
  try {
    const url = await invoke("open_app_url", {});
    if (url) {
      doneState.appUrl = url;
      const urlEl = document.querySelector("#done-url");
      if (urlEl) urlEl.textContent = url;
    }
  } catch (err) {
    // Fall back to default; the Open button will use whatever's in #done-url
  }

  // Final readiness check then enable Open button
  try {
    const health = await invoke("health_check", { attempt: 1 });
    const openBtn = document.querySelector("#open-parthenon-btn");
    if (openBtn) openBtn.disabled = !health.ready;
  } catch (err) {
    // Leave button disabled
  }

  // Kick off other Done-page widgets (Tasks 4-5)
  if (typeof startServiceStatusPolling === "function") startServiceStatusPolling();
  if (typeof checkRuntimeImage === "function") checkRuntimeImage();
  if (typeof checkForUpdatesBanner === "function") checkForUpdatesBanner();
}
```

- [ ] **Step 4: Wire copy buttons**

Add a generic copy handler near the bottom of `app.js`:

```javascript
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    // Fall through to fallback
  }
  // Fallback: hidden textarea + execCommand
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch (err) {
    return false;
  }
}

document.addEventListener("click", async (event) => {
  const btn = event.target.closest(".copy-btn");
  if (!btn) return;
  const targetId = btn.dataset.copyTarget;
  const useReal = btn.dataset.copySource === "real";
  let text = "";
  if (useReal && targetId === "done-password" && doneState.realPassword) {
    text = doneState.realPassword;
  } else {
    const target = document.querySelector(`#${targetId}`);
    text = target ? target.textContent : "";
  }
  if (!text) return;
  const ok = await copyToClipboard(text);
  if (ok) {
    btn.classList.add("copied");
    btn.textContent = "✓";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.textContent = "⎘";
    }, 1500);
  }
});
```

- [ ] **Step 5: Wire reveal button (30 s timeout)**

```javascript
document.querySelector("#reveal-password-btn")?.addEventListener("click", () => {
  const passwordEl = document.querySelector("#done-password");
  const hintEl = document.querySelector("#reveal-hint");
  const countdownEl = document.querySelector("#reveal-countdown");
  if (!passwordEl || !doneState.realPassword) return;

  // Clear any existing timers
  if (doneState.revealTimer) clearTimeout(doneState.revealTimer);
  if (doneState.revealCountdownTimer) clearInterval(doneState.revealCountdownTimer);

  passwordEl.textContent = doneState.realPassword;
  passwordEl.classList.remove("masked");
  if (hintEl) hintEl.hidden = false;

  let remaining = 30;
  if (countdownEl) countdownEl.textContent = String(remaining);

  doneState.revealCountdownTimer = setInterval(() => {
    remaining -= 1;
    if (countdownEl) countdownEl.textContent = String(Math.max(remaining, 0));
  }, 1000);

  doneState.revealTimer = setTimeout(() => {
    passwordEl.textContent = "••••••••••••";
    passwordEl.classList.add("masked");
    if (hintEl) hintEl.hidden = true;
    if (doneState.revealCountdownTimer) clearInterval(doneState.revealCountdownTimer);
    doneState.revealTimer = null;
    doneState.revealCountdownTimer = null;
  }, 30000);
});
```

- [ ] **Step 6: Wire Open Parthenon CTA (uses Tauri shell.open)**

```javascript
document.querySelector("#open-parthenon-btn")?.addEventListener("click", async () => {
  const url = doneState.appUrl || document.querySelector("#done-url")?.textContent;
  if (!url) {
    setStatus("No app URL configured", "error");
    return;
  }
  try {
    const shell = window.__TAURI__?.shell;
    if (shell?.open) {
      await shell.open(url);
    } else {
      // Fallback: open in webview's parent — won't work in pure Tauri but acceptable degradation
      window.open(url, "_blank");
    }
    setStatus(`Opened ${url} in your browser. Sign in with the email and password above.`, "success");
  } catch (err) {
    setStatus(`Could not open browser: ${err}`, "error");
  }
});
```

- [ ] **Step 7: Wire telemetry-docs link + feedback link**

```javascript
document.querySelector("#telemetry-docs-link")?.addEventListener("click", async (event) => {
  event.preventDefault();
  const shell = window.__TAURI__?.shell;
  if (shell?.open) {
    await shell.open("https://github.com/sudoshi/Parthenon/blob/main/docs/site/docs/install/no-telemetry.mdx");
  }
});

document.querySelector("#feedback-link")?.addEventListener("click", async (event) => {
  event.preventDefault();
  const shell = window.__TAURI__?.shell;
  if (shell?.open) {
    await shell.open("https://github.com/sudoshi/Parthenon/discussions");
  }
});
```

- [ ] **Step 8: Build, test, commit**

```
cd installer/rust-gui
cargo build 2>&1 | tail -3
cargo test 2>&1 | tail -3
cargo clippy --all-targets -- -D warnings 2>&1 | tail -3
cargo fmt --check
```

```
git add installer/rust-gui/src/main.rs installer/rust-gui/ui/app.js
git commit -m "feat(installer-gui): Hero Done page wiring — credentials, Open CTA, copy

Calls the Phase 1 'credentials' contract action via a new credentials_check
Tauri shim. Renders admin_email + masked password (••••••••••••), with
a 30 s reveal timer and copy-to-clipboard buttons (clipboard API with
execCommand fallback). 'Open Parthenon' CTA uses tauri-plugin-shell to
open the URL in the user's default browser.

Spec D1-D6 + telemetry/feedback links D7-D8."
```

---

### Task 3: Service-status grid + Runtime image upgrade prompt

**Files:**
- Modify: `installer/rust-gui/src/main.rs` (add `runtime_image_check` Tauri shim using docker compose pull --dry-run)
- Modify: `installer/rust-gui/ui/app.js`

- [ ] **Step 1: Add `runtime_image_check` Rust command**

In `installer/rust-gui/src/main.rs`:

```rust
#[derive(Debug, Serialize)]
struct RuntimeImageStatus {
    available: bool,
    has_updates: bool,
    detail: String,
    error: Option<String>,
}

#[tauri::command]
fn runtime_image_check() -> RuntimeImageStatus {
    // Run docker compose pull --dry-run --quiet to check whether newer
    // images are available. Exit code 0 means images already up-to-date;
    // any pulled image manifests in stdout indicate an update is available.
    // We don't actually pull — that's user-initiated.
    let output = match Command::new("docker")
        .args(["compose", "pull", "--quiet", "--dry-run"])
        .output()
    {
        Ok(o) => o,
        Err(err) => {
            return RuntimeImageStatus {
                available: false,
                has_updates: false,
                detail: String::new(),
                error: Some(format!("docker compose not available: {err}")),
            };
        }
    };

    if !output.status.success() {
        // Could be no compose file in cwd, or some other error
        return RuntimeImageStatus {
            available: false,
            has_updates: false,
            detail: String::new(),
            error: Some(
                String::from_utf8_lossy(&output.stderr)
                    .trim()
                    .to_string(),
            ),
        };
    }

    // dry-run output: each line that mentions "Pulling" or contains a digest
    // indicates a service that would be pulled. Empty stdout = up to date.
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let has_updates = stdout
        .lines()
        .any(|line| !line.trim().is_empty());
    let detail = if has_updates {
        format!("{} updated images available", stdout.lines().filter(|l| !l.trim().is_empty()).count())
    } else {
        "All Parthenon images are up to date".to_string()
    };

    RuntimeImageStatus {
        available: true,
        has_updates,
        detail,
        error: None,
    }
}

#[tauri::command]
fn runtime_image_pull(app: AppHandle) -> Result<String, String> {
    // Run docker compose pull (non-dry-run). Stream output via install-log events
    // so the GUI can show progress. This is non-blocking — kicks off a thread.
    thread::spawn(move || {
        let mut child = match Command::new("docker")
            .args(["compose", "pull"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(err) => {
                emit_log(&app, "stderr", &format!("docker compose pull failed to start: {err}"));
                return;
            }
        };

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let app_out = app.clone();
        let app_err = app.clone();
        let h_out = stdout.map(|s| thread::spawn(move || read_stream(s, app_out, "stdout")));
        let h_err = stderr.map(|s| thread::spawn(move || read_stream(s, app_err, "stderr")));

        let _ = child.wait();
        if let Some(h) = h_out { let _ = h.join(); }
        if let Some(h) = h_err { let _ = h.join(); }
        emit_log(&app, "stdout", "Pull complete. Restart Docker to pick up the new images.");
    });
    Ok("Pull started in background".to_string())
}
```

Register both in `generate_handler![...]`:

```rust
            runtime_image_check,
            runtime_image_pull,
```

- [ ] **Step 2: JS — service status polling**

Add to `app.js`:

```javascript
let serviceStatusTimer = null;

async function pollServiceStatus() {
  try {
    const status = await invoke("service_status_check", {});
    renderServiceGrid(status);
  } catch (err) {
    const grid = document.querySelector("#service-status-grid");
    if (grid) grid.innerHTML = `<span class="service-status-loading">Could not read status: ${escapeHtml(String(err))}</span>`;
  }
}

function renderServiceGrid(status) {
  const grid = document.querySelector("#service-status-grid");
  if (!grid) return;
  if (!status?.available) {
    grid.innerHTML = `<span class="service-status-loading">Service status unavailable</span>`;
    return;
  }
  const services = status.services || [];
  if (services.length === 0) {
    grid.innerHTML = `<span class="service-status-loading">No services running</span>`;
    return;
  }
  grid.innerHTML = services.map((s) => {
    let cls = "service-pip";
    let icon = "○";
    if (s.health === "healthy" || (s.state === "running" && s.health === "none")) {
      cls += " healthy";
      icon = "✓";
    } else if (s.health === "starting") {
      cls += " starting";
      icon = "…";
    } else if (s.state === "exited" || s.state === "dead") {
      cls += " unhealthy";
      icon = "✗";
    } else {
      cls += " starting";
      icon = "…";
    }
    return `<span class="${cls}"><span class="service-pip-icon">${icon}</span>${escapeHtml(s.name)}</span>`;
  }).join("");
}

function startServiceStatusPolling() {
  // Only poll while the Advanced section is open
  const details = document.querySelector(".advanced-disclosure");
  if (!details) return;
  const tick = () => {
    if (details.open) {
      pollServiceStatus();
    }
  };
  pollServiceStatus(); // immediate
  if (serviceStatusTimer) clearInterval(serviceStatusTimer);
  serviceStatusTimer = setInterval(tick, 5000);
  details.addEventListener("toggle", () => {
    if (details.open) pollServiceStatus();
  });
}
```

- [ ] **Step 3: JS — runtime image check**

```javascript
async function checkRuntimeImage() {
  try {
    const result = await invoke("runtime_image_check", {});
    const statusEl = document.querySelector("#runtime-image-status");
    const pullBtn = document.querySelector("#runtime-image-pull-btn");
    if (!statusEl) return;
    if (!result.available) {
      statusEl.textContent = result.error || "Could not check for image updates";
      return;
    }
    statusEl.textContent = result.detail;
    if (pullBtn) pullBtn.hidden = !result.has_updates;
  } catch (err) {
    const statusEl = document.querySelector("#runtime-image-status");
    if (statusEl) statusEl.textContent = `Could not check: ${err}`;
  }
}

document.querySelector("#runtime-image-pull-btn")?.addEventListener("click", async () => {
  const pullBtn = document.querySelector("#runtime-image-pull-btn");
  if (pullBtn) {
    pullBtn.disabled = true;
    pullBtn.textContent = "Pulling…";
  }
  try {
    await invoke("runtime_image_pull", {});
    const statusEl = document.querySelector("#runtime-image-status");
    if (statusEl) statusEl.textContent = "Pull started — see the log panel for progress";
  } catch (err) {
    setStatus(`Could not start pull: ${err}`, "error");
    if (pullBtn) {
      pullBtn.disabled = false;
      pullBtn.textContent = "Pull newer images";
    }
  }
});
```

- [ ] **Step 4: JS — Reset button**

```javascript
document.querySelector("#reset-everything-btn")?.addEventListener("click", async () => {
  const ok = window.confirm(
    "This will tear down all Parthenon containers, delete the install state file, the bundle cache, and .install-credentials. Databases are NOT dropped. Continue?"
  );
  if (!ok) return;
  // For now, just emit instructions to the log — actual reset implementation
  // requires a 'reset' contract action which is Phase 5 work.
  appendLog("Reset is currently a manual operation. Run:", "stdout");
  appendLog("  cd " + (doneState.appUrl ? "your install dir" : "your install dir"), "stdout");
  appendLog("  docker compose down -v", "stdout");
  appendLog("  rm -f .install-state.json .install-credentials", "stdout");
  appendLog("  rm -rf .acropolis-installer", "stdout");
  setStatus("Reset instructions emitted to log. Reset action automation lands in Phase 5.", "info");
});
```

- [ ] **Step 5: Build, test, commit**

```
cd installer/rust-gui
cargo build 2>&1 | tail -3
cargo test 2>&1 | tail -3
cargo clippy --all-targets -- -D warnings 2>&1 | tail -3
cargo fmt --check
```

```
git add installer/rust-gui/src/main.rs installer/rust-gui/ui/app.js
git commit -m "feat(installer-gui): service-status grid + runtime-image upgrade prompt

Service-status grid: polls Phase 3 service_status_check every 5 s while
the Advanced section is expanded; renders one pip per service (healthy /
starting / unhealthy) using docker compose ps state + health.

Runtime-image upgrade: new runtime_image_check command runs 'docker
compose pull --dry-run' to detect drift; if newer images exist, shows
a 'Pull newer images' button that streams docker compose pull output
to the log panel via background thread.

Reset button: emits manual instructions; full automation in Phase 5.

Spec D9-D11."
```

---

### Task 4: Auto-updater banner

**Files:**
- Modify: `installer/rust-gui/ui/app.js`

- [ ] **Step 1: Wire the banner**

Add to `app.js`:

```javascript
async function checkForUpdatesBanner() {
  // Cache check for 24 h (no need to hit GitHub on every Done-page view)
  const cacheKey = "parthenon_updater_check_at";
  const lastCheck = localStorage.getItem(cacheKey);
  if (lastCheck) {
    const elapsed = Date.now() - parseInt(lastCheck, 10);
    if (elapsed < 24 * 60 * 60 * 1000) {
      // Don't show banner — already checked today
      return;
    }
  }
  localStorage.setItem(cacheKey, String(Date.now()));

  let result;
  try {
    result = await invoke("check_for_updates", {});
  } catch (err) {
    return; // Silent failure; updater banner is non-essential
  }

  if (!result?.has_update) return;

  const banner = document.querySelector("#updater-banner");
  const text = document.querySelector("#updater-banner-text");
  const downloadBtn = document.querySelector("#updater-download-btn");
  if (!banner || !text) return;

  text.textContent = `New installer ${result.latest_version} available (you're on ${result.current_version})`;
  if (downloadBtn) downloadBtn.hidden = false;
  banner.hidden = false;
}

document.querySelector("#updater-dismiss-btn")?.addEventListener("click", () => {
  const banner = document.querySelector("#updater-banner");
  if (banner) banner.hidden = true;
});

document.querySelector("#updater-download-btn")?.addEventListener("click", async () => {
  const downloadBtn = document.querySelector("#updater-download-btn");
  if (downloadBtn) {
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Verifying signature…";
  }
  try {
    // The updater plugin handles download + signature verification + install.
    // Use the JS API directly: window.__TAURI__.updater.check() then update.downloadAndInstall().
    const updater = window.__TAURI__?.updater;
    if (!updater) {
      throw new Error("updater plugin not available");
    }
    const update = await updater.check();
    if (update?.available) {
      await update.downloadAndInstall();
      // App will relaunch automatically
    }
  } catch (err) {
    setStatus(`Update failed: ${err}`, "error");
    if (downloadBtn) {
      downloadBtn.disabled = false;
      downloadBtn.textContent = "Download & install";
    }
  }
});
```

- [ ] **Step 2: Trigger on bootstrap (not just Done)**

In `boot()`, after the existing initialization (after wsl_distros), add:

```javascript
  // Auto-updater check (cached 24 h via localStorage)
  if (typeof checkForUpdatesBanner === "function") {
    checkForUpdatesBanner();
  }
```

This ensures the banner can fire on any session, not just after install.

- [ ] **Step 3: Build, test, commit**

```
cd installer/rust-gui
cargo build 2>&1 | tail -3
cargo test 2>&1 | tail -3
cargo clippy --all-targets -- -D warnings 2>&1 | tail -3
cargo fmt --check
```

```
git add installer/rust-gui/ui/app.js
git commit -m "feat(installer-gui): auto-updater notify-only banner

On bootstrap (cached 24 h via localStorage), invokes Phase 2's
check_for_updates command. If a newer signed installer is available,
shows a floating banner with version info and a 'Download & install'
button that uses tauri-plugin-updater's signature-verifying installer.

Notify-only — never auto-installs. Dismissible. Spec auto-updater stance."
```

---

### Task 5: Final verification

- [ ] **Step 1: Full Rust toolchain**

```
cd installer/rust-gui
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build --release 2>&1 | tail -3
```

- [ ] **Step 2: Python tests still pass**

```
cd /home/smudoshi/Github/Parthenon/.worktrees/installer-phase-4
python -m pytest installer/tests/ 2>&1 | tail -3
```

Expected: 202 passed.

- [ ] **Step 3: Verify all Tauri commands registered**

Should now have these in `generate_handler![...]`:

```
bootstrap,
validate_environment,
preview_defaults,
start_install,
wsl_distros,
check_for_updates,
health_check,
service_status_check,
cancel_install,
credentials_check,
open_app_url,
runtime_image_check,
runtime_image_pull,
```

- [ ] **Step 4: No commit at this step.**

---

## Phase 4 Done Criteria

- [ ] All 4 tasks complete with their commits
- [ ] `cargo build --release` succeeds
- [ ] `cargo test` passes
- [ ] `cargo clippy --all-targets -- -D warnings` clean
- [ ] `cargo fmt --check` clean
- [ ] `python -m pytest installer/tests/` still 202 passing
- [ ] `#done-panel` HTML exists with all D1-D11 elements
- [ ] Credentials display calls `credentials_check`, masks password by default, 30 s reveal timer works
- [ ] Copy buttons work via `navigator.clipboard.writeText` (with execCommand fallback)
- [ ] Open Parthenon CTA enabled only when `health` returns `ready: true`; click invokes Tauri `shell.open`
- [ ] Service-status grid polls every 5 s while Advanced is expanded
- [ ] Runtime-image-upgrade prompt shows "Pull newer images" button when drift detected
- [ ] Auto-updater banner fires on bootstrap (24 h cached)

## What Phase 4 Does NOT Include

- Recovery panel UI for failed installs (Phase 5 — uses Phase 1's `recover` action)
- Full automated reset action (Phase 5 — currently emits manual instructions)
- Per-service health probes (deferred — single `/api/v1/health` probe still drives Verify checklist)
- Gatekeeper / SmartScreen banners (Phase 6)
- CI release plumbing (Phase 7)
- Documentation pages for verifying-signatures, no-telemetry, first-launch-trust (Phase 8)

The Phase 4 commit set should be self-contained — pass CI on its own, leave Phase 5+ unblocked.
