const experiencedSteps = [
  ["launch", "1. Environment", "Choose the Parthenon workspace"],
  ["preflight", "2. Readiness", "Check this machine before install"],
  ["basics", "3. Install Path", "Edition, license keys, and deployment defaults"],
  ["credentials", "4. Access", "Create administrator and database credentials"],
  ["modules", "5. Services", "Select platform modules and supporting services"],
  ["review", "6. Confirm", "Review settings and start installation"],
];

const beginnerSteps = [
  ["beginner_setup", "1. Setup", "Your admin account and workspace"],
  ["beginner_check", "2. Check", "Verify this machine is ready"],
  ["beginner_install", "3. Install", "Deploy Parthenon and start using it"],
];

let stepMeta = experiencedSteps;

const state = {
  bootstrap: null,
  currentStep: 0,
  preflight: null,
  installPolling: null,
  currentValues: {},
  selectedExperience: "",
};

const $ = (id) => document.getElementById(id);

function generateSecurePassword(length) {
  const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => charset[v % charset.length]).join("");
}

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
  // Dry run is set once from the modal — no runtime toggle needed
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
  const isBeginner = state.selectedExperience === "Beginner";
  $("back-btn").disabled = index === 0;
  $("next-btn").disabled = index === stepMeta.length - 1;
  // In beginner mode, hide the action bar install/validate buttons (install is inline on step 3)
  $("validate-btn").disabled = isBeginner || index !== stepMeta.length - 1;
  $("install-btn").disabled = isBeginner || index !== stepMeta.length - 1;
  if (isBeginner) {
    $("validate-btn").style.display = "none";
    $("install-btn").style.display = "none";
    $("upgrade").parentElement.style.display = "none";
  }
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
              : secret
                ? `<div class="secret-field">
                     <input class="field-input" data-field="${key}" type="password" />
                     <button type="button" class="eye-toggle" data-eye-for="${key}" aria-label="Toggle visibility">
                       <svg class="eye-icon eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                       <svg class="eye-icon eye-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                     </button>
                   </div>`
                : `<input class="field-input" data-field="${key}" type="text" />`
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
    const repoReadOnly = state.bootstrap.remote;
    const windowsFields = !repoReadOnly && state.bootstrap.platform.windows
      ? `
          <section class="section glass-soft">
            <div class="section-kicker">WSL Configuration</div>
            <h4>Windows Subsystem for Linux</h4>
            <p class="section-copy">Parthenon runs inside WSL. Specify the distro and path if the repo lives inside the WSL filesystem.</p>
            <div class="grid two">
              ${renderFields([
                { key: "wsl_distro", label: "WSL distro" },
                { key: "wsl_repo_path", label: "WSL repo path" },
              ])}
            </div>
          </section>
        `
      : "";
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft">
          <div class="section-kicker">Workspace</div>
          <h4>Parthenon Repository</h4>
          <p class="section-copy">${
            repoReadOnly
              ? "The repository was downloaded automatically by the remote installer."
              : state.bootstrap.platform.windows
                ? "Confirm the path to the Parthenon repository. On Windows, you may also specify a WSL path below."
                : "Confirm the local path to the Parthenon repository. The installer will write configuration files and start Docker services from this directory."
          }</p>
          <div class="grid">
            ${renderFields([{ key: "repo_path", label: "Repository path" }])}
          </div>
        </section>
        ${windowsFields}
      </div>
    `;
    if (repoReadOnly) {
      const repoInput = document.querySelector('[data-field="repo_path"]');
      if (repoInput) repoInput.readOnly = true;
    }
    bindValues();
    return;
  }

  if (stepKey === "preflight") {
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft">
          <div class="section-kicker">System Check</div>
          <h4>Verify Environment</h4>
          <p class="section-copy">Acropolis checks that Docker, Compose, disk space, and required ports are available. The wizard will not advance while failures remain.</p>
          <div class="inline-actions">
            <button class="btn primary" id="run-preflight">Run Preflight Checks</button>
          </div>
        </section>
        <section class="section glass-soft" id="preflight-results-section" style="display:none;">
          <div class="section-kicker">Results</div>
          <h4>Check Results</h4>
          <div id="preflight-output" class="preflight-summary"></div>
        </section>
      </div>
    `;
    $("run-preflight").addEventListener("click", async () => {
      await runPreflight();
      const resultsSection = $("preflight-results-section");
      if (resultsSection) resultsSection.style.display = "";
    });
    if (state.preflight) {
      const resultsSection = $("preflight-results-section");
      if (resultsSection) resultsSection.style.display = "";
      renderPreflight();
    }
    return;
  }

  if (stepKey === "basics") {
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft">
          <div class="section-kicker">Community Setup</div>
          <h4>Install Path &amp; Keys</h4>
          <p class="section-copy">Community Edition installs the core Parthenon stack with guided setup, demo data, and optional services.</p>
          <div class="grid two">
            ${renderFields([
              { key: "umls_api_key", label: "UMLS API key", secret: true },
            ])}
          </div>
          <div class="field" style="margin-top: 0.95rem;">
            <span class="field-label">Athena vocabulary ZIP</span>
            <div class="file-picker-row">
              <input class="field-input" data-field="vocab_zip_path" type="text" placeholder="/path/to/vocabulary_download_v5.zip" />
              <button class="btn secondary" id="browse-vocab" type="button">Browse</button>
            </div>
          </div>
          <div class="inline-actions">
            <label class="checkbox-row">
              <input type="checkbox" data-field="include_eunomia" />
              <span>Include Eunomia demo dataset (GiBleed, recommended for evaluation)</span>
            </label>
          </div>
        </section>
        <section class="section glass-soft">
          <div class="section-kicker">Environment</div>
          <h4>Deployment Configuration</h4>
          <p class="section-copy">Set the base URL, database dialect, and timezone for this installation.</p>
          <div class="grid two">
            ${renderFields([
              { key: "app_url", label: "Application URL" },
              { key: "env", label: "Environment", type: "select", options: ["local", "production"] },
              { key: "cdm_dialect", label: "CDM database dialect", type: "select", options: defaults ? ["PostgreSQL", "Microsoft SQL Server", "Google BigQuery", "Amazon Redshift", "Snowflake", "Oracle", "Not sure yet / will configure later"] : [] },
              { key: "timezone", label: "Timezone" },
            ])}
          </div>
        </section>
        <input type="hidden" data-field="edition" value="Community Edition" />
        <input type="hidden" data-field="enterprise_key" value="" />
      </div>
    `;
    bindValues();
    $("browse-vocab").addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".zip";
      input.addEventListener("change", () => {
        if (input.files && input.files[0]) {
          const vocabField = document.querySelector('[data-field="vocab_zip_path"]');
          if (vocabField) {
            // Browsers only expose the filename, not the full path.
            // Show the filename as a hint; user should paste the full path.
            const name = input.files[0].name;
            vocabField.value = name;
            vocabField.placeholder = `Selected: ${name} — paste full path if needed`;
            state.currentValues = { ...state.currentValues, ...getPayload() };
          }
        }
      });
      input.click();
    });
    return;
  }

  if (stepKey === "credentials") {
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft">
          <div class="section-kicker">Administrator</div>
          <h4>Admin Account</h4>
          <p class="section-copy">The first user account is created during installation with the super-admin role. A temporary password is generated and emailed after first login.</p>
          <div class="grid two">
            ${renderFields([
              { key: "admin_email", label: "Admin email" },
              { key: "admin_name", label: "Display name" },
            ])}
          </div>
        </section>
        <section class="section glass-soft">
          <div class="section-kicker">Security</div>
          <h4>Passwords</h4>
          <p class="section-copy">Secure passwords are pre-generated. You can accept the defaults or generate new ones. Passwords are saved to <code>.install-credentials</code> after installation.</p>
          <div class="grid two">
            ${renderFields([
              { key: "admin_password", label: "Admin password", secret: true },
              { key: "db_password", label: "Database password", secret: true },
            ])}
          </div>
          <div class="inline-actions">
            <button class="btn secondary" id="regen-admin">Regenerate Admin Password</button>
            <button class="btn secondary" id="regen-db">Regenerate DB Password</button>
          </div>
        </section>
      </div>
    `;
    bindValues();
    $("regen-admin").onclick = () => ($('[data-field="admin_password"]').value = generateSecurePassword(16));
    $("regen-db").onclick = () => ($('[data-field="db_password"]').value = generateSecurePassword(24));
    return;
  }

  if (stepKey === "modules") {
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft">
          <div class="section-kicker">Platform Modules</div>
          <h4>Core Capabilities</h4>
          <p class="section-copy">Select which module groups to enable. Each group activates related services and UI features. All modules are enabled by default.</p>
          ${renderCheckboxGrid([
            ["research", "Research"],
            ["commons", "Commons"],
            ["ai_knowledge", "AI & Knowledge"],
            ["data_pipeline", "Data Pipeline"],
            ["infrastructure", "Infrastructure"],
          ])}
        </section>
        <section class="section glass-soft">
          <div class="section-kicker">Add-On Services</div>
          <h4>Optional Components</h4>
          <p class="section-copy">These services extend the platform with specialized capabilities. Each is tied to a parent module group and is disabled when its parent is off.</p>
          ${renderCheckboxGrid([
            ["enable_study_agent", "Study Designer"],
            ["enable_hecate", "Hecate AI"],
            ["enable_blackrabbit", "BlackRabbit ETL"],
            ["enable_fhir_to_cdm", "FHIR-to-CDM"],
            ["enable_orthanc", "Orthanc DICOM"],
            ["enable_livekit", "LiveKit RTC"],
            ["enable_solr", "Apache Solr"],
          ])}
        </section>
        <section class="section glass-soft">
          <div class="section-kicker">Service Configuration</div>
          <h4>Credentials &amp; Ports</h4>
          <p class="section-copy">Configure credentials for optional services that require them, and set the primary entrypoint port. Internal service ports are auto-assigned.</p>
          <div class="grid two">
            ${renderFields([
              { key: "nginx_port", label: "NGINX entrypoint port" },
              { key: "solr_java_mem", label: "Solr JVM memory" },
              { key: "livekit_url", label: "LiveKit URL" },
              { key: "livekit_api_key", label: "LiveKit API key" },
              { key: "livekit_api_secret", label: "LiveKit API secret", secret: true },
              { key: "orthanc_user", label: "Orthanc user" },
              { key: "orthanc_password", label: "Orthanc password", secret: true },
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
          <div class="section-kicker">Summary</div>
          <h4>Review Configuration</h4>
          <p class="section-copy">Verify your settings before starting the installation. Use <strong>Validate</strong> to check for errors, or <strong>Start Installation</strong> to begin.</p>
          ${formatReview(payload)}
        </section>
        <section class="section glass-soft">
          <div class="section-kicker">Output</div>
          <h4>Installer Log</h4>
          <p class="section-copy">Real-time output from the installation process will appear below once started.</p>
          <textarea class="field-textarea" id="install-log" readonly placeholder="Waiting for installation to start..."></textarea>
        </section>
      </div>
    `;
    syncInstallStatus();
  }

  // ── Beginner flow ──────────────────────────────────────────────────────────

  if (stepKey === "beginner_setup") {
    const repoReadOnly = state.bootstrap.remote;
    const windowsFields = !repoReadOnly && state.bootstrap.platform.windows
      ? `
          <div class="grid two">
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
          <div class="section-kicker">Administrator</div>
          <h4>Who is this installation for?</h4>
          <p class="section-copy">Create the first admin account. Leave the password blank to auto-generate one. Credentials are saved to <code>.install-credentials</code> after installation.</p>
          <div class="grid two">
            ${renderFields([
              { key: "admin_email", label: "Your email address" },
              { key: "admin_name", label: "Display name" },
              { key: "admin_password", label: "Admin password (optional)", secret: true },
            ])}
          </div>
        </section>
        <section class="section glass-soft">
          <div class="section-kicker">Workspace</div>
          <h4>Parthenon Repository</h4>
          <p class="section-copy">${
            repoReadOnly
              ? "The repository was downloaded automatically by the remote installer."
              : "Confirm the path to the cloned Parthenon repository. This is usually auto-detected."
          }</p>
          <div class="grid">
            ${renderFields([{ key: "repo_path", label: "Repository path" }])}
          </div>
          ${windowsFields}
        </section>
      </div>
    `;
    if (repoReadOnly) {
      const repoInput = document.querySelector('[data-field="repo_path"]');
      if (repoInput) repoInput.readOnly = true;
    }
    bindValues();
    return;
  }

  if (stepKey === "beginner_check") {
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft">
          <div class="section-kicker">System Check</div>
          <h4>Verify Your Machine</h4>
          <p class="section-copy">Acropolis checks that Docker, Compose, and disk space are available. Once all checks pass, you can proceed to install.</p>
          <div class="inline-actions">
            <button class="btn primary" id="run-preflight">Run Checks</button>
          </div>
        </section>
        <section class="section glass-soft" id="preflight-results-section" style="display:none;">
          <div class="section-kicker">Results</div>
          <h4>Check Results</h4>
          <div id="preflight-output" class="preflight-summary"></div>
        </section>
      </div>
    `;
    $("run-preflight").addEventListener("click", async () => {
      await runPreflight();
      const resultsSection = $("preflight-results-section");
      if (resultsSection) resultsSection.style.display = "";
    });
    if (state.preflight) {
      const resultsSection = $("preflight-results-section");
      if (resultsSection) resultsSection.style.display = "";
      renderPreflight();
    }
    return;
  }

  if (stepKey === "beginner_install") {
    container.innerHTML = `
      <div class="page">
        <section class="section glass-soft beginner-ready-section">
          <div class="section-kicker">Ready</div>
          <h4>Install Parthenon</h4>
          <p class="section-copy">
            Community Edition will be installed with all default modules enabled and the
            Eunomia demo dataset included. After installation, log in and the setup wizard
            will guide you through vocabulary import, data sources, and AI configuration.
          </p>
          <div class="beginner-summary">
            <div class="review-grid">
              <div class="review-group">
                <div class="review-group-title">Your Installation</div>
                <div class="review-row"><span class="review-label">Edition</span><span class="review-value">Community Edition</span></div>
                <div class="review-row"><span class="review-label">Admin</span><span class="review-value">${state.currentValues.admin_email || "admin@example.com"}</span></div>
                <div class="review-row"><span class="review-label">URL</span><span class="review-value">${state.currentValues.app_url || "http://localhost:8082"}</span></div>
                <div class="review-row"><span class="review-label">Demo Data</span><span class="review-value">Eunomia (GiBleed)</span></div>
                <div class="review-row"><span class="review-label">Repo</span><span class="review-value">${state.currentValues.repo_path || state.bootstrap.repo_path}</span></div>
              </div>
            </div>
          </div>
          <div class="inline-actions" style="margin-top: 1.2rem;">
            <button class="btn primary beginner-install-btn" id="beginner-start-install">Install Parthenon</button>
          </div>
        </section>
        <section class="section glass-soft" id="beginner-log-section" style="display:none;">
          <div class="section-kicker">Progress</div>
          <h4>Installation Log</h4>
          <textarea class="field-textarea" id="install-log" readonly placeholder="Waiting to start..."></textarea>
        </section>
        <section class="section glass-soft" id="beginner-done-section" style="display:none;">
          <div class="section-kicker">Complete</div>
          <h4>Parthenon is Ready</h4>
          <p class="section-copy" id="beginner-done-copy"></p>
          <div class="inline-actions">
            <a class="btn primary" id="beginner-open-link" href="#" target="_blank" rel="noopener noreferrer">Open Parthenon</a>
          </div>
        </section>
      </div>
    `;
    $("beginner-start-install").addEventListener("click", async () => {
      try {
        // Set beginner defaults (preserve dry_run from modal)
        state.currentValues = {
          ...state.currentValues,
          experience: "Beginner",
          edition: "Community Edition",
          include_eunomia: true,
          upgrade: false,
        };
        const payload = getPayload();
        await api("/api/install/start", "POST", payload);
        $("beginner-start-install").disabled = true;
        $("beginner-start-install").textContent = "Installing...";
        $("beginner-log-section").style.display = "";
        setBanner("Installation started. This may take a few minutes.", "info");
        // Poll for completion
        clearInterval(state.installPolling);
        state.installPolling = setInterval(async () => {
          try {
            const status = await api("/api/install/status");
            if ($("install-log")) {
              $("install-log").value = (status.logs || []).join("\n");
              $("install-log").scrollTop = $("install-log").scrollHeight;
            }
            if (!status.running) {
              clearInterval(state.installPolling);
              if (status.success) {
                const appUrl = state.currentValues.app_url || "http://localhost:8082";
                setBanner("Installation complete.", "success");
                $("beginner-start-install").textContent = "Installed";
                $("beginner-done-section").style.display = "";
                $("beginner-done-copy").innerHTML =
                  "Your Parthenon instance is live. Log in with your admin email and the temporary password from <code>.install-credentials</code>. " +
                  "The setup wizard inside Parthenon will help you configure vocabulary, data sources, and AI services.";
                $("beginner-open-link").href = appUrl;
                $("beginner-open-link").textContent = "Open Parthenon \u2192";
              } else {
                setBanner(status.status, "error");
                $("beginner-start-install").disabled = false;
                $("beginner-start-install").textContent = "Retry Installation";
              }
            }
          } catch (err) {
            clearInterval(state.installPolling);
            setBanner("Lost connection to installer: " + err.message, "error");
            $("beginner-start-install").disabled = false;
            $("beginner-start-install").textContent = "Retry Installation";
          }
        }, 1000);
      } catch (error) {
        setBanner(error.message, "error");
      }
    });
    return;
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
  document.querySelectorAll(".eye-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const key = btn.dataset.eyeFor;
      const input = document.querySelector(`[data-field="${key}"]`);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.classList.toggle("showing", !showing);
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
  stepMeta = experience === "Beginner" ? beginnerSteps : experiencedSteps;
  state.currentValues = {
    ...state.currentValues,
    experience,
    edition: "Community Edition",
    enterprise_key: "",
  };
  syncModalSelection();
}

function formatReview(payload) {
  function row(label, value) {
    return `<div class="review-row"><span class="review-label">${label}</span><span class="review-value">${value || "&mdash;"}</span></div>`;
  }

  function group(title, rows) {
    return `<div class="review-group"><div class="review-group-title">${title}</div>${rows}</div>`;
  }

  const wslRows = state.bootstrap?.platform?.windows
    ? row("WSL Distro", payload.wsl_distro || "(default)") + row("WSL Repo Path", payload.wsl_repo_path || "(derived)")
    : "";

  const services = [];
  if (payload.enable_study_agent) services.push("Study Designer");
  if (payload.enable_hecate) services.push("Hecate AI");
  if (payload.enable_blackrabbit) services.push("BlackRabbit ETL");
  if (payload.enable_fhir_to_cdm) services.push("FHIR-to-CDM");
  if (payload.enable_orthanc) services.push("Orthanc DICOM");
  if (payload.enable_livekit) services.push("LiveKit RTC");
  if (payload.enable_solr) services.push("Apache Solr");

  return `<div class="review-grid">`
    + group("Environment",
        row("Repository", payload.repo_path || "(default)")
        + wslRows
        + row("Application URL", payload.app_url)
        + row("Environment", payload.env)
        + row("Timezone", payload.timezone))
    + group("Edition",
        row("Experience", payload.experience)
        + row("Edition", payload.edition)
        + row("CDM Dialect", payload.cdm_dialect)
        + row("Demo Dataset", payload.include_eunomia ? "Eunomia (GiBleed)" : "None"))
    + group("Access",
        row("Admin Email", payload.admin_email)
        + row("Admin Name", payload.admin_name)
        + row("Admin Password", payload.admin_password ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "not set")
        + row("DB Password", payload.db_password ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "not set"))
    + group("Platform",
        row("Module Groups", payload.modules.join(", ") || "(none)")
        + row("Optional Services", services.join(", ") || "(none)")
        + row("NGINX Port", payload.nginx_port)
        + row("Upgrade Mode", payload.upgrade ? "Yes" : "No"))
    + `</div>`;
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
      if (!payload.app_url) throw new Error("Application URL is required");
      if (!payload.timezone) throw new Error("Timezone is required");
    } else if (step === "credentials") {
      if (!payload.admin_email || !payload.admin_email.includes("@"))
        throw new Error("A valid admin email is required");
      if (!payload.admin_password || payload.admin_password.length < 8)
        throw new Error("Admin password must be at least 8 characters");
      if (!payload.db_password || payload.db_password.length < 8)
        throw new Error("Database password must be at least 8 characters");
    } else if (step === "modules") {
      if (!payload.modules || payload.modules.length === 0)
        throw new Error("Select at least one module group");
    } else if (step === "beginner_setup") {
      await api("/api/validate-launch", "POST", {
        repo_path: payload.repo_path,
        wsl_distro: payload.wsl_distro,
        wsl_repo_path: payload.wsl_repo_path,
      });
      if (!payload.admin_email || !payload.admin_email.includes("@"))
        throw new Error("A valid email address is required");
    } else if (step === "beginner_check") {
      if (!state.preflight) throw new Error("Run checks before continuing");
      if (state.preflight.failures > 0) throw new Error("Resolve failures before continuing");
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
    try {
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
    } catch (err) {
      clearInterval(state.installPolling);
      setBanner("Lost connection to installer server: " + err.message, "error");
    }
  }, 1000);
}

function syncDynamicState() {
  const payload = getPayload();

  // Module → service dependency gating
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

  // Service credential fields: only enabled when the parent service is on
  const setField = (key, enabled) => {
    const node = document.querySelector(`[data-field="${key}"]`);
    if (node) node.disabled = !enabled;
  };
  const livekit = commons && document.querySelector('[data-field="enable_livekit"]')?.checked;
  const orthanc = pipeline && document.querySelector('[data-field="enable_orthanc"]')?.checked;
  const solr = infra && document.querySelector('[data-field="enable_solr"]')?.checked;
  ["livekit_url", "livekit_api_key", "livekit_api_secret"].forEach((key) => setField(key, !!livekit));
  ["orthanc_user", "orthanc_password"].forEach((key) => setField(key, !!orthanc));
  ["solr_java_mem"].forEach((key) => setField(key, !!solr));

  state.currentValues = { ...state.currentValues, ...getPayload() };
}

async function init() {
  state.bootstrap = await api("/api/bootstrap");
  const d = state.bootstrap.defaults;
  // Derive individual module booleans from the modules array so checkboxes bind correctly
  const mods = d.modules || [];
  state.currentValues = {
    ...d,
    repo_path: state.bootstrap.repo_path,
    wsl_distro: state.bootstrap.wsl_distro,
    wsl_repo_path: state.bootstrap.wsl_repo_path,
    research: mods.includes("research"),
    commons: mods.includes("commons"),
    ai_knowledge: mods.includes("ai_knowledge"),
    data_pipeline: mods.includes("data_pipeline"),
    infrastructure: mods.includes("infrastructure"),
    umls_api_key: d.umls_api_key || "",
    edition: "Community Edition",
    enterprise_key: "",
  };
  state.selectedExperience = state.currentValues.experience || "";
  buildSteps();
  showStep(0);
  document.querySelectorAll("[data-modal-experience]").forEach((node) => {
    node.addEventListener("click", () => applyExperienceSelection(node.dataset.modalExperience));
  });
  const submitOnboarding = () => {
    const experience = state.selectedExperience || state.currentValues.experience || state.bootstrap?.defaults?.experience || "Beginner";
    const dryRun = $("modal-dry-run-toggle").checked;
    applyExperienceSelection(experience);
    state.currentValues = {
      ...state.currentValues,
      experience,
      dry_run: dryRun,
    };
    setBanner("");
    closeOnboardingModal();
    buildSteps();
    showStep(0);
    // Hide experienced-only controls in beginner mode
    const isBeginner = experience === "Beginner";
    $("validate-btn").style.display = isBeginner ? "none" : "";
    // Dry run toggle moved to modal
    $("upgrade").parentElement.style.display = isBeginner ? "none" : "";
    // Show persistent dry run banner
    if (dryRun) {
      setBanner("Dry run mode. No files will be written and no services will be started.", "info");
    }
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
  // Dry run toggle is now in the modal — no action bar button needed
  setBanner("");
  openOnboardingModal();
}

init().catch((error) => {
  $("step-content").innerHTML = `<div class="page"><section class="section glass-soft"><h4>Launcher Error</h4><p>${error.message}</p></section></div>`;
  setBanner(error.message, "error");
});
