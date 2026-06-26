#!/usr/bin/env bash
#
# scan-provider-secrets.sh — fail-closed scan for committed AI provider secrets.
#
# Part of the Abby Provider Entitlements plan (Section 0, Governance & Secret
# Hygiene). Greps tracked files (and, when present, generated docs under
# docs/dist) for live provider key shapes. Exits non-zero on any hit so it can
# run in CI or pre-commit. Placeholder/example keys are expected to use the
# `<...>` / `your-...-key` / `sk-ant-xxxx` forms, which are NOT matched.
#
# Usage:
#   scripts/security/scan-provider-secrets.sh          # scan tracked files
#   scripts/security/scan-provider-secrets.sh --docs   # also scan docs/dist
#
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Live-secret shapes. Anthropic keys are sk-ant-…; OpenAI project keys sk-proj-…;
# OpenAI legacy sk-[A-Za-z0-9]{32,}; bare provider env assignments to a real value.
PATTERNS=(
  'sk-ant-[A-Za-z0-9_-]{20,}'
  'sk-proj-[A-Za-z0-9_-]{20,}'
  'sk-[A-Za-z0-9]{32,}'
  '(ANTHROPIC|OPENAI|CLAUDE|DEEPSEEK|MOONSHOT|MISTRAL|QWEN|GEMINI)_API_KEY=[^<"[:space:]]{12,}'
)

# Placeholder forms we explicitly allow (never a real secret).
# Placeholder/interpolation forms that are never a real secret: docs placeholders,
# masked values, and `${VAR}` / `$VAR` shell+compose interpolation.
ALLOW='your-|xxxx|example|placeholder|REDACTED|<[^>]*>|changeme|sk-ant-xxxx|\*\*\*|\$\{|=\$[A-Za-z]'

EXCLUDES=(':!vendor' ':!*.lock' ':!*.min.js' ':!*.map' ':!*.example' ':!*.env.example' ':!*.env.testing')

scan_target() {
  local label="$1"; shift
  local hits
  for pat in "${PATTERNS[@]}"; do
    if hits=$(git grep -nIE "$pat" -- "$@" 2>/dev/null | grep -vE "$ALLOW" || true); [ -n "$hits" ]; then
      echo "✗ Potential live secret in $label:"
      echo "$hits"
      return 1
    fi
  done
  return 0
}

status=0
scan_target "tracked files" "${EXCLUDES[@]}" || status=1

if [ "${1:-}" = "--docs" ] && [ -d docs/dist ]; then
  while IFS= read -r -d '' f; do
    for pat in "${PATTERNS[@]}"; do
      if grep -nIE "$pat" "$f" 2>/dev/null | grep -vqE "$ALLOW"; then
        echo "✗ Potential live secret in generated docs: $f"
        status=1
      fi
    done
  done < <(find docs/dist -type f -print0)
fi

if [ "$status" -eq 0 ]; then
  echo "✓ No live provider secrets detected in tracked files."
fi
exit "$status"
