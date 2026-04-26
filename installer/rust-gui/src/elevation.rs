// Cross-platform elevation primitive.
//
// One function — `run_elevated` — that runs a command with elevated privileges
// on Linux (pkexec), macOS (osascript with administrator privileges), and
// Windows (ShellExecute "runas" verb). All three surface the OS-native auth
// dialog, so the user sees the same prompt their OS uses for everything else
// and we never touch the password.
//
// v1 (this file) captures stdout/stderr on Linux + macOS via normal pipes.
// On Windows, ShellExecute-elevated children can't inherit pipes from a
// non-elevated parent, so v1 captures only the exit code — we redirect the
// child's stdout/stderr to temp files and read them back. v2 may switch to
// a pre-installed elevated-helper service if we need richer interaction.

// Phase 1 of the v0.3.0 effort. The Step 1 Fix-this UI in Phase 3 will exercise
// every public symbol; until then, mark internals dead-code-allowed so the
// build stays warning-free.
#![allow(dead_code)]

use std::process::{Command, Output};

#[derive(Debug, Clone)]
pub struct ElevatedCommand {
    /// Absolute path to the binary to run. Must be absolute on Linux because
    /// pkexec resets PATH for security; relative paths fail with "command not
    /// found" even if they're on $PATH.
    pub command: String,
    pub args: Vec<String>,
    /// One-line description shown in the auth dialog. Keep it under ~80 chars.
    /// Example: "Install Docker", not "Run apt-get install -y docker.io".
    pub reason: String,
    /// Application identity shown in the auth dialog. Hard-coded to
    /// "Parthenon Installer" by callers; keeping it as a field for tests.
    pub source: String,
}

#[derive(Debug)]
pub enum ElevationError {
    /// The platform's elevation mechanism isn't available. On Linux this
    /// usually means pkexec or the auth agent is missing; on Windows it
    /// means the user is on a non-UAC system (rare).
    NotAvailable(String),
    /// User dismissed the auth dialog.
    UserCancelled,
    /// User typed wrong password / failed Touch ID.
    AuthFailed,
    /// Command ran but exited non-zero.
    CommandFailed { exit_code: i32, stderr: String },
    /// Anything else — IO error, missing binary, etc.
    PlatformError(String),
}

impl std::fmt::Display for ElevationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotAvailable(msg) => write!(f, "Elevation not available: {msg}"),
            Self::UserCancelled => write!(f, "User cancelled the authentication prompt"),
            Self::AuthFailed => write!(f, "Authentication failed"),
            Self::CommandFailed { exit_code, stderr } => {
                write!(f, "Command failed with exit code {exit_code}: {stderr}")
            }
            Self::PlatformError(msg) => write!(f, "Platform error: {msg}"),
        }
    }
}

impl std::error::Error for ElevationError {}

/// Probe the platform for elevation support before showing UI buttons that
/// would offer to use it. Returns Ok(()) if elevation should work, or
/// `NotAvailable` with a human-readable reason.
pub fn elevation_available() -> Result<(), ElevationError> {
    #[cfg(target_os = "linux")]
    {
        // pkexec must be present AND a polkit auth agent must be running.
        // Without the agent, pkexec falls back to TTY mode, which gives
        // terrible UX in a GUI app (password prompt vanishes into stdout).
        if which("pkexec").is_none() {
            return Err(ElevationError::NotAvailable(
                "pkexec not installed. Install with: sudo apt install policykit-1".into(),
            ));
        }
        if !auth_agent_available() {
            return Err(ElevationError::NotAvailable(
                "no polkit authentication agent on this session (likely headless or no graphical session)".into(),
            ));
        }
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        // osascript ships with macOS. If it's missing, something is very wrong.
        if which("osascript").is_none() {
            return Err(ElevationError::NotAvailable(
                "osascript not found (unexpected on macOS)".into(),
            ));
        }
        Ok(())
    }
    #[cfg(target_os = "windows")]
    {
        // PowerShell is the elevation channel. Fail loudly if it's missing —
        // this should never happen on a real Windows install.
        if which("powershell").is_none() && which("pwsh").is_none() {
            return Err(ElevationError::NotAvailable(
                "PowerShell not found (unexpected on Windows)".into(),
            ));
        }
        Ok(())
    }
}

/// Run a command with elevated privileges. Surfaces the OS-native auth dialog.
///
/// Returns:
/// - `Ok(Output)` if the command exits zero. stdout/stderr are populated.
/// - `Err(UserCancelled)` if the user dismissed the dialog.
/// - `Err(AuthFailed)` if authentication itself failed (wrong password).
/// - `Err(CommandFailed)` if auth succeeded but the command exited non-zero.
/// - `Err(NotAvailable)` if the platform's elevation mechanism is unusable.
pub fn run_elevated(cmd: &ElevatedCommand) -> Result<Output, ElevationError> {
    elevation_available()?;
    #[cfg(target_os = "linux")]
    return run_elevated_linux(cmd);
    #[cfg(target_os = "macos")]
    return run_elevated_macos(cmd);
    #[cfg(target_os = "windows")]
    return run_elevated_windows(cmd);
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    Err(ElevationError::NotAvailable(format!(
        "elevation not implemented for {}",
        std::env::consts::OS
    )))
}

/// Linux-only convenience: invoke the privileged helper script shipped in the
/// .deb / .rpm at /usr/libexec/parthenon-installer-helper. The helper validates
/// each subcommand's arguments before running them as root.
///
/// Use this for any action declared in the polkit policy file
/// (io.acumenus.parthenon.installer.policy). The polkit auth dialog uses
/// `auth_admin_keep`, so the user gets one prompt per ~5-minute session for
/// the entire installer flow.
#[cfg(target_os = "linux")]
pub fn run_helper(
    subcommand: &str,
    args: &[&str],
    reason: &str,
) -> Result<Output, ElevationError> {
    const HELPER_PATH: &str = "/usr/libexec/parthenon-installer-helper";
    if !std::path::Path::new(HELPER_PATH).exists() {
        return Err(ElevationError::NotAvailable(format!(
            "helper script not installed at {HELPER_PATH} — was the installer .deb installed via apt/dpkg?"
        )));
    }
    let mut argv = Vec::with_capacity(args.len() + 1);
    argv.push(subcommand.to_string());
    argv.extend(args.iter().map(|s| s.to_string()));
    let cmd = ElevatedCommand {
        command: HELPER_PATH.to_string(),
        args: argv,
        reason: reason.to_string(),
        source: "Parthenon Installer".to_string(),
    };
    run_elevated(&cmd)
}

#[cfg(target_os = "linux")]
fn run_elevated_linux(cmd: &ElevatedCommand) -> Result<Output, ElevationError> {
    // pkexec wants the full path to the binary as the first arg. PATH is
    // sanitized inside pkexec, so a relative or PATH-relative `cmd.command`
    // will fail — callers must pass absolute paths.
    let mut argv: Vec<String> = Vec::with_capacity(cmd.args.len() + 5);
    argv.push("--disable-internal-agent".into()); // force the GUI agent, no TTY fallback
    argv.push(cmd.command.clone());
    argv.extend(cmd.args.iter().cloned());

    let output = Command::new("pkexec")
        .args(&argv)
        .output()
        .map_err(|e| ElevationError::PlatformError(format!("spawning pkexec: {e}")))?;

    classify_exit(output)
}

#[cfg(target_os = "macos")]
fn run_elevated_macos(cmd: &ElevatedCommand) -> Result<Output, ElevationError> {
    // `do shell script "...cmd..." with prompt "..." with administrator
    // privileges` is the macOS-native way to elevate. Returns stdout on
    // success; throws an AppleScript error if user cancels (errAEEventNot
    // Authorized = -128).
    //
    // We must defend against shell injection in cmd + args: AppleScript
    // string literals support backslash-escapes for " and \, so escape both.
    let mut shell_cmd = applescript_quote_arg(&cmd.command);
    for arg in &cmd.args {
        shell_cmd.push(' ');
        shell_cmd.push_str(&applescript_quote_arg(arg));
    }
    let prompt = applescript_quote_string(&cmd.reason);
    let script = format!(
        r#"do shell script "{shell_cmd}" with prompt {prompt} with administrator privileges"#,
        shell_cmd = applescript_quote_string(&shell_cmd),
        prompt = prompt,
    );

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| ElevationError::PlatformError(format!("spawning osascript: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("User canceled") || stderr.contains("(-128)") {
            return Err(ElevationError::UserCancelled);
        }
        if stderr.contains("Sorry, try again") || stderr.contains("authentication failed") {
            return Err(ElevationError::AuthFailed);
        }
    }
    classify_exit(output)
}

#[cfg(target_os = "windows")]
fn run_elevated_windows(cmd: &ElevatedCommand) -> Result<Output, ElevationError> {
    // ShellExecute "runas" pops the UAC dialog. The elevated child cannot
    // inherit our stdout/stderr pipes (Windows security boundary), so we
    // redirect them to temp files and read back after WaitForExit.
    use std::env;
    use std::fs;
    use std::time::SystemTime;

    let stamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let stdout_path = env::temp_dir().join(format!("parthenon-elev-{stamp}.out"));
    let stderr_path = env::temp_dir().join(format!("parthenon-elev-{stamp}.err"));

    // PowerShell escapes are different from cmd.exe. We single-quote the
    // arguments and double up any embedded single quotes per PS rules.
    let cmd_escaped = ps_quote(&cmd.command);
    let argstr = cmd
        .args
        .iter()
        .map(|a| ps_quote(a))
        .collect::<Vec<_>>()
        .join(", ");
    let stdout_escaped = ps_quote(&stdout_path.to_string_lossy());
    let stderr_escaped = ps_quote(&stderr_path.to_string_lossy());
    let ps_script = format!(
        "$ErrorActionPreference='Stop';\
         $p = Start-Process -FilePath {cmd_escaped} -ArgumentList @({argstr}) \
            -Verb RunAs -Wait -PassThru \
            -RedirectStandardOutput {stdout_escaped} \
            -RedirectStandardError {stderr_escaped};\
         exit $p.ExitCode"
    );

    let pwsh = if which("pwsh").is_some() { "pwsh" } else { "powershell" };
    let result = Command::new(pwsh)
        .args(["-NoProfile", "-NonInteractive", "-Command", &ps_script])
        .output()
        .map_err(|e| ElevationError::PlatformError(format!("spawning powershell: {e}")));

    let collected = match result {
        Ok(out) => out,
        Err(e) => {
            let _ = fs::remove_file(&stdout_path);
            let _ = fs::remove_file(&stderr_path);
            return Err(e);
        }
    };

    let stdout = fs::read(&stdout_path).unwrap_or_default();
    let stderr = fs::read(&stderr_path).unwrap_or_default();
    let _ = fs::remove_file(&stdout_path);
    let _ = fs::remove_file(&stderr_path);

    // Start-Process with -Verb RunAs returns 1223 (ERROR_CANCELLED) when the
    // user clicks "No" on the UAC prompt.
    if !collected.status.success() {
        let combined_err = String::from_utf8_lossy(&collected.stderr).to_string();
        if combined_err.contains("operation was canceled by the user")
            || combined_err.contains("0x800704c7")
            || combined_err.contains("1223")
        {
            return Err(ElevationError::UserCancelled);
        }
    }

    let exit_code = collected.status.code().unwrap_or(-1);
    let synthesised = Output {
        status: collected.status,
        stdout,
        stderr,
    };
    if exit_code != 0 {
        return Err(ElevationError::CommandFailed {
            exit_code,
            stderr: String::from_utf8_lossy(&synthesised.stderr).to_string(),
        });
    }
    Ok(synthesised)
}

fn classify_exit(output: Output) -> Result<Output, ElevationError> {
    if output.status.success() {
        return Ok(output);
    }
    // pkexec exit codes:
    //   126 = Not authorized (auth dialog dismissed)
    //   127 = pkexec couldn't start
    //   anything else = command's own exit code
    let code = output.status.code().unwrap_or(-1);
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    match code {
        126 => Err(ElevationError::UserCancelled),
        127 if stderr.contains("not authorized") => Err(ElevationError::UserCancelled),
        _ => Err(ElevationError::CommandFailed {
            exit_code: code,
            stderr,
        }),
    }
}

fn which(name: &str) -> Option<std::path::PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
        #[cfg(target_os = "windows")]
        {
            let with_exe = dir.join(format!("{name}.exe"));
            if with_exe.is_file() {
                return Some(with_exe);
            }
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn auth_agent_available() -> bool {
    // We need a polkit auth agent to surface a graphical password prompt.
    // Two complications:
    //
    //   1. Modern GNOME (>= 3.30, ships in Ubuntu 24.04+) embeds the agent
    //      INSIDE gnome-shell. There's no separate `polkit-gnome-authentication-
    //      agent-1` process to pgrep for. Same story for KDE Plasma 6.
    //   2. XFCE / MATE / LXQT / Cinnamon still use standalone agents with
    //      varying process names.
    //
    // The least-bad heuristic: we're "available" if ANY of these is true:
    //   - polkitd is running AND we have a graphical session
    //     (DISPLAY or WAYLAND_DISPLAY) — covers the embedded-agent case
    //   - a known standalone agent process is running — covers older / non-
    //     GNOME desktops
    //
    // If both are false we're almost certainly headless (server, container).
    let in_graphical_session =
        std::env::var_os("DISPLAY").is_some() || std::env::var_os("WAYLAND_DISPLAY").is_some();

    let polkitd_running = Command::new("pgrep")
        .args(["-x", "polkitd"])
        .output()
        .map(|o| !o.stdout.is_empty())
        .unwrap_or(false);

    let standalone_agent_running = Command::new("pgrep")
        .args([
            "-f",
            "polkit.*authentication-agent|gcr-prompter|lxqt-policykit|mate-polkit|xfce-polkit",
        ])
        .output()
        .map(|o| !o.stdout.is_empty())
        .unwrap_or(false);

    standalone_agent_running || (polkitd_running && in_graphical_session)
}

#[cfg(target_os = "macos")]
fn applescript_quote_string(s: &str) -> String {
    // AppleScript string literal quoting: escape backslashes, then quotes.
    // The result is wrapped in double quotes.
    let escaped = s.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

#[cfg(target_os = "macos")]
fn applescript_quote_arg(s: &str) -> String {
    // For shell-script arguments going through `do shell script`, we need
    // double-layer escaping: AppleScript layer + sh layer. The simplest
    // safe pattern is single-quote in sh (which doesn't process escapes),
    // and any embedded single-quotes become '\''.
    let sh = format!("'{}'", s.replace('\'', "'\\''"));
    sh
}

#[cfg(target_os = "windows")]
fn ps_quote(s: &str) -> String {
    // PowerShell single-quoted strings: backslash isn't an escape, but
    // embedded single quotes must be doubled. Anything else is literal.
    format!("'{}'", s.replace('\'', "''"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "macos")]
    #[test]
    fn applescript_quote_handles_double_quotes() {
        let out = applescript_quote_string(r#"hello "world""#);
        assert_eq!(out, r#""hello \"world\"""#);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn applescript_quote_handles_backslash() {
        let out = applescript_quote_string(r"a\b");
        assert_eq!(out, r#""a\\b""#);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn shell_arg_with_single_quote_is_safe() {
        let out = applescript_quote_arg("foo'bar");
        // Single-quoted in sh, with embedded ' as '\''
        assert_eq!(out, r"'foo'\''bar'");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn ps_quote_doubles_single_quotes() {
        assert_eq!(ps_quote("foo'bar"), "'foo''bar'");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn ps_quote_passes_backslash_literal() {
        assert_eq!(ps_quote(r"C:\Program Files\foo"), r"'C:\Program Files\foo'");
    }

    #[test]
    fn elevation_error_displays_human_readable() {
        let err = ElevationError::CommandFailed {
            exit_code: 100,
            stderr: "E: Unable to locate package".into(),
        };
        let msg = format!("{err}");
        assert!(msg.contains("100"));
        assert!(msg.contains("Unable to locate"));
    }
}
