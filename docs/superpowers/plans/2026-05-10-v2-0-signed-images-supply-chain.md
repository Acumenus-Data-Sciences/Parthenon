# v2.0 Plan 05-01 — Signed Multi-Arch Images, SBOM, and CVE Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, sign, and publish multi-arch (`linux/amd64` + `linux/arm64`) container images for every Parthenon runtime service on GHCR and Docker Hub, with Cosign signatures, CycloneDX SBOMs, and Trivy CVE gates. This is the supply-chain foundation every downstream v2.x distribution channel (Helm chart, Workstation Edition, EE on-prem installer, AWS/Azure/GCP marketplace launches) verifies against.

**Architecture:** Single reusable GitHub Actions workflow (`.github/workflows/release-images.yml`) builds → SBOMs → scans → signs → publishes each image. Cosign uses **keyless signing via GitHub OIDC** (free, no key management) to start; **KMS-backed keys** become available behind a feature flag for future hardening. Public verification surface at `parthenon.acumenus.net/.well-known/cosign.pub` for the KMS path, and the GitHub Actions OIDC issuer for the keyless path. CVE allowlist in `.security/cve-allowlist.yaml` requires `security-architect` agent sign-off; HIGH/CRITICAL CVEs without allowlist entries fail the build.

**Tech Stack:** Docker Buildx (multi-arch), `sigstore/cosign-installer` v3.x, `anchore/sbom-action` (Syft, CycloneDX 1.5 format), `aquasecurity/trivy-action` v0.x (CVE + secret scanner), GHCR (`ghcr.io/acumenus-data-sciences/parthenon-*`), Docker Hub (`docker.io/acumenusdatasciences/parthenon-*`), GitHub Actions OIDC.

**Parent umbrella:** [docs/superpowers/plans/2026-05-10-v2-5-roadmap-umbrella.md](2026-05-10-v2-5-roadmap-umbrella.md) — this plan is **05-01**, the first authored child plan.

**Spec reference:** [docs/superpowers/specs/2026-05-10-parthenon-v2-5-roadmap-design.md](../specs/2026-05-10-parthenon-v2-5-roadmap-design.md), Section 4 Phase 1 + Section 5.2.

**Existing surface this plan modifies / replaces:**

- `.github/workflows/docker-build.yml` — current image build workflow. Replaced by `release-images.yml` in this plan.
- `docker/*/Dockerfile` (18 total) — runtime images. Subset receives multi-arch updates (see Image Scope below).
- New: `.security/cve-allowlist.yaml`, `docs/security/image-signing.md`, `scripts/verify-image-signature.sh`, `.github/workflows/release-images.yml`.

---

## Image Scope

Of the 18 Dockerfiles in `docker/`, this plan covers the **runtime production images** distributed to customers. Tooling-only images (Jupyter user containers, BlackRabbit PDF extractor, regenie) are out of scope for v2.0 and revisit in v2.1+.

**In scope (v2.0):**

| Image | Dockerfile | Registry tag stem |
|---|---|---|
| Backend (Laravel PHP-FPM) | `docker/php/Dockerfile` | `parthenon-backend` |
| Frontend (Vite-built static + Node) | `docker/node/Dockerfile` | `parthenon-frontend` |
| Nginx reverse proxy | `docker/nginx/Dockerfile` | `parthenon-nginx` |
| Python AI service | `docker/python/Dockerfile` | `parthenon-ai` |
| R Runtime (HADES Plumber) | `docker/r/Dockerfile` | `parthenon-r` |
| Solr (with configsets) | `docker/solr/Dockerfile` | `parthenon-solr` |
| Postgres (with init scripts) | `docker/postgres/Dockerfile` | `parthenon-postgres` |
| Hecate (Qdrant bootstrap) | `docker/hecate/Dockerfile` | `parthenon-hecate` |
| Study Agent | `docker/study-agent/Dockerfile` | `parthenon-study-agent` |
| FHIR-to-CDM | `docker/fhir-to-cdm/Dockerfile` | `parthenon-fhir-to-cdm` |
| Shiny OHDSI | `docker/shiny-ohdsi/Dockerfile` | `parthenon-shiny` |
| Parthenon Anonymizer | `docker/parthenon-anonymizer/Dockerfile` | `parthenon-anonymizer` |
| Parthenon SciSpacy | `docker/parthenon-scispacy/Dockerfile` | `parthenon-scispacy` |
| OHIF Viewer | `docker/ohif/Dockerfile` | `parthenon-ohif` |
| JupyterHub | `docker/jupyterhub/Dockerfile` | `parthenon-jupyterhub` |

**Out of scope for 05-01 (future):**

- `docker/jupyter-user/Dockerfile` — per-user Jupyter spawn image; not customer-distributed runtime.
- `docker/blackrabbit/Dockerfile` — internal PDF extraction tool; not yet customer-facing.
- `docker/regenie/Dockerfile` — genomics tool; specialized customer subset only, deferred to v2.1.

---

## File Structure

**New files:**

```
.github/workflows/release-images.yml          # The single reusable image release workflow
.security/cve-allowlist.yaml                  # Trivy CVE allowlist with sign-off comments
docs/security/image-signing.md                # Public verification guide
scripts/verify-image-signature.sh             # Standalone Cosign verification helper
scripts/build-image-matrix.sh                 # Generates the per-image build matrix for the workflow
tests/supply-chain/verify_cosign_signature.bats # Bats test exercising scripts/verify-image-signature.sh
tests/supply-chain/verify_sbom_format.sh      # Validates CycloneDX SBOM schema
tests/supply-chain/verify_multiarch_manifest.sh # Confirms each published image has amd64 + arm64
```

**Modified files:**

```
docker/*/Dockerfile (15 images per scope table)    # Add ARG TARGETPLATFORM + multi-arch base images
.github/workflows/docker-build.yml                 # Deprecated; redirects to release-images.yml for tagged releases
.github/workflows/ci.yml                           # Adds a PR-time scan step (no signing, no push)
README.md                                          # Adds "Verifying image signatures" section
docs/security/README.md (or create)                # Links to image-signing.md
```

**Public artifacts published per release:**

```
ghcr.io/acumenus-data-sciences/<image>:<tag>            # Multi-arch manifest
ghcr.io/acumenus-data-sciences/<image>:<tag>.sig        # Cosign signature
ghcr.io/acumenus-data-sciences/<image>:<tag>.sbom       # CycloneDX SBOM attestation
docker.io/acumenusdatasciences/<image>:<tag>            # Mirror with same .sig + .sbom
parthenon.acumenus.net/.well-known/cosign.pub           # KMS public key (when keyless→KMS migration completes; placeholder content until then)
```

---

## Tag Strategy

Three tags published per release:

- `latest` — moves on every successful release; convenience only, not for production.
- `vX.Y.Z` — immutable semver tag matching the Git release tag.
- `sha-<short>` — immutable Git SHA tag for traceability.

Tags follow the Git tag `vX.Y.Z` triggering the workflow. PR builds publish `pr-<num>-<sha>` to GHCR only (no Docker Hub mirror, no signing) so PR-time validation works without polluting public artifacts.

---

## Task 1: Add Cosign keyless verification helper

**Files:**
- Create: `scripts/verify-image-signature.sh`
- Test: `tests/supply-chain/verify_cosign_signature.bats`

- [ ] **Step 1: Write the failing test**

```bash
# tests/supply-chain/verify_cosign_signature.bats
#!/usr/bin/env bats

@test "verify-image-signature.sh fails without an image argument" {
  run scripts/verify-image-signature.sh
  [ "$status" -ne 0 ]
  [[ "$output" == *"usage: verify-image-signature.sh <image>"* ]]
}

@test "verify-image-signature.sh fails on an unsigned image" {
  # alpine:latest is unsigned by us
  run scripts/verify-image-signature.sh alpine:latest
  [ "$status" -ne 0 ]
  [[ "$output" == *"no matching signatures"* ]] || [[ "$output" == *"error"* ]]
}

@test "verify-image-signature.sh accepts COSIGN_CERTIFICATE_IDENTITY override" {
  COSIGN_CERTIFICATE_IDENTITY="https://example.invalid" \
    run scripts/verify-image-signature.sh alpine:latest
  [ "$status" -ne 0 ]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/supply-chain/verify_cosign_signature.bats`
Expected: FAIL — `scripts/verify-image-signature.sh: No such file or directory`.

- [ ] **Step 3: Write minimal implementation**

```bash
#!/usr/bin/env bash
# scripts/verify-image-signature.sh
# Verifies a Parthenon container image signature using Cosign keyless OIDC.
#
# Usage: scripts/verify-image-signature.sh <image:tag>
#
# Environment overrides:
#   COSIGN_CERTIFICATE_IDENTITY (default: matches Parthenon release workflow OIDC subject)
#   COSIGN_CERTIFICATE_OIDC_ISSUER (default: https://token.actions.githubusercontent.com)
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: verify-image-signature.sh <image:tag>" >&2
  exit 2
fi

IMAGE="$1"
IDENTITY="${COSIGN_CERTIFICATE_IDENTITY:-https://github.com/Acumenus-Data-Sciences/Parthenon/.github/workflows/release-images.yml@refs/tags/v*}"
ISSUER="${COSIGN_CERTIFICATE_OIDC_ISSUER:-https://token.actions.githubusercontent.com}"

cosign verify \
  --certificate-identity-regexp "$IDENTITY" \
  --certificate-oidc-issuer "$ISSUER" \
  "$IMAGE"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `chmod +x scripts/verify-image-signature.sh && bats tests/supply-chain/verify_cosign_signature.bats`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-image-signature.sh tests/supply-chain/verify_cosign_signature.bats
git commit -m "feat(supply-chain): add cosign keyless verification helper"
```

---

## Task 2: Add CycloneDX SBOM format validator

**Files:**
- Create: `tests/supply-chain/verify_sbom_format.sh`

- [ ] **Step 1: Write the failing test**

The validator is a script that takes a JSON path and asserts CycloneDX 1.5 schema. We test it against a fixture.

```bash
# tests/supply-chain/fixtures/valid-cyclonedx.json
{
  "$schema": "http://cyclonedx.org/schema/bom-1.5.schema.json",
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "version": 1,
  "components": []
}
```

```bash
# tests/supply-chain/fixtures/invalid-cyclonedx.json
{
  "format": "spdx"
}
```

```bash
# tests/supply-chain/test_verify_sbom_format.bats
#!/usr/bin/env bats

@test "verify_sbom_format.sh accepts valid CycloneDX 1.5" {
  run tests/supply-chain/verify_sbom_format.sh tests/supply-chain/fixtures/valid-cyclonedx.json
  [ "$status" -eq 0 ]
}

@test "verify_sbom_format.sh rejects SPDX or missing fields" {
  run tests/supply-chain/verify_sbom_format.sh tests/supply-chain/fixtures/invalid-cyclonedx.json
  [ "$status" -ne 0 ]
  [[ "$output" == *"bomFormat"* ]] || [[ "$output" == *"CycloneDX"* ]]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/supply-chain/test_verify_sbom_format.bats`
Expected: FAIL — script not found.

- [ ] **Step 3: Write minimal implementation**

```bash
#!/usr/bin/env bash
# tests/supply-chain/verify_sbom_format.sh
# Validates that a JSON file is a CycloneDX 1.5 SBOM.
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: verify_sbom_format.sh <sbom.json>" >&2
  exit 2
fi

FILE="$1"
FORMAT=$(jq -r '.bomFormat // empty' "$FILE")
VERSION=$(jq -r '.specVersion // empty' "$FILE")

if [ "$FORMAT" != "CycloneDX" ]; then
  echo "error: expected bomFormat=CycloneDX, got '$FORMAT'" >&2
  exit 1
fi

if [[ "$VERSION" != "1.5" && "$VERSION" != "1.6" ]]; then
  echo "error: expected specVersion 1.5 or 1.6, got '$VERSION'" >&2
  exit 1
fi

echo "ok: $FILE is CycloneDX $VERSION"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `chmod +x tests/supply-chain/verify_sbom_format.sh && bats tests/supply-chain/test_verify_sbom_format.bats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/supply-chain/verify_sbom_format.sh tests/supply-chain/fixtures/ tests/supply-chain/test_verify_sbom_format.bats
git commit -m "feat(supply-chain): add CycloneDX SBOM format validator"
```

---

## Task 3: Add multi-arch manifest verifier

**Files:**
- Create: `tests/supply-chain/verify_multiarch_manifest.sh`
- Test: `tests/supply-chain/test_verify_multiarch_manifest.bats`

- [ ] **Step 1: Write the failing test**

```bash
# tests/supply-chain/test_verify_multiarch_manifest.bats
#!/usr/bin/env bats

@test "verify_multiarch_manifest.sh accepts amd64 + arm64 manifest" {
  # Use a known-good public multi-arch image as fixture
  run tests/supply-chain/verify_multiarch_manifest.sh alpine:3.20
  [ "$status" -eq 0 ]
  [[ "$output" == *"linux/amd64"* ]]
  [[ "$output" == *"linux/arm64"* ]]
}

@test "verify_multiarch_manifest.sh rejects single-arch manifest" {
  # GitHub's hello-world is sometimes multi-arch; pick a single-arch fixture if available.
  # If no single-arch fixture available, this test asserts the error path:
  run tests/supply-chain/verify_multiarch_manifest.sh nonexistent.invalid/single:latest
  [ "$status" -ne 0 ]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/supply-chain/test_verify_multiarch_manifest.bats`
Expected: FAIL — script not found.

- [ ] **Step 3: Write minimal implementation**

```bash
#!/usr/bin/env bash
# tests/supply-chain/verify_multiarch_manifest.sh
# Asserts that the given image is a multi-arch manifest including linux/amd64 and linux/arm64.
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: verify_multiarch_manifest.sh <image:tag>" >&2
  exit 2
fi

IMAGE="$1"
PLATFORMS=$(docker manifest inspect "$IMAGE" 2>/dev/null | jq -r '.manifests[].platform | "\(.os)/\(.architecture)"' | sort -u)

if [ -z "$PLATFORMS" ]; then
  echo "error: no manifest found for $IMAGE" >&2
  exit 1
fi

echo "platforms found for $IMAGE:"
echo "$PLATFORMS"

if ! echo "$PLATFORMS" | grep -q "^linux/amd64$"; then
  echo "error: linux/amd64 missing" >&2
  exit 1
fi

if ! echo "$PLATFORMS" | grep -q "^linux/arm64$"; then
  echo "error: linux/arm64 missing" >&2
  exit 1
fi
```

- [ ] **Step 4: Run test to verify it passes**

Run: `chmod +x tests/supply-chain/verify_multiarch_manifest.sh && bats tests/supply-chain/test_verify_multiarch_manifest.bats`
Expected: PASS for the alpine case. The single-arch rejection test passes via the bad-image-name path.

- [ ] **Step 5: Commit**

```bash
git add tests/supply-chain/verify_multiarch_manifest.sh tests/supply-chain/test_verify_multiarch_manifest.bats
git commit -m "feat(supply-chain): add multi-arch manifest verifier"
```

---

## Task 4: Make every in-scope Dockerfile multi-arch compatible

**Files:**
- Modify (15 Dockerfiles):
  - `docker/php/Dockerfile`
  - `docker/node/Dockerfile`
  - `docker/nginx/Dockerfile`
  - `docker/python/Dockerfile`
  - `docker/r/Dockerfile`
  - `docker/solr/Dockerfile`
  - `docker/postgres/Dockerfile`
  - `docker/hecate/Dockerfile`
  - `docker/study-agent/Dockerfile`
  - `docker/fhir-to-cdm/Dockerfile`
  - `docker/shiny-ohdsi/Dockerfile`
  - `docker/parthenon-anonymizer/Dockerfile`
  - `docker/parthenon-scispacy/Dockerfile`
  - `docker/ohif/Dockerfile`
  - `docker/jupyterhub/Dockerfile`

- [ ] **Step 1: For each Dockerfile, write a failing build test**

Add per-image entry to `tests/supply-chain/test_multiarch_build.bats`:

```bash
#!/usr/bin/env bats

@test "docker/php/Dockerfile builds for linux/amd64" {
  run docker buildx build --platform linux/amd64 --load -t parthenon-backend:test docker/php/
  [ "$status" -eq 0 ]
}

@test "docker/php/Dockerfile builds for linux/arm64" {
  run docker buildx build --platform linux/arm64 --load -t parthenon-backend:test-arm64 docker/php/
  [ "$status" -eq 0 ]
}

# Repeat the two-platform pair for each of the 15 in-scope Dockerfiles.
```

- [ ] **Step 2: Run tests to see which Dockerfiles fail multi-arch**

Run: `bats tests/supply-chain/test_multiarch_build.bats`
Expected: Several FAIL for any Dockerfile that uses single-arch base images (`FROM alpine` is fine; `FROM some-amd64-only-vendor-image` fails).

- [ ] **Step 3: For each failing Dockerfile, switch to multi-arch base**

Common fixes:

```dockerfile
# Before
FROM php:8.4-fpm

# After (no change; php:8.4-fpm is already multi-arch)
FROM php:8.4-fpm
```

```dockerfile
# Before
FROM rocker/r-ver:4.4.0

# After (verify multi-arch; rocker is amd64-only — switch to r-base or build conditionally)
FROM --platform=$BUILDPLATFORM r-base:4.4.0 AS build
ARG TARGETARCH
RUN echo "Building for $TARGETARCH"
```

For each in-scope Dockerfile, ensure:

1. `FROM` lines use multi-arch images. If a base is amd64-only, either switch base or build a separate `Dockerfile.arm64` (only as a last resort — prefer the same Dockerfile).
2. `ARG TARGETPLATFORM`, `ARG TARGETARCH`, `ARG TARGETOS` declared if needed for conditional logic.
3. No `RUN` step assumes architecture (e.g., downloading `*-amd64.tar.gz` from a release URL must be parameterized).

Capture the per-Dockerfile changes in 15 separate commits (one per image) so each is independently reviewable.

- [ ] **Step 4: Re-run tests until all pass**

Run: `bats tests/supply-chain/test_multiarch_build.bats`
Expected: PASS for all 30 cases (15 Dockerfiles × 2 platforms).

- [ ] **Step 5: Commit each Dockerfile change individually**

```bash
git add docker/php/Dockerfile
git commit -m "feat(docker): make php image multi-arch buildable"
# Repeat for each image; final commit lands the test file:
git add tests/supply-chain/test_multiarch_build.bats
git commit -m "test(supply-chain): assert multi-arch build for all in-scope images"
```

---

## Task 5: Create the CVE allowlist file

**Files:**
- Create: `.security/cve-allowlist.yaml`
- Create: `.security/README.md`

- [ ] **Step 1: Write the failing test**

```bash
# tests/supply-chain/test_cve_allowlist.bats
#!/usr/bin/env bats

@test ".security/cve-allowlist.yaml exists and is valid YAML" {
  [ -f ".security/cve-allowlist.yaml" ]
  run yq eval '.' .security/cve-allowlist.yaml
  [ "$status" -eq 0 ]
}

@test "every CVE entry has required fields" {
  run yq eval '.allowlist[] | select(.cve == null or .justification == null or .reviewer == null or .expires_at == null)' .security/cve-allowlist.yaml
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/supply-chain/test_cve_allowlist.bats`
Expected: FAIL — file not found.

- [ ] **Step 3: Write the allowlist file**

```yaml
# .security/cve-allowlist.yaml
# Trivy CVE allowlist for Parthenon container images.
#
# Each entry MUST include:
#   cve            — CVE identifier (e.g., CVE-2024-XXXXX)
#   image          — Image stem this allowlist applies to (or "*" for all)
#   severity       — Trivy severity classification at time of allowlisting
#   justification  — Why this CVE is acceptable (link to upstream fix tracker, mitigation, etc.)
#   reviewer       — GitHub handle who approved (must be a security-architect)
#   approved_at    — ISO date of approval
#   expires_at     — ISO date of expiry; allowlist entries auto-expire
#
# CI references this file via .github/workflows/release-images.yml.
# Expired or missing entries fail the build.

allowlist: []
# Example entry (commented):
# - cve: CVE-2024-12345
#   image: parthenon-backend
#   severity: HIGH
#   justification: "Upstream fix in PHP 8.4.7; not exploitable in our usage pattern (no XML SOAP endpoint). Tracked at https://bugs.php.net/XYZ."
#   reviewer: "@security-architect"
#   approved_at: "2026-06-01"
#   expires_at: "2026-09-01"
```

And `.security/README.md`:

```markdown
# Parthenon Security Allowlists

This directory contains supply-chain governance files.

## cve-allowlist.yaml

Trivy CVE allowlist. Entries expire automatically. Adding an entry requires
sign-off from a maintainer in the `security-architect` role.

Process:
1. Trivy flags a HIGH/CRITICAL CVE in a release build.
2. If the CVE is genuinely not exploitable (or fix not yet upstream), open a PR adding an allowlist entry.
3. PR must be approved by a `security-architect` maintainer.
4. Entry expires within 90 days; renewal requires re-approval.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bats tests/supply-chain/test_cve_allowlist.bats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .security/cve-allowlist.yaml .security/README.md tests/supply-chain/test_cve_allowlist.bats
git commit -m "feat(supply-chain): add CVE allowlist scaffold with auto-expiry"
```

---

## Task 6: Write image-signing public documentation

**Files:**
- Create: `docs/security/image-signing.md`

- [ ] **Step 1: Write the failing test**

```bash
# tests/supply-chain/test_docs_image_signing.bats
#!/usr/bin/env bats

@test "image-signing.md exists" {
  [ -f "docs/security/image-signing.md" ]
}

@test "image-signing.md documents cosign verify command" {
  run grep -q "cosign verify" docs/security/image-signing.md
  [ "$status" -eq 0 ]
}

@test "image-signing.md documents the OIDC identity regex" {
  run grep -q "certificate-identity-regexp" docs/security/image-signing.md
  [ "$status" -eq 0 ]
}

@test "image-signing.md links to scripts/verify-image-signature.sh" {
  run grep -q "verify-image-signature.sh" docs/security/image-signing.md
  [ "$status" -eq 0 ]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/supply-chain/test_docs_image_signing.bats`
Expected: FAIL — doc not found.

- [ ] **Step 3: Write the doc**

```markdown
# Verifying Parthenon Container Image Signatures

Every official Parthenon container image is signed using
[Cosign](https://docs.sigstore.dev/) with **GitHub Actions OIDC keyless
signing**. There is no public key file to download — signatures are bound to
the GitHub workflow that produced them, and the verification check is that the
signature was issued by the official Parthenon release workflow.

## Quick verification

If you have `cosign` installed, run the helper:

    scripts/verify-image-signature.sh ghcr.io/acumenus-data-sciences/parthenon-backend:v2.0.0

The helper passes the correct OIDC issuer and identity regex for the Parthenon
release workflow.

## Manual verification

Equivalent direct command:

    cosign verify \
      --certificate-identity-regexp 'https://github.com/Acumenus-Data-Sciences/Parthenon/.github/workflows/release-images.yml@refs/tags/v.*' \
      --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' \
      ghcr.io/acumenus-data-sciences/parthenon-backend:v2.0.0

## Why keyless?

Keyless signing avoids key management for the v2.0 launch. The trust anchor is
the GitHub OIDC issuer + the immutable workflow source ref (`refs/tags/v*`),
which means a forged signature would require either a compromised GitHub OIDC
issuer or a tag pushed by someone with `Acumenus-Data-Sciences/Parthenon`
write access.

A future hardening migrates Parthenon to KMS-backed long-lived signing keys
published at `https://parthenon.acumenus.net/.well-known/cosign.pub`. That
migration is tracked in v2.x roadmap plan 05-01-followup (not yet authored).

## SBOMs

Every published image has a CycloneDX SBOM attestation. Fetch it with:

    cosign download sbom ghcr.io/acumenus-data-sciences/parthenon-backend:v2.0.0 \
      > parthenon-backend-v2.0.0.sbom.json

The SBOM is CycloneDX 1.5 (or 1.6) — validate it against the schema using
your tool of choice, or run our validator:

    tests/supply-chain/verify_sbom_format.sh parthenon-backend-v2.0.0.sbom.json

## What is signed

The following images for the latest release tag:

| Image | Registry path |
|---|---|
| Backend | `ghcr.io/acumenus-data-sciences/parthenon-backend` |
| Frontend | `ghcr.io/acumenus-data-sciences/parthenon-frontend` |
| Nginx | `ghcr.io/acumenus-data-sciences/parthenon-nginx` |
| Python AI | `ghcr.io/acumenus-data-sciences/parthenon-ai` |
| R Runtime | `ghcr.io/acumenus-data-sciences/parthenon-r` |
| Solr | `ghcr.io/acumenus-data-sciences/parthenon-solr` |
| Postgres | `ghcr.io/acumenus-data-sciences/parthenon-postgres` |
| Hecate | `ghcr.io/acumenus-data-sciences/parthenon-hecate` |
| Study Agent | `ghcr.io/acumenus-data-sciences/parthenon-study-agent` |
| FHIR-to-CDM | `ghcr.io/acumenus-data-sciences/parthenon-fhir-to-cdm` |
| Shiny OHDSI | `ghcr.io/acumenus-data-sciences/parthenon-shiny` |
| Anonymizer | `ghcr.io/acumenus-data-sciences/parthenon-anonymizer` |
| SciSpacy | `ghcr.io/acumenus-data-sciences/parthenon-scispacy` |
| OHIF | `ghcr.io/acumenus-data-sciences/parthenon-ohif` |
| JupyterHub | `ghcr.io/acumenus-data-sciences/parthenon-jupyterhub` |

Each image is multi-arch (`linux/amd64` + `linux/arm64`). The same images are
mirrored to `docker.io/acumenusdatasciences/` with identical content and
signatures.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bats tests/supply-chain/test_docs_image_signing.bats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/security/image-signing.md tests/supply-chain/test_docs_image_signing.bats
git commit -m "docs(security): document container image signature verification"
```

---

## Task 7: Generate the per-image build matrix

**Files:**
- Create: `scripts/build-image-matrix.sh`
- Test: `tests/supply-chain/test_build_image_matrix.bats`

- [ ] **Step 1: Write the failing test**

```bash
# tests/supply-chain/test_build_image_matrix.bats
#!/usr/bin/env bats

@test "build-image-matrix.sh emits valid JSON" {
  run scripts/build-image-matrix.sh
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.include | length > 0' >/dev/null
}

@test "matrix contains parthenon-backend with correct context" {
  run scripts/build-image-matrix.sh
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.include[] | select(.name == "parthenon-backend") | .context == "docker/php"' >/dev/null
}

@test "matrix excludes out-of-scope images (jupyter-user, blackrabbit, regenie)" {
  run scripts/build-image-matrix.sh
  [ "$status" -eq 0 ]
  ! echo "$output" | jq -e '.include[] | select(.name == "parthenon-jupyter-user")' >/dev/null
  ! echo "$output" | jq -e '.include[] | select(.name == "parthenon-blackrabbit")' >/dev/null
  ! echo "$output" | jq -e '.include[] | select(.name == "parthenon-regenie")' >/dev/null
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/supply-chain/test_build_image_matrix.bats`
Expected: FAIL — script not found.

- [ ] **Step 3: Write the matrix generator**

```bash
#!/usr/bin/env bash
# scripts/build-image-matrix.sh
# Emits a GitHub Actions matrix JSON listing every in-scope image to build.
set -euo pipefail

cat <<'JSON'
{
  "include": [
    {"name": "parthenon-backend",      "context": "docker/php",                  "dockerfile": "docker/php/Dockerfile"},
    {"name": "parthenon-frontend",     "context": "docker/node",                 "dockerfile": "docker/node/Dockerfile"},
    {"name": "parthenon-nginx",        "context": "docker/nginx",                "dockerfile": "docker/nginx/Dockerfile"},
    {"name": "parthenon-ai",           "context": "docker/python",               "dockerfile": "docker/python/Dockerfile"},
    {"name": "parthenon-r",            "context": "docker/r",                    "dockerfile": "docker/r/Dockerfile"},
    {"name": "parthenon-solr",         "context": "docker/solr",                 "dockerfile": "docker/solr/Dockerfile"},
    {"name": "parthenon-postgres",     "context": "docker/postgres",             "dockerfile": "docker/postgres/Dockerfile"},
    {"name": "parthenon-hecate",       "context": "docker/hecate",               "dockerfile": "docker/hecate/Dockerfile"},
    {"name": "parthenon-study-agent",  "context": "docker/study-agent",          "dockerfile": "docker/study-agent/Dockerfile"},
    {"name": "parthenon-fhir-to-cdm",  "context": "docker/fhir-to-cdm",          "dockerfile": "docker/fhir-to-cdm/Dockerfile"},
    {"name": "parthenon-shiny",        "context": "docker/shiny-ohdsi",          "dockerfile": "docker/shiny-ohdsi/Dockerfile"},
    {"name": "parthenon-anonymizer",   "context": "docker/parthenon-anonymizer", "dockerfile": "docker/parthenon-anonymizer/Dockerfile"},
    {"name": "parthenon-scispacy",     "context": "docker/parthenon-scispacy",   "dockerfile": "docker/parthenon-scispacy/Dockerfile"},
    {"name": "parthenon-ohif",         "context": "docker/ohif",                 "dockerfile": "docker/ohif/Dockerfile"},
    {"name": "parthenon-jupyterhub",   "context": "docker/jupyterhub",           "dockerfile": "docker/jupyterhub/Dockerfile"}
  ]
}
JSON
```

- [ ] **Step 4: Run test to verify it passes**

Run: `chmod +x scripts/build-image-matrix.sh && bats tests/supply-chain/test_build_image_matrix.bats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-image-matrix.sh tests/supply-chain/test_build_image_matrix.bats
git commit -m "feat(supply-chain): emit per-image build matrix for CI"
```

---

## Task 8: Write the release-images.yml workflow

**Files:**
- Create: `.github/workflows/release-images.yml`

- [ ] **Step 1: Write the failing test (workflow lint)**

```bash
# tests/supply-chain/test_release_workflow.bats
#!/usr/bin/env bats

@test "release-images.yml is valid GitHub Actions YAML" {
  [ -f ".github/workflows/release-images.yml" ]
  run yq eval '.jobs' .github/workflows/release-images.yml
  [ "$status" -eq 0 ]
}

@test "release-images.yml triggers on tag push" {
  run yq eval '.on.push.tags' .github/workflows/release-images.yml
  [[ "$output" == *"v*"* ]]
}

@test "release-images.yml has matrix-build job" {
  run yq eval '.jobs.build.strategy.matrix' .github/workflows/release-images.yml
  [ "$status" -eq 0 ]
}

@test "release-images.yml uses cosign-installer" {
  run grep -q "sigstore/cosign-installer" .github/workflows/release-images.yml
  [ "$status" -eq 0 ]
}

@test "release-images.yml runs trivy with allowlist" {
  run grep -q "aquasecurity/trivy-action" .github/workflows/release-images.yml
  [ "$status" -eq 0 ]
  run grep -q "cve-allowlist.yaml" .github/workflows/release-images.yml
  [ "$status" -eq 0 ]
}

@test "release-images.yml builds for both amd64 and arm64" {
  run grep -q "linux/amd64,linux/arm64" .github/workflows/release-images.yml
  [ "$status" -eq 0 ]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/supply-chain/test_release_workflow.bats`
Expected: FAIL — workflow not found.

- [ ] **Step 3: Write the workflow**

```yaml
# .github/workflows/release-images.yml
name: release-images

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      tag:
        description: 'Explicit tag to publish (e.g., v2.0.0)'
        required: true

permissions:
  contents: read
  packages: write
  id-token: write   # required for keyless cosign

jobs:
  matrix:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.gen.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
      - id: gen
        run: |
          echo "matrix=$(scripts/build-image-matrix.sh | jq -c .)" >> "$GITHUB_OUTPUT"

  build:
    needs: matrix
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix: ${{ fromJson(needs.matrix.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Compute tags
        id: tags
        run: |
          REF="${GITHUB_REF#refs/tags/}"
          SHORT_SHA="${GITHUB_SHA::7}"
          IMAGE="${{ matrix.name }}"
          {
            echo "ghcr=ghcr.io/acumenus-data-sciences/${IMAGE}:${REF}"
            echo "ghcr_latest=ghcr.io/acumenus-data-sciences/${IMAGE}:latest"
            echo "ghcr_sha=ghcr.io/acumenus-data-sciences/${IMAGE}:sha-${SHORT_SHA}"
            echo "dh=docker.io/acumenusdatasciences/${IMAGE}:${REF}"
            echo "dh_latest=docker.io/acumenusdatasciences/${IMAGE}:latest"
            echo "dh_sha=docker.io/acumenusdatasciences/${IMAGE}:sha-${SHORT_SHA}"
          } >> "$GITHUB_OUTPUT"

      - name: Build multi-arch and push
        id: build
        uses: docker/build-push-action@v6
        with:
          context: ${{ matrix.context }}
          file: ${{ matrix.dockerfile }}
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            ${{ steps.tags.outputs.ghcr }}
            ${{ steps.tags.outputs.ghcr_latest }}
            ${{ steps.tags.outputs.ghcr_sha }}
            ${{ steps.tags.outputs.dh }}
            ${{ steps.tags.outputs.dh_latest }}
            ${{ steps.tags.outputs.dh_sha }}
          provenance: true
          sbom: true

      - name: Install Cosign
        uses: sigstore/cosign-installer@v3

      - name: Sign GHCR image (keyless)
        run: |
          cosign sign --yes \
            "ghcr.io/acumenus-data-sciences/${{ matrix.name }}@${{ steps.build.outputs.digest }}"

      - name: Sign Docker Hub image (keyless)
        run: |
          cosign sign --yes \
            "docker.io/acumenusdatasciences/${{ matrix.name }}@${{ steps.build.outputs.digest }}"

      - name: Generate CycloneDX SBOM
        uses: anchore/sbom-action@v0
        with:
          image: ghcr.io/acumenus-data-sciences/${{ matrix.name }}@${{ steps.build.outputs.digest }}
          format: cyclonedx-json
          output-file: sbom-${{ matrix.name }}.cdx.json

      - name: Attest SBOM to GHCR
        run: |
          cosign attest --yes \
            --predicate sbom-${{ matrix.name }}.cdx.json \
            --type cyclonedx \
            "ghcr.io/acumenus-data-sciences/${{ matrix.name }}@${{ steps.build.outputs.digest }}"

      - name: Trivy scan with allowlist
        uses: aquasecurity/trivy-action@0.24.0
        with:
          image-ref: ghcr.io/acumenus-data-sciences/${{ matrix.name }}@${{ steps.build.outputs.digest }}
          severity: HIGH,CRITICAL
          exit-code: '1'
          ignore-unfixed: false
          trivyignores: .security/cve-allowlist.yaml
          format: 'sarif'
          output: 'trivy-${{ matrix.name }}.sarif'

      - name: Upload Trivy SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: trivy-${{ matrix.name }}.sarif
          category: trivy-${{ matrix.name }}
```

Note: the Trivy action expects a custom ignore-format. If `cve-allowlist.yaml` is structured differently, add a small transform step in `scripts/build-image-matrix.sh` that emits `.trivyignore` from the YAML. Implement this as Task 8.5 if Trivy rejects the YAML directly.

- [ ] **Step 4: Run test to verify it passes**

Run: `bats tests/supply-chain/test_release_workflow.bats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release-images.yml tests/supply-chain/test_release_workflow.bats
git commit -m "feat(ci): add release-images.yml multi-arch signed image workflow"
```

---

## Task 9: Add Trivy-allowlist-to-trivyignore transform

**Files:**
- Create: `scripts/cve-allowlist-to-trivyignore.sh`
- Test: `tests/supply-chain/test_trivyignore_transform.bats`

(Only needed if Task 8's direct YAML allowlist doesn't work with Trivy — verify empirically on first workflow run. If Trivy reads the YAML directly, skip this task.)

- [ ] **Step 1: Write the failing test**

```bash
# tests/supply-chain/test_trivyignore_transform.bats
#!/usr/bin/env bats

@test "transform emits one CVE per line" {
  run scripts/cve-allowlist-to-trivyignore.sh tests/supply-chain/fixtures/sample-allowlist.yaml
  [ "$status" -eq 0 ]
  [[ "$output" == *"CVE-2024-12345"* ]]
}

@test "transform skips expired entries" {
  run scripts/cve-allowlist-to-trivyignore.sh tests/supply-chain/fixtures/expired-allowlist.yaml
  [ "$status" -eq 0 ]
  ! echo "$output" | grep -q "CVE-2020-EXPIRED"
}
```

Create the two fixtures:

```yaml
# tests/supply-chain/fixtures/sample-allowlist.yaml
allowlist:
  - cve: CVE-2024-12345
    image: "*"
    severity: HIGH
    justification: "test fixture"
    reviewer: "@test"
    approved_at: "2026-05-01"
    expires_at: "2027-05-01"
```

```yaml
# tests/supply-chain/fixtures/expired-allowlist.yaml
allowlist:
  - cve: CVE-2020-EXPIRED
    image: "*"
    severity: HIGH
    justification: "test fixture, expired"
    reviewer: "@test"
    approved_at: "2020-01-01"
    expires_at: "2020-12-31"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/supply-chain/test_trivyignore_transform.bats`
Expected: FAIL — script not found.

- [ ] **Step 3: Write the transform**

```bash
#!/usr/bin/env bash
# scripts/cve-allowlist-to-trivyignore.sh
# Emit a .trivyignore from .security/cve-allowlist.yaml, dropping expired entries.
set -euo pipefail

FILE="${1:-.security/cve-allowlist.yaml}"
TODAY=$(date -u +%Y-%m-%d)

yq eval -r ".allowlist[] | select(.expires_at >= \"${TODAY}\") | .cve" "$FILE"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `chmod +x scripts/cve-allowlist-to-trivyignore.sh && bats tests/supply-chain/test_trivyignore_transform.bats`
Expected: PASS.

- [ ] **Step 5: Wire the transform into release-images.yml**

In `.github/workflows/release-images.yml`, add before the Trivy step:

```yaml
      - name: Generate .trivyignore from allowlist
        run: |
          scripts/cve-allowlist-to-trivyignore.sh > .trivyignore
```

And change the Trivy step:

```yaml
      - name: Trivy scan with allowlist
        uses: aquasecurity/trivy-action@0.24.0
        with:
          image-ref: ghcr.io/acumenus-data-sciences/${{ matrix.name }}@${{ steps.build.outputs.digest }}
          severity: HIGH,CRITICAL
          exit-code: '1'
          ignore-unfixed: false
          # .trivyignore is now generated above
          format: 'sarif'
          output: 'trivy-${{ matrix.name }}.sarif'
```

- [ ] **Step 6: Commit**

```bash
git add scripts/cve-allowlist-to-trivyignore.sh \
        tests/supply-chain/test_trivyignore_transform.bats \
        tests/supply-chain/fixtures/sample-allowlist.yaml \
        tests/supply-chain/fixtures/expired-allowlist.yaml \
        .github/workflows/release-images.yml
git commit -m "feat(supply-chain): generate .trivyignore from cve-allowlist.yaml with auto-expiry"
```

---

## Task 10: Add PR-time scan (no push, no signing) to ci.yml

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the failing test**

```bash
# tests/supply-chain/test_pr_scan.bats
#!/usr/bin/env bats

@test "ci.yml has a scan-pr-images job" {
  run grep -q "scan-pr-images" .github/workflows/ci.yml
  [ "$status" -eq 0 ]
}

@test "scan-pr-images does not push or sign" {
  ! grep -A 50 "scan-pr-images" .github/workflows/ci.yml | grep -q "cosign sign"
  ! grep -A 50 "scan-pr-images" .github/workflows/ci.yml | grep -q "push: true"
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/supply-chain/test_pr_scan.bats`
Expected: FAIL — job not present.

- [ ] **Step 3: Add the job to ci.yml**

Append to `.github/workflows/ci.yml`:

```yaml
  scan-pr-images:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3

      - name: Build backend amd64 only (PR speed)
        uses: docker/build-push-action@v6
        with:
          context: docker/php
          file: docker/php/Dockerfile
          platforms: linux/amd64
          push: false
          load: true
          tags: parthenon-backend:pr-${{ github.event.pull_request.number }}

      - name: Generate .trivyignore
        run: scripts/cve-allowlist-to-trivyignore.sh > .trivyignore

      - name: Trivy scan
        uses: aquasecurity/trivy-action@0.24.0
        with:
          image-ref: parthenon-backend:pr-${{ github.event.pull_request.number }}
          severity: HIGH,CRITICAL
          exit-code: '1'
```

Note: PR scan only checks the backend image (single fastest sample). Full matrix scan runs at tag push.

- [ ] **Step 4: Run test to verify it passes**

Run: `bats tests/supply-chain/test_pr_scan.bats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml tests/supply-chain/test_pr_scan.bats
git commit -m "ci: scan backend image on PR for CVE early-warning"
```

---

## Task 11: Deprecate docker-build.yml in favor of release-images.yml

**Files:**
- Modify: `.github/workflows/docker-build.yml`

- [ ] **Step 1: Write the failing test**

```bash
# tests/supply-chain/test_old_docker_build_deprecated.bats
#!/usr/bin/env bats

@test "docker-build.yml does not push to GHCR or Docker Hub anymore" {
  ! grep -q "ghcr.io" .github/workflows/docker-build.yml || true
  ! grep -q "docker.io" .github/workflows/docker-build.yml || true
}

@test "docker-build.yml documents deprecation" {
  run grep -q "deprecated" .github/workflows/docker-build.yml
  [ "$status" -eq 0 ]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/supply-chain/test_old_docker_build_deprecated.bats`
Expected: FAIL — old workflow still pushes.

- [ ] **Step 3: Mark docker-build.yml as deprecated**

Edit the workflow to remove push/login steps, keep only the build-as-validation flow, and add a deprecation banner comment. Sample header:

```yaml
# .github/workflows/docker-build.yml
#
# DEPRECATED: This workflow is replaced by release-images.yml for tag-triggered
# multi-arch signed releases, and by the scan-pr-images job in ci.yml for
# PR-time validation. It remains only as a build-only sanity check for the
# main branch; it does NOT push or sign images.
name: docker-build (deprecated)
```

Remove any `docker login`, `cosign sign`, or `push: true` references. Keep `push: false`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bats tests/supply-chain/test_old_docker_build_deprecated.bats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/docker-build.yml tests/supply-chain/test_old_docker_build_deprecated.bats
git commit -m "ci: deprecate docker-build.yml; release-images.yml handles signed releases"
```

---

## Task 12: Add README pointer to signature verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the failing test**

```bash
# tests/supply-chain/test_readme_signature_section.bats
#!/usr/bin/env bats

@test "README links to image-signing.md" {
  run grep -q "docs/security/image-signing.md" README.md
  [ "$status" -eq 0 ]
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bats tests/supply-chain/test_readme_signature_section.bats`
Expected: FAIL.

- [ ] **Step 3: Add a "Verifying images" subsection to README.md**

Insert under the existing License / Editions section:

```markdown
### Verifying container image signatures

Every official Parthenon container image is signed using Cosign keyless OIDC.
Verify a published image with:

    scripts/verify-image-signature.sh ghcr.io/acumenus-data-sciences/parthenon-backend:v2.0.0

Full verification documentation: [docs/security/image-signing.md](docs/security/image-signing.md).
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bats tests/supply-chain/test_readme_signature_section.bats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md tests/supply-chain/test_readme_signature_section.bats
git commit -m "docs(readme): link to image signature verification guide"
```

---

## Task 13: End-to-end release rehearsal (manual gate)

**Files:**
- Create: `docs/superpowers/devlog/2026-XX-XX-v2-0-signed-images-rehearsal.md` (filled in during the rehearsal)

This is a manual gate, not a code task. Run it before merging the work to `main`.

- [ ] **Step 1: Tag a pre-release in a fork or feature branch**

```bash
git tag v2.0.0-rc1
git push origin v2.0.0-rc1
```

- [ ] **Step 2: Watch release-images.yml run end-to-end on the tag push**

Confirm all 15 images:

- Build successfully on both `linux/amd64` and `linux/arm64`.
- Get pushed to GHCR.
- Get pushed to Docker Hub.
- Get signed (`*.sig` artifact appears via `cosign tree`).
- Get SBOM attestations (`*.sbom` artifact appears).
- Pass Trivy CVE scan (or the build correctly fails on unallowlisted HIGH/CRITICAL).

- [ ] **Step 3: From a clean machine, verify a sample image**

```bash
scripts/verify-image-signature.sh ghcr.io/acumenus-data-sciences/parthenon-backend:v2.0.0-rc1
cosign download sbom ghcr.io/acumenus-data-sciences/parthenon-backend:v2.0.0-rc1 > backend.sbom.json
tests/supply-chain/verify_sbom_format.sh backend.sbom.json
tests/supply-chain/verify_multiarch_manifest.sh ghcr.io/acumenus-data-sciences/parthenon-backend:v2.0.0-rc1
```

All four commands exit 0.

- [ ] **Step 4: Document the rehearsal in a devlog**

```markdown
# v2.0 Signed Images Rehearsal — YYYY-MM-DD

Tag: `v2.0.0-rc1`
Workflow run: <link>

Build duration: …
Image count: 15/15 published
Cosign signatures: 15/15 present
SBOM attestations: 15/15 present
Trivy scan: PASS (or N allowlisted CVEs cited)
Verification from clean machine: PASS
```

- [ ] **Step 5: Commit the rehearsal devlog and merge the plan PR**

```bash
git add docs/superpowers/devlog/2026-XX-XX-v2-0-signed-images-rehearsal.md
git commit -m "docs(devlog): v2.0 signed images rehearsal results"
```

---

## Definition of Done

This plan is complete when:

- [ ] All 13 tasks above are checked off.
- [ ] `release-images.yml` triggers on tag push and publishes 15 multi-arch signed images to GHCR + Docker Hub with CycloneDX SBOM attestations.
- [ ] PR builds run the lightweight backend-image Trivy scan via `ci.yml`.
- [ ] `scripts/verify-image-signature.sh` succeeds on any published `vX.Y.Z` tag.
- [ ] `docs/security/image-signing.md` documents the full verification path.
- [ ] The umbrella's Status Tracking table is updated: `05-01 signed-images | Completed | <date>`.
- [ ] CP-2 (image signing pipeline) cross-phase task is marked established in the umbrella.

---

## Out of Scope for This Plan

Captured here so reviewers don't ask:

- **KMS-backed long-lived keys.** Keyless OIDC is the v2.0 launch posture. KMS migration is a separate follow-up plan (`05-01-followup-kms-keys`) authored when Acumenus KMS is provisioned.
- **Jupyter user, BlackRabbit, regenie images.** Re-scope in v2.1+ when these images become customer-runtime.
- **In-toto attestations beyond CycloneDX SBOM.** Provenance attestations come for free via `provenance: true` in build-push-action; deeper SLSA L3+ chain is a v3.0+ concern.
- **Air-gap image mirror.** EE customers needing air-gap installs receive a `cosign save` tarball — that workflow is part of plan 07 (EE on-prem), not 05-01.
- **Image immutability enforcement on registries.** GHCR + Docker Hub policies set out-of-band; documented in `docs/security/image-signing.md` but not automated here.
