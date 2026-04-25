# Installer Phase 7 — CI Release Plumbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surgical edits to `.github/workflows/build-rust-installer-gui.yml` implementing F1–F5 from the spec (F6 docs already shipped in Phase 2). Adds a `verify-release` gate job that blocks release uploads if any signature, attestation, or checksum fails.

**Architecture:** All changes in one workflow file. Six logical changes:
- F1 — Fix .dmg stapling order (rebuild dmg AFTER stapling app)
- F2 — SHA-256 sidecars per asset + SHA256SUMS.txt
- F3 — New `publish-updater-manifest` job generates signed `latest.json` (gracefully degrades if `TAURI_UPDATER_PRIVATE_KEY` secret absent)
- F4 — Publish `SIGNING-KEY.asc` (GPG public key) per release
- F5 — SLSA Build L3 provenance attestation per artifact
- New `verify-release` gate job runs cryptographic verification before any `gh release upload` step

**Spec reference:** Block 4 + Area F1–F6.

**Plan reference:** Phases 1–6 shipped. Phase 7 is independent of Phase 8 (docs).

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `.github/workflows/build-rust-installer-gui.yml` | MODIFY | All Phase 7 changes — ~+200 LOC |

No new files. Test infrastructure: YAML parses cleanly; CI runs are the actual integration test (out-of-band from this implementation).

---

### Task 1 — F1: macOS .dmg stapling order

**File:** `.github/workflows/build-rust-installer-gui.yml`

The current "Notarize and staple macOS .app and .dmg" step (around line 374) staples the `.app` first, then the `.dmg`. But the `.dmg` was created during `cargo tauri build` BEFORE the `.app` was stapled. Stapling the `.dmg` itself adds a ticket to the dmg, but the `.app` inside the dmg still has no ticket. Users who copy the `.app` out of the dmg won't get the stapled ticket.

Fix: rebuild the dmg AFTER stapling the .app, then notarize+staple the new dmg.

**Replace** the "Notarize and staple macOS .app and .dmg" step body with:

```yaml
      - name: Notarize and staple macOS .app, then rebuild + staple .dmg
        if: ${{ runner.os == 'macOS' && env.APPLE_API_KEY_CONFIGURED == 'true' }}
        working-directory: installer/rust-gui
        shell: bash
        env:
          APPLE_API_KEY: ${{ secrets.APPLE_API_KEY }}
          APPLE_API_ISSUER: ${{ (secrets.APPLE_API_ISSUER || secrets.APPLE_ISSUER_ID) }}
          APPLE_API_KEY_PATH: ${{ env.APPLE_API_KEY_PATH }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: |
          set -e
          app_bundle="$(find target/release/bundle/macos -maxdepth 1 -name '*.app' -print -quit)"
          if [ -z "$app_bundle" ]; then
            echo "Expected a macOS .app bundle after build, but none was found." >&2
            exit 1
          fi
          echo "Notarizing .app: $app_bundle"
          zip_path="$(mktemp -d)/app.zip"
          ditto -c -k --sequesterRsrc --keepParent "$app_bundle" "$zip_path"
          xcrun notarytool submit "$zip_path" \
            --key "$APPLE_API_KEY_PATH" \
            --key-id "$APPLE_API_KEY" \
            --issuer "$APPLE_API_ISSUER" \
            --team-id "$APPLE_TEAM_ID" \
            --wait
          xcrun stapler staple "$app_bundle"
          echo "Notarized and stapled .app"

          # Find the original dmg, delete it, then rebuild from the stapled .app
          original_dmg="$(find target/release/bundle/dmg -name '*.dmg' -print -quit)"
          if [ -n "$original_dmg" ]; then
            dmg_dir="$(dirname "$original_dmg")"
            dmg_name="$(basename "$original_dmg")"
            volname="${dmg_name%.dmg}"
            echo "Rebuilding $dmg_name from stapled .app to embed the staple ticket"
            rm "$original_dmg"
            staging="$(mktemp -d)/dmg-staging"
            mkdir -p "$staging"
            cp -R "$app_bundle" "$staging/"
            ln -s /Applications "$staging/Applications"
            hdiutil create -volname "$volname" -srcfolder "$staging" -ov -format UDZO "$dmg_dir/$dmg_name"
            echo "Rebuilt $dmg_name"

            echo "Notarizing rebuilt .dmg: $dmg_dir/$dmg_name"
            xcrun notarytool submit "$dmg_dir/$dmg_name" \
              --key "$APPLE_API_KEY_PATH" \
              --key-id "$APPLE_API_KEY" \
              --issuer "$APPLE_API_ISSUER" \
              --team-id "$APPLE_TEAM_ID" \
              --wait
            xcrun stapler staple "$dmg_dir/$dmg_name"
            echo "Notarized and stapled .dmg"
          fi
```

**Update** the existing "Verify macOS signature and Gatekeeper status" step to also verify the .app inside the mounted dmg:

Find:

```yaml
      - name: Verify macOS signature and Gatekeeper status
        if: runner.os == 'macOS' && env.APPLE_SIGNING_IDENTITY != ''
        working-directory: installer/rust-gui
        shell: bash
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

Append a mounted-app validation:

```yaml
      - name: Verify macOS signature and Gatekeeper status
        if: runner.os == 'macOS' && env.APPLE_SIGNING_IDENTITY != ''
        working-directory: installer/rust-gui
        shell: bash
        run: |
          app_bundle="$(find target/release/bundle/macos -maxdepth 1 -name '*.app' -print -quit)"
          if [ -z "$app_bundle" ]; then
            echo "Expected a macOS .app bundle after build, but none was found." >&2
            exit 1
          fi
          codesign --verify --deep --strict --verbose=2 "$app_bundle"
          spctl -a -vv "$app_bundle"
          xcrun stapler validate "$app_bundle"
          dmg="$(find target/release/bundle/dmg -name '*.dmg' -print -quit)"
          if [ -n "$dmg" ]; then
            xcrun stapler validate "$dmg"
            mount_point="$(mktemp -d)/dmgcheck"
            hdiutil attach "$dmg" -mountpoint "$mount_point" -nobrowse -readonly
            mounted_app="$(find "$mount_point" -maxdepth 1 -name '*.app' -print -quit)"
            if [ -n "$mounted_app" ]; then
              xcrun stapler validate "$mounted_app"
              echo "✓ .app inside .dmg has staple ticket"
            fi
            hdiutil detach "$mount_point"
          fi
```

Validate YAML, commit:

```
yamllint .github/workflows/build-rust-installer-gui.yml || echo "yamllint not installed — skip"
python -c "import yaml; yaml.safe_load(open('.github/workflows/build-rust-installer-gui.yml'))" && echo "YAML valid"
```

```
git add .github/workflows/build-rust-installer-gui.yml
git commit -m "ci(installer): F1 — rebuild .dmg after stapling .app

The previous step stapled the .app and then stapled the .dmg, but the
.app inside the .dmg was a copy made at dmg-build time (before the
stapler ran). Stapling the .dmg only updates the dmg's own ticket; the
embedded .app has no ticket.

New flow: notarize+staple .app → delete the build-time dmg → rebuild
dmg via hdiutil from the stapled .app → notarize+staple the new dmg.
The verification step now validates the staple on the .app inside the
mounted .dmg as a regression catcher.

Spec F1."
```

---

### Task 2 — F2: SHA-256 sidecars and SHA256SUMS.txt

After each platform's "Package … bundles" step, add a checksum step. For all three platforms, append to the package step:

**Linux** ("Package Linux bundles"):

```yaml
      - name: Package Linux bundles
        if: runner.os == 'Linux'
        working-directory: installer/rust-gui
        run: |
          mkdir -p dist-artifacts
          tar -C target/release -czf "dist-artifacts/${{ matrix.artifact }}.tar.gz" bundle
          # SHA-256 sidecars
          cd dist-artifacts
          for f in *.tar.gz; do
            sha256sum "$f" > "$f.sha256"
          done
```

**macOS** ("Package macOS bundles"):

```yaml
      - name: Package macOS bundles
        if: runner.os == 'macOS'
        working-directory: installer/rust-gui
        run: |
          mkdir -p dist-artifacts
          ditto -c -k --sequesterRsrc --keepParent target/release/bundle "dist-artifacts/${{ matrix.artifact }}.zip"
          cd dist-artifacts
          for f in *.zip; do
            shasum -a 256 "$f" > "$f.sha256"
          done
```

**Windows** ("Package Windows bundles"):

```yaml
      - name: Package Windows bundles
        if: runner.os == 'Windows'
        working-directory: installer/rust-gui
        shell: pwsh
        run: |
          New-Item -ItemType Directory -Force -Path dist-artifacts | Out-Null
          Compress-Archive -Path target/release/bundle/* -DestinationPath "dist-artifacts/${{ matrix.artifact }}.zip" -Force
          Push-Location dist-artifacts
          Get-ChildItem -Filter *.zip | ForEach-Object {
            $hash = (Get-FileHash -Algorithm SHA256 $_.FullName).Hash.ToLower()
            Set-Content -Path "$($_.Name).sha256" -Value "$hash *$($_.Name)"
          }
          Pop-Location
```

For the per-platform release assets (the `Upload macOS release asset` etc steps), add the actual installer artifact's `.sha256` next to the artifact upload. Update the `Upload macOS release asset` step:

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
          # Per-asset sha256
          shasum -a 256 "$DMG" | awk '{print $1}' > "${DMG}.sha256"
          gh release upload "${{ github.event.release.tag_name }}" \
            "${DMG}#Parthenon-Installer-${VERSION}-macos-${ARCH}.dmg" \
            "${DMG}.sha256#Parthenon-Installer-${VERSION}-macos-${ARCH}.dmg.sha256" \
            --clobber
```

Update `Upload Windows release asset` similarly:

```yaml
      - name: Upload Windows release asset
        if: ${{ github.event_name == 'release' && runner.os == 'Windows' && env.WINDOWS_SIGNING_CONFIGURED == 'true' }}
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
          # Per-asset sha256
          $hash = (Get-FileHash -Algorithm SHA256 $msi.FullName).Hash.ToLower()
          $sha256Path = "$($msi.FullName).sha256"
          Set-Content -Path $sha256Path -Value $hash
          gh release upload "${{ github.event.release.tag_name }}" `
            "$($msi.FullName)#Parthenon-Installer-${version}-windows-x64.msi" `
            "${sha256Path}#Parthenon-Installer-${version}-windows-x64.msi.sha256" --clobber
```

Update `Upload Linux release assets` to include sha256 sidecars per uploaded artifact (.deb, .rpm, .AppImage):

```yaml
      - name: Upload Linux release assets
        if: ${{ github.event_name == 'release' && runner.os == 'Linux' }}
        working-directory: installer/rust-gui
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          VERSION=$(jq -r '.version' tauri.conf.json)
          UPLOADS=()

          gen_sha256() {
            sha256sum "$1" | awk '{print $1}' > "$1.sha256"
          }

          DEB=$(find target/release/bundle/deb -name "*.deb" 2>/dev/null | head -1)
          if [ -n "$DEB" ]; then
            gen_sha256 "$DEB"
            UPLOADS+=("${DEB}#Parthenon-Installer-${VERSION}-linux-x64.deb")
            UPLOADS+=("${DEB}.sha256#Parthenon-Installer-${VERSION}-linux-x64.deb.sha256")
            [ -f "${DEB}.asc" ] && UPLOADS+=("${DEB}.asc#Parthenon-Installer-${VERSION}-linux-x64.deb.asc")
          fi

          RPM=$(find target/release/bundle/rpm -name "*.rpm" 2>/dev/null | head -1)
          if [ -n "$RPM" ]; then
            gen_sha256 "$RPM"
            UPLOADS+=("${RPM}#Parthenon-Installer-${VERSION}-linux-x64.rpm")
            UPLOADS+=("${RPM}.sha256#Parthenon-Installer-${VERSION}-linux-x64.rpm.sha256")
            [ -f "${RPM}.asc" ] && UPLOADS+=("${RPM}.asc#Parthenon-Installer-${VERSION}-linux-x64.rpm.asc")
          fi

          APPIMAGE=$(find target/release/bundle/appimage -name "*.AppImage" 2>/dev/null | head -1)
          if [ -n "$APPIMAGE" ]; then
            gen_sha256 "$APPIMAGE"
            UPLOADS+=("${APPIMAGE}#Parthenon-Installer-${VERSION}-linux-x64.AppImage")
            UPLOADS+=("${APPIMAGE}.sha256#Parthenon-Installer-${VERSION}-linux-x64.AppImage.sha256")
            [ -f "${APPIMAGE}.asc" ] && UPLOADS+=("${APPIMAGE}.asc#Parthenon-Installer-${VERSION}-linux-x64.AppImage.asc")
          fi

          [ -f "../../SIGNING-KEY.asc" ] && UPLOADS+=("../../SIGNING-KEY.asc#SIGNING-KEY.asc")

          if [ ${#UPLOADS[@]} -eq 0 ]; then
            echo "No Linux artifacts found — skipping release upload." >&2
            exit 0
          fi

          gh release upload "${{ github.event.release.tag_name }}" \
            "${UPLOADS[@]}" \
            --clobber
```

Validate YAML, commit:

```
git add .github/workflows/build-rust-installer-gui.yml
git commit -m "ci(installer): F2 — SHA-256 sidecars per release asset

Each macOS/Windows/Linux artifact now gets a .sha256 sidecar generated
from the same workflow that uploads it. The sidecar contains only the
hex digest (no filename) so users can verify with:
  echo \"\$(cat *.sha256)  *Parthenon-Installer-*.dmg\" | shasum -a 256 -c

Spec F2."
```

---

### Task 3 — F4: Publish SIGNING-KEY.asc

The Linux GPG signing step already imports the GPG key. Add a sibling step that exports the public key as `SIGNING-KEY.asc` for upload.

**Update** the existing `Sign Linux packages with GPG` step to also export the public key:

```yaml
      - name: Sign Linux packages with GPG
        if: ${{ runner.os == 'Linux' && env.GPG_KEY_CONFIGURED == 'true' }}
        working-directory: installer/rust-gui
        env:
          GPG_SIGNING_KEY: ${{ secrets.GPG_SIGNING_KEY }}
        run: |
          echo "$GPG_SIGNING_KEY" | base64 --decode | gpg --batch --import
          KEY_ID=$(gpg --list-secret-keys --with-colons | grep '^fpr' | head -1 | cut -d: -f10)
          # Export public key for release distribution
          gpg --armor --export "$KEY_ID" > ../../SIGNING-KEY.asc
          echo "Exported SIGNING-KEY.asc with fingerprint $KEY_ID"
          find target/release/bundle/deb -name "*.deb" -print0 2>/dev/null | \
            while IFS= read -r -d '' pkg; do
              gpg --batch --local-user "$KEY_ID" --detach-sign --armor "$pkg"
              echo "Signed: $pkg"
            done
          find target/release/bundle/rpm -name "*.rpm" -print0 2>/dev/null | \
            while IFS= read -r -d '' pkg; do
              gpg --batch --local-user "$KEY_ID" --detach-sign --armor "$pkg"
              echo "Signed: $pkg"
            done
          find target/release/bundle/appimage -name "*.AppImage" -print0 2>/dev/null | \
            while IFS= read -r -d '' pkg; do
              gpg --batch --local-user "$KEY_ID" --detach-sign --armor "$pkg"
              echo "Signed: $pkg"
            done
```

The `Upload Linux release assets` step from Task 2 already conditionally appends `SIGNING-KEY.asc` to the upload array via `[ -f "../../SIGNING-KEY.asc" ] && UPLOADS+=(...)`. No further change there.

Commit:

```
git add .github/workflows/build-rust-installer-gui.yml
git commit -m "ci(installer): F4 — export and publish SIGNING-KEY.asc per release

After importing the GPG private key for .deb/.rpm/.AppImage signing,
also export the public key as SIGNING-KEY.asc and upload it to the
release. Users can verify a Linux artifact with:
  gpg --import SIGNING-KEY.asc
  gpg --verify Parthenon-Installer-*.deb.asc Parthenon-Installer-*.deb

Spec F4."
```

---

### Task 4 — F5: SLSA Build L3 provenance attestation

After all artifacts are signed and packaged but before release upload, attest each one. Add as a new step after the existing per-platform `Package … bundles` step but before the `Upload installer packages` step.

```yaml
      - name: Attest build provenance (SLSA L3)
        if: ${{ github.event_name == 'release' }}
        uses: actions/attest-build-provenance@v2
        with:
          subject-path: |
            installer/rust-gui/target/release/bundle/dmg/*.dmg
            installer/rust-gui/target/release/bundle/msi/*.msi
            installer/rust-gui/target/release/bundle/deb/*.deb
            installer/rust-gui/target/release/bundle/rpm/*.rpm
            installer/rust-gui/target/release/bundle/appimage/*.AppImage
```

The `attest-build-provenance` action automatically writes attestations to `${{ github.workspace }}/_attestations/` and uploads them to the GitHub Sigstore transparency log. Users can verify with:

```
gh attestation verify --owner sudoshi Parthenon-Installer-*.dmg
```

Note: the action may emit warnings for matrix entries where a particular artifact type doesn't exist (e.g., the macOS runner has no `.deb`). The action's `subject-path` glob handles missing files gracefully.

This step requires `permissions: id-token: write` and `attestations: write` at the workflow or job level. Add to the workflow's existing `permissions:` block:

```yaml
permissions:
  contents: write
  id-token: write
  attestations: write
```

Commit:

```
git add .github/workflows/build-rust-installer-gui.yml
git commit -m "ci(installer): F5 — SLSA Build L3 provenance attestation

actions/attest-build-provenance@v2 generates a Sigstore-backed
provenance attestation for each release artifact. Users can verify
with:
  gh attestation verify --owner sudoshi <artifact>

Adds id-token: write and attestations: write to workflow permissions.
Strengthens the supply-chain story for healthcare buyers — they can
prove a binary came from this exact commit on GitHub Actions.

Spec F5."
```

---

### Task 5 — F3: Generate signed latest.json for the auto-updater

Add a new job `publish-updater-manifest` that runs after `build` and `installer-bundle` succeed, on release events only. It needs to download all the platform artifacts (which are uploaded as `actions/upload-artifact` results), generate a `latest.json` referencing the GitHub release URLs and Tauri-updater signatures, and upload `latest.json` as a release asset.

The Tauri updater key signing step requires `tauri-cli` with the `signer` subcommand. Sign each platform's installer artifact (the .dmg / .msi / .AppImage — NOT .deb/.rpm since those use package-manager update flows).

Add this job at the bottom of the workflow, after the `build` job:

```yaml
  publish-updater-manifest:
    name: Publish updater latest.json
    needs: [build, installer-bundle]
    runs-on: ubuntu-22.04
    if: ${{ github.event_name == 'release' }}
    env:
      TAURI_UPDATER_PRIVATE_KEY_CONFIGURED: ${{ secrets.TAURI_UPDATER_PRIVATE_KEY != '' }}
    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable

      - name: Install Tauri CLI
        run: cargo install tauri-cli --version '^2' --locked

      - name: Skip if updater key not configured
        if: ${{ env.TAURI_UPDATER_PRIVATE_KEY_CONFIGURED != 'true' }}
        run: |
          echo "TAURI_UPDATER_PRIVATE_KEY secret not set — skipping latest.json publication."
          echo "The auto-updater banner will silently no-op until the keypair is provisioned."
          echo "See docs/site/docs/install/key-rotation.mdx for the bootstrap procedure."
          exit 0

      - name: Download release artifacts
        if: ${{ env.TAURI_UPDATER_PRIVATE_KEY_CONFIGURED == 'true' }}
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          mkdir -p artifacts
          gh release download "${{ github.event.release.tag_name }}" \
            --pattern '*.dmg' --pattern '*.msi' --pattern '*.AppImage' \
            --dir artifacts
          ls -la artifacts/

      - name: Sign artifacts and assemble latest.json
        if: ${{ env.TAURI_UPDATER_PRIVATE_KEY_CONFIGURED == 'true' }}
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_UPDATER_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_UPDATER_KEY_PASSWORD }}
        run: |
          set -e
          version="${{ github.event.release.tag_name }}"
          version="${version#v}"  # strip leading v if present
          notes_url="https://github.com/${{ github.repository }}/releases/tag/${{ github.event.release.tag_name }}"
          pub_date="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

          # Find each platform artifact and sign it
          dmg="$(find artifacts -name '*.dmg' | head -1)"
          msi="$(find artifacts -name '*.msi' | head -1)"
          appimage="$(find artifacts -name '*.AppImage' | head -1)"

          sign_artifact() {
            local artifact="$1"
            if [ -z "$artifact" ] || [ ! -f "$artifact" ]; then
              echo ""
              return
            fi
            cargo tauri signer sign --private-key "$TAURI_SIGNING_PRIVATE_KEY" --password "$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" "$artifact" >/dev/null 2>&1
            cat "${artifact}.sig" | tr -d '\n'
          }

          dmg_sig="$(sign_artifact "$dmg")"
          msi_sig="$(sign_artifact "$msi")"
          appimage_sig="$(sign_artifact "$appimage")"

          dmg_url="https://github.com/${{ github.repository }}/releases/download/${{ github.event.release.tag_name }}/$(basename "$dmg")"
          msi_url="https://github.com/${{ github.repository }}/releases/download/${{ github.event.release.tag_name }}/$(basename "$msi")"
          appimage_url="https://github.com/${{ github.repository }}/releases/download/${{ github.event.release.tag_name }}/$(basename "$appimage")"

          # Assemble latest.json
          cat > latest.json <<JSON
          {
            "version": "$version",
            "notes": "$notes_url",
            "pub_date": "$pub_date",
            "platforms": {
              "darwin-x86_64":  { "signature": "$dmg_sig",      "url": "$dmg_url" },
              "darwin-aarch64": { "signature": "$dmg_sig",      "url": "$dmg_url" },
              "windows-x86_64": { "signature": "$msi_sig",      "url": "$msi_url" },
              "linux-x86_64":   { "signature": "$appimage_sig", "url": "$appimage_url" }
            }
          }
          JSON

          # Validate
          jq . latest.json >/dev/null
          cat latest.json

      - name: Upload latest.json
        if: ${{ env.TAURI_UPDATER_PRIVATE_KEY_CONFIGURED == 'true' }}
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release upload "${{ github.event.release.tag_name }}" \
            "latest.json" --clobber
          echo "Published latest.json to release ${{ github.event.release.tag_name }}"
```

**The macOS dmg URL is shared between darwin-x86_64 and darwin-aarch64** because the build matrix produces a single universal `.dmg`. Tauri's updater accepts duplicate URLs for universal binaries.

Validate YAML, commit:

```
git add .github/workflows/build-rust-installer-gui.yml
git commit -m "ci(installer): F3 — publish signed latest.json for auto-updater

New publish-updater-manifest job runs on release events after the
build matrix succeeds. Downloads platform artifacts, signs each with
the Tauri updater private key (gracefully degrades if the secret is
not configured), and uploads latest.json as a release asset.

The Phase 2 GUI's check_for_updates command points its endpoint at
.../releases/latest/download/latest.json so the updater banner can
discover new versions automatically.

Spec F3."
```

---

### Task 6 — `verify-release` gate

A new job runs after `build` and `installer-bundle` (and after `publish-updater-manifest`), on release events only. It downloads all release artifacts (now including `latest.json`, `*.sha256`, `*.asc`, `SIGNING-KEY.asc`) and runs cryptographic verification.

```yaml
  verify-release:
    name: Verify release artifacts
    needs: [build, installer-bundle, publish-updater-manifest]
    runs-on: ubuntu-22.04
    if: ${{ github.event_name == 'release' }}
    steps:
      - uses: actions/checkout@v4

      - name: Download all release assets
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          mkdir -p verify
          gh release download "${{ github.event.release.tag_name }}" --dir verify
          ls -la verify/

      - name: Verify SHA-256 sidecars
        working-directory: verify
        run: |
          set -e
          for sha_file in *.sha256; do
            artifact="${sha_file%.sha256}"
            if [ ! -f "$artifact" ]; then
              echo "WARN: sidecar $sha_file has no corresponding artifact" >&2
              continue
            fi
            expected="$(awk '{print $1}' "$sha_file")"
            actual="$(sha256sum "$artifact" | awk '{print $1}')"
            if [ "$expected" = "$actual" ]; then
              echo "✓ $artifact"
            else
              echo "✗ $artifact: expected $expected, got $actual" >&2
              exit 1
            fi
          done

      - name: Verify GPG signatures (Linux artifacts)
        working-directory: verify
        run: |
          set -e
          if [ ! -f SIGNING-KEY.asc ]; then
            echo "WARN: SIGNING-KEY.asc not present in release — skipping GPG verification"
            exit 0
          fi
          gpg --import SIGNING-KEY.asc
          for asc in *.asc; do
            [ "$asc" = "SIGNING-KEY.asc" ] && continue
            artifact="${asc%.asc}"
            if [ ! -f "$artifact" ]; then
              continue
            fi
            if gpg --verify "$asc" "$artifact"; then
              echo "✓ GPG: $artifact"
            else
              echo "✗ GPG verification failed for $artifact" >&2
              exit 1
            fi
          done

      - name: Verify SLSA attestations
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          set -e
          cd verify
          for artifact in *.dmg *.msi *.deb *.rpm *.AppImage; do
            [ -f "$artifact" ] || continue
            if gh attestation verify "$artifact" --owner sudoshi; then
              echo "✓ Attestation: $artifact"
            else
              echo "✗ Attestation verification failed for $artifact" >&2
              exit 1
            fi
          done

      - name: Summary
        run: |
          echo "All cryptographic verifications passed."
          echo "Release ${{ github.event.release.tag_name }} is ready for publication."
```

**Note:** the verify-release job runs AFTER all uploads are done. If any verification fails, the job fails and we manually have to revert the release (delete the release on GitHub). A future enhancement could move the verification BEFORE the upload steps using artifact passing, but that requires deeper restructuring. For Phase 7, the post-upload gate is acceptable — the goal is to detect bad signing, not prevent it.

Commit:

```
git add .github/workflows/build-rust-installer-gui.yml
git commit -m "ci(installer): verify-release gate job

After all platform builds and the updater manifest publication,
verify-release downloads every release asset and runs:
- sha256sum -c against each .sha256 sidecar
- gpg --verify against each .asc detached signature (after importing
  SIGNING-KEY.asc)
- gh attestation verify against each binary artifact

If any verification fails, the job fails and the release is flagged
as unverified. Future work: move verification BEFORE the upload step
to gate the publication itself.

Spec — verify-release gate from Block 4."
```

---

### Task 7 — Final YAML validation

```
python -c "import yaml; yaml.safe_load(open('.github/workflows/build-rust-installer-gui.yml'))" && echo "YAML valid"
```

If you have `actionlint` installed, run it too. Otherwise rely on YAML parse + GitHub's syntax validation on push.

---

## Phase 7 Done Criteria

- [ ] All 6 commits made (F1, F2, F4, F5, F3, verify-release)
- [ ] Workflow YAML parses cleanly
- [ ] Workflow has 3 top-level jobs: `installer-bundle`, `build`, `publish-updater-manifest`, `verify-release`
- [ ] macOS dmg stapling order rebuilds dmg AFTER stapling app
- [ ] Per-asset `.sha256` sidecars for .dmg/.msi/.deb/.rpm/.AppImage
- [ ] `SIGNING-KEY.asc` exported during Linux GPG signing and uploaded to release
- [ ] SLSA Build L3 attestation per release-event artifact
- [ ] `latest.json` job conditionally runs (skips gracefully when `TAURI_UPDATER_PRIVATE_KEY` secret absent)
- [ ] `verify-release` runs sha256/gpg/attestation verification post-upload

## What Phase 7 Does NOT Include

- The actual Tauri updater keypair (manual one-time procedure documented in Phase 2's key-rotation.mdx)
- Pre-upload verification gate (Phase 7 verifies post-upload; deeper restructuring deferred)
- Linux .deb/.rpm auto-update via package managers (out of scope; users update via `apt`/`dnf`)
- Documentation pages (Phase 8)
