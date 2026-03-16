#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${SDK_DIR}/dist"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "${TMP_ROOT}"' EXIT

VERSION="$(python3 - <<'PY'
import json
from pathlib import Path
manifest = json.loads(Path("community-workbench-sdk/MANIFEST.json").read_text())
print(manifest["starter_version"])
PY
)"

PACKAGE_NAME="community-workbench-sdk-v${VERSION}"
STAGE_DIR="${TMP_ROOT}/${PACKAGE_NAME}"
ZIP_PATH="${DIST_DIR}/${PACKAGE_NAME}.zip"

mkdir -p "${DIST_DIR}"
mkdir -p "${STAGE_DIR}"

cp "${SDK_DIR}/README.md" "${STAGE_DIR}/README.md"
cp "${SDK_DIR}/MANIFEST.json" "${STAGE_DIR}/MANIFEST.json"
cp -R "${SDK_DIR}/contracts" "${STAGE_DIR}/contracts"
cp -R "${SDK_DIR}/docs" "${STAGE_DIR}/docs"
cp -R "${SDK_DIR}/examples" "${STAGE_DIR}/examples"
cp -R "${SDK_DIR}/generated-samples" "${STAGE_DIR}/generated-samples"
cp -R "${SDK_DIR}/scripts" "${STAGE_DIR}/scripts"
cp -R "${SDK_DIR}/templates" "${STAGE_DIR}/templates"

rm -f "${ZIP_PATH}"

(
  cd "${TMP_ROOT}"
  zip -qr "${ZIP_PATH}" "${PACKAGE_NAME}"
)

echo "Packaged SDK at ${ZIP_PATH}"
