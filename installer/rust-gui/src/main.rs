use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    env, fs,
    fs::File,
    io::{self, BufRead, BufReader, Read, Write},
    path::{Component, Path, PathBuf},
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
    bundle_url: String,
    bundle_install_dir: String,
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
struct ContractDataCheckPayload {
    data_check: ContractPreflight,
}

#[derive(Debug, Deserialize)]
struct ContractBundleManifestPayload {
    manifest: ContractBundleManifest,
}

#[derive(Debug, Deserialize)]
struct ContractBundleManifest {
    bundle_name: String,
    bundle_version: String,
    file_count: usize,
    total_size: u64,
    bundle_digest: String,
    validation: Option<ContractManifestValidation>,
}

#[derive(Debug, Deserialize)]
struct ContractManifestValidation {
    failures: usize,
}

#[derive(Debug, Deserialize)]
struct InstallerBundleManifest {
    bundle_name: String,
    bundle_version: String,
    bundle_digest: String,
    files: Vec<InstallerBundleFile>,
}

#[derive(Debug, Deserialize)]
struct InstallerBundleFile {
    path: String,
    size: u64,
    sha256: String,
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

const COMMUNITY_RUNTIME_PROFILE: &str = "community-release";
const COMMUNITY_RUNTIME_COMPOSE_FILE: &str = "docker-compose.community.yml";

#[derive(Debug, Deserialize, Serialize, Clone)]
struct InstallRequest {
    source_mode: String,
    repo_path: String,
    wsl_distro: Option<String>,
    wsl_repo_path: Option<String>,
    bundle_url: String,
    bundle_archive_path: String,
    bundle_sha256: String,
    bundle_install_dir: String,
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
        bundle_url: env::var("PARTHENON_INSTALLER_BUNDLE_URL").unwrap_or_default(),
        bundle_install_dir: env::var("PARTHENON_INSTALLER_BUNDLE_DIR")
            .ok()
            .or_else(|| default_bundle_cache_dir().map(|path| path.to_string_lossy().to_string()))
            .unwrap_or_default(),
    }
}

#[tauri::command]
fn validate_environment(request: InstallRequest) -> Vec<CheckResult> {
    let (contract_request, source_check) = match resolve_install_source(None, &request) {
        Ok(resolved) => resolved,
        Err(err) => {
            let mut checks = fallback_environment_checks(&request);
            checks.push(CheckResult::fail("Installer source", err));
            return checks;
        }
    };

    match contract_validation_check(&contract_request) {
        Ok(validation_check) => match contract_preflight_checks(&contract_request) {
            Ok(mut checks) => {
                checks.insert(0, validation_check);
                if let Some(source_check) = source_check {
                    checks.insert(1, source_check);
                }
                match contract_bundle_manifest_check(&contract_request) {
                    Ok(bundle_check) => checks.insert(1, bundle_check),
                    Err(err) => checks.push(CheckResult::fail("Installer bundle", err)),
                }
                match contract_data_checks(&contract_request) {
                    Ok(mut data_checks) => checks.append(&mut data_checks),
                    Err(err) => checks.push(CheckResult::fail("OMOP data readiness", err)),
                }
                checks
            }
            Err(err) => {
                let mut checks = fallback_environment_checks(&contract_request);
                checks.push(validation_check);
                if let Some(source_check) = source_check {
                    checks.push(source_check);
                }
                match contract_bundle_manifest_check(&contract_request) {
                    Ok(bundle_check) => checks.push(bundle_check),
                    Err(err) => checks.push(CheckResult::fail("Installer bundle", err)),
                }
                checks.push(CheckResult::fail("Python installer preflight", err));
                checks
            }
        },
        Err(err) => {
            let mut checks = fallback_environment_checks(&contract_request);
            if let Some(source_check) = source_check {
                checks.push(source_check);
            }
            checks.push(CheckResult::fail("Python installer validation", err));
            checks
        }
    }
}

fn resolve_install_source(
    app: Option<&AppHandle>,
    request: &InstallRequest,
) -> Result<(InstallRequest, Option<CheckResult>), String> {
    if !uses_installer_bundle(request) {
        return Ok((request.clone(), None));
    }

    if cfg!(target_os = "windows") {
        let prepared = prepare_wsl_bundle(app, request)?;
        let mut resolved = request.clone();
        resolved.wsl_repo_path = Some(prepared.clone());
        return Ok((
            resolved,
            Some(CheckResult::pass(
                "Installer source",
                format!("Verified installer bundle in WSL at {prepared}"),
            )),
        ));
    }

    let prepared = prepare_local_bundle(app, request)?;
    let mut resolved = request.clone();
    resolved.repo_path = prepared.to_string_lossy().to_string();
    Ok((
        resolved,
        Some(CheckResult::pass(
            "Installer source",
            format!("Verified installer bundle at {}", prepared.display()),
        )),
    ))
}

fn uses_installer_bundle(request: &InstallRequest) -> bool {
    request.source_mode.trim() == "Use installer bundle"
}

fn apply_runtime_profile_env(command: &mut Command, request: &InstallRequest) {
    if uses_installer_bundle(request) {
        command.env("PARTHENON_RUNTIME_PROFILE", COMMUNITY_RUNTIME_PROFILE);
        command.env("PARTHENON_COMPOSE_FILE", COMMUNITY_RUNTIME_COMPOSE_FILE);
    }
}

fn runtime_profile_exports(request: &InstallRequest) -> &'static str {
    if uses_installer_bundle(request) {
        "export PARTHENON_RUNTIME_PROFILE=community-release\nexport PARTHENON_COMPOSE_FILE=docker-compose.community.yml\n"
    } else {
        ""
    }
}

fn prepare_local_bundle(
    app: Option<&AppHandle>,
    request: &InstallRequest,
) -> Result<PathBuf, String> {
    let cache_dir = local_bundle_cache_dir(request)?;
    fs::create_dir_all(&cache_dir)
        .map_err(|err| format!("Could not create installer bundle cache: {err}"))?;
    emit_optional_log(app, "stdout", "Preparing installer bundle.");

    let archive_path = if !request.bundle_archive_path.trim().is_empty() {
        if looks_like_url(request.bundle_archive_path.trim()) {
            return Err(
                "Put bundle URLs in the Bundle URL field, not Local bundle archive.".to_string(),
            );
        }
        PathBuf::from(request.bundle_archive_path.trim())
    } else {
        download_bundle_archive(app, request, &cache_dir)?
    };

    if !archive_path.is_file() {
        return Err(format!(
            "Installer bundle archive was not found: {}",
            archive_path.display()
        ));
    }
    verify_archive_checksum(&archive_path, request.bundle_sha256.trim())?;
    emit_optional_log(app, "stdout", "Extracting installer bundle.");

    let staging = unique_temp_path(&cache_dir, "extracting");
    fs::create_dir_all(&staging)
        .map_err(|err| format!("Could not create extraction directory: {err}"))?;
    if let Err(err) = extract_bundle_archive(&archive_path, &staging) {
        let _ = fs::remove_dir_all(&staging);
        return Err(err);
    }

    let manifest = read_extracted_bundle_manifest(&staging)?;
    validate_extracted_bundle(&staging, &manifest)?;
    let digest = short_digest(&manifest.bundle_digest);
    let final_dir = cache_dir.join(format!(
        "{}-{}-{}",
        manifest.bundle_name, manifest.bundle_version, digest
    ));

    if final_dir.exists() {
        let existing_manifest = read_extracted_bundle_manifest(&final_dir)?;
        validate_extracted_bundle(&final_dir, &existing_manifest)?;
        let _ = fs::remove_dir_all(&staging);
        emit_optional_log(
            app,
            "stdout",
            &format!(
                "Using verified installer bundle at {}.",
                final_dir.display()
            ),
        );
        return Ok(final_dir);
    }

    fs::rename(&staging, &final_dir)
        .map_err(|err| format!("Could not move verified installer bundle into place: {err}"))?;
    emit_optional_log(
        app,
        "stdout",
        &format!("Verified installer bundle at {}.", final_dir.display()),
    );
    Ok(final_dir)
}

fn prepare_wsl_bundle(app: Option<&AppHandle>, request: &InstallRequest) -> Result<String, String> {
    emit_optional_log(app, "stdout", "Preparing installer bundle inside WSL.");
    let script = build_wsl_bundle_prepare_script(request)?;

    let mut command = Command::new("wsl.exe");
    if let Some(distro) = request
        .wsl_distro
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        command.args(["-d", distro]);
    }
    let output = command
        .args(["bash", "-lc", &script])
        .output()
        .map_err(|err| format!("Could not prepare installer bundle inside WSL: {err}"))?;
    if !output.status.success() {
        return Err(format!(
            "WSL bundle preparation failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .lines()
        .find_map(|line| {
            line.strip_prefix("PARTHENON_BUNDLE_ROOT=")
                .map(str::to_string)
        })
        .ok_or_else(|| "WSL did not report the prepared installer bundle path".to_string())
}

fn build_wsl_bundle_prepare_script(request: &InstallRequest) -> Result<String, String> {
    let acquire_bundle = wsl_bundle_acquire_script(request)?;
    let install_dir = request
        .wsl_repo_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(shell_quote)
        .unwrap_or_else(|| "\"$HOME/parthenon-installer\"".to_string());
    let sha = request.bundle_sha256.trim();

    Ok(format!(
        r#"set -e
install_dir={install_dir}
expected_sha={expected_sha}
mkdir -p "$install_dir/downloads"
archive="$install_dir/downloads/parthenon-community-bootstrap.tar.gz"
{acquire_bundle}
if [ -n "$expected_sha" ]; then
python3 - "$archive" "$expected_sha" <<'PARTHENON_SHA'
import hashlib
import sys

archive, expected = sys.argv[1], sys.argv[2].lower()
digest = hashlib.sha256()
with open(archive, "rb") as handle:
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
        digest.update(chunk)
actual = digest.hexdigest()
if actual != expected:
    raise SystemExit(f"bundle checksum mismatch: expected {{expected}}, got {{actual}}")
PARTHENON_SHA
fi
extract_dir="$install_dir/current"
tmp_dir="$install_dir/extracting.$$"
rm -rf "$tmp_dir"
mkdir -p "$tmp_dir"
tar -xzf "$archive" -C "$tmp_dir"
(cd "$tmp_dir" && python3 -m installer.bundle_manifest \
  --manifest "$tmp_dir/installer-bundle-manifest.json" \
  --repo-root "$tmp_dir" \
  --validate >/dev/null)
rm -rf "$extract_dir"
mv "$tmp_dir" "$extract_dir"
echo "PARTHENON_BUNDLE_ROOT=$extract_dir"
"#,
        install_dir = install_dir,
        expected_sha = shell_quote(sha),
        acquire_bundle = acquire_bundle,
    ))
}

fn wsl_bundle_acquire_script(request: &InstallRequest) -> Result<String, String> {
    let archive = request.bundle_archive_path.trim();
    if !archive.is_empty() {
        if looks_like_url(archive) {
            return Err(
                "Put bundle URLs in the Bundle URL field, not Local bundle archive.".to_string(),
            );
        }
        return Ok(format!(
            r#"windows_archive={archive}
local_archive="$(wslpath -a "$windows_archive" 2>/dev/null || printf '%s' "$windows_archive")"
cp "$local_archive" "$archive"
"#,
            archive = shell_quote(archive),
        ));
    }

    let bundle_url = request.bundle_url.trim();
    if bundle_url.is_empty() {
        return Err(
            "Provide either a bundle URL or a local bundle archive path for WSL.".to_string(),
        );
    }
    Ok(format!(
        r#"bundle_url={bundle_url}
python3 - "$bundle_url" "$archive" <<'PARTHENON_DOWNLOAD'
import sys
import urllib.request

url, dest = sys.argv[1], sys.argv[2]
urllib.request.urlretrieve(url, dest)
PARTHENON_DOWNLOAD
"#,
        bundle_url = shell_quote(bundle_url),
    ))
}

fn local_bundle_cache_dir(request: &InstallRequest) -> Result<PathBuf, String> {
    if !request.bundle_install_dir.trim().is_empty() {
        return Ok(PathBuf::from(request.bundle_install_dir.trim()));
    }
    default_bundle_cache_dir()
        .ok_or_else(|| "Could not determine an installer bundle cache directory".to_string())
}

fn default_bundle_cache_dir() -> Option<PathBuf> {
    env::var("PARTHENON_INSTALLER_BUNDLE_DIR")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            let mut path = env::temp_dir();
            path.push("parthenon-installer");
            path.push("bundles");
            Some(path)
        })
}

fn download_bundle_archive(
    app: Option<&AppHandle>,
    request: &InstallRequest,
    cache_dir: &Path,
) -> Result<PathBuf, String> {
    let url = request.bundle_url.trim();
    if url.is_empty() {
        return Err("Provide either a bundle URL or a local bundle archive path.".to_string());
    }
    if !looks_like_url(url) {
        return Err("Bundle URL must start with http:// or https://.".to_string());
    }

    let archive_path = cache_dir.join("parthenon-community-bootstrap.tar.gz");
    emit_optional_log(
        app,
        "stdout",
        &format!("Downloading installer bundle from {url}."),
    );
    let response = ureq::get(url)
        .call()
        .map_err(|err| format!("Could not download installer bundle: {err}"))?;
    let mut reader = response.into_reader();
    let mut file = File::create(&archive_path)
        .map_err(|err| format!("Could not create installer bundle archive: {err}"))?;
    io::copy(&mut reader, &mut file)
        .map_err(|err| format!("Could not save installer bundle archive: {err}"))?;
    Ok(archive_path)
}

fn verify_archive_checksum(path: &Path, expected: &str) -> Result<(), String> {
    if expected.is_empty() {
        return Ok(());
    }
    let actual = sha256_file(path)?;
    if actual.eq_ignore_ascii_case(expected) {
        Ok(())
    } else {
        Err(format!(
            "Installer bundle checksum mismatch: expected {expected}, got {actual}"
        ))
    }
}

fn extract_bundle_archive(archive_path: &Path, destination: &Path) -> Result<(), String> {
    let file = File::open(archive_path)
        .map_err(|err| format!("Could not open installer bundle archive: {err}"))?;
    let decoder = GzDecoder::new(file);
    let mut archive = tar::Archive::new(decoder);
    for entry in archive
        .entries()
        .map_err(|err| format!("Could not read installer bundle archive: {err}"))?
    {
        let mut entry =
            entry.map_err(|err| format!("Could not read installer bundle entry: {err}"))?;
        let relative_path = entry
            .path()
            .map_err(|err| format!("Could not read installer bundle entry path: {err}"))?
            .to_path_buf();
        let target = safe_bundle_path(destination, &relative_path)?;
        let kind = entry.header().entry_type();
        if kind.is_dir() {
            fs::create_dir_all(&target)
                .map_err(|err| format!("Could not create bundle directory: {err}"))?;
        } else if kind.is_file() {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)
                    .map_err(|err| format!("Could not create bundle directory: {err}"))?;
            }
            entry
                .unpack(&target)
                .map_err(|err| format!("Could not extract installer bundle file: {err}"))?;
        } else {
            return Err(format!(
                "Installer bundle contains an unsupported entry: {}",
                relative_path.display()
            ));
        }
    }
    Ok(())
}

fn read_extracted_bundle_manifest(root: &Path) -> Result<InstallerBundleManifest, String> {
    let manifest_path = root.join("installer-bundle-manifest.json");
    let payload = fs::read_to_string(&manifest_path)
        .map_err(|err| format!("Could not read installer bundle manifest: {err}"))?;
    serde_json::from_str(&payload)
        .map_err(|err| format!("Could not parse installer bundle manifest: {err}"))
}

fn validate_extracted_bundle(
    root: &Path,
    manifest: &InstallerBundleManifest,
) -> Result<(), String> {
    for file in &manifest.files {
        let path = safe_bundle_path(root, Path::new(&file.path))?;
        if !path.is_file() {
            return Err(format!("Installer bundle is missing {}", file.path));
        }
        let actual_size = path
            .metadata()
            .map_err(|err| format!("Could not inspect bundle file {}: {err}", file.path))?
            .len();
        if actual_size != file.size {
            return Err(format!(
                "Installer bundle file size mismatch for {}: expected {}, got {}",
                file.path, file.size, actual_size
            ));
        }
        let actual_sha = sha256_file(&path)?;
        if !actual_sha.eq_ignore_ascii_case(&file.sha256) {
            return Err(format!(
                "Installer bundle checksum mismatch for {}",
                file.path
            ));
        }
    }
    if !root.join("install.py").is_file() {
        return Err("Verified bundle does not contain install.py".to_string());
    }
    Ok(())
}

fn safe_bundle_path(root: &Path, relative_path: &Path) -> Result<PathBuf, String> {
    let mut clean = PathBuf::new();
    for component in relative_path.components() {
        match component {
            Component::Normal(value) => clean.push(value),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(format!(
                    "Installer bundle contains an unsafe path: {}",
                    relative_path.display()
                ));
            }
        }
    }
    if clean.as_os_str().is_empty() {
        return Err("Installer bundle contains an empty path".to_string());
    }
    Ok(root.join(clean))
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path)
        .map_err(|err| format!("Could not open {} for checksum: {err}", path.display()))?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 1024 * 64];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|err| format!("Could not read {} for checksum: {err}", path.display()))?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(hex_digest(&digest.finalize()))
}

fn hex_digest(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0x0f) as usize] as char);
    }
    out
}

fn unique_temp_path(parent: &Path, label: &str) -> PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    parent.join(format!("{label}-{}-{timestamp}", std::process::id()))
}

fn short_digest(value: &str) -> String {
    value.chars().take(12).collect()
}

fn looks_like_url(value: &str) -> bool {
    value.starts_with("https://") || value.starts_with("http://")
}

fn emit_optional_log(app: Option<&AppHandle>, stream: &str, message: &str) {
    if let Some(app) = app {
        emit_log(app, stream, message);
    }
}

fn fallback_environment_checks(request: &InstallRequest) -> Vec<CheckResult> {
    let mut checks = Vec::new();

    if cfg!(target_os = "windows") {
        if uses_installer_bundle(request) {
            if request.bundle_url.trim().is_empty() {
                checks.push(CheckResult::fail(
                    "Installer bundle",
                    "Provide a bundle URL that WSL can download",
                ));
            }
        } else if request.repo_path.trim().is_empty()
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
        if uses_installer_bundle(request) {
            checks.push(bundle_source_field_check(request));
        } else {
            checks.push(local_repo_check(request.repo_path.trim()));
        }
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

fn bundle_source_field_check(request: &InstallRequest) -> CheckResult {
    if request.bundle_archive_path.trim().is_empty() && request.bundle_url.trim().is_empty() {
        CheckResult::fail(
            "Installer bundle",
            "Provide a bundle URL or local bundle archive path",
        )
    } else {
        CheckResult::pass("Installer bundle", "Installer bundle source is configured")
    }
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
    let (resolved_request, _) = resolve_install_source(None, &request)?;
    install_summary_text(&resolved_request)
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
    let (resolved_request, _) = resolve_install_source(Some(&app), &request)?;

    if request.dry_run {
        emit_log(
            &app,
            "stdout",
            "Test run selected. No files were changed and no Docker services were started.",
        );
        let summary = install_summary_text(&resolved_request)?;
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

    let defaults_json = contract_defaults_json(&resolved_request, false)?;
    let mut command_plan = if cfg!(target_os = "windows") {
        build_windows_wsl_command(&resolved_request, &defaults_json)?
    } else {
        build_local_command(&resolved_request, &defaults_json)?
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
    apply_runtime_profile_env(&mut command, request);

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

    let runtime_exports = runtime_profile_exports(request);
    let script = format!(
        r#"set -e
defaults_file=$(mktemp)
cat > "$defaults_file" <<'PARTHENON_DEFAULTS'
{defaults_json}
PARTHENON_DEFAULTS
cd {repo}
{runtime_exports}
set +e
python3 install.py --defaults-file "$defaults_file" --non-interactive
rc=$?
rm -f "$defaults_file"
exit "$rc"
"#,
        repo = shell_quote(repo_linux),
        runtime_exports = runtime_exports,
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

fn contract_data_checks(request: &InstallRequest) -> Result<Vec<CheckResult>, String> {
    let payload = contract_payload_json(request, "data-check", true)?;
    parse_contract_data_checks(&payload)
}

fn contract_bundle_manifest_check(request: &InstallRequest) -> Result<CheckResult, String> {
    let payload = contract_payload_json(request, "bundle-manifest", true)?;
    parse_contract_bundle_manifest_check(&payload)
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

fn parse_contract_data_checks(payload: &str) -> Result<Vec<CheckResult>, String> {
    let payload: ContractDataCheckPayload = serde_json::from_str(payload)
        .map_err(|err| format!("Could not parse installer data readiness JSON: {err}"))?;
    Ok(payload
        .data_check
        .checks
        .into_iter()
        .map(CheckResult::from_contract)
        .collect())
}

fn parse_contract_bundle_manifest_check(payload: &str) -> Result<CheckResult, String> {
    let payload: ContractBundleManifestPayload = serde_json::from_str(payload)
        .map_err(|err| format!("Could not parse installer bundle manifest JSON: {err}"))?;
    let manifest = payload.manifest;
    let digest = manifest.bundle_digest.chars().take(12).collect::<String>();
    let detail = format!(
        "{} {} includes {} files ({}) with bundle digest {}",
        manifest.bundle_name,
        manifest.bundle_version,
        manifest.file_count,
        format_bytes(manifest.total_size),
        digest
    );
    if manifest
        .validation
        .as_ref()
        .map(|validation| validation.failures)
        .unwrap_or(0)
        > 0
    {
        Ok(CheckResult::fail(
            "Installer bundle",
            format!("{detail}; checksum validation failed"),
        ))
    } else {
        Ok(CheckResult::pass("Installer bundle", detail))
    }
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

fn format_bytes(bytes: u64) -> String {
    const UNITS: [&str; 4] = ["B", "KB", "MB", "GB"];
    let mut value = bytes as f64;
    let mut unit = 0;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{bytes} {}", UNITS[unit])
    } else {
        format!("{value:.1} {}", UNITS[unit])
    }
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
    if action == "preflight" || action == "data-check" || action == "bundle-manifest" {
        command.arg("--contract-repo-root");
        command.arg(&repo_path);
    }
    if redact {
        command.arg("--contract-redact");
    }
    command.arg("--contract-pretty");
    apply_runtime_profile_env(&mut command, request);

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
    let repo_root_flag =
        if action == "preflight" || action == "data-check" || action == "bundle-manifest" {
            format!(" --contract-repo-root {}", shell_quote(repo_linux))
        } else {
            String::new()
        };

    let runtime_exports = runtime_profile_exports(request);
    let script = format!(
        r#"set -e
contract_input=$(mktemp)
cat > "$contract_input" <<'PARTHENON_CONTRACT_INPUT'
{seed_json}
PARTHENON_CONTRACT_INPUT
cd {repo}
{runtime_exports}
set +e
python3 install.py --contract {action} --community --contract-input "$contract_input"{repo_root_flag}{redact_flag} --contract-pretty
rc=$?
rm -f "$contract_input"
exit "$rc"
"#,
        repo = shell_quote(repo_linux),
        runtime_exports = runtime_exports,
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
        "defaults" | "validate" | "plan" | "preflight" | "data-check" | "bundle-manifest" => Ok(()),
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

    fn test_temp_dir(label: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock")
            .as_nanos();
        let path = env::temp_dir().join(format!(
            "parthenon-installer-test-{label}-{}-{timestamp}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("test temp dir");
        path
    }

    fn write_test_bundle(root: &Path) -> Result<(PathBuf, String), String> {
        let install_py = b"print('hello from bundle')\n";
        let install_sha = sha256_bytes(install_py);
        let manifest = serde_json::json!({
            "bundle_name": "parthenon-community-bootstrap",
            "bundle_version": "0.1.0-test",
            "bundle_digest": install_sha.clone(),
            "files": [
                {
                    "path": "install.py",
                    "size": install_py.len(),
                    "sha256": install_sha
                }
            ]
        });
        let manifest_bytes = serde_json::to_vec_pretty(&manifest).map_err(|err| err.to_string())?;
        let archive_path = root.join("bundle.tar.gz");
        let archive_file = File::create(&archive_path).map_err(|err| err.to_string())?;
        let encoder = flate2::write::GzEncoder::new(archive_file, flate2::Compression::default());
        let mut builder = tar::Builder::new(encoder);
        append_tar_file(&mut builder, "install.py", install_py)?;
        append_tar_file(
            &mut builder,
            "installer-bundle-manifest.json",
            &manifest_bytes,
        )?;
        builder.finish().map_err(|err| err.to_string())?;
        let encoder = builder.into_inner().map_err(|err| err.to_string())?;
        encoder.finish().map_err(|err| err.to_string())?;
        let archive_sha = sha256_file(&archive_path)?;
        Ok((archive_path, archive_sha))
    }

    fn append_tar_file<W: Write>(
        builder: &mut tar::Builder<W>,
        path: &str,
        payload: &[u8],
    ) -> Result<(), String> {
        let mut header = tar::Header::new_gnu();
        header.set_size(payload.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();
        builder
            .append_data(&mut header, path, payload)
            .map_err(|err| err.to_string())
    }

    fn sha256_bytes(payload: &[u8]) -> String {
        let mut digest = Sha256::new();
        digest.update(payload);
        hex_digest(&digest.finalize())
    }

    fn request() -> InstallRequest {
        InstallRequest {
            source_mode: "Use existing checkout".to_string(),
            repo_path: "/tmp/Parthenon".to_string(),
            wsl_distro: None,
            wsl_repo_path: None,
            bundle_url: "".to_string(),
            bundle_archive_path: "".to_string(),
            bundle_sha256: "".to_string(),
            bundle_install_dir: "".to_string(),
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

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn local_bundle_archive_resolves_to_verified_install_root() {
        let temp_root = test_temp_dir("bundle-resolve");
        let source_root = temp_root.join("source");
        let cache_root = temp_root.join("cache");
        fs::create_dir_all(&source_root).expect("source root");
        fs::create_dir_all(&cache_root).expect("cache root");
        let (archive, archive_sha) = write_test_bundle(&source_root).expect("test bundle");
        let mut request = request();
        request.source_mode = "Use installer bundle".to_string();
        request.bundle_archive_path = archive.to_string_lossy().to_string();
        request.bundle_sha256 = archive_sha;
        request.bundle_install_dir = cache_root.to_string_lossy().to_string();

        let (resolved, source_check) =
            resolve_install_source(None, &request).expect("resolved bundle");
        let resolved_root = PathBuf::from(&resolved.repo_path);

        assert!(source_check
            .expect("source check")
            .detail
            .contains("Verified"));
        assert!(resolved_root.join("install.py").is_file());
        assert!(resolved_root
            .join("installer-bundle-manifest.json")
            .is_file());

        let _ = fs::remove_dir_all(temp_root);
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn local_bundle_archive_rejects_wrong_archive_checksum() {
        let temp_root = test_temp_dir("bundle-wrong-sha");
        let source_root = temp_root.join("source");
        let cache_root = temp_root.join("cache");
        fs::create_dir_all(&source_root).expect("source root");
        let (archive, _) = write_test_bundle(&source_root).expect("test bundle");
        let mut request = request();
        request.source_mode = "Use installer bundle".to_string();
        request.bundle_archive_path = archive.to_string_lossy().to_string();
        request.bundle_sha256 = "0".repeat(64);
        request.bundle_install_dir = cache_root.to_string_lossy().to_string();

        let error = resolve_install_source(None, &request).expect_err("checksum failure");

        assert!(error.contains("checksum mismatch"));
        let _ = fs::remove_dir_all(temp_root);
    }

    #[test]
    fn bundle_paths_reject_parent_traversal() {
        let root = PathBuf::from("/tmp/parthenon-bundle");

        assert!(safe_bundle_path(&root, Path::new("../install.py")).is_err());
        assert!(safe_bundle_path(&root, Path::new("/tmp/install.py")).is_err());
        assert!(safe_bundle_path(&root, Path::new("install.py")).is_ok());
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
    fn local_bundle_command_sets_release_runtime_env() {
        let mut request = request();
        let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .expect("repo root");
        request.repo_path = repo_root.to_string_lossy().to_string();
        request.source_mode = "Use installer bundle".to_string();

        let command_plan =
            build_local_command(&request, r#"{"edition":"Community Edition"}"#).expect("command");
        let envs = command_plan
            .command
            .get_envs()
            .filter_map(|(key, value)| {
                value.map(|value| {
                    (
                        key.to_string_lossy().to_string(),
                        value.to_string_lossy().to_string(),
                    )
                })
            })
            .collect::<Vec<_>>();

        assert!(envs.contains(&(
            "PARTHENON_RUNTIME_PROFILE".to_string(),
            "community-release".to_string(),
        )));
        assert!(envs.contains(&(
            "PARTHENON_COMPOSE_FILE".to_string(),
            "docker-compose.community.yml".to_string(),
        )));

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
    fn local_data_check_contract_command_passes_repo_root() {
        let mut request = request();
        let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .expect("repo root");
        request.repo_path = repo_root.to_string_lossy().to_string();

        let command_plan = build_local_contract_command(
            &request,
            "data-check",
            r#"{"admin_email":"admin@example.com"}"#,
            true,
        )
        .expect("contract command");
        let args = command_plan
            .command
            .get_args()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert_eq!(args[2], "data-check");
        assert!(args.contains(&"--contract-repo-root".to_string()));
        assert!(args.contains(&repo_root.to_string_lossy().to_string()));

        cleanup_temp_file(command_plan.temp_defaults);
    }

    #[test]
    fn local_bundle_manifest_contract_command_passes_repo_root() {
        let mut request = request();
        let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .expect("repo root");
        request.repo_path = repo_root.to_string_lossy().to_string();

        let command_plan = build_local_contract_command(
            &request,
            "bundle-manifest",
            r#"{"admin_email":"admin@example.com"}"#,
            true,
        )
        .expect("contract command");
        let args = command_plan
            .command
            .get_args()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert_eq!(args[2], "bundle-manifest");
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
    fn contract_data_check_json_maps_python_ok_status() {
        let checks = parse_contract_data_checks(
            r#"{
              "data_check": {
                "checks": [
                  {"name":"OMOP data path","status":"ok","detail":"local"},
                  {"name":"Athena vocabulary ZIP","status":"fail","detail":"missing"},
                  {"name":"HADES connection helper","status":"warn","detail":"needed"}
                ]
              }
            }"#,
        )
        .expect("data checks");

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
    fn contract_bundle_manifest_json_maps_to_ui_check() {
        let check = parse_contract_bundle_manifest_check(
            r#"{
              "manifest": {
                "bundle_name": "parthenon-community-bootstrap",
                "bundle_version": "0.1.0",
                "file_count": 65,
                "total_size": 15360,
                "bundle_digest": "1234567890abcdef",
                "validation": {"failures": 0}
              }
            }"#,
        )
        .expect("bundle manifest check");

        assert_eq!(check.name, "Installer bundle");
        assert_eq!(check.status, "pass");
        assert!(check.detail.contains("0.1.0"));
        assert!(check.detail.contains("65 files"));
        assert!(check.detail.contains("15.0 KB"));
        assert!(check.detail.contains("1234567890ab"));

        let failed = parse_contract_bundle_manifest_check(
            r#"{
              "manifest": {
                "bundle_name": "parthenon-community-bootstrap",
                "bundle_version": "0.1.0",
                "file_count": 65,
                "total_size": 15360,
                "bundle_digest": "1234567890abcdef",
                "validation": {"failures": 1}
              }
            }"#,
        )
        .expect("failed bundle manifest check");

        assert_eq!(failed.status, "fail");
        assert!(failed.detail.contains("checksum validation failed"));
    }

    #[test]
    fn format_bytes_uses_readable_units() {
        assert_eq!(format_bytes(512), "512 B");
        assert_eq!(format_bytes(1536), "1.5 KB");
        assert_eq!(format_bytes(2 * 1024 * 1024), "2.0 MB");
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
        assert!(checks.iter().any(|check| check.name == "OMOP data path"));
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
    fn windows_bundle_command_exports_release_runtime_env() {
        let mut request = request();
        request.source_mode = "Use installer bundle".to_string();
        request.wsl_distro = Some("Ubuntu-24.04".to_string());
        request.wsl_repo_path = Some("/home/alice/Parthenon".to_string());

        let command_plan =
            build_windows_wsl_command(&request, r#"{"edition":"Community Edition"}"#)
                .expect("wsl command");
        let args = command_plan
            .command
            .get_args()
            .map(|value| value.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert!(args[4].contains("export PARTHENON_RUNTIME_PROFILE=community-release"));
        assert!(args[4].contains("export PARTHENON_COMPOSE_FILE=docker-compose.community.yml"));
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
    fn windows_data_check_contract_command_quotes_repo_path() {
        let mut request = request();
        request.wsl_distro = Some("Ubuntu-24.04".to_string());
        request.wsl_repo_path = Some("/home/alice's/Parthenon".to_string());

        let command_plan = build_windows_contract_command(
            &request,
            "data-check",
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
        assert!(args[4].contains("python3 install.py --contract data-check --community"));
        assert!(args[4].contains("--contract-repo-root '/home/alice'\\''s/Parthenon'"));
        assert!(args[4].contains("--contract-redact"));
    }

    #[test]
    fn wsl_bundle_script_can_copy_local_windows_archive() {
        let mut request = request();
        request.source_mode = "Use installer bundle".to_string();
        request.bundle_archive_path = r"C:\Users\Alice\Downloads\bundle.tar.gz".to_string();
        request.bundle_sha256 = "a".repeat(64);
        request.wsl_repo_path = Some("/home/alice/parthenon".to_string());

        let script = build_wsl_bundle_prepare_script(&request).expect("wsl script");

        assert!(script.contains("windows_archive='C:\\Users\\Alice\\Downloads\\bundle.tar.gz'"));
        assert!(script.contains("wslpath -a \"$windows_archive\""));
        assert!(script.contains("cp \"$local_archive\" \"$archive\""));
        assert!(!script.contains("urllib.request.urlretrieve"));
        assert!(script.contains("expected_sha='aaaaaaaa"));
    }

    #[test]
    fn wsl_bundle_script_can_download_url() {
        let mut request = request();
        request.source_mode = "Use installer bundle".to_string();
        request.bundle_url = "https://example.org/bundle.tar.gz".to_string();

        let script = build_wsl_bundle_prepare_script(&request).expect("wsl script");

        assert!(script.contains("bundle_url='https://example.org/bundle.tar.gz'"));
        assert!(script.contains("urllib.request.urlretrieve"));
        assert!(!script.contains("wslpath -a"));
    }

    #[test]
    fn wsl_bundle_script_requires_archive_or_url() {
        let mut request = request();
        request.source_mode = "Use installer bundle".to_string();

        let error = build_wsl_bundle_prepare_script(&request).expect_err("missing bundle source");

        assert!(error.contains("bundle URL or a local bundle archive"));
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
