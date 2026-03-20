# Morpheus Inpatient Workbench — Claude Code Engineering Prompt

## Project Context

**Morpheus** is a new module within the Parthenon platform — an open-source OHDSI/OMOP replacement platform under active development by Acumenus Data Sciences / Wellstack.ai. Morpheus is an inpatient analytics workbench focused on ICU and hospital outcomes research, leveraging MIMIC-IV data loaded into OMOP CDM 5.4 format.

The name "Morpheus" references the god of dreams — appropriate for ICU care where sedation, delirium monitoring, and the ABCDEF Liberation Bundle (waking patients from sedation) are central concerns.

**Platform Stack:**
- PostgreSQL (primary database)
- React 19 + TypeScript (frontend)
- FastAPI (Python backend / API layer)
- Parthenon schema conventions: `parthenon.<module_name>`

**Target Schema:** `parthenon.inpatient`
**CDM Version:** OMOP CDM 5.4
**Source Data:** MIMIC-IV (PhysioNet)

---

## PHASE 1: Resource Gathering

### 1.1 Create Directory Structure

```bash
mkdir -p ~/inpatient/{etl,literature,schemas,scripts,config,docs}
mkdir -p ~/inpatient/etl/{ohdsi-mimic,cogstack-dbt,blended-icu,mimic-omop-legacy,postgres-port}
mkdir -p ~/inpatient/literature/{full-text,abstracts,references}
mkdir -p ~/inpatient/schemas/{cdm-5.4,custom-extensions,views}
mkdir -p ~/inpatient/scripts/{setup,loading,validation,analytics}
mkdir -p ~/inpatient/docs/{architecture,bundle-cards,mapping-specs}
```

### 1.2 Clone ETL Repositories

Clone each of the key MIMIC-IV → OMOP ETL repositories we identified. These represent different architectural approaches and will inform our design.

```bash
cd ~/inpatient/etl

# 1. OFFICIAL OHDSI MIMIC-IV → OMOP ETL (BigQuery-native, community-maintained)
# This is the canonical reference implementation
git clone https://github.com/OHDSI/MIMIC.git ohdsi-mimic
# Key files to examine:
#   - etl/staging/ (source snapshot scripts)
#   - etl/etl/ (CDM table population scripts)
#   - custom_mapping_csv/ (terminology mappings)
#   - conf/ (workflow configuration)

# 2. CogStack dbt-based ETL (DuckDB, includes MI-CDM imaging support)
# Modern data engineering approach, relevant to our imaging module
git clone https://github.com/CogStack/dbt_mimic_omop.git cogstack-dbt
# Key files to examine:
#   - models/ (dbt transformation models)
#   - load_vocabularies_to_duckdb.py
#   - load_mimic_to_duckdb.py
#   - MIMIC-CXR integration (image_occurrence table)

# 3. BlendedICU (multi-database harmonization pipeline)
# Harmonizes MIMIC-IV + eICU + HiRID + AmsterdamUMCdb into OMOP
# Directly relevant to our federated Studies module
git clone https://github.com/USM-CHU-FGuyon/BlendedICU.git blended-icu
# Key files to examine:
#   - config.json (preprocessing options)
#   - 1_*, 2_*, 3_*, 4_write_omop.py (pipeline stages)
#   - timeseries variable definitions (41 vars, 113 active ingredients)

# 4. Original MIT-LCP MIMIC-III → OMOP (Paris et al. reference)
git clone https://github.com/MIT-LCP/mimic-omop.git mimic-omop-legacy
# Historical reference for concept mapping decisions
# Denormalized view patterns (MICROBIOLOGYEVENTS, ICUSTAYS)

# 5. Community PostgreSQL port of OHDSI ETL
git clone https://github.com/kole-geeta/MIMICiv-to-OMOP-in-PostgreSQL.git postgres-port
# Most directly usable for our PostgreSQL-native stack

# 6. MIT-LCP MIMIC-IV demo OMOP (CHoRUS project, 100-patient demo)
git clone https://github.com/MIT-LCP/mimic-iv-demo-omop.git demo-omop
```

### 1.3 Download OMOP CDM 5.4 DDL

```bash
cd ~/inpatient/schemas/cdm-5.4

# Get the official OMOP CDM 5.4 DDL for PostgreSQL
git clone https://github.com/OHDSI/CommonDataModel.git
# Key path: inst/ddl/5.4/postgresql/

# Also get the OHDSI Vocabulary download instructions
# Vocabularies must be downloaded from https://athena.ohdsi.org/
# Required vocabularies: SNOMED, LOINC, RxNorm, ICD9CM, ICD10CM, CPT4, HCPCS, NDC, ATC
```

### 1.4 Download MIMIC-IV Source Data

**IMPORTANT:** MIMIC-IV requires PhysioNet credentialed access. The user must have:
1. A PhysioNet account (https://physionet.org/)
2. Completed CITI "Data or Specimens Only Research" training
3. Signed the MIMIC-IV Data Use Agreement

```bash
cd ~/inpatient

# Download MIMIC-IV (latest version 3.1)
# Replace <username> with PhysioNet username
wget -r -N -c -np --user <PHYSIONET_USERNAME> --ask-password \
  -P data/mimic \
  https://physionet.org/files/mimiciv/3.1/

# Download MIMIC-IV clinical notes (for NLP/NOTE_NLP population)
wget -r -N -c -np --user <PHYSIONET_USERNAME> --ask-password \
  -P data/mimic \
  https://physionet.org/files/mimic-iv-note/2.2/

# OPTIONAL: Download MIMIC-IV demo (100 patients, no credentialing needed)
# Use this for initial development and testing
wget -r -N -c -np \
  -P data/mimic-demo \
  https://physionet.org/files/mimic-iv-demo/2.2/

# OPTIONAL: Download MIMIC-CXR imaging metadata (for MI-CDM integration)
wget --user <PHYSIONET_USERNAME> --ask-password \
  -P data/mimic-cxr \
  https://physionet.org/files/mimic-cxr-jpg/2.1.0/mimic-cxr-2.0.0-metadata.csv.gz \
  https://physionet.org/files/mimic-cxr-jpg/2.1.0/mimic-cxr-2.0.0-chexpert.csv.gz \
  https://physionet.org/files/mimic-cxr-jpg/2.1.0/mimic-cxr-2.0.0-split.csv.gz
```

### 1.5 Save Literature References

Create a references file documenting the key papers and their relevance:

```bash
cat > ~/inpatient/literature/references/key_papers.md << 'REFS'
# Key Literature — MIMIC-IV + OMOP Inpatient Outcomes

## ETL & Data Transformation

1. **Paris N, Lamer A, Parrot A.** Transformation and Evaluation of the MIMIC Database
   in the OMOP Common Data Model: Development and Usability Study.
   *JMIR Med Inform.* 2021;9(12):e30970.
   DOI: 10.2196/30970 | PMC: PMC8715361
   - First MIMIC→OMOP ETL (MIMIC-III, CDM 5.3.3.1)
   - 500 person-hours, 2 developers
   - 64% data items mapped, 78% concepts standardized
   - Denormalized view patterns for ICU usability
   - 160-participant datathon validation

## Inpatient Outcomes & Prediction

2. **Sheikhalishahi S, et al.** Federated Learning for Predictive Analytics in
   Weaning from Mechanical Ventilation.
   *Stud Health Technol Inform.* 2025;327:613-614.
   DOI: 10.3233/SHTI250418
   - MIMIC-IV + eICU-CRD harmonized to OMOP CDM
   - Federated XGBoost with bagging aggregation
   - 33,000+ patients, 77% AUC, 73% AUPRC
   - Ventilator weaning prediction

3. **Schwinn J, et al.** A Federated Learning Model for the Prediction of
   Blood Transfusion in Intensive Care Units.
   *Stud Health Technol Inform.* 2025;327:227-228.
   DOI: 10.3233/SHTI250311
   - MIMIC-IV + eICU-CRD in OMOP CDM
   - Blood transfusion prediction 2h in advance
   - F1 scores of 0.72 (MIMIC-IV) and 0.66 (eICU)

## ICU Quality & Bundle Compliance

4. **Islam MF, et al.** Standardizing Data Elements for Implementation of
   ICU Liberation Bundle.
   *Appl Clin Inform.* 2026;17(1):52-59.
   DOI: 10.1055/a-2802-7458 | PMC: PMC12900566
   - MIMIC-IV data mapped to OMOP CDM
   - Six ABCDEF bundle cards with OMOP vocabulary mappings
   - Pain: 11,000+ patients, median 23 assessments/day
   - Sedation: 59,000 patients, 37.7% SCCM adherence
   - Components E (mobility) & F (family) lack formal vocabularies

## Data Harmonization & Multi-Site

5. **Oliver M, et al.** Introducing the BlendedICU dataset, the first harmonized,
   international intensive care dataset.
   *J Biomed Inform.* 2023;146:104502.
   DOI: 10.1016/j.jbi.2023.104502
   - MIMIC-IV + eICU + HiRID + AmsterdamUMCdb → OMOP
   - 309,000+ ICU admissions, 13 years, 3 countries
   - 41 timeseries variables, 113 active ingredients
   - Significant variation in drug exposure and outcomes across sites

## Process Mining & Workflow

6. **Park G, Lee Y, Cho M.** Enhancing healthcare process analysis through
   object-centric process mining: Transforming OMOP CDMs into OCELs.
   *J Biomed Inform.* 2024;156:104682.
   DOI: 10.1016/j.jbi.2024.104682
   - MIMIC-IV OMOP CDM → Object-Centric Event Logs
   - First OCPM application in healthcare
   - Multi-viewpoint process models for ICU workflows

## Data Quality & Real-Time EHR

7. **Liu J, et al.** Assessment of the integrity of real-time electronic health
   record data used in clinical research.
   *PLoS One.* 2026;21(1):e0340287.
   DOI: 10.1371/journal.pone.0340287 | PMC: PMC12788664
   - Yale New Haven Health, OMOP CDM from Epic Caboodle
   - Discharge data stabilizes in 4-7 days
   - Race/ethnicity fields most volatile demographic
   - MIMIC-III synthetic data used for validation
   - Automated PySpark benchmarking pipeline

## Foundation Models & Representation

8. **Kim J, et al.** MedRep: medical concept representations for general
   electronic health record foundation models.
   *JAMIA.* 2026.
   DOI: 10.1093/jamia/ocag032
   - OMOP vocabulary covering 7.5M concepts, 66 vocabularies
   - Graph contrastive learning with knowledge distillation
   - Validated on MIMIC-IV + EHRSHOT
   - 9 prediction tasks (outcomes, phenotypes, in-hospital events)

## Knowledge Graphs

9. **Xiao G, et al.** FHIR-Ontop-OMOP: Building clinical knowledge graphs in
   FHIR RDF with the OMOP Common Data Model.
   *J Biomed Inform.* 2022;134:104201.
   DOI: 10.1016/j.jbi.2022.104201 | PMC: PMC9561043
   - Virtual clinical KGs from OMOP relational databases
   - MIMIC-III evaluation (46,520 patients)
   - FHIR RDF specification compliance
REFS
```

---

## PHASE 2: Database Setup — `parthenon.inpatient`

### 2.1 Create the Schema and CDM 5.4 Tables

```bash
cat > ~/inpatient/scripts/setup/01_create_schema.sql << 'SQL'
-- ============================================================
-- Morpheus Inpatient Workbench — Schema Setup
-- OMOP CDM 5.4 in parthenon.inpatient
-- ============================================================

-- Create the schema
CREATE SCHEMA IF NOT EXISTS inpatient;

-- Set search path for this session
SET search_path TO inpatient, public;

-- Grant usage (adjust roles as needed for your Parthenon deployment)
-- GRANT USAGE ON SCHEMA inpatient TO parthenon_app;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA inpatient TO parthenon_app;

-- ============================================================
-- CDM 5.4 Table Definitions
-- Source: https://github.com/OHDSI/CommonDataModel/tree/main/inst/ddl/5.4/postgresql
-- ============================================================
-- NOTE: The DDL below should be generated from the official OHDSI repo.
-- Run the following to extract and adapt it:
--
--   cd ~/inpatient/schemas/cdm-5.4/CommonDataModel
--   cat inst/ddl/5.4/postgresql/OMOPCDM_postgresql_5.4_ddl.sql \
--     | sed 's/@cdmDatabaseSchema/inpatient/g' \
--     > ~/inpatient/scripts/setup/02_cdm_tables.sql
--
-- Then execute:
--   psql -d parthenon -f ~/inpatient/scripts/setup/02_cdm_tables.sql
SQL
```

### 2.2 Adapt the OHDSI DDL for parthenon.inpatient

```bash
cat > ~/inpatient/scripts/setup/adapt_ddl.sh << 'BASH'
#!/bin/bash
# Adapt the official OMOP CDM 5.4 DDL for parthenon.inpatient schema

CDM_REPO=~/inpatient/schemas/cdm-5.4/CommonDataModel
OUTPUT_DIR=~/inpatient/scripts/setup
SCHEMA=inpatient

echo "=== Adapting OMOP CDM 5.4 DDL for schema: $SCHEMA ==="

# DDL (table creation)
sed "s/@cdmDatabaseSchema/$SCHEMA/g" \
  "$CDM_REPO/inst/ddl/5.4/postgresql/OMOPCDM_postgresql_5.4_ddl.sql" \
  > "$OUTPUT_DIR/02_cdm_tables.sql"

# Primary Keys
sed "s/@cdmDatabaseSchema/$SCHEMA/g" \
  "$CDM_REPO/inst/ddl/5.4/postgresql/OMOPCDM_postgresql_5.4_primary_keys.sql" \
  > "$OUTPUT_DIR/03_primary_keys.sql"

# Indices
sed "s/@cdmDatabaseSchema/$SCHEMA/g" \
  "$CDM_REPO/inst/ddl/5.4/postgresql/OMOPCDM_postgresql_5.4_indices.sql" \
  > "$OUTPUT_DIR/04_indices.sql"

# Constraints (foreign keys — apply AFTER data loading)
sed "s/@cdmDatabaseSchema/$SCHEMA/g" \
  "$CDM_REPO/inst/ddl/5.4/postgresql/OMOPCDM_postgresql_5.4_constraints.sql" \
  > "$OUTPUT_DIR/05_constraints.sql"

echo "=== DDL files generated in $OUTPUT_DIR ==="
ls -la "$OUTPUT_DIR"/*.sql
BASH
chmod +x ~/inpatient/scripts/setup/adapt_ddl.sh
```

### 2.3 Load OMOP Vocabularies

```bash
cat > ~/inpatient/scripts/loading/load_vocabularies.sh << 'BASH'
#!/bin/bash
# Load OMOP Vocabularies into parthenon.inpatient
# Prerequisites:
#   1. Download vocabularies from https://athena.ohdsi.org/
#   2. Extract to ~/inpatient/data/vocabularies/
#   Required files: CONCEPT.csv, VOCABULARY.csv, DOMAIN.csv,
#     CONCEPT_CLASS.csv, CONCEPT_RELATIONSHIP.csv, RELATIONSHIP.csv,
#     CONCEPT_SYNONYM.csv, CONCEPT_ANCESTOR.csv, DRUG_STRENGTH.csv

VOCAB_DIR=~/inpatient/data/vocabularies
SCHEMA=inpatient
DB=parthenon

echo "=== Loading OMOP Vocabularies into $SCHEMA ==="

# Load vocabulary tables (order matters for FK constraints)
for table in VOCABULARY DOMAIN CONCEPT_CLASS RELATIONSHIP CONCEPT \
             CONCEPT_RELATIONSHIP CONCEPT_ANCESTOR CONCEPT_SYNONYM DRUG_STRENGTH; do
  FILE="$VOCAB_DIR/$table.csv"
  if [ -f "$FILE" ]; then
    echo "Loading $table..."
    psql -d $DB -c "\COPY $SCHEMA.$(echo $table | tr '[:upper:]' '[:lower:]') FROM '$FILE' WITH (FORMAT csv, HEADER true, DELIMITER E'\t', QUOTE E'\b')"
  else
    echo "WARNING: $FILE not found, skipping $table"
  fi
done

echo "=== Vocabulary loading complete ==="
psql -d $DB -c "SELECT 'concept' as tbl, count(*) FROM $SCHEMA.concept
                UNION ALL
                SELECT 'concept_relationship', count(*) FROM $SCHEMA.concept_relationship
                UNION ALL
                SELECT 'vocabulary', count(*) FROM $SCHEMA.vocabulary;"
BASH
chmod +x ~/inpatient/scripts/loading/load_vocabularies.sh
```

### 2.4 ETL: MIMIC-IV → parthenon.inpatient

This is the critical step. We adapt the community PostgreSQL ETL for our schema.

```bash
cat > ~/inpatient/scripts/loading/run_etl.sh << 'BASH'
#!/bin/bash
# ============================================================
# Morpheus ETL: MIMIC-IV → parthenon.inpatient (OMOP CDM 5.4)
# ============================================================
#
# Strategy:
#   We adapt the kole-geeta/MIMICiv-to-OMOP-in-PostgreSQL ETL
#   (which is itself derived from OHDSI/MIMIC) for our schema.
#
# Prerequisites:
#   1. MIMIC-IV loaded into a 'mimiciv' schema in the same database
#      (use the official MIMIC-IV PostgreSQL loading scripts from
#       https://github.com/MIT-LCP/mimic-code/tree/main/mimic-iv/buildmimic/postgres)
#   2. OMOP vocabularies loaded into parthenon.inpatient (step 2.3)
#   3. CDM tables created in parthenon.inpatient (step 2.2)
#
# Architecture:
#   The ETL follows a 4-step pipeline:
#     Step 1: src_ (snapshot source data)
#     Step 2: lk_*_clean (clean/filter/transform)
#     Step 3: lk_*_concept (map to OMOP concepts)
#     Step 4: lk_*_mapped → cdm_* (join and distribute by domain)
#
# Execution:
#   1. Load MIMIC-IV into mimiciv schema
#   2. Run vocabulary refresh
#   3. Run DDL (create intermediate tables)
#   4. Run staging (snapshot source)
#   5. Run ETL (clean → concept → mapped → CDM)
#   6. Run unload (copy to final CDM tables)
#   7. Run validation (Achilles / DQD)

DB=parthenon
ETL_DIR=~/inpatient/etl/postgres-port
SCHEMA=inpatient

echo "=== MORPHEUS ETL: MIMIC-IV → parthenon.inpatient ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Step 0: Load MIMIC-IV into mimiciv schema if not already done
echo "--- Checking for MIMIC-IV source data ---"
MIMIC_COUNT=$(psql -d $DB -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'mimiciv'" 2>/dev/null || echo "0")
if [ "$MIMIC_COUNT" -lt "5" ]; then
  echo "ERROR: MIMIC-IV not found in mimiciv schema."
  echo "Load MIMIC-IV first using:"
  echo "  git clone https://github.com/MIT-LCP/mimic-code.git"
  echo "  cd mimic-code/mimic-iv/buildmimic/postgres"
  echo "  make mimic-gz datadir=~/inpatient/data/mimic/physionet.org/files/mimiciv/3.1/"
  exit 1
fi

echo "--- MIMIC-IV source data found ($MIMIC_COUNT tables) ---"

# Step 1-6: Run adapted ETL scripts
# NOTE: These scripts must be adapted from the postgres-port repo.
# The key adaptations are:
#   - Replace schema references with 'inpatient'
#   - Update vocabulary table prefixes
#   - Adjust for CDM 5.4 (vs 5.3.3.1) changes:
#     * episode and episode_event tables (new in 5.4)
#     * visit_detail.parent_visit_detail_id (new in 5.4)
#     * measurement.unit_source_concept_id (new in 5.4)
#     * note.note_event_table_concept_id (new in 5.4)

echo "--- Adapt and run ETL scripts from postgres-port ---"
echo "See ~/inpatient/etl/postgres-port/ for the source scripts"
echo "Key adaptation points documented in ~/inpatient/docs/mapping-specs/"

# After ETL completes:
echo "--- Post-ETL Validation ---"
psql -d $DB -c "
SELECT 'person' as table_name, count(*) as row_count FROM $SCHEMA.person
UNION ALL SELECT 'visit_occurrence', count(*) FROM $SCHEMA.visit_occurrence
UNION ALL SELECT 'visit_detail', count(*) FROM $SCHEMA.visit_detail
UNION ALL SELECT 'condition_occurrence', count(*) FROM $SCHEMA.condition_occurrence
UNION ALL SELECT 'drug_exposure', count(*) FROM $SCHEMA.drug_exposure
UNION ALL SELECT 'measurement', count(*) FROM $SCHEMA.measurement
UNION ALL SELECT 'procedure_occurrence', count(*) FROM $SCHEMA.procedure_occurrence
UNION ALL SELECT 'observation', count(*) FROM $SCHEMA.observation
UNION ALL SELECT 'note', count(*) FROM $SCHEMA.note
UNION ALL SELECT 'death', count(*) FROM $SCHEMA.death
UNION ALL SELECT 'specimen', count(*) FROM $SCHEMA.specimen
ORDER BY table_name;
"
BASH
chmod +x ~/inpatient/scripts/loading/run_etl.sh
```

### 2.5 Validation with OHDSI Data Quality Dashboard

```bash
cat > ~/inpatient/scripts/validation/run_dqd.sh << 'BASH'
#!/bin/bash
# Run OHDSI Data Quality Dashboard against parthenon.inpatient
# Requires R and the DataQualityDashboard package

cat > /tmp/run_dqd.R << 'RSCRIPT'
library(DataQualityDashboard)

# Connection details
connectionDetails <- DatabaseConnector::createConnectionDetails(
  dbms = "postgresql",
  server = "localhost/parthenon",
  user = Sys.getenv("PG_USER"),
  password = Sys.getenv("PG_PASSWORD"),
  port = 5432
)

# Run DQD
DataQualityDashboard::executeDqChecks(
  connectionDetails = connectionDetails,
  cdmDatabaseSchema = "inpatient",
  resultsDatabaseSchema = "inpatient",
  cdmSourceName = "Morpheus-MIMIC-IV",
  numThreads = 4,
  outputFolder = "~/inpatient/docs/dqd_results",
  writeToTable = TRUE,
  cdmVersion = "5.4"
)

# View results
DataQualityDashboard::viewDqDashboard(
  jsonPath = "~/inpatient/docs/dqd_results/Morpheus-MIMIC-IV.json"
)
RSCRIPT

Rscript /tmp/run_dqd.R
BASH
chmod +x ~/inpatient/scripts/validation/run_dqd.sh
```

---

## PHASE 3: Morpheus Architecture & Component Evaluation

### 3.1 Evaluate Incorporable Elements from Gathered Resources

After cloning and reviewing the repositories, evaluate each for elements that can be incorporated into Morpheus. Create an evaluation document:

```bash
cat > ~/inpatient/docs/architecture/component_evaluation.md << 'EVAL'
# Morpheus Component Evaluation Matrix

## Source Repository Assessment

For each cloned repository, evaluate and document:

### From OHDSI/MIMIC (ohdsi-mimic)
- [ ] Custom vocabulary mappings (custom_mapping_csv/) — ICU-specific concept maps
- [ ] ETL workflow configuration pattern (conf/*.etlconf)
- [ ] Metrics framework (me_total, me_mapping_rate, me_tops_together)
- [ ] Unit test patterns for ETL validation
- [ ] CDM 5.4 delta: identify what needs updating from their 5.3 baseline
- **Incorporate:** Mapping CSVs, metrics queries, unit test framework
- **Adapt:** BigQuery SQL → PostgreSQL syntax
- **Skip:** BigQuery-specific optimizations

### From CogStack/dbt_mimic_omop (cogstack-dbt)
- [ ] dbt model structure for reproducible transformations
- [ ] MI-CDM image_occurrence table schema
- [ ] MIMIC-CXR integration pattern (metadata without requiring 558GB images)
- [ ] DuckDB loading scripts (adaptable to PostgreSQL)
- [ ] Custom vocabulary loading pipeline
- **Incorporate:** MI-CDM schema for imaging analytics module integration
- **Incorporate:** dbt model patterns (consider dbt-postgres for our stack)
- **Evaluate:** Whether dbt adds value over raw SQL for our use case

### From BlendedICU (blended-icu)
- [ ] Multi-database harmonization pipeline architecture
- [ ] 41 timeseries variable definitions (what variables, how extracted)
- [ ] 113 active ingredient mappings
- [ ] Parquet-based intermediate storage pattern
- [ ] Preprocessing options (forward fill, median fill, clipping, normalization)
- **Incorporate:** Variable definitions as Morpheus standard ICU variable set
- **Incorporate:** Preprocessing pipeline patterns for real-time analytics
- **Adapt:** Parquet pipeline → PostgreSQL materialized views

### From mimic-omop-legacy (MIT-LCP)
- [ ] Denormalized view patterns (MICROBIOLOGYEVENTS, ICUSTAYS)
- [ ] NOTE_NLP pipeline (value extraction from clinical notes)
- [ ] Apache UIMA section segmentation approach
- [ ] Datathon query patterns (what analysts actually run)
- **Incorporate:** Denormalized views as Morpheus "convenience layers"
- **Incorporate:** NLP pipeline architecture for Abby integration

### From Literature: ICU Liberation Bundle Cards (Islam et al. 2026)
- [ ] Six ABCDEF bundle card definitions
- [ ] OMOP vocabulary mappings for pain, sedation, delirium
- [ ] RASS and CAM-ICU concept mappings
- [ ] Adherence criteria (37.7% SCCM sedation threshold)
- [ ] Gaps identified in Components E and F vocabularies
- **Incorporate:** Bundle cards as Morpheus clinical content modules
- **Incorporate:** Adherence monitoring as a Morpheus dashboard feature

### From Literature: Yale EHR Benchmarking (Liu et al. 2026)
- [ ] Automated data quality benchmarking pipeline
- [ ] 4-7 day discharge stabilization finding
- [ ] Demographic volatility detection (race/ethnicity)
- [ ] PySpark benchmarking scripts (MIT license)
- **Incorporate:** Data readiness assessment for Studies module integration
- **Incorporate:** Stabilization window logic for real-time feeds

### From Literature: Federated Ventilator Weaning (Sheikhalishahi et al. 2025)
- [ ] Federated XGBoost model architecture
- [ ] Feature engineering for ventilator weaning prediction
- [ ] OMOP CDM as cross-site harmonization layer
- [ ] Privacy-preserving model training pattern
- **Incorporate:** Prediction model as Morpheus built-in analytic
- **Evaluate:** Federated learning framework compatibility with Studies module

### From Literature: MedRep (Kim et al. 2026)
- [ ] OMOP concept representation vectors (7.5M concepts)
- [ ] Graph contrastive learning for concept similarity
- [ ] Transfer learning across institutions
- **Evaluate:** MedRep embeddings as foundation for Abby's clinical reasoning
- **Long-term:** Concept similarity for automated mapping suggestions
EVAL
```

### 3.2 Morpheus Architecture Specification

```bash
cat > ~/inpatient/docs/architecture/morpheus_architecture.md << 'ARCH'
# Morpheus — Inpatient Analytics Workbench Architecture

## Vision

Morpheus is the inpatient/ICU analytics module within Parthenon, providing:
1. **ICU Outcomes Research** — cohort building, outcomes analysis, prediction models
2. **Quality Monitoring** — ABCDEF bundle adherence, ventilator management, sepsis
3. **Process Analytics** — care pathway mining, length-of-stay analysis, readmissions
4. **Real-Time Readiness** — data quality assessment, stabilization monitoring
5. **Federated Analysis** — multi-site study support via OMOP harmonization

## Data Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    parthenon.inpatient                       │
│                     (OMOP CDM 5.4)                          │
├─────────────────────────────────────────────────────────────┤
│  CLINICAL DATA          │  VOCABULARY            │ DERIVED  │
│  ─────────────          │  ──────────            │ ───────  │
│  person                 │  concept               │ cohort   │
│  visit_occurrence       │  concept_relationship   │ cohort_  │
│  visit_detail           │  concept_ancestor       │  definition│
│  condition_occurrence   │  vocabulary             │ condition_│
│  drug_exposure          │  domain                 │  era     │
│  measurement            │  concept_class          │ drug_era │
│  procedure_occurrence   │  concept_synonym        │ dose_era │
│  observation            │  drug_strength          │ episode  │
│  note / note_nlp        │  source_to_concept_map  │ episode_ │
│  specimen               │  relationship           │  event   │
│  death                  │                         │          │
│  device_exposure        │                         │          │
├─────────────────────────┴─────────────────────────┴──────────┤
│  MORPHEUS EXTENSIONS (parthenon.inpatient_ext)               │
│  ──────────────────                                          │
│  morpheus_icu_stay      — Denormalized ICU stay view          │
│  morpheus_microbiology  — Denormalized micro/antibiogram      │
│  morpheus_vitals_ts     — Timeseries vitals (41 BlendedICU)   │
│  morpheus_bundle_card   — ABCDEF bundle definitions           │
│  morpheus_bundle_assess — Bundle adherence assessments        │
│  morpheus_dq_benchmark  — Data quality benchmarks             │
│  morpheus_prediction    — Prediction model results            │
│  morpheus_process_log   — Process mining event logs           │
└──────────────────────────────────────────────────────────────┘
```

## Module Components

### 3.2.1 ICU Stay Navigator
- Denormalized ICU stay timeline (derived from visit_detail)
- Patient trajectory visualization (ED → ICU → step-down → discharge)
- Length-of-stay analytics with percentile benchmarking
- Source: mimic-omop-legacy ICUSTAYS pattern + BlendedICU timeseries

### 3.2.2 Bundle Compliance Dashboard
- ABCDEF Liberation Bundle monitoring
- Real-time adherence scoring against SCCM criteria
- Pain assessment frequency tracking (target: q4h)
- Sedation depth monitoring (RASS targets, daily awakening trials)
- Delirium screening compliance (CAM-ICU completion rates)
- Early mobility milestones
- Family engagement documentation
- Source: Islam et al. 2026 bundle cards, OMOP vocabulary mappings

### 3.2.3 Outcome Prediction Engine
- Ventilator weaning prediction (adapted from Sheikhalishahi et al.)
- Blood transfusion prediction (adapted from Schwinn et al.)
- Mortality risk stratification (SAPS-II, APACHE-II via OMOP)
- Sepsis onset detection (Sepsis-3 criteria on OMOP measurements)
- Readmission risk (48-hour ICU readmission, 30-day hospital)
- Architecture: FastAPI model serving, ONNX runtime, feature store on PostgreSQL

### 3.2.4 Microbiology Workbench
- Antibiogram analysis (organism-antibiotic susceptibility)
- Blood culture cascade visualization
- Infection timeline correlation with interventions
- AMR pattern detection across cohorts
- Source: Paris et al. denormalized MICROBIOLOGYEVENTS + fact_relationship

### 3.2.5 Process Mining Console
- Object-centric event log generation (Park et al. OCPM approach)
- Care pathway discovery and conformance checking
- Bottleneck identification in ICU workflows
- Variant analysis (how care paths differ by outcome)
- Source: OMOP CDM → OCEL transformation from Park et al.

### 3.2.6 Data Quality Monitor
- Automated benchmarking (adapted from Liu et al. Yale pipeline)
- Discharge stabilization tracking
- Demographic consistency checks
- Concept mapping coverage metrics
- Data freshness indicators for real-time feeds
- Source: Liu et al. PySpark benchmarking + OHDSI DQD

### 3.2.7 Abby Integration Points
- Contextual clinical knowledge from bundle cards
- Natural language querying of ICU cohorts
- Automated literature references (OHDSI corpus + PubMed)
- Explanation of prediction model outputs
- Source: Parthenon Commons/Abby architecture

## API Layer (FastAPI)

```
/api/v1/morpheus/
  /patients/              — Patient search and demographics
  /icu-stays/             — ICU stay timelines and details
  /measurements/          — Vitals, labs, ventilator parameters
  /bundle/                — ABCDEF compliance data
  /bundle/adherence       — Adherence scores and trends
  /predictions/           — Model predictions (weaning, transfusion, etc.)
  /microbiology/          — Culture results and antibiograms
  /process/               — Process mining event logs
  /quality/               — Data quality metrics
  /cohorts/               — Cohort builder integration
```

## Frontend Components (React 19 + TypeScript)

```
src/modules/morpheus/
  components/
    IcuStayTimeline.tsx        — Patient trajectory visualization
    BundleComplianceCard.tsx   — Individual bundle component card
    BundleDashboard.tsx        — Aggregate compliance dashboard
    VitalsTimeseries.tsx       — Multi-parameter vitals chart
    PredictionPanel.tsx        — Risk scores and model outputs
    AntibiogramMatrix.tsx      — Organism vs antibiotic heatmap
    ProcessFlowDiagram.tsx     — Care pathway Sankey/flow
    DataQualityGauge.tsx       — DQ metrics visualization
  hooks/
    useMorpheusQuery.ts        — OMOP-aware data fetching
    useIcuMetrics.ts           — Computed ICU metrics
    useBundleCompliance.ts     — Bundle adherence calculations
  stores/
    morpheusStore.ts           — Module state management
  types/
    morpheus.types.ts          — TypeScript interfaces
```

## Migration Path

1. **Phase A (Current):** Load MIMIC-IV demo (100 patients) → validate CDM 5.4 schema
2. **Phase B:** Load full MIMIC-IV → build denormalized views → validate with DQD
3. **Phase C:** Implement Bundle Compliance Dashboard + ICU Stay Navigator
4. **Phase D:** Implement Prediction Engine + Microbiology Workbench
5. **Phase E:** Implement Process Mining + Data Quality Monitor
6. **Phase F:** Abby integration + federated study support
ARCH
```

### 3.3 Quick-Start: Load MIMIC-IV Demo for Testing

```bash
cat > ~/inpatient/scripts/setup/quickstart_demo.sh << 'BASH'
#!/bin/bash
# ============================================================
# Morpheus Quick-Start: Load MIMIC-IV Demo (100 patients)
# No PhysioNet credentials required for demo data
# ============================================================

set -e
DB=parthenon
SCHEMA=inpatient
DEMO_DIR=~/inpatient/data/mimic-demo

echo "╔════════════════════════════════════════════════╗"
echo "║  Morpheus Quick-Start: MIMIC-IV Demo Setup     ║"
echo "╚════════════════════════════════════════════════╝"

# Step 1: Download demo if not present
if [ ! -d "$DEMO_DIR" ]; then
  echo "--- Downloading MIMIC-IV Demo ---"
  wget -r -N -c -np \
    -P "$DEMO_DIR" \
    https://physionet.org/files/mimic-iv-demo/2.2/
fi

# Step 2: Create mimiciv schema and load demo data
echo "--- Creating mimiciv schema for source data ---"
psql -d $DB -c "CREATE SCHEMA IF NOT EXISTS mimiciv;"

# Use the official MIMIC-IV loading scripts
echo "--- Cloning mimic-code for loading scripts ---"
if [ ! -d ~/inpatient/etl/mimic-code ]; then
  git clone https://github.com/MIT-LCP/mimic-code.git ~/inpatient/etl/mimic-code
fi

cd ~/inpatient/etl/mimic-code/mimic-iv/buildmimic/postgres
echo "--- Loading MIMIC-IV demo into mimiciv schema ---"
# Adapt the Makefile or run the SQL scripts directly
# The exact invocation depends on the mimic-code version

# Step 3: Create parthenon.inpatient schema
echo "--- Creating parthenon.inpatient schema ---"
psql -d $DB -c "CREATE SCHEMA IF NOT EXISTS inpatient;"

# Step 4: Clone OMOP CDM repo and generate DDL
echo "--- Setting up OMOP CDM 5.4 DDL ---"
if [ ! -d ~/inpatient/schemas/cdm-5.4/CommonDataModel ]; then
  git clone https://github.com/OHDSI/CommonDataModel.git \
    ~/inpatient/schemas/cdm-5.4/CommonDataModel
fi

# Generate adapted DDL
CDM_REPO=~/inpatient/schemas/cdm-5.4/CommonDataModel
sed "s/@cdmDatabaseSchema/$SCHEMA/g" \
  "$CDM_REPO/inst/ddl/5.4/postgresql/OMOPCDM_postgresql_5.4_ddl.sql" \
  > ~/inpatient/scripts/setup/02_cdm_tables.sql

echo "--- Creating CDM 5.4 tables in $SCHEMA ---"
psql -d $DB -f ~/inpatient/scripts/setup/02_cdm_tables.sql

# Step 5: Download and load vocabularies
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  MANUAL STEP REQUIRED:                                     ║"
echo "║  1. Go to https://athena.ohdsi.org/                        ║"
echo "║  2. Download vocabularies (SNOMED, LOINC, RxNorm, ICD9CM,  ║"
echo "║     ICD10CM, CPT4, HCPCS, NDC, ATC, NDFRT, SPL, Gender,   ║"
echo "║     Race, Ethnicity, Currency, CMS Place of Service)       ║"
echo "║  3. Extract to ~/inpatient/data/vocabularies/               ║"
echo "║  4. Run: ~/inpatient/scripts/loading/load_vocabularies.sh   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 6: Run ETL (after vocabularies are loaded)
echo "--- After vocabulary loading, run the ETL ---"
echo "See ~/inpatient/scripts/loading/run_etl.sh"

echo ""
echo "=== Quick-start setup complete ==="
echo "Next steps:"
echo "  1. Download vocabularies from Athena"
echo "  2. Load vocabularies: ~/inpatient/scripts/loading/load_vocabularies.sh"
echo "  3. Run ETL: ~/inpatient/scripts/loading/run_etl.sh"
echo "  4. Validate: ~/inpatient/scripts/validation/run_dqd.sh"
BASH
chmod +x ~/inpatient/scripts/setup/quickstart_demo.sh
```

---

## PHASE 4: Morpheus-Specific Extensions

### 4.1 Create Denormalized Convenience Views

These are the "Morpheus views" that make the OMOP CDM usable for ICU researchers without requiring deep CDM knowledge.

```sql
-- ~/inpatient/schemas/views/morpheus_views.sql

-- ============================================================
-- Morpheus ICU Stay View
-- Denormalized view of ICU admissions with key metrics
-- Inspired by Paris et al. ICUSTAYS pattern
-- ============================================================
CREATE OR REPLACE VIEW inpatient.morpheus_icu_stay AS
SELECT
    vd.visit_detail_id,
    vd.person_id,
    p.year_of_birth,
    p.gender_concept_id,
    gc.concept_name AS gender,
    p.race_concept_id,
    rc.concept_name AS race,
    vo.visit_occurrence_id,
    vo.visit_start_datetime AS hospital_admit_dt,
    vo.visit_end_datetime AS hospital_discharge_dt,
    vd.visit_detail_start_datetime AS icu_admit_dt,
    vd.visit_detail_end_datetime AS icu_discharge_dt,
    EXTRACT(EPOCH FROM (vd.visit_detail_end_datetime - vd.visit_detail_start_datetime)) / 3600.0
        AS icu_los_hours,
    EXTRACT(EPOCH FROM (vo.visit_end_datetime - vo.visit_start_datetime)) / 86400.0
        AS hospital_los_days,
    cs.concept_name AS care_site_name,
    d.death_date,
    CASE WHEN d.person_id IS NOT NULL THEN TRUE ELSE FALSE END AS died_in_hospital,
    CASE WHEN d.death_date BETWEEN vd.visit_detail_start_datetime::date
        AND vd.visit_detail_end_datetime::date THEN TRUE ELSE FALSE END AS died_in_icu
FROM inpatient.visit_detail vd
JOIN inpatient.visit_occurrence vo ON vd.visit_occurrence_id = vo.visit_occurrence_id
JOIN inpatient.person p ON vd.person_id = p.person_id
LEFT JOIN inpatient.concept gc ON p.gender_concept_id = gc.concept_id
LEFT JOIN inpatient.concept rc ON p.race_concept_id = rc.concept_id
LEFT JOIN inpatient.care_site cs_tbl ON vd.care_site_id = cs_tbl.care_site_id
LEFT JOIN inpatient.concept cs ON cs_tbl.place_of_service_concept_id = cs.concept_id
LEFT JOIN inpatient.death d ON vd.person_id = d.person_id
WHERE vd.visit_detail_concept_id IN (
    -- ICU visit detail concepts
    SELECT concept_id FROM inpatient.concept
    WHERE concept_name ILIKE '%intensive care%'
       OR concept_name ILIKE '%critical care%'
       OR concept_name ILIKE '%ICU%'
);

-- ============================================================
-- Morpheus Vitals Timeseries View
-- Core vital signs in wide format for timeseries analysis
-- Based on BlendedICU 41-variable specification
-- ============================================================
CREATE OR REPLACE VIEW inpatient.morpheus_vitals_wide AS
WITH vitals_long AS (
    SELECT
        m.person_id,
        m.visit_detail_id,
        m.measurement_datetime,
        c.concept_name AS measurement_name,
        m.value_as_number,
        uc.concept_name AS unit_name,
        m.measurement_concept_id
    FROM inpatient.measurement m
    JOIN inpatient.concept c ON m.measurement_concept_id = c.concept_id
    LEFT JOIN inpatient.concept uc ON m.unit_concept_id = uc.concept_id
    WHERE m.value_as_number IS NOT NULL
)
SELECT
    person_id,
    visit_detail_id,
    measurement_datetime,
    MAX(CASE WHEN measurement_concept_id = 3004249 THEN value_as_number END) AS heart_rate,
    MAX(CASE WHEN measurement_concept_id = 3012888 THEN value_as_number END) AS sbp,
    MAX(CASE WHEN measurement_concept_id = 3018586 THEN value_as_number END) AS dbp,
    MAX(CASE WHEN measurement_concept_id = 3027018 THEN value_as_number END) AS mean_bp,
    MAX(CASE WHEN measurement_concept_id = 3024171 THEN value_as_number END) AS resp_rate,
    MAX(CASE WHEN measurement_concept_id = 3020891 THEN value_as_number END) AS temp_c,
    MAX(CASE WHEN measurement_concept_id = 3016502 THEN value_as_number END) AS spo2,
    MAX(CASE WHEN measurement_concept_id = 3024128 THEN value_as_number END) AS fio2,
    MAX(CASE WHEN measurement_concept_id = 21490852 THEN value_as_number END) AS peep,
    MAX(CASE WHEN measurement_concept_id = 3012544 THEN value_as_number END) AS tidal_volume
FROM vitals_long
GROUP BY person_id, visit_detail_id, measurement_datetime;

-- ============================================================
-- Morpheus ABCDEF Bundle Assessment View
-- Maps MIMIC-IV assessment data to Liberation Bundle components
-- Based on Islam et al. 2026 bundle card definitions
-- ============================================================
CREATE OR REPLACE VIEW inpatient.morpheus_bundle_assessment AS
SELECT
    m.person_id,
    m.visit_detail_id,
    m.measurement_datetime AS assessment_time,
    CASE
        -- Component A: Assess, Prevent, and Manage Pain
        WHEN m.measurement_concept_id IN (
            -- Pain scale concepts (NRS, BPS, CPOT)
            SELECT concept_id FROM inpatient.concept
            WHERE concept_name ILIKE '%pain%scale%'
               OR concept_name ILIKE '%behavioral pain%'
        ) THEN 'A_Pain'
        -- Component B: Both SAT and SBT
        WHEN m.measurement_concept_id IN (
            SELECT concept_id FROM inpatient.concept
            WHERE concept_name ILIKE '%richmond%agitation%'
               OR concept_name ILIKE '%RASS%'
               OR concept_name ILIKE '%sedation%'
        ) THEN 'B_Sedation'
        -- Component C: Choice of Analgesia and Sedation
        -- (Tracked via drug_exposure, not measurements)
        -- Component D: Delirium - Assess and Manage
        WHEN m.measurement_concept_id IN (
            SELECT concept_id FROM inpatient.concept
            WHERE concept_name ILIKE '%CAM-ICU%'
               OR concept_name ILIKE '%confusion assessment%'
               OR concept_name ILIKE '%delirium%'
        ) THEN 'D_Delirium'
        ELSE 'Other'
    END AS bundle_component,
    c.concept_name AS assessment_type,
    m.value_as_number,
    m.value_as_concept_id,
    vc.concept_name AS value_label
FROM inpatient.measurement m
JOIN inpatient.concept c ON m.measurement_concept_id = c.concept_id
LEFT JOIN inpatient.concept vc ON m.value_as_concept_id = vc.concept_id
WHERE m.measurement_concept_id IN (
    SELECT concept_id FROM inpatient.concept
    WHERE concept_name ILIKE '%pain%scale%'
       OR concept_name ILIKE '%richmond%agitation%'
       OR concept_name ILIKE '%RASS%'
       OR concept_name ILIKE '%CAM-ICU%'
       OR concept_name ILIKE '%confusion assessment%'
       OR concept_name ILIKE '%delirium%'
       OR concept_name ILIKE '%behavioral pain%'
       OR concept_name ILIKE '%sedation%'
);
```

### 4.2 Create Morpheus Configuration

```bash
cat > ~/inpatient/config/morpheus.yaml << 'CONFIG'
# Morpheus Inpatient Workbench Configuration
# Part of the Parthenon Platform

morpheus:
  version: "0.1.0"
  name: "Morpheus"
  description: "Inpatient Analytics Workbench"

  database:
    schema: "inpatient"
    cdm_version: "5.4"
    source: "MIMIC-IV"

  modules:
    icu_navigator:
      enabled: true
      features:
        - patient_trajectory
        - los_analytics
        - acuity_scoring

    bundle_compliance:
      enabled: true
      bundle_version: "SCCM-2018"
      components:
        - A_pain_management
        - B_sedation_trials
        - C_sedation_choice
        - D_delirium_monitoring
        - E_early_mobility
        - F_family_engagement
      adherence_thresholds:
        pain_assessment_interval_hours: 4
        rass_target_range: [-2, 0]
        cam_icu_frequency_hours: 8
        mobility_target_level: 2

    predictions:
      enabled: true
      models:
        - name: ventilator_weaning
          type: xgboost
          update_frequency: hourly
        - name: blood_transfusion
          type: xgboost
          prediction_horizon_hours: 2
        - name: sepsis_onset
          type: ensemble
          lookback_hours: 6
        - name: mortality_risk
          type: logistic
          scoring: saps_ii

    microbiology:
      enabled: true
      features:
        - antibiogram
        - blood_culture_cascade
        - amr_surveillance

    process_mining:
      enabled: false  # Phase E
      event_log_format: "OCEL2.0"

    data_quality:
      enabled: true
      stabilization_window_days: 7
      benchmark_frequency: daily

  abby_integration:
    enabled: true
    knowledge_sources:
      - bundle_cards
      - ohdsi_corpus
      - prediction_explanations

  federated:
    enabled: false  # Phase F
    protocol: "flower"
    aggregation: "bagging"
CONFIG
```

---

## PHASE 5: Execution Checklist

Execute the phases in order. Check off each step as completed.

```
□ PHASE 1: Resource Gathering
  □ 1.1 Create directory structure
  □ 1.2 Clone all 6 ETL repositories
  □ 1.3 Clone OMOP CDM 5.4 DDL repo
  □ 1.4 Download MIMIC-IV demo data (100 patients)
  □ 1.5 Save literature references document

□ PHASE 2: Database Setup
  □ 2.1 Create parthenon.inpatient schema
  □ 2.2 Generate adapted CDM 5.4 DDL (adapt_ddl.sh)
  □ 2.3 Execute DDL to create CDM tables
  □ 2.4 Download OMOP vocabularies from Athena
  □ 2.5 Load vocabularies (load_vocabularies.sh)
  □ 2.6 Load MIMIC-IV demo into mimiciv schema
  □ 2.7 Run ETL: mimiciv → parthenon.inpatient
  □ 2.8 Validate row counts across CDM tables
  □ 2.9 Run OHDSI Data Quality Dashboard

□ PHASE 3: Architecture
  □ 3.1 Complete component evaluation matrix
  □ 3.2 Review and refine architecture spec
  □ 3.3 Identify CDM 5.4 deltas vs 5.3 in ETL scripts

□ PHASE 4: Extensions
  □ 4.1 Create and test denormalized views
  □ 4.2 Validate bundle assessment view against MIMIC-IV data
  □ 4.3 Create Morpheus configuration file

□ PHASE 5: Validation
  □ 5.1 Verify all repos cloned and accessible
  □ 5.2 Run sample queries against loaded CDM
  □ 5.3 Generate initial Achilles characterization
  □ 5.4 Document any ETL issues or mapping gaps
```

---

## Key Technical Notes

### CDM 5.3 → 5.4 Migration Points
The existing ETL repos mostly target CDM 5.3.x. Key 5.4 additions to handle:
1. **episode / episode_event tables** — new tables for disease episodes (cancer, pregnancy)
2. **visit_detail.parent_visit_detail_id** — hierarchical visit details
3. **measurement.unit_source_concept_id** — source unit tracking
4. **note.note_event_table_concept_id** — links notes to clinical events
5. **cost table changes** — updated cost model

### PostgreSQL Optimization Notes
- Create GIN indexes on measurement_concept_id for vitals queries
- Partition measurement table by measurement_date (365M+ rows)
- Use materialized views for denormalized patterns, refresh on schedule
- Enable pg_stat_statements for query performance monitoring
- Consider TimescaleDB extension for vitals timeseries if performance requires it

### MIMIC-IV → OMOP Concept Mapping Priorities
Based on the literature, prioritize these mappings for Morpheus:
1. **Vitals** (HR, BP, RR, SpO2, Temp) — LOINC mapping well-established
2. **Ventilator parameters** (FiO2, PEEP, TV, PIP, RR) — custom mapping needed
3. **Sedation scores** (RASS) — LOINC 54632-7
4. **Delirium scores** (CAM-ICU) — LOINC custom panels
5. **Pain scores** (NRS, BPS, CPOT) — LOINC mapping partial
6. **Laboratory results** — LOINC mapping excellent (~95% coverage)
7. **Medications/infusions** — RxNorm mapping moderate (~56% in Paris et al.)
8. **Microbiology** — SNOMED mapping via custom fact_relationship patterns