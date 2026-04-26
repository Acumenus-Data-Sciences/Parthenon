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

// Phase 3+6a: maps preflight check names (matched against the `name` field
// returned by the Python contract) to remediation actions the GUI can run
// elevated. The action ID matches what main.rs::remediation::run_remediation
// dispatches on.
//
// Schema:
//   key: preflight check.name string (exact match)
//   value: an object with EITHER top-level fields (single-platform) OR a
//          `perPlatform` map keyed by state.platform with platform-specific
//          overrides. perPlatform entries can omit `label` to inherit.
//
// The "fallbackCommand" is shown verbatim in copy-paste mode when polkit/UAC
// is missing or when the action isn't available. Keep these in sync with
// helper/parthenon-installer-helper (Linux) and remediation.rs Windows actions.
const REMEDIATION_MAP = {
  "Docker ≥ 24.0": {
    label: "Install Docker",
    perPlatform: {
      linux: {
        action: "install-docker",
        confirmTitle: "Install Docker?",
        confirmBody: "Parthenon needs Docker (~250 MB). The installer will run \"sudo apt install docker.io docker-compose-v2\" (or the dnf equivalent on RHEL/Fedora). You'll be asked for your system password.",
        fallbackCommand: {
          "debian-ubuntu": "sudo apt install -y docker.io docker-compose-v2",
          "rhel-fedora": "sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin",
        },
      },
      windows: {
        action: "install-docker-desktop",
        label: "Install Docker Desktop",
        confirmTitle: "Install Docker Desktop?",
        confirmBody: "Parthenon needs Docker. The installer will run \"winget install Docker.DockerDesktop\". You'll see a UAC prompt for the install, and possibly more prompts during Docker Desktop's first run.",
        fallbackCommand: { default: "winget install --id Docker.DockerDesktop --silent --accept-package-agreements --accept-source-agreements" },
      },
    },
  },
  "Docker daemon": {
    label: "Start Docker",
    perPlatform: {
      linux: {
        action: "start-docker",
        confirmTitle: "Start Docker daemon?",
        confirmBody: "The installer will run \"sudo systemctl start docker\" and enable it at boot.",
        fallbackCommand: { default: "sudo systemctl start docker && sudo systemctl enable docker" },
      },
      // No Windows action — Docker Desktop must be launched manually from
      // the Start menu (we can't programmatically auto-start a GUI app from
      // a UAC-elevated context cleanly). The fallback message guides the user.
      windows: {
        action: "open-docker-desktop",
        label: "Open Docker Desktop",
        confirmTitle: "Start Docker Desktop?",
        confirmBody: "Docker Desktop is installed but the daemon isn't running. Launch Docker Desktop from the Start menu, wait for the whale icon in the system tray to stop animating, then re-run Check System.",
        fallbackCommand: { default: "Open Docker Desktop from the Start menu" },
        manualOnly: true,
      },
    },
  },
  "Linux docker group": {
    label: "Add me to docker group",
    perPlatform: {
      linux: {
        action: "add-user-to-docker-group",
        confirmTitle: "Add you to the docker group?",
        confirmBody: "Adding your user account to the docker group lets you run Docker without sudo. After this, you'll need to log out and log back in for the change to take effect.",
        fallbackCommand: { default: "sudo usermod -aG docker $USER" },
        requiresLogout: true,
      },
    },
  },
  // Windows-only checks (added by Phase 6b in preflight). Wiring them now means
  // when the preflight checks land, the buttons appear automatically.
  "Windows VM Platform feature": {
    label: "Enable VM Platform",
    perPlatform: {
      windows: {
        action: "enable-vm-platform",
        confirmTitle: "Enable Virtual Machine Platform?",
        confirmBody: "WSL2 (which Docker Desktop uses) requires the Virtual Machine Platform Windows feature. The installer will enable it via PowerShell. After this you'll need to restart Windows.",
        fallbackCommand: { default: "powershell -Command \"Start-Process powershell -Verb RunAs -ArgumentList '-Command Enable-WindowsOptionalFeature -Online -All -FeatureName VirtualMachinePlatform'\"" },
        requiresReboot: true,
      },
    },
  },
  "WSL2 installed": {
    label: "Install WSL2",
    perPlatform: {
      windows: {
        action: "install-wsl2",
        confirmTitle: "Install WSL2?",
        confirmBody: "Docker Desktop on Windows runs containers inside WSL2. The installer will run \"wsl --install\" which downloads the WSL2 kernel and installs Ubuntu as the default distro. After this you'll need to restart Windows.",
        fallbackCommand: { default: "Start an Administrator PowerShell and run:  wsl --install" },
        requiresReboot: true,
      },
    },
  },
};

const state = {
  checks: [],
  preflightRan: false,
  running: false,
  platform: "",
  // Phase 3: filled by elevation_status() Tauri call on bootstrap
  elevation: { available: false, reason: null, fallbackInstallHint: null, probed: false },
  // Distro family ("debian-ubuntu" | "rhel-fedora" | "arch" | "other") —
  // detected client-side via /etc/os-release reading or assumed from platform
  distroFamily: "default",
  // Phase 6c: persisted across launches via get_installer_state Tauri call.
  // When pendingReboot is set, we show a "Welcome back, did you restart?"
  // banner above the preflight UI.
  pendingReboot: null,
};

const doneState = {
  realPassword: null,
  appUrl: null,
  revealTimer: null,
  revealCountdownTimer: null,
};

const recoveryState = {
  capturedStdout: [],
  capturedStderr: [],
  currentPhase: "",
  lastRequest: null,
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

// Phase 6c: render the "Welcome back, did you restart?" banner when state
// shows a pending reboot from a previous session. The banner sits between
// the page header and the preflight section so the user sees it first.
function renderPendingRebootBanner() {
  if (!state.pendingReboot) {
    const existing = document.querySelector("#pending-reboot-banner");
    if (existing) existing.remove();
    return;
  }
  let banner = document.querySelector("#pending-reboot-banner");
  if (!banner) {
    banner = document.createElement("aside");
    banner.id = "pending-reboot-banner";
    banner.className = "pending-reboot-banner";
    // Insert above the preflight section
    const target = preflightEl.parentElement || document.body;
    target.insertBefore(banner, target.firstChild);
  }
  const minsAgo = Math.max(
    1,
    Math.round((Date.now() / 1000 - (state.pendingReboot.recordedAt || 0)) / 60)
  );
  banner.innerHTML = `
    <div class="pending-reboot-content">
      <strong>Welcome back · ${escapeHtml(state.pendingReboot.action)}</strong>
      <span>Started ${minsAgo} min ago</span>
      <p>${escapeHtml(state.pendingReboot.message || "A previous step asked you to restart.")}</p>
      <div class="pending-reboot-actions">
        <button type="button" class="btn-primary" id="pending-reboot-recheck">I restarted — re-check now</button>
        <button type="button" class="btn-secondary" id="pending-reboot-dismiss">Not yet</button>
      </div>
    </div>
  `;
  banner.querySelector("#pending-reboot-recheck").addEventListener("click", async () => {
    // Re-run preflight; if the underlying check is now ok, the banner clears.
    await runPreflight();
    await maybeClearPendingReboot();
  });
  banner.querySelector("#pending-reboot-dismiss").addEventListener("click", async () => {
    state.pendingReboot = null;
    try { await invoke("clear_installer_pending_reboot", {}); } catch (e) {}
    renderPendingRebootBanner();
  });
}

// Called after every preflight run: if the check that was waiting on a
// reboot now reads "ok", clear the persisted pending state so we don't
// keep nagging the user.
async function maybeClearPendingReboot() {
  if (!state.pendingReboot || !state.pendingReboot.fixesCheckName) return;
  const fixedCheck = state.checks.find(
    (c) => c.name === state.pendingReboot.fixesCheckName
  );
  if (fixedCheck && fixedCheck.status === "pass") {
    state.pendingReboot = null;
    try { await invoke("clear_installer_pending_reboot", {}); } catch (e) {}
    renderPendingRebootBanner();
  }
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
    const remediation = remediationForCheck(check);
    const fixButton = remediation
      ? `<button type="button" class="fix-btn" data-action="${escapeHtml(remediation.action)}" data-check-name="${escapeHtml(check.name)}">${escapeHtml(remediation.label)}</button>`
      : "";
    return `
      <div class="check ${escapeHtml(check.status)}">
        <div class="check-text">
          <strong>${escapeHtml(label)} · ${escapeHtml(check.name)}</strong>
          <span>${escapeHtml(check.detail || "No detail")}</span>
        </div>
        ${fixButton}
      </div>
    `;
  }).join("");

  // Bind Fix-this buttons. Re-binding every render is fine because we
  // replace innerHTML, which detaches old handlers.
  preflightEl.querySelectorAll(".fix-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const checkName = btn.dataset.checkName;
      runRemediation(action, checkName);
    });
  });
}

// Look up whether a preflight check has a defined remediation we can offer
// on this platform. Returns a flat remediation object (perPlatform overrides
// merged onto the base) or null if no fix is available (or the check passed).
function remediationForCheck(check) {
  if (check.status === "pass") return null;
  const entry = REMEDIATION_MAP[check.name];
  if (!entry) return null;

  // Legacy single-platform shape: top-level `action` + optional onlyIfPlatform.
  if (entry.action) {
    if (entry.onlyIfPlatform && entry.onlyIfPlatform !== state.platform) {
      return null;
    }
    return entry;
  }

  // perPlatform shape: pick the entry for state.platform if it exists.
  const perPlatform = entry.perPlatform?.[state.platform];
  if (!perPlatform) return null;
  // Merge: perPlatform overrides base, but base supplies defaults like label.
  return { ...entry, ...perPlatform };
}

// Phase 3: orchestrate the Fix-this flow.
//
// 1. Show a confirmation modal describing what we're about to do.
// 2. If polkit is available → call run_remediation Tauri command (pkexec dialog
//    pops natively).
// 3. If polkit is missing → show the equivalent shell command with a Copy
//    button + "I've run this" confirmation, then re-run preflight.
// 4. After success, re-run the full preflight to refresh row statuses.
//
// The modal is built lazily on first use (no extra HTML in index.html for
// every page state — keep the markup simple).
async function runRemediation(actionId, checkName) {
  // Use the same lookup as renderChecks so perPlatform overrides apply
  // correctly. The synthetic check object below tells remediationForCheck
  // to skip the pass-status short-circuit.
  const remediation = remediationForCheck({ name: checkName, status: "fail" });
  if (!remediation || remediation.action !== actionId) {
    setStatus(`Unknown remediation: ${actionId}`, "error");
    return;
  }

  // Branch on elevation availability OR explicit manualOnly flag (some
  // actions like "Open Docker Desktop" can't be automated meaningfully).
  // Both fall back to copy-paste / instruction mode.
  const useCopyPaste = !state.elevation.available || remediation.manualOnly;
  if (useCopyPaste) {
    return openRemediationCopyPasteModal(remediation);
  }

  const confirmed = await openConfirmModal(remediation.confirmTitle, remediation.confirmBody);
  if (!confirmed) return;

  const overlay = openProgressOverlay(`Running: ${remediation.label}…`, "Authenticate via the system password dialog. After it completes, the installer will re-check your system.");
  try {
    const outcome = await invoke("run_remediation", { action: actionId });
    closeProgressOverlay(overlay);
    if (outcome.follow_up_required) {
      await openInfoModal(
        "Action required",
        outcome.follow_up_message || "Manual follow-up needed. Check the output below.",
        outcome.stdout || ""
      );
    } else {
      setStatus(`${remediation.label}: done.`, "success");
    }
    // Re-run preflight to refresh row statuses
    await runPreflight();
  } catch (err) {
    closeProgressOverlay(overlay);
    const errStr = String(err);
    if (errStr.includes("UserCancelled") || errStr.toLowerCase().includes("cancel")) {
      setStatus(`${remediation.label} cancelled.`, "info");
      return;
    }
    setStatus(`${remediation.label} failed: ${errStr}`, "error");
    // Offer copy-paste fallback if elevation refused for a non-cancel reason
    await openInfoModal(
      `${remediation.label} failed`,
      "The automated fix didn't complete. You can run the equivalent command yourself:",
      buildFallbackCommand(remediation)
    );
  }
}

function buildFallbackCommand(remediation) {
  if (typeof remediation.fallbackCommand === "string") {
    return remediation.fallbackCommand;
  }
  return (
    remediation.fallbackCommand?.[state.distroFamily] ||
    remediation.fallbackCommand?.default ||
    "(no fallback command provided)"
  );
}

// Modal primitives — built lazily so we don't clutter the static HTML.
// All three reuse a single <div id="remediation-modal-root"> attached to body.
function ensureModalRoot() {
  let root = document.querySelector("#remediation-modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "remediation-modal-root";
    document.body.appendChild(root);
  }
  return root;
}

function openConfirmModal(title, body) {
  return new Promise((resolve) => {
    const root = ensureModalRoot();
    root.innerHTML = `
      <div class="remediation-overlay">
        <div class="remediation-modal">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(body)}</p>
          <div class="remediation-modal-actions">
            <button type="button" class="btn-secondary" data-act="cancel">Cancel</button>
            <button type="button" class="btn-primary" data-act="confirm">Continue</button>
          </div>
        </div>
      </div>
    `;
    root.querySelector('[data-act="cancel"]').addEventListener("click", () => {
      root.innerHTML = "";
      resolve(false);
    });
    root.querySelector('[data-act="confirm"]').addEventListener("click", () => {
      root.innerHTML = "";
      resolve(true);
    });
  });
}

function openProgressOverlay(title, body) {
  const root = ensureModalRoot();
  root.innerHTML = `
    <div class="remediation-overlay">
      <div class="remediation-modal">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
        <div class="remediation-spinner" aria-hidden="true"></div>
      </div>
    </div>
  `;
  return root;
}

function closeProgressOverlay(root) {
  if (root) root.innerHTML = "";
}

function openInfoModal(title, body, codeBlock) {
  return new Promise((resolve) => {
    const root = ensureModalRoot();
    const codeHtml = codeBlock
      ? `<pre class="remediation-code">${escapeHtml(codeBlock)}</pre>
         <button type="button" class="btn-secondary" data-act="copy">Copy</button>`
      : "";
    root.innerHTML = `
      <div class="remediation-overlay">
        <div class="remediation-modal">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(body)}</p>
          ${codeHtml}
          <div class="remediation-modal-actions">
            <button type="button" class="btn-primary" data-act="ok">OK</button>
          </div>
        </div>
      </div>
    `;
    if (codeBlock) {
      root.querySelector('[data-act="copy"]').addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(codeBlock);
        } catch (e) {
          /* clipboard may be unavailable in some webviews; ignore */
        }
      });
    }
    root.querySelector('[data-act="ok"]').addEventListener("click", () => {
      root.innerHTML = "";
      resolve(true);
    });
  });
}

function openRemediationCopyPasteModal(remediation) {
  const cmd = buildFallbackCommand(remediation);
  const reasonNote = state.elevation.reason
    ? `Reason: ${state.elevation.reason}`
    : "Polkit (the system password helper) isn't available — the installer can't pop the auth dialog itself on this system.";
  const installHint = state.elevation.fallbackInstallHint
    ? `\n\nFor zero-friction install in the future:\n  ${state.elevation.fallbackInstallHint}`
    : "";
  return openInfoModal(
    `Run this command to ${remediation.label.toLowerCase()}`,
    `${reasonNote}${installHint}\n\nWhen finished, click OK and the installer will re-check.`,
    cmd
  ).then(() => runPreflight());
}

// Task 7 — regex-based error tagging (replaces stream-based prefix)
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

// Phase 3: best-effort distro family detection from /etc/os-release. Used to
// pick the right shell command in copy-paste fallback mode. Failure is fine
// — we default to "default" which the modal handles via remediation.fallbackCommand.default.
async function detectDistroFamily() {
  if (state.platform !== "linux") return state.platform;
  try {
    // Use the shell plugin to read /etc/os-release if available.
    const shell = window.__TAURI__?.shell;
    if (!shell) return "default";
    const cmd = shell.Command.create("read-os-release", ["-c", "cat /etc/os-release || true"], { encoding: "utf-8" });
    // Try to use sh; if Command.create with arbitrary program isn't allowed
    // by capabilities, this throws — handled below.
    const { stdout } = await cmd.execute();
    const lc = String(stdout || "").toLowerCase();
    if (lc.includes("debian") || lc.includes("ubuntu")) return "debian-ubuntu";
    if (lc.includes("rhel") || lc.includes("fedora") || lc.includes("centos") ||
        lc.includes("rocky") || lc.includes("almalinux")) return "rhel-fedora";
    if (lc.includes("arch")) return "arch";
  } catch (_) { /* fall through */ }
  return "default";
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

const bundleProgressPanel = () => document.querySelector("#bundle-progress");
const bundleProgressLabel = () => document.querySelector("#bundle-progress-label");
const bundleProgressDetail = () => document.querySelector("#bundle-progress-detail");
const bundleProgressFill = () => document.querySelector("#bundle-progress-fill");

function formatMb(bytes) {
  return (bytes / 1_048_576).toFixed(1);
}

function renderBundleProgress(payload) {
  const panel = bundleProgressPanel();
  const labelEl = bundleProgressLabel();
  const detailEl = bundleProgressDetail();
  const fillEl = bundleProgressFill();
  if (!panel || !labelEl || !detailEl || !fillEl) return;

  const phase = payload?.phase || "downloading";
  if (phase === "done") {
    panel.hidden = true;
    panel.classList.remove("indeterminate");
    return;
  }

  panel.hidden = false;

  if (phase === "downloading") {
    labelEl.textContent = "Downloading Parthenon installer bundle…";
    if (payload.total > 0) {
      panel.classList.remove("indeterminate");
      fillEl.style.width = `${Math.max(2, payload.percent)}%`;
      detailEl.textContent =
        `${formatMb(payload.bytes)} / ${formatMb(payload.total)} MB · ${payload.mb_per_sec.toFixed(1)} MB/s`;
    } else {
      // Server didn't send Content-Length — use indeterminate animation
      panel.classList.add("indeterminate");
      detailEl.textContent =
        `${formatMb(payload.bytes)} MB · ${payload.mb_per_sec.toFixed(1)} MB/s`;
    }
  } else if (phase === "extracting") {
    labelEl.textContent = "Extracting installer bundle…";
    detailEl.textContent = "";
    panel.classList.add("indeterminate");
  } else if (phase === "validating") {
    labelEl.textContent = "Verifying bundle manifest…";
    detailEl.textContent = "Checking SHA-256 of every file in the bundle";
    panel.classList.add("indeterminate");
  }
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

    // Phase 3: probe elevation availability so we know whether to show
    // Fix-this buttons that pop a polkit dialog vs. fall back to copy-paste.
    // We do this AFTER bootstrap (so state.platform is set) but BEFORE the
    // user can click Check System.
    try {
      const elev = await invoke("elevation_status", {});
      state.elevation = {
        available: !!elev.available,
        reason: elev.reason || null,
        fallbackInstallHint: elev.fallback_install_hint || null,
        probed: true,
      };
    } catch (e) {
      // Older binaries without elevation_status — treat as unavailable
      // (fall back to copy-paste mode). Logged but not fatal.
      state.elevation = { available: false, reason: String(e), fallbackInstallHint: null, probed: true };
    }

    // Best-effort distro family detection client-side. Used to pick the
    // right fallback shell command in copy-paste mode. Reads /etc/os-release
    // via the shell plugin if available; otherwise default.
    state.distroFamily = await detectDistroFamily();

    // Phase 6c: load persisted state. If we asked the user to reboot last
    // time (e.g. after wsl --install), surface a "Welcome back" banner so
    // they know where they left off rather than starting from scratch.
    try {
      const persisted = await invoke("get_installer_state", {});
      if (persisted && persisted.pending_reboot) {
        state.pendingReboot = {
          action: persisted.pending_reboot.action,
          recordedAt: persisted.pending_reboot.recorded_at,
          message: persisted.pending_reboot.message,
          fixesCheckName: persisted.pending_reboot.fixes_check_name,
        };
        renderPendingRebootBanner();
      }
    } catch (e) {
      // get_installer_state isn't a hard dependency — older binaries
      // without it won't fail bootstrap. Logged but ignored.
    }

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

  // Auto-updater check (cached 24 h via localStorage)
  if (typeof checkForUpdatesBanner === "function") {
    checkForUpdatesBanner();
  }

  // First-launch banners (Gatekeeper / SmartScreen). Non-blocking.
  showFirstLaunchBanner();

  if (tauriEvent) {
    await tauriEvent.listen("install-log", (event) => {
      appendLog(event.payload.message, event.payload.stream);
    });
    await tauriEvent.listen("bundle-download-progress", (event) => {
      renderBundleProgress(event.payload);
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
        runRecovery(event.payload);
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
  setStatus("Preparing installer bundle and running preflight…");
  preflightEl.textContent =
    "Downloading Parthenon (~80 MB on first run), verifying the bundle manifest, then checking Docker, ports, and disk. " +
    "This can take 30–90 seconds on a fresh install.";
  try {
    const checks = await invoke("validate_environment", { request: payload });
    state.checks = checks;
    state.preflightRan = true;
    renderChecks(checks);
    // Phase 6c: if a previous session asked the user to reboot for a check
    // that's now passing, clear the persisted nudge so we don't keep showing
    // the welcome-back banner.
    await maybeClearPendingReboot();
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
  // Phase 5 — reset capture buffers for this install run
  recoveryState.capturedStdout = [];
  recoveryState.capturedStderr = [];
  recoveryState.currentPhase = "";
  recoveryState.lastRequest = readPayload();
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

// ── Phase 5: Recovery flow ────────────────────────────────────────────

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
    const sev = ["error", "warn", "info"].includes(match.severity) ? match.severity : "warn";
    card.className = `diagnostic-card severity-${sev}`;
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
      cls += " exited";
      icon = "✗";
    } else if (s.health === "unhealthy") {
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

// ── Phase 5: Resume / Retry / Reset button handlers ──────────────────────────

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
  // Re-invoke start_install. The engine's checkpoint store auto-resumes from
  // the last successful step. For a true fresh start, the user must click Reset.
  setStep("install");
  state.running = true;
  setStatus("Retrying install (resuming from checkpoint)…");
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

// ── Task 3 (Phase 4): Done-page Reset button — now calls reset_install ────────

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

// ── Task 4: Auto-updater banner ──────────────────────────────────────────────

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

function showFirstLaunchBanner() {
  // First-launch banners — show once per platform unless dismissed.
  // Uses state.platform (set by bootstrap()) instead of a separate signing_info
  // round-trip; the banner is purely platform-gated and doesn't need cert data.
  const platform = state.platform;
  if (!platform) return;
  const dismissedKey = "parthenon_trust_banner_dismissed";
  const dismissed = JSON.parse(localStorage.getItem(dismissedKey) || "{}");

  if (platform === "macos" && !dismissed.gatekeeper) {
    const banner = document.querySelector("#gatekeeper-banner");
    if (banner) banner.hidden = false;
  }
  if (platform === "windows" && !dismissed.smartscreen) {
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

boot();
