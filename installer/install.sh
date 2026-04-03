#!/bin/sh
# Parthenon installer bootstrap — curl -fsSL https://install.acumenus.net | sh
set -e

REPO="sudoshi/Parthenon"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

die() { echo "Error: $*" >&2; exit 1; }

# Detect platform
OS=$(uname -s)
ARCH=$(uname -m)
case "$OS" in
  Linux)  PLATFORM="linux" ;;
  Darwin) PLATFORM="macos" ;;
  *)      die "Unsupported OS: $OS" ;;
esac

# Checksum command
if command -v sha256sum >/dev/null 2>&1; then
  SHASUM="sha256sum"
else
  SHASUM="shasum -a 256"
fi

# Get latest release tag
TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' | head -1 | sed 's/.*: "//;s/".*//')
[ -z "$TAG" ] && die "Could not determine latest release"
BASE="https://github.com/${REPO}/releases/download/${TAG}"

echo "Parthenon ${TAG} — downloading installer..."

# Try Cosmopolitan universal binary first, fall back to platform-specific
BINARY=""
for name in "acropolis-install.com" "acropolis-install-${PLATFORM}"; do
  if curl -fsSL -o "${TMPDIR}/${name}" "${BASE}/${name}" 2>/dev/null; then
    BINARY="${name}"
    break
  fi
done
[ -z "$BINARY" ] && die "Could not download installer binary for ${PLATFORM}/${ARCH}"

# Verify checksum
curl -fsSL -o "${TMPDIR}/checksums.sha256" "${BASE}/checksums.sha256" \
  || die "Could not download checksums"
(cd "$TMPDIR" && grep "$BINARY" checksums.sha256 | $SHASUM -c --quiet) \
  || die "Checksum verification failed for ${BINARY}"

chmod +x "${TMPDIR}/${BINARY}"
echo "Verified. Launching installer..."
exec "${TMPDIR}/${BINARY}" "$@"
