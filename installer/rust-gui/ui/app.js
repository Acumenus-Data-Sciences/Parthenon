const tauriCore = window.__TAURI__?.core;
const tauriEvent = window.__TAURI__?.event;

const form = document.querySelector("#installer-form");
const statusEl = document.querySelector("#status");
const preflightEl = document.querySelector("#preflight");
const previewEl = document.querySelector("#preview");
const logEl = document.querySelector("#log");
const installBtn = document.querySelector("#install-btn");
const dryRunEl = document.querySelector("#dry-run");
const confirmEl = document.querySelector("#confirm-real-install");
const windowsFields = document.querySelector("#windows-fields");

function setStatus(message, kind = "info") {
  statusEl.textContent = message;
  statusEl.style.color = kind === "error" ? "var(--red-strong)" : kind === "success" ? "var(--green)" : "var(--gold)";
}

function readPayload() {
  return {
    repo_path: document.querySelector("#repo-path").value.trim(),
    wsl_distro: document.querySelector("#wsl-distro").value.trim(),
    wsl_repo_path: document.querySelector("#wsl-repo-path").value.trim(),
    admin_email: document.querySelector("#admin-email").value.trim(),
    admin_name: document.querySelector("#admin-name").value.trim(),
    admin_password: document.querySelector("#admin-password").value,
    app_url: document.querySelector("#app-url").value.trim(),
    timezone: document.querySelector("#timezone").value.trim(),
    include_eunomia: document.querySelector("#include-eunomia").checked,
    enable_solr: document.querySelector("#enable-solr").checked,
    enable_study_agent: document.querySelector("#enable-study-agent").checked,
    enable_blackrabbit: document.querySelector("#enable-blackrabbit").checked,
    enable_fhir_to_cdm: document.querySelector("#enable-fhir-to-cdm").checked,
    enable_hecate: document.querySelector("#enable-hecate").checked,
    enable_orthanc: document.querySelector("#enable-orthanc").checked,
    ollama_url: document.querySelector("#ollama-url").value.trim(),
    dry_run: dryRunEl.checked,
  };
}

function renderChecks(checks) {
  if (!checks.length) {
    preflightEl.textContent = "No checks returned.";
    return;
  }

  preflightEl.innerHTML = checks.map((check) => `
    <div class="check ${check.status}">
      <strong>${escapeHtml(check.name)} · ${escapeHtml(check.status)}</strong>
      <span>${escapeHtml(check.detail || "No detail")}</span>
    </div>
  `).join("");
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

function updateInstallButton() {
  installBtn.textContent = dryRunEl.checked ? "Start Dry Run" : "Start Install";
  installBtn.disabled = !dryRunEl.checked && !confirmEl.checked;
}

async function invoke(name, payload) {
  if (!tauriCore) {
    throw new Error("Tauri API is not available. Run this UI inside the Rust desktop app.");
  }
  return tauriCore.invoke(name, payload);
}

async function boot() {
  updateInstallButton();
  try {
    const data = await invoke("bootstrap", {});
    document.querySelector("#repo-path").value = data.repo_path || "";
    windowsFields.hidden = !data.windows;
    setStatus(`Ready on ${data.platform}${data.python ? ` with ${data.python}` : ""}`);
  } catch (err) {
    setStatus(String(err), "error");
  }

  if (tauriEvent) {
    await tauriEvent.listen("install-log", (event) => {
      appendLog(event.payload.message, event.payload.stream);
    });
    await tauriEvent.listen("install-finished", (event) => {
      installBtn.disabled = false;
      setStatus(event.payload.message, event.payload.success ? "success" : "error");
    });
  }
}

document.querySelector("#preflight-btn").addEventListener("click", async () => {
  setStatus("Running preflight...");
  try {
    const checks = await invoke("validate_environment", { request: readPayload() });
    renderChecks(checks);
    if (checks.some((check) => check.status === "fail")) {
      setStatus("Preflight found blockers", "error");
    } else if (checks.some((check) => check.status === "warn")) {
      setStatus("Preflight complete with warnings");
    } else {
      setStatus("Preflight complete", "success");
    }
  } catch (err) {
    setStatus(String(err), "error");
  }
});

document.querySelector("#preview-btn").addEventListener("click", async () => {
  setStatus("Generating defaults preview...");
  try {
    previewEl.textContent = await invoke("preview_defaults", { request: readPayload() });
    setStatus("Defaults generated", "success");
  } catch (err) {
    setStatus(String(err), "error");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!dryRunEl.checked && !confirmEl.checked) {
    setStatus("Confirm real install before starting.", "error");
    updateInstallButton();
    return;
  }
  logEl.textContent = "";
  installBtn.disabled = true;
  setStatus(dryRunEl.checked ? "Starting dry run..." : "Starting installer...");
  try {
    await invoke("start_install", { request: readPayload() });
  } catch (err) {
    installBtn.disabled = false;
    setStatus(String(err), "error");
  }
});

dryRunEl.addEventListener("change", updateInstallButton);
confirmEl.addEventListener("change", updateInstallButton);

boot();
