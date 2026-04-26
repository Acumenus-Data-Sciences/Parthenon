# Installer v0.3.0 Design Contract

**Status:** Accepted (2026-04-26)
**Supersedes:** none — first formal contract for v0.3.0
**Promise:** Parthenon installer with **zero shell prerequisites**. Non-technical user double-clicks the .deb / .dmg / .msi, clicks through a wizard, logs in to Parthenon. No Terminal, no copy-paste of `sudo` commands.

## Versioning frame

- **v0.2.0 (final, this week):** "Parthenon installer — Docker prereq required." User must have Docker installed before running the installer; installer assumes it. Fixes the 4 P0s found during Linux Phase A.
- **v0.3.0:** "Parthenon installer — zero prereqs." Installer detects + installs Docker, manages WSL2 prereqs on Windows, handles reverse-proxy + ACME for server installs. Server-mode introduced here.

## The 5 design decisions

### 1. Linux Docker package

- **Debian/Ubuntu:** `apt install -y docker.io docker-compose-v2` (one pkexec call, distro-signed, no third-party trust, version lag acceptable for Parthenon workloads)
- **Fedora/RHEL:** `dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin` after adding Docker, Inc. official repo (distro `docker` is deprecated → podman)
- **Detection-first:** `which docker && docker version` succeeds → use existing, never reinstall over user's working Docker
- **Podman handling:** detect → warn ("Parthenon currently requires Docker; podman compose compatibility is incomplete") → don't auto-install over it
- **Group membership:** after install, `usermod -aG docker $USER` + show **"Log out and back in (or `newgrp docker`), then relaunch"** — can't fix in current GUI session
- **Rootless docker:** detect via `DOCKER_HOST` or `~/.docker/run/docker.sock` → skip group-add step

### 2. macOS Docker runtime

- **Probe order:** `/Applications/Docker.app` → `colima status` → `/Applications/Rancher Desktop.app` — first match wins, no install
- **None present → radio (default Docker Desktop):**
  - ◉ **Docker Desktop** — recommended for most users; license is free under 250 employees / $10M revenue. We can't redistribute their .dmg, so we open the download URL + show "I've finished installing" button + re-probe.
  - ○ **Colima** — recommended for orgs that exceed Docker license thresholds. Open source (Apache 2.0). Installed via `brew install colima docker docker-compose`. If brew missing, install brew first via osascript.
  - ○ **Rancher Desktop** — open-source GUI alt. Installed via `brew install --cask rancher`.
  - ○ **I'll install Docker myself** — skip
- **Both Docker Desktop AND Colima present:** use whichever is currently running (`docker context show`)
- **Apple Silicon:** `colima start --vm-type=vz --mount-type=virtiofs` for best perf
- **macOS minimum:** 12.0 (Docker Desktop) / 11.5 (Colima) — hard error if older

### 3. Windows Docker runtime

The hard problem on Windows is the **WSL2 prereq layer** beneath the Docker runtime.

- **Pre-Docker checklist (in order, each via UAC if remediation needed):**
  1. Windows version ≥ 10 build 19041 (hard fail if older)
  2. BIOS virtualization enabled — `(Get-ComputerInfo).HyperVRequirementVirtualizationFirmwareEnabled` (cannot remediate from software; show BIOS instructions)
  3. VM Platform feature — `Enable-WindowsOptionalFeature -Online -All -FeatureName VirtualMachinePlatform` (UAC + reboot)
  4. WSL2 installed — `wsl --install` (UAC + reboot, downloads kernel + Ubuntu)
  5. WSL2 distro running — `wsl -l -v`
- **Then Docker runtime radio (default Docker Desktop):**
  - ◉ Docker Desktop — `winget install Docker.DockerDesktop` via UAC
  - ○ Rancher Desktop — `winget install RancherDesktop.RancherDesktop` via UAC
- **Reboot UX:** persist install state to `%LOCALAPPDATA%\ParthenonInstaller\state.json` so user can resume after reboot. Offer "Restart now" (UAC `shutdown /r /t 0`) + "Restart later, I'll launch installer again."
- **Corporate-managed machines (GPO blocks Enable-WindowsOptionalFeature):** detect access-denied → show IT admin email-friendly text block.
- **Existing WSL1 distros:** `wsl --set-version Ubuntu 2` to upgrade in place.

**Budget more time for Phase 6 (Windows) than Phase 5 (Linux) or Phase 7 (Mac).**

### 4. pkexec-missing failure UX (Linux)

- **Detect:** `command -v pkexec` AND `pgrep -f 'polkit.*authentication-agent\|gcr-auth-prompter'`
- **If both present:** use pkexec elevation
- **If pkexec missing OR no auth agent:** show:
  ```
  ⚠ Polkit not detected on this system

  The installer can still proceed, but each privileged step will show
  a command for you to run in a terminal yourself.

  For zero-friction install:
    sudo apt install -y policykit-1     [Copy]
  Then click [Re-check].

  [Re-check]   [Continue with manual commands]
  ```
- **Manual mode:** every Fix-this button shows shell command in code block + Copy + "I've run this" confirmation + state persistence so user doesn't lose progress.

### 5. Server-mode reverse proxy

Step 1 deployment-mode chooser:
```
◯ Just on this computer  (default — localhost only, no DNS, no certs)
◯ Make it reachable from other computers (server install)
   FQDN: ___________________  (must already have DNS A record)
   ACME email: _____________  (Let's Encrypt notifications)
   Reverse proxy:
       ◉ Caddy            (recommended — single binary, automatic HTTPS)
       ○ Apache           (use my existing Apache install)
       ○ Traefik          (Acropolis stack — enabled only if installing Acropolis)
```

**Caddy default rationale:** 3-line Caddyfile vs ~50 lines of Apache VirtualHost + mod_md/certbot config. ACME automation built-in, no certbot cron, no apache reload triggers. Resource use ~15 MB vs Apache ~80 MB.

**Caddy install path (Cloudsmith repo, all batched in one polkit prompt):**
```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
echo "deb [signed-by=...] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
# Write /etc/caddy/Caddyfile + systemctl restart caddy
```

**Caddyfile (the entire config):**
```
${fqdn} {
    reverse_proxy localhost:8082
}
```

**Apache path:** detect existing apache2, write `/etc/apache2/sites-available/parthenon.conf`, `a2ensite parthenon`, `certbot --apache -d ${fqdn}`. Don't touch user's other vhosts.

**Traefik path:** only available when "Install Acropolis stack" is checked. Add Parthenon to Traefik's dynamic config via Docker labels.

**DNS prereq (any reverse proxy):**
- `dig +short ${fqdn}` matches `curl -s ifconfig.me` → green
- Mismatch → show "Your DNS A record for ${fqdn} must point at ${public_ip}. Configure at your DNS provider, then click Re-check."
- No public IP detected (NATted machine) → show "This machine doesn't have a public IP. Server mode requires port forwarding or a public-facing host."

## Cross-platform elevation primitive (Phase 1)

```rust
pub struct ElevatedCommand {
    pub command: String,         // "/usr/bin/apt-get"
    pub args: Vec<String>,       // ["install", "-y", "docker.io"]
    pub reason: String,           // "Install Docker" — shown in auth dialog
    pub source: String,           // "Parthenon Installer" — shown in auth dialog
}

pub enum ElevationError {
    NotAvailable(String),         // pkexec missing on Linux, etc.
    UserCancelled,                // user dismissed auth dialog
    AuthFailed,                   // wrong password
    CommandFailed { exit_code: i32, stderr: String },
    PlatformError(String),
}

pub fn run_elevated(cmd: &ElevatedCommand) -> Result<Output, ElevationError>;
pub fn elevation_available() -> Result<(), ElevationError>;
```

**Linux:** spawn `pkexec` with the action. Polkit policy file (Phase 2) declares which actions our app can elevate to, so user gets one prompt per session per action class.

**macOS:** `osascript -e 'do shell script "..." with prompt "..." with administrator privileges'`. Native macOS auth dialog with Touch ID / password.

**Windows:** PowerShell `Start-Process -Verb RunAs`. Native UAC prompt. v1 of this primitive captures only exit code (UAC-elevated child can't easily inherit pipes); v2 adds output capture via temp file pattern.

## 8-phase implementation plan

| # | Deliverable | Test bar |
|---|---|---|
| 1 | Cross-platform `run_elevated()` Rust primitive + unit tests | smoke test on each platform: run `id` elevated, see uid 0 |
| 2 | Polkit policy file (Linux) — `io.acumenus.parthenon.installer.policy` | Native auth dialog shows correct action descriptions |
| 3 | Step 1 "Fix this" UI scaffolding (Linux first) | Click → dialog → preflight row turns green, no terminal |
| 4 | Docker auto-install (Linux: docker.io / docker-ce) | Fresh Ubuntu 24.04 / Fedora 40 → installer alone gets Docker working |
| 5 | Phase A re-run on fresh Linux | End-to-end: click .deb → click through wizard → log in to Parthenon |
| 6 | Windows UAC + WSL2 remediation + winget Docker Desktop install | Fresh Windows 11 → same end-to-end |
| 7 | macOS osascript + Docker Desktop / Colima install | Fresh Sequoia → same end-to-end |
| 8 | Server mode: Caddy + Let's Encrypt + UFW + DNS validation | Fresh VPS with public DNS → installer issues real cert + serves https://${fqdn} |

**Sequencing:** Linux fully working through Phase 5 → Windows through Phase 6 → Mac through Phase 7 → Server mode Phase 8. Each phase ships an rc tag for fresh-machine validation.

## Out of scope for v0.3.0

- DNS-01 ACME challenges (need API tokens for DNS provider — defer to v0.4.0)
- Self-signed cert mode for air-gapped server installs (defer)
- Authentik / SSO integration (separate Acropolis-track work)
- macOS-on-Apple-Silicon-via-Rosetta detection (defer; rare)
- ARM Linux installers (defer; need to add to CI matrix)
- Auto-update mechanism for the installer itself (uses Tauri updater already wired in)
