# Signed Release Packaging — Design Spec

**Date:** 2026-04-23
**Sub-project:** A of 3 (Installer milestone)
**Status:** Approved, pending implementation plan

---

## Goal

Produce signed, notarized, installable release artifacts for all three platforms and publish them as permanent GitHub Release assets alongside the existing Python bootstrap bundle.

| Platform | Artifact | Signing mechanism |
|---|---|---|
| macOS (Intel) | `.dmg` | Apple Developer ID Application + notarytool |
| macOS (Apple Silicon) | `.dmg` | Apple Developer ID Application + notarytool |
| Windows | `.msi` | Azure Trusted Signing (Authenticode) |
| Linux | `.deb`, `.rpm`, `.AppImage` | GPG detached signature (`.asc`) |

---

## Current State

- Multi-platform Tauri build matrix is working (`build-rust-installer-gui.yml`)
- macOS Apple Developer secrets are set in GitHub (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_P8`)
- Windows Azure secrets are not yet set
- GPG key does not yet exist
- Two CI bugs prevent macOS signing from activating
- All builds produce unsigned artifacts only
- No release assets are published from this workflow

---

## Section 1: CI Bug Fixes

Two surgical changes to `build-rust-installer-gui.yml`.

### Bug 1 — Invalid Intel macOS runner (line 83)

```yaml
# Before
runner: macos-15-intel

# After
runner: macos-13
```

`macos-13` is the current GitHub-hosted Intel (x64) Mac runner. `macos-15` (arm64) stays unchanged. The invalid runner name causes the x64 job to fail before cloning the repo.

### Bug 2 — Secrets not evaluated in `if:` conditions (7 occurrences)

GitHub Actions does not reliably evaluate `secrets.*` in `if:` expressions without the `${{ }}` wrapper. All signing-gated conditions must be wrapped:

```yaml
# Before
if: runner.os == 'macOS' && secrets.APPLE_CERTIFICATE != ''

# After
if: ${{ runner.os == 'macOS' && secrets.APPLE_CERTIFICATE != '' }}
```

Applies to: macOS notarization validation step, macOS cert prep step, macOS API key step, Windows validation step, Windows CLI install step, Windows signing config step.

These two fixes, with no other changes, activate the existing Apple signing chain on the next workflow run.

---

## Section 2: macOS Signing, Notarization, and .dmg

### How it works

Tauri 2 handles the full chain during `cargo tauri build` when these env vars are set:

| Env var | Purpose |
|---|---|
| `APPLE_CERTIFICATE` | Base64 `.p12` — cert + private key |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` export password |
| `APPLE_SIGNING_IDENTITY` | Identity string extracted from keychain (set dynamically) |
| `APPLE_API_KEY` | App Store Connect key ID |
| `APPLE_API_ISSUER` | App Store Connect issuer ID |
| `APPLE_API_KEY_PATH` | Path to `.p8` file (written to temp path by prep step) |

Tauri signs the `.app`, runs `notarytool` to notarize, and staples the ticket to both the `.app` and `.dmg`. No custom notarization step is needed.

### Output paths

```
target/release/bundle/macos/Parthenon Installer.app    ← signed + notarized
target/release/bundle/dmg/Parthenon Installer_0.1.0_*.dmg  ← signed + notarized + stapled
```

`targets: "all"` in `tauri.conf.json` already produces `.dmg` — no config change needed.

### Verification step addition

The existing verification step checks the `.app` with `codesign` and `spctl`. Add one line to also validate the `.dmg`:

```bash
xcrun stapler validate "$(find target/release/bundle/dmg -name '*.dmg' | head -1)"
```

### Release asset naming

```
Parthenon-Installer-{version}-macos-x64.dmg
Parthenon-Installer-{version}-macos-arm64.dmg
```

Version is read from `installer/rust-gui/tauri.conf.json` via `jq -r '.version'`.

### Release upload step

Added at the end of each macOS job, after verification:

```yaml
- name: Upload macOS release asset
  if: ${{ github.event_name == 'release' && env.APPLE_SIGNING_IDENTITY != '' }}
  env:
    GH_TOKEN: ${{ github.token }}
  run: |
    VERSION=$(jq -r '.version' installer/rust-gui/tauri.conf.json)
    ARCH=${{ matrix.label == 'macos-arm64' && 'arm64' || 'x64' }}
    DMG=$(find installer/rust-gui/target/release/bundle/dmg -name "*.dmg" | head -1)
    gh release upload "${{ github.event.release.tag_name }}" \
      "${DMG}#Parthenon-Installer-${VERSION}-macos-${ARCH}.dmg" \
      --clobber
```

Unsigned builds (no `APPLE_SIGNING_IDENTITY`) skip the upload even on release events, preventing unsigned `.dmg` from appearing on the release page.

---

## Section 3: Windows Azure Trusted Signing + .msi

### Signing mechanism

Azure Trusted Signing (formerly Trusted Signing) via `trusted-signing-cli`. The workflow already installs the CLI and writes `tauri.windows.conf.json` with `bundle.windows.signCommand`. Only secrets are missing.

### Azure one-time setup

1. **Create a Trusted Signing Account** in Azure portal (search "Trusted Signing")
2. **Create a Certificate Profile** — choose `PublicTrust` (Organization Validated); submit identity verification (1–5 business days)
3. **Create an App Registration** — Azure Active Directory → App registrations → name it `parthenon-ci-signer`
4. **Generate a client secret** — inside the App Registration → Certificates & secrets
5. **Assign role** — on the Trusted Signing Account → IAM → `Trusted Signing Certificate Profile Signer` → assign to the App Registration

### GitHub secrets to add

| Secret | Value |
|---|---|
| `WINDOWS_TRUSTED_SIGNING_ENDPOINT` | `https://eus.codesigning.azure.net` (or your region) |
| `WINDOWS_TRUSTED_SIGNING_ACCOUNT` | Trusted Signing account name |
| `WINDOWS_TRUSTED_SIGNING_PROFILE` | Certificate profile name |
| `WINDOWS_TRUSTED_SIGNING_DESCRIPTION` | `Acumenus Data Sciences` (shown in UAC prompt) |
| `AZURE_CLIENT_ID` | App Registration application (client) ID |
| `AZURE_CLIENT_SECRET` | Client secret value |
| `AZURE_TENANT_ID` | Azure AD tenant ID |

### Output

Tauri with `targets: "all"` produces both `.msi` and `.nsis`. Only the `.msi` is published as a release asset.

### Release asset naming

```
Parthenon-Installer-{version}-windows-x64.msi
```

### Release upload step

```yaml
- name: Upload Windows release asset
  if: ${{ github.event_name == 'release' && secrets.WINDOWS_TRUSTED_SIGNING_ACCOUNT != '' }}
  shell: pwsh
  env:
    GH_TOKEN: ${{ github.token }}
  run: |
    $version = (Get-Content installer/rust-gui/tauri.conf.json | ConvertFrom-Json).version
    $msi = Get-ChildItem -Path "installer/rust-gui/target/release/bundle/msi" -Filter "*.msi" | Select-Object -First 1
    gh release upload "${{ github.event.release.tag_name }}" `
      "$($msi.FullName)#Parthenon-Installer-${version}-windows-x64.msi" --clobber
```

### SmartScreen caveat

A correctly signed MSI shows "Verified publisher: Acumenus Data Sciences" in the UAC prompt. However, SmartScreen reputation is per-file-hash and starts at zero. A warning dialog will appear for early downloads. Reputation builds within weeks of real user downloads. This is expected and not a signing defect.

---

## Section 4: Linux GPG Signing + .deb, .rpm, .AppImage

### Signing model

Detached GPG signatures — a `.asc` file alongside each package. Standard for direct-download open-source packages. Does not require format-specific tools (`dpkg-sig`, `rpmsign`). Users verify with `gpg --verify`.

A dedicated release signing keypair is generated once and stored as a GitHub secret. The public key is committed to the repo root as `SIGNING-KEY.asc` and uploaded as a release asset.

### One-time GPG key generation (run on your Mac)

```bash
gpg --batch --gen-key <<EOF
Key-Type: eddsa
Key-Curve: ed25519
Key-Usage: sign
Name-Real: Acumenus Data Sciences
Name-Email: releases@acumenus.net
Expire-Date: 0
%no-protection
EOF

# Export private key as base64 → paste into GitHub secret GPG_SIGNING_KEY
gpg --export-secret-keys --armor releases@acumenus.net | base64 | pbcopy

# Export public key → commit to repo root
gpg --export --armor releases@acumenus.net > SIGNING-KEY.asc
```

No passphrase (`%no-protection`) is correct for a CI-only key stored in GitHub Secrets. A passphrase on a secret already encrypted by GitHub adds no real security and adds complexity.

### GitHub secret to add

| Secret | Value |
|---|---|
| `GPG_SIGNING_KEY` | Base64 output from `gpg --export-secret-keys \| base64` |

### CI signing step

Inserted after Tauri build, before packaging:

```yaml
- name: Sign Linux packages
  if: ${{ runner.os == 'Linux' && secrets.GPG_SIGNING_KEY != '' }}
  env:
    GPG_SIGNING_KEY: ${{ secrets.GPG_SIGNING_KEY }}
  run: |
    echo "$GPG_SIGNING_KEY" | base64 --decode | gpg --batch --import
    KEY_ID=$(gpg --list-secret-keys --with-colons | grep '^fpr' | head -1 | cut -d: -f10)
    for pkg in \
      $(find installer/rust-gui/target/release/bundle/deb -name "*.deb") \
      $(find installer/rust-gui/target/release/bundle/rpm -name "*.rpm") \
      $(find installer/rust-gui/target/release/bundle/appimage -name "*.AppImage"); do
      gpg --batch --local-user "$KEY_ID" --detach-sign --armor "$pkg"
    done
```

### Release assets

```
Parthenon-Installer-{version}-linux-x64.deb
Parthenon-Installer-{version}-linux-x64.deb.asc
Parthenon-Installer-{version}-linux-x64.rpm
Parthenon-Installer-{version}-linux-x64.rpm.asc
Parthenon-Installer-{version}-linux-x64.AppImage
Parthenon-Installer-{version}-linux-x64.AppImage.asc
SIGNING-KEY.asc
```

### User verification (document in README)

```bash
# Import the Acumenus signing key once
curl -sL https://github.com/sudoshi/Parthenon/releases/latest/download/SIGNING-KEY.asc | gpg --import

# Verify before installing
gpg --verify Parthenon-Installer-0.1.0-linux-x64.deb.asc \
             Parthenon-Installer-0.1.0-linux-x64.deb
```

---

## Section 5: Release Asset Publishing and Coordination

### Workflow-level permissions change

```yaml
permissions:
  contents: write   # was: read — needed for gh release upload
```

### Coordination model

Each platform job independently uploads its own assets. No cross-job orchestration. The Linux job also uploads `SIGNING-KEY.asc`. The Python bootstrap bundle is uploaded by the separate `build-installer.yml` workflow — both trigger on `release: [published]` and upload different files with no collision.

### Final release page inventory

```
# From build-installer.yml (existing)
parthenon-community-bootstrap-{version}.tar.gz
parthenon-community-bootstrap-{version}.tar.gz.sha256

# From build-rust-installer-gui.yml (new)
Parthenon-Installer-{version}-macos-arm64.dmg
Parthenon-Installer-{version}-macos-x64.dmg
Parthenon-Installer-{version}-windows-x64.msi
Parthenon-Installer-{version}-linux-x64.deb
Parthenon-Installer-{version}-linux-x64.deb.asc
Parthenon-Installer-{version}-linux-x64.rpm
Parthenon-Installer-{version}-linux-x64.rpm.asc
Parthenon-Installer-{version}-linux-x64.AppImage
Parthenon-Installer-{version}-linux-x64.AppImage.asc
SIGNING-KEY.asc
```

### Version extraction

Consistent across all jobs:

```bash
# Linux / macOS
VERSION=$(jq -r '.version' installer/rust-gui/tauri.conf.json)

# Windows (PowerShell)
$version = (Get-Content installer/rust-gui/tauri.conf.json | ConvertFrom-Json).version
```

### Re-run safety

All `gh release upload` calls use `--clobber`. Re-running a failed workflow does not error on already-uploaded assets.

### Unsigned build guard

On `workflow_dispatch` and `pull_request`, all release upload steps are gated on `github.event_name == 'release'` and never run. macOS unsigned builds are additionally gated on `env.APPLE_SIGNING_IDENTITY != ''` to prevent unsigned `.dmg` from appearing on a release page if macOS secrets are missing.

---

## Secrets Summary

| Secret | Platform | Status |
|---|---|---|
| `APPLE_CERTIFICATE` | macOS | Already set |
| `APPLE_CERTIFICATE_PASSWORD` | macOS | Already set |
| `APPLE_API_KEY` | macOS | Already set |
| `APPLE_API_ISSUER` | macOS | Already set |
| `APPLE_API_KEY_P8` | macOS | Already set |
| `WINDOWS_TRUSTED_SIGNING_ENDPOINT` | Windows | Needs adding |
| `WINDOWS_TRUSTED_SIGNING_ACCOUNT` | Windows | Needs adding |
| `WINDOWS_TRUSTED_SIGNING_PROFILE` | Windows | Needs adding |
| `WINDOWS_TRUSTED_SIGNING_DESCRIPTION` | Windows | Needs adding |
| `AZURE_CLIENT_ID` | Windows | Needs adding |
| `AZURE_CLIENT_SECRET` | Windows | Needs adding |
| `AZURE_TENANT_ID` | Windows | Needs adding |
| `GPG_SIGNING_KEY` | Linux | Needs generating + adding |

---

## Out of Scope

- Installer v2 engine (phase state machine, resume/rollback, OS keychain) — Sub-project B
- Existing OMOP CDM connection support — Sub-project C
- APT/YUM repository hosting with signed `Release` files (GPG detached signatures cover V1)
- Microsoft Store / MSIX track for stronger Windows first-download trust (future)
- Linux Snap / Flatpak packaging (future)
