use serde::{Deserialize, Serialize};
use std::{
    env, fs,
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
struct InstallerState {
    running: Mutex<bool>,
}

#[derive(Debug, Serialize)]
struct BootstrapPayload {
    repo_path: String,
    platform: String,
    python: Option<String>,
    windows: bool,
}

#[derive(Debug, Serialize)]
struct CheckResult {
    name: String,
    status: String,
    detail: String,
}

#[derive(Debug, Deserialize)]
struct ContractPreflightPayload {
    preflight: ContractPreflight,
}

#[derive(Debug, Deserialize)]
struct ContractPreflight {
    checks: Vec<ContractCheck>,
}

#[derive(Debug, Deserialize)]
struct ContractCheck {
    name: String,
    status: String,
    detail: String,
}

#[derive(Clone, Debug, Serialize)]
struct InstallEvent {
    stream: String,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
struct InstallFinished {
    success: bool,
    code: Option<i32>,
    message: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct InstallRequest {
    repo_path: String,
    wsl_distro: Option<String>,
    wsl_repo_path: Option<String>,
    admin_email: String,
    admin_name: String,
    admin_password: String,
    app_url: String,
    timezone: String,
    cdm_setup_mode: String,
    cdm_existing_state: String,
    cdm_dialect: String,
    cdm_server: String,
    cdm_database: String,
    cdm_user: String,
    cdm_password: String,
    cdm_schema: String,
    vocabulary_schema: String,
    results_schema: String,
    temp_schema: String,
    vocabulary_setup: String,
    vocab_zip_path: String,
    include_eunomia: bool,
    enable_solr: bool,
    enable_study_agent: bool,
    enable_blackrabbit: bool,
    enable_fhir_to_cdm: bool,
    enable_hecate: bool,
    enable_orthanc: bool,
    ollama_url: String,
    dry_run: bool,
}

#[tauri::command]
fn bootstrap() -> BootstrapPayload {
    BootstrapPayload {
        repo_path: find_repo_root()
            .map(|path| path.to_string_lossy().to_string())
            .unwrap_or_default(),
        platform: env::consts::OS.to_string(),
        python: resolve_python(),
        windows: cfg!(target_os = "windows"),
    }
}

#[tauri::command]
fn validate_environment(request: InstallRequest) -> Vec<CheckResult> {
    match contract_validation_check(&request) {
        Ok(validation_check) => match contract_preflight_checks(&request) {
            Ok(mut checks) => {
                checks.insert(0, validation_check);
                checks
            }
            Err(err) => {
                let mut checks = fallback_environment_checks(&request);
                checks.push(validation_check);
                checks.push(CheckResult::fail("Python installer preflight", err));
                checks
            }
        },
        Err(err) => {
            let mut checks = fallback_environment_checks(&request);
            checks.push(CheckResult::fail("Python installer validation", err));
            checks
        }
    }
}

fn fallback_environment_checks(request: &InstallRequest) -> Vec<CheckResult> {
    let mut checks = Vec::new();

    if cfg!(target_os = "windows") {
        if request.repo_path.trim().is_empty()
            && request
                .wsl_repo_path
                .as_deref()
                .map(str::trim)
                .unwrap_or_default()
                .is_empty()
        {
            checks.push(CheckResult::fail(
                "Parthenon checkout",
                "Provide either a Windows checkout path or a WSL repo path",
            ));
        } else if !request.repo_path.trim().is_empty() {
            checks.push(local_repo_check(request.repo_path.trim()));
        }
        checks.push(command_check("WSL", "wsl.exe", &["--status"]));
        if let Some(wsl_repo) = request
            .wsl_repo_path
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            checks.push(wsl_check(
                "WSL checkout",
                request.wsl_distro.as_deref().unwrap_or_default(),
                &format!("test -f {}/install.py", shell_quote(wsl_repo.trim())),
                "install.py is reachable inside WSL",
            ));
            checks.push(wsl_check(
                "WSL Python",
                request.wsl_distro.as_deref().unwrap_or_default(),
                "python3 --version",
                "python3 is available inside WSL",
            ));
            checks.push(wsl_check(
                "WSL Docker",
                request.wsl_distro.as_deref().unwrap_or_default(),
                "docker --version && docker compose version",
                "Docker and Compose are available inside WSL",
            ));
        } else {
            checks.push(CheckResult::warn(
                "WSL repo path",
                "Provide the Linux path to the Parthenon checkout before installing on Windows",
            ));
        }
    } else {
        checks.push(local_repo_check(request.repo_path.trim()));
        checks.push(match resolve_python() {
            Some(python) => command_check("Python", &python, &["--version"]),
            None => CheckResult::fail("Python", "python3 or python was not found on PATH"),
        });
        checks.push(command_check("Docker", "docker", &["--version"]));
        checks.push(command_check(
            "Docker Compose",
            "docker",
            &["compose", "version"],
        ));
    }

    checks
}

fn local_repo_check(repo_path: &str) -> CheckResult {
    let repo_path = PathBuf::from(repo_path);
    let install_py = repo_path.join("install.py");
    if install_py.exists() {
        CheckResult::pass(
            "Parthenon checkout",
            format!("Found {}", install_py.display()),
        )
    } else {
        CheckResult::fail(
            "Parthenon checkout",
            "install.py was not found in the selected directory",
        )
    }
}

#[tauri::command]
fn preview_defaults(request: InstallRequest) -> Result<String, String> {
    install_summary_text(&request)
}

#[tauri::command]
fn start_install(
    app: AppHandle,
    state: State<'_, InstallerState>,
    request: InstallRequest,
) -> Result<(), String> {
    {
        let mut running = state
            .running
            .lock()
            .map_err(|_| "Installer state lock failed")?;
        if *running {
            return Err("An install is already running".to_string());
        }
        *running = true;
    }

    let app_for_thread = app.clone();
    thread::spawn(move || {
        let result = run_install(app_for_thread.clone(), request);
        if let Err(message) = result {
            let _ = app_for_thread.emit(
                "install-log",
                InstallEvent {
                    stream: "error".to_string(),
                    message: message.clone(),
                },
            );
            let _ = app_for_thread.emit(
                "install-finished",
                InstallFinished {
                    success: false,
                    code: None,
                    message,
                },
            );
        }

        if let Some(state) = app_for_thread.try_state::<InstallerState>() {
            if let Ok(mut running) = state.running.lock() {
                *running = false;
            }
        }
    });

    Ok(())
}

fn run_install(app: AppHandle, request: InstallRequest) -> Result<(), String> {
    if request.dry_run {
        emit_log(
            &app,
            "stdout",
            "Test run selected. No files were changed and no Docker services were started.",
        );
        let summary = install_summary_text(&request)?;
        for line in summary.lines() {
            emit_log(&app, "stdout", line);
        }
        let _ = app.emit(
            "install-finished",
            InstallFinished {
                success: true,
                code: Some(0),
                message: "Dry run complete".to_string(),
            },
        );
        return Ok(());
    }

    let defaults_json = contract_defaults_json(&request, false)?;
    let mut command_plan = if cfg!(target_os = "windows") {
        build_windows_wsl_command(&request, &defaults_json)?
    } else {
        build_local_command(&request, &defaults_json)?
    };

    emit_log(
        &app,
        "stdout",
        &format!("Launching installer from {}", command_plan.display_location),
    );

    let temp_defaults = command_plan.temp_defaults.clone();
    let mut child = match command_plan
        .command
        .current_dir(&command_plan.cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(err) => {
            cleanup_temp_file(temp_defaults);
            return Err(format!("Could not launch installer: {err}"));
        }
    };

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_stdout = app.clone();
    let out_reader =
        stdout.map(|stream| thread::spawn(move || read_stream(stream, app_stdout, "stdout")));
    let app_stderr = app.clone();
    let err_reader =
        stderr.map(|stream| thread::spawn(move || read_stream(stream, app_stderr, "stderr")));

    let status = match child.wait() {
        Ok(status) => status,
        Err(err) => {
            cleanup_temp_file(temp_defaults);
            return Err(format!("Installer process wait failed: {err}"));
        }
    };
    cleanup_temp_file(temp_defaults);
    if let Some(handle) = out_reader {
        let _ = handle.join();
    }
    if let Some(handle) = err_reader {
        let _ = handle.join();
    }

    let success = status.success();
    let code = status.code();
    let message = if success {
        "Installation complete".to_string()
    } else {
        format!(
            "Installer exited with status {}",
            code.map_or_else(|| "unknown".to_string(), |c| c.to_string())
        )
    };

    let _ = app.emit(
        "install-finished",
        InstallFinished {
            success,
            code,
            message,
        },
    );

    Ok(())
}

fn read_stream<R: Read>(stream: R, app: AppHandle, stream_name: &'static str) {
    let reader = BufReader::new(stream);
    for line in reader.lines().map_while(Result::ok) {
        emit_log(&app, stream_name, &line);
    }
}

fn emit_log(app: &AppHandle, stream: &str, message: &str) {
    let _ = app.emit(
        "install-log",
        InstallEvent {
            stream: stream.to_string(),
            message: message.to_string(),
        },
    );
}

struct CommandPlan {
    command: Command,
    cwd: PathBuf,
    temp_defaults: Option<PathBuf>,
    display_location: String,
}

fn build_local_command(
    request: &InstallRequest,
    defaults_json: &str,
) -> Result<CommandPlan, String> {
    let repo_path = PathBuf::from(request.repo_path.trim());
    validate_repo_path(&repo_path)?;
    let python =
        resolve_python().ok_or_else(|| "python3 or python was not found on PATH".to_string())?;
    let defaults_path = write_defaults_file(defaults_json)?;

    let mut command = Command::new(python);
    command.args(["install.py", "--defaults-file"]);
    command.arg(&defaults_path);
    command.arg("--non-interactive");

    Ok(CommandPlan {
        command,
        display_location: repo_path.display().to_string(),
        cwd: repo_path,
        temp_defaults: Some(defaults_path),
    })
}

fn build_windows_wsl_command(
    request: &InstallRequest,
    defaults_json: &str,
) -> Result<CommandPlan, String> {
    let repo_linux = request
        .wsl_repo_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            "Windows installs require a WSL repo path, such as /home/user/Parthenon".to_string()
        })?;

    let script = format!(
        r#"set -e
defaults_file=$(mktemp)
cat > "$defaults_file" <<'PARTHENON_DEFAULTS'
{defaults_json}
PARTHENON_DEFAULTS
cd {repo}
set +e
python3 install.py --defaults-file "$defaults_file" --non-interactive
rc=$?
rm -f "$defaults_file"
exit "$rc"
"#,
        repo = shell_quote(repo_linux),
    );

    let mut command = Command::new("wsl.exe");
    if let Some(distro) = request
        .wsl_distro
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        command.args(["-d", distro]);
    }
    command.args(["bash", "-lc", &script]);

    Ok(CommandPlan {
        command,
        cwd: env::current_dir().map_err(|err| err.to_string())?,
        temp_defaults: None,
        display_location: format!("WSL:{repo_linux}"),
    })
}

fn contract_defaults_json(request: &InstallRequest, redact: bool) -> Result<String, String> {
    contract_payload_json(request, "defaults", redact)
}

fn contract_plan_json(request: &InstallRequest, redact: bool) -> Result<String, String> {
    contract_payload_json(request, "plan", redact)
}

fn contract_preflight_checks(request: &InstallRequest) -> Result<Vec<CheckResult>, String> {
    let payload = contract_payload_json(request, "preflight", true)?;
    parse_contract_preflight_checks(&payload)
}

fn contract_validation_check(request: &InstallRequest) -> Result<CheckResult, String> {
    let payload = contract_payload_json(request, "validate", true)?;
    parse_contract_validation_check(&payload)
}

fn contract_payload_json(
    request: &InstallRequest,
    action: &str,
    redact: bool,
) -> Result<String, String> {
    let seed_json =
        serde_json::to_string_pretty(&build_seed(request)).map_err(|err| err.to_string())?;
    let command_plan = if cfg!(target_os = "windows") {
        build_windows_contract_command(request, action, &seed_json, redact)?
    } else {
        build_local_contract_command(request, action, &seed_json, redact)?
    };
    run_capture(command_plan)
}

fn parse_contract_preflight_checks(payload: &str) -> Result<Vec<CheckResult>, String> {
    let payload: ContractPreflightPayload = serde_json::from_str(payload)
        .map_err(|err| format!("Could not parse installer preflight JSON: {err}"))?;
    Ok(payload
        .preflight
        .checks
        .into_iter()
        .map(CheckResult::from_contract)
        .collect())
}

fn parse_contract_validation_check(payload: &str) -> Result<CheckResult, String> {
    let payload: serde_json::Value = serde_json::from_str(payload)
        .map_err(|err| format!("Could not parse installer validation JSON: {err}"))?;
    if payload
        .get("ok")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false)
    {
        return Ok(CheckResult::pass(
            "Installer config validation",
            "Python installer accepted the selected Community configuration",
        ));
    }
    if let Some(error) = payload.get("error").and_then(serde_json::Value::as_str) {
        return Ok(CheckResult::fail("Installer config validation", error));
    }
    Err("Installer validation response did not include an ok flag".to_string())
}

fn run_capture(mut command_plan: CommandPlan) -> Result<String, String> {
    let temp_defaults = command_plan.temp_defaults.clone();
    let output = command_plan
        .command
        .current_dir(&command_plan.cwd)
        .output()
        .map_err(|err| {
            cleanup_temp_file(temp_defaults.clone());
            format!("Could not run installer contract: {err}")
        })?;
    cleanup_temp_file(temp_defaults);

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if let Some(error) = parse_contract_error(&stdout) {
            return Err(format!("Installer contract failed: {error}"));
        }
        let detail = if stderr.is_empty() { stdout } else { stderr };
        Err(format!("Installer contract failed: {detail}"))
    }
}

fn parse_contract_error(payload: &str) -> Option<String> {
    serde_json::from_str::<serde_json::Value>(payload)
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
        })
}

fn install_summary_text(request: &InstallRequest) -> Result<String, String> {
    let payload = contract_plan_json(request, true)?;
    let payload: serde_json::Value = serde_json::from_str(&payload)
        .map_err(|err| format!("Could not parse installer plan JSON: {err}"))?;
    Ok(format_install_summary(&payload))
}

fn format_install_summary(payload: &serde_json::Value) -> String {
    let config = &payload["config"];
    let plan = &payload["plan"];
    let edition = value_text(config, "edition", "Community Edition");
    let admin = value_text(config, "admin_email", "admin@example.com");
    let app_url = value_text(config, "app_url", "http://localhost");
    let datasets = string_array(&plan["datasets"]);
    let data_setup = &plan["data_setup"];
    let data_target = value_text(data_setup, "target", "Local PostgreSQL");
    let data_mode = value_text(data_setup, "mode", "Create local PostgreSQL OMOP database");
    let data_dbms = value_text(data_setup, "dbms", "PostgreSQL");
    let vocabulary = value_text(data_setup, "vocabulary_setup", "Use demo starter data");
    let services = string_array(&plan["compose_services"])
        .into_iter()
        .map(|service| friendly_service_name(&service).to_string())
        .collect::<Vec<_>>();

    let starter_data = if datasets.is_empty() {
        "No starter data".to_string()
    } else {
        datasets.join(", ")
    };
    let service_summary = if services.is_empty() {
        "Core Parthenon services".to_string()
    } else {
        services.join(", ")
    };

    [
        "Installer plan".to_string(),
        format!("Edition: {edition}"),
        format!("Admin: {admin}"),
        format!("URL: {app_url}"),
        format!("OMOP target: {data_target} ({data_dbms})"),
        format!("Data setup: {data_mode}"),
        format!("Vocabulary: {vocabulary}"),
        format!("Starter data: {starter_data}"),
        format!("Services: {service_summary}"),
        "Passwords and internal defaults are handled by the installer.".to_string(),
    ]
    .join("\n")
}

fn value_text(payload: &serde_json::Value, key: &str, default: &str) -> String {
    payload
        .get(key)
        .and_then(serde_json::Value::as_str)
        .unwrap_or(default)
        .to_string()
}

fn string_array(value: &serde_json::Value) -> Vec<String> {
    value
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn friendly_service_name(service: &str) -> &str {
    match service {
        "nginx" => "Parthenon web app",
        "php" => "Application runtime",
        "postgres" => "PostgreSQL",
        "redis" => "Redis",
        "solr" => "Solr search",
        "hecate" => "Hecate concept search",
        "qdrant" => "Qdrant vector store",
        "node" => "Frontend assets",
        "study-agent" => "Study Agent",
        "blackrabbit" => "BlackRabbit profiler",
        "fhir-to-cdm" => "FHIR-to-CDM",
        "orthanc" => "Orthanc imaging",
        other => other,
    }
}

fn build_local_contract_command(
    request: &InstallRequest,
    action: &str,
    seed_json: &str,
    redact: bool,
) -> Result<CommandPlan, String> {
    validate_contract_action(action)?;
    let repo_path = PathBuf::from(request.repo_path.trim());
    validate_repo_path(&repo_path)?;
    let python =
        resolve_python().ok_or_else(|| "python3 or python was not found on PATH".to_string())?;
    let input_path = write_defaults_file(seed_json)?;

    let mut command = Command::new(python);
    command.args([
        "install.py",
        "--contract",
        action,
        "--community",
        "--contract-input",
    ]);
    command.arg(&input_path);
    if action == "preflight" {
        command.arg("--contract-repo-root");
        command.arg(&repo_path);
    }
    if redact {
        command.arg("--contract-redact");
    }
    command.arg("--contract-pretty");

    Ok(CommandPlan {
        command,
        display_location: repo_path.display().to_string(),
        cwd: repo_path,
        temp_defaults: Some(input_path),
    })
}

fn build_windows_contract_command(
    request: &InstallRequest,
    action: &str,
    seed_json: &str,
    redact: bool,
) -> Result<CommandPlan, String> {
    validate_contract_action(action)?;
    let repo_linux = request
        .wsl_repo_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            "Windows installs require a WSL repo path, such as /home/user/Parthenon".to_string()
        })?;
    let redact_flag = if redact { " --contract-redact" } else { "" };
    let repo_root_flag = if action == "preflight" {
        format!(" --contract-repo-root {}", shell_quote(repo_linux))
    } else {
        String::new()
    };

    let script = format!(
        r#"set -e
contract_input=$(mktemp)
cat > "$contract_input" <<'PARTHENON_CONTRACT_INPUT'
{seed_json}
PARTHENON_CONTRACT_INPUT
cd {repo}
set +e
python3 install.py --contract {action} --community --contract-input "$contract_input"{repo_root_flag}{redact_flag} --contract-pretty
rc=$?
rm -f "$contract_input"
exit "$rc"
"#,
        repo = shell_quote(repo_linux),
    );

    let mut command = Command::new("wsl.exe");
    if let Some(distro) = request
        .wsl_distro
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        command.args(["-d", distro]);
    }
    command.args(["bash", "-lc", &script]);

    Ok(CommandPlan {
        command,
        cwd: env::current_dir().map_err(|err| err.to_string())?,
        temp_defaults: None,
        display_location: format!("WSL:{repo_linux}"),
    })
}

fn validate_contract_action(action: &str) -> Result<(), String> {
    match action {
        "defaults" | "validate" | "plan" | "preflight" => Ok(()),
        _ => Err(format!("Unsupported installer contract action: {action}")),
    }
}

fn build_seed(request: &InstallRequest) -> serde_json::Value {
    let datasets = if request.include_eunomia {
        serde_json::json!(["eunomia", "phenotype-library"])
    } else {
        serde_json::json!([])
    };
    serde_json::json!({
        "app_url": normalized_or(&request.app_url, "http://localhost"),
        "admin_email": normalized_or(&request.admin_email, "admin@example.com"),
        "admin_name": normalized_or(&request.admin_name, "Admin"),
        "admin_password": request.admin_password.trim(),
        "timezone": normalized_or(&request.timezone, "UTC"),
        "cdm_setup_mode": normalized_or(
            &request.cdm_setup_mode,
            "Create local PostgreSQL OMOP database",
        ),
        "cdm_existing_state": normalized_or(
            &request.cdm_existing_state,
            "Empty database or schema",
        ),
        "cdm_dialect": normalized_or(&request.cdm_dialect, "PostgreSQL"),
        "cdm_server": request.cdm_server.trim(),
        "cdm_database": request.cdm_database.trim(),
        "cdm_user": request.cdm_user.trim(),
        "cdm_password": request.cdm_password.trim(),
        "cdm_schema": normalized_or(&request.cdm_schema, "omop"),
        "vocabulary_schema": normalized_or(&request.vocabulary_schema, "omop"),
        "results_schema": normalized_or(&request.results_schema, "results"),
        "temp_schema": normalized_or(&request.temp_schema, "scratch"),
        "vocabulary_setup": normalized_or(&request.vocabulary_setup, "Use demo starter data"),
        "vocab_zip_path": request.vocab_zip_path.trim(),
        "include_eunomia": request.include_eunomia,
        "datasets": datasets,
        "ollama_url": request.ollama_url.trim(),
        "enable_solr": request.enable_solr,
        "enable_study_agent": request.enable_study_agent,
        "enable_blackrabbit": request.enable_blackrabbit,
        "enable_fhir_to_cdm": request.enable_fhir_to_cdm,
        "enable_hecate": request.enable_hecate,
        "enable_qdrant": request.enable_hecate,
        "enable_orthanc": request.enable_orthanc
    })
}

fn normalized_or<'a>(value: &'a str, default: &'a str) -> &'a str {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        default
    } else {
        trimmed
    }
}

fn validate_repo_path(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("Repo path does not exist: {}", path.display()));
    }
    if !path.join("install.py").exists() {
        return Err(format!(
            "install.py not found under repo path: {}",
            path.display()
        ));
    }
    Ok(())
}

fn write_defaults_file(defaults_json: &str) -> Result<PathBuf, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| format!("System clock error while writing defaults file: {err}"))?
        .as_nanos();

    for attempt in 0..100 {
        let mut path = env::temp_dir();
        path.push(format!(
            "parthenon-installer-{}-{timestamp}-{attempt}-defaults.json",
            std::process::id()
        ));

        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
        {
            Ok(mut file) => {
                file.write_all(defaults_json.as_bytes())
                    .map_err(|err| format!("Could not write defaults file: {err}"))?;
                return Ok(path);
            }
            Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(err) => return Err(format!("Could not write defaults file: {err}")),
        }
    }

    Err("Could not allocate a unique defaults file path".to_string())
}

fn cleanup_temp_file(path: Option<PathBuf>) {
    if let Some(path) = path {
        let _ = fs::remove_file(path);
    }
}

fn find_repo_root() -> Option<PathBuf> {
    if let Ok(env_path) = env::var("PARTHENON_REPO_PATH") {
        let candidate = PathBuf::from(env_path);
        if candidate.join("install.py").exists() {
            return Some(candidate);
        }
    }

    let manifest_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    if manifest_root.join("install.py").exists() {
        return manifest_root.canonicalize().ok().or(Some(manifest_root));
    }

    env::current_dir().ok().and_then(search_ancestors_for_repo)
}

fn search_ancestors_for_repo(start: PathBuf) -> Option<PathBuf> {
    for ancestor in start.ancestors() {
        if ancestor.join("install.py").exists() {
            return Some(ancestor.to_path_buf());
        }
    }
    None
}

fn resolve_python() -> Option<String> {
    if command_available("python3") {
        Some("python3".to_string())
    } else if command_available("python") {
        Some("python".to_string())
    } else {
        None
    }
}

fn command_available(program: &str) -> bool {
    Command::new(program)
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn command_check(name: &str, program: &str, args: &[&str]) -> CheckResult {
    match Command::new(program).args(args).output() {
        Ok(output) if output.status.success() => {
            let mut detail = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if detail.is_empty() {
                detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
            }
            CheckResult::pass(name, detail)
        }
        Ok(output) => CheckResult::fail(
            name,
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ),
        Err(err) => CheckResult::fail(name, err.to_string()),
    }
}

fn wsl_check(name: &str, distro: &str, script: &str, success_message: &str) -> CheckResult {
    let mut command = Command::new("wsl.exe");
    if !distro.trim().is_empty() {
        command.args(["-d", distro.trim()]);
    }
    match command.args(["bash", "-lc", script]).output() {
        Ok(output) if output.status.success() => CheckResult::pass(name, success_message),
        Ok(output) => CheckResult::fail(
            name,
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ),
        Err(err) => CheckResult::fail(name, err.to_string()),
    }
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

impl CheckResult {
    fn from_contract(check: ContractCheck) -> Self {
        let status = match check.status.as_str() {
            "ok" | "pass" => "pass",
            "warn" => "warn",
            "fail" => "fail",
            other => other,
        };
        Self {
            name: check.name,
            status: status.to_string(),
            detail: check.detail,
        }
    }

    fn pass(name: impl Into<String>, detail: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            status: "pass".to_string(),
            detail: detail.into(),
        }
    }

    fn warn(name: impl Into<String>, detail: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            status: "warn".to_string(),
            detail: detail.into(),
        }
    }

    fn fail(name: impl Into<String>, detail: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            status: "fail".to_string(),
            detail: detail.into(),
        }
    }
}

fn main() {
    tauri::Builder::default()
        .manage(InstallerState::default())
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            validate_environment,
            preview_defaults,
            start_install
        ])
        .run(tauri::generate_context!())
        .expect("error while running Parthenon installer GUI");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> InstallRequest {
        InstallRequest {
            repo_path: "/tmp/Parthenon".to_string(),
            wsl_distro: None,
            wsl_repo_path: None,
            admin_email: "admin@example.com".to_string(),
            admin_name: "Admin".to_string(),
            admin_password: "secret-password".to_string(),
            app_url: "http://localhost".to_string(),
            timezone: "UTC".to_string(),
            cdm_setup_mode: "Create local PostgreSQL OMOP database".to_string(),
            cdm_existing_state: "Empty database or schema".to_string(),
            cdm_dialect: "PostgreSQL".to_string(),
            cdm_server: "".to_string(),
            cdm_database: "parthenon".to_string(),
            cdm_user: "parthenon".to_string(),
            cdm_password: "".to_string(),
            cdm_schema: "omop".to_string(),
            vocabulary_schema: "omop".to_string(),
            results_schema: "results".to_string(),
            temp_schema: "scratch".to_string(),
            vocabulary_setup: "Use demo starter data".to_string(),
            vocab_zip_path: "".to_string(),
            include_eunomia: true,
            enable_solr: true,
            enable_study_agent: false,
            enable_blackrabbit: false,
            enable_fhir_to_cdm: false,
            enable_hecate: true,
            enable_orthanc: false,
            ollama_url: "".to_string(),
            dry_run: true,
        }
    }

    #[test]
    fn seed_contains_ui_overrides_not_install_truth() {
        let seed = build_seed(&request());

        assert!(seed.get("experience").is_none());
        assert!(seed.get("edition").is_none());
        assert!(seed.get("modules").is_none());
        assert_eq!(seed["enable_blackrabbit"], false);
        assert_eq!(seed["enable_hecate"], true);
        assert_eq!(seed["enable_qdrant"], true);
        assert_eq!(
            seed["cdm_setup_mode"],
            "Create local PostgreSQL OMOP database"
        );
        assert_eq!(seed["cdm_dialect"], "PostgreSQL");
        assert_eq!(seed["vocabulary_setup"], "Use demo starter data");
        assert_eq!(
            seed["datasets"],
            serde_json::json!(["eunomia", "phenotype-library"])
        );
    }

    #[test]
    fn seed_contains_existing_database_setup_overrides() {
        let mut request = request();
        request.cdm_setup_mode = "Use an existing database server".to_string();
        request.cdm_existing_state = "OMOP tables exist but vocabulary is missing".to_string();
        request.cdm_dialect = "Snowflake".to_string();
        request.cdm_server = "acme.snowflakecomputing.com".to_string();
        request.cdm_database = "RESEARCH".to_string();
        request.cdm_user = "parthenon_loader".to_string();
        request.cdm_password = "secret".to_string();
        request.cdm_schema = "CDM".to_string();
        request.vocabulary_schema = "VOCAB".to_string();
        request.results_schema = "RESULTS".to_string();
        request.temp_schema = "SCRATCH".to_string();
        request.vocabulary_setup = "Load later".to_string();

        let seed = build_seed(&request);

        assert_eq!(seed["cdm_setup_mode"], "Use an existing database server");
        assert_eq!(
            seed["cdm_existing_state"],
            "OMOP tables exist but vocabulary is missing"
        );
        assert_eq!(seed["cdm_dialect"], "Snowflake");
        assert_eq!(seed["cdm_server"], "acme.snowflakecomputing.com");
        assert_eq!(seed["cdm_database"], "RESEARCH");
        assert_eq!(seed["cdm_user"], "parthenon_loader");
        assert_eq!(seed["cdm_password"], "secret");
        assert_eq!(seed["cdm_schema"], "CDM");
        assert_eq!(seed["vocabulary_schema"], "VOCAB");
        assert_eq!(seed["results_schema"], "RESULTS");
        assert_eq!(seed["temp_schema"], "SCRATCH");
        assert_eq!(seed["vocabulary_setup"], "Load later");
    }

    #[test]
    fn hecate_enables_qdrant() {
        let mut request = request();
        request.enable_hecate = true;
        let seed = build_seed(&request);

        assert_eq!(seed["enable_hecate"], true);
        assert_eq!(seed["enable_qdrant"], true);
    }

    #[test]
    fn community_seed_can_disable_quick_start_datasets() {
        let mut request = request();
        request.include_eunomia = false;

        let seed = build_seed(&request);

        assert_eq!(seed["include_eunomia"], false);
        assert_eq!(seed["datasets"], serde_json::json!([]));
    }

    #[test]
    fn defaults_files_use_unique_paths() {
        let first = write_defaults_file("{}").expect("first defaults file");
        let second = write_defaults_file("{}").expect("second defaults file");

        assert_ne!(first, second);
        assert!(first.exists());
        assert!(second.exists());

        cleanup_temp_file(Some(first));
        cleanup_temp_file(Some(second));
    }

    #[test]
    fn local_command_uses_repo_cwd_and_temp_defaults_file() {
        let mut request = request();
        let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .expect("repo root");
        request.repo_path = repo_root.to_string_lossy().to_string();

        let command_plan =
            build_local_command(&request, r#"{"edition":"Community Edition"}"#).expect("command");
        let args = command_plan
            .command
            .get_args()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        let defaults_path = command_plan
            .temp_defaults
            .clone()
            .expect("temp defaults path");

        assert_eq!(command_plan.cwd, repo_root);
        assert_eq!(args[0], "install.py");
        assert_eq!(args[1], "--defaults-file");
        assert_eq!(args[2], defaults_path.to_string_lossy());
        assert_eq!(args[3], "--non-interactive");
        assert!(defaults_path.exists());

        cleanup_temp_file(command_plan.temp_defaults);
    }

    #[test]
    fn local_contract_command_uses_python_contract() {
        let mut request = request();
        let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .expect("repo root");
        request.repo_path = repo_root.to_string_lossy().to_string();

        let command_plan = build_local_contract_command(
            &request,
            "defaults",
            r#"{"admin_email":"admin@example.com"}"#,
            true,
        )
        .expect("contract command");
        let args = command_plan
            .command
            .get_args()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        let input_path = command_plan
            .temp_defaults
            .clone()
            .expect("contract input path");

        assert_eq!(command_plan.cwd, repo_root);
        assert_eq!(args[0], "install.py");
        assert_eq!(args[1], "--contract");
        assert_eq!(args[2], "defaults");
        assert!(args.contains(&"--community".to_string()));
        assert!(args.contains(&"--contract-redact".to_string()));
        assert!(args.contains(&"--contract-pretty".to_string()));
        assert!(input_path.exists());

        cleanup_temp_file(command_plan.temp_defaults);
    }

    #[test]
    fn local_preflight_contract_command_passes_repo_root() {
        let mut request = request();
        let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .expect("repo root");
        request.repo_path = repo_root.to_string_lossy().to_string();

        let command_plan = build_local_contract_command(
            &request,
            "preflight",
            r#"{"admin_email":"admin@example.com"}"#,
            true,
        )
        .expect("contract command");
        let args = command_plan
            .command
            .get_args()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert_eq!(args[2], "preflight");
        assert!(args.contains(&"--contract-repo-root".to_string()));
        assert!(args.contains(&repo_root.to_string_lossy().to_string()));

        cleanup_temp_file(command_plan.temp_defaults);
    }

    #[test]
    fn contract_preflight_json_maps_python_ok_status() {
        let checks = parse_contract_preflight_checks(
            r#"{
              "preflight": {
                "checks": [
                  {"name":"Docker daemon","status":"ok","detail":"running"},
                  {"name":"Port 8082 free","status":"fail","detail":"in use"},
                  {"name":"PHP vendor dir","status":"warn","detail":"missing"}
                ]
              }
            }"#,
        )
        .expect("preflight checks");

        assert_eq!(checks[0].status, "pass");
        assert_eq!(checks[1].status, "fail");
        assert_eq!(checks[2].status, "warn");
    }

    #[test]
    fn contract_validation_json_maps_to_ui_check() {
        let check = parse_contract_validation_check(r#"{"ok":true,"config":{}}"#)
            .expect("validation check");

        assert_eq!(check.name, "Installer config validation");
        assert_eq!(check.status, "pass");

        let failed =
            parse_contract_validation_check(r#"{"ok":false,"error":"admin_email is required"}"#)
                .expect("failed validation check");

        assert_eq!(failed.status, "fail");
        assert_eq!(failed.detail, "admin_email is required");
    }

    #[test]
    fn contract_error_parser_extracts_json_error() {
        assert_eq!(
            parse_contract_error(r#"{"ok":false,"error":"bad config"}"#),
            Some("bad config".to_string())
        );
        assert_eq!(parse_contract_error("traceback text"), None);
    }

    #[test]
    fn install_summary_formats_plan_without_json() {
        let summary = format_install_summary(&serde_json::json!({
            "config": {
                "edition": "Community Edition",
                "admin_email": "admin@example.com",
                "app_url": "http://localhost"
            },
            "plan": {
                "datasets": ["eunomia", "phenotype-library"],
                "compose_services": ["nginx", "postgres", "redis", "solr", "hecate", "qdrant"],
                "data_setup": {
                    "target": "Local PostgreSQL",
                    "mode": "Create local PostgreSQL OMOP database",
                    "dbms": "PostgreSQL",
                    "vocabulary_setup": "Use demo starter data"
                }
            }
        }));

        assert!(summary.contains("Installer plan"));
        assert!(summary.contains("Community Edition"));
        assert!(summary.contains("OMOP target: Local PostgreSQL"));
        assert!(summary.contains("Vocabulary: Use demo starter data"));
        assert!(summary.contains("Parthenon web app"));
        assert!(summary.contains("Hecate concept search"));
        assert!(!summary.contains('{'));
        assert!(!summary.contains("admin_password"));
    }

    #[test]
    #[ignore = "smoke test: invokes the Python installer contract in the repo checkout"]
    fn python_contract_defaults_smoke_for_real_repo() {
        let mut request = request();
        let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .expect("repo root");
        request.repo_path = repo_root.to_string_lossy().to_string();

        let payload = contract_defaults_json(&request, true).expect("contract defaults JSON");
        let parsed: serde_json::Value =
            serde_json::from_str(&payload).expect("contract defaults parse");

        assert_eq!(parsed["edition"], "Community Edition");
        assert_eq!(parsed["experience"], "Beginner");
        assert_eq!(parsed["admin_password"], "[redacted]");
        assert_eq!(parsed["enable_blackrabbit"], false);
        assert_eq!(parsed["enable_hecate"], true);
    }

    #[test]
    #[ignore = "smoke test: invokes the Python installer validation and preflight contracts"]
    fn python_contract_preflight_smoke_for_real_repo() {
        let mut request = request();
        let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .expect("repo root");
        request.repo_path = repo_root.to_string_lossy().to_string();

        let checks = validate_environment(request);

        assert!(checks.iter().any(|check| {
            check.name == "Installer config validation" && check.status == "pass"
        }));
        assert!(checks.iter().any(|check| check.name == "Python ≥ 3.9"));
    }

    #[test]
    fn windows_wsl_command_quotes_repo_path() {
        let mut request = request();
        request.wsl_distro = Some("Ubuntu-24.04".to_string());
        request.wsl_repo_path = Some("/home/alice's/Parthenon".to_string());

        let command_plan =
            build_windows_wsl_command(&request, r#"{"edition":"Community Edition"}"#)
                .expect("wsl command");
        let args = command_plan
            .command
            .get_args()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert_eq!(command_plan.command.get_program(), "wsl.exe");
        assert_eq!(args[0], "-d");
        assert_eq!(args[1], "Ubuntu-24.04");
        assert_eq!(args[2], "bash");
        assert_eq!(args[3], "-lc");
        assert!(args[4].contains("cd '/home/alice'\\''s/Parthenon'"));
        assert!(args[4].contains("python3 install.py --defaults-file"));
    }

    #[test]
    fn windows_contract_command_quotes_repo_path() {
        let mut request = request();
        request.wsl_distro = Some("Ubuntu-24.04".to_string());
        request.wsl_repo_path = Some("/home/alice's/Parthenon".to_string());

        let command_plan = build_windows_contract_command(
            &request,
            "preflight",
            r#"{"admin_email":"admin@example.com"}"#,
            true,
        )
        .expect("wsl contract command");
        let args = command_plan
            .command
            .get_args()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert_eq!(command_plan.command.get_program(), "wsl.exe");
        assert_eq!(args[0], "-d");
        assert_eq!(args[1], "Ubuntu-24.04");
        assert_eq!(args[2], "bash");
        assert_eq!(args[3], "-lc");
        assert!(args[4].contains("cd '/home/alice'\\''s/Parthenon'"));
        assert!(args[4].contains("python3 install.py --contract preflight --community"));
        assert!(args[4].contains("--contract-repo-root '/home/alice'\\''s/Parthenon'"));
        assert!(args[4].contains("--contract-redact"));
    }

    #[test]
    fn shell_quote_handles_single_quotes() {
        assert_eq!(
            shell_quote("/home/alice/Parthenon"),
            "'/home/alice/Parthenon'"
        );
        assert_eq!(
            shell_quote("/home/alice's/Parthenon"),
            "'/home/alice'\\''s/Parthenon'"
        );
    }
}
