# Installer Phase 3 — Step Structure Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifth "Verify" step between Install and Done (gating on a real health probe), apply progressive disclosure to Configure (novice-first), add a 9-cell phase progress strip + Cancel button to Install, and stop categorizing log lines as errors purely by stream.

**Architecture:** Mostly UI work in `installer/rust-gui/ui/{index.html, app.js, styles.css}`. One small Rust change: a `cancel_install` Tauri command that sends SIGTERM (then SIGKILL after 5 s) to the running subprocess. The Verify step calls the Phase 1 `health` contract action via the existing subprocess pattern.

**Tech Stack:** Plain HTML/CSS/JS (no Vite — installer GUI is static), Rust + Tauri 2.x, the contract surface from Phase 1 (`health`).

**Spec reference:** `docs/superpowers/specs/2026-04-24-installer-first-run-comprehensive-design.md` — Block 3 (step structure) + Area C1, C2, C3, C4. Verify step gates on Phase 1's `health` contract action (Area A3).

**Plan reference:** Phase 1 (`b2ef2fe18`) and Phase 2 (`556e0e6ab`) shipped to main. This plan does not depend on Phase 2's updater (Phase 4 wires the banner) and does not depend on the new Tauri dialog plugin (Phase 2 already replaced the pickers). Phase 3 is purely flow + UI.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `installer/rust-gui/src/main.rs` | MODIFY | Add `cancel_install` command; track running child for cancellation |
| `installer/rust-gui/ui/index.html` | MODIFY | 5-step stepper, phase strip, Verify panel, Cancel button, progressive-disclosure markup |
| `installer/rust-gui/ui/app.js` | MODIFY | Verify health-probe loop, phase parse, validation, stderr regex, cancel wiring |
| `installer/rust-gui/ui/styles.css` | MODIFY | Phase strip styles, Verify checklist, validation error states |

No new files. All changes additive within existing files.

---

### Task 1: Add Verify step to the stepper

**Files:**
- Modify: `installer/rust-gui/ui/index.html` (stepper HTML)
- Modify: `installer/rust-gui/ui/app.js` (`stepRank` map)

- [ ] **Step 1: Read current stepper**

```
grep -n 'data-step\|stepper' installer/rust-gui/ui/index.html | head
```

Current state has 4 steps: Configure / Check / Install / Done.

- [ ] **Step 2: Replace the stepper to include Verify**

In `installer/rust-gui/ui/index.html`, find:

```html
<nav class="stepper" aria-label="Installer progress">
  <div class="step active" data-step="configure"><span>1</span> Configure</div>
  <div class="step" data-step="check"><span>2</span> Check</div>
  <div class="step" data-step="install"><span>3</span> Install</div>
  <div class="step" data-step="done"><span>4</span> Done</div>
</nav>
```

Replace with:

```html
<nav class="stepper" aria-label="Installer progress">
  <div class="step active" data-step="configure"><span>1</span> Configure</div>
  <div class="step" data-step="check"><span>2</span> Check</div>
  <div class="step" data-step="install"><span>3</span> Install</div>
  <div class="step" data-step="verify"><span>4</span> Verify</div>
  <div class="step" data-step="done"><span>5</span> Done</div>
</nav>
```

- [ ] **Step 3: Update `stepRank` in `app.js`**

Find:

```javascript
function stepRank(step) {
  return { configure: 0, check: 1, install: 2, done: 3 }[step] ?? 0;
}
```

Replace with:

```javascript
function stepRank(step) {
  return { configure: 0, check: 1, install: 2, verify: 3, done: 4 }[step] ?? 0;
}
```

- [ ] **Step 4: Update `install-finished` listener to advance to verify, not done**

Find the listener at the bottom of `boot()`:

```javascript
await tauriEvent.listen("install-finished", (event) => {
  state.running = false;
  setStep(event.payload.success ? "done" : "install");
  setStatus(event.payload.message, event.payload.success ? "success" : "error");
  updateInstallButton();
});
```

Replace with:

```javascript
await tauriEvent.listen("install-finished", (event) => {
  state.running = false;
  if (event.payload.success) {
    // Install subprocess succeeded; Verify step now health-probes the live app.
    setStep("verify");
    setStatus("Install complete — waiting for services to come online…");
    runVerify();
  } else {
    setStep("install");
    setStatus(event.payload.message, "error");
  }
  updateInstallButton();
});
```

The `runVerify()` function does not exist yet — Task 2 adds it. For now, define a stub at the top of `app.js` so the file parses:

```javascript
async function runVerify() {
  // Implemented in Task 2.
  setStep("done");
  setStatus("Install complete (verify stub)", "success");
}
```

- [ ] **Step 5: Build & smoke**

```
cd installer/rust-gui && cargo build 2>&1 | tail -3
```

Expected: build succeeds. The UI changes don't affect Rust compilation, but `cargo build` validates the bundle still packages cleanly.

- [ ] **Step 6: Commit**

```
git add installer/rust-gui/ui/index.html installer/rust-gui/ui/app.js
git commit -m "feat(installer-gui): add Verify step to the 5-step stepper

The Verify step gates the Done page on a real health probe of the
installed app (Phase 1's health contract action). install-finished
now transitions to verify, not done; runVerify() is stubbed pending
Task 2's full implementation. Spec Block 3."
```

---

### Task 2: Implement Verify health-probe loop

**Files:**
- Modify: `installer/rust-gui/ui/index.html` (Verify panel markup)
- Modify: `installer/rust-gui/ui/app.js` (`runVerify` real implementation)
- Modify: `installer/rust-gui/ui/styles.css` (checklist styles)

- [ ] **Step 1: Add the Verify panel HTML**

In `installer/rust-gui/ui/index.html`, near the existing status panel (where Status / System Check / Progress live), or as a new section in the main workspace, add:

```html
<section id="verify-panel" class="form-section verify-panel" hidden>
  <div>
    <h2>Verifying Parthenon</h2>
    <p>Waiting for services to come online. This usually takes 30 to 60 seconds.</p>
  </div>
  <div class="verify-checklist">
    <div class="verify-row" data-verify="nginx"><span class="verify-pip">○</span> Web server accepting connections</div>
    <div class="verify-row" data-verify="php"><span class="verify-pip">○</span> Application runtime responding</div>
    <div class="verify-row" data-verify="postgres"><span class="verify-pip">○</span> Database ready</div>
    <div class="verify-row" data-verify="health"><span class="verify-pip">○</span> /api/v1/health returns 200</div>
    <div class="verify-row" data-verify="frontend"><span class="verify-pip">○</span> Frontend assets served</div>
  </div>
  <div class="verify-status">
    <span id="verify-attempt">Attempt 1 of 60</span>
    <span id="verify-last-status"></span>
  </div>
  <div id="verify-actions" class="verify-actions" hidden>
    <button id="verify-wait-more" type="button">Wait another 60 s</button>
    <button id="verify-show-status" type="button">Show service status</button>
  </div>
</section>
```

Place this section before the existing `<aside class="status-panel">` so it sits in the workspace area.

- [ ] **Step 2: Add styles**

Append to `installer/rust-gui/ui/styles.css`:

```css
.verify-panel {
  background: #181820;
  border-radius: 8px;
  padding: 24px;
  margin-top: 16px;
}
.verify-checklist {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 16px 0;
}
.verify-row {
  font-family: ui-monospace, monospace;
  font-size: 14px;
  color: #cbd5e1;
}
.verify-row.pass {
  color: #2DD4BF;
}
.verify-row.pass .verify-pip {
  color: #2DD4BF;
}
.verify-pip {
  display: inline-block;
  width: 1.2em;
  font-weight: bold;
}
.verify-status {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #94a3b8;
  margin-top: 12px;
}
.verify-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
.verify-actions button {
  padding: 6px 12px;
  border: 1px solid #2DD4BF;
  background: transparent;
  color: #2DD4BF;
  border-radius: 4px;
  cursor: pointer;
}
.verify-actions button:hover {
  background: rgba(45, 212, 191, 0.1);
}
```

- [ ] **Step 3: Implement `runVerify` in `app.js`**

Replace the stub:

```javascript
const VERIFY_MAX_ATTEMPTS = 60;
const VERIFY_INTERVAL_MS = 2000;

const verifyPanel = () => document.querySelector("#verify-panel");
const verifyAttemptEl = () => document.querySelector("#verify-attempt");
const verifyLastStatusEl = () => document.querySelector("#verify-last-status");
const verifyActionsEl = () => document.querySelector("#verify-actions");

function setVerifyRow(name, pass) {
  const row = document.querySelector(`[data-verify="${name}"]`);
  if (!row) return;
  row.classList.toggle("pass", pass);
  const pip = row.querySelector(".verify-pip");
  if (pip) pip.textContent = pass ? "✓" : "○";
}

async function runVerify() {
  setStep("verify");
  const panel = verifyPanel();
  if (panel) panel.hidden = false;
  ["nginx", "php", "postgres", "health", "frontend"].forEach((name) => setVerifyRow(name, false));
  if (verifyActionsEl()) verifyActionsEl().hidden = true;

  let attempt = 0;
  const probeOnce = async () => {
    attempt += 1;
    if (verifyAttemptEl()) {
      verifyAttemptEl().textContent = `Attempt ${attempt} of ${VERIFY_MAX_ATTEMPTS}`;
    }
    let result;
    try {
      result = await invoke("validate_environment", { request: readPayload() }); // placeholder — replaced below
    } catch (err) {
      // Non-fatal: keep polling
    }
    // Above is a placeholder; the real call uses the Phase 1 'health' contract action.
    // We invoke it via the existing contract subprocess pattern, exposed through a
    // future Rust command 'invoke_contract_health'. Until that helper is wired, treat
    // each failed probe as "not ready" and retry.
    // (See Task 2 Step 4 for the real Rust helper.)
    return result;
  };

  // Real implementation: call the new Rust 'health_check' command (Step 4).
  await pollHealth(attempt);
}

async function pollHealth() {
  let attempt = 0;
  while (attempt < VERIFY_MAX_ATTEMPTS) {
    attempt += 1;
    if (verifyAttemptEl()) {
      verifyAttemptEl().textContent = `Attempt ${attempt} of ${VERIFY_MAX_ATTEMPTS}`;
    }
    let result;
    try {
      result = await invoke("health_check", { attempt });
    } catch (err) {
      result = { ready: false, last_status: 0, attempt };
    }
    if (verifyLastStatusEl()) {
      verifyLastStatusEl().textContent = `Last status: ${result.last_status || "no response"}`;
    }
    // For simplicity, all five rows light up when ready: true. A future enhancement
    // can break out per-service probes; today the contract action checks /api/v1/health
    // which only returns 200 when the full stack is up.
    if (result.ready) {
      ["nginx", "php", "postgres", "health", "frontend"].forEach((name) => setVerifyRow(name, true));
      setStatus("Parthenon is ready", "success");
      setTimeout(() => setStep("done"), 1000);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, VERIFY_INTERVAL_MS));
  }
  // Timeout
  setStatus("Health probe timed out — services are slow to come up.", "error");
  if (verifyActionsEl()) verifyActionsEl().hidden = false;
}

document.querySelector("#verify-wait-more")?.addEventListener("click", () => {
  if (verifyActionsEl()) verifyActionsEl().hidden = true;
  pollHealth();
});

document.querySelector("#verify-show-status")?.addEventListener("click", async () => {
  try {
    const status = await invoke("service_status_check", {});
    appendLog(JSON.stringify(status, null, 2), "stdout");
  } catch (err) {
    setStatus(String(err), "error");
  }
});
```

- [ ] **Step 4: Add Rust commands `health_check` and `service_status_check`**

These are thin shims that invoke the Phase 1 contract actions via subprocess. In `installer/rust-gui/src/main.rs`, add near `bootstrap`:

```rust
#[derive(Debug, Serialize)]
struct HealthCheckResult {
    ready: bool,
    attempt: u32,
    last_status: u32,
    error: Option<String>,
}

#[tauri::command]
fn health_check(attempt: u32) -> HealthCheckResult {
    let request = current_install_request_or_default();
    let payload = match contract_payload_with_overrides(
        &request,
        "health",
        true,
        Some(&serde_json::json!({"_health_attempt": attempt})),
    ) {
        Ok(p) => p,
        Err(err) => {
            return HealthCheckResult {
                ready: false,
                attempt,
                last_status: 0,
                error: Some(err),
            };
        }
    };
    let parsed: serde_json::Value = match serde_json::from_str(&payload) {
        Ok(v) => v,
        Err(err) => {
            return HealthCheckResult {
                ready: false,
                attempt,
                last_status: 0,
                error: Some(format!("could not parse health JSON: {err}")),
            };
        }
    };
    HealthCheckResult {
        ready: parsed.get("ready").and_then(|v| v.as_bool()).unwrap_or(false),
        attempt: parsed.get("attempt").and_then(|v| v.as_u64()).map(|v| v as u32).unwrap_or(attempt),
        last_status: parsed
            .get("last_status")
            .and_then(|v| v.as_u64())
            .map(|v| v as u32)
            .unwrap_or(0),
        error: None,
    }
}

#[tauri::command]
fn service_status_check() -> Result<serde_json::Value, String> {
    let request = current_install_request_or_default();
    let payload = contract_payload_with_overrides(&request, "service-status", true, None)?;
    serde_json::from_str(&payload).map_err(|e| format!("parse error: {e}"))
}
```

You'll also need a `current_install_request_or_default()` helper that returns a default `InstallRequest` for these post-install probes (since the GUI no longer has the form data once Verify runs):

```rust
fn current_install_request_or_default() -> InstallRequest {
    InstallRequest {
        source_mode: "Use installer bundle".to_string(),
        repo_path: find_repo_root()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default(),
        wsl_distro: None,
        wsl_repo_path: None,
        bundle_url: String::new(),
        bundle_archive_path: String::new(),
        bundle_sha256: String::new(),
        bundle_install_dir: String::new(),
        install_target_dir: String::new(),
        admin_email: "admin@example.com".to_string(),
        admin_name: "Admin".to_string(),
        admin_password: String::new(),
        app_url: "http://localhost".to_string(),
        timezone: "UTC".to_string(),
        cdm_setup_mode: "Create local PostgreSQL OMOP database".to_string(),
        cdm_existing_state: "Empty database or schema".to_string(),
        cdm_dialect: "PostgreSQL".to_string(),
        cdm_server: String::new(),
        cdm_database: String::new(),
        cdm_user: String::new(),
        cdm_password: String::new(),
        cdm_schema: "omop".to_string(),
        vocabulary_schema: "vocab".to_string(),
        results_schema: "results".to_string(),
        temp_schema: "scratch".to_string(),
        vocabulary_setup: "Use demo starter data".to_string(),
        vocab_zip_path: String::new(),
        include_eunomia: true,
        enable_solr: true,
        enable_study_agent: false,
        enable_blackrabbit: false,
        enable_fhir_to_cdm: false,
        enable_hecate: true,
        enable_orthanc: false,
        ollama_url: String::new(),
        dry_run: false,
    }
}
```

You'll also need a `contract_payload_with_overrides` helper. Look at the existing `contract_payload_json` function and adapt it to merge an extra overrides JSON into the seed before invoking the contract:

```rust
fn contract_payload_with_overrides(
    request: &InstallRequest,
    action: &str,
    redact: bool,
    extra_overrides: Option<&serde_json::Value>,
) -> Result<String, String> {
    let mut seed = build_seed(request);
    if let (Some(extra), Some(seed_obj)) = (extra_overrides, seed.as_object_mut()) {
        if let Some(extra_obj) = extra.as_object() {
            for (k, v) in extra_obj {
                seed_obj.insert(k.clone(), v.clone());
            }
        }
    }
    let seed_json = serde_json::to_string_pretty(&seed).map_err(|err| err.to_string())?;
    let command_plan = if cfg!(target_os = "windows") {
        build_windows_contract_command(request, action, &seed_json, redact)?
    } else {
        build_local_contract_command(request, action, &seed_json, redact)?
    };
    run_capture(command_plan)
}
```

Register both commands in `tauri::generate_handler![...]`:

```rust
            health_check,
            service_status_check,
```

- [ ] **Step 5: Run cargo test + clippy**

```
cd installer/rust-gui
cargo test 2>&1 | tail -3
cargo clippy --all-targets -- -D warnings 2>&1 | tail -3
cargo fmt --check
```

Expected: green.

- [ ] **Step 6: Commit**

```
git add installer/rust-gui/src/main.rs installer/rust-gui/ui/index.html installer/rust-gui/ui/app.js installer/rust-gui/ui/styles.css
git commit -m "feat(installer-gui): implement Verify step health-probe loop

Adds the Verify panel UI (5-row checklist) and a polling loop that calls
the Phase 1 health contract action every 2 s, max 60 attempts (120 s).
On all-green, auto-advances to Done after 1 s. On timeout, shows 'Wait
another 60 s' and 'Show service status' buttons.

Two new Rust shims (health_check, service_status_check) wrap the contract
subprocess invocation with default install-request scaffolding so the
post-install probes don't need form data. Spec Block 3 + A3."
```

---

### Task 3: Progressive disclosure on Configure

**Files:**
- Modify: `installer/rust-gui/ui/index.html` (wrap optional sections in disclosure)
- Modify: `installer/rust-gui/ui/styles.css` (disclosure styles)

- [ ] **Step 1: Identify the sections that should hide behind "Customize"**

Look at the current Configure form sections:
1. Workspace (install source / bundle / WSL fields)
2. Administrator (admin email / name / password / timezone)
3. Community Stack (App URL / Ollama / toggles)
4. OMOP Data (live db / dialect / connection / state / vocabulary / schemas)
5. Ready To Install (review + buttons)

The novice should see Administrator (1 field really matters: email) + the Ready button. Everything else should hide behind a `<details>` disclosure.

- [ ] **Step 2: Wrap sections 1, 3, 4 in `<details>`**

In `installer/rust-gui/ui/index.html`, wrap Workspace + Community Stack + OMOP Data in a single `<details>` element:

```html
<details class="customize-disclosure">
  <summary>▼ Customize bundle source, services, and OMOP data setup</summary>

  <!-- existing Workspace section -->
  <section class="form-section">...</section>

  <!-- existing Community Stack section -->
  <section class="form-section">...</section>

  <!-- existing OMOP Data section -->
  <section class="form-section">...</section>
</details>
```

Leave the Administrator and Ready sections OUTSIDE the `<details>` so the novice sees them by default.

- [ ] **Step 3: Add styles**

Append to `installer/rust-gui/ui/styles.css`:

```css
.customize-disclosure {
  margin: 16px 0;
  border-top: 1px solid #2a2a35;
  padding-top: 16px;
}
.customize-disclosure > summary {
  cursor: pointer;
  font-size: 14px;
  color: #94a3b8;
  user-select: none;
  list-style: none;
  padding: 8px 0;
}
.customize-disclosure > summary::-webkit-details-marker {
  display: none;
}
.customize-disclosure[open] > summary {
  color: #cbd5e1;
  border-bottom: 1px solid #2a2a35;
  margin-bottom: 16px;
}
```

- [ ] **Step 4: Build and smoke**

```
cd installer/rust-gui && cargo build 2>&1 | tail -3
```

Expected: green.

- [ ] **Step 5: Commit**

```
git add installer/rust-gui/ui/index.html installer/rust-gui/ui/styles.css
git commit -m "feat(installer-gui): progressive disclosure on Configure step

Wraps the Workspace, Community Stack, and OMOP Data sections in a
<details> element so the novice user only sees Administrator email
and the Ready button by default. Engineers click 'Customize' to access
the existing 6 sub-sections. Spec Block 3 — Step 1 Configure."
```

---

### Task 4: 9-cell phase progress strip on Install

**Files:**
- Modify: `installer/rust-gui/ui/index.html` (phase strip markup)
- Modify: `installer/rust-gui/ui/app.js` (parse phase boundaries from log)
- Modify: `installer/rust-gui/ui/styles.css` (strip styles)

- [ ] **Step 1: Add the strip HTML**

In `installer/rust-gui/ui/index.html`, near the top of the workspace area (above the existing log panel), add:

```html
<div id="phase-strip" class="phase-strip" hidden>
  <div class="phase-cell" data-phase="1">1</div>
  <div class="phase-cell" data-phase="2">2</div>
  <div class="phase-cell" data-phase="3">3</div>
  <div class="phase-cell" data-phase="4">4</div>
  <div class="phase-cell" data-phase="5">5</div>
  <div class="phase-cell" data-phase="6">6</div>
  <div class="phase-cell" data-phase="7">7</div>
  <div class="phase-cell" data-phase="8">8</div>
  <div class="phase-cell" data-phase="9">9</div>
  <div id="phase-elapsed" class="phase-elapsed"></div>
</div>
```

- [ ] **Step 2: Add styles**

Append to `installer/rust-gui/ui/styles.css`:

```css
.phase-strip {
  display: grid;
  grid-template-columns: repeat(9, 1fr) auto;
  gap: 4px;
  align-items: center;
  margin: 16px 0;
}
.phase-cell {
  padding: 8px;
  text-align: center;
  background: #181820;
  border-radius: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}
.phase-cell.active {
  background: #2DD4BF22;
  color: #2DD4BF;
  border-color: #2DD4BF;
}
.phase-cell.complete {
  background: #2DD4BF;
  color: #0E0E11;
}
.phase-elapsed {
  margin-left: 12px;
  font-size: 11px;
  color: #94a3b8;
  font-family: ui-monospace, monospace;
}
```

- [ ] **Step 3: Parse phase boundaries in `app.js`**

Add at top:

```javascript
const PHASE_REGEX = /Phase (\d+)\s+—\s+(.+?)(?:\s+\[|$)/;
let phaseStartTime = 0;
let phaseElapsedTimer = null;
```

Add a helper function:

```javascript
function parsePhaseFromLog(line) {
  const m = line.match(PHASE_REGEX);
  if (!m) return null;
  return { number: parseInt(m[1], 10), name: m[2].trim() };
}

function setPhase(number, name) {
  const strip = document.querySelector("#phase-strip");
  if (!strip) return;
  strip.hidden = false;
  document.querySelectorAll(".phase-cell").forEach((cell) => {
    const cellNum = parseInt(cell.dataset.phase, 10);
    cell.classList.toggle("active", cellNum === number);
    cell.classList.toggle("complete", cellNum < number);
  });
  phaseStartTime = Date.now();
  if (phaseElapsedTimer) clearInterval(phaseElapsedTimer);
  phaseElapsedTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - phaseStartTime) / 1000);
    const el = document.querySelector("#phase-elapsed");
    if (el) el.textContent = `Phase ${number} of 9 · ${name} · ${elapsed} s elapsed`;
  }, 1000);
}

function endPhases() {
  if (phaseElapsedTimer) {
    clearInterval(phaseElapsedTimer);
    phaseElapsedTimer = null;
  }
  document.querySelectorAll(".phase-cell").forEach((cell) => {
    cell.classList.remove("active");
    cell.classList.add("complete");
  });
  const el = document.querySelector("#phase-elapsed");
  if (el) el.textContent = "All phases complete";
}
```

Modify `appendLog` to extract phase boundaries:

```javascript
function appendLog(message, stream = "stdout") {
  if (logEl.textContent === "Waiting for installer output.") {
    logEl.textContent = "";
  }
  // Parse phase boundary markers from Rich-formatted output.
  const phase = parsePhaseFromLog(message);
  if (phase) {
    setPhase(phase.number, phase.name);
  }
  const isError = LOG_ERROR_REGEX.test(message);  // Task 7 wires LOG_ERROR_REGEX
  const prefix = isError ? "[error] " : "";
  logEl.textContent += `${prefix}${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}
```

For now, use the existing stream-based prefix logic; Task 7 replaces `LOG_ERROR_REGEX` properly. To keep this Task 4 commit standalone, leave the existing prefix:

```javascript
const prefix = stream === "stderr" || stream === "error" ? "[error] " : "";
```

And call `endPhases()` in the `install-finished` listener:

```javascript
await tauriEvent.listen("install-finished", (event) => {
  state.running = false;
  endPhases();
  if (event.payload.success) { ... }
});
```

- [ ] **Step 4: Reset phase strip when starting a new install**

In the form submit handler, after `setStep("install");` add:

```javascript
document.querySelectorAll(".phase-cell").forEach((cell) => {
  cell.classList.remove("active", "complete");
});
const stripEl = document.querySelector("#phase-strip");
if (stripEl) stripEl.hidden = false;
```

- [ ] **Step 5: Build and smoke**

```
cd installer/rust-gui && cargo build 2>&1 | tail -3
```

Expected: green.

- [ ] **Step 6: Commit**

```
git add installer/rust-gui/ui/index.html installer/rust-gui/ui/app.js installer/rust-gui/ui/styles.css
git commit -m "feat(installer-gui): 9-cell phase progress strip on Install step

Parses 'Phase N — Title' lines from the installer's Rich-formatted stdout
and lights up the corresponding cell in a 9-cell strip across the top of
the Install step. Per-phase elapsed-time indicator updates every second.
On install-finished, all cells flip to complete.

Spec C1 — replaces the single rolling log panel with a structured
progress visualization."
```

---

### Task 5: Cancel button (Rust + UI)

**Files:**
- Modify: `installer/rust-gui/src/main.rs` (track child handle; new `cancel_install` command)
- Modify: `installer/rust-gui/ui/index.html` (Cancel button)
- Modify: `installer/rust-gui/ui/app.js` (cancel handler)

- [ ] **Step 1: Augment `InstallerState` to track the running child PID**

In `installer/rust-gui/src/main.rs`, find:

```rust
#[derive(Default)]
struct InstallerState {
    running: Mutex<bool>,
}
```

Replace with:

```rust
#[derive(Default)]
struct InstallerState {
    running: Mutex<bool>,
    running_pid: Mutex<Option<u32>>,
}
```

- [ ] **Step 2: Capture the PID when `start_install` spawns the subprocess**

Find the `run_install` function. After `let mut child = ...spawn()` (around line 1070-1080 in main.rs), add:

```rust
    let pid = child.id();
    if let Some(state) = app.try_state::<InstallerState>() {
        if let Ok(mut guard) = state.running_pid.lock() {
            *guard = Some(pid);
        }
    }
```

After the subprocess waits and returns (when `let status = child.wait()` completes), clear the PID:

```rust
    if let Some(state) = app.try_state::<InstallerState>() {
        if let Ok(mut guard) = state.running_pid.lock() {
            *guard = None;
        }
    }
```

- [ ] **Step 3: Add the `cancel_install` command**

```rust
#[tauri::command]
fn cancel_install(state: State<'_, InstallerState>) -> Result<String, String> {
    let pid = match state.running_pid.lock() {
        Ok(guard) => *guard,
        Err(_) => return Err("Installer state lock poisoned".to_string()),
    };
    let pid = match pid {
        Some(p) => p,
        None => return Ok("No install is running".to_string()),
    };

    // Send SIGTERM (Unix) or terminate (Windows). Tauri targets are uniformly POSIX
    // for our subprocess except Windows; on Windows we use taskkill.
    if cfg!(target_os = "windows") {
        Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T"])
            .status()
            .map_err(|e| format!("taskkill failed: {e}"))?;
    } else {
        // SIGTERM
        Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .status()
            .map_err(|e| format!("kill -TERM failed: {e}"))?;
    }

    // After 5 s, SIGKILL if still alive
    let pid_clone = pid;
    thread::spawn(move || {
        thread::sleep(std::time::Duration::from_secs(5));
        if cfg!(target_os = "windows") {
            let _ = Command::new("taskkill")
                .args(["/F", "/PID", &pid_clone.to_string(), "/T"])
                .status();
        } else {
            let _ = Command::new("kill")
                .args(["-KILL", &pid_clone.to_string()])
                .status();
        }
    });

    Ok(format!("Cancellation signal sent to pid {pid}"))
}
```

Register in `tauri::generate_handler![...]`:

```rust
            cancel_install,
```

- [ ] **Step 4: Add the Cancel button HTML**

In the Install-step area (or near the existing button row in the workspace), add:

```html
<div id="install-controls" class="install-controls" hidden>
  <button id="cancel-btn" type="button" class="cancel-button">Cancel install</button>
</div>
```

Add styles:

```css
.install-controls {
  margin: 16px 0;
}
.cancel-button {
  padding: 8px 16px;
  background: transparent;
  color: #f87171;
  border: 1px solid #f87171;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.cancel-button:hover {
  background: rgba(248, 113, 113, 0.1);
}
```

- [ ] **Step 5: Wire the cancel button**

In `app.js`, after the existing event listeners, add:

```javascript
document.querySelector("#cancel-btn")?.addEventListener("click", async () => {
  if (!state.running) return;
  const ok = window.confirm(
    "Stop the install? State is preserved if past Phase 4 — you can resume from this step."
  );
  if (!ok) return;
  try {
    const message = await invoke("cancel_install", {});
    setStatus(message, "info");
  } catch (err) {
    setStatus(String(err), "error");
  }
});
```

Show/hide the Cancel button based on `state.running`. In `updateInstallButton`:

```javascript
const controls = document.querySelector("#install-controls");
if (controls) controls.hidden = !state.running;
```

- [ ] **Step 6: Cargo test + clippy + fmt**

```
cd installer/rust-gui
cargo test 2>&1 | tail -3
cargo clippy --all-targets -- -D warnings 2>&1 | tail -3
cargo fmt --check
```

Expected: green.

- [ ] **Step 7: Commit**

```
git add installer/rust-gui/src/main.rs installer/rust-gui/ui/index.html installer/rust-gui/ui/app.js installer/rust-gui/ui/styles.css
git commit -m "feat(installer-gui): cancel button (SIGTERM then SIGKILL after 5 s)

Tracks the running install subprocess's PID in InstallerState. The new
cancel_install Tauri command sends SIGTERM (taskkill on Windows), then
schedules a SIGKILL after 5 s. State is left intact for Resume.

UI shows the Cancel button only while an install is running; clicking
prompts for confirmation before sending the signal. Spec C2."
```

---

### Task 6: Client-side form validation

**Files:**
- Modify: `installer/rust-gui/ui/app.js`
- Modify: `installer/rust-gui/ui/styles.css`

- [ ] **Step 1: Add validation helper**

In `app.js`, add:

```javascript
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePayload(payload) {
  const errors = [];
  if (!payload.admin_email || !EMAIL_RE.test(payload.admin_email)) {
    errors.push({ field: "admin-email", message: "Valid admin email is required" });
  }
  if (payload.source_mode === "Use installer bundle") {
    if (!payload.bundle_url && !payload.bundle_archive_path) {
      errors.push({ field: "bundle-url", message: "Bundle URL or local archive path is required" });
    }
    if (!payload.install_target_dir) {
      errors.push({ field: "install-target-dir", message: "Install target folder is required" });
    }
  } else if (!payload.repo_path) {
    errors.push({ field: "repo-path", message: "Existing checkout path is required" });
  }
  return errors;
}

function clearFieldErrors() {
  document.querySelectorAll(".field-error").forEach((el) => el.remove());
  document.querySelectorAll(".has-error").forEach((el) => el.classList.remove("has-error"));
}

function showFieldErrors(errors) {
  clearFieldErrors();
  for (const error of errors) {
    const input = document.querySelector(`#${error.field}`);
    if (!input) continue;
    input.classList.add("has-error");
    const errEl = document.createElement("span");
    errEl.className = "field-error";
    errEl.textContent = error.message;
    input.closest("label")?.appendChild(errEl);
  }
}
```

Add CSS:

```css
.has-error {
  border-color: #f87171 !important;
  outline-color: #f87171 !important;
}
.field-error {
  display: block;
  color: #f87171;
  font-size: 11px;
  margin-top: 2px;
}
```

- [ ] **Step 2: Wire validation in `runPreflight`**

Find:

```javascript
async function runPreflight() {
  setStep("check");
  ...
}
```

At the very top:

```javascript
async function runPreflight() {
  const payload = readPayload();
  const errors = validatePayload(payload);
  if (errors.length > 0) {
    showFieldErrors(errors);
    setStatus(`Fix ${errors.length} validation error(s) before checking the system.`, "error");
    return;
  }
  clearFieldErrors();
  setStep("check");
  ...
}
```

- [ ] **Step 3: Build + smoke**

```
cd installer/rust-gui && cargo build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```
git add installer/rust-gui/ui/app.js installer/rust-gui/ui/styles.css
git commit -m "feat(installer-gui): client-side form validation before Check System

Validates admin email format and required source/destination fields
before invoking the preflight contract. Inline error messages render
under each invalid field in red. Spec C4."
```

---

### Task 7: Stderr regex-based coloring

**Files:**
- Modify: `installer/rust-gui/ui/app.js`

- [ ] **Step 1: Define the error regex**

Add at top of `app.js`:

```javascript
const LOG_ERROR_REGEX = /(^\[red\]✗|^Error:|^FATAL:|^Traceback|^.*Exception:|^Cannot connect)/;
```

- [ ] **Step 2: Update `appendLog`**

Replace the prefix-by-stream logic:

```javascript
function appendLog(message, stream = "stdout") {
  if (logEl.textContent === "Waiting for installer output.") {
    logEl.textContent = "";
  }
  const phase = parsePhaseFromLog(message);
  if (phase) {
    setPhase(phase.number, phase.name);
  }
  const isError = LOG_ERROR_REGEX.test(message);
  const prefix = isError ? "[error] " : "";
  logEl.textContent += `${prefix}${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}
```

- [ ] **Step 3: Build + smoke**

```
cd installer/rust-gui && cargo build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```
git add installer/rust-gui/ui/app.js
git commit -m "feat(installer-gui): regex-based error tagging in log output

Stops marking every stderr line as [error]. Lines are flagged only when
they match a regex (Rich [red]✗, Error:, FATAL:, Traceback, Exception:,
Cannot connect). Routine progress messages from stderr stay neutral.
Spec C3."
```

---

### Task 8: Final verification

- [ ] **Step 1: Full Rust toolchain**

```
cd installer/rust-gui
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build --release 2>&1 | tail -3
```

Expected: all green.

- [ ] **Step 2: Python tests still pass**

```
cd /home/smudoshi/Github/Parthenon/.worktrees/installer-phase-3
python -m pytest installer/tests/ 2>&1 | tail -3
```

Expected: 202 passed (Phase 1 contract surface unchanged).

- [ ] **Step 3: Verify all 9 Tauri commands are registered**

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
```

- [ ] **Step 4: No commit at this step.**

---

## Phase 3 Done Criteria

- [ ] All 8 tasks complete with their commits
- [ ] `cargo build --release` succeeds in `installer/rust-gui/`
- [ ] `cargo test` passes
- [ ] `cargo clippy --all-targets -- -D warnings` clean
- [ ] `python -m pytest installer/tests/` still 202 passing
- [ ] 5-step stepper: Configure → Check → Install → Verify → Done
- [ ] Verify panel implements 5-row checklist + attempt counter + timeout actions
- [ ] Configure has progressive disclosure (Customize details element)
- [ ] Install has 9-cell phase strip + per-phase elapsed indicator
- [ ] Cancel button works (SIGTERM, then SIGKILL after 5 s)
- [ ] Client-side validation catches empty admin email + missing source path
- [ ] Log lines flagged as errors only when matching regex, not by stream

## What Phase 3 Does NOT Include

- Hero Done page (Phase 4)
- Recovery panel UI for failed installs (Phase 5 — uses Phase 1's `recover` action)
- Per-service health probing in Verify (single `/api/v1/health` probe; per-service breakdown deferred to Phase 5+)
- Gatekeeper / SmartScreen banners (Phase 6)
- Auto-updater UI banner (Phase 4 — uses Phase 2's `check_for_updates`)
- CI release plumbing (Phase 7)
- Real keypair (still placeholder until v0.2.0 release prep)

The Phase 3 commit set should be self-contained — pass CI on its own, leave Phase 4+ unblocked.
