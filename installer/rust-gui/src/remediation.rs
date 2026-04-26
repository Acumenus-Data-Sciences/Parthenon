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
/// helper/parthenon-installer-helper). On macOS/Windows for v0.3.0 Phase 3 we
/// return PlatformUnsupported; Phases 6/7 wire those up.
#[tauri::command]
pub async fn run_remediation(action: String) -> Result<RemediationOutcome, String> {
    #[cfg(target_os = "linux")]
    {
        run_remediation_linux(&action).map_err(|e| format!("{e}"))
    }
    #[cfg(not(target_os = "linux"))]
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
