#!/usr/bin/env bash
# Hypertension v3 study runner — shared helpers.
# Sourced by run.sh; not executed directly.
#
# Token lifecycle: mint_token at phase start, revoke_token via EXIT trap.
# The plain-text token lives only in this process's memory. Never written to disk.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$REPO_ROOT/scripts/htn-v3"
REPORT_DIR="$REPO_ROOT/docs/research/hypertension-v3/reports"

# Defaults (overridable via env or scripts/htn-v3/.env)
API_BASE="${API_BASE:-https://parthenon.acumenus.net/api/v1}"
STUDY_SLUG="${STUDY_SLUG:-hypertension-study-v3-2}"
SOURCE_KEY="${SOURCE_KEY:-ACUMENUS}"
RUNNER_EMAIL="${RUNNER_EMAIL:-admin@acumenus.net}"

# Optional .env (non-secret config only)
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
fi

mkdir -p "$REPORT_DIR"

ACCEPT_HEADER="Accept: application/json"
CONTENT_HEADER="Content-Type: application/json"

TOKEN_ID=""
HTN_V3_TOKEN=""

# --- Token lifecycle -------------------------------------------------------

mint_token() {
  local label="htn-v3-runner-$(date +%s)"
  # tinker --execute= treats single-quoted args literally; double quotes here
  # are fine because the only $ we want bash to expand are $label and PHP_EOL handles itself.
  local script
  script=$(cat <<PHPEOF
\$user = App\\Models\\User::where('email', '${RUNNER_EMAIL}')->first();
if (!\$user) { echo 'NO_USER' . PHP_EOL; exit; }
\$t = \$user->createToken('${label}', ['*'], now()->addMinutes(60));
echo 'TOK=' . \$t->accessToken->id . '|' . \$t->plainTextToken . PHP_EOL;
PHPEOF
)
  local raw
  raw=$(docker compose exec -T php php artisan tinker --execute="$script" 2>/dev/null | grep '^TOK=' | tail -1)
  if [[ -z "$raw" ]]; then
    echo "FATAL: token mint failed for ${RUNNER_EMAIL}" >&2
    return 1
  fi
  raw="${raw#TOK=}"
  TOKEN_ID="${raw%%|*}"
  HTN_V3_TOKEN="${raw#*|}"
  echo "Token minted: id=$TOKEN_ID  email=${RUNNER_EMAIL}  ttl=60m" >&2
}

revoke_token() {
  local rc=$?
  if [[ -n "${TOKEN_ID:-}" ]]; then
    docker compose exec -T php php artisan tinker --execute="Laravel\\Sanctum\\PersonalAccessToken::find(${TOKEN_ID})?->delete();" >/dev/null 2>&1 || true
    echo "Token id=$TOKEN_ID revoked" >&2
    TOKEN_ID=""
    HTN_V3_TOKEN=""
  fi
  return $rc
}
trap revoke_token EXIT

# --- HTTP helpers (use the in-memory token, never echo it) -----------------

_curl_auth() {
  curl -fsS -m 120 -H "Authorization: Bearer ${HTN_V3_TOKEN}" -H "$ACCEPT_HEADER" "$@"
}

api_get() {
  local path="$1"; local out_path="${2:-}"
  local url="${API_BASE}${path}"
  local tmp; tmp="$(mktemp)"
  local status
  status=$(_curl_auth -o "$tmp" -w '%{http_code}' "$url" || echo "FAIL")
  echo "GET $path -> $status" >&2
  if [[ "$status" != "200" ]]; then
    echo "FAILED body:" >&2; cat "$tmp" >&2; rm -f "$tmp"; return 1
  fi
  [[ -n "$out_path" ]] && { mkdir -p "$(dirname "$out_path")"; cp "$tmp" "$out_path"; }
  cat "$tmp"; rm -f "$tmp"
}

api_post() {
  local path="$1"; local body="$2"; local out_path="${3:-}"
  local url="${API_BASE}${path}"
  local tmp body_file; tmp="$(mktemp)"; body_file="$(mktemp)"
  printf '%s' "$body" > "$body_file"
  local status
  status=$(_curl_auth -X POST -H "$CONTENT_HEADER" --data-binary "@$body_file" -o "$tmp" -w '%{http_code}' "$url" || echo "FAIL")
  rm -f "$body_file"
  echo "POST $path -> $status" >&2
  if [[ "$status" != "200" && "$status" != "201" && "$status" != "202" ]]; then
    echo "FAILED body:" >&2; cat "$tmp" >&2; rm -f "$tmp"; return 1
  fi
  [[ -n "$out_path" ]] && { mkdir -p "$(dirname "$out_path")"; cp "$tmp" "$out_path"; }
  cat "$tmp"; rm -f "$tmp"
}

api_put() {
  local path="$1"; local body="$2"
  local url="${API_BASE}${path}"
  local tmp body_file; tmp="$(mktemp)"; body_file="$(mktemp)"
  printf '%s' "$body" > "$body_file"
  local status
  status=$(_curl_auth -X PUT -H "$CONTENT_HEADER" --data-binary "@$body_file" -o "$tmp" -w '%{http_code}' "$url" || echo "FAIL")
  rm -f "$body_file"
  echo "PUT $path -> $status" >&2
  if [[ "$status" != "200" && "$status" != "204" ]]; then
    echo "FAILED body:" >&2; cat "$tmp" >&2; rm -f "$tmp"; return 1
  fi
  cat "$tmp"; rm -f "$tmp"
}

require_jq() {
  command -v jq >/dev/null 2>&1 || { echo "ERROR: jq required (sudo apt install jq)" >&2; exit 2; }
}
