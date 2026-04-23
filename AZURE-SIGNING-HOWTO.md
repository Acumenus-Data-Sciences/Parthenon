# Azure Trusted Signing How-To

This file is the step-by-step operator guide for setting up Windows MSI
signing via Azure Trusted Signing for the Parthenon Rust installer GUI.

Repo context:

- Rust app: `installer/rust-gui`
- CI workflow: `.github/workflows/build-rust-installer-gui.yml`
- Design spec: `docs/superpowers/specs/2026-04-23-signed-release-packaging-design.md`
- macOS signing guide: `APP-SIGNING-HOWTO.md`

## What You Are Setting Up

For a trusted Windows release, this project needs:

1. An Azure Trusted Signing account with a `PublicTrust` certificate profile.
2. An Azure App Registration (service principal) that CI uses to authenticate.
3. The `Trusted Signing Certificate Profile Signer` RBAC role assigned to that
   service principal.
4. GitHub repository secrets containing those credentials.
5. A workflow run of `Rust Installer GUI Packages`.

The result is a signed `.msi` that shows `Verified publisher: Acumenus Data
Sciences` in the Windows UAC prompt. SmartScreen reputation starts at zero and
builds over time with real user downloads — this is expected behavior for any
new signed binary.

## Before You Start

You need:

- an Azure subscription (pay-as-you-go is fine; signing costs are per-signature)
- Owner or Contributor access to the Azure subscription or resource group
- access to Azure Active Directory to create App Registrations
- access to this GitHub repository's Actions secrets

## Step 1: Create a Resource Group

A resource group is a logical container for your Azure resources.

1. Open `https://portal.azure.com/`.
2. Search for `Resource groups` in the top search bar.
3. Click `Create`.
4. Choose your subscription.
5. Enter a name, for example `parthenon-signing`.
6. Choose a region close to you. East US (`eastus`) is a good default.
7. Click `Review + Create`, then `Create`.

Note the region you chose. Your signing endpoint URL will be based on it.

## Step 2: Create a Trusted Signing Account

1. In the Azure portal, search for `Trusted Signing` in the top search bar.
2. Click `Trusted Signing Accounts`.
3. Click `Create`.
4. Select your subscription and the resource group from Step 1.
5. Enter an account name, for example `acumenus-signing`.
   - The name must be globally unique across Azure.
   - Use lowercase letters, numbers, and hyphens only.
6. Select the same region as Step 1.
7. Leave SKU as `Basic` unless you need higher signing throughput.
8. Click `Review + Create`, then `Create`.

After creation, open the account and note:

- The **endpoint URL** shown in the account overview.
  It follows the pattern `https://{accountname}.{region}.codesigning.azure.net`.
  Example: `https://acumenus-signing.eastus.codesigning.azure.net`

This is the value for `WINDOWS_TRUSTED_SIGNING_ENDPOINT`.

## Step 3: Create a Certificate Profile

The certificate profile holds your signing identity and determines the trust
level. Use `PublicTrust` for public software distribution.

1. Inside your Trusted Signing Account, click `Certificate profiles` in the
   left sidebar.
2. Click `Add`.
3. Enter a profile name, for example `ParthenonInstaller`.
4. Select `Public Trust` as the profile type.
5. Click `Add`.

Microsoft will now verify your organization's identity. This is a manual
review process and typically takes **1 to 5 business days**. You will receive
an email when verification is complete. You cannot sign anything until the
profile reaches `Active` status.

What Microsoft verifies:

- That your organization legally exists (business registration)
- That you control the email domain used in the account
- That the signer has authority to act on behalf of the organization

Keep the profile name you chose. This is the value for
`WINDOWS_TRUSTED_SIGNING_PROFILE`.

## Step 4: Create an App Registration

The App Registration is the service principal that CI authenticates as.

1. In the Azure portal, search for `App registrations`.
2. Click `New registration`.
3. Enter a name, for example `parthenon-ci-signer`.
4. Leave `Supported account types` as `Accounts in this organizational
   directory only`.
5. Leave `Redirect URI` blank.
6. Click `Register`.

After creation, note these two values from the App Registration overview page:

- **Application (client) ID** — this is `AZURE_CLIENT_ID`
- **Directory (tenant) ID** — this is `AZURE_TENANT_ID`

## Step 5: Generate a Client Secret

The client secret is the password CI uses to authenticate as the App
Registration.

1. Inside the App Registration, click `Certificates & secrets` in the left
   sidebar.
2. Open the `Client secrets` tab.
3. Click `New client secret`.
4. Enter a description, for example `GitHub Actions`.
5. Choose an expiry period. `24 months` is a reasonable default. Set a calendar
   reminder to rotate it before it expires.
6. Click `Add`.
7. **Copy the secret value immediately.** The portal will never show it again.

This value is `AZURE_CLIENT_SECRET`.

## Step 6: Assign the Signing Role

The App Registration needs permission to sign using your certificate profile.

1. In the Azure portal, navigate to your Trusted Signing Account from Step 2.
2. Click `Access control (IAM)` in the left sidebar.
3. Click `Add` → `Add role assignment`.
4. In the `Role` tab, search for `Trusted Signing Certificate Profile Signer`.
5. Select that role and click `Next`.
6. In the `Members` tab, choose `User, group, or service principal`.
7. Click `Select members`.
8. Search for the App Registration name from Step 4, for example
   `parthenon-ci-signer`.
9. Select it and click `Select`.
10. Click `Review + assign`, then `Assign`.

The role assignment takes effect within a few minutes.

## Step 7: Prepare the GitHub Secret Values

You now have all the values needed. Record them:

- `WINDOWS_TRUSTED_SIGNING_ENDPOINT`
  - The endpoint URL from Step 2.
  - Example: `https://acumenus-signing.eastus.codesigning.azure.net`
- `WINDOWS_TRUSTED_SIGNING_ACCOUNT`
  - The Trusted Signing account name from Step 2.
  - Example: `acumenus-signing`
- `WINDOWS_TRUSTED_SIGNING_PROFILE`
  - The certificate profile name from Step 3.
  - Example: `ParthenonInstaller`
- `WINDOWS_TRUSTED_SIGNING_DESCRIPTION`
  - The publisher name shown in the Windows UAC prompt.
  - Use: `Acumenus Data Sciences`
- `AZURE_CLIENT_ID`
  - The Application (client) ID from Step 4.
- `AZURE_CLIENT_SECRET`
  - The client secret value from Step 5.
- `AZURE_TENANT_ID`
  - The Directory (tenant) ID from Step 4.

## Step 8: Add the Secrets to GitHub

1. Open the GitHub repository.
2. Go to `Settings`.
3. Go to `Secrets and variables`.
4. Open `Actions`.
5. Add each secret from Step 7.

Add exactly these names:

```text
WINDOWS_TRUSTED_SIGNING_ENDPOINT
WINDOWS_TRUSTED_SIGNING_ACCOUNT
WINDOWS_TRUSTED_SIGNING_PROFILE
WINDOWS_TRUSTED_SIGNING_DESCRIPTION
AZURE_CLIENT_ID
AZURE_CLIENT_SECRET
AZURE_TENANT_ID
```

## Step 9: Wait for Certificate Profile Activation

Do not proceed until the certificate profile in Step 3 shows `Active` status.

To check:

1. Open the Azure portal.
2. Navigate to your Trusted Signing Account.
3. Click `Certificate profiles`.
4. Confirm the profile status is `Active`.

If it still shows `Pending`, Microsoft has not yet completed identity
verification. Check your email for any requests for additional documentation.

## Step 10: Run the Signing Workflow

Once the certificate profile is `Active`:

1. Open the repository `Actions` tab.
2. Open `Rust Installer GUI Packages`.
3. Click `Run workflow`.
4. Choose the ref you want to sign, normally `main`.
5. Start the run.

What the workflow does on Windows:

- validates that all seven signing secrets are present
- installs `trusted-signing-cli` via Cargo
- writes `tauri.windows.conf.json` with the `signCommand` pointing at your
  endpoint, account, and profile
- runs `cargo tauri build`, which calls the `signCommand` after producing the
  `.msi`
- `trusted-signing-cli` authenticates to Azure using the service principal
  credentials and submits the `.msi` for signing

## Step 11: Download and Inspect the Windows Artifacts

After the workflow finishes:

1. Open the workflow run summary.
2. Download the artifact: `parthenon-installer-windows-x64`
3. Extract the zip.
4. Locate the `.msi` file.

## Step 12: Verify the Signed MSI on a Windows Machine

Run these checks in PowerShell:

```powershell
# Check the Authenticode signature
Get-AuthenticodeSignature .\Parthenon-Installer.msi | Format-List

# Verify using signtool (requires Windows SDK)
signtool verify /pa /v .\Parthenon-Installer.msi
```

What you want to see from `Get-AuthenticodeSignature`:

```
Status          : Valid
SignerCertificate : [certificate details showing Acumenus Data Sciences]
TimeStamperCertificate : [timestamp authority details]
```

A `Status` of `Valid` confirms the MSI is properly signed and timestamped.

## Step 13: Do a Clean-Machine Install Test

Before calling the MSI "trusted", test on a Windows machine that has not
previously installed this software.

1. Download the MSI fresh.
2. Double-click it to run the installer.
3. When the UAC prompt appears, confirm it shows:
   `Verified publisher: Acumenus Data Sciences`
4. Proceed through the installer.
5. Confirm the application launches correctly.

Note: a SmartScreen warning (`Windows protected your PC`) may still appear for
early downloads. This is expected. Click `More info` → `Run anyway` to
proceed. The warning text will show the verified publisher name, not `Unknown
publisher`. The warning disappears as download reputation builds.

## Secret Rotation

The client secret from Step 5 expires on the date you chose. Before it
expires:

1. Generate a new client secret (Step 5).
2. Update the `AZURE_CLIENT_SECRET` GitHub secret.
3. Delete the old client secret from the App Registration.

Set a calendar reminder for 30 days before expiry.

## Common Mistakes

- Choosing `Private Trust` instead of `Public Trust` for the certificate
  profile — private trust certificates are not recognized by Windows for
  public software
- Assigning the role to the wrong resource (subscription level instead of
  the Trusted Signing Account) — the role must be assigned on the Trusted
  Signing Account, not at subscription or resource group level
- Using the account name as the endpoint (the endpoint is the full URL, not
  just the name)
- Copying the client secret ID instead of the client secret value — the
  portal shows both; you need the `Value` column, not the `Secret ID` column
- Running the workflow before the certificate profile reaches `Active` status
  — signing will fail with an authorization error
- Letting the client secret expire without rotating it

## Expected Secret-to-Workflow Mapping

This repo's workflow expects:

- signing workflow: `.github/workflows/build-rust-installer-gui.yml`
- Windows packaging project: `installer/rust-gui`
- endpoint secret: `WINDOWS_TRUSTED_SIGNING_ENDPOINT`
- account secret: `WINDOWS_TRUSTED_SIGNING_ACCOUNT`
- profile secret: `WINDOWS_TRUSTED_SIGNING_PROFILE`
- description secret: `WINDOWS_TRUSTED_SIGNING_DESCRIPTION`
- Azure service principal: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`

## References

- Azure Trusted Signing overview:
  `https://learn.microsoft.com/azure/trusted-signing/overview`
- Quickstart — create a Trusted Signing account:
  `https://learn.microsoft.com/azure/trusted-signing/quickstart`
- Certificate profile types:
  `https://learn.microsoft.com/azure/trusted-signing/concept-trusted-signing-cert-management`
- App Registration and service principal:
  `https://learn.microsoft.com/entra/identity-platform/quickstart-register-app`
- Trusted Signing Certificate Profile Signer role:
  `https://learn.microsoft.com/azure/trusted-signing/how-to-assign-roles`
- trusted-signing-cli (Rust crate):
  `https://crates.io/crates/trusted-signing-cli`
- Authenticode signature verification:
  `https://learn.microsoft.com/windows/win32/seccrypto/signtool`
