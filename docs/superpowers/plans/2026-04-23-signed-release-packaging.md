# Signed Release Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two CI bugs that prevent macOS signing from activating, add GPG signing for Linux packages, add Azure Trusted Signing for Windows, and publish all signed artifacts as permanent GitHub Release assets.

**Architecture:** All changes are confined to `.github/workflows/build-rust-installer-gui.yml` plus a committed GPG public key file. Tauri 2 already handles macOS signing and notarization internally when the correct env vars are set. Linux signing uses `gpg --detach-sign`. Windows signing uses the existing `trusted-signing-cli` scaffolding already in the workflow. Each platform job independently uploads its own release assets via `gh release upload`.

**Tech Stack:** GitHub Actions, `gh` CLI (pre-installed on all runners), `gpg` (pre-installed on Ubuntu runners), `jq` (pre-installed on Linux/macOS runners), `cargo tauri build` (existing), `trusted-signing-cli` (existing Cargo install step in workflow).

**Design spec:** `docs/superpowers/specs/2026-04-23-signed-release-packaging-design.md`

**Operator guides:** `APP-SIGNING-HOWTO.md` (macOS), `AZURE-SIGNING-HOWTO.md` (Windows)

---

## Files

| Action | Path | Purpose |
|---|---|---|
| Modify | `.github/workflows/build-rust-installer-gui.yml` | All CI fixes and new steps |
| Create | `SIGNING-KEY.asc` | GPG public key for Linux package verification |

---

## Task 1: Generate GPG Signing Keypair (local, run on your Mac)

This task is done manually on your Mac — not in CI. Output is a GitHub secret and a committed public key file.

**Files:**
- Create: `SIGNING-KEY.asc` (repo root)

- [ ] **Step 1: Generate a dedicated release signing keypair**

Run in Terminal on your Mac:

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
```

Expected output ends with: `gpg: key XXXXXXXXXXXXXXXX marked as ultimately trusted`

- [ ] **Step 2: Export the private key as base64 and copy to clipboard**

```bash
gpg --export-secret-keys --armor releases@acumenus.net | base64 | pbcopy
```

No output — the base64 string is now in your clipboard. Keep it there for Step 4.

- [ ] **Step 3: Export the public key and commit it to the repo**

```bash
cd /home/smudoshi/Github/Parthenon
gpg --export --armor releases@acumenus.net > SIGNING-KEY.asc
git add SIGNING-KEY.asc
git commit -m "chore: add GPG public signing key for Linux package verification"
```

Expected: 1 file changed, N insertions.

- [ ] **Step 4: Add GPG_SIGNING_KEY to GitHub repository secrets**

1. Open `https://github.com/sudoshi/Parthenon/settings/secrets/actions`
2. Click `New repository secret`
3. Name: `GPG_SIGNING_KEY`
4. Value: paste the base64 string from Step 2
5. Click `Add secret`

- [ ] **Step 5: Verify the key locally (sanity check)**

```bash
# Sign a test file and verify it
echo "test" > /tmp/gpg-test.txt
gpg --local-user releases@acumenus.net --detach-sign --armor /tmp/gpg-test.txt
gpg --verify /tmp/gpg-test.txt.asc /tmp/gpg-test.txt
```

Expected last line: `gpg: Good signature from "Acumenus Data Sciences <releases@acumenus.net>"`

---

## Task 2: Add `artifact_arch` to Matrix + Fix Intel macOS Runner

The matrix needs an `artifact_arch` field so upload steps can name artifacts without ternary expressions (which GitHub Actions YAML doesn't support). The Intel macOS runner name `macos-15-intel` is invalid and must be corrected to `macos-13`.

**Files:**
- Modify: `.github/workflows/build-rust-installer-gui.yml` lines 76–93

- [ ] **Step 1: Replace the entire matrix `include:` block**

Open `.github/workflows/build-rust-installer-gui.yml`. Find lines 76–93 (the `include:` block under `strategy.matrix`) and replace the entire block:

```yaml
        include:
          - label: linux-x64
            runner: ubuntu-22.04
            artifact: parthenon-installer-linux-x64
            smoke_contract: true
            artifact_arch: x64
          - label: macos-x64
            runner: macos-13
            artifact: parthenon-installer-macos-x64
            smoke_contract: true
            artifact_arch: x64
          - label: macos-arm64
            runner: macos-15
            artifact: parthenon-installer-macos-arm64
            smoke_contract: true
            artifact_arch: arm64
          - label: windows-x64
            runner: windows-2022
            artifact: parthenon-installer-windows-x64
            smoke_contract: false
            artifact_arch: x64
```

Changes from original:
- `macos-15-intel` → `macos-13` (valid GitHub-hosted Intel Mac runner)
- Added `artifact_arch: x64` or `artifact_arch: arm64` to all four entries

- [ ] **Step 2: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-rust-installer-gui.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build-rust-installer-gui.yml
git commit -m "fix(ci): correct Intel macOS runner name and add artifact_arch matrix field"
```

---

## Task 3: Fix Workflow Permissions + All `if:` Condition Syntax

Two changes in one commit: the top-level `permissions` block needs `contents: write` for `gh release upload`, and all six secret-gated `if:` conditions need `${{ }}` wrapping so GitHub Actions evaluates them correctly.

**Files:**
- Modify: `.github/workflows/build-rust-installer-gui.yml` — lines 32–33, 106, 127, 152, 166, 190, 195

- [ ] **Step 1: Fix workflow-level permissions (lines 32–33)**

Find:
```yaml
permissions:
  contents: read
```

Replace with:
```yaml
permissions:
  contents: write
```

- [ ] **Step 2: Fix macOS notarization validation condition (line 106)**

Find:
```yaml
      if: runner.os == 'macOS' && secrets.APPLE_CERTIFICATE != ''
        shell: bash
        env:
          APPLE_API_KEY: ${{ secrets.APPLE_API_KEY }}
```

Replace the `if:` line only:
```yaml
      if: ${{ runner.os == 'macOS' && secrets.APPLE_CERTIFICATE != '' }}
```

- [ ] **Step 3: Fix macOS certificate prep condition (line 127)**

Find the step named `Prepare macOS signing certificate`. Its `if:` line reads:
```yaml
      if: runner.os == 'macOS' && secrets.APPLE_CERTIFICATE != ''
```

Replace with:
```yaml
      if: ${{ runner.os == 'macOS' && secrets.APPLE_CERTIFICATE != '' }}
```

- [ ] **Step 4: Fix App Store Connect API key condition (line 152)**

Find the step named `Prepare App Store Connect API key`. Its `if:` line reads:
```yaml
      if: runner.os == 'macOS' && secrets.APPLE_API_KEY != '' && secrets.APPLE_API_ISSUER != '' && secrets.APPLE_API_KEY_P8 != ''
```

Replace with:
```yaml
      if: ${{ runner.os == 'macOS' && secrets.APPLE_API_KEY != '' && secrets.APPLE_API_ISSUER != '' && secrets.APPLE_API_KEY_P8 != '' }}
```

- [ ] **Step 5: Fix Windows trusted signing validation condition (line 166)**

Find the step named `Validate Windows trusted signing configuration`. Its `if:` line reads:
```yaml
      if: runner.os == 'Windows' && (secrets.WINDOWS_TRUSTED_SIGNING_ACCOUNT != '' || secrets.WINDOWS_TRUSTED_SIGNING_PROFILE != '' || secrets.WINDOWS_TRUSTED_SIGNING_ENDPOINT != '' || secrets.AZURE_CLIENT_ID != '' || secrets.AZURE_CLIENT_SECRET != '' || secrets.AZURE_TENANT_ID != '')
```

Replace with:
```yaml
      if: ${{ runner.os == 'Windows' && (secrets.WINDOWS_TRUSTED_SIGNING_ACCOUNT != '' || secrets.WINDOWS_TRUSTED_SIGNING_PROFILE != '' || secrets.WINDOWS_TRUSTED_SIGNING_ENDPOINT != '' || secrets.AZURE_CLIENT_ID != '' || secrets.AZURE_CLIENT_SECRET != '' || secrets.AZURE_TENANT_ID != '') }}
```

- [ ] **Step 6: Fix Windows trusted-signing CLI install condition (line 190)**

Find the step named `Install Windows trusted-signing CLI`. Its `if:` line reads:
```yaml
      if: runner.os == 'Windows' && secrets.WINDOWS_TRUSTED_SIGNING_ACCOUNT != '' && secrets.WINDOWS_TRUSTED_SIGNING_PROFILE != '' && secrets.WINDOWS_TRUSTED_SIGNING_ENDPOINT != '' && secrets.AZURE_CLIENT_ID != '' && secrets.AZURE_CLIENT_SECRET != '' && secrets.AZURE_TENANT_ID != ''
```

Replace with:
```yaml
      if: ${{ runner.os == 'Windows' && secrets.WINDOWS_TRUSTED_SIGNING_ACCOUNT != '' && secrets.WINDOWS_TRUSTED_SIGNING_PROFILE != '' && secrets.WINDOWS_TRUSTED_SIGNING_ENDPOINT != '' && secrets.AZURE_CLIENT_ID != '' && secrets.AZURE_CLIENT_SECRET != '' && secrets.AZURE_TENANT_ID != '' }}
```

- [ ] **Step 7: Fix Windows signing config condition (line 195)**

Find the step named `Prepare Windows signing config`. Its `if:` line reads:
```yaml
      if: runner.os == 'Windows' && secrets.WINDOWS_TRUSTED_SIGNING_ACCOUNT != '' && secrets.WINDOWS_TRUSTED_SIGNING_PROFILE != '' && secrets.WINDOWS_TRUSTED_SIGNING_ENDPOINT != '' && secrets.AZURE_CLIENT_ID != '' && secrets.AZURE_CLIENT_SECRET != '' && secrets.AZURE_TENANT_ID != ''
```

Replace with:
```yaml
      if: ${{ runner.os == 'Windows' && secrets.WINDOWS_TRUSTED_SIGNING_ACCOUNT != '' && secrets.WINDOWS_TRUSTED_SIGNING_PROFILE != '' && secrets.WINDOWS_TRUSTED_SIGNING_ENDPOINT != '' && secrets.AZURE_CLIENT_ID != '' && secrets.AZURE_CLIENT_SECRET != '' && secrets.AZURE_TENANT_ID != '' }}
```

- [ ] **Step 8: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-rust-installer-gui.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 9: Commit**

```bash
git add .github/workflows/build-rust-installer-gui.yml
git commit -m "fix(ci): wrap secret-gated if: conditions in \${{ }} and grant contents:write"
```

---

## Task 4: Add rpm Tooling to Linux Dependencies

Tauri's `targets: "all"` on Linux will attempt to build `.rpm` but silently skip it if `rpm` tooling is absent. Add it to the Linux deps step alongside the existing GTK/WebKit packages.

**Files:**
- Modify: `.github/workflows/build-rust-installer-gui.yml` — the `Install Linux system dependencies` step (lines 218–226)

- [ ] **Step 1: Add rpm to the Linux apt-get install step**

Find the step named `Install Linux system dependencies`:
```yaml
      - name: Install Linux system dependencies
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libgtk-3-dev \
            libwebkit2gtk-4.1-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev
```

Replace with:
```yaml
      - name: Install Linux system dependencies
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libgtk-3-dev \
            libwebkit2gtk-4.1-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev \
            rpm
```

- [ ] **Step 2: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-rust-installer-gui.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build-rust-installer-gui.yml
git commit -m "fix(ci): add rpm to Linux system deps so Tauri produces .rpm artifacts"
```

---

## Task 5: Add Linux GPG Signing Step

Insert a new step after `Build Tauri bundle` and before `List generated bundles`. The step signs every `.deb`, `.rpm`, and `.AppImage` with a detached armored signature, producing a `.asc` file alongside each package.

**Files:**
- Modify: `.github/workflows/build-rust-installer-gui.yml` — insert after the `Build Tauri bundle` step

- [ ] **Step 1: Insert the GPG signing step**

Find the step named `List generated bundles`:
```yaml
      - name: List generated bundles
        working-directory: installer/rust-gui
        shell: bash
        run: find target/release/bundle -maxdepth 4 -type f -print | sort
```

Insert this new step immediately **before** `List generated bundles`:

```yaml
      - name: Sign Linux packages with GPG
        if: ${{ runner.os == 'Linux' && secrets.GPG_SIGNING_KEY != '' }}
        working-directory: installer/rust-gui
        env:
          GPG_SIGNING_KEY: ${{ secrets.GPG_SIGNING_KEY }}
        run: |
          echo "$GPG_SIGNING_KEY" | base64 --decode | gpg --batch --import
          KEY_ID=$(gpg --list-secret-keys --with-colons | grep '^fpr' | head -1 | cut -d: -f10)
          for pkg in \
            $(find target/release/bundle/deb -name "*.deb" 2>/dev/null) \
            $(find target/release/bundle/rpm -name "*.rpm" 2>/dev/null) \
            $(find target/release/bundle/appimage -name "*.AppImage" 2>/dev/null); do
            gpg --batch --local-user "$KEY_ID" --detach-sign --armor "$pkg"
            echo "Signed: $pkg"
          done

```

- [ ] **Step 2: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-rust-installer-gui.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build-rust-installer-gui.yml
git commit -m "feat(ci): add GPG detached signature step for Linux packages"
```

---

## Task 6: Add macOS .dmg Stapler Validation

The existing `Verify macOS signature and Gatekeeper status` step checks the `.app` but not the `.dmg`. Add one `xcrun stapler validate` call for the `.dmg` so notarization ticket attachment is confirmed in CI.

**Files:**
- Modify: `.github/workflows/build-rust-installer-gui.yml` — the `Verify macOS signature and Gatekeeper status` step (lines 278–290)

- [ ] **Step 1: Add stapler validation to the macOS verification step**

Find the step named `Verify macOS signature and Gatekeeper status`. Its `run:` block currently ends with:
```yaml
          codesign --verify --deep --strict --verbose=2 "$app_bundle"
          spctl -a -vv "$app_bundle"
```

Replace the entire `run:` block with:
```yaml
        run: |
          app_bundle="$(find target/release/bundle/macos -maxdepth 1 -name '*.app' -print -quit)"
          if [ -z "$app_bundle" ]; then
            echo "Expected a macOS .app bundle after build, but none was found." >&2
            exit 1
          fi
          codesign --verify --deep --strict --verbose=2 "$app_bundle"
          spctl -a -vv "$app_bundle"
          dmg="$(find target/release/bundle/dmg -name '*.dmg' -print -quit)"
          if [ -n "$dmg" ]; then
            xcrun stapler validate "$dmg"
          fi
```

- [ ] **Step 2: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-rust-installer-gui.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build-rust-installer-gui.yml
git commit -m "feat(ci): add xcrun stapler validate for macOS .dmg notarization check"
```

---

## Task 7: Add Release Upload Steps (All Platforms)

Add a release upload step at the end of each platform job. Steps are gated on `github.event_name == 'release'` so they never run on `workflow_dispatch` or `pull_request`. Each step uses `gh release upload` with `--clobber` for re-run safety and the `#` suffix to rename artifacts on upload.

**Files:**
- Modify: `.github/workflows/build-rust-installer-gui.yml` — add steps after the existing `Upload installer packages` step

- [ ] **Step 1: Add macOS release upload step**

Find the step named `Upload installer packages`:
```yaml
      - name: Upload installer packages
        uses: actions/upload-artifact@v7
        with:
          name: ${{ matrix.artifact }}
          if-no-files-found: error
          compression-level: 0
          path: installer/rust-gui/dist-artifacts/*
```

Insert this new step immediately **after** `Upload installer packages`:

```yaml
      - name: Upload macOS release asset
        if: ${{ github.event_name == 'release' && runner.os == 'macOS' && env.APPLE_SIGNING_IDENTITY != '' }}
        working-directory: installer/rust-gui
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          VERSION=$(jq -r '.version' tauri.conf.json)
          ARCH=${{ matrix.artifact_arch }}
          DMG=$(find target/release/bundle/dmg -name "*.dmg" | head -1)
          if [ -z "$DMG" ]; then
            echo "No .dmg found — skipping release upload." >&2
            exit 0
          fi
          gh release upload "${{ github.event.release.tag_name }}" \
            "${DMG}#Parthenon-Installer-${VERSION}-macos-${ARCH}.dmg" \
            --clobber

      - name: Upload Windows release asset
        if: ${{ github.event_name == 'release' && runner.os == 'Windows' && secrets.WINDOWS_TRUSTED_SIGNING_ACCOUNT != '' }}
        working-directory: installer/rust-gui
        shell: pwsh
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          $version = (Get-Content tauri.conf.json | ConvertFrom-Json).version
          $msi = Get-ChildItem -Path "target/release/bundle/msi" -Filter "*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
          if (-not $msi) {
            Write-Warning "No .msi found — skipping release upload."
            exit 0
          }
          gh release upload "${{ github.event.release.tag_name }}" `
            "$($msi.FullName)#Parthenon-Installer-${version}-windows-x64.msi" --clobber

      - name: Upload Linux release assets
        if: ${{ github.event_name == 'release' && runner.os == 'Linux' }}
        working-directory: installer/rust-gui
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          VERSION=$(jq -r '.version' tauri.conf.json)
          UPLOADS=()

          DEB=$(find target/release/bundle/deb -name "*.deb" 2>/dev/null | head -1)
          if [ -n "$DEB" ]; then
            UPLOADS+=("${DEB}#Parthenon-Installer-${VERSION}-linux-x64.deb")
            [ -f "${DEB}.asc" ] && UPLOADS+=("${DEB}.asc#Parthenon-Installer-${VERSION}-linux-x64.deb.asc")
          fi

          RPM=$(find target/release/bundle/rpm -name "*.rpm" 2>/dev/null | head -1)
          if [ -n "$RPM" ]; then
            UPLOADS+=("${RPM}#Parthenon-Installer-${VERSION}-linux-x64.rpm")
            [ -f "${RPM}.asc" ] && UPLOADS+=("${RPM}.asc#Parthenon-Installer-${VERSION}-linux-x64.rpm.asc")
          fi

          APPIMAGE=$(find target/release/bundle/appimage -name "*.AppImage" 2>/dev/null | head -1)
          if [ -n "$APPIMAGE" ]; then
            UPLOADS+=("${APPIMAGE}#Parthenon-Installer-${VERSION}-linux-x64.AppImage")
            [ -f "${APPIMAGE}.asc" ] && UPLOADS+=("${APPIMAGE}.asc#Parthenon-Installer-${VERSION}-linux-x64.AppImage.asc")
          fi

          # Upload public key once per release (--clobber is idempotent)
          [ -f "../../SIGNING-KEY.asc" ] && UPLOADS+=("../../SIGNING-KEY.asc#SIGNING-KEY.asc")

          if [ ${#UPLOADS[@]} -eq 0 ]; then
            echo "No Linux artifacts found — skipping release upload." >&2
            exit 0
          fi

          gh release upload "${{ github.event.release.tag_name }}" \
            "${UPLOADS[@]}" \
            --clobber
```

- [ ] **Step 2: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-rust-installer-gui.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build-rust-installer-gui.yml
git commit -m "feat(ci): add release asset upload steps for macOS, Windows, and Linux"
```

---

## Task 8: Smoke Test via workflow_dispatch

Trigger the workflow manually and verify that signing is now active on macOS and Linux. Windows signing is tested separately after Azure certificate profile is active (see Task 9).

**No file changes. This task is all observation and verification.**

- [ ] **Step 1: Push all commits to main**

```bash
git push origin main
```

- [ ] **Step 2: Trigger a manual workflow run**

1. Open `https://github.com/sudoshi/Parthenon/actions/workflows/build-rust-installer-gui.yml`
2. Click `Run workflow`
3. Leave ref as `main`
4. Click `Run workflow`

- [ ] **Step 3: Watch the macOS arm64 job logs**

Expand the step `Prepare macOS signing certificate`. You should see:
- No "Developer ID Application signing identity was not found" error
- The step completes (green checkmark)

Expand the step `Build Tauri bundle`. Look for Tauri log lines containing `Signing` or `Notarizing`. These confirm the signing chain activated.

Expand the step `Verify macOS signature and Gatekeeper status`. Expect:
```
target/release/bundle/macos/Parthenon Installer.app: valid on disk
target/release/bundle/macos/Parthenon Installer.app: satisfies its Designated Requirement
source=Notarized Developer ID
```

- [ ] **Step 4: Watch the Linux job logs**

Expand `Sign Linux packages with GPG`. Expect output like:
```
Signed: target/release/bundle/deb/parthenon-installer_0.1.0_amd64.deb
Signed: target/release/bundle/rpm/parthenon-installer-0.1.0-1.x86_64.rpm
Signed: target/release/bundle/appimage/Parthenon Installer_0.1.0_amd64.AppImage
```

- [ ] **Step 5: Download and verify the macOS artifact**

1. Download `parthenon-installer-macos-arm64` artifact zip from the run
2. Extract it
3. On your Mac, run:

```bash
cd ~/Downloads   # or wherever you extracted
codesign --verify --deep --strict --verbose=2 "Parthenon Installer.app"
spctl -a -vv "Parthenon Installer.app"
xcrun stapler validate "$(find . -name '*.dmg' | head -1)"
```

Expected:
```
Parthenon Installer.app: valid on disk
Parthenon Installer.app: satisfies its Designated Requirement
source=Notarized Developer ID
```

- [ ] **Step 6: Verify the Linux .asc signatures**

Download `parthenon-installer-linux-x64` artifact zip and extract it. Then:

```bash
# Import the public key
gpg --import /path/to/repo/SIGNING-KEY.asc

# Find the .deb and its signature
DEB=$(find . -name "*.deb" | head -1)
ASC=$(find . -name "*.deb.asc" | head -1)
gpg --verify "$ASC" "$DEB"
```

Expected: `gpg: Good signature from "Acumenus Data Sciences <releases@acumenus.net>"`

---

## Task 9: Azure Trusted Signing Setup (Windows — async)

This task can be started any time. The certificate profile activation (Step 3 of AZURE-SIGNING-HOWTO.md) takes 1–5 business days and gates everything else.

**No file changes. Follow AZURE-SIGNING-HOWTO.md.**

- [ ] **Step 1: Complete all steps in `AZURE-SIGNING-HOWTO.md`**

Work through Steps 1–8 of `AZURE-SIGNING-HOWTO.md`. After Step 3 (certificate profile creation), you will wait for Microsoft's identity verification before continuing.

- [ ] **Step 2: Wait for certificate profile to reach Active status**

In Azure portal: Trusted Signing Account → Certificate profiles → confirm status is `Active`.

- [ ] **Step 3: Add all seven Windows secrets to GitHub**

Per Step 8 of `AZURE-SIGNING-HOWTO.md`:

```
WINDOWS_TRUSTED_SIGNING_ENDPOINT
WINDOWS_TRUSTED_SIGNING_ACCOUNT
WINDOWS_TRUSTED_SIGNING_PROFILE
WINDOWS_TRUSTED_SIGNING_DESCRIPTION
AZURE_CLIENT_ID
AZURE_CLIENT_SECRET
AZURE_TENANT_ID
```

- [ ] **Step 4: Trigger a manual workflow run and watch the Windows job**

1. Open `https://github.com/sudoshi/Parthenon/actions/workflows/build-rust-installer-gui.yml`
2. Click `Run workflow` → `Run workflow`
3. Open the `Build windows-x64` job
4. Expand `Prepare Windows signing config` — confirm it runs (green, not skipped)
5. Expand `Build Tauri bundle` — look for signing output from `trusted-signing-cli`

- [ ] **Step 5: Download and verify the Windows artifact**

1. Download `parthenon-installer-windows-x64` artifact zip
2. Extract it
3. On a Windows machine, open PowerShell:

```powershell
$msi = Get-ChildItem -Filter "*.msi" | Select-Object -First 1
Get-AuthenticodeSignature $msi.FullName | Format-List
```

Expected `Status: Valid` and `SignerCertificate` showing Acumenus Data Sciences.

---

## Task 10: Test Release Asset Publishing (End-to-End)

Create a real GitHub Release (or a pre-release) and confirm all platform artifacts appear as permanent download links on the Releases page.

**No file changes.**

- [ ] **Step 1: Create a pre-release tag**

```bash
git tag v0.1.0-rc1
git push origin v0.1.0-rc1
```

- [ ] **Step 2: Create a GitHub pre-release from the tag**

1. Open `https://github.com/sudoshi/Parthenon/releases/new`
2. Choose tag `v0.1.0-rc1`
3. Check `Set as a pre-release`
4. Click `Publish release`

This triggers both `build-rust-installer-gui.yml` and `build-installer.yml`.

- [ ] **Step 3: Wait for both workflows to complete**

Monitor at `https://github.com/sudoshi/Parthenon/actions`. Both workflows should show green.

- [ ] **Step 4: Verify the release page assets**

Open `https://github.com/sudoshi/Parthenon/releases/tag/v0.1.0-rc1` and confirm these assets are present:

```
parthenon-community-bootstrap-*.tar.gz        ← from build-installer.yml
parthenon-community-bootstrap-*.tar.gz.sha256 ← from build-installer.yml
Parthenon-Installer-0.1.0-macos-arm64.dmg
Parthenon-Installer-0.1.0-macos-x64.dmg
Parthenon-Installer-0.1.0-windows-x64.msi     ← only if Azure secrets are set
Parthenon-Installer-0.1.0-linux-x64.deb
Parthenon-Installer-0.1.0-linux-x64.deb.asc
Parthenon-Installer-0.1.0-linux-x64.rpm
Parthenon-Installer-0.1.0-linux-x64.rpm.asc
Parthenon-Installer-0.1.0-linux-x64.AppImage
Parthenon-Installer-0.1.0-linux-x64.AppImage.asc
SIGNING-KEY.asc
```

- [ ] **Step 5: Click each download link and confirm it downloads**

Spot-check at least: both `.dmg` files, the `.deb`, and `SIGNING-KEY.asc`.

- [ ] **Step 6: Delete the pre-release when done testing**

```bash
gh release delete v0.1.0-rc1 --yes
git push origin --delete v0.1.0-rc1
git tag -d v0.1.0-rc1
```

---

## Self-Review Notes

**Spec coverage check:**
- Section 1 (CI bug fixes): covered by Tasks 2 and 3 ✓
- Section 2 (macOS .dmg): covered by Tasks 3 (if: fix activates signing), 6 (stapler), 7 (upload) ✓
- Section 3 (Windows Azure): covered by Task 9 ✓
- Section 4 (Linux GPG): covered by Tasks 1, 4 (rpm dep), 5 (signing step), 7 (upload) ✓
- Section 5 (release publishing): covered by Task 7 (upload steps) and Task 10 (E2E test) ✓

**Ternary fix:** The spec self-review flagged that GitHub Actions YAML doesn't support ternary in `if:` conditions. Task 2 resolves this by adding `artifact_arch` to the matrix, and Task 7 uses `${{ matrix.artifact_arch }}` directly. ✓

**SIGNING-KEY.asc path in Linux upload:** The upload step references `../../SIGNING-KEY.asc` from `working-directory: installer/rust-gui`. That resolves to the repo root. ✓

**Re-run safety:** All `gh release upload` calls use `--clobber`. ✓

**Unsigned guard:** The macOS upload step is gated on `env.APPLE_SIGNING_IDENTITY != ''`, which is only set when the cert prep step runs and finds the cert. If secrets are missing, no unsigned `.dmg` is uploaded. ✓
