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
const cdmSetupEl = document.querySelector("#cdm-setup-mode");
const cdmStateFields = document.querySelector("#cdm-state-fields");
const cdmConnectionFields = document.querySelector("#cdm-connection-fields");
const vocabZipField = document.querySelector("#vocab-zip-field");
const vocabularySetupEl = document.querySelector("#vocabulary-setup");

const state = {
  checks: [],
  preflightRan: false,
  running: false,
  platform: "",
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
  return { configure: 0, check: 1, install: 2, done: 3 }[step] ?? 0;
}

function readPayload() {
  const value = (selector) => document.querySelector(selector)?.value.trim() || "";
  const rawValue = (selector) => document.querySelector(selector)?.value || "";
  const checked = (selector) => document.querySelector(selector)?.checked || false;
  return {
    repo_path: value("#repo-path"),
    wsl_distro: value("#wsl-distro"),
    wsl_repo_path: value("#wsl-repo-path"),
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
  const services = ["Parthenon web app", "PostgreSQL", "Redis"];
  if (payload.enable_solr) services.push("Solr search");
  if (payload.enable_hecate) services.push("Hecate", "Qdrant");

  const data = payload.include_eunomia ? "Eunomia and Phenotype Library" : "No starter data";
  const mode = payload.dry_run ? "Test run only" : "Real install";
  const destination = state.platform === "windows"
    ? (payload.wsl_repo_path || payload.repo_path || "Select a checkout")
    : (payload.repo_path || "Select a checkout");
  const dataTarget = payload.cdm_setup_mode === "Create local PostgreSQL OMOP database"
    ? "Local PostgreSQL"
    : `${payload.cdm_dialect || "Database"} · ${payload.cdm_database || "database not set"}`;
  const dataStage = payload.cdm_setup_mode === "Use an existing OMOP CDM"
    ? "Validate existing OMOP CDM"
    : payload.cdm_existing_state;

  reviewEl.innerHTML = [
    reviewRow("Destination", destination),
    reviewRow("Admin", payload.admin_email || "admin@example.com"),
    reviewRow("URL", payload.app_url || "http://localhost"),
    reviewRow("OMOP target", dataTarget),
    reviewRow("CDM status", dataStage),
    reviewRow("Vocabulary", payload.vocabulary_setup || "Use demo starter data"),
    reviewRow("Starter data", data),
    reviewRow("Services", services.join(", ")),
    reviewRow("Mode", mode),
  ].join("");
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

function appendLog(message, stream = "stdout") {
  if (logEl.textContent === "Waiting for installer output.") {
    logEl.textContent = "";
  }
  const prefix = stream === "stderr" || stream === "error" ? "[error] " : "";
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
  renderReview();
  updateDataSetupVisibility();
  installBtn.textContent = dryRunEl.checked ? "Run Test" : "Install Parthenon";
  installBtn.disabled = state.running
    || !state.preflightRan
    || hasFailedCheck()
    || (!dryRunEl.checked && !confirmEl.checked);
}

function updateDataSetupVisibility() {
  const setupMode = cdmSetupEl.value;
  const vocabularyMode = vocabularySetupEl.value;
  const usesLocalPostgres = setupMode === "Create local PostgreSQL OMOP database";
  const usesCompleteCdm = setupMode === "Use an existing OMOP CDM";

  cdmConnectionFields.hidden = usesLocalPostgres;
  cdmStateFields.hidden = false;
  vocabZipField.hidden = vocabularyMode !== "Load Athena vocabulary ZIP";

  if (usesCompleteCdm && document.querySelector("#cdm-existing-state").value === "Empty database or schema") {
    document.querySelector("#cdm-existing-state").value = "Complete OMOP CDM exists";
  }
}

async function invoke(name, payload) {
  if (!tauriCore) {
    throw new Error("Tauri API is not available. Run this UI inside the Rust desktop app.");
  }
  return tauriCore.invoke(name, payload);
}

async function boot() {
  setStep("configure");
  updateInstallButton();
  try {
    const data = await invoke("bootstrap", {});
    state.platform = data.platform || "";
    document.querySelector("#repo-path").value = data.repo_path || "";
    windowsFields.hidden = !data.windows;
    setStatus(`Ready on ${data.platform}${data.python ? ` with ${data.python}` : ""}`);
    renderReview();
  } catch (err) {
    setStatus(String(err), "error");
  }

  if (tauriEvent) {
    await tauriEvent.listen("install-log", (event) => {
      appendLog(event.payload.message, event.payload.stream);
    });
    await tauriEvent.listen("install-finished", (event) => {
      state.running = false;
      setStep(event.payload.success ? "done" : "install");
      setStatus(event.payload.message, event.payload.success ? "success" : "error");
      updateInstallButton();
    });
  }
}

async function runPreflight() {
  setStep("check");
  state.preflightRan = false;
  state.checks = [];
  updateInstallButton();
  preflightBtn.disabled = true;
  setStatus("Checking system...");
  preflightEl.textContent = "Checking Python, Docker, ports, and selected services.";
  try {
    const checks = await invoke("validate_environment", { request: readPayload() });
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
vocabularySetupEl.addEventListener("change", updateInstallButton);

boot();
