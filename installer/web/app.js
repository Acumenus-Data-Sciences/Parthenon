const stepMeta = [
  ["launch", "1. Environment", "Choose the Parthenon workspace"],
  ["preflight", "2. Readiness", "Check this machine before install"],
  ["basics", "3. Install Path", "Choose the product edition and deployment defaults"],
  ["credentials", "4. Access", "Create administrator and database credentials"],
  ["modules", "5. Services", "Select platform modules and supporting services"],
  ["review", "6. Confirm", "Review settings and start installation"],
];

const state = {
  bootstrap: null,
  currentStep: 0,
  preflight: null,
  installPolling: null,
  currentValues: {},
  selectedExperience: "",
};

const $ = (id) => document.getElementById(id);

async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function buildSteps() {
  const container = $("steps");
  container.innerHTML = "";
  stepMeta.forEach(([key, title, subtitle], index) => {
    const el = document.createElement("button");
    el.className = "step-card";
    el.type = "button";
    el.innerHTML = `<h4>${title}</h4><p>${subtitle}</p>`;
    el.addEventListener("click", async () => {
      if (index > state.currentStep && !(await validateCurrentStep())) return;
      showStep(index);
    });
    container.appendChild(el);
  });
}

function getPayload() {
  const payload = { ...state.currentValues };
  document.querySelectorAll("[data-field]").forEach((node) => {
    if (node.type === "checkbox") {
      payload[node.dataset.field] = node.checked;
    } else {
      payload[node.dataset.field] = node.value;
    }
  });
  payload.modules = ["research", "commons", "ai_knowledge", "data_pipeline", "infrastructure"].filter(
    (key) => payload[key],
  );
  payload.vocab_zip_path = payload.vocab_zip_path || null;
  payload.upgrade = $("upgrade").checked;
  payload.dry_run = Boolean(state.currentValues.dry_run);
  return payload;
}

function setStatus(text) {
  if (!text) {
    setBanner("");
    return;
  }
  setBanner(text, "info");
}

function setBanner(text = "", kind = "info") {
  const banner = $("banner");
  if (!text) {
    banner.hidden = true;
    banner.className = "banner";
    banner.textContent = "";
    return;
  }
  banner.hidden = false;
  banner.className = `banner ${kind}`.trim();
  banner.textContent = text;
}

function syncActionButtons() {
  const dryRun = Boolean(state.currentValues.dry_run);
  const dryRunBtn = $("dry-run-btn");
  if (dryRunBtn) {
    dryRunBtn.textContent = dryRun ? "Dry Run: On" : "Dry Run: Off";
    dryRunBtn.classList.toggle("active", dryRun);
  }
}

function snapshotValues() {
  const nodes = document.querySelectorAll("[data-field]");
  if (!nodes.length) return;
  state.currentValues = { ...state.currentValues, ...getPayload() };
}

function showStep(index) {
  snapshotValues();
  state.currentStep = index;
  const [_, title, subtitle] = stepMeta[index];
  $("step-title").textContent = title;
  $("step-subtitle").textContent = subtitle;
  $("progress-fill").style.width = `${((index + 1) / stepMeta.length) * 100}%`;
  renderStep();
  [...$("steps").children].forEach((child, childIndex) => {
    child.classList.toggle("active", childIndex === index);
    child.classList.toggle("done", childIndex < index);
  });
  $("back-btn").disabled = index === 0;
  $("next-btn").disabled = index === stepMeta.length - 1;
  $("validate-btn").disabled = index !== stepMeta.length - 1;
  $("install-btn").disabled = index !== stepMeta.length - 1;
  syncActionButtons();
}

function renderFields(fields) {
  return fields
    .map(
      ({ key, label, type = "text", options = [], secret = false }) => `
        <label class="field">
          <span class="field-label">${label}</span>
          ${
            type === "select"
              ? `<select class="field-select" data-field="${key}">
                  ${options.map((option) => `<option value="${option}">${option}</option>`).join("")}
                 </select>`
              : `<input class="field-input" data-field="${key}" type="${secret ? "password" : "text"}" />`
          }
        </label>
      `,
    )
    .join("");
}

function renderCheckboxGrid(items) {
  return `<div class="checkbox-grid">${items
    .map(
      ([key, label]) => `
        <label class="checkbox-card">
          <input type="checkbox" data-field="${key}" />
          <span>${label}</span>
        </label>`,
    )
    .join("")}</div>`;
}

function renderChoiceCards(key, label, options) {
  return `
    <div class="choice-group">
      <div class="choice-label">${label}</div>
      <input type="hidden" data-field="${key}" />
      <div class="choice-grid" data-choice-group="${key}">
        ${options
          .map(
            ({ value, title, body }) => `
              <button type="button" class="choice-card" data-choice-field="${key}" data-choice-value="${value}">
                <span class="choice-title">${title}</span>
                <span class="choice-body">${body}</span>
              </button>`,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderStep() {
  const defaults = state.bootstrap.defaults;
  const container = $("step-content");
  const stepKey = stepMeta[state.currentStep][0];

  if (stepKey === "launch") {
    const launchCopy = state.bootstrap.platform.windows
      ? "On Windows, enter either the Parthenon repo path or the WSL repo path before continuing."
      : "Confirm the Parthenon repo path for this installation before continuing.";
    const windowsFields = state.bootstrap.platform.windows
      ? `
          <div class="grid">
            ${renderFields([
              { key: "wsl_distro", label: "WSL distro" },
              { key: "wsl_repo_path", label: "WSL repo path" },
            ])}
          </div>
        `
      : "";
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft">
          <h4>Launch Context</h4>
          <p class="section-copy">${launchCopy}</p>
          <div class="grid">
            ${renderFields([{ key: "repo_path", label: "Parthenon repo path" }])}
          </div>
          ${windowsFields}
          <div class="inline-actions">
            <button class="btn secondary" id="browse-repo">Browse</button>
          </div>
        </section>
      </div>
    `;
    bindValues();
    $("browse-repo").addEventListener("click", () => alert("Use the repo path field directly for now."));
    return;
  }

  if (stepKey === "preflight") {
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft">
          <h4>System Readiness</h4>
          <p class="section-copy">Run preflight checks on the selected repo before continuing. The wizard will not advance past this step while failures remain.</p>
          <div class="inline-actions">
            <button class="btn secondary" id="run-preflight">Run Preflight Checks</button>
          </div>
          <div id="preflight-output" class="preflight-summary"></div>
        </section>
      </div>
    `;
    $("run-preflight").addEventListener("click", runPreflight);
    renderPreflight();
    return;
  }

  if (stepKey === "basics") {
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft decision-section">
          <div class="section-kicker">Primary Decision</div>
          <h4>Confirm the product edition</h4>
          <p class="section-copy">The user profile was chosen before the wizard opened. Use this step to confirm the product edition and complete the installation defaults for this environment.</p>
          ${renderChoiceCards("edition", "Edition", [
            {
              value: "Community Edition",
              title: "Community Edition",
              body: "Standard guided installation path for general deployment and evaluation.",
            },
            {
              value: "Enterprise Edition",
              title: "Enterprise Edition",
              body: "Requires an Enterprise Key before the installer can proceed.",
            },
          ])}
          <div class="grid two compact-grid">
            ${renderFields([{ key: "enterprise_key", label: "Enterprise Key" }])}
          </div>
        </section>
        <section class="section glass-soft">
          <div class="section-kicker">Deployment Defaults</div>
          <h4>Configure the runtime defaults</h4>
          <p class="section-copy">After the install path is selected, set the deployment values for this environment.</p>
          <div class="grid two">
            ${renderFields([
              { key: "cdm_dialect", label: "CDM database", type: "select", options: defaults ? ["PostgreSQL", "Microsoft SQL Server", "Google BigQuery", "Amazon Redshift", "Snowflake", "Oracle", "Not sure yet / will configure later"] : [] },
              { key: "app_url", label: "App URL" },
              { key: "env", label: "Environment", type: "select", options: ["local", "production"] },
              { key: "timezone", label: "Timezone" },
              { key: "ollama_url", label: "Ollama URL" },
              { key: "vocab_zip_path", label: "Athena vocabulary ZIP" },
            ])}
          </div>
          <div class="inline-actions">
            <label class="checkbox-row">
              <input type="checkbox" data-field="include_eunomia" />
              <span>Load Eunomia demo CDM</span>
            </label>
          </div>
        </section>
      </div>
    `;
    bindValues();
    return;
  }

  if (stepKey === "credentials") {
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft">
          <h4>Credentials</h4>
          <div class="grid two">
            ${renderFields([
              { key: "admin_email", label: "Admin email" },
              { key: "admin_name", label: "Admin name" },
              { key: "admin_password", label: "Admin password", secret: true },
              { key: "db_password", label: "DB password", secret: true },
            ])}
          </div>
          <div class="inline-actions">
            <button class="btn secondary" id="regen-admin">Generate Admin Password</button>
            <button class="btn secondary" id="regen-db">Generate DB Password</button>
          </div>
        </section>
      </div>
    `;
    bindValues();
    $("regen-admin").onclick = () => ($('[data-field="admin_password"]').value = Math.random().toString(36).slice(2, 18));
    $("regen-db").onclick = () => ($('[data-field="db_password"]').value = Math.random().toString(36).slice(2, 26));
    return;
  }

  if (stepKey === "modules") {
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft">
          <h4>Modules</h4>
          ${renderCheckboxGrid([
            ["research", "Research"],
            ["commons", "Commons"],
            ["ai_knowledge", "AI & Knowledge"],
            ["data_pipeline", "Data Pipeline"],
            ["infrastructure", "Infrastructure"],
          ])}
        </section>
        <section class="section glass-soft">
          <h4>Optional Services</h4>
          ${renderCheckboxGrid([
            ["enable_study_agent", "Study Designer"],
            ["enable_hecate", "Hecate"],
            ["enable_blackrabbit", "BlackRabbit"],
            ["enable_fhir_to_cdm", "FHIR-to-CDM"],
            ["enable_orthanc", "Orthanc"],
            ["enable_livekit", "LiveKit"],
            ["enable_solr", "Apache Solr"],
          ])}
        </section>
        <section class="section glass-soft">
          <h4>Service Credentials</h4>
          <div class="grid two">
            ${renderFields([
              { key: "livekit_url", label: "LiveKit URL" },
              { key: "livekit_api_key", label: "LiveKit API key" },
              { key: "livekit_api_secret", label: "LiveKit API secret", secret: true },
              { key: "orthanc_user", label: "Orthanc user" },
              { key: "orthanc_password", label: "Orthanc password", secret: true },
            ])}
          </div>
        </section>
        <section class="section glass-soft">
          <h4>Ports</h4>
          <p class="section-copy">Only the NGINX entrypoint port must be reserved up front. The installer auto-selects free host ports for the internal services it starts.</p>
          <div class="grid three">
            ${renderFields([
              { key: "nginx_port", label: "NGINX" },
              { key: "solr_java_mem", label: "Solr JVM memory" },
            ])}
          </div>
        </section>
      </div>
    `;
    bindValues();
    return;
  }

  if (stepKey === "review") {
    const payload = getPayload();
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft">
          <h4>Review Configuration</h4>
          <textarea class="field-textarea" readonly>${formatReview(payload)}</textarea>
        </section>
        <section class="section glass-soft">
          <h4>Installer Output</h4>
          <textarea class="field-textarea" id="install-log" readonly></textarea>
        </section>
      </div>
    `;
    syncInstallStatus();
  }
}

function bindValues() {
  const defaults = {
    ...state.bootstrap.defaults,
    repo_path: state.bootstrap.repo_path,
    wsl_distro: state.bootstrap.wsl_distro,
    wsl_repo_path: state.bootstrap.wsl_repo_path,
  };
  const merged = { ...defaults, ...state.currentValues };
  document.querySelectorAll("[data-field]").forEach((node) => {
    const key = node.dataset.field;
    const value = merged[key];
    if (node.type === "checkbox") node.checked = Boolean(value);
    else if (value != null) node.value = value;
    node.addEventListener("change", () => {
      state.currentValues = { ...state.currentValues, ...getPayload() };
      syncDynamicState();
    });
    node.addEventListener("input", () => {
      state.currentValues = { ...state.currentValues, ...getPayload() };
    });
  });
  document.querySelectorAll("[data-choice-field]").forEach((node) => {
    node.addEventListener("click", () => {
      const field = node.dataset.choiceField;
      const value = node.dataset.choiceValue;
      const input = document.querySelector(`[data-field="${field}"]`);
      if (!input || input.disabled) return;
      input.value = value;
      state.currentValues = { ...state.currentValues, ...getPayload() };
      syncDynamicState();
    });
  });
  syncDynamicState();
}

function syncModalSelection() {
  const selected = state.selectedExperience || state.currentValues.experience || state.bootstrap?.defaults?.experience || "";
  document.querySelectorAll("[data-modal-experience]").forEach((node) => {
    const active = node.dataset.modalExperience === selected;
    node.classList.toggle("selected", active);
    node.setAttribute("aria-pressed", active ? "true" : "false");
  });
  const status = $("onboarding-status");
  if (status) {
    status.textContent = selected ? `${selected} path selected.` : "Select a path to continue.";
  }
}

function openOnboardingModal() {
  $("onboarding-modal").hidden = false;
  document.body.classList.add("modal-open");
  syncModalSelection();
}

function closeOnboardingModal() {
  $("onboarding-modal").hidden = true;
  document.body.classList.remove("modal-open");
}

function applyExperienceSelection(experience) {
  state.selectedExperience = experience;
  state.currentValues = {
    ...state.currentValues,
    experience,
    edition: experience === "Beginner" ? "Community Edition" : state.currentValues.edition || "Community Edition",
    enterprise_key: experience === "Beginner" ? "" : state.currentValues.enterprise_key || "",
  };
  syncModalSelection();
}

function formatReview(payload) {
  const enterpriseState =
    payload.edition === "Enterprise Edition"
      ? payload.enterprise_key
        ? "provided"
        : "missing"
      : "not required";
  const umlsState = payload.umls_api_key ? "provided" : "missing";
  return [
    "Launch context",
    `  Repo path: ${payload.repo_path || "(default)"}`,
    ...(state.bootstrap?.platform?.windows
      ? [
          `  WSL distro: ${payload.wsl_distro || "(default WSL distro)"}`,
          `  WSL repo path: ${payload.wsl_repo_path || "(derived from repo path)"}`,
        ]
      : []),
    "",
    "Core setup",
    `  Experience: ${payload.experience}`,
    `  Edition: ${payload.edition}`,
    `  Enterprise key: ${enterpriseState}`,
    `  UMLS API Key: ${umlsState}`,
    `  CDM database: ${payload.cdm_dialect}`,
    `  App URL: ${payload.app_url}`,
    `  Environment: ${payload.env}`,
    `  Timezone: ${payload.timezone}`,
    `  Demo dataset: ${payload.include_eunomia ? "yes" : "no"}`,
    "",
    "Modules",
    `  Enabled groups: ${payload.modules.join(", ") || "(none)"}`,
    "",
    "Action",
    `  Upgrade existing install: ${payload.upgrade ? "yes" : "no"}`,
  ].join("\n");
}

async function validateCurrentStep() {
  try {
    const payload = getPayload();
    state.currentValues = { ...state.currentValues, ...payload };
    if (payload.dry_run) {
      setBanner("Dry run mode enabled. Step blocking checks are bypassed until you turn it off.", "info");
      return true;
    }
    const step = stepMeta[state.currentStep][0];
    if (step === "launch") {
      await api("/api/validate-launch", "POST", {
        repo_path: payload.repo_path,
        wsl_distro: payload.wsl_distro,
        wsl_repo_path: payload.wsl_repo_path,
      });
    } else if (step === "preflight") {
      if (!state.preflight) throw new Error("Run preflight checks before continuing");
      if (state.preflight.failures > 0) throw new Error("Resolve preflight failures before continuing");
    } else if (step === "basics") {
      if (!payload.experience) throw new Error("Select whether the installer is for a beginner or experienced OHDSI/OMOP user");
      if (payload.experience === "Beginner" && payload.edition !== "Community Edition") {
        throw new Error("Beginner users can only proceed with Community Edition");
      }
      if (payload.edition === "Enterprise Edition" && !String(payload.enterprise_key || "").trim()) {
        throw new Error("Enter the Enterprise Key before continuing");
      }
      if (!payload.app_url) throw new Error("App URL is required");
      if (!payload.timezone) throw new Error("Timezone is required");
    }
    setBanner("");
    return true;
  } catch (error) {
    setStatus(error.message);
    setBanner(error.message, "error");
    return false;
  }
}

async function runPreflight() {
  try {
    const payload = getPayload();
    state.currentValues = { ...state.currentValues, ...payload };
    state.preflight = await api("/api/preflight", "POST", payload);
    setStatus(
      state.preflight.failures
        ? `${state.preflight.failures} failure(s), ${state.preflight.warnings} warning(s)`
        : state.preflight.warnings
          ? `Passed with ${state.preflight.warnings} warning(s)`
        : "All checks passed",
    );
    setBanner(
      state.preflight.failures
        ? "Preflight found blocking issues. Review the sections below before continuing."
        : state.preflight.warnings
          ? "Preflight passed with warnings."
          : "Preflight passed.",
      state.preflight.failures ? "error" : "success",
    );
    renderPreflight();
  } catch (error) {
    setStatus(error.message);
    setBanner(error.message, "error");
  }
}

function renderPreflight() {
  const container = $("preflight-output");
  if (!container) return;
  if (!state.preflight) {
    container.innerHTML = `<p class="hero-copy">Run preflight to mirror the installer's exact checks against the selected repo.</p>`;
    return;
  }
  container.innerHTML = `
    <div class="preflight-section">
      <h5>Preflight Summary</h5>
      <div class="preflight-action">Repo root: ${state.preflight.repo_root}</div>
      <div class="preflight-meta">
        <span class="preflight-stat fail">${state.preflight.failures} failure(s)</span>
        <span class="preflight-stat warn">${state.preflight.warnings} warning(s)</span>
      </div>
    </div>
    ${state.preflight.sections
      .map(
        (section) => `
          <div class="preflight-section">
            <h5>${section.title}</h5>
            <div class="preflight-action">${section.action}</div>
            <div class="check-list">
              ${section.checks
                .map(
                  (check) => `
                    <div class="check-item">
                      <div class="label badge-${check.status}">${check.status.toUpperCase()}</div>
                      <div><strong>${check.name}</strong><br />${check.detail}</div>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </div>
        `,
      )
      .join("")}
  `;
}

async function validateAll() {
  try {
    const payload = getPayload();
    state.currentValues = { ...state.currentValues, ...payload };
    await api("/api/validate", "POST", payload);
    setBanner(
      payload.dry_run
        ? "Dry run validation complete. Required installer fields were relaxed for walkthrough purposes."
        : `Configuration validated successfully for ${payload.app_url}.`,
      "success",
    );
  } catch (error) {
    setBanner(error.message, "error");
  }
}

async function startInstall() {
  try {
    const payload = getPayload();
    state.currentValues = { ...state.currentValues, ...payload };
    await api("/api/install/start", "POST", payload);
    setBanner(
      payload.dry_run ? "Dry run started. No installation commands will be executed." : "Installer started. Streaming logs below.",
      "success",
    );
    await pollInstall();
  } catch (error) {
    setBanner(error.message, "error");
  }
}

async function syncInstallStatus() {
  const area = $("install-log");
  if (!area) return;
  const status = await api("/api/install/status");
  area.value = (status.logs || []).join("\n");
  area.scrollTop = area.scrollHeight;
}

async function pollInstall() {
  clearInterval(state.installPolling);
  state.installPolling = setInterval(async () => {
    const status = await api("/api/install/status");
    setBanner(status.status, status.success ? "success" : status.running ? "info" : "error");
    if ($("install-log")) {
      $("install-log").value = (status.logs || []).join("\n");
      $("install-log").scrollTop = $("install-log").scrollHeight;
    }
      if (!status.running) {
        clearInterval(state.installPolling);
        if (status.success && status.summary) {
          const payload = status.summary;
          setBanner("Installation completed successfully.", "success");
          $("step-content").innerHTML = `
            <div class="page">
              <section class="section glass-soft">
                <h4>Installation Complete</h4>
                <textarea class="field-textarea" readonly>${[
                "Parthenon installed successfully.",
                "",
                `URL: ${payload.app_url}`,
                `Admin email: ${payload.admin_email}`,
                "Admin password: saved to .install-credentials",
                "Database password: saved to .install-credentials",
              ].join("\n")}</textarea>
            </section>
          </div>
        `;
        } else {
          setBanner(status.status, "error");
        }
      }
    }, 1000);
}

function syncDynamicState() {
  const payload = getPayload();
  const beginner = payload.experience === "Beginner";
  const vocab = document.querySelector('[data-field="vocab_zip_path"]');
  if (vocab) vocab.disabled = beginner;

  const edition = document.querySelector('[data-field="edition"]');
  const enterpriseKey = document.querySelector('[data-field="enterprise_key"]');
  if (edition) {
    if (beginner) {
      edition.value = "Community Edition";
      edition.disabled = true;
    } else {
      edition.disabled = false;
    }
  }
  const enterprise = (edition ? edition.value : payload.edition) === "Enterprise Edition";
  if (enterpriseKey) {
    enterpriseKey.disabled = !enterprise;
    if (!enterprise) enterpriseKey.value = "";
  }

  document.querySelectorAll("[data-choice-group]").forEach((group) => {
    const field = group.dataset.choiceGroup;
    const input = document.querySelector(`[data-field="${field}"]`);
    const currentValue = input ? input.value : "";
    group.querySelectorAll("[data-choice-value]").forEach((card) => {
      const selected = card.dataset.choiceValue === currentValue;
      card.classList.toggle("selected", selected);
      card.setAttribute("aria-pressed", selected ? "true" : "false");
      if (card.dataset.choiceValue === "Enterprise Edition") {
        card.classList.toggle("choice-disabled", beginner);
      }
    });
  });

  const research = !!payload.research;
  const commons = !!payload.commons;
  const ai = !!payload.ai_knowledge;
  const pipeline = !!payload.data_pipeline;
  const infra = !!payload.infrastructure;

  const setCheckbox = (key, enabled) => {
    const node = document.querySelector(`[data-field="${key}"]`);
    if (!node) return;
    if (!enabled) node.checked = false;
    node.disabled = !enabled;
  };
  setCheckbox("enable_study_agent", research);
  setCheckbox("enable_livekit", commons);
  setCheckbox("enable_hecate", ai);
  setCheckbox("enable_blackrabbit", pipeline);
  setCheckbox("enable_fhir_to_cdm", pipeline);
  setCheckbox("enable_orthanc", pipeline);
  setCheckbox("enable_solr", infra);

  const setField = (key, enabled) => {
    const node = document.querySelector(`[data-field="${key}"]`);
    if (node) node.disabled = !enabled;
  };
  const livekit = commons && document.querySelector('[data-field="enable_livekit"]')?.checked;
  const orthanc = pipeline && document.querySelector('[data-field="enable_orthanc"]')?.checked;
  const solr = infra && document.querySelector('[data-field="enable_solr"]')?.checked;
  ["livekit_url", "livekit_api_key", "livekit_api_secret"].forEach((key) => setField(key, !!livekit));
  ["orthanc_user", "orthanc_password"].forEach((key) => setField(key, !!orthanc));
  ["solr_port", "solr_java_mem"].forEach((key) => setField(key, !!solr));

  state.currentValues = { ...state.currentValues, ...getPayload() };
}

async function init() {
  state.bootstrap = await api("/api/bootstrap");
  state.currentValues = {
    ...state.bootstrap.defaults,
    repo_path: state.bootstrap.repo_path,
    wsl_distro: state.bootstrap.wsl_distro,
    wsl_repo_path: state.bootstrap.wsl_repo_path,
  };
  state.selectedExperience = state.currentValues.experience || "";
  buildSteps();
  showStep(0);
  document.querySelectorAll("[data-modal-experience]").forEach((node) => {
    node.addEventListener("click", () => applyExperienceSelection(node.dataset.modalExperience));
  });
  const submitOnboarding = () => {
    const experience = state.selectedExperience || state.currentValues.experience || state.bootstrap?.defaults?.experience || "Beginner";
    applyExperienceSelection(experience);
    state.currentValues = {
      ...state.currentValues,
      experience,
    };
    setBanner("");
    closeOnboardingModal();
    showStep(0);
    return true;
  };
  $("onboarding-continue").addEventListener("click", submitOnboarding);
  document.querySelectorAll("[data-modal-experience]").forEach((node) => {
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        applyExperienceSelection(node.dataset.modalExperience);
      }
    });
  });
  $("back-btn").addEventListener("click", () => showStep(Math.max(0, state.currentStep - 1)));
  $("next-btn").addEventListener("click", async () => {
    if (!(await validateCurrentStep())) return;
    showStep(Math.min(stepMeta.length - 1, state.currentStep + 1));
  });
  $("validate-btn").addEventListener("click", validateAll);
  $("install-btn").addEventListener("click", startInstall);
  $("dry-run-btn").addEventListener("click", () => {
    const nextDryRun = !state.currentValues.dry_run;
    state.currentValues = { ...state.currentValues, dry_run: nextDryRun };
    syncActionButtons();
    setBanner(
      nextDryRun
        ? "Dry run mode enabled. You can move through the wizard without resolving launch or preflight blockers."
        : "Dry run mode disabled. Normal step validation is active again.",
      nextDryRun ? "success" : "info",
    );
  });
  setBanner("");
  openOnboardingModal();
}

init().catch((error) => {
  $("step-content").innerHTML = `<div class="page"><section class="section glass-soft"><h4>Launcher Error</h4><p>${error.message}</p></section></div>`;
  setBanner(error.message, "error");
});
