#!/bin/sh
# Parthenon installer bootstrap — curl -fsSL https://parthenon.acumenus.net/install.sh | sh
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

case "$PLATFORM" in
  linux)
    ASSET="acropolis-install-linux.tar.gz"
    BINARY="acropolis-install"
    ;;
  macos)
    ASSET="acropolis-install-macos.zip"
    BINARY="acropolis-install.com"
    ;;
esac

curl -fsSL -o "${TMPDIR}/${ASSET}" "${BASE}/${ASSET}" \
  || die "Could not download installer package for ${PLATFORM}/${ARCH}"

# Verify checksum
curl -fsSL -o "${TMPDIR}/checksums.sha256" "${BASE}/checksums.sha256" \
  || die "Could not download checksums"
(cd "$TMPDIR" && grep "$ASSET" checksums.sha256 | $SHASUM -c --quiet) \
  || die "Checksum verification failed for ${ASSET}"

case "$PLATFORM" in
  linux)
    tar xzf "${TMPDIR}/${ASSET}" -C "$TMPDIR" \
      || die "Could not extract ${ASSET}"
    ;;
  macos)
    unzip -q "${TMPDIR}/${ASSET}" -d "$TMPDIR" \
      || die "Could not extract ${ASSET}"
    ;;
esac

[ -f "${TMPDIR}/${BINARY}" ] || die "Installer binary missing from ${ASSET}"
chmod +x "${TMPDIR}/${BINARY}" || die "Could not mark installer executable"

echo "Verified. Launching installer..."
exec "${TMPDIR}/${BINARY}" "$@"
