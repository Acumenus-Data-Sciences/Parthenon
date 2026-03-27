#!/usr/bin/env bash
# load-vocab.sh — Create vocab schema, load fresh OHDSI vocabulary, merge IRSF custom concepts
#
# Prerequisites:
#   - IRSF schema migration already run (migrate-irsf-schemas.sql)
#   - Vocabulary zip downloaded from Athena
#
# Usage:
#   bash scripts/load-vocab.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VOCAB_ZIP="$PROJECT_DIR/vocabulary_download_v5_{602535d6-0fc1-4ebb-82af-137b3b9d1de9}_1772038962310.zip"
WORK_DIR="/tmp/vocab_load"

# DB connection
PG_HOST="localhost"
PG_PORT="5432"
PG_DB="parthenon"
PG_USER="smudoshi"
export PGPASSWORD="acumenus"

PSQL="psql -U $PG_USER -d $PG_DB -h $PG_HOST -p $PG_PORT"

# =============================================================================
# Step 1: Create vocab schema and tables
# =============================================================================
echo "==> Step 1: Creating vocab schema and tables..."

$PSQL <<'SQL'
CREATE SCHEMA IF NOT EXISTS vocab;

DROP TABLE IF EXISTS vocab.drug_strength CASCADE;
DROP TABLE IF EXISTS vocab.concept_synonym CASCADE;
DROP TABLE IF EXISTS vocab.concept_ancestor CASCADE;
DROP TABLE IF EXISTS vocab.concept_relationship CASCADE;
DROP TABLE IF EXISTS vocab.concept CASCADE;
DROP TABLE IF EXISTS vocab.source_to_concept_map CASCADE;
DROP TABLE IF EXISTS vocab.relationship CASCADE;
DROP TABLE IF EXISTS vocab.concept_class CASCADE;
DROP TABLE IF EXISTS vocab.domain CASCADE;
DROP TABLE IF EXISTS vocab.vocabulary CASCADE;

CREATE TABLE vocab.vocabulary (
  vocabulary_id VARCHAR(20) PRIMARY KEY,
  vocabulary_name VARCHAR(255) NOT NULL,
  vocabulary_reference VARCHAR(255),
  vocabulary_version VARCHAR(255),
  vocabulary_concept_id INTEGER NOT NULL
);

CREATE TABLE vocab.domain (
  domain_id VARCHAR(20) PRIMARY KEY,
  domain_name VARCHAR(255) NOT NULL,
  domain_concept_id INTEGER NOT NULL
);

CREATE TABLE vocab.concept_class (
  concept_class_id VARCHAR(20) PRIMARY KEY,
  concept_class_name VARCHAR(255) NOT NULL,
  concept_class_concept_id INTEGER NOT NULL
);

CREATE TABLE vocab.relationship (
  relationship_id VARCHAR(20) PRIMARY KEY,
  relationship_name VARCHAR(255) NOT NULL,
  is_hierarchical VARCHAR(1) NOT NULL,
  defines_ancestry VARCHAR(1) NOT NULL,
  reverse_relationship_id VARCHAR(20) NOT NULL,
  relationship_concept_id INTEGER NOT NULL
);

CREATE TABLE vocab.concept (
  concept_id INTEGER PRIMARY KEY,
  concept_name VARCHAR(255) NOT NULL,
  domain_id VARCHAR(20) NOT NULL,
  vocabulary_id VARCHAR(20) NOT NULL,
  concept_class_id VARCHAR(20) NOT NULL,
  standard_concept VARCHAR(1),
  concept_code VARCHAR(50) NOT NULL,
  valid_start_date DATE NOT NULL,
  valid_end_date DATE NOT NULL,
  invalid_reason VARCHAR(1)
);

CREATE TABLE vocab.concept_ancestor (
  ancestor_concept_id INTEGER NOT NULL,
  descendant_concept_id INTEGER NOT NULL,
  min_levels_of_separation INTEGER NOT NULL,
  max_levels_of_separation INTEGER NOT NULL
);

CREATE TABLE vocab.concept_relationship (
  concept_id_1 INTEGER NOT NULL,
  concept_id_2 INTEGER NOT NULL,
  relationship_id VARCHAR(20) NOT NULL,
  valid_start_date DATE NOT NULL,
  valid_end_date DATE NOT NULL,
  invalid_reason VARCHAR(1)
);

CREATE TABLE vocab.concept_synonym (
  concept_id INTEGER NOT NULL,
  concept_synonym_name VARCHAR(1000) NOT NULL,
  language_concept_id INTEGER NOT NULL
);

CREATE TABLE vocab.drug_strength (
  drug_concept_id INTEGER NOT NULL,
  ingredient_concept_id INTEGER NOT NULL,
  amount_value NUMERIC,
  amount_unit_concept_id INTEGER,
  numerator_value NUMERIC,
  numerator_unit_concept_id INTEGER,
  denominator_value NUMERIC,
  denominator_unit_concept_id INTEGER,
  box_size INTEGER,
  valid_start_date DATE NOT NULL,
  valid_end_date DATE NOT NULL,
  invalid_reason VARCHAR(1)
);

CREATE TABLE vocab.source_to_concept_map (
  source_code VARCHAR(50) NOT NULL,
  source_concept_id INTEGER NOT NULL,
  source_vocabulary_id VARCHAR(20) NOT NULL,
  source_code_description VARCHAR(255),
  target_concept_id INTEGER NOT NULL,
  target_vocabulary_id VARCHAR(20) NOT NULL,
  valid_start_date DATE NOT NULL,
  valid_end_date DATE NOT NULL,
  invalid_reason VARCHAR(1)
);
SQL

echo "    Tables created."

# =============================================================================
# Step 2: Unzip vocabulary CSVs
# =============================================================================
echo "==> Step 2: Unzipping vocabulary CSVs to $WORK_DIR..."

if [ ! -f "$VOCAB_ZIP" ]; then
  echo "ERROR: Vocabulary zip not found at $VOCAB_ZIP"
  exit 1
fi

rm -rf "$WORK_DIR" && mkdir -p "$WORK_DIR"
unzip -o "$VOCAB_ZIP" -d "$WORK_DIR"
echo "    Done. Files:"
ls -lh "$WORK_DIR"/*.csv 2>/dev/null | awk '{print "    "$NF": "$5}'

# =============================================================================
# Step 3: Load each CSV using \copy
# =============================================================================
echo "==> Step 3: Loading vocabulary CSVs (this will take 10-30 minutes)..."

load_csv() {
  local table="$1"
  local file="$2"
  echo "    Loading $file -> $table..."
  $PSQL -c "\copy $table FROM '$WORK_DIR/$file' WITH (FORMAT csv, HEADER true, DELIMITER E'\t', QUOTE E'\b')"
  local cnt
  cnt=$($PSQL -tAc "SELECT count(*) FROM $table;")
  echo "    $table: $cnt rows"
}

load_csv "vocab.vocabulary"           "VOCABULARY.csv"
load_csv "vocab.domain"               "DOMAIN.csv"
load_csv "vocab.concept_class"        "CONCEPT_CLASS.csv"
load_csv "vocab.relationship"         "RELATIONSHIP.csv"
load_csv "vocab.concept"              "CONCEPT.csv"
load_csv "vocab.concept_ancestor"     "CONCEPT_ANCESTOR.csv"
load_csv "vocab.concept_relationship" "CONCEPT_RELATIONSHIP.csv"
load_csv "vocab.concept_synonym"      "CONCEPT_SYNONYM.csv"
load_csv "vocab.drug_strength"        "DRUG_STRENGTH.csv"

# =============================================================================
# Step 4: Insert IRSF custom vocabulary into vocab schema
# =============================================================================
echo "==> Step 4: Inserting IRSF custom vocabulary..."

$PSQL <<'SQL'
-- IRSF vocabulary entry
INSERT INTO vocab.vocabulary SELECT * FROM omop.vocabulary WHERE vocabulary_id = 'IRSF-NHS'
ON CONFLICT (vocabulary_id) DO NOTHING;

-- IRSF concept_class entry
INSERT INTO vocab.concept_class SELECT * FROM omop.concept_class WHERE concept_class_id = 'Clinical Observation'
ON CONFLICT (concept_class_id) DO NOTHING;

-- IRSF custom concepts (117 rows)
INSERT INTO vocab.concept SELECT * FROM omop.concept WHERE concept_id >= 2000000000
ON CONFLICT (concept_id) DO NOTHING;

-- IRSF concept relationships (254 rows)
INSERT INTO vocab.concept_relationship
SELECT * FROM omop.concept_relationship WHERE concept_id_1 >= 2000000000 OR concept_id_2 >= 2000000000
ON CONFLICT DO NOTHING;

-- IRSF concept ancestors
INSERT INTO vocab.concept_ancestor
SELECT * FROM omop.concept_ancestor WHERE ancestor_concept_id >= 2000000000 OR descendant_concept_id >= 2000000000;

-- IRSF source_to_concept_map (121 rows)
-- Note: source_to_concept_map was moved to irsf schema in migration step
INSERT INTO vocab.source_to_concept_map
SELECT * FROM irsf.source_to_concept_map WHERE source_vocabulary_id = 'IRSF-NHS' OR target_vocabulary_id = 'IRSF-NHS';
SQL

echo "    IRSF custom vocab merged."

# =============================================================================
# Step 5: Verification
# =============================================================================
echo "==> Step 5: Verification..."

$PSQL -t <<'SQL'
SELECT 'vocab.concept (total)' AS tbl, count(*) FROM vocab.concept
UNION ALL SELECT 'vocab.concept (IRSF)', count(*) FROM vocab.concept WHERE concept_id >= 2000000000
UNION ALL SELECT 'vocab.vocabulary (IRSF)', count(*) FROM vocab.vocabulary WHERE vocabulary_id = 'IRSF-NHS'
UNION ALL SELECT 'vocab.concept_relationship (IRSF)', count(*) FROM vocab.concept_relationship WHERE concept_id_1 >= 2000000000 OR concept_id_2 >= 2000000000;
SQL

# =============================================================================
# Step 6: Cleanup
# =============================================================================
echo "==> Step 6: Cleaning up temp files..."
rm -rf "$WORK_DIR"
echo "    Done."

echo ""
echo "==> Vocabulary load complete!"
