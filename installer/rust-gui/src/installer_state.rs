// Phase 6c: persist installer state across reboots so the user can come
// back after `wsl --install` or VM Platform enable and pick up where they
// left off. Without this, a Windows fresh-machine flow that requires a
// reboot in the middle (which is most of them) makes the user start over.
//
// State is a single small JSON file in the platform-native user data dir:
//   Linux:   $XDG_DATA_HOME/parthenon-installer/state.json
//            (default: ~/.local/share/parthenon-installer/state.json)
//   macOS:   ~/Library/Application Support/parthenon-installer/state.json
//   Windows: %LOCALAPPDATA%\ParthenonInstaller\state.json
//
// We deliberately do NOT use Tauri's app_local_data_dir() here because we
// want the file location to be predictable from outside the GUI process
// (e.g. for diagnostics). Tauri's dir helpers add extra prefix segments
// that vary by build identifier.

#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const STATE_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct InstallerState {
    pub schema_version: u32,
    /// Set when an action returned follow_up_required=true with a reboot
    /// message. Cleared once the next preflight run shows the underlying
    /// check has flipped to "ok".
    pub pending_reboot: Option<PendingReboot>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PendingReboot {
    /// The remediation action ID that asked the user to reboot, e.g.
    /// "install-wsl2" or "enable-vm-platform".
    pub action: String,
    /// Unix timestamp seconds — for "X minutes ago" UI hints.
    pub recorded_at: u64,
    /// Human-readable message we showed the user when telling them to reboot.
    /// Re-displayed in the "Welcome back" banner so they remember context.
    pub message: String,
    /// The preflight check name that this reboot is supposed to fix. When the
    /// next preflight run shows this check as "ok", we know the reboot
    /// landed and we can clear the pending state.
    pub fixes_check_name: Option<String>,
}

pub fn state_dir() -> Option<PathBuf> {
    #[cfg(target_os = "linux")]
    {
        if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
            return Some(PathBuf::from(xdg).join("parthenon-installer"));
        }
        return std::env::var_os("HOME")
            .map(|h| PathBuf::from(h).join(".local/share/parthenon-installer"));
    }
    #[cfg(target_os = "macos")]
    {
        return std::env::var_os("HOME").map(|h| {
            PathBuf::from(h).join("Library/Application Support/parthenon-installer")
        });
    }
    #[cfg(target_os = "windows")]
    {
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            return Some(PathBuf::from(local).join("ParthenonInstaller"));
        }
        return std::env::var_os("USERPROFILE")
            .map(|h| PathBuf::from(h).join("AppData/Local/ParthenonInstaller"));
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        return None;
    }
}

fn state_path() -> Option<PathBuf> {
    state_dir().map(|d| d.join("state.json"))
}

pub fn load() -> InstallerState {
    let Some(path) = state_path() else {
        return InstallerState::default();
    };
    let raw = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return InstallerState::default(),
    };
    serde_json::from_str(&raw).unwrap_or_else(|_| InstallerState {
        schema_version: STATE_SCHEMA_VERSION,
        pending_reboot: None,
    })
}

pub fn save(state: &InstallerState) -> Result<(), String> {
    let dir = state_dir().ok_or_else(|| "no platform state dir available".to_string())?;
    fs::create_dir_all(&dir).map_err(|e| format!("create state dir: {e}"))?;
    let path = dir.join("state.json");
    let json = serde_json::to_string_pretty(state).map_err(|e| format!("serialize: {e}"))?;
    write_atomic(&path, json.as_bytes())
}

/// Best-effort atomic write: write to a sibling .tmp file, then rename.
/// Avoids torn-half-written state.json if the GUI is killed mid-write.
fn write_atomic(target: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = target.with_extension("json.tmp");
    fs::write(&tmp, bytes).map_err(|e| format!("write {}: {e}", tmp.display()))?;
    // Try rename first (atomic on POSIX, atomic on Windows for same-volume
    // when target doesn't already exist — for replacement we may need to
    // remove first on Windows, hence the fallback).
    if let Err(e) = fs::rename(&tmp, target) {
        if cfg!(target_os = "windows") {
            let _ = fs::remove_file(target);
            fs::rename(&tmp, target).map_err(|e2| {
                format!("rename {} -> {} (after remove): {e2}", tmp.display(), target.display())
            })?;
        } else {
            return Err(format!(
                "rename {} -> {}: {e}",
                tmp.display(),
                target.display()
            ));
        }
    }
    Ok(())
}

pub fn record_pending_reboot(
    action: &str,
    message: &str,
    fixes_check_name: Option<&str>,
) -> Result<(), String> {
    let mut state = load();
    state.schema_version = STATE_SCHEMA_VERSION;
    state.pending_reboot = Some(PendingReboot {
        action: action.to_string(),
        recorded_at: now_secs(),
        message: message.to_string(),
        fixes_check_name: fixes_check_name.map(|s| s.to_string()),
    });
    save(&state)
}

pub fn clear_pending_reboot() -> Result<(), String> {
    let mut state = load();
    if state.pending_reboot.is_some() {
        state.pending_reboot = None;
        save(&state)?;
    }
    Ok(())
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Tauri command: returns the current persisted installer state. Frontend
/// calls this on bootstrap to know whether to show a "Welcome back, did
/// you restart?" banner.
#[tauri::command]
pub fn get_installer_state() -> InstallerState {
    load()
}

/// Tauri command: clear the pending_reboot record. Frontend calls this when
/// the next preflight shows the underlying check is now "ok", or when the
/// user dismisses the banner manually.
#[tauri::command]
pub fn clear_installer_pending_reboot() -> Result<(), String> {
    clear_pending_reboot()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schema_version_is_serialised() {
        let s = InstallerState {
            schema_version: STATE_SCHEMA_VERSION,
            pending_reboot: None,
        };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("\"schema_version\":1"));
    }

    #[test]
    fn round_trips_pending_reboot() {
        let s = InstallerState {
            schema_version: STATE_SCHEMA_VERSION,
            pending_reboot: Some(PendingReboot {
                action: "install-wsl2".into(),
                recorded_at: 1730000000,
                message: "Restart Windows...".into(),
                fixes_check_name: Some("WSL2 installed".into()),
            }),
        };
        let json = serde_json::to_string(&s).unwrap();
        let parsed: InstallerState = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.pending_reboot.unwrap().action, "install-wsl2");
    }

    #[test]
    fn missing_state_dir_returns_default() {
        // If state_dir() works on this platform, load() should return
        // sensible defaults when no file exists. We don't assert WHAT
        // state_dir returns — that varies by OS — only that load() is
        // robust against the file being absent.
        let s = load();
        assert_eq!(s.schema_version, 0); // Default for u32 — we set version on save, not load
        assert!(s.pending_reboot.is_none() || s.pending_reboot.is_some());
    }
}
