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
    serde_json::to_string_pretty(&redacted_defaults(&request)).map_err(|err| err.to_string())
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
    let defaults = build_defaults(&request);
    let defaults_json = serde_json::to_string_pretty(&defaults).map_err(|err| err.to_string())?;

    if request.dry_run {
        emit_log(
            &app,
            "stdout",
            "Dry run selected. Redacted defaults JSON follows; no installer process was launched.",
        );
        let redacted_json = serde_json::to_string_pretty(&redacted_defaults(&request))
            .map_err(|err| err.to_string())?;
        for line in redacted_json.lines() {
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

fn build_defaults(request: &InstallRequest) -> serde_json::Value {
    let modules = serde_json::json!([
        "research",
        "commons",
        "ai_knowledge",
        "data_pipeline",
        "infrastructure"
    ]);
    serde_json::json!({
        "experience": "Beginner",
        "edition": "Community Edition",
        "enterprise_key": "",
        "umls_api_key": "",
        "vocab_zip_path": null,
        "cdm_dialect": "PostgreSQL",
        "env": "local",
        "app_url": normalized_or(&request.app_url, "http://localhost"),
        "admin_email": normalized_or(&request.admin_email, "admin@example.com"),
        "admin_name": normalized_or(&request.admin_name, "Admin"),
        "admin_password": request.admin_password.trim(),
        "timezone": normalized_or(&request.timezone, "UTC"),
        "include_eunomia": request.include_eunomia,
        "ollama_url": request.ollama_url.trim(),
        "modules": modules,
        "enable_solr": request.enable_solr,
        "enable_study_agent": request.enable_study_agent,
        "enable_blackrabbit": request.enable_blackrabbit,
        "enable_fhir_to_cdm": request.enable_fhir_to_cdm,
        "enable_hecate": request.enable_hecate,
        "enable_qdrant": request.enable_hecate,
        "enable_orthanc": request.enable_orthanc,
        "enable_livekit": false,
        "enable_authentik": false,
        "enable_superset": false,
        "enable_datahub": false,
        "enable_wazuh": false,
        "enable_n8n": false,
        "enable_portainer": false,
        "enable_pgadmin": false,
        "enable_grafana": false
    })
}

fn redacted_defaults(request: &InstallRequest) -> serde_json::Value {
    let mut defaults = build_defaults(request);
    if let Some(values) = defaults.as_object_mut() {
        redact_secret(values, "admin_password", "(auto-generated by installer)");
        redact_secret(values, "abby_analyst_password", "");
        redact_secret(values, "db_password", "");
        redact_secret(values, "enterprise_key", "");
        redact_secret(values, "frontier_api_key", "");
        redact_secret(values, "livekit_api_secret", "");
        redact_secret(values, "orthanc_password", "");
        redact_secret(values, "umls_api_key", "");
    }
    defaults
}

fn redact_secret(
    values: &mut serde_json::Map<String, serde_json::Value>,
    key: &str,
    empty_replacement: &str,
) {
    if let Some(value) = values.get_mut(key) {
        let replacement = match value.as_str() {
            Some("") | None => empty_replacement,
            Some(_) => "[redacted]",
        };
        *value = serde_json::Value::String(replacement.to_string());
    }
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
            include_eunomia: true,
            enable_solr: true,
            enable_study_agent: true,
            enable_blackrabbit: true,
            enable_fhir_to_cdm: true,
            enable_hecate: false,
            enable_orthanc: false,
            ollama_url: "http://host.docker.internal:11434".to_string(),
            dry_run: true,
        }
    }

    #[test]
    fn defaults_are_community_only() {
        let defaults = build_defaults(&request());

        assert_eq!(defaults["experience"], "Beginner");
        assert_eq!(defaults["edition"], "Community Edition");
        assert_eq!(defaults["enterprise_key"], "");
        assert_eq!(defaults["enable_authentik"], false);
        assert_eq!(defaults["enable_superset"], false);
        assert_eq!(defaults["enable_portainer"], false);
        assert_eq!(defaults["enable_blackrabbit"], true);
    }

    #[test]
    fn hecate_enables_qdrant() {
        let mut request = request();
        request.enable_hecate = true;
        let defaults = build_defaults(&request);

        assert_eq!(defaults["enable_hecate"], true);
        assert_eq!(defaults["enable_qdrant"], true);
    }

    #[test]
    fn preview_redacts_secrets_without_mutating_install_defaults() {
        let mut request = request();
        request.admin_password = "typed-secret".to_string();

        let install_defaults = build_defaults(&request);
        let preview_defaults = redacted_defaults(&request);

        assert_eq!(install_defaults["admin_password"], "typed-secret");
        assert_eq!(preview_defaults["admin_password"], "[redacted]");

        request.admin_password.clear();
        let blank_preview = redacted_defaults(&request);
        assert_eq!(
            blank_preview["admin_password"],
            "(auto-generated by installer)"
        );
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
