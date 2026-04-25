const tauriCore = window.__TAURI__?.core;
const tauriEvent = window.__TAURI__?.event;

const form = document.querySelector("#installer-form");
const statusEl = document.querySelector("#status");
const preflightEl = document.querySelector("#preflight");
const reviewEl = document.querySelector("#review");
const logEl = document.querySelector("#log");
const installBtn = document.querySelector("#install-btn");
const dryRunEl = document.querySelector("#dry-run");
const confirmEl = document.querySelector("#confirm-real-install");
const windowsFields = document.querySelector("#windows-fields");
const preflightBtn = document.querySelector("#preflight-btn");
const sourceModeEl = document.querySelector("#source-mode");
const repoPathField = document.querySelector("#repo-path-field");
const repoPathLabel = document.querySelector("#repo-path-label");
const bundleFields = document.querySelector("#bundle-fields");
const liveDbChoiceEl = document.querySelector("#live-db-choice");
const cdmSetupEl = document.querySelector("#cdm-setup-mode");
const cdmStateFields = document.querySelector("#cdm-state-fields");
const cdmExistingStateLabel = document.querySelector("#cdm-existing-state")?.closest("label");
const cdmConnectionFields = document.querySelector("#cdm-connection-fields");
const localPostgresNote = document.querySelector("#local-postgres-note");
const vocabZipField = document.querySelector("#vocab-zip-field");
const vocabularySetupEl = document.querySelector("#vocabulary-setup");
const includeEunomiaEl = document.querySelector("#include-eunomia");

// Task 7 — regex-based error detection for stderr lines
const LOG_ERROR_REGEX = /(^\[red\]✗|^Error:|^FATAL:|^Traceback|^.*Exception:|^Cannot connect)/;

// Task 4 — phase progress strip state
const PHASE_REGEX = /Phase (\d+)\s+—\s+(.+?)(?:\s+\[|$)/;
let phaseStartTime = 0;
let phaseElapsedTimer = null;

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

// Task 6 — client-side form validation
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
  await pollHealth();
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
    if (result.ready) {
      ["nginx", "php", "postgres", "health", "frontend"].forEach((name) => setVerifyRow(name, true));
      setStatus("Parthenon is ready", "success");
      setTimeout(() => {
        setStep("done");
        runDone();
      }, 1000);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, VERIFY_INTERVAL_MS));
  }
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

const state = {
  checks: [],
  preflightRan: false,
  running: false,
  platform: "",
};

const doneState = {
  realPassword: null,
  appUrl: null,
  revealTimer: null,
  revealCountdownTimer: null,
};

function setStatus(message, kind = "info") {
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
}

function setStep(activeStep) {
  document.querySelectorAll("[data-step]").forEach((node) => {
    node.classList.toggle("active", node.dataset.step === activeStep);
    node.classList.toggle("complete", stepRank(node.dataset.step) < stepRank(activeStep));
  });
}

function stepRank(step) {
  return { configure: 0, check: 1, install: 2, verify: 3, done: 4 }[step] ?? 0;
}

function readPayload() {
  const value = (selector) => document.querySelector(selector)?.value.trim() || "";
  const rawValue = (selector) => document.querySelector(selector)?.value || "";
  const checked = (selector) => document.querySelector(selector)?.checked || false;
  return {
    source_mode: value("#source-mode"),
    repo_path: value("#repo-path"),
    wsl_distro: value("#wsl-distro"),
    wsl_repo_path: value("#wsl-repo-path"),
    bundle_url: value("#bundle-url"),
    bundle_archive_path: value("#bundle-archive-path"),
    bundle_sha256: value("#bundle-sha256"),
    bundle_install_dir: value("#bundle-install-dir"),
    install_target_dir: value("#install-target-dir"),
    admin_email: value("#admin-email"),
    admin_name: value("#admin-name"),
    admin_password: rawValue("#admin-password"),
    app_url: value("#app-url"),
    timezone: value("#timezone"),
    cdm_setup_mode: value("#cdm-setup-mode"),
    cdm_existing_state: value("#cdm-existing-state"),
    cdm_dialect: value("#cdm-dialect"),
    cdm_server: value("#cdm-server"),
    cdm_database: value("#cdm-database"),
    cdm_user: value("#cdm-user"),
    cdm_password: rawValue("#cdm-password"),
    cdm_schema: value("#cdm-schema"),
    vocabulary_schema: value("#vocabulary-schema"),
    results_schema: value("#results-schema"),
    temp_schema: value("#temp-schema"),
    vocabulary_setup: value("#vocabulary-setup"),
    vocab_zip_path: value("#vocab-zip-path"),
    include_eunomia: checked("#include-eunomia"),
    enable_solr: checked("#enable-solr"),
    enable_study_agent: checked("#enable-study-agent"),
    enable_blackrabbit: checked("#enable-blackrabbit"),
    enable_fhir_to_cdm: checked("#enable-fhir-to-cdm"),
    enable_hecate: checked("#enable-hecate"),
    enable_orthanc: checked("#enable-orthanc"),
    ollama_url: value("#ollama-url"),
    dry_run: dryRunEl.checked,
  };
}

function renderReview() {
  const payload = readPayload();
  const services = ["Parthenon web app", "PostgreSQL", "Redis", "Darkstar OHDSI analytics"];
  if (payload.enable_solr) services.push("Solr search");
  if (payload.enable_hecate) services.push("Hecate", "Qdrant");

  const data = payload.include_eunomia ? "Eunomia and Phenotype Library" : "No starter data";
  const mode = payload.dry_run ? "Test run only" : "Real install";
  const usesBundle = payload.source_mode === "Use installer bundle";
  const source = usesBundle ? "Verified installer bundle" : "Existing checkout";
  const destination = usesBundle
    ? (payload.install_target_dir || payload.wsl_repo_path || "Select a persistent Parthenon folder")
    : state.platform === "windows"
      ? (payload.wsl_repo_path || payload.repo_path || "Select a checkout")
      : (payload.repo_path || "Select a checkout");
  const installerWorkspace = usesBundle
    ? (payload.bundle_install_dir || "Installer download folder not set")
    : "";
  const dataTarget = payload.cdm_setup_mode === "Create local PostgreSQL OMOP database"
    ? "Local PostgreSQL"
    : `${payload.cdm_dialect || "Database"} · ${payload.cdm_database || "database not set"}`;
  const dataStage = payload.cdm_setup_mode === "Use an existing OMOP CDM"
    ? "Validate existing OMOP CDM"
    : payload.cdm_existing_state;

  reviewEl.innerHTML = [
    reviewRow("Source", source),
    usesBundle ? reviewRow("Installer workspace", installerWorkspace) : "",
    reviewRow("Destination", destination),
    reviewRow("Admin", payload.admin_email || "admin@example.com"),
    reviewRow("URL", payload.app_url || "http://localhost"),
    reviewRow("OMOP target", dataTarget),
    reviewRow("CDM status", dataStage),
    reviewRow("Vocabulary", payload.vocabulary_setup || "Use demo starter data"),
    reviewRow("Starter data", data),
    reviewRow("Services", services.join(", ")),
    reviewRow("Mode", mode),
  ].filter(Boolean).join("");
}

function reviewRow(label, value) {
  return `
    <div class="review-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderChecks(checks) {
  if (!checks.length) {
    preflightEl.textContent = "No checks returned.";
    return;
  }

  preflightEl.innerHTML = checks.map((check) => {
    const label = check.status === "pass" ? "Ready" : check.status === "warn" ? "Needs attention" : "Blocked";
    return `
      <div class="check ${escapeHtml(check.status)}">
        <strong>${escapeHtml(label)} · ${escapeHtml(check.name)}</strong>
        <span>${escapeHtml(check.detail || "No detail")}</span>
      </div>
    `;
  }).join("");
}

// Task 7 — regex-based error tagging (replaces stream-based prefix)
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

function hasFailedCheck() {
  return state.checks.some((check) => check.status === "fail");
}

function updateInstallButton() {
  updateSourceVisibility();
  updateDataSetupVisibility();
  renderReview();
  installBtn.textContent = dryRunEl.checked ? "Run Test" : "Install Parthenon";
  installBtn.disabled = state.running
    || !state.preflightRan
    || hasFailedCheck()
    || (!dryRunEl.checked && !confirmEl.checked);
  const controls = document.querySelector("#install-controls");
  if (controls) controls.hidden = !state.running;
}

function updateDataSetupVisibility() {
  const setupMode = setupModeFromLiveDbChoice();
  cdmSetupEl.value = setupMode;
  const vocabularyMode = vocabularySetupEl.value;
  const usesLocalPostgres = setupMode === "Create local PostgreSQL OMOP database";
  const usesCompleteCdm = setupMode === "Use an existing OMOP CDM";

  cdmConnectionFields.hidden = usesLocalPostgres;
  localPostgresNote.hidden = !usesLocalPostgres;
  cdmStateFields.hidden = false;
  if (cdmExistingStateLabel) {
    cdmExistingStateLabel.hidden = usesLocalPostgres;
  }
  vocabZipField.hidden = vocabularyMode !== "Load Athena vocabulary ZIP";
  document.querySelector("#cdm-dialect").disabled = usesLocalPostgres;

  if (usesLocalPostgres) {
    document.querySelector("#cdm-dialect").value = "PostgreSQL";
    document.querySelector("#cdm-existing-state").value = "Empty database or schema";
  }

  if (usesCompleteCdm && document.querySelector("#cdm-existing-state").value === "Empty database or schema") {
    document.querySelector("#cdm-existing-state").value = "Complete OMOP CDM exists";
  }

  if (vocabularyMode === "Use demo starter data") {
    includeEunomiaEl.checked = true;
  }
}

function setupModeFromLiveDbChoice() {
  switch (liveDbChoiceEl.value) {
    case "server":
      return "Use an existing database server";
    case "cdm":
      return "Use an existing OMOP CDM";
    default:
      return "Create local PostgreSQL OMOP database";
  }
}

function updateSourceVisibility() {
  const usesBundle = sourceModeEl.value === "Use installer bundle";
  repoPathField.hidden = usesBundle;
  bundleFields.hidden = !usesBundle;
  if (repoPathLabel) {
    repoPathLabel.textContent = usesBundle ? "Existing Parthenon checkout" : "Existing Parthenon checkout";
  }
}

async function invoke(name, payload) {
  if (!tauriCore) {
    throw new Error("Tauri API is not available. Run this UI inside the Rust desktop app.");
  }
  return tauriCore.invoke(name, payload);
}

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

async function boot() {
  setStep("configure");
  updateInstallButton();
  try {
    const data = await invoke("bootstrap", {});
    state.platform = data.platform || "";
    document.querySelector("#repo-path").value = data.repo_path || "";
    document.querySelector("#bundle-url").value = data.bundle_url || "";
    document.querySelector("#bundle-install-dir").value = data.bundle_install_dir || "";
    document.querySelector("#install-target-dir").value = data.install_target_dir || "";
    windowsFields.hidden = !data.windows;
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
        const select = document.querySelector("#wsl-distro");
        select.innerHTML = '<option value="">WSL enumeration failed</option>';
      }
    }
    setStatus(`Ready on ${data.platform}${data.python ? ` with ${data.python}` : ""}`);
    renderReview();
  } catch (err) {
    setStatus(String(err), "error");
  }

  if (tauriEvent) {
    await tauriEvent.listen("install-log", (event) => {
      appendLog(event.payload.message, event.payload.stream);
    });
    // Task 1 — install-finished now transitions to verify, not done
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
      }
      updateInstallButton();
    });
  }
}

async function runPreflight() {
  // Task 6 — validate before advancing to Check step
  const payload = readPayload();
  const errors = validatePayload(payload);
  if (errors.length > 0) {
    showFieldErrors(errors);
    setStatus(`Fix ${errors.length} validation error(s) before checking the system.`, "error");
    return;
  }
  clearFieldErrors();
  setStep("check");
  state.preflightRan = false;
  state.checks = [];
  updateInstallButton();
  preflightBtn.disabled = true;
  setStatus("Checking system...");
  preflightEl.textContent = "Checking Python, Docker, installer source, ports, and selected services.";
  try {
    const checks = await invoke("validate_environment", { request: payload });
    state.checks = checks;
    state.preflightRan = true;
    renderChecks(checks);
    if (hasFailedCheck()) {
      setStatus("Resolve the blocked checks before installing.", "error");
    } else if (checks.some((check) => check.status === "warn")) {
      setStatus("System check complete with warnings.");
    } else {
      setStatus("System check complete.", "success");
    }
  } catch (err) {
    setStatus(String(err), "error");
  } finally {
    preflightBtn.disabled = false;
    updateInstallButton();
  }
}

preflightBtn.addEventListener("click", runPreflight);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.preflightRan) {
    setStatus("Run the system check first.", "error");
    return;
  }
  if (hasFailedCheck()) {
    setStatus("Resolve the blocked checks before installing.", "error");
    return;
  }
  if (!dryRunEl.checked && !confirmEl.checked) {
    setStatus("Confirm the real install before starting.", "error");
    updateInstallButton();
    return;
  }
  logEl.textContent = "";
  state.running = true;
  setStep("install");
  // Task 4 — reset phase strip on install start
  document.querySelectorAll(".phase-cell").forEach((cell) => {
    cell.classList.remove("active", "complete");
  });
  const stripEl = document.querySelector("#phase-strip");
  if (stripEl) stripEl.hidden = false;
  updateInstallButton();
  setStatus(dryRunEl.checked ? "Running installer test..." : "Installing Parthenon...");
  try {
    await invoke("start_install", { request: readPayload() });
  } catch (err) {
    state.running = false;
    setStatus(String(err), "error");
    updateInstallButton();
  }
});

form.addEventListener("input", () => {
  state.preflightRan = false;
  state.checks = [];
  preflightEl.textContent = "Settings changed. Check the system again before installing.";
  setStep("configure");
  updateInstallButton();
});

dryRunEl.addEventListener("change", updateInstallButton);
confirmEl.addEventListener("change", updateInstallButton);
cdmSetupEl.addEventListener("change", updateInstallButton);
liveDbChoiceEl.addEventListener("change", updateInstallButton);
vocabularySetupEl.addEventListener("change", updateInstallButton);
sourceModeEl.addEventListener("change", updateInstallButton);
document.querySelectorAll("[data-browse]").forEach((button) => {
  button.addEventListener("click", () => browsePath(button));
});

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

// ── Phase 4: Done-page wiring ─────────────────────────────────────────

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

// ── Task 3: Service-status grid ──────────────────────────────────────────────

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

// ── Task 3: Runtime image check ──────────────────────────────────────────────

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

// ── Task 3: Reset button ─────────────────────────────────────────────────────

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

boot();
