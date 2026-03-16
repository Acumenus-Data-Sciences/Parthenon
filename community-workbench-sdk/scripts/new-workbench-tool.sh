#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATES_DIR="${SDK_DIR}/templates"

usage() {
  cat <<'EOF'
Usage:
  new-workbench-tool.sh \
    --tool-id TOOL_ID \
    --display-name DISPLAY_NAME \
    --description DESCRIPTION \
    --domain DOMAIN \
    --mode MODE \
    --route-slug ROUTE_SLUG \
    --env-prefix ENV_PREFIX \
    --output-dir OUTPUT_DIR

Required arguments:
  --tool-id        snake_case identifier, e.g. genomics_variant_browser
  --display-name   human-readable name, e.g. "Variant Browser"
  --description    short description used in generated metadata
  --domain         domain/workspace category, e.g. genomics
  --mode           external-adapter or native
  --route-slug     route segment, e.g. variant-browser
  --env-prefix     env prefix, e.g. GENOMICS_VARIANT_BROWSER
  --output-dir     directory where the generated scaffold will be written

Notes:
  - This script generates a scaffold only. It does not modify host repo files.
  - Review all generated files before wiring them into Parthenon.
EOF
}

TOOL_ID=""
DISPLAY_NAME=""
DESCRIPTION=""
DOMAIN=""
MODE=""
ROUTE_SLUG=""
ENV_PREFIX=""
OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tool-id)
      TOOL_ID="${2:-}"
      shift 2
      ;;
    --display-name)
      DISPLAY_NAME="${2:-}"
      shift 2
      ;;
    --description)
      DESCRIPTION="${2:-}"
      shift 2
      ;;
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --route-slug)
      ROUTE_SLUG="${2:-}"
      shift 2
      ;;
    --env-prefix)
      ENV_PREFIX="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${TOOL_ID}" || -z "${DISPLAY_NAME}" || -z "${DESCRIPTION}" || -z "${DOMAIN}" || -z "${MODE}" || -z "${ROUTE_SLUG}" || -z "${ENV_PREFIX}" || -z "${OUTPUT_DIR}" ]]; then
  echo "Missing required arguments." >&2
  usage >&2
  exit 1
fi

if [[ "${MODE}" != "external-adapter" && "${MODE}" != "native" ]]; then
  echo "--mode must be external-adapter or native" >&2
  exit 1
fi

to_pascal_case() {
  local input="$1"
  local output=""
  IFS='_- ' read -r -a parts <<< "${input}"
  for part in "${parts[@]}"; do
    if [[ -n "${part}" ]]; then
      output+="${part^}"
    fi
  done
  printf '%s' "${output}"
}

CLASS_NAME="$(to_pascal_case "${TOOL_ID}")"
TYPE_NAME="${CLASS_NAME}"
TARGET_DIR="${OUTPUT_DIR%/}/${TOOL_ID}"

mkdir -p "${TARGET_DIR}"

render_template() {
  local source_path="$1"
  local destination_path="$2"

  sed \
    -e "s|__TOOL_ID__|${TOOL_ID}|g" \
    -e "s|__DISPLAY_NAME__|${DISPLAY_NAME}|g" \
    -e "s|__DESCRIPTION__|${DESCRIPTION}|g" \
    -e "s|__DOMAIN__|${DOMAIN}|g" \
    -e "s|__MODE__|${MODE}|g" \
    -e "s|__ROUTE_SLUG__|${ROUTE_SLUG}|g" \
    -e "s|__ENV_PREFIX__|${ENV_PREFIX}|g" \
    -e "s|__CLASS_NAME__|${CLASS_NAME}|g" \
    -e "s|__TYPE_NAME__|${TYPE_NAME}|g" \
    "${source_path}" > "${destination_path}"
}

mkdir -p "${TARGET_DIR}/templates"
mkdir -p "${TARGET_DIR}/contracts"
mkdir -p "${TARGET_DIR}/docs"

cp "${SDK_DIR}/MANIFEST.json" "${TARGET_DIR}/MANIFEST.json"
cp "${SDK_DIR}/contracts/"*.json "${TARGET_DIR}/contracts/"
cp "${SDK_DIR}/docs/AI_ASSISTANT_GUIDE.md" "${TARGET_DIR}/docs/AI_ASSISTANT_GUIDE.md"
cp "${SDK_DIR}/docs/ASSET_INDEX.md" "${TARGET_DIR}/docs/ASSET_INDEX.md"

cat > "${TARGET_DIR}/README.md" <<EOF
# ${DISPLAY_NAME}

Generated from the Parthenon Community Workbench SDK.

## Tool Metadata

- Tool ID: \`${TOOL_ID}\`
- Display Name: \`${DISPLAY_NAME}\`
- Description: ${DESCRIPTION}
- Domain: \`${DOMAIN}\`
- Mode: \`${MODE}\`
- Route Slug: \`${ROUTE_SLUG}\`
- Env Prefix: \`${ENV_PREFIX}\`

## Next Steps

1. Review the generated templates in \`templates/\`.
2. Wire the service metadata into \`study-agent/docs/SERVICE_REGISTRY.yaml\`.
3. Register the MCP module in \`study-agent/mcp_server/study_agent_mcp/tools/__init__.py\`.
4. Add the backend controller/service and route.
5. Add the frontend route and page.
6. Replace starter payloads with real tool logic.
7. Validate your payloads against the schemas in \`contracts/\`.

## AI Assistant Support

If you are using an AI coding assistant, read \`docs/AI_ASSISTANT_GUIDE.md\` before modifying the scaffold.
EOF

cat > "${TARGET_DIR}/docs/START_HERE.md" <<EOF
# ${DISPLAY_NAME}: Generated Scaffold Guide

This scaffold was generated from the Community Workbench SDK.

## What Was Generated

- service registry fragment template
- StudyAgent MCP tool stub
- Laravel controller and service stubs
- frontend page and types stubs
- shared contract schemas

## What Still Requires Manual Integration

- add the service registry entry to the host repo
- register the generated MCP tool module
- add backend routes and dependency wiring
- add frontend route registration
- add tests and any persisted run support

## Generated Naming

- Tool ID: \`${TOOL_ID}\`
- PHP Class Base: \`${CLASS_NAME}\`
- TypeScript Base Type: \`${TYPE_NAME}\`

## Review Guidance

Inspect every generated file for:

- placeholder logic that still needs implementation
- response fields that must match your real upstream behavior
- source scoping and permission requirements
- replay/export expectations
EOF

render_template "${TEMPLATES_DIR}/service-registry.entry.yaml.tpl" "${TARGET_DIR}/templates/service-registry.entry.yaml"
render_template "${TEMPLATES_DIR}/mcp-tool.py.tpl" "${TARGET_DIR}/templates/${TOOL_ID}.py"
render_template "${TEMPLATES_DIR}/laravel-controller.php.tpl" "${TARGET_DIR}/templates/${CLASS_NAME}Controller.php"
render_template "${TEMPLATES_DIR}/laravel-service.php.tpl" "${TARGET_DIR}/templates/${CLASS_NAME}Service.php"
render_template "${TEMPLATES_DIR}/frontend-page.tsx.tpl" "${TARGET_DIR}/templates/${TYPE_NAME}Page.tsx"
render_template "${TEMPLATES_DIR}/frontend-types.ts.tpl" "${TARGET_DIR}/templates/${TYPE_NAME}.types.ts"

echo "Generated scaffold at ${TARGET_DIR}"
