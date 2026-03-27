#!/bin/sh
# Fix empty sidebar_label / title / label in generated OpenAPI docs.
# The docusaurus-plugin-openapi-docs leaves these empty when the OpenAPI
# spec operation lacks a 'summary' field. This script derives labels
# from the className method and the doc id.
#
# Runs in node:22-alpine (no python3) — uses pure sh + sed + awk.
#
# Usage: sh scripts/fix-api-docs-labels.sh

API_DIR="$(dirname "$0")/../docs/api"

if [ ! -d "$API_DIR" ]; then
  echo "No docs/api directory found — run gen-api-docs first"
  exit 0
fi

# Helper: convert id to label given method and id
# e.g., method=POST, id=post-api-v-1-auth-login -> POST /api/v1/auth/login
make_label() {
  _method="$1"
  _id="$2"
  _method_lower=$(echo "$_method" | tr '[:upper:]' '[:lower:]')
  _method_upper=$(echo "$_method" | tr '[:lower:]' '[:upper:]')
  # Strip method prefix from id
  _path=$(echo "$_id" | sed "s/^${_method_lower}-//" | sed 's/-/\//g' | sed 's/\/v\/1/\/v1/g' | sed 's/\/v\/2/\/v2/g')
  echo "${_method_upper} /${_path}"
}

# ── Fix MDX frontmatter ──────────────────────────────────────────────────
mdx_count=0
for f in "$API_DIR"/*.api.mdx; do
  [ -f "$f" ] || continue

  if grep -q 'sidebar_label: ""' "$f"; then
    method=$(grep 'sidebar_class_name:' "$f" | head -1 | sed 's/.*"\([a-z]*\) api-method".*/\1/')
    id=$(grep '^id: ' "$f" | head -1 | sed 's/^id: //')
    label=$(make_label "$method" "$id")
    sed -i "s|^title: \"\"$|title: \"${label}\"|" "$f"
    sed -i "s|^sidebar_label: \"\"$|sidebar_label: \"${label}\"|" "$f"
    mdx_count=$((mdx_count + 1))
  fi
done
echo "Fixed ${mdx_count} MDX files with empty labels"

# ── Fix sidebar.ts empty labels ──────────────────────────────────────────
SIDEBAR="$API_DIR/sidebar.ts"
if [ -f "$SIDEBAR" ] && grep -q 'label: ""' "$SIDEBAR"; then
  sidebar_count=0

  # Use awk to process the sidebar.ts file
  # Look for patterns: id: "api/METHOD-...", followed by label: "",
  # followed by className: "api-method METHOD"
  awk '
  /id: "api\// {
    id_line = $0
    # Extract id value
    match(id_line, /id: "api\/([^"]+)"/, arr)
    if (arr[1] != "") {
      saved_id = arr[1]
    }
  }
  /label: ""/ {
    # This is an empty label line — save it, fix it after we see className
    empty_label_line = NR
    saved_label_line = $0
  }
  /className: "api-method/ {
    if (empty_label_line == NR - 1 && saved_id != "") {
      # Extract method from className
      match($0, /api-method ([a-z]+)/, marr)
      method = toupper(marr[1])
      # Build path from id
      path = saved_id
      # Strip method prefix
      sub("^" tolower(method) "-", "", path)
      gsub("-", "/", path)
      gsub("/v/1", "/v1", path)
      gsub("/v/2", "/v2", path)
      label = method " /" path
      # Print the fixed label line
      sub(/label: ""/, "label: \"" label "\"", saved_label_line)
      # We already printed the id line, now print fixed label
    }
  }
  { print }
  ' "$SIDEBAR" > "${SIDEBAR}.tmp"

  # That awk approach is complex. Simpler: use sed with a node.js one-liner.
  # Since we are in a node container, use node.
  node -e "
    const fs = require('fs');
    let content = fs.readFileSync('$SIDEBAR', 'utf8');
    let count = 0;
    // Match id + label + className blocks
    content = content.replace(
      /id: \"api\/([^\"]+)\",\s*\n\s*label: \"\",\s*\n\s*className: \"api-method ([a-z]+)\"/g,
      (match, id, method) => {
        const methodUpper = method.toUpperCase();
        let path = id.replace(new RegExp('^' + method + '-'), '');
        path = path.replace(/-/g, '/').replace(/\/v\/1/g, '/v1').replace(/\/v\/2/g, '/v2');
        const label = methodUpper + ' /' + path;
        count++;
        return 'id: \"api/' + id + '\",\n      label: \"' + label + '\",\n      className: \"api-method ' + method + '\"';
      }
    );
    fs.writeFileSync('$SIDEBAR', content);
    console.log('Fixed ' + count + ' sidebar entries with empty labels');
  "

  # Clean up temp file if it exists
  rm -f "${SIDEBAR}.tmp"
fi
