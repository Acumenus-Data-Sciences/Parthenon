# Trusted Native Signing for the Rust Installer Handoff

**Date:** 2026-04-21  
**Status:** CI scaffolding added; account setup and first signed builds still required  
**Goal:** Produce a notarized macOS installer/app and a signed Windows MSI path that shows Acumenus as the verified publisher wherever the platform allows it.

## Repository Context

Work in `/home/smudoshi/Github/Parthenon`.

Current installer packaging surfaces:

- `installer/rust-gui/tauri.conf.json`
- `.github/workflows/build-rust-installer-gui.yml`
- `installer/rust-gui/README.md`

Current packaging facts from the repo:

- Tauri product name: `Parthenon Installer`
- Tauri identifier: `io.acumenus.parthenon.installer`
- Bundle targets: `all`
- GitHub Actions already builds Linux x64, macOS Intel, macOS Apple Silicon, and Windows x64 artifacts
- Native release uploads were intentionally blocked in policy until signing and smoke coverage existed

This handoff covers the trust path for those existing artifacts. It does not change the installer runtime model or the Community bundle contract.

## What Was Added

`.github/workflows/build-rust-installer-gui.yml` now has conditional signing hooks:

- macOS:
  - validates that notarization credentials exist when an Apple signing cert is configured
  - imports a base64-encoded `.p12` certificate into a temporary keychain
  - selects a `Developer ID Application` signing identity
  - writes the App Store Connect API key to a temporary `.p8` file when that path is used
  - exposes the expected Tauri environment variables for signing and notarization
  - runs `codesign --verify` and `spctl -a -vv` after build
- Windows:
  - validates that Azure Artifact Signing credentials are complete when any Windows signing secret is present
  - installs `trusted-signing-cli`
  - writes a temporary `tauri.windows.conf.json` with `bundle.windows.signCommand`
  - exposes the Azure credentials that `trusted-signing-cli` expects

Unsigned builds still work when those secrets are absent.

## macOS Trust Model

### What "trusted" means on macOS

For software distributed outside the Mac App Store, the practical trust target is:

1. sign with `Developer ID Application`
2. notarize with Apple
3. staple or otherwise distribute the notarized artifact

That gives Gatekeeper a verified developer identity and an Apple notarization ticket.

### Which Apple certificate you need

For the current Tauri app/disc image path:

- Use `Developer ID Application` for the app bundle and DMG/ZIP distribution path.
- Only add `Developer ID Installer` if Acumenus later decides to ship a flat `.pkg`.

That distinction matters. Tauri’s normal macOS output is not a flat installer package, so buying or exporting only a `Developer ID Installer` certificate does not solve the app-bundle signing problem.

### Recommended CI credentials

Preferred:

- `APPLE_CERTIFICATE`: base64-encoded exported `.p12` containing the `Developer ID Application` certificate and private key
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_API_KEY`: App Store Connect key ID
- `APPLE_API_ISSUER`: App Store Connect issuer ID
- `APPLE_API_KEY_P8`: the raw contents of the downloaded `.p8` private key

Fallback:

- `APPLE_ID`
- `APPLE_PASSWORD`: Apple app-specific password
- `APPLE_TEAM_ID`

Prefer the App Store Connect API path. It is cleaner for CI, does not depend on an interactive Apple ID session, and maps directly to Tauri’s documented notarization flow.

### First-time Apple setup checklist

1. In Apple Developer, create a `Developer ID Application` certificate.
2. Export that cert and its private key from Keychain Access as `.p12`.
3. Base64-encode the `.p12` for GitHub Actions secret storage.
4. In App Store Connect, create an API key with Developer access.
5. Save the key ID, issuer ID, and `.p8` private key.
6. Add the GitHub repository secrets listed above.
7. Run `Rust Installer GUI Packages` with `workflow_dispatch`.

### Local verification after the first signed build

On a Mac:

```bash
codesign --verify --deep --strict --verbose=2 "Parthenon Installer.app"
spctl -a -vv "Parthenon Installer.app"
xcrun stapler validate "Parthenon Installer.app"
```

If you distribute a DMG, validate the DMG too:

```bash
xcrun stapler validate Parthenon-Installer.dmg
```

### macOS release recommendation

Short term:

- Keep the source-backed bundle as the default public install path until the first notarized macOS artifacts pass smoke testing.

After first success:

- publish the signed/notarized macOS bundle artifacts
- verify launch on a clean Mac without right-click bypass steps
- record the exact secret inventory and notarization logs once confirmed

## Windows Trust Model

### What "trusted" means on Windows in 2026

Windows trust now has two separate layers:

1. code signing and publisher identity
2. SmartScreen reputation

A signed MSI can show a verified publisher and satisfy integrity checks, enterprise allowlisting, and most IT review workflows. That does **not** guarantee a no-warning consumer download experience. SmartScreen reputation is per file hash, so a brand-new signed build starts cold.

Important current reality:

- EV certificates no longer give immediate SmartScreen bypass for new downloads.
- A signed MSI is still the right thing to ship, but it should be described as "signed by Acumenus", not "guaranteed warning-free".
- If the product needs a reliable no-warning consumer install path, Microsoft Store distribution is the stronger long-term answer.

### MSI path in this repo

The current Tauri app already builds Windows installers on `windows-2022`.

Relevant facts:

- Tauri uses WiX Toolset v3 for `.msi` generation.
- The workflow already runs on Windows, so it is the correct place to attach signing.
- The new CI scaffolding uses Tauri’s documented `bundle.windows.signCommand` hook.

### Recommended signing path

Recommended for Acumenus:

1. Use Azure Artifact Signing (formerly Trusted Signing) for direct-download Windows releases.
2. Keep using MSI as the primary direct-download installer format.
3. Timestamp every signed artifact.
4. Accept that SmartScreen reputation still has to accumulate per build hash.
5. Add a Microsoft Store or MSIX track later only if "no warning on first download" becomes a hard requirement.

### Why Azure Artifact Signing is the best fit here

It matches the current Microsoft and Tauri documentation better than a hardware-token OV/EV workflow for CI:

- better CI fit than a locally attached USB token
- Microsoft-managed certificate lifecycle
- repo/workflow friendly
- aligns with Tauri’s current Windows signing guide

### Windows signing secrets used by the workflow

- `WINDOWS_TRUSTED_SIGNING_ENDPOINT`
- `WINDOWS_TRUSTED_SIGNING_ACCOUNT`
- `WINDOWS_TRUSTED_SIGNING_PROFILE`
- `WINDOWS_TRUSTED_SIGNING_DESCRIPTION` optional
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`

`WINDOWS_TRUSTED_SIGNING_DESCRIPTION` is worth setting. That string is what Tauri’s current signing guidance says will appear as the installer name in the UAC prompt for `.msi` signing.

### Azure setup checklist

1. Create an Azure Artifact Signing account.
2. Complete identity validation for the Acumenus legal entity.
3. Create a certificate profile for public-trust Windows signing.
4. Register an Entra app for CI access.
5. Grant the app the access required by the signing account/profile.
6. Add the GitHub repository secrets listed above.
7. Run `Rust Installer GUI Packages` on `main`.

### Windows verification after the first signed build

On a Windows machine:

```powershell
Get-AuthenticodeSignature .\Parthenon-Installer.msi | Format-List
signtool verify /pa /v .\Parthenon-Installer.msi
```

Verify the publisher line, timestamp, and trust chain. Do not treat a valid signature as proof that SmartScreen warnings are gone; that needs real download/reputation testing.

## Recommended Product Positioning

### macOS

The target can be "trusted app" in the ordinary user sense:

- verified developer identity
- notarized by Apple
- launches through Gatekeeper without scary malware-style prompts

### Windows

The honest target is narrower:

- verified publisher: yes
- signed MSI: yes
- no SmartScreen warning on day-one hashes: not guaranteed

If the product page or installer copy claims more than that, it will overpromise.

## Release Policy Recommendation

For now:

- keep the source-backed installer bundle as the stable public install path
- treat signed native artifacts as an additional release surface, not the only supported path, until first-platform smoke is complete

Once the first signed macOS and Windows runs are verified:

- publish macOS signed artifacts publicly
- publish Windows signed MSI publicly
- describe Windows as signed by Acumenus, not as "pre-approved by Microsoft"

## Concrete Next Steps

1. Add the Apple repository secrets.
2. Add the Azure Artifact Signing repository secrets.
3. Run `Rust Installer GUI Packages` from `main`.
4. Validate the macOS artifact with `spctl`, `codesign`, and `xcrun stapler validate`.
5. Validate the Windows MSI with `Get-AuthenticodeSignature` and `signtool verify`.
6. Decide whether Acumenus wants a Microsoft Store/MSIX track later for stronger first-download trust on Windows.
