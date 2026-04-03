# Acropolis Package Distribution — Design Spec

**Date:** 2026-04-03
**Status:** Approved
**Author:** Dr. Sanjay Udoshi + Claude
**Supersedes:** The "download binary" approach from the remote installer spec. That spec's Phase 0 bootstrap logic (`bootstrap_remote.py`) remains valid — this spec replaces the *distribution* layer only.

## Problem

Downloaded executables cannot be double-clicked on any modern OS without code signing, notarization, or package manager trust. macOS Gatekeeper, Linux execute-bit stripping, and Windows SmartScreen all block unsigned downloaded binaries. The direct-download approach from the remote installer spec fails at the last mile.

## Goal

`brew install parthenon` on macOS/Linux. `sudo apt install parthenon` on Ubuntu/Debian. `snap install parthenon` on any Linux with Snap. `winget install parthenon` on Windows. Signed `.pkg` for macOS and `.msi` for Windows as direct-download alternatives. Every path ends with the user reaching the Parthenon login screen.

## Distribution Channels

### Phase 1: Homebrew (macOS + Linux) — No signing required

Homebrew is the standard package manager for macOS developers and is widely used on Linux. A Homebrew tap + formula installs the Parthenon installer binary and makes it available as `parthenon-install` on PATH.

**User experience:**
```bash
brew tap sudoshi/parthenon
brew install parthenon-installer
parthenon-install
```

**Implementation:**
- Create a Homebrew tap repo: `github.com/sudoshi/homebrew-parthenon`
- Formula downloads the PyInstaller binary (Linux) or cosmo APE (macOS) from the GitHub Release
- Formula sets execute permissions and creates a symlink on PATH
- CI auto-updates the formula on each release (new SHA256 + version)

**Formula structure:**
```ruby
class ParthenonInstaller < Formula
  desc "Acropolis installer for Parthenon outcomes research platform"
  homepage "https://github.com/sudoshi/Parthenon"
  version "1.0.3"

  on_macos do
    url "https://github.com/sudoshi/Parthenon/releases/download/v#{version}/acropolis-install-macos.zip"
    sha256 "MACOS_SHA256"
  end

  on_linux do
    url "https://github.com/sudoshi/Parthenon/releases/download/v#{version}/acropolis-install-linux.tar.gz"
    sha256 "LINUX_SHA256"
  end

  def install
    if OS.mac?
      bin.install "acropolis-install.com" => "parthenon-install"
    else
      bin.install "acropolis-install" => "parthenon-install"
    end
  end

  test do
    assert_match "Acropolis", shell_output("#{bin}/parthenon-install --help")
  end
end
```

**CI integration:** The `build-installer.yml` workflow adds a step after release upload that updates the formula with new version + SHA256 values via a PR to the tap repo.

### Phase 2: Snap (Ubuntu/Linux universal) — Snap Store review

Snap packages run in a confined sandbox and are distributed through the Snap Store. They work on Ubuntu, Fedora, Arch, and any distro with `snapd`.

**User experience:**
```bash
sudo snap install parthenon-installer --classic
parthenon-install
```

The `--classic` flag is needed because the installer requires Docker socket access and filesystem writes.

**Implementation:**
- Create `snap/snapcraft.yaml` in the Parthenon repo
- Build strategy: bundle Python 3.11 + the installer package
- Interfaces: `docker`, `home`, `network`, `network-bind` (for the webapp server)
- Register `parthenon-installer` name on Snapcraft.io
- CI publishes to the `edge` channel on each commit, `stable` on release tags

**snapcraft.yaml structure:**
```yaml
name: parthenon-installer
base: core22
version: '1.0.3'
summary: Acropolis installer for Parthenon outcomes research platform
description: |
  One-command setup for Parthenon, the unified OHDSI outcomes research
  platform on OMOP CDM v5.4. Handles Docker setup, repository cloning,
  and guided configuration.
grade: stable
confinement: classic

apps:
  parthenon-install:
    command: bin/python3 -m installer.bootstrap_remote

parts:
  installer:
    plugin: python
    source: .
    python-packages:
      - rich>=13.0
      - questionary>=2.0
    stage:
      - installer/
      - install.py
```

### Phase 3: APT/DEB (Debian/Ubuntu native)

A `.deb` package installable via `apt` provides the most native Linux experience. Hosted in a custom APT repository on GitHub Pages or Cloudflare R2.

**User experience:**
```bash
curl -fsSL https://parthenon.acumenus.net/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/parthenon.gpg
echo "deb [signed-by=/usr/share/keyrings/parthenon.gpg] https://parthenon.acumenus.net/apt stable main" | sudo tee /etc/apt/sources.list.d/parthenon.list
sudo apt update
sudo apt install parthenon-installer
```

Or simplified with a one-liner setup script.

**Implementation:**
- Build `.deb` in CI using `dpkg-deb` or `nfpm`
- Package contains the PyInstaller binary at `/usr/local/bin/parthenon-install`
- Post-install script creates a `.desktop` file for desktop environments
- Host APT repo on GitHub Pages (`sudoshi.github.io/parthenon-apt/`)
- GPG-sign the repo with a dedicated signing key

### Phase 4: Flatpak (Linux sandboxed)

Flatpak provides sandboxed distribution via Flathub, the largest Linux app store.

**User experience:**
```bash
flatpak install flathub io.acumenus.ParthenonInstaller
flatpak run io.acumenus.ParthenonInstaller
```

Or via GNOME Software / KDE Discover GUI app stores.

**Implementation:**
- Create Flatpak manifest (`io.acumenus.ParthenonInstaller.yml`)
- Runtime: `org.freedesktop.Platform` with Python extension
- Permissions: `--share=network`, `--filesystem=home`, `--socket=session-bus`
- Docker access: requires `--filesystem=/var/run/docker.sock` (Flatpak doesn't support `--device` for Docker natively — may need `--classic`-like escape)
- Submit to Flathub

**Risk:** Docker socket access from Flatpak is contentious. Flathub may reject the app. Snap with `--classic` confinement is more practical for Docker-dependent tools.

### Phase 5: Winget (Windows native)

Winget is Windows' built-in package manager (Windows 10 1809+ and Windows 11).

**User experience:**
```powershell
winget install Acumenus.ParthenonInstaller
parthenon-install
```

**Implementation:**
- Create a winget manifest in the `microsoft/winget-pkgs` community repo
- The manifest points to `acropolis-install-win.exe` on the GitHub Release
- The exe is a PyInstaller binary that detects WSL, installs it if needed, then runs the installer inside WSL
- Requires Windows code signing certificate for SmartScreen trust

**Windows code signing options:**
- Certum Open Source Code Signing Certificate (~$50/year for open-source projects)
- SignPath.io (free for open-source, integrates with GitHub Actions)
- DigiCert / Sectigo (~$200-400/year)

The CI workflow signs the `.exe` using a certificate stored as a GitHub Actions secret.

### Phase 6: Signed macOS .pkg

A `.pkg` installer that passes Gatekeeper without any Terminal commands. The user double-clicks the `.pkg`, macOS Installer.app opens, they click through, and `parthenon-install` is on their PATH.

**User experience:**
1. Download `Parthenon-Installer-1.0.3.pkg` from the install page
2. Double-click → macOS Installer opens
3. Click "Install" → enters admin password
4. Run `parthenon-install` from Terminal (or it auto-launches)

**Implementation:**
- Apple Developer Program enrollment ($99/year) → get Developer ID Installer certificate
- CI builds `.pkg` using `pkgbuild` + `productbuild`
- CI signs with `productsign --sign "Developer ID Installer: Acumenus Data Sciences"`
- CI notarizes with `xcrun notarytool submit` → `xcrun stapler staple`
- The pkg installs the cosmo APE binary to `/usr/local/bin/parthenon-install`
- Optional: post-install script that launches the installer immediately

**CI requirements:**
- Apple Developer certificate + key stored as GitHub Actions secrets
- `macos-14` runner for signing and notarization
- Notarization takes 2-10 minutes (async via `notarytool`)

### Phase 7: Signed Windows .msi

A `.msi` installer that passes SmartScreen.

**User experience:**
1. Download `Parthenon-Installer-1.0.3.msi`
2. Double-click → Windows Installer opens
3. Click through → installs `parthenon-install.exe` to Program Files
4. Start Menu shortcut opens the installer

**Implementation:**
- Build `.msi` using WiX Toolset in CI
- Code sign with a certificate from SignPath.io or Certum
- The MSI installs the PyInstaller exe + a batch wrapper that checks for WSL
- Start Menu shortcut runs the installer

## Landing Page Update

The install page at `parthenon.acumenus.net/install` should prioritize the package manager commands:

```
┌─────────────────────────────────────────┐
│        Install Parthenon                │
│                                         │
│  macOS / Linux:                         │
│  ┌─────────────────────────────────┐    │
│  │ brew tap sudoshi/parthenon      │    │
│  │ brew install parthenon-installer│    │
│  └─────────────────────────────────┘    │
│                                         │
│  Ubuntu / Debian:                       │
│  ┌─────────────────────────────────┐    │
│  │ sudo snap install parthenon ... │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Windows:                               │
│  ┌─────────────────────────────────┐    │
│  │ winget install Acumenus.Parth.. │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Or download directly:                  │
│  [macOS .pkg] [Linux .deb] [Win .msi]   │
│                                         │
└─────────────────────────────────────────┘
```

## Implementation Phases

| Phase | Channel | Signing Required | Effort | Coverage |
|-------|---------|-----------------|--------|----------|
| 1 | Homebrew | No | 1 day | macOS + Linux developers |
| 2 | Snap | No (Snap Store account) | 2 days | All Linux with snapd |
| 3 | APT/DEB | GPG key (free) | 2 days | Debian/Ubuntu native |
| 4 | Flatpak | No | 2 days | Linux desktop (risk: Docker access) |
| 5 | Winget | Windows code signing (~$50/yr) | 2 days | Windows 10/11 |
| 6 | macOS .pkg | Apple Developer ($99/yr) | 3 days | macOS direct download |
| 7 | Windows .msi | Windows code signing | 2 days | Windows direct download |

**Dependencies:**
```
Phase 1 (Homebrew) ──→ immediate, no blockers
Phase 2 (Snap) ──→ register name on Snapcraft.io
Phase 3 (APT) ──→ GPG key + hosting
Phase 4 (Flatpak) ──→ Docker access investigation
Phase 5 (Winget) ──→ needs Phase 7 signing cert
Phase 6 (macOS .pkg) ──→ Apple Developer enrollment
Phase 7 (Windows .msi) ──→ code signing cert purchase
```

Phases 1-3 can start immediately. Phases 5-7 require certificate purchases.

## Success Criteria

1. `brew install parthenon-installer && parthenon-install` works on macOS and Linux
2. `snap install parthenon-installer --classic && parthenon-install` works on Ubuntu
3. `sudo apt install parthenon-installer && parthenon-install` works on Debian/Ubuntu
4. `winget install Acumenus.ParthenonInstaller` works on Windows (after signing)
5. Direct-download `.pkg` installs on macOS without Gatekeeper warnings (after signing)
6. Direct-download `.msi` installs on Windows without SmartScreen warnings (after signing)
7. Every path ends with the user at the Parthenon login screen
8. CI auto-publishes to all channels on release
