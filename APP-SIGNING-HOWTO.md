# App Signing How-To

This file is the step-by-step operator guide for setting up trusted macOS
signing and notarization for the Parthenon Rust installer GUI in this repo.

Repo context:

- Rust app: `installer/rust-gui`
- CI workflow: `.github/workflows/build-rust-installer-gui.yml`
- Current product name: `Parthenon Installer`
- Current bundle identifier: `io.acumenus.parthenon.installer`

This guide is for the macOS signing path. The Windows MSI signing strategy is
documented in `docs/handoffs/2026-04-21-rust-installer-trusted-signing-handoff.md`.

## What You Are Setting Up

For a trusted outside-the-App-Store macOS release, this project needs:

1. A `Developer ID Application` certificate to sign the app.
2. An App Store Connect `team` API key for notarization.
3. GitHub repository secrets containing those signing assets.
4. A workflow run of `Rust Installer GUI Packages`.

Important:

- Use `Developer ID Application`, not `Developer ID Installer`, for the current
  Tauri app bundle path.
- Use a `team` App Store Connect API key, not an `individual` key.

## Before You Start

You need:

- a Mac with Keychain Access
- an Apple Developer Program membership
- access to the Acumenus Apple developer team
- access to this GitHub repository's Actions secrets

Recommended Apple roles:

- Apple Developer Account Holder to request App Store Connect API access
- Account Holder or Admin to generate the App Store Connect team API key
- Account Holder to create the `Developer ID Application` certificate

## Step 1: Request App Store Connect API Access

Do this once per Apple team.

1. Open `https://appstoreconnect.apple.com/`.
2. Go to `Users and Access`.
3. Open `Integrations`.
4. Select `App Store Connect API`.
5. Click `Request Access`.
6. Accept the terms and submit the request.

Notes:

- Apple says this request must be made by the `Account Holder`.
- Approval may not be instantaneous.

## Step 2: Create the App Store Connect Team API Key

Do this after API access is approved.

1. Stay in `https://appstoreconnect.apple.com/`.
2. Go to `Users and Access`.
3. Open `Integrations`.
4. Select `App Store Connect API`.
5. Open the `Team Keys` tab.
6. Click `Generate API Key`.
7. Name it something clear, for example `Parthenon Notarization`.
8. Choose an access role.
9. Click `Generate`.
10. Download the `.p8` file immediately.

Record these values now:

- `Key ID`
- `Issuer ID`
- downloaded `.p8` file

Notes:

- The `.p8` file can only be downloaded once.
- `Developer` is usually the minimum reasonable role for notarization.
- Do not use an `individual` API key. Apple documents that individual keys
  cannot be used with `notarytool`.

## Step 3: Find the Apple Team ID

You will need the Team ID for some fallback/manual tooling.

1. Open `https://developer.apple.com/account/`.
2. Go to `Membership`.
3. Copy the `Team ID`.

Keep it in your operator notes even if the preferred CI path uses the App Store
Connect API key instead of Apple ID credentials.

## Step 4: Create a Certificate Signing Request on Your Mac

Do this on the Mac that will hold the private key before export.

1. Open `Keychain Access`.
2. In the top macOS menu bar, click `Keychain Access`.
3. Open `Certificate Assistant`.
4. Click `Request a Certificate from a Certificate Authority`.
5. Enter your email address.
6. Enter a common name such as `Acumenus Developer ID`.
7. Leave the CA email field blank.
8. Select `Saved to disk`.
9. Click `Continue`.
10. Save the `.certSigningRequest` file somewhere convenient.

Result:

- you now have a CSR file
- Keychain Access also created the matching private key in your keychain

## Step 5: Create the Developer ID Application Certificate

1. Open `https://developer.apple.com/account/resources/certificates/list`.
2. In `Certificates, Identifiers & Profiles`, click `Certificates`.
3. Click the `+` button.
4. Under `Software`, choose `Developer ID`.
5. Choose `Developer ID Application`.
6. Click `Continue`.
7. Upload the `.certSigningRequest` file you created in Step 4.
8. Click `Continue`.
9. Download the resulting `.cer` file.

Important:

- Do not choose `Developer ID Installer` unless you later switch to shipping a
  flat `.pkg`.

## Step 6: Install the Certificate into Keychain Access

1. Find the downloaded `.cer` file.
2. Double-click it.
3. Confirm it opens in `Keychain Access`.
4. In `Keychain Access`, open `login` keychain.
5. Open `My Certificates`.
6. Confirm you now see a `Developer ID Application` certificate with a private
   key nested under it.

If you do not see the private key attached, stop there. The export in the next
step will not work correctly without the matching private key.

## Step 7: Export the Signing Certificate as a `.p12`

1. In `Keychain Access`, under `login` -> `My Certificates`, find the
   `Developer ID Application` certificate you just installed.
2. Right-click it.
3. Click `Export`.
4. Save it as a `.p12` file.
5. Set a strong export password.
6. Store the `.p12` securely.

You now have:

- the signing certificate plus private key in `.p12` form
- the `.p12` password

## Step 8: Convert the Signing Certificate for GitHub Secrets

The workflow expects the `.p12` as base64 in the `APPLE_CERTIFICATE` secret.

On your Mac, run:

```bash
base64 < /path/to/DeveloperIDApplication.p12
```

If you want to copy it straight to clipboard on macOS:

```bash
base64 < /path/to/DeveloperIDApplication.p12 | pbcopy
```

Save or paste this output carefully. This full base64 string becomes the value
for `APPLE_CERTIFICATE`.

## Step 9: Prepare the Exact GitHub Secret Values

Populate these repository secrets in GitHub:

### Required for the preferred notarization path

- `APPLE_API_KEY`
  - value: the App Store Connect `Key ID`
- `APPLE_API_ISSUER`
  - value: the App Store Connect `Issuer ID`
- `APPLE_API_KEY_P8`
  - value: the full contents of the downloaded `.p8` file
- `APPLE_CERTIFICATE`
  - value: the full base64 output of the exported `.p12`
- `APPLE_CERTIFICATE_PASSWORD`
  - value: the password you set when exporting the `.p12`

### Optional fallback path

Only use this if you want Apple ID based notarization instead of the API key:

- `APPLE_ID`
- `APPLE_PASSWORD`
  - this must be an Apple app-specific password, not your normal Apple password
- `APPLE_TEAM_ID`

The workflow accepts either:

- API key path: `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_P8`
- Apple ID path: `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`

The API key path is preferred.

## Step 10: Add the Secrets to GitHub

1. Open the GitHub repository.
2. Go to `Settings`.
3. Go to `Secrets and variables`.
4. Open `Actions`.
5. Add each secret from Step 9.

Add exactly these names:

```text
APPLE_API_KEY
APPLE_API_ISSUER
APPLE_API_KEY_P8
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
```

Optional fallback:

```text
APPLE_ID
APPLE_PASSWORD
APPLE_TEAM_ID
```

## Step 11: Run the Signing Workflow

1. Open the repository `Actions` tab.
2. Open `Rust Installer GUI Packages`.
3. Click `Run workflow`.
4. Choose the ref you want to sign, normally `main`.
5. Start the run.

What the workflow now does on macOS:

- validates notarization credential presence when `APPLE_CERTIFICATE` exists
- imports the `.p12` into a temporary keychain
- finds the `Developer ID Application` identity
- writes the App Store Connect `.p8` key to a temp file when using the API-key path
- runs `cargo tauri build`
- verifies the signature with `codesign`
- checks Gatekeeper acceptance with `spctl`

## Step 12: Download and Inspect the macOS Artifacts

After the workflow finishes:

1. Open the workflow run summary.
2. Download the artifact:
   - `parthenon-installer-macos-x64`
   - `parthenon-installer-macos-arm64`
3. Extract the zip.
4. Locate the `.app` or packaged macOS bundle output.

## Step 13: Verify the Signed Build on a Mac

Run these checks locally on a Mac against the produced app:

```bash
codesign --verify --deep --strict --verbose=2 "Parthenon Installer.app"
spctl -a -vv "Parthenon Installer.app"
xcrun stapler validate "Parthenon Installer.app"
```

If you later distribute a DMG, validate that too:

```bash
xcrun stapler validate Parthenon-Installer.dmg
```

What you want to see:

- `codesign` verification passes
- `spctl` recognizes the app as signed and acceptable to Gatekeeper
- `stapler validate` confirms the notarization ticket path

## Step 14: Do a Clean-Machine Launch Test

Before you call the app "trusted", test on a Mac that has not previously
whitelisted the app.

1. Download the artifact fresh.
2. Open it normally, not via right-click override.
3. Confirm Gatekeeper shows Acumenus as the identified developer.
4. Confirm the app opens without the "cannot be opened because Apple cannot
   check it for malicious software" class of error.

## Common Mistakes

- Using `Developer ID Installer` instead of `Developer ID Application`
- Using an `individual` App Store Connect API key instead of a `team` key
- Losing the `.p8` file after generation
- Exporting the `.cer` without the private key attached
- Putting only the path to the `.p8` file into GitHub instead of the file
  contents
- Forgetting to base64-encode the `.p12`
- Using a normal Apple password instead of an app-specific password for the
  fallback Apple ID path

## Expected Secret-to-Repo Mapping

This repo's workflow expects:

- signing workflow: `.github/workflows/build-rust-installer-gui.yml`
- macOS packaging project: `installer/rust-gui`
- certificate secret: `APPLE_CERTIFICATE`
- certificate password secret: `APPLE_CERTIFICATE_PASSWORD`
- notarization API secrets: `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_P8`

## References

- App Store Connect API setup:
  `https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api`
- App Store Connect API key types and limitations:
  `https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api`
- Developer ID certificate creation:
  `https://developer.apple.com/help/account/create-certificates/create-developer-id-certificates/`
- CSR creation:
  `https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request`
- Notary API:
  `https://developer.apple.com/documentation/NotaryAPI/submitting-software-for-notarization-over-the-web`
- notarytool credential migration:
  `https://developer.apple.com/documentation/technotes/tn3147-migrating-to-the-latest-notarization-tool`
