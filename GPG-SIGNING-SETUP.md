# GPG Signing Key Setup

Run these commands on your Mac in order. Takes about 2 minutes.

## Step 1: Generate the keypair

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

Expected output ends with:
```
gpg: key XXXXXXXXXXXXXXXX marked as ultimately trusted
gpg: done
```

## Step 2: Copy the private key to clipboard

```bash
gpg --export-secret-keys --armor releases@acumenus.net | base64 | pbcopy
```

No output. The base64 string is now in your clipboard.

## Step 3: Add the GitHub secret

1. Open: `https://github.com/sudoshi/Parthenon/settings/secrets/actions`
2. Click **New repository secret**
3. Name: `GPG_SIGNING_KEY`
4. Value: paste from clipboard
5. Click **Add secret**

## Step 4: Export and commit the public key

```bash
cd /path/to/Parthenon
gpg --export --armor releases@acumenus.net > SIGNING-KEY.asc
git add SIGNING-KEY.asc
git commit -m "chore: add GPG public signing key for Linux package verification"
git push origin main
```

## Step 5: Verify it works

```bash
echo "test" > /tmp/gpg-test.txt
gpg --local-user releases@acumenus.net --detach-sign --armor /tmp/gpg-test.txt
gpg --verify /tmp/gpg-test.txt.asc /tmp/gpg-test.txt
```

Expected last line:
```
gpg: Good signature from "Acumenus Data Sciences <releases@acumenus.net>"
```

Done. Run the smoke test workflow next:
`https://github.com/sudoshi/Parthenon/actions/workflows/build-rust-installer-gui.yml`
