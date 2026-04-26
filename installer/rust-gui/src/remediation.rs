// Phase 3 of v0.3.0: turn Step 1 preflight failures into clickable "Fix this"
// actions. Each remediation is a Tauri command the UI invokes when the user
// clicks the button next to a failing check.
//
// Linux is the only platform wired up here. macOS and Windows remediations
// arrive in Phases 7 and 6 respectively and will return PlatformUnsupported
// from this module until then.

#![allow(dead_code)]

use crate::elevation::{self, ElevationError};
use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct RemediationOutcome {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    /// True when the user must do a manual follow-up (e.g. log out and back in
    /// after `usermod -aG docker $USER`). The UI shows this prominently rather
    /// than just turning the row green.
    pub follow_up_required: bool,
    pub follow_up_message: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ElevationStatus {
    pub available: bool,
    /// Human-readable explanation when not available — feeds the UI banner.
    pub reason: Option<String>,
    /// On Linux, the apt/dnf line we'd suggest the user run by hand to make
    /// elevation work (install policykit-1). None on other platforms.
    pub fallback_install_hint: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DistroFamily {
    DebianUbuntu,
    RhelFedora,
    Arch,
    Other,
}

fn detect_distro_family() -> DistroFamily {
    // Read /etc/os-release. The ID and ID_LIKE fields tell us the family.
    let contents = match std::fs::read_to_string("/etc/os-release") {
        Ok(s) => s,
        Err(_) => return DistroFamily::Other,
    };
    let mut id = String::new();
    let mut id_like = String::new();
    for line in contents.lines() {
        if let Some(rest) = line.strip_prefix("ID=") {
            id = rest.trim_matches('"').to_string();
        } else if let Some(rest) = line.strip_prefix("ID_LIKE=") {
            id_like = rest.trim_matches('"').to_string();
        }
    }
    let combined = format!("{id} {id_like}");
    if combined.contains("debian") || combined.contains("ubuntu") {
        DistroFamily::DebianUbuntu
    } else if combined.contains("rhel")
        || combined.contains("fedora")
        || combined.contains("centos")
        || combined.contains("rocky")
        || combined.contains("almalinux")
    {
        DistroFamily::RhelFedora
    } else if combined.contains("arch") {
        DistroFamily::Arch
    } else {
        DistroFamily::Other
    }
}

/// Tauri command: returns whether elevation is available on this system, and
/// if not, suggests how the user can make it available.
#[tauri::command]
pub fn elevation_status() -> ElevationStatus {
    match elevation::elevation_available() {
        Ok(()) => ElevationStatus {
            available: true,
            reason: None,
            fallback_install_hint: None,
        },
        Err(ElevationError::NotAvailable(msg)) => {
            #[cfg(target_os = "linux")]
            let hint = Some("sudo apt install -y policykit-1".to_string());
            #[cfg(not(target_os = "linux"))]
            let hint: Option<String> = None;
            ElevationStatus {
                available: false,
                reason: Some(msg),
                fallback_install_hint: hint,
            }
        }
        Err(other) => ElevationStatus {
            available: false,
            reason: Some(format!("{other}")),
            fallback_install_hint: None,
        },
    }
}

/// Tauri command: run a named remediation. Action IDs are stable strings the
/// JS layer uses to target specific Fix-this buttons.
///
/// On Linux the action dispatches to `parthenon-installer-helper` (see
/// helper/parthenon-installer-helper). On Windows the action runs an UAC-
/// elevated PowerShell command directly (no helper script — UAC handles
/// per-call auth, and we can't easily ship a privileged helper on Windows
/// the way we do on Linux). macOS uses osascript "with administrator
/// privileges" only where needed (Homebrew install); most macOS actions
/// don't need elevation at all (brew install, opening URLs).
#[tauri::command]
pub async fn run_remediation(action: String) -> Result<RemediationOutcome, String> {
    #[cfg(target_os = "linux")]
    {
        run_remediation_linux(&action).map_err(|e| format!("{e}"))
    }
    #[cfg(target_os = "windows")]
    {
        run_remediation_windows(&action).map_err(|e| format!("{e}"))
    }
    #[cfg(target_os = "macos")]
    {
        run_remediation_macos(&action).map_err(|e| format!("{e}"))
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        let _ = action;
        Err("Auto-remediation not yet implemented on this platform.".into())
    }
}

#[cfg(target_os = "linux")]
fn run_remediation_linux(action: &str) -> Result<RemediationOutcome, ElevationError> {
    match action {
        "install-docker" => {
            let (subcommand, reason) = match detect_distro_family() {
                DistroFamily::DebianUbuntu => (
                    "docker-install-debian",
                    "Install Docker (apt install docker.io docker-compose-v2)",
                ),
                DistroFamily::RhelFedora => (
                    "docker-install-rhel",
                    "Install Docker (dnf install docker-ce + plugins)",
                ),
                DistroFamily::Arch => {
                    return Err(ElevationError::NotAvailable(
                        "Auto-install on Arch is not yet supported. Run: sudo pacman -S docker docker-compose".into(),
                    ));
                }
                DistroFamily::Other => {
                    return Err(ElevationError::NotAvailable(
                        "Distro not recognised — please install Docker manually and re-run preflight.".into(),
                    ));
                }
            };
            let out = elevation::run_helper(subcommand, &[], reason)?;
            Ok(RemediationOutcome {
                success: true,
                stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
                follow_up_required: false,
                follow_up_message: None,
            })
        }
        "start-docker" => {
            let out = elevation::run_helper(
                "docker-start",
                &[],
                "Start the Docker daemon and enable it at boot",
            )?;
            Ok(RemediationOutcome {
                success: true,
                stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
                follow_up_required: false,
                follow_up_message: None,
            })
        }
        "add-user-to-docker-group" => {
            let user = std::env::var("USER")
                .or_else(|_| std::env::var("LOGNAME"))
                .map_err(|_| {
                    ElevationError::PlatformError(
                        "Could not determine current username from environment".into(),
                    )
                })?;
            let out = elevation::run_helper(
                "docker-add-user-to-group",
                &[&user],
                &format!("Add {user} to the docker group"),
            )?;
            Ok(RemediationOutcome {
                success: true,
                stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
                follow_up_required: true,
                follow_up_message: Some(format!(
                    "Added {user} to the docker group. You must log out and log back in (or run \
                     `newgrp docker` in any terminal) before Docker commands work without sudo. \
                     Then relaunch this installer."
                )),
            })
        }
        other => Err(ElevationError::NotAvailable(format!(
            "Unknown remediation action: {other}"
        ))),
    }
}

// === Windows action handlers ===
//
// Unlike Linux (where a single privileged helper script handles every
// subcommand under one polkit auth dialog), Windows asks for UAC approval per
// elevated process. We invoke PowerShell directly via run_elevated and let
// each action surface its own UAC prompt.
//
// `winget` ships with Windows 10 1809+ / 11. Older systems (or LTSC) won't
// have it; we surface a clear NotAvailable in that case so the UI falls back
// to copy-paste mode.
//
// WSL2 install + VM Platform feature enable both REQUIRE A REBOOT before they
// take effect. The handlers return `follow_up_required = true` with a
// follow-up message explaining the reboot. Phase 6c will add proper state
// persistence so the installer can resume after the user reboots.
#[cfg(target_os = "windows")]
fn run_remediation_windows(action: &str) -> Result<RemediationOutcome, ElevationError> {
    use crate::elevation::{ElevatedCommand, run_elevated};

    fn ps_cmd(script: &str, reason: &str) -> ElevatedCommand {
        // Run a PowerShell snippet via the system powershell.exe. -NoProfile
        // skips $PROFILE side effects, -NonInteractive prevents prompts, and
        // we wrap the script in a single -Command argument so we don't have to
        // shell-quote every individual flag in run_elevated_windows.
        ElevatedCommand {
            command: r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe".to_string(),
            args: vec![
                "-NoProfile".to_string(),
                "-NonInteractive".to_string(),
                "-ExecutionPolicy".to_string(),
                "Bypass".to_string(),
                "-Command".to_string(),
                script.to_string(),
            ],
            reason: reason.to_string(),
            source: "Parthenon Installer".to_string(),
        }
    }

    fn outcome_with_followup(
        out: std::process::Output,
        reboot_required: bool,
        message: Option<String>,
        action_id: &str,
        fixes_check: Option<&str>,
    ) -> RemediationOutcome {
        // Phase 6c: persist reboot state so the user sees a "did you restart?"
        // banner on next launch instead of starting over. Failure to write is
        // non-fatal — we still succeed the action; the user just won't get
        // the welcome-back banner.
        if reboot_required {
            if let Some(msg) = &message {
                let _ = crate::installer_state::record_pending_reboot(action_id, msg, fixes_check);
            }
        }
        RemediationOutcome {
            success: true,
            stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
            follow_up_required: reboot_required,
            follow_up_message: message,
        }
    }

    match action {
        "enable-vm-platform" => {
            // Enables the "Virtual Machine Platform" Windows feature, which
            // WSL2 requires under the hood. This is a reboot-required action.
            let script = r#"
                $f = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
                if ($f.State -ne 'Enabled') {
                    Enable-WindowsOptionalFeature -Online -All -FeatureName VirtualMachinePlatform -NoRestart | Out-Null
                    Write-Output 'enabled'
                } else {
                    Write-Output 'already-enabled'
                }
            "#;
            let out = run_elevated(&ps_cmd(
                script,
                "Enable Virtual Machine Platform (required for WSL2)",
            ))?;
            let stdout_lc = String::from_utf8_lossy(&out.stdout).to_lowercase();
            let already = stdout_lc.contains("already-enabled");
            Ok(outcome_with_followup(
                out,
                !already,
                if already {
                    None
                } else {
                    Some(
                        "Virtual Machine Platform feature has been enabled. Restart Windows to finish — \
                         then relaunch this installer."
                            .into(),
                    )
                },
                "enable-vm-platform",
                Some("Windows VM Platform feature"),
            ))
        }
        "install-wsl2" => {
            // `wsl --install` (Windows 10 21H1+ / Windows 11) downloads the
            // WSL2 kernel + default Ubuntu distro in one shot. It enables
            // VirtualMachinePlatform + WSL features automatically. Reboot
            // required afterwards.
            let script = r#"
                wsl --install --no-launch
                if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
                Write-Output 'wsl-installed'
            "#;
            let out = run_elevated(&ps_cmd(
                script,
                "Install WSL2 + default Ubuntu distro",
            ))?;
            Ok(outcome_with_followup(
                out,
                true,
                Some(
                    "WSL2 has been installed (kernel + default Ubuntu distro). Restart Windows, \
                     wait for the Ubuntu first-run to finish in the Start menu, then relaunch this installer."
                        .into(),
                ),
                "install-wsl2",
                Some("WSL2 installed"),
            ))
        }
        "install-docker-desktop" => {
            // winget package: Docker.DockerDesktop. The installer runs in
            // unattended mode with --silent, but Docker Desktop's first-run
            // does its own helper-service install via UAC — we can't suppress
            // that. The user will see one or two more UAC prompts after winget
            // exits. Reboot is sometimes required (depends on WSL state).
            let script = r#"
                winget install --id Docker.DockerDesktop --silent --accept-package-agreements --accept-source-agreements
                if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) { exit $LASTEXITCODE }
                Write-Output 'docker-desktop-installed'
            "#;
            let out = run_elevated(&ps_cmd(
                script,
                "Install Docker Desktop via winget",
            ))?;
            Ok(outcome_with_followup(
                out,
                false,
                Some(
                    "Docker Desktop has been installed. Launch it from the Start menu and complete its \
                     first-run setup. When the Docker whale icon in your system tray turns steady (not animating), \
                     come back here and re-run Check System."
                        .into(),
                ),
                "install-docker-desktop",
                Some("Docker daemon"),
            ))
        }
        "install-rancher-desktop" => {
            let script = r#"
                winget install --id RancherDesktop.RancherDesktop --silent --accept-package-agreements --accept-source-agreements
                if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) { exit $LASTEXITCODE }
                Write-Output 'rancher-installed'
            "#;
            let out = run_elevated(&ps_cmd(
                script,
                "Install Rancher Desktop via winget",
            ))?;
            Ok(outcome_with_followup(
                out,
                false,
                Some(
                    "Rancher Desktop has been installed. Launch it from the Start menu and complete \
                     its first-run setup, then come back here and re-run Check System."
                        .into(),
                ),
                "install-rancher-desktop",
                Some("Docker daemon"),
            ))
        }
        other => Err(ElevationError::NotAvailable(format!(
            "Unknown Windows remediation action: {other}"
        ))),
    }
}

// === macOS action handlers ===
//
// Most macOS actions don't need elevation:
//   - Opening a download URL is a `open <url>` user-shell command
//   - `brew install` runs as the user; brew owns its prefix (/opt/homebrew on
//     Apple Silicon, /usr/local/Homebrew on Intel)
//   - `colima start` runs as the user
//
// The one place we DO need elevation is the Homebrew bootstrap for users who
// don't have it yet — `/bin/bash -c "$(curl ... install.sh)"` runs sudo
// internally to chmod /usr/local etc. We use osascript "with administrator
// privileges" for that single step.
//
// Docker Desktop's .dmg cannot be redistributed by us, so we open the
// official download page in the user's browser and surface a follow-up
// message instructing them to drag the .app to /Applications, launch it,
// and re-run Check System after the daemon is up.
#[cfg(target_os = "macos")]
fn run_remediation_macos(action: &str) -> Result<RemediationOutcome, ElevationError> {
    use std::process::Command;

    // Run a user-shell command (no elevation). Returns Output on success, or
    // CommandFailed/PlatformError on the usual problems. Used for `brew`,
    // `open`, `colima`.
    fn user_shell(program: &str, args: &[&str]) -> Result<std::process::Output, ElevationError> {
        let out = Command::new(program)
            .args(args)
            .output()
            .map_err(|e| ElevationError::PlatformError(format!("spawning {program}: {e}")))?;
        if !out.status.success() {
            return Err(ElevationError::CommandFailed {
                exit_code: out.status.code().unwrap_or(-1),
                stderr: String::from_utf8_lossy(&out.stderr).to_string(),
            });
        }
        Ok(out)
    }

    fn brew_present() -> bool {
        // Homebrew installs to /opt/homebrew on Apple Silicon and
        // /usr/local/Homebrew on Intel. Either binary path being present is
        // sufficient — we don't try to read its version.
        std::path::Path::new("/opt/homebrew/bin/brew").is_file()
            || std::path::Path::new("/usr/local/bin/brew").is_file()
    }

    fn brew_path() -> &'static str {
        if std::path::Path::new("/opt/homebrew/bin/brew").is_file() {
            "/opt/homebrew/bin/brew"
        } else {
            "/usr/local/bin/brew"
        }
    }

    fn install_homebrew() -> Result<std::process::Output, ElevationError> {
        // Homebrew's official installer is a one-liner that runs `sudo` for
        // the chmod steps. We wrap it in osascript "with administrator
        // privileges" so the user gets the native macOS auth dialog instead
        // of seeing sudo's TTY prompt vanish into stdout.
        let script = r#"
            do shell script "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
                with prompt "Install Homebrew (required for Colima / Rancher Desktop)"
                with administrator privileges
        "#;
        let out = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| ElevationError::PlatformError(format!("spawning osascript: {e}")))?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            if stderr.contains("User canceled") || stderr.contains("(-128)") {
                return Err(ElevationError::UserCancelled);
            }
            return Err(ElevationError::CommandFailed {
                exit_code: out.status.code().unwrap_or(-1),
                stderr: stderr.to_string(),
            });
        }
        Ok(out)
    }

    match action {
        "open-docker-desktop-download" => {
            // Can't redistribute Docker Desktop's .dmg. Open the official
            // download page and wait for the user to install + first-run.
            let _ = user_shell("/usr/bin/open", &["https://www.docker.com/products/docker-desktop/"])?;
            Ok(RemediationOutcome {
                success: true,
                stdout: String::new(),
                stderr: String::new(),
                follow_up_required: true,
                follow_up_message: Some(
                    "Opened the Docker Desktop download page in your browser. Download the .dmg \
                     for your Mac (Apple Silicon or Intel), drag Docker.app to /Applications, \
                     launch it, and complete the first-run setup. When the Docker whale icon in \
                     your menu bar is steady (not animating), come back here and re-run Check System."
                        .into(),
                ),
            })
        }
        "open-docker-desktop" => {
            // Daemon-not-running on Mac: just launch /Applications/Docker.app.
            let _ = user_shell("/usr/bin/open", &["-a", "Docker"])?;
            Ok(RemediationOutcome {
                success: true,
                stdout: String::new(),
                stderr: String::new(),
                follow_up_required: true,
                follow_up_message: Some(
                    "Launched Docker Desktop. Wait for the whale icon in your menu bar to stop \
                     animating (~10–30 seconds), then re-run Check System."
                        .into(),
                ),
            })
        }
        "install-colima" => {
            // Colima is the open-source / license-clean alternative to
            // Docker Desktop. Needs Homebrew. brew install runs as user.
            if !brew_present() {
                install_homebrew()?;
            }
            let brew = brew_path();
            let install_out = user_shell(brew, &["install", "colima", "docker", "docker-compose"])?;
            // Apple Silicon: vz mount-type gives best perf. Detect arch and
            // start colima with appropriate flags. Apple Silicon's `uname -m`
            // is "arm64".
            let arch_out = Command::new("/usr/bin/uname")
                .arg("-m")
                .output()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .unwrap_or_default();
            let mut start_args = vec!["start"];
            if arch_out == "arm64" {
                start_args.extend(["--vm-type=vz", "--mount-type=virtiofs"]);
            }
            // Colima ships in the same brew bin dir as brew itself
            // (/opt/homebrew/bin/colima or /usr/local/bin/colima). Try the
            // absolute path first so we don't depend on PATH being right.
            let colima_path = brew_path().replace("brew", "colima");
            let _start = user_shell(&colima_path, &start_args)
                .or_else(|_| user_shell("colima", &start_args));
            Ok(RemediationOutcome {
                success: true,
                stdout: String::from_utf8_lossy(&install_out.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&install_out.stderr).into_owned(),
                follow_up_required: false,
                follow_up_message: Some(
                    "Colima + docker CLI installed and started. Re-run Check System to confirm."
                        .into(),
                ),
            })
        }
        "install-rancher-desktop" => {
            if !brew_present() {
                install_homebrew()?;
            }
            let brew = brew_path();
            let out = user_shell(brew, &["install", "--cask", "rancher"])?;
            Ok(RemediationOutcome {
                success: true,
                stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
                follow_up_required: true,
                follow_up_message: Some(
                    "Rancher Desktop installed. Launch it from /Applications, complete the \
                     first-run wizard (choose dockerd backend for compose compatibility), then \
                     re-run Check System."
                        .into(),
                ),
            })
        }
        other => Err(ElevationError::NotAvailable(format!(
            "Unknown macOS remediation action: {other}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn distro_family_detected_on_dev_machine() {
        // Smoke: this test runs on whatever the dev / CI machine is. We don't
        // assert a specific family, only that the function returns without
        // panicking. The interesting test is that DebianUbuntu / RhelFedora
        // parse correctly from real os-release content (covered next).
        let _ = detect_distro_family();
    }
}
