#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)

FAILED=0

report_matches() {
  title="$1"
  matches="$2"
  if [ -n "$matches" ]; then
    printf '%s\n' "$title" >&2
    printf '%s\n' "$matches" >&2
    printf '\n' >&2
    FAILED=1
  fi
}

require_file_contains() {
  file="$1"
  pattern="$2"
  description="$3"
  if [ ! -f "$file" ]; then
    printf 'Missing required public docs file: %s\n\n' "${file#$REPO_ROOT/}" >&2
    FAILED=1
    return
  fi
  if ! grep -Eq -- "$pattern" "$file"; then
    printf 'Public docs guard failed: %s\n' "$description" >&2
    printf '  File: %s\n\n' "${file#$REPO_ROOT/}" >&2
    FAILED=1
  fi
}

forbid_file_contains() {
  file="$1"
  pattern="$2"
  description="$3"
  if [ ! -f "$file" ]; then
    return
  fi
  matches=$(grep -nE -- "$pattern" "$file" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    printf 'Public docs guard failed: %s\n' "$description" >&2
    printf '  File: %s\n' "${file#$REPO_ROOT/}" >&2
    printf '%s\n\n' "$matches" >&2
    FAILED=1
  fi
}

ACTIVE_PUBLIC_PATHS="
$REPO_ROOT/docs/site/docs
$REPO_ROOT/docs/blog
$REPO_ROOT/frontend/public/install
$REPO_ROOT/installer/web
$REPO_ROOT/installer/rust-gui/src/main.rs
$REPO_ROOT/installer/rust-gui/ui
$REPO_ROOT/installer/rust-gui/polkit
"

STALE_ORG=$(grep -RInE \
  'github\.com/sudoshi/Parthenon|sudoshi/Parthenon|ghcr\.io/sudoshi/parthenon' \
  $ACTIVE_PUBLIC_PATHS 2>/dev/null \
  | grep -v 'docs/blog/2026-05-10-v1-0-7-release-notes.md' \
  || true)
report_matches \
  'Found stale sudoshi/Parthenon references in active public docs or installer surfaces. Historical org-transfer references are only allowed in the v1.0.7 release notes.' \
  "$STALE_ORG"

STALE_LICENSE=$(grep -RInE \
  'Source code:.*Apache 2\.0|free under Apache 2\.0|open[- ]source under( the)? Apache 2\.0( license)?|licensed under Apache 2\.0' \
  "$REPO_ROOT/docs/site/docs" "$REPO_ROOT/docs/blog" 2>/dev/null \
  || true)
report_matches \
  'Found stale public Apache 2.0 license claims. Current CE releases are AGPL-3.0-only; historical posts may mention Apache 2.0 only with current-license context.' \
  "$STALE_LICENSE"

INSTALL_WALKTHROUGH="$REPO_ROOT/docs/site/docs/install/community-installer-walkthrough.mdx"
VERIFY_SOURCE="$REPO_ROOT/docs/site/docs/install/verifying-signatures.mdx"
NO_TELEMETRY="$REPO_ROOT/docs/site/docs/install/no-telemetry.mdx"
TRUST_CHECKS="$REPO_ROOT/docs/site/docs/install/first-launch-trust.mdx"
KEY_ROTATION="$REPO_ROOT/docs/site/docs/install/key-rotation.mdx"
GETTING_STARTED="$REPO_ROOT/docs/site/docs/part1-getting-started/00b-installation.mdx"
PUBLIC_INSTALL="$REPO_ROOT/frontend/public/install/index.html"
PACKAGED_INSTALL="$REPO_ROOT/installer/web/install-landing.html"

require_file_contains "$INSTALL_WALKTHROUGH" 'Public Community releases are source-only' 'install walkthrough must identify current Community releases as source-only'
require_file_contains "$INSTALL_WALKTHROUGH" 'https://parthenon\.acumenus\.net/install\.sh \| sh' 'install walkthrough must include the supported public bootstrap command'
require_file_contains "$INSTALL_WALKTHROUGH" 'Windows installs run inside WSL 2' 'install walkthrough must keep the Windows WSL 2 support boundary'
require_file_contains "$INSTALL_WALKTHROUGH" 'github\.com/Acumenus-Data-Sciences/Parthenon' 'install walkthrough must link to the canonical Acumenus repository'
forbid_file_contains "$INSTALL_WALKTHROUGH" 'Download `Parthenon-Installer-|SIGNING-KEY\.asc|gh attestation verify|--owner sudoshi' 'install walkthrough must not resurrect native binary/package verification instructions'

require_file_contains "$VERIFY_SOURCE" 'Current Parthenon Community releases are source-only' 'verification page must describe the current source-only release model'
require_file_contains "$VERIFY_SOURCE" 'frontend/public/install\.sh' 'verification page must compare the live bootstrap to the repo copy'
forbid_file_contains "$VERIFY_SOURCE" 'Every Parthenon Installer release artifact is signed|gh attestation verify|codesign --verify|Get-AuthenticodeSignature' 'verification page must not claim current binary artifact signing'

require_file_contains "$NO_TELEMETRY" 'zero.*telemetry connections' 'telemetry page must retain the zero-telemetry claim'
require_file_contains "$NO_TELEMETRY" 'parthenon\.acumenus\.net' 'telemetry page must name the public install host'
require_file_contains "$NO_TELEMETRY" 'api\.github\.com' 'telemetry page must name the GitHub latest-release API surface'
forbid_file_contains "$NO_TELEMETRY" 'github\.com/sudoshi/Parthenon|latest\.json.*24 h|tauri-plugin-updater' 'telemetry page must not describe stale sudoshi or native-updater network behavior as current'

require_file_contains "$TRUST_CHECKS" 'Source Installer Trust Checks' 'first-launch trust page must be source-installer trust guidance'
forbid_file_contains "$TRUST_CHECKS" 'Get-AuthenticodeSignature|codesign --verify|gpg --verify Parthenon-Installer|SIGNING-KEY\.asc' 'first-launch trust page must not contain current native binary verification commands'

require_file_contains "$KEY_ROTATION" 'lineage note for the paused native GUI installer track' 'updater key page must be framed as paused native-GUI lineage'
require_file_contains "$KEY_ROTATION" 'current public Parthenon Community install path is source-only' 'updater key page must state the active source-only path'
require_file_contains "$KEY_ROTATION" 'Use this page only when all of the following are true' 'updater key page must not read as active release instructions'

require_file_contains "$GETTING_STARTED" 'curl -fsSL https://parthenon\.acumenus\.net/install\.sh \| sh' 'getting-started install page must use the source bootstrap as quick start'
require_file_contains "$GETTING_STARTED" 'github\.com/Acumenus-Data-Sciences/Parthenon' 'getting-started install page must use the canonical Acumenus repository'
require_file_contains "$GETTING_STARTED" 'python3 install\.py --webapp' 'getting-started source checkout path must launch the webapp installer'

require_file_contains "$PUBLIC_INSTALL" 'Source-only releases' 'public /install/ landing page must keep source-only messaging'
require_file_contains "$PUBLIC_INSTALL" 'GitHub releases provide source code archives only' 'public /install/ landing page must not imply binary release assets are current'
require_file_contains "$PUBLIC_INSTALL" 'github\.com/Acumenus-Data-Sciences/Parthenon' 'public /install/ landing page must use the canonical Acumenus repository'
forbid_file_contains "$PUBLIC_INSTALL" 'github\.com/sudoshi/Parthenon|Download Rust GUI|checksums\.sha256' 'public /install/ landing page must not point at old repo or paused binary assets'

require_file_contains "$PACKAGED_INSTALL" 'Source-only releases' 'packaged install landing page must keep source-only messaging'
require_file_contains "$PACKAGED_INSTALL" 'GitHub releases provide source code archives only' 'packaged install landing page must not imply binary release assets are current'
require_file_contains "$PACKAGED_INSTALL" 'github\.com/Acumenus-Data-Sciences/Parthenon' 'packaged install landing page must use the canonical Acumenus repository'
forbid_file_contains "$PACKAGED_INSTALL" 'github\.com/sudoshi/Parthenon|Download Rust GUI|checksums\.sha256' 'packaged install landing page must not point at old repo or paused binary assets'

if [ "$FAILED" -ne 0 ]; then
  printf 'Public docs current-state guard failed.\n' >&2
  exit 1
fi

printf 'Public docs current-state guard OK\n'
