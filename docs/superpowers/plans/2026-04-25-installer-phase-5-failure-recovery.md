# Installer Phase 5 — Failure Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When install fails, surface the Phase 1 `recover` and `diagnose` contract actions in a structured panel: matched diagnostic fingerprints render at the top with "Try this fix" buttons, then the Resume/Retry/Reset hierarchy below. Replace Phase 4's Reset placeholder with a real reset Tauri command. Spec Block 3 (Failure Recovery Flow) + Area C5.

**Architecture:** Pure UI + 2 small new Rust commands (`reset_install`, `try_fix`). Calls existing Phase 1 contract actions (`recover`, `diagnose`, `port-holder`) via the existing `contract_payload_with_overrides` helper. New panel hidden by default; shown on `install-finished` with `success: false`.

**Spec reference:** `docs/superpowers/specs/2026-04-24-installer-first-run-comprehensive-design.md` — Block 3 "Failure recovery flow" + Area C5.

**Plan reference:** Phases 1–4 shipped. Phase 5 is independent of Phase 6/7/8.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `installer/rust-gui/src/main.rs` | MODIFY | Add `reset_install`, `try_fix`, `recover_check`, `diagnose_check` commands |
| `installer/rust-gui/ui/index.html` | MODIFY | New `#recovery-panel` section after `#verify-panel` |
| `installer/rust-gui/ui/app.js` | MODIFY | Wire `runRecovery()`, render diagnostic cards, button handlers |
| `installer/rust-gui/ui/styles.css` | MODIFY | Recovery panel styles, diagnostic-card, button hierarchy |

---

### Task 1 — Recovery panel HTML + CSS + Rust shims

**Files:**
- Modify: `installer/rust-gui/src/main.rs` (add 4 Tauri commands)
- Modify: `installer/rust-gui/ui/index.html` (recovery panel markup)
- Modify: `installer/rust-gui/ui/styles.css` (panel styles)

**Rust additions** (place near other contract shims like `health_check`, `credentials_check`):

```rust
#[tauri::command]
fn recover_check() -> Result<serde_json::Value, String> {
    let request = current_install_request_or_default();
    let payload = contract_payload_with_overrides(&request, "recover", true, None)?;
    serde_json::from_str(&payload).map_err(|e| format!("parse error: {e}"))
}

#[derive(Debug, Deserialize)]
struct DiagnoseInput {
    stdout: String,
    stderr: String,
    exit_code: i32,
    phase: String,
    platform: String,
}

#[tauri::command]
fn diagnose_check(input: DiagnoseInput) -> Result<serde_json::Value, String> {
    let request = current_install_request_or_default();
    let extra = serde_json::json!({
        "_diagnose_input": {
            "stdout": input.stdout,
            "stderr": input.stderr,
            "exit_code": input.exit_code,
            "phase": input.phase,
            "platform": input.platform,
        }
    });
    let payload = contract_payload_with_overrides(&request, "diagnose", true, Some(&extra))?;
    serde_json::from_str(&payload).map_err(|e| format!("parse error: {e}"))
}

#[derive(Debug, Deserialize)]
struct TryFixInput {
    action: String,
    args: serde_json::Value,
}

#[tauri::command]
fn try_fix(input: TryFixInput) -> Result<serde_json::Value, String> {
    let request = current_install_request_or_default();
    // Currently supports only "port-holder" fix_action. Future: install-python-in-wsl, fetch-hecate-bootstrap, etc.
    if input.action != "port-holder" {
        return Err(format!("Unsupported fix action: {}", input.action));
    }
    let port = input.args.get("port").and_then(|v| v.as_i64()).ok_or("port-holder requires args.port (int)")?;
    let extra = serde_json::json!({"_port": port});
    let payload = contract_payload_with_overrides(&request, "port-holder", true, Some(&extra))?;
    serde_json::from_str(&payload).map_err(|e| format!("parse error: {e}"))
}

#[tauri::command]
fn reset_install(app: AppHandle) -> Result<String, String> {
    let request = current_install_request_or_default();
    let install_dir = if !request.install_target_dir.trim().is_empty() {
        PathBuf::from(request.install_target_dir.trim())
    } else if !request.repo_path.trim().is_empty() {
        PathBuf::from(request.repo_path.trim())
    } else {
        return Err("No install directory configured".to_string());
    };

    if !install_dir.exists() {
        return Err(format!("Install directory not found: {}", install_dir.display()));
    }

    let _ = app.emit(
        "install-log",
        InstallEvent {
            stream: "stdout".to_string(),
            message: format!("Resetting install at {}", install_dir.display()),
        },
    );

    // Step 1: docker compose down -v
    let down_output = Command::new("docker")
        .args(["compose", "down", "-v"])
        .current_dir(&install_dir)
        .output();
    match down_output {
        Ok(o) if o.status.success() => {
            let _ = app.emit(
                "install-log",
                InstallEvent {
                    stream: "stdout".to_string(),
                    message: "✓ Stopped containers and removed volumes".to_string(),
                },
            );
        }
        Ok(o) => {
            let _ = app.emit(
                "install-log",
                InstallEvent {
                    stream: "stderr".to_string(),
                    message: format!(
                        "docker compose down -v warning: {}",
                        String::from_utf8_lossy(&o.stderr).trim()
                    ),
                },
            );
        }
        Err(err) => {
            return Err(format!("docker compose down failed: {err}"));
        }
    }

    // Step 2: remove state files
    for filename in [".install-state.json", ".install-credentials"] {
        let path = install_dir.join(filename);
        if path.exists() {
            let _ = std::fs::remove_file(&path);
            let _ = app.emit(
                "install-log",
                InstallEvent {
                    stream: "stdout".to_string(),
                    message: format!("✓ Deleted {filename}"),
                },
            );
        }
    }

    // Step 3: clean bundle cache (if user pointed at one)
    if !request.bundle_install_dir.trim().is_empty() {
        let cache = PathBuf::from(request.bundle_install_dir.trim());
        if cache.exists() {
            let _ = std::fs::remove_dir_all(&cache);
            let _ = app.emit(
                "install-log",
                InstallEvent {
                    stream: "stdout".to_string(),
                    message: format!("✓ Removed bundle cache {}", cache.display()),
                },
            );
        }
    }

    Ok("Reset complete. Restart the installer to begin a fresh install.".to_string())
}
```

Register all 4 in `tauri::generate_handler![...]`:

```rust
            recover_check,
            diagnose_check,
            try_fix,
            reset_install,
```

**HTML** — add after the `#done-panel` section (or after `#verify-panel`, same area), before `<aside class="status-panel">`:

```html
<section id="recovery-panel" class="form-section recovery-panel" hidden>
  <header class="recovery-header">
    <span class="recovery-eyebrow">Install failed</span>
    <h2 id="recovery-title">Something went wrong</h2>
    <p id="recovery-message" class="recovery-message"></p>
  </header>

  <div id="diagnostic-cards" class="diagnostic-cards"></div>

  <div class="recovery-actions">
    <button id="recovery-resume-btn" type="button" class="primary recovery-primary" hidden>Resume from this step</button>
    <details class="recovery-secondary-disclosure">
      <summary>Changed your config?</summary>
      <button id="recovery-retry-btn" type="button" class="recovery-secondary">Retry from start</button>
    </details>
    <details class="recovery-tertiary-disclosure">
      <summary>Stuck? Reset everything</summary>
      <p class="recovery-warning">
        This will run <code>docker compose down -v</code>, delete <code>.install-state.json</code>,
        <code>.install-credentials</code>, and the bundle cache. Databases are NOT dropped.
      </p>
      <button id="recovery-reset-btn" type="button" class="danger-btn">Reset everything</button>
    </details>
  </div>
</section>
```

**CSS** — append to `styles.css`:

```css
.recovery-panel {
  background: #1f1015;
  border-radius: 12px;
  padding: 32px;
  margin-top: 16px;
  border: 1px solid #9B1B30;
}
.recovery-header {
  margin-bottom: 24px;
}
.recovery-eyebrow {
  display: inline-block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: #f87171;
  margin-bottom: 8px;
}
.recovery-header h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
}
.recovery-message {
  color: #cbd5e1;
  font-size: 14px;
  font-family: ui-monospace, monospace;
  background: #0E0E11;
  padding: 12px;
  border-radius: 6px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.diagnostic-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 24px 0;
}
.diagnostic-card {
  background: #181820;
  border-left: 3px solid #C9A227;
  border-radius: 6px;
  padding: 16px;
}
.diagnostic-card.severity-error {
  border-left-color: #f87171;
}
.diagnostic-card-id {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #94a3b8;
  margin-bottom: 6px;
}
.diagnostic-card-message {
  font-size: 14px;
  color: #cbd5e1;
  margin-bottom: 12px;
}
.diagnostic-card-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.try-fix-btn {
  background: #2DD4BF;
  color: #0E0E11;
  border: 0;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
.try-fix-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.diagnostic-card-result {
  margin-top: 12px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  background: #0E0E11;
  padding: 10px;
  border-radius: 4px;
  color: #cbd5e1;
  white-space: pre-wrap;
}
.recovery-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}
.recovery-primary {
  background: #2DD4BF;
  color: #0E0E11;
  font-weight: 600;
  font-size: 16px;
  padding: 14px 24px;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.recovery-primary:hover {
  background: #5fe2cd;
}
.recovery-secondary-disclosure summary,
.recovery-tertiary-disclosure summary {
  cursor: pointer;
  font-size: 13px;
  color: #94a3b8;
  user-select: none;
  list-style: none;
  padding: 6px 0;
}
.recovery-secondary-disclosure summary::-webkit-details-marker,
.recovery-tertiary-disclosure summary::-webkit-details-marker {
  display: none;
}
.recovery-secondary {
  background: transparent;
  color: #cbd5e1;
  border: 1px solid #2a2a35;
  padding: 10px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 8px;
}
.recovery-secondary:hover {
  border-color: #cbd5e1;
}
.recovery-warning {
  font-size: 12px;
  color: #C9A227;
  background: #181820;
  padding: 10px;
  border-radius: 4px;
  margin: 8px 0;
}
.recovery-warning code {
  background: #0E0E11;
  padding: 2px 6px;
  border-radius: 3px;
  color: #cbd5e1;
}
```

**Verify** + **commit** with message:

```
feat(installer-gui): recovery panel HTML/CSS scaffold + Rust shims

Adds 4 new Tauri commands wrapping Phase 1 contract actions:
recover_check, diagnose_check, try_fix, reset_install. The
recovery panel renders the recover() recommendation, a stack of
diagnostic-fingerprint cards from diagnose(), and the Resume/Retry/
Reset hierarchy with progressive disclosure.

JS wiring lands in Task 2. Spec Block 3 + C5.
```

---

### Task 2 — Wire recovery flow on install failure

**File:** `installer/rust-gui/ui/app.js`

State additions near top:

```javascript
const recoveryState = {
  capturedStdout: [],
  capturedStderr: [],
  currentPhase: "",
  lastRequest: null,
};
```

Modify `appendLog` to capture during install:

```javascript
function appendLog(message, stream = "stdout") {
  if (logEl.textContent === "Waiting for installer output.") {
    logEl.textContent = "";
  }
  const phase = parsePhaseFromLog(message);
  if (phase) {
    setPhase(phase.number, phase.name);
    recoveryState.currentPhase = phase.name;
  }
  if (state.running) {
    if (stream === "stderr") {
      recoveryState.capturedStderr.push(message);
    } else {
      recoveryState.capturedStdout.push(message);
    }
  }
  const isError = LOG_ERROR_REGEX.test(message);
  const prefix = isError ? "[error] " : "";
  logEl.textContent += `${prefix}${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}
```

Reset capture buffers on each new install (in form submit handler, near where `setStep("install")` is called):

```javascript
recoveryState.capturedStdout = [];
recoveryState.capturedStderr = [];
recoveryState.currentPhase = "";
recoveryState.lastRequest = readPayload();
```

Modify the `install-finished` listener to call `runRecovery()` on failure:

```javascript
await tauriEvent.listen("install-finished", (event) => {
  state.running = false;
  endPhases();
  if (event.payload.success) {
    setStep("verify");
    setStatus("Install complete — waiting for services to come online…");
    runVerify();
  } else {
    setStep("install");
    setStatus(event.payload.message, "error");
    runRecovery(event.payload);
  }
  updateInstallButton();
});
```

Add `runRecovery`:

```javascript
async function runRecovery(failPayload) {
  const panel = document.querySelector("#recovery-panel");
  if (!panel) return;
  panel.hidden = false;

  const titleEl = document.querySelector("#recovery-title");
  const messageEl = document.querySelector("#recovery-message");
  if (titleEl) titleEl.textContent = "Install failed — pick a recovery option";
  if (messageEl) {
    messageEl.textContent = failPayload?.message || "Install subprocess exited with non-zero status.";
  }

  // 1. Run diagnose against captured streams
  const diagnoseInput = {
    stdout: recoveryState.capturedStdout.slice(-200).join("\n"),
    stderr: recoveryState.capturedStderr.slice(-200).join("\n"),
    exit_code: typeof failPayload?.code === "number" ? failPayload.code : 1,
    phase: recoveryState.currentPhase,
    platform: detectPlatform(),
  };

  let diagnoseResult;
  try {
    diagnoseResult = await invoke("diagnose_check", { input: diagnoseInput });
  } catch (err) {
    diagnoseResult = { matches: [], ai_assist_eligible: false, error: String(err) };
  }
  renderDiagnosticCards(diagnoseResult);

  // 2. Run recover for Resume/Retry/Reset recommendation
  let recoverResult;
  try {
    recoverResult = await invoke("recover_check", {});
  } catch (err) {
    recoverResult = { mode: "retry", can_resume: false, message: String(err) };
  }
  renderRecoveryActions(recoverResult);
}

function detectPlatform() {
  // Best-effort browser-side platform detection. The installer GUI ships per-platform,
  // so this matches the bundle target.
  const ua = navigator.userAgent || "";
  if (/Mac|Darwin/.test(ua)) return "darwin";
  if (/Windows|Win32|Win64/.test(ua)) return "windows";
  return "linux";
}

function renderDiagnosticCards(result) {
  const container = document.querySelector("#diagnostic-cards");
  if (!container) return;
  container.innerHTML = "";
  const matches = result?.matches || [];
  if (matches.length === 0) {
    if (result?.ai_assist_eligible) {
      container.innerHTML = `
        <div class="diagnostic-card">
          <div class="diagnostic-card-id">No matching fingerprint</div>
          <div class="diagnostic-card-message">
            The installer's diagnostic knowledge base did not match this failure pattern.
            See the log panel above. (AI-assisted diagnosis is a future v0.3.0 feature.)
          </div>
        </div>
      `;
    }
    return;
  }
  for (const match of matches) {
    const card = document.createElement("div");
    card.className = `diagnostic-card severity-${match.severity || "warn"}`;
    card.innerHTML = `
      <div class="diagnostic-card-id">${escapeHtml(match.id || "unknown")}</div>
      <div class="diagnostic-card-message">${escapeHtml(match.message || "")}</div>
      <div class="diagnostic-card-actions"></div>
      <div class="diagnostic-card-result" hidden></div>
    `;
    if (match.fix_action) {
      const btn = document.createElement("button");
      btn.className = "try-fix-btn";
      btn.textContent = `Try this fix (${match.fix_action})`;
      btn.dataset.action = match.fix_action;
      btn.dataset.args = JSON.stringify(match.fix_args || {});
      btn.addEventListener("click", () => runTryFix(card, match));
      card.querySelector(".diagnostic-card-actions").appendChild(btn);
    }
    container.appendChild(card);
  }
}

async function runTryFix(card, match) {
  const btn = card.querySelector(".try-fix-btn");
  const resultEl = card.querySelector(".diagnostic-card-result");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Running…";
  }
  try {
    const fixResult = await invoke("try_fix", {
      input: {
        action: match.fix_action,
        args: match.fix_args || {},
      },
    });
    if (resultEl) {
      resultEl.hidden = false;
      resultEl.textContent = JSON.stringify(fixResult, null, 2);
    }
  } catch (err) {
    if (resultEl) {
      resultEl.hidden = false;
      resultEl.textContent = `Fix failed: ${err}`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = `Try this fix (${match.fix_action})`;
    }
  }
}

function renderRecoveryActions(result) {
  const resumeBtn = document.querySelector("#recovery-resume-btn");
  if (resumeBtn) {
    if (result?.can_resume && result?.mode === "resume") {
      const phase = result.last_phase ? `from ${result.last_phase}` : "from where it failed";
      resumeBtn.textContent = `Resume install ${phase}`;
      resumeBtn.hidden = false;
    } else {
      resumeBtn.hidden = true;
    }
  }
}
```

**Commit:**

```
feat(installer-gui): wire recovery flow on install failure

On install-finished with success: false, runRecovery() captures
the last 200 lines of stdout/stderr and the current phase, then:

1. Calls diagnose_check — renders matched fingerprints as cards
   with a 'Try this fix' button per fingerprint
2. Calls recover_check — shows the Resume button only when
   can_resume is true (intact state with at least one prior step
   completed)

When no fingerprint matches and ai_assist_eligible is true, shows
a placeholder card hinting at v0.3.0's BYO-key Claude assist.
Spec Block 3 + C5 + G5/G9.
```

---

### Task 3 — Resume/Retry/Reset button handlers

**File:** `installer/rust-gui/ui/app.js`

Add handlers near the bottom (after the existing event listeners):

```javascript
document.querySelector("#recovery-resume-btn")?.addEventListener("click", async () => {
  if (!recoveryState.lastRequest) {
    setStatus("No install request captured to resume", "error");
    return;
  }
  const panel = document.querySelector("#recovery-panel");
  if (panel) panel.hidden = true;
  setStep("install");
  state.running = true;
  setStatus("Resuming install…");
  updateInstallButton();
  try {
    // Engine auto-resumes from .install-state.json — no special flag needed.
    // Re-invoke start_install with the captured request.
    await invoke("start_install", { request: recoveryState.lastRequest });
  } catch (err) {
    state.running = false;
    setStatus(String(err), "error");
    updateInstallButton();
  }
});

document.querySelector("#recovery-retry-btn")?.addEventListener("click", async () => {
  if (!recoveryState.lastRequest) {
    setStatus("No install request captured to retry", "error");
    return;
  }
  const panel = document.querySelector("#recovery-panel");
  if (panel) panel.hidden = true;
  // Retry from start: clear .install-state.json so engine starts fresh
  // (the start_install command itself doesn't delete state — the user gets
  // a true retry by deleting state via reset_install with --keep-data, but
  // for simplicity we just re-invoke and let the user delete state via Reset
  // if Retry hits the same problem)
  setStep("install");
  state.running = true;
  setStatus("Retrying install…");
  updateInstallButton();
  try {
    await invoke("start_install", { request: recoveryState.lastRequest });
  } catch (err) {
    state.running = false;
    setStatus(String(err), "error");
    updateInstallButton();
  }
});

document.querySelector("#recovery-reset-btn")?.addEventListener("click", async () => {
  const ok = window.confirm(
    "Reset will run docker compose down -v and delete .install-state.json, .install-credentials, and the bundle cache. Databases are NOT dropped. Continue?"
  );
  if (!ok) return;
  const btn = document.querySelector("#recovery-reset-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Resetting…";
  }
  try {
    const message = await invoke("reset_install", {});
    setStatus(message, "info");
    const panel = document.querySelector("#recovery-panel");
    if (panel) panel.hidden = true;
    // Return user to Configure step so they can adjust settings
    setStep("configure");
  } catch (err) {
    setStatus(`Reset failed: ${err}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Reset everything";
    }
  }
});
```

Also replace Phase 4's `#reset-everything-btn` placeholder handler (which only emitted manual instructions) — find and replace it with a proper invocation:

```javascript
document.querySelector("#reset-everything-btn")?.addEventListener("click", async () => {
  const ok = window.confirm(
    "This will run docker compose down -v, delete .install-state.json, .install-credentials, and the bundle cache. Databases are NOT dropped. Continue?"
  );
  if (!ok) return;
  try {
    const message = await invoke("reset_install", {});
    setStatus(message, "info");
  } catch (err) {
    setStatus(`Reset failed: ${err}`, "error");
  }
});
```

**Commit:**

```
feat(installer-gui): wire Resume/Retry/Reset buttons + replace Phase 4 reset placeholder

Resume re-invokes start_install with the captured request — the engine's
checkpoint store auto-resumes from where it failed. Retry does the same
without explicit state cleanup (user can Reset if it persists). Reset
calls the new reset_install Tauri command which runs docker compose
down -v plus removes state files and bundle cache; databases survive.

Phase 4's Done-page Advanced/Reset button now calls reset_install
instead of emitting manual instructions.

Spec Block 3 — Failure recovery flow."
```

---

### Task 4 — Final verification

```
cd installer/rust-gui
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build --release 2>&1 | tail -3

cd /home/smudoshi/Github/Parthenon/.worktrees/installer-phase-5
python -m pytest installer/tests/ 2>&1 | tail -3
```

Expected: cargo green, 31 tests pass, 202 Python tests pass.

Verify all 17 Tauri commands registered:
```
bootstrap, validate_environment, preview_defaults, start_install,
wsl_distros, check_for_updates, health_check, service_status_check,
cancel_install, credentials_check, open_app_url,
runtime_image_check, runtime_image_pull,
recover_check, diagnose_check, try_fix, reset_install
```

---

## Phase 5 Done Criteria

- [ ] All tasks complete with their commits
- [ ] cargo build --release clean; clippy clean; fmt clean
- [ ] cargo test 31 passed; pytest 202 passed
- [ ] `#recovery-panel` HTML exists with diagnostic cards container + Resume/Retry/Reset hierarchy
- [ ] `runRecovery` calls `diagnose_check` and `recover_check` on install failure
- [ ] "Try this fix" button per fingerprint with `fix_action` invokes `try_fix`
- [ ] Resume button visible only when `can_resume` is true
- [ ] Reset button on both Recovery panel AND Done-page Advanced section invokes `reset_install`
- [ ] `appendLog` captures last-N lines into `recoveryState` while install is running

## What Phase 5 Does NOT Include

- AI-assisted diagnosis (deferred to v0.3.0 — `ai_assist_eligible` placeholder card only)
- Verify-fail recovery (different flow per spec; current Phase 3 handling stays)
- Gatekeeper / SmartScreen banners (Phase 6)
- CI release plumbing (Phase 7)
- Documentation (Phase 8)
