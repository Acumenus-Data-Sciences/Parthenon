#!/usr/bin/env bash
# Hypertension v3 study runner — entrypoint.
# Usage: scripts/htn-v3/run.sh <phase>
# Phases: preflight | discover | intent | phenotypes | concept-sets | cohorts |
#         feasibility | analysis-plans | lock | execute | report
#
# One phase per invocation. Each phase exits non-zero on failure.
# Outputs land in docs/research/hypertension-v3/reports/<phase>.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib.sh"

PHASE="${1:-}"
if [[ -z "$PHASE" ]]; then
  echo "Usage: $0 <phase>" >&2
  echo "Phases: preflight | discover | intent | phenotypes | concept-sets | cohorts | feasibility | analysis-plans | lock | execute | report" >&2
  exit 64
fi

require_jq
mint_token

case "$PHASE" in

  preflight)
    # Authenticated readiness check against production.
    USER_JSON=$(api_get "/auth/user" "$REPORT_DIR/preflight-auth.json")
    EMAIL=$(echo "$USER_JSON" | jq -r '.email')
    PERMS=$(echo "$USER_JSON" | jq -r '.permissions[]?' | sort -u | tr '\n' ',' | sed 's/,$//')
    ROLES=$(echo "$USER_JSON" | jq -r '.roles[]?' | sort -u | tr '\n' ',' | sed 's/,$//')
    echo "Authenticated as: $EMAIL"
    echo "Roles: $ROLES"
    echo "Permissions (sample): $(echo "$PERMS" | head -c 240)"
    echo "$PERMS" | grep -q 'studies.execute' || { echo "FAIL: token lacks studies.execute"; exit 1; }
    echo "$PERMS" | grep -q 'studies.create' || { echo "FAIL: token lacks studies.create"; exit 1; }
    echo "OK: token has studies.create + studies.execute"

    # Source resolution
    SRC_JSON=$(api_get "/sources" "$REPORT_DIR/preflight-sources.json")
    SOURCE_ID=$(echo "$SRC_JSON" | jq -r --arg key "$SOURCE_KEY" 'if type=="array" then .[] else .data[] end | select(.source_key==$key) | .id')
    [[ -n "$SOURCE_ID" ]] || { echo "FAIL: source_key=$SOURCE_KEY not found in production"; exit 1; }
    echo "OK: source $SOURCE_KEY -> ID $SOURCE_ID"
    echo "$SOURCE_ID" > "$REPORT_DIR/source-id"
    ;;

  discover)
    # Locate study, session, version state in production.
    [[ -f "$REPORT_DIR/source-id" ]] || { echo "Run preflight first."; exit 1; }
    SOURCE_ID=$(cat "$REPORT_DIR/source-id")

    STUDY_JSON=$(api_get "/studies/$STUDY_SLUG" "$REPORT_DIR/discover-study.json")
    STUDY_ID=$(echo "$STUDY_JSON" | jq -r 'if has("data") then .data.id else .id end')
    STUDY_STATUS=$(echo "$STUDY_JSON" | jq -r 'if has("data") then .data.status else .status end')
    echo "Study ID: $STUDY_ID"
    echo "Status: $STUDY_STATUS"
    echo "$STUDY_ID" > "$REPORT_DIR/study-id"

    # {study} route-binding is by slug
    SESSIONS_JSON=$(api_get "/studies/$STUDY_SLUG/design-sessions" "$REPORT_DIR/discover-sessions.json")
    SESSION_ID=$(echo "$SESSIONS_JSON" | jq -r 'if type=="array" then . else .data end | sort_by(.id) | last.id // empty')
    [[ -n "$SESSION_ID" ]] || { echo "FAIL: no design session"; exit 1; }
    echo "Session ID: $SESSION_ID"
    echo "$SESSION_ID" > "$REPORT_DIR/session-id"

    VERSIONS_JSON=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions" "$REPORT_DIR/discover-versions.json")
    echo "Versions:"
    echo "$VERSIONS_JSON" | jq -r '(if type=="array" then . else .data end) | .[] | "  v\(.version_number)  id=\(.id)  status=\(.status)  updated=\(.updated_at)"'

    ASSETS_JSON=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets" "$REPORT_DIR/discover-assets.json")
    echo "Asset breakdown (all versions):"
    echo "$ASSETS_JSON" | jq -r '(if type=="array" then . else .data end) | group_by([.asset_type,.status,.verification_status]) | .[] | "  \(.[0].asset_type) \(.[0].status)/\(.[0].verification_status)  count=\(length)"'
    ;;

  intent)
    # Phase 2: open fresh v2 via POST /intent (front-end equivalent of typing
    # a research question and clicking "Generate Intent"), then accept.
    [[ -f "$REPORT_DIR/session-id" ]] || { echo "Run discover first."; exit 1; }
    SESSION_ID=$(cat "$REPORT_DIR/session-id")

    # Idempotency: do we already have a v2?
    VERSIONS_JSON=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions")
    V2_ID=$(echo "$VERSIONS_JSON" | jq -r '(if type=="array" then . else .data end) | map(select(.version_number==2)) | sort_by(.id) | last.id // empty')

    if [[ -z "$V2_ID" ]]; then
      RQ=$(jq -nc --rawfile body "$SCRIPT_DIR/intent_research_question.txt" \
        '{research_question: $body}')
      CREATED=$(api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/intent" "$RQ" "$REPORT_DIR/intent-create.json")
      V2_ID=$(echo "$CREATED" | jq -r 'if has("data") then .data.id else .id end')
      echo "Created v2 (id=$V2_ID)"
    else
      echo "v2 already exists (id=$V2_ID) — reusing"
    fi
    echo "$V2_ID" > "$REPORT_DIR/version-id"

    # Check current v2 state
    V2_JSON=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions" "$REPORT_DIR/intent-v2-state.json")
    V2_STATUS=$(echo "$V2_JSON" | jq -r --arg id "$V2_ID" '(if type=="array" then . else .data end) | map(select(.id == ($id|tonumber)))[0].status')

    # Refine intent_json with the full PICO payload (idempotent — PUT just overwrites)
    PUT_BODY=$(jq -nc --slurpfile intent "$SCRIPT_DIR/intent_v2.json" '{intent_json: $intent[0]}')
    api_put "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions/$V2_ID" "$PUT_BODY" > /dev/null
    echo "Refined v2 intent_json"

    # Accept if not already accepted
    if [[ "$V2_STATUS" != "accepted" ]]; then
      api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions/$V2_ID/accept" "{}" "$REPORT_DIR/intent-accept.json" > /dev/null
      echo "Accepted v2 (was: $V2_STATUS)"
    else
      echo "v2 already accepted"
    fi

    # Print final state
    FINAL_JSON=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions" "$REPORT_DIR/intent-final.json")
    echo "v2 final state:"
    echo "$FINAL_JSON" | jq -r --arg id "$V2_ID" \
      '(if type=="array" then . else .data end) | map(select(.id == ($id|tonumber)))[0]
       | "  status=\(.status)\n  pico.population=\(.intent_json.pico.population[0:80] // "<blank>")...\n  pico.intervention=\(.intent_json.pico.intervention[0:80] // "<blank>")...\n  pico.outcome=\(.intent_json.pico.outcome[0:80] // "<blank>")...\n  analysis_family=\(.intent_json.analysis_family)\n  open_questions=\(.intent_json.open_questions | length)"'
    ;;

  phenotypes)
    # Phase 3: invoke PhenotypeRecommendationPanel's "Generate" button equivalent.
    [[ -f "$REPORT_DIR/session-id" && -f "$REPORT_DIR/version-id" ]] || { echo "Run intent first."; exit 1; }
    SESSION_ID=$(cat "$REPORT_DIR/session-id")
    V2_ID=$(cat "$REPORT_DIR/version-id")

    RECS=$(api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions/$V2_ID/phenotypes/recommend" "{}" "$REPORT_DIR/phenotypes-recommend.json")
    COUNT=$(echo "$RECS" | jq -r '(if type=="array" then . else .data end) | length')
    echo "Generated $COUNT phenotype recommendation assets"
    echo "$RECS" | jq -r '(if type=="array" then . else .data end) | .[] | "  [\(.asset_type)] role=\(.role // "-")  rank=\(.rank_score // "-")  status=\(.status)  -- \(.draft_payload_json.title // .draft_payload_json.name // .draft_payload_json.external_id // "untitled")"'
    ;;

  concept-sets)
    # Phase 4: draft, verify, materialize concept sets per scripts/htn-v3/concept_seeds.json.
    [[ -f "$REPORT_DIR/session-id" && -f "$REPORT_DIR/version-id" ]] || { echo "Run intent first."; exit 1; }
    SESSION_ID=$(cat "$REPORT_DIR/session-id")
    V2_ID=$(cat "$REPORT_DIR/version-id")

    # Idempotency: identify which seeds (by title) are already drafted on v2.
    EXISTING=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets?version_id=$V2_ID")
    EXISTING_TITLES=$(echo "$EXISTING" | jq -r '(if type=="array" then . else .data end)
      | map(select(.asset_type=="concept_set_draft") | .draft_payload_json.title) | unique | .[]')
    echo "Existing drafted titles on v2: $(echo "$EXISTING_TITLES" | tr '\n' '|' | sed 's/|$//')"

    # Build a filtered seeds.json containing only seeds whose title is NOT already present.
    FILTERED_SEEDS=$(mktemp --suffix=.json)
    jq --arg titles "$EXISTING_TITLES" '
      ($titles | split("\n") | map(select(. != ""))) as $existing
      | to_entries
      | map(select(.value.title as $t | ($existing | index($t)) == null))
      | from_entries
    ' scripts/htn-v3/concept_seeds.json > "$FILTERED_SEEDS"

    MISSING_COUNT=$(jq 'length' "$FILTERED_SEEDS")
    echo "Seeds remaining to draft: $MISSING_COUNT"

    if [[ "$MISSING_COUNT" -gt 0 ]]; then
      DRAFTS_BODY=$(scripts/htn-v3/build_concept_sets.sh "$FILTERED_SEEDS" 2>"$REPORT_DIR/concept-sets-build.log")
      echo "$DRAFTS_BODY" > "$REPORT_DIR/concept-sets-drafts-body.json"

      api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions/$V2_ID/concept-sets/draft" "$DRAFTS_BODY" "$REPORT_DIR/concept-sets-draft-response.json" > /dev/null
      echo "Posted $MISSING_COUNT new drafts"
    else
      echo "All seeds already drafted — skipping POST"
    fi
    rm -f "$FILTERED_SEEDS"

    # Verify all
    api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions/$V2_ID/concept-sets/verify" "{}" "$REPORT_DIR/concept-sets-verify-bulk.json" > /dev/null
    echo "Bulk verify complete"

    # Re-fetch state
    FRESH=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets?version_id=$V2_ID" "$REPORT_DIR/concept-sets-state.json")
    echo "Concept-set asset state on v2:"
    echo "$FRESH" | jq -r '(if type=="array" then . else .data end) | map(select(.asset_type=="concept_set_draft"))
      | .[] | "  [\(.status)/\(.verification_status)] role=\(.role)  title=\(.draft_payload_json.title // .draft_payload_json.name // "?")  materialized=\(.materialized_id // "no")"'

    # Accept verified, not-yet-accepted drafts
    ACCEPT_IDS=$(echo "$FRESH" | jq -r '(if type=="array" then . else .data end)
      | map(select(.asset_type=="concept_set_draft" and .verification_status=="verified" and .status=="needs_review"))
      | .[].id')
    if [[ -n "$ACCEPT_IDS" ]]; then
      for AID in $ACCEPT_IDS; do
        api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets/$AID/review" \
          '{"decision":"accept","review_notes":"Auto-accepted by htn-v3 runner per CLAUDE_PROMPT.md §5 — seed-expanded vocab descendants verified clean."}' > /dev/null
        echo "  Accepted asset $AID"
      done
      # Re-fetch state after accept
      FRESH=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets?version_id=$V2_ID" "$REPORT_DIR/concept-sets-state.json")
    fi

    # Materialize accepted+verified+unmaterialized
    MATERIALIZE_IDS=$(echo "$FRESH" | jq -r '(if type=="array" then . else .data end)
      | map(select(.asset_type=="concept_set_draft" and .verification_status=="verified" and .status=="accepted" and .materialized_id==null))
      | .[].id')
    if [[ -n "$MATERIALIZE_IDS" ]]; then
      for AID in $MATERIALIZE_IDS; do
        api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets/$AID/concept-sets/materialize" "{}" > /dev/null
        echo "  Materialized asset $AID"
      done
    else
      echo "  Nothing to materialize (all done or none ready)."
    fi

    # Final summary
    FINAL=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets?version_id=$V2_ID")
    echo "Final concept-set state on v2:"
    echo "$FINAL" | jq -r '(if type=="array" then . else .data end) | map(select(.asset_type=="concept_set_draft"))
      | .[] | "  [\(.status)/\(.verification_status)] role=\(.role)  title=\(.draft_payload_json.title // "?")  materialized_id=\(.materialized_id // "null")"'
    ;;

  cohorts)
    # Phase 5 (partial): deploy 4 composite cohorts (T, C, O1, O2) by PUT-overwriting
    # 4 auto-generated draft slots, then verify, accept, materialize, and link.
    # Deferred: S1, S2, T_lu (per user 2026-05-12).
    [[ -f "$REPORT_DIR/session-id" && -f "$REPORT_DIR/version-id" ]] || { echo "Run intent first."; exit 1; }
    SESSION_ID=$(cat "$REPORT_DIR/session-id")
    V2_ID=$(cat "$REPORT_DIR/version-id")

    # Slot mapping (asset_id -> cohort label) discovered via DB inspection
    declare -A SLOTS=( ["145"]="T" ["148"]="C" ["146"]="O1" ["144"]="O2" )

    for ASSET_ID in "${!SLOTS[@]}"; do
      LABEL="${SLOTS[$ASSET_ID]}"
      BODY_FILE="/tmp/htn-v3-put-${LABEL}.json"
      [[ -f "$BODY_FILE" ]] || { echo "Missing body file $BODY_FILE -- run build_composite_cohorts.php first"; exit 1; }
      BODY=$(cat "$BODY_FILE")
      api_put "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets/$ASSET_ID/cohorts/draft" "$BODY" > /dev/null
      echo "  PUT cohort ${LABEL} (asset $ASSET_ID)"

      api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets/$ASSET_ID/cohorts/verify" "{}" > /dev/null
      VERIFY_STATE=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets?version_id=$V2_ID" \
        | jq -r --arg id "$ASSET_ID" '(if type=="array" then . else .data end) | map(select(.id==($id|tonumber)))[0].verification_status')
      echo "    verify -> $VERIFY_STATE"

      if [[ "$VERIFY_STATE" != "verified" ]]; then
        echo "    SKIP accept/materialize (not verified)"
        continue
      fi

      api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets/$ASSET_ID/review" \
        "{\"decision\":\"accept\",\"review_notes\":\"PI-confirmed composite cohort ${LABEL} per CLAUDE_PROMPT.md §6 (Phase 5 partial deploy 2026-05-12).\"}" > /dev/null
      echo "    accepted"

      api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets/$ASSET_ID/cohorts/materialize" "{}" > /dev/null
      echo "    materialized"

      ROLE=$(jq -r '.role' "$BODY_FILE")
      LABEL_FULL=$(jq -r '.title' "$BODY_FILE")
      api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets/$ASSET_ID/cohorts/link-to-study" \
        "$(jq -nc --arg role "$ROLE" --arg label "$LABEL_FULL" '{role: $role, label: $label, sort_order: 1}')" > /dev/null
      echo "    linked to study (role=$ROLE)"
    done

    # Reject the other 24 auto-generated drafts -- explicit allow-list of IDs.
    # Asset IDs 133-160 are v2 cohort_drafts; protect our 4 slots (144,145,146,148).
    REJECT_IDS=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets?version_id=$V2_ID" \
      | jq -r '(if type=="array" then . else .data end)
        | map(select(.asset_type=="cohort_draft"))
        | map(select([145,148,146,144] | index(.id) == null))
        | map(select(.status != "rejected" and .status != "materialized"))
        | .[].id')
    REJECTED=0
    for AID in $REJECT_IDS; do
      api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets/$AID/review" \
        '{"decision":"reject","review_notes":"Auto-generated starter draft. Not used as a standalone cohort; concept set referenced by composite (T/C/O1/O2)."}' > /dev/null
      REJECTED=$((REJECTED+1))
    done
    echo "Rejected $REJECTED auto-generated starter drafts"

    # Final state
    FINAL=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets?version_id=$V2_ID")
    echo "Cohort draft state on v2:"
    echo "$FINAL" | jq -r '(if type=="array" then . else .data end) | map(select(.asset_type=="cohort_draft"))
      | sort_by(.id) | .[] | "  id=\(.id)  status=\(.status)/\(.verification_status)  role=\(.role)  title=\(.draft_payload_json.title // "?")  materialized=\(.materialized_id // "no")"' | head -30
    ;;

  feasibility)
    # Phase 6: cohort generation on Acumenus OMOP via the FeasibilityDashboard endpoint.
    [[ -f "$REPORT_DIR/session-id" && -f "$REPORT_DIR/version-id" && -f "$REPORT_DIR/source-id" ]] \
      || { echo "Run preflight + discover + intent + cohorts first."; exit 1; }
    SESSION_ID=$(cat "$REPORT_DIR/session-id")
    V2_ID=$(cat "$REPORT_DIR/version-id")
    SOURCE_ID=$(cat "$REPORT_DIR/source-id")

    # Cohort-readiness gate
    READINESS=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions/$V2_ID/cohorts/readiness" "$REPORT_DIR/feasibility-readiness.json")
    READY=$(echo "$READINESS" | jq -r '(if has("data") then .data else . end).ready_for_feasibility // .ready // false')
    echo "Cohort readiness: ready_for_feasibility=$READY"
    echo "$READINESS" | jq -r '(if has("data") then .data else . end) | to_entries | map("  \(.key): \(.value | tostring | .[0:80])")[]' | head -25

    if [[ "$READY" != "true" ]]; then
      echo "FAIL: cohorts not ready for feasibility. See report."
      exit 1
    fi

    # Dispatch generation
    BODY=$(jq -nc --arg src "$SOURCE_ID" '{source_ids: [($src|tonumber)], min_cell_count: 5}')
    echo "Dispatching feasibility on source $SOURCE_ID..."
    RESULT=$(api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions/$V2_ID/feasibility/run" "$BODY" "$REPORT_DIR/feasibility-run.json")
    echo "Feasibility run dispatched. Response keys:"
    echo "$RESULT" | jq -r 'keys | join(", ")'
    echo "$RESULT" | jq -r '(if has("data") then .data else . end) | to_entries | map("  \(.key): \(.value | tostring | .[0:120])")[] | .[0:140]' | head -20
    echo "Asset id of feasibility report:"
    echo "$RESULT" | jq -r 'if has("data") then .data.id else .asset.id // .id end // "n/a"'
    ;;

  generate-cohorts)
    # Phase 6a: dispatch async cohort generation on Acumenus for the 4 composites.
    [[ -f "$REPORT_DIR/source-id" ]] || { echo "Run preflight first."; exit 1; }
    SOURCE_ID=$(cat "$REPORT_DIR/source-id")

    # cohort_definition IDs from Phase 5: T=5423, C=5420, O1=5421, O2=5422
    declare -A COHORTS=( ["5423"]="T" ["5420"]="C" ["5421"]="O1" ["5422"]="O2" )

    declare -A GEN_IDS=()
    for CD_ID in "${!COHORTS[@]}"; do
      LABEL="${COHORTS[$CD_ID]}"
      RESP=$(api_post "/cohort-definitions/$CD_ID/generate" "$(jq -nc --arg s "$SOURCE_ID" '{source_id: ($s|tonumber)}')")
      GEN_ID=$(echo "$RESP" | jq -r '(if has("data") then .data else . end).id')
      GEN_IDS[$CD_ID]="$GEN_ID"
      echo "  ${LABEL} (def=${CD_ID}) queued -> generation_id=${GEN_ID}"
    done

    # Poll until all complete (or 30 min)
    DEADLINE=$(($(date +%s) + 1800))
    while [[ $(date +%s) -lt $DEADLINE ]]; do
      ALL_DONE=true
      STATUS_LINE=""
      for CD_ID in "${!COHORTS[@]}"; do
        LABEL="${COHORTS[$CD_ID]}"
        GEN_ID="${GEN_IDS[$CD_ID]}"
        GEN_JSON=$(api_get "/cohort-definitions/$CD_ID/generations/$GEN_ID" 2>/dev/null)
        S=$(echo "$GEN_JSON" | jq -r '(if has("data") then .data else . end).status // "?"')
        N=$(echo "$GEN_JSON" | jq -r '(if has("data") then .data else . end).person_count // "?"')
        STATUS_LINE+="${LABEL}=${S}(${N}) "
        [[ "$S" == "Completed" || "$S" == "completed" ]] || ALL_DONE=false
        [[ "$S" == "Failed" || "$S" == "failed" ]] && { echo "FAIL: $LABEL generation failed (gen_id=$GEN_ID)"; echo "$GEN_JSON" | jq '.' ; exit 1; }
      done
      echo "$(date +%H:%M:%S)  $STATUS_LINE"
      $ALL_DONE && break
      sleep 30
    done

    echo "---final---"
    for CD_ID in "${!COHORTS[@]}"; do
      LABEL="${COHORTS[$CD_ID]}"
      GEN_ID="${GEN_IDS[$CD_ID]}"
      GEN_JSON=$(api_get "/cohort-definitions/$CD_ID/generations/$GEN_ID" 2>/dev/null)
      S=$(echo "$GEN_JSON" | jq -r '(if has("data") then .data else . end).status')
      N=$(echo "$GEN_JSON" | jq -r '(if has("data") then .data else . end).person_count')
      D=$(echo "$GEN_JSON" | jq -r '(if has("data") then .data else . end).duration_seconds // .data.duration // "?"')
      echo "  $LABEL (def=$CD_ID, gen=$GEN_ID): $S  person_count=$N  duration=${D}s"
    done
    ;;

  analysis-plans)
    # Phase 7: draft + verify + accept + materialize analysis plans.
    # 4 packages map to our 4 cohorts (T/C/O1/O2):
    #   characterization → Baseline Table 1 (analyses A + B)
    #   incidence_rate   → MACE and CKD per-1k-person-years (G + H)
    #   pathway          → Treatment patterns after diagnosis (D)
    #   estimation       → Population-level estimation: T vs C with Cox PH on outcomes (C + Lu-style F)
    # Deferred: pathway → resistant-HTN sub (E, needs S1); RDN eligibility (I, needs S2);
    #           baseline-lab ordering (J, custom SQL); geographic (K, GIS).
    # DROPPED: cost analysis (L, per PI Q13).
    [[ -f "$REPORT_DIR/session-id" && -f "$REPORT_DIR/version-id" ]] || { echo "Run intent first."; exit 1; }
    SESSION_ID=$(cat "$REPORT_DIR/session-id")
    V2_ID=$(cat "$REPORT_DIR/version-id")

    # Idempotency: check existing analysis_plan assets
    EXISTING_TYPES=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets?version_id=$V2_ID" \
      | jq -r '(if type=="array" then . else .data end) | map(select(.asset_type=="analysis_plan") | .draft_payload_json.analysis_type // .draft_payload_json.type // .draft_payload_json.package // "") | unique | .[]?')
    echo "Existing analysis_plan types: $(echo "$EXISTING_TYPES" | tr '\n' '|' | sed 's/|$//')"

    DESIRED='["characterization","incidence_rate","pathway","estimation"]'
    MISSING=$(jq -nc --argjson desired "$DESIRED" --arg existing "$EXISTING_TYPES" \
      '$desired - ($existing | split("\n") | map(select(. != "")))')
    MISSING_COUNT=$(echo "$MISSING" | jq 'length')
    echo "Missing analysis_plan types: $MISSING ($MISSING_COUNT)"

    if [[ "$MISSING_COUNT" -gt 0 ]]; then
      BODY=$(jq -nc --argjson types "$MISSING" '{analysis_types: $types}')
      RESP=$(api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions/$V2_ID/analysis-plans/draft" "$BODY" "$REPORT_DIR/analysis-plans-draft.json")
      DRAFTED_IDS=$(echo "$RESP" | jq -r '(if type=="array" then . else .data end) | .[].id')
      echo "Drafted: $(echo "$DRAFTED_IDS" | tr '\n' ',' | sed 's/,$//')"
    fi

    # Re-fetch all analysis_plan assets on v2
    FRESH=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets?version_id=$V2_ID" "$REPORT_DIR/analysis-plans-state.json")
    PLAN_IDS=$(echo "$FRESH" | jq -r '(if type=="array" then . else .data end) | map(select(.asset_type=="analysis_plan")) | .[].id')
    echo "Analysis plan assets: $(echo "$PLAN_IDS" | tr '\n' ',' | sed 's/,$//')"

    # Verify each, then accept + materialize verified ones
    for AID in $PLAN_IDS; do
      VERIFY=$(api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets/$AID/analysis-plans/verify" "{}")
      VSTATUS=$(echo "$VERIFY" | jq -r '(if has("data") then .data else . end).verification_status // .status // "?"')
      ASSET=$(echo "$FRESH" | jq -r --arg id "$AID" '(if type=="array" then . else .data end) | map(select(.id == ($id|tonumber)))[0]')
      ATYPE=$(echo "$ASSET" | jq -r '.draft_payload_json.analysis_type // .draft_payload_json.type // .draft_payload_json.package // "?"')
      ASTATUS=$(echo "$ASSET" | jq -r '.status')
      AMAT=$(echo "$ASSET" | jq -r '.materialized_id // "no"')
      echo "  asset $AID  type=$ATYPE  status=$ASTATUS  verify=$VSTATUS  materialized=$AMAT"

      if [[ "$VSTATUS" != "verified" ]]; then continue; fi
      if [[ "$ASTATUS" == "needs_review" ]]; then
        api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets/$AID/review" \
          "{\"decision\":\"accept\",\"review_notes\":\"PI-confirmed analysis plan ${ATYPE} (Phase 7 2026-05-12).\"}" > /dev/null
        echo "    accepted"
      fi
      if [[ "$AMAT" == "no" ]]; then
        api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets/$AID/analysis-plans/materialize" "{}" > /dev/null
        echo "    materialized"
      fi
    done

    # Final state
    FINAL=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/assets?version_id=$V2_ID")
    echo "Final analysis_plan state on v2:"
    echo "$FINAL" | jq -r '(if type=="array" then . else .data end) | map(select(.asset_type=="analysis_plan"))
      | sort_by(.id) | .[] | "  id=\(.id)  status=\(.status)/\(.verification_status)  type=\(.draft_payload_json.analysis_type // .draft_payload_json.type // .draft_payload_json.package // "?")  materialized_id=\(.materialized_id // "no")"'
    ;;

  lock)
    # Phase 8: check lock-readiness, then lock v2.
    [[ -f "$REPORT_DIR/session-id" && -f "$REPORT_DIR/version-id" ]] || { echo "Run intent first."; exit 1; }
    SESSION_ID=$(cat "$REPORT_DIR/session-id")
    V2_ID=$(cat "$REPORT_DIR/version-id")

    READINESS=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions/$V2_ID/lock-readiness" "$REPORT_DIR/lock-readiness.json")
    READY=$(echo "$READINESS" | jq -r '(if has("data") then .data else . end).ready // false')
    echo "Lock-readiness: ready=$READY"
    echo "$READINESS" | jq -r '(if has("data") then .data else . end) | to_entries | map("  \(.key): \(.value | tostring | .[0:120])")[]' | head -30

    if [[ "$READY" != "true" ]]; then
      echo "FAIL: not ready to lock."
      exit 1
    fi

    # Get current updated_at for optimistic concurrency
    UPDATED_AT=$(api_get "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions" \
      | jq -r --arg id "$V2_ID" '(if type=="array" then . else .data end) | map(select(.id==($id|tonumber)))[0].updated_at')
    echo "Locking with if_unmodified_since=$UPDATED_AT"

    LOCKED=$(api_post "/studies/$STUDY_SLUG/design-sessions/$SESSION_ID/versions/$V2_ID/lock" \
      "$(jq -nc --arg ts "$UPDATED_AT" '{if_unmodified_since: $ts}')" "$REPORT_DIR/lock-result.json")
    echo "Lock result:"
    echo "$LOCKED" | jq -r '(if has("data") then .data else . end) | {id, status, locked_at, version_number}'
    ;;

  execute)
    # Phase 9: POST /studies/{study}/execute dispatches all study analyses on Acumenus.
    [[ -f "$REPORT_DIR/source-id" ]] || { echo "Run preflight first."; exit 1; }
    SOURCE_ID=$(cat "$REPORT_DIR/source-id")

    BODY=$(jq -nc --arg s "$SOURCE_ID" '{source_id: ($s|tonumber)}')
    RESP=$(api_post "/studies/$STUDY_SLUG/execute" "$BODY" "$REPORT_DIR/execute-dispatch.json")
    echo "Dispatch response:"
    echo "$RESP" | jq '.'
    ;;

  progress)
    # Phase 9b: poll study execution progress.
    PROG=$(api_get "/studies/$STUDY_SLUG/progress" "$REPORT_DIR/execute-progress.json")
    echo "$PROG" | jq '.'
    ;;

  *)
    echo "Phase '$PHASE' not yet implemented." >&2
    echo "Available now: preflight | discover | intent | phenotypes | concept-sets | cohorts | generate-cohorts | feasibility | analysis-plans | lock | execute | progress" >&2
    exit 64
    ;;
esac
