#!/bin/sh
# Parthenon source installer bootstrap:
#   curl -fsSL https://parthenon.acumenus.net/install.sh | sh
set -eu

REPO="sudoshi/Parthenon"
CLONE_URL="https://github.com/${REPO}.git"
DEFAULT_INSTALL_DIR="${HOME}/Parthenon"

INSTALL_DIR="${PARTHENON_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
REQUESTED_REF="${PARTHENON_VERSION:-}"
CLI_MODE=false

die() {
  echo "Error: $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage:
  install.sh [options] [-- <install.py args>]

Options:
  --version <ref>  Install a release tag, branch, or commit. Defaults to latest GitHub release.
  --dir <path>     Target checkout/extract directory. Defaults to ~/Parthenon.
  --cli            Run the terminal installer instead of the browser installer.
  -h, --help       Show this help text.

Examples:
  curl -fsSL https://parthenon.acumenus.net/install.sh | sh
  curl -fsSL https://parthenon.acumenus.net/install.sh | sh -s -- --version v1.0.6
  curl -fsSL https://parthenon.acumenus.net/install.sh | sh -s -- --cli -- --community
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version|--ref)
      [ "$#" -ge 2 ] || die "$1 requires a value"
      REQUESTED_REF="$2"
      shift 2
      ;;
    --dir)
      [ "$#" -ge 2 ] || die "--dir requires a value"
      INSTALL_DIR="$2"
      shift 2
      ;;
    --cli)
      CLI_MODE=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required but was not found on PATH"
}

need_cmd curl
need_cmd tar

if command -v python3 >/dev/null 2>&1; then
  PYTHON="${PYTHON:-python3}"
elif command -v python >/dev/null 2>&1; then
  PYTHON="${PYTHON:-python}"
else
  die "Python 3.9+ is required. Install Python, then rerun this installer."
fi

latest_release_tag() {
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | head -n 1
}

if [ -z "$REQUESTED_REF" ]; then
  REQUESTED_REF="$(latest_release_tag || true)"
  [ -n "$REQUESTED_REF" ] || die "Could not determine the latest release tag. Rerun with --version <tag>."
fi

is_commit_ref() {
  case "$1" in
    *[!0123456789abcdefABCDEF]*)
      return 1
      ;;
    *)
      [ "${#1}" -ge 7 ] && [ "${#1}" -le 40 ]
      ;;
  esac
}

archive_url_for_ref() {
  case "$1" in
    v[0-9]*|refs/tags/*)
      REF_NAME="${1#refs/tags/}"
      echo "https://github.com/${REPO}/archive/refs/tags/${REF_NAME}.tar.gz"
      ;;
    main|master|release/*|refs/heads/*)
      REF_NAME="${1#refs/heads/}"
      echo "https://github.com/${REPO}/archive/refs/heads/${REF_NAME}.tar.gz"
      ;;
    *)
      if is_commit_ref "$1"; then
        echo "https://github.com/${REPO}/archive/${1}.tar.gz"
      else
        echo "https://github.com/${REPO}/archive/refs/tags/${1}.tar.gz"
      fi
      ;;
  esac
}

ensure_clean_git_checkout() {
  if ! git -C "$INSTALL_DIR" diff --quiet --ignore-submodules HEAD --; then
    die "$INSTALL_DIR has uncommitted changes. Commit, stash, or choose --dir <new-path>."
  fi
  if ! git -C "$INSTALL_DIR" diff --cached --quiet --ignore-submodules --; then
    die "$INSTALL_DIR has staged changes. Commit, stash, or choose --dir <new-path>."
  fi
}

checkout_existing_repo() {
  ensure_clean_git_checkout
  echo "Updating existing Parthenon checkout at ${INSTALL_DIR}..."
  git -C "$INSTALL_DIR" fetch --tags --prune origin

  if git -C "$INSTALL_DIR" rev-parse --verify --quiet "refs/tags/${REQUESTED_REF}^{commit}" >/dev/null; then
    git -C "$INSTALL_DIR" checkout --detach "refs/tags/${REQUESTED_REF}"
  elif git -C "$INSTALL_DIR" rev-parse --verify --quiet "origin/${REQUESTED_REF}^{commit}" >/dev/null; then
    git -C "$INSTALL_DIR" checkout --detach "origin/${REQUESTED_REF}"
  elif is_commit_ref "$REQUESTED_REF"; then
    git -C "$INSTALL_DIR" checkout --detach "$REQUESTED_REF"
  else
    die "Could not resolve ${REQUESTED_REF} in the existing checkout."
  fi
}

clone_repo() {
  echo "Cloning Parthenon ${REQUESTED_REF} into ${INSTALL_DIR}..."
  if git clone --depth 1 --branch "$REQUESTED_REF" "$CLONE_URL" "$INSTALL_DIR"; then
    return 0
  fi

  rm -rf "$INSTALL_DIR"
  return 1
}

extract_archive() {
  TMPDIR="$(mktemp -d)"
  trap 'rm -rf "$TMPDIR"' EXIT INT TERM

  ARCHIVE_URL="$(archive_url_for_ref "$REQUESTED_REF")"
  echo "Downloading Parthenon source from ${ARCHIVE_URL}..."
  curl -fL -o "${TMPDIR}/parthenon-source.tar.gz" "$ARCHIVE_URL"
  tar xzf "${TMPDIR}/parthenon-source.tar.gz" -C "$TMPDIR"

  SRC_DIR="$(find "$TMPDIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  [ -n "$SRC_DIR" ] || die "Downloaded source archive was empty."

  mkdir -p "$INSTALL_DIR"
  (cd "$SRC_DIR" && tar cf - .) | (cd "$INSTALL_DIR" && tar xpf -)
  printf '%s\n' "$REQUESTED_REF" > "$INSTALL_DIR/.parthenon-source-ref"
}

acquire_source() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    checkout_existing_repo
    return
  fi

  if [ -e "$INSTALL_DIR" ]; then
    if [ -f "$INSTALL_DIR/install.py" ] && [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
      if [ -f "$INSTALL_DIR/.parthenon-source-ref" ]; then
        EXISTING_REF="$(sed -n '1p' "$INSTALL_DIR/.parthenon-source-ref")"
        if [ "$EXISTING_REF" = "$REQUESTED_REF" ]; then
          echo "Using existing Parthenon source tree at ${INSTALL_DIR}."
          return
        fi
        die "$INSTALL_DIR contains Parthenon source for ${EXISTING_REF}. Choose --dir <new-path> for ${REQUESTED_REF}."
      fi
      die "$INSTALL_DIR already contains a Parthenon source tree. Run install.py there or choose --dir <new-path>."
    fi
    die "$INSTALL_DIR already exists and is not a Parthenon source tree. Choose --dir <new-path>."
  fi

  if command -v git >/dev/null 2>&1; then
    clone_repo || extract_archive
  else
    extract_archive
  fi
}

case "$(uname -s)" in
  Linux|Darwin)
    ;;
  *)
    die "Unsupported OS. On Windows, run this from a WSL 2 Linux shell."
    ;;
esac

echo "Parthenon ${REQUESTED_REF} source installer"
acquire_source

[ -f "$INSTALL_DIR/install.py" ] || die "install.py is missing from ${INSTALL_DIR}"

cd "$INSTALL_DIR"
if [ "$CLI_MODE" = true ]; then
  echo "Launching terminal installer from ${INSTALL_DIR}..."
  exec "$PYTHON" install.py "$@"
fi

echo "Launching browser installer from ${INSTALL_DIR}..."
exec "$PYTHON" install.py --webapp "$@"
