#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
DOCS_ROOT="$SCRIPT_DIR/../docs"

FAILED=0

report_bad_path() {
  path="$1"
  reason="$2"
  printf 'Invalid docs content path: %s\n' "$path" >&2
  printf '  %s\n' "$reason" >&2
  FAILED=1
}

if [ -d "$DOCS_ROOT/docs" ]; then
  report_bad_path "docs/site/docs/docs/" "docs/site/docs is already the Docusaurus content root; nested docs/ usually means a sync copied a repo-relative path into the content root."
fi

if [ -d "$DOCS_ROOT/site" ]; then
  report_bad_path "docs/site/docs/site/" "Generated Docusaurus site files do not belong under the docs content root."
fi

GENERATED_DIRS_FILE=$(mktemp)
trap 'rm -f "$GENERATED_DIRS_FILE"' EXIT
find "$DOCS_ROOT" -type d \( -name .docusaurus -o -name build -o -name node_modules \) -print > "$GENERATED_DIRS_FILE"
if [ -s "$GENERATED_DIRS_FILE" ]; then
  while IFS= read -r path; do
    report_bad_path "${path#$SCRIPT_DIR/../}" "Generated build/dependency directories must stay outside docs content."
  done < "$GENERATED_DIRS_FILE"
fi

if [ "$FAILED" -ne 0 ]; then
  printf '\nMove real docs to docs/site/docs/<section>/... and remove the nested generated or repo-root directories before building.\n' >&2
  exit 1
fi

printf 'Docs content tree OK\n'
