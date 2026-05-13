#!/usr/bin/env bash
# Expand seed concept IDs into Atlas-compatible drafts via vocab.concept_ancestor.
# Usage: build_concept_sets.sh <seeds.json> > drafts.json
#
# Seed entry fields:
#   title, role, domain, description, clinical_rationale, search_terms[]
#   seed_concept_ids[], filter.{domain_id, standard_concept, concept_class_id?, vocabulary_id?}
#
# Output: {"drafts": [ {title, role, domain, clinical_rationale, search_terms, concepts: [...]}, ...]}

set -euo pipefail

SEEDS="${1:?seeds.json path required}"
[[ -f "$SEEDS" ]] || { echo "Seeds file not found: $SEEDS" >&2; exit 2; }

psql_args=( -h localhost -p 5432 -U claude_dev -d parthenon -At -F'|' -v ON_ERROR_STOP=1 )

expand_seeds() {
  local seeds_csv="$1" domain="$2" standard="$3" class_id="${4:-}" vocab_id="${5:-}"
  local class_clause=""
  local vocab_clause=""
  [[ -n "$class_id" ]] && class_clause="AND c.concept_class_id = '${class_id}'"
  [[ -n "$vocab_id" ]] && vocab_clause="AND c.vocabulary_id = '${vocab_id}'"
  PGPASSFILE="${HOME}/.pgpass" psql "${psql_args[@]}" <<SQL
    SELECT DISTINCT c.concept_id
    FROM vocab.concept c
    JOIN vocab.concept_ancestor ca ON ca.descendant_concept_id = c.concept_id
    WHERE ca.ancestor_concept_id = ANY (ARRAY[${seeds_csv}])
      AND c.standard_concept = '${standard}'
      AND c.invalid_reason IS NULL
      AND c.domain_id = '${domain}'
      ${class_clause}
      ${vocab_clause}
    ORDER BY 1;
SQL
}

DRAFTS_OUT="$(mktemp)"
echo '[]' > "$DRAFTS_OUT"

KEYS=$(jq -r 'keys[]' "$SEEDS")
for KEY in $KEYS; do
  ENTRY=$(jq -c --arg k "$KEY" '.[$k]' "$SEEDS")
  TITLE=$(echo "$ENTRY" | jq -r '.title')
  ROLE=$(echo "$ENTRY" | jq -r '.role')
  DOMAIN=$(echo "$ENTRY" | jq -r '.domain')
  DESCRIPTION=$(echo "$ENTRY" | jq -r '.description')
  RATIONALE=$(echo "$ENTRY" | jq -r '.clinical_rationale')
  SEARCH_TERMS=$(echo "$ENTRY" | jq -c '.search_terms')
  SEEDS_CSV=$(echo "$ENTRY" | jq -r '.seed_concept_ids | map(tostring) | join(",")')
  FILTER_DOMAIN=$(echo "$ENTRY" | jq -r '.filter.domain_id // .domain')
  FILTER_STANDARD=$(echo "$ENTRY" | jq -r '.filter.standard_concept // "S"')
  FILTER_CLASS=$(echo "$ENTRY" | jq -r '.filter.concept_class_id // ""')
  FILTER_VOCAB=$(echo "$ENTRY" | jq -r '.filter.vocabulary_id // ""')

  echo "Expanding $KEY (seeds=[$SEEDS_CSV], domain=$FILTER_DOMAIN, class=${FILTER_CLASS:-any}, vocab=${FILTER_VOCAB:-any})..." >&2

  # Stream concept IDs into a temp file (handles tens-of-thousands cleanly)
  CIDS_FILE=$(mktemp)
  expand_seeds "$SEEDS_CSV" "$FILTER_DOMAIN" "$FILTER_STANDARD" "$FILTER_CLASS" "$FILTER_VOCAB" > "$CIDS_FILE"
  COUNT=$(wc -l < "$CIDS_FILE")
  echo "  $KEY -> $COUNT concepts" >&2

  if [[ "$COUNT" -lt 1 ]]; then
    echo "  WARN: $KEY produced 0 concepts; skipping" >&2
    rm -f "$CIDS_FILE"
    continue
  fi

  # Build concepts array via file → stdin (no argv overflow)
  CONCEPTS_FILE=$(mktemp)
  jq -R 'tonumber | {concept_id: ., is_excluded: false}' "$CIDS_FILE" | jq -s '.' > "$CONCEPTS_FILE"
  rm -f "$CIDS_FILE"

  # Build draft entry with the concepts file slurped in
  DRAFT_FILE=$(mktemp)
  jq -n \
    --arg title "$TITLE" \
    --arg role "$ROLE" \
    --arg domain "$DOMAIN" \
    --arg description "$DESCRIPTION" \
    --arg rationale "$RATIONALE" \
    --argjson search_terms "$SEARCH_TERMS" \
    --slurpfile concepts "$CONCEPTS_FILE" \
    --arg key "$KEY" \
    '{
      title: $title,
      role: $role,
      domain: $domain,
      description: $description,
      clinical_rationale: $rationale,
      search_terms: $search_terms,
      concepts: $concepts[0],
      provenance: {source: "claude-code htn-v3 build_concept_sets.sh", set_key: $key}
    }' > "$DRAFT_FILE"
  rm -f "$CONCEPTS_FILE"

  # Append to drafts array via jq --slurpfile
  tmpfile=$(mktemp)
  jq --slurpfile d "$DRAFT_FILE" '. + [$d[0]]' "$DRAFTS_OUT" > "$tmpfile" && mv "$tmpfile" "$DRAFTS_OUT"
  rm -f "$DRAFT_FILE"
done

# Wrap in {drafts: [...]}
jq '{drafts: .}' "$DRAFTS_OUT"
rm -f "$DRAFTS_OUT"
