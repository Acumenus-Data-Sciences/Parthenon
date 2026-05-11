Landscape analysis acknowledges that Mt. Sinai and Johns Hopkins have the most mature OMOP implementations — both built via direct ETL against Epic Clarity (which at JHU took 2,000+ person-hours). The plan makes the case for why Parthenon should layer FHIR R4 Bulk Data on top: vendor-agnostic extraction, regulatory tailwind from the Cures Act, and a target of <400 person-hours per new site — while honestly documenting where FHIR falls short (custom fields, billing granularity, historical backfills) and building in hybrid ingestion paths.
Architecture is a 6-phase pipeline: SMART Backend Services extraction → Spark transformation with concept-driven routing → Athena vocabulary mapping → multi-database OMOP CDM v5.4 loading (PostgreSQL, BigQuery, Snowflake, Redshift) → DQD/ACHILLES validation → Airflow orchestration.
The critical design insight from the HL7 Vulcan IG (which just went to ballot in September 2025) is baked throughout: FHIR resources don't map 1:1 to OMOP tables by name. A FHIR Observation might become a measurement, condition_occurrence, or procedure_occurrence depending on the coded concepts it carries. The transformation engine implements a domain classifier for this routing.
Code examples include a complete FHIR Bulk Export client with JWT auth, PySpark transformation logic for Patient→person and Condition→condition_occurrence, and a vocabulary lookup service with LRU caching. Field-level mapping tables cover the 5 most important resource types.# Parthenon Project: EHR-to-OMOP via FHIR R4 Implementation Plan

## Claude Code Execution Guide for Institutional-Scale ETL

**Version:** 1.0
**Date:** March 5, 2026
**Author:** Generated for Sanjay Mudoshi — Parthenon Project
**Scope:** Epic + Cerner (Oracle Health) → FHIR R4 Bulk Data → OMOP CDM v5.4

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Landscape Analysis & Prior Art](#2-landscape-analysis--prior-art)
3. [Architecture Overview](#3-architecture-overview)
4. [Phase 1 — FHIR R4 Bulk Data Extraction](#4-phase-1--fhir-r4-bulk-data-extraction)
5. [Phase 2 — FHIR-to-OMOP Transformation Engine](#5-phase-2--fhir-to-omop-transformation-engine)
6. [Phase 3 — Vocabulary Mapping & Harmonization](#6-phase-3--vocabulary-mapping--harmonization)
7. [Phase 4 — OMOP CDM Loading & Multi-DB Support](#7-phase-4--omop-cdm-loading--multi-db-support)
8. [Phase 5 — Data Quality, Validation & OHDSI Tools](#8-phase-5--data-quality-validation--ohdsi-tools)
9. [Phase 6 — Operational Deployment & Monitoring](#9-phase-6--operational-deployment--monitoring)
10. [FHIR→OMOP Resource Mapping Reference](#10-fhiromop-resource-mapping-reference)
11. [Code Examples](#11-code-examples)
12. [Risk Register & Mitigations](#12-risk-register--mitigations)
13. [Timeline & Milestones](#13-timeline--milestones)
14. [References & Sources](#14-references--sources)

---

## 1. Executive Summary

The Parthenon project aims to build an institutional-scale pipeline that extracts clinical data from Epic and Cerner EHR systems via their FHIR R4 Bulk Data APIs, transforms it through a semantically-aware ETL engine, and loads it into OMOP CDM v5.4 repositories across multiple database backends (PostgreSQL, BigQuery, Snowflake, Redshift).

### Why FHIR as the extraction layer (rather than direct Clarity/Millennium ETL)?

Most advanced OHDSI implementations — including Mt. Sinai's MSDW and Johns Hopkins — built their OMOP CDMs by writing direct ETL against proprietary schemas (Epic Clarity, Cerner Millennium). Johns Hopkins' initial Clarity-to-OMOP ETL required **over 2,000 person-hours** of developer time. This approach, while battle-tested, has critical drawbacks at multi-institutional scale:

| Concern | Direct ETL (Clarity/Millennium) | FHIR R4 Bulk Data |
|---|---|---|
| **Vendor lock-in** | Separate ETL per vendor schema | Single pipeline, vendor-agnostic |
| **Regulatory mandate** | No mandate | 21st Century Cures Act / ONC requires FHIR R4 |
| **Schema stability** | Proprietary, changes with upgrades | HL7 standard, versioned |
| **Multi-site deployment** | Rewrite per site | Configure per site |
| **Access model** | Direct DB access required | API-based, firewall-friendly |
| **Person-hours to deploy** | 2,000+ (JHU benchmark) | Target: <400 with Parthenon |
| **Data completeness** | Full (all tables) | Limited to exposed FHIR resources |

**The Parthenon bet:** FHIR R4 Bulk Data APIs now expose enough clinical data for most OHDSI research use cases, and the regulatory tailwind (Cures Act, TEFCA) means coverage will only grow. By building on FHIR, Parthenon trades some data completeness for dramatic reductions in deployment cost and multi-site scalability.

**Where FHIR falls short:** Custom EHR fields, historical data loads, cost/billing granularity, and certain clinical note types may still require supplementary direct ETL or flat-file ingestion. The architecture accommodates hybrid ingestion.

---

## 2. Landscape Analysis & Prior Art

### 2.1 Mt. Sinai MSDW (Gold Standard — Direct ETL)

Mt. Sinai's Data Warehouse team maintains one of the most mature OMOP implementations in the OHDSI network. Their CDM incorporates features from OMOP v5.3 and v6.0 and is upgrading to v5.4. Key characteristics:

- **Extraction:** Direct ETL from Epic Clarity database
- **Scale:** Full institutional data (millions of patients)
- **Tooling:** Custom SQL-based ETL, ATLAS for cohort queries
- **Lessons for Parthenon:** Their vocabulary mapping and DQD configurations are reference implementations. However, the Clarity-specific ETL code is not portable to Cerner sites.

Recently, a Mt. Sinai-adjacent project built a FHIR-to-OMOP pipeline consisting of **122 Python and 20 SQL transformation steps** with Spark optimization, demonstrating that FHIR-based ingestion can reach institutional scale.

### 2.2 Johns Hopkins (Reduced-Barrier ETL)

Johns Hopkins pioneered efforts to reduce the ETL barrier:

- **Initial effort:** >2,000 person-hours for Clarity → OMOP
- **Optimized approach:** Provided default configuration transformations, reducing deployment at alpha test sites to **<200 person-hours** with high data quality
- **PCORnet bridge:** Built an open-source ETL tool for PCORnet CDM → OMOP conversion for COVID-19 data integration

### 2.3 HL7 Vulcan FHIR-to-OMOP IG (Emerging Standard)

The HL7 Vulcan FHIR-to-OMOP project completed its **September 2025 ballot cycle** after 2+ years of development. This Implementation Guide (IG) provides:

- Formal StructureMap definitions for FHIR → OMOP transformations
- Coded field mapping principles (concept-driven, not just schema-driven)
- Coverage of core EHR data resource types

**This IG is the canonical reference Parthenon should build against.**

### 2.4 Commercial Solutions

- **InterSystems OMOP:** Cloud SaaS, no-code FHIR-to-OMOP pipeline with daily Bulk FHIR refresh, built on IRIS. Production-ready but proprietary.
- **Microsoft Azure OMOP Transformations:** Built into Healthcare Data Solutions, covers core FHIR resources.

### 2.5 Open-Source Implementations

- **OHDSI/ETL-German-FHIR-Core:** SpringBatch-based, tested at 10 German university hospitals, 99% DQD conformance on 392K resources
- **GT-FHIR (Georgia Tech):** OMOP-on-FHIR server with bidirectional mapping
- **MENDS-on-FHIR:** Uses Whistle (JSON-to-JSON engine) for OMOP → FHIR, extracted 1.13 trillion resources

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PARTHENON ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                              │
│  │  Epic     │  │  Cerner  │  │  Other   │   EHR Layer                  │
│  │  FHIR R4  │  │  FHIR R4 │  │  FHIR R4 │                              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                              │
│       │              │              │                                    │
│       ▼              ▼              ▼                                    │
│  ┌──────────────────────────────────────┐                               │
│  │     FHIR Bulk Data Extraction        │   Phase 1                     │
│  │     (SMART Backend Services)         │                               │
│  │     ┌─────────────────────────┐      │                               │
│  │     │  NDJSON → Raw Storage   │      │                               │
│  │     │  (S3 / GCS / ADLS)     │      │                               │
│  │     └─────────────────────────┘      │                               │
│  └──────────────┬───────────────────────┘                               │
│                 │                                                        │
│                 ▼                                                        │
│  ┌──────────────────────────────────────┐                               │
│  │     Transformation Engine            │   Phase 2                     │
│  │     (Apache Spark / Python)          │                               │
│  │     ┌─────────────────────────┐      │                               │
│  │     │  FHIR Resource Parser   │      │                               │
│  │     │  Concept Router         │      │                               │
│  │     │  Domain Classifier      │      │                               │
│  │     └─────────────────────────┘      │                               │
│  └──────────────┬───────────────────────┘                               │
│                 │                                                        │
│                 ▼                                                        │
│  ┌──────────────────────────────────────┐                               │
│  │     Vocabulary Mapping Service       │   Phase 3                     │
│  │     ┌─────────────────────────┐      │                               │
│  │     │  Athena Vocabulary DB   │      │                               │
│  │     │  SNOMED/LOINC/RxNorm    │      │                               │
│  │     │  Usagi (custom maps)    │      │                               │
│  │     │  SOURCE_TO_CONCEPT_MAP  │      │                               │
│  │     └─────────────────────────┘      │                               │
│  └──────────────┬───────────────────────┘                               │
│                 │                                                        │
│                 ▼                                                        │
│  ┌──────────────────────────────────────┐                               │
│  │     OMOP CDM v5.4 Loader            │   Phase 4                     │
│  │     ┌─────┐ ┌─────┐ ┌────────┐      │                               │
│  │     │ PG  │ │ BQ  │ │Snowflk │      │                               │
│  │     └─────┘ └─────┘ └────────┘      │                               │
│  └──────────────┬───────────────────────┘                               │
│                 │                                                        │
│                 ▼                                                        │
│  ┌──────────────────────────────────────┐                               │
│  │     Validation & OHDSI Tools         │   Phase 5                     │
│  │     DQD │ ACHILLES │ ATLAS │ WebAPI  │                               │
│  └──────────────────────────────────────┘                               │
│                                                                         │
│  ┌──────────────────────────────────────┐                               │
│  │     Ops: Airflow │ Monitoring │ RBAC │   Phase 6                     │
│  └──────────────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **FHIR-first, hybrid-capable:** Primary ingestion via FHIR Bulk Data; supplementary connectors for Clarity flat files and custom extracts where FHIR coverage gaps exist.
2. **Concept-driven routing:** Following the HL7 Vulcan IG principle — FHIR resources are routed to OMOP tables based on the *concepts they carry*, not their resource type name.
3. **Spark for scale, Python for logic:** Apache Spark handles the data volume (NDJSON → Parquet → transforms); Python implements the mapping logic and vocabulary lookups.
4. **Multi-database abstraction:** A loader layer that generates DDL and DML for PostgreSQL, BigQuery, and Snowflake from a single transformation output.

---

## 4. Phase 1 — FHIR R4 Bulk Data Extraction

### 4.1 Authentication: SMART Backend Services

Both Epic and Cerner support the SMART Backend Services profile (OAuth 2.0 client_credentials with signed JWT assertions). This is the appropriate auth model for server-to-server bulk data access without user interaction.

**Registration requirements:**

| Step | Epic | Cerner (Oracle Health) |
|---|---|---|
| App registration | App Orchard / open.epic.com | Oracle Health Developer Portal |
| Auth type | SMART Backend Services | SMART Backend Services |
| Key format | JWKS endpoint or inline | JWKS endpoint |
| Scopes | `system/*.read` | `system/*.read` |
| Approval process | App Orchard review + site activation | Developer portal + site activation |

**Claude Code implementation steps:**

```bash
# Step 1: Generate RSA key pair for JWT signing
openssl genrsa -out parthenon_private.pem 2048
openssl rsa -in parthenon_private.pem -pubout -out parthenon_public.pem

# Step 2: Create JWKS from public key (for registration)
# Use a tool like python-jose or node-jose
```

### 4.2 Bulk Export Invocation

The FHIR Bulk Data Access specification defines three export operations:

| Operation | Endpoint | Use Case |
|---|---|---|
| System Export | `GET [base]/$export` | All data (rarely used at scale) |
| Patient Export | `GET [base]/Patient/$export` | All patient-related data |
| Group Export | `GET [base]/Group/[id]/$export` | Specific cohort (preferred) |

**Recommended approach:** Use **Group Export** with a pre-defined group of eligible patients. This allows incremental exports and avoids pulling the entire patient population on every run.

**Key parameters:**

```http
GET [base]/Group/[groupId]/$export
  ?_type=Patient,Condition,Encounter,MedicationRequest,Observation,
         Procedure,DiagnosticReport,Immunization,AllergyIntolerance,
         Device,DocumentReference
  &_since=2026-03-01T00:00:00Z
  &_outputFormat=application/fhir+ndjson
Accept: application/fhir+json
Prefer: respond-async
Authorization: Bearer {access_token}
```

### 4.3 Epic-Specific Considerations

- **Supported resources for Bulk:** Patient, AllergyIntolerance, CarePlan, CareTeam, Condition, Device, DiagnosticReport, DocumentReference, Encounter, Goal, Immunization, Location, Medication, MedicationRequest, Observation, Organization, Patient, Practitioner, Procedure, RelatedPerson
- **Rate limits:** Vary by site; typically 1 concurrent bulk export job, with polling interval of 10-30 seconds
- **`_since` support:** Yes — critical for incremental loads
- **Output:** NDJSON files, accessed via URLs returned in the export status response
- **Quirks:** Epic may split large exports across multiple NDJSON files per resource type. File URLs expire after a configurable window (often 1 hour).

### 4.4 Cerner (Oracle Health)-Specific Considerations

- **Supported operations:** Group Export and Patient Export
- **IG version:** Supports v1.0.1 of Bulk Data Access IG
- **Authentication:** No open endpoint support — all bulk operations require authenticated backend services
- **Throttling:** Bulk data runs against the organization's production database — coordinate with IT to schedule during off-peak hours
- **Differences from Epic:** Parameter handling and supported experimental parameters differ. Test thoroughly in sandbox before production.

### 4.5 NDJSON Staging Architecture

```
parthenon-raw/
├── site_id=hospital_a/
│   ├── export_date=2026-03-05/
│   │   ├── Patient-1.ndjson
│   │   ├── Patient-2.ndjson
│   │   ├── Condition-1.ndjson
│   │   ├── Encounter-1.ndjson
│   │   ├── MedicationRequest-1.ndjson
│   │   ├── Observation-1.ndjson
│   │   ├── Observation-2.ndjson    # large; split by EHR
│   │   ├── Procedure-1.ndjson
│   │   └── _export_metadata.json
│   └── export_date=2026-03-04/
│       └── ...
└── site_id=hospital_b/
    └── ...
```

Store raw NDJSON in cloud object storage (S3/GCS/ADLS) with Hive-style partitioning by site and export date. This enables time-travel, reproducibility, and parallel Spark reads.

**Claude Code task:** Set up the extraction service as a Python package with:
- JWT token management with auto-refresh
- Async bulk export polling with exponential backoff
- NDJSON download with checksum validation
- Partitioned storage writer for S3/GCS

---

## 5. Phase 2 — FHIR-to-OMOP Transformation Engine

### 5.1 Core Principle: Concept-Driven Routing

This is the single most important architectural insight from the HL7 Vulcan IG:

> **FHIR resources do not map 1:1 to OMOP tables by name.** A FHIR `Observation` resource might become a `measurement`, `condition_occurrence`, `observation`, or `procedure_occurrence` record in OMOP, depending on the coded concepts it carries.

The transformation engine must implement a **Domain Classifier** that inspects the coded concepts in each FHIR resource and routes it to the correct OMOP CDM table.

### 5.2 Resource-to-Table Routing Matrix

| FHIR Resource | Primary OMOP Table | Conditional Routing |
|---|---|---|
| `Patient` | `person` | Always → person |
| `Encounter` | `visit_occurrence`, `visit_detail` | Inpatient/ED → visit_occurrence; nested encounters → visit_detail |
| `Condition` | `condition_occurrence` | Check domain of concept; some may route to `observation` |
| `MedicationRequest` | `drug_exposure` | `drug_type_concept_id` = 38000177 (Rx written) |
| `MedicationStatement` | `drug_exposure` | `drug_type_concept_id` = 38000175 (Pt reported) |
| `MedicationAdministration` | `drug_exposure` | `drug_type_concept_id` = 38000180 (inpatient admin) |
| `Immunization` | `drug_exposure` | CVX codes → RxNorm via vocabulary |
| `Observation` (lab) | `measurement` | LOINC codes in Measurement domain |
| `Observation` (vital) | `measurement` | LOINC vitals codes |
| `Observation` (social hx) | `observation` | Social determinant codes → Observation domain |
| `Observation` (survey) | `observation` | Survey instrument codes |
| `Procedure` | `procedure_occurrence` | CPT/SNOMED procedure codes |
| `DiagnosticReport` | `measurement` / `note` | Lab panels → measurements; text reports → note |
| `AllergyIntolerance` | `observation` | Allergy domain concepts |
| `Device` | `device_exposure` | When device is actively used/implanted |
| `DocumentReference` | `note` | Clinical notes (if NLP pipeline exists) |

### 5.3 Transformation Pipeline Steps

```
NDJSON Files
    │
    ▼
[1] Spark Read (NDJSON → DataFrame)
    │
    ▼
[2] Schema Normalization
    │   - Flatten nested FHIR structures
    │   - Handle Epic vs Cerner structural differences
    │   - Extract coded elements (system + code pairs)
    │
    ▼
[3] Concept Extraction
    │   - Extract all coding[] arrays
    │   - Identify primary code by system priority:
    │     SNOMED > LOINC > RxNorm > ICD-10 > CPT > local
    │
    ▼
[4] Vocabulary Lookup & Domain Classification
    │   - Map source codes → OMOP concept_id via CONCEPT table
    │   - Determine target domain from concept.domain_id
    │   - Route resource to appropriate OMOP table
    │
    ▼
[5] Field Mapping
    │   - Map FHIR fields to OMOP columns per resource type
    │   - Apply type conversions, date parsing, unit normalization
    │
    ▼
[6] Referential Integrity
    │   - Resolve Patient → person_id
    │   - Resolve Encounter → visit_occurrence_id
    │   - Resolve Practitioner → provider_id
    │
    ▼
[7] Output: OMOP-shaped DataFrames / Parquet files
```

### 5.4 Handling Epic vs. Cerner Structural Differences

While both systems expose FHIR R4 resources, there are practical differences:

| Element | Epic | Cerner |
|---|---|---|
| `Condition.code` | Typically includes ICD-10 + SNOMED | May include ICD-10 + proprietary |
| `Observation.code` | LOINC for labs, custom for others | LOINC for labs, may use different systems for vitals |
| `MedicationRequest.medicationCodeableConcept` | RxNorm + NDC | RxNorm, sometimes proprietary |
| `Encounter.class` | FHIR valueset codes | May use extensions |
| Extensions | Epic-specific extensions (prefix `epic-`) | Oracle Health extensions |

**Strategy:** Build a normalization layer that abstracts vendor differences before the core transformation logic. This layer handles:
- Extension extraction and mapping
- Code system normalization (e.g., mapping vendor-specific code systems to standard terminologies)
- Structural flattening differences

---

## 6. Phase 3 — Vocabulary Mapping & Harmonization

### 6.1 Vocabulary Priority Hierarchy

The HL7 Vulcan IG establishes clear priority rules for coded field mapping:

| Clinical Domain | Priority Vocabulary | Fallback |
|---|---|---|
| Conditions, findings | **SNOMED CT** | ICD-10-CM → OMOP mapping |
| Medications | **RxNorm** | NDC → RxNorm via vocabulary |
| Lab tests, measurements | **LOINC** | Local → LOINC via Usagi |
| Procedures | **SNOMED CT** | CPT-4, HCPCS → OMOP mapping |
| Demographics (race, ethnicity) | **CDC Race/Ethnicity** | OMB categories |

### 6.2 OHDSI Vocabulary Infrastructure

**Athena (vocabulary download):** Download the full OHDSI vocabulary bundle from athena.ohdsi.org. This provides the `CONCEPT`, `CONCEPT_RELATIONSHIP`, `CONCEPT_ANCESTOR`, `CONCEPT_SYNONYM`, `VOCABULARY`, `DOMAIN`, and `CONCEPT_CLASS` tables.

**Key tables for mapping:**

- `CONCEPT`: The master lookup — maps `vocabulary_id` + `concept_code` → `concept_id` + `domain_id`
- `CONCEPT_RELATIONSHIP`: Provides "Maps to" relationships (e.g., ICD-10-CM → SNOMED CT standard concept)
- `SOURCE_TO_CONCEPT_MAP`: Custom mappings for local codes not in standard vocabularies

### 6.3 Mapping Algorithm

```python
def map_fhir_code_to_omop(coding_list: list[dict]) -> dict:
    """
    Given a list of FHIR Coding objects from a resource's code field,
    resolve to an OMOP concept_id and determine the target domain.

    Priority order:
    1. Direct match on standard vocabulary (SNOMED, LOINC, RxNorm)
    2. "Maps to" relationship from source vocabulary (ICD-10, CPT)
    3. SOURCE_TO_CONCEPT_MAP for local/custom codes
    4. concept_id = 0 (unmapped) with source_value preserved
    """

    # System URI → OHDSI vocabulary_id mapping
    SYSTEM_TO_VOCAB = {
        "http://snomed.info/sct": "SNOMED",
        "http://loinc.org": "LOINC",
        "http://www.nlm.nih.gov/research/umls/rxnorm": "RxNorm",
        "http://hl7.org/fhir/sid/icd-10-cm": "ICD10CM",
        "http://hl7.org/fhir/sid/icd-10": "ICD10",
        "http://www.ama-assn.org/go/cpt": "CPT4",
        "http://hl7.org/fhir/sid/ndc": "NDC",
        "http://hl7.org/fhir/sid/cvx": "CVX",
        "urn:oid:2.16.840.1.113883.6.238": "Race",
    }

    # Priority: try standard vocabularies first
    PRIORITY_VOCABS = ["SNOMED", "LOINC", "RxNorm"]

    best_match = None

    for coding in coding_list:
        system = coding.get("system", "")
        code = coding.get("code", "")
        vocab_id = SYSTEM_TO_VOCAB.get(system)

        if not vocab_id:
            continue

        # Step 1: Direct lookup in CONCEPT table
        concept = lookup_concept(vocab_id, code)

        if concept and concept["standard_concept"] == "S":
            # Direct standard concept match
            if vocab_id in PRIORITY_VOCABS:
                return {
                    "concept_id": concept["concept_id"],
                    "domain_id": concept["domain_id"],
                    "source_value": f"{system}|{code}",
                    "source_concept_id": concept["concept_id"],
                    "mapping_type": "direct_standard"
                }
            elif best_match is None:
                best_match = concept

        elif concept:
            # Step 2: Follow "Maps to" relationship
            standard = follow_maps_to(concept["concept_id"])
            if standard:
                if best_match is None or vocab_id in PRIORITY_VOCABS:
                    best_match = {
                        **standard,
                        "source_concept_id": concept["concept_id"],
                        "mapping_type": "maps_to"
                    }

    if best_match:
        return {
            "concept_id": best_match["concept_id"],
            "domain_id": best_match["domain_id"],
            "source_value": f"{coding_list[0].get('system','')}|{coding_list[0].get('code','')}",
            "source_concept_id": best_match.get("source_concept_id", 0),
            "mapping_type": best_match.get("mapping_type", "direct_standard")
        }

    # Step 3: Check SOURCE_TO_CONCEPT_MAP for local codes
    for coding in coding_list:
        custom = lookup_source_to_concept(coding.get("system"), coding.get("code"))
        if custom:
            return custom

    # Step 4: Unmapped — preserve source value
    return {
        "concept_id": 0,
        "domain_id": "Unknown",
        "source_value": f"{coding_list[0].get('system','')}|{coding_list[0].get('code','')}",
        "source_concept_id": 0,
        "mapping_type": "unmapped"
    }
```

### 6.4 Handling Edge Cases

**One-to-many mappings:** A single FHIR resource may generate records in multiple OMOP tables. Example: A `DiagnosticReport` with a panel code generates one `measurement` row per component observation, plus a parent record.

**Many-to-one mappings:** Multiple FHIR resources may update a single OMOP record. Example: A `MedicationRequest` and subsequent `MedicationAdministration` for the same medication may merge into a single `drug_exposure` with refined dates.

**Local codes:** Use OHDSI Usagi to create mappings for site-specific codes. Store these in `SOURCE_TO_CONCEPT_MAP` and version them per site.

**Missing codes:** When a FHIR resource contains only `text` (no coded elements), set `concept_id = 0` and preserve the text in the `_source_value` field. Flag for manual review.

---

## 7. Phase 4 — OMOP CDM Loading & Multi-DB Support

### 7.1 Target Schema: OMOP CDM v5.4

The following core clinical data tables must be populated:

**Standardized Clinical Data:**
- `person` — Demographics
- `observation_period` — Continuous enrollment spans
- `visit_occurrence` — Encounters (inpatient, outpatient, ED, etc.)
- `visit_detail` — Granular visit components
- `condition_occurrence` — Diagnoses
- `drug_exposure` — Medications (prescribed, administered, reported)
- `procedure_occurrence` — Procedures
- `device_exposure` — Devices
- `measurement` — Lab results, vitals, other quantitative observations
- `observation` — Other clinical observations (allergies, social hx, etc.)
- `note` — Clinical notes (free text)
- `death` — Mortality data

**Standardized Health System:**
- `location` — Facility locations
- `care_site` — Clinical care sites
- `provider` — Clinicians

**Standardized Vocabularies:**
- Loaded from Athena download (20+ tables)

**Results Schema (generated by OHDSI tools):**
- Populated by ACHILLES and used by ATLAS

### 7.2 Multi-Database DDL Generation

```python
# Database-specific DDL adapters
DB_TYPE_MAP = {
    "postgresql": {
        "integer": "INTEGER",
        "bigint": "BIGINT",
        "varchar": "VARCHAR({length})",
        "date": "DATE",
        "datetime": "TIMESTAMP",
        "float": "NUMERIC",
        "text": "TEXT",
    },
    "bigquery": {
        "integer": "INT64",
        "bigint": "INT64",
        "varchar": "STRING",
        "date": "DATE",
        "datetime": "DATETIME",
        "float": "FLOAT64",
        "text": "STRING",
    },
    "snowflake": {
        "integer": "INTEGER",
        "bigint": "BIGINT",
        "varchar": "VARCHAR({length})",
        "date": "DATE",
        "datetime": "TIMESTAMP_NTZ",
        "float": "FLOAT",
        "text": "TEXT",
    },
    "redshift": {
        "integer": "INTEGER",
        "bigint": "BIGINT",
        "varchar": "VARCHAR({length})",
        "date": "DATE",
        "datetime": "TIMESTAMP",
        "float": "FLOAT8",
        "text": "VARCHAR(65535)",
    }
}
```

### 7.3 Loading Strategy

| Load Type | When | Strategy |
|---|---|---|
| **Initial load** | First deployment | Full export → bulk load (COPY/bq load/Snowpipe) |
| **Incremental** | Daily/weekly | `_since` parameter → merge/upsert |
| **Vocabulary refresh** | Quarterly | Full reload of Athena vocabulary tables |
| **Rebuild** | On demand | Truncate + full reload |

**Incremental load logic:**
- Use `_since` on Bulk Export to get only new/modified resources
- For each OMOP table, use a merge strategy:
  - Match on natural keys (e.g., `person_id` + `condition_start_date` + `condition_concept_id`)
  - Update if modified, insert if new
  - Never hard-delete; use `valid_end_date` patterns for retired records

### 7.4 Person ID Management

OMOP requires integer `person_id` values. FHIR uses string-based `Patient.id`. Strategy:

```sql
-- Maintain a crosswalk table
CREATE TABLE parthenon.patient_crosswalk (
    person_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id           VARCHAR(50) NOT NULL,
    fhir_patient_id   VARCHAR(200) NOT NULL,
    mrn_hash          VARCHAR(64),  -- SHA-256 of MRN for dedup
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (site_id, fhir_patient_id)
);
```

For multi-site deployments, include `site_id` to prevent ID collisions. Use deterministic hashing of MRN for cross-site patient matching where governance allows.

---

## 8. Phase 5 — Data Quality, Validation & OHDSI Tools

### 8.1 OHDSI Data Quality Dashboard (DQD)

The DQD runs ~4,000 individual data quality checks organized by the Kahn Framework:

| Category | Description | Example Checks |
|---|---|---|
| **Conformance** | Does data conform to CDM spec? | Required fields not null, valid concept IDs, correct data types |
| **Completeness** | Is expected data present? | % of persons with observation_period, % of visits with conditions |
| **Plausibility** | Are values clinically reasonable? | Birth dates in valid range, lab values within physiological bounds |

**Target:** ≥99% pass rate on DQD conformance checks (matching the German FHIR-to-OMOP benchmark).

### 8.2 ACHILLES Characterization

ACHILLES generates a comprehensive characterization of the CDM instance:
- Data density plots
- Concept frequency distributions
- Temporal trends
- Population demographics

Run ACHILLES after every major load to detect drift or data quality regressions.

### 8.3 Validation Pipeline

```
[1] Pre-load checks
    │   - Row counts per resource type vs. export metadata
    │   - Schema validation of transformed Parquet files
    │   - Null checks on required OMOP fields
    │
[2] Post-load checks
    │   - Referential integrity (every condition has a valid person_id)
    │   - Vocabulary coverage (% of records with concept_id ≠ 0)
    │   - DQD execution → JSON report
    │
[3] Longitudinal checks
    │   - ACHILLES delta between loads
    │   - Concept count stability (±5% threshold)
    │   - Patient count reconciliation vs. EHR census
    │
[4] Clinical validation
    │   - Known cohort reproduction (e.g., diabetes cohort via ATLAS)
    │   - Benchmark against published prevalence rates
    │   - Spot-check against chart review
```

### 8.4 ATLAS Integration

Once the CDM is populated and ACHILLES has run:
- Deploy OHDSI WebAPI pointing to the CDM schema
- Deploy ATLAS frontend for self-service cohort definition
- Enable Estimation and Prediction workspaces for network studies

---

## 9. Phase 6 — Operational Deployment & Monitoring

### 9.1 Orchestration (Apache Airflow)

```python
# Simplified Airflow DAG structure
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

default_args = {
    "owner": "parthenon",
    "retries": 3,
    "retry_delay": timedelta(minutes=15),
}

with DAG(
    "parthenon_ehr_to_omop",
    default_args=default_args,
    schedule_interval="0 2 * * *",  # Daily at 2 AM
    start_date=datetime(2026, 3, 1),
    catchup=False,
    tags=["parthenon", "omop", "fhir"],
) as dag:

    authenticate = PythonOperator(
        task_id="authenticate_fhir_backend",
        python_callable=get_backend_token,
        op_kwargs={"site_config": "{{ var.json.active_sites }}"},
    )

    export_bulk = PythonOperator(
        task_id="initiate_bulk_export",
        python_callable=start_bulk_export,
        op_kwargs={"since": "{{ prev_ds }}"},
    )

    poll_export = PythonOperator(
        task_id="poll_export_status",
        python_callable=poll_until_complete,
        op_kwargs={"timeout_minutes": 120},
    )

    download_ndjson = PythonOperator(
        task_id="download_ndjson_files",
        python_callable=download_and_stage,
    )

    transform = PythonOperator(
        task_id="fhir_to_omop_transform",
        python_callable=run_spark_transform,
    )

    load_omop = PythonOperator(
        task_id="load_omop_tables",
        python_callable=load_to_cdm,
    )

    run_dqd = PythonOperator(
        task_id="run_data_quality_dashboard",
        python_callable=execute_dqd,
    )

    run_achilles = PythonOperator(
        task_id="run_achilles",
        python_callable=execute_achilles,
    )

    notify = PythonOperator(
        task_id="send_completion_notification",
        python_callable=send_slack_notification,
    )

    (authenticate >> export_bulk >> poll_export >> download_ndjson
     >> transform >> load_omop >> [run_dqd, run_achilles] >> notify)
```

### 9.2 Monitoring & Alerting

| Metric | Threshold | Alert |
|---|---|---|
| Export duration | >4 hours | Warning |
| Transform errors | >0.1% of records | Critical |
| DQD conformance | <99% | Critical |
| Vocabulary coverage | <95% mapped | Warning |
| Patient count delta | >5% change day-over-day | Warning |
| Pipeline failure | Any task failure after retries | Critical |

### 9.3 Security & Compliance

- **HIPAA:** All data in transit encrypted (TLS 1.3). All data at rest encrypted (AES-256). PHI never written to logs.
- **Access control:** RBAC on OMOP tables. Researchers see de-identified views. ETL service accounts have write access only.
- **Audit trail:** Every export, transform, and load logged with timestamps, row counts, and checksums.
- **Data retention:** Raw NDJSON retained for 90 days for debugging. OMOP CDM is the system of record.

---

## 10. FHIR→OMOP Resource Mapping Reference

### 10.1 Patient → person

```
FHIR Patient                    OMOP person
──────────────────────────────  ──────────────────────────────
Patient.id                   →  (crosswalk) → person_id
Patient.gender               →  gender_concept_id
                                  male → 8507
                                  female → 8532
                                  other → 8521
                                  unknown → 8551
Patient.birthDate            →  year_of_birth, month_of_birth,
                                day_of_birth, birth_datetime
Patient.extension[race]      →  race_concept_id
                                  (US Core Race extension)
Patient.extension[ethnicity] →  ethnicity_concept_id
                                  (US Core Ethnicity extension)
Patient.address.postalCode   →  location_id (via location table)
```

### 10.2 Condition → condition_occurrence

```
FHIR Condition                  OMOP condition_occurrence
──────────────────────────────  ──────────────────────────────
(derived)                    →  condition_occurrence_id (auto)
(crosswalk Patient.id)       →  person_id
Condition.code               →  condition_concept_id
                                (SNOMED preferred; ICD-10 via Maps to)
Condition.code.text          →  condition_source_value
Condition.code               →  condition_source_concept_id
                                (the source code's concept_id)
Condition.onsetDateTime      →  condition_start_date/datetime
Condition.abatementDateTime  →  condition_end_date/datetime
Condition.clinicalStatus     →  condition_status_concept_id
                                  active → 4230359
                                  resolved → 4201906
32817 (EHR)                  →  condition_type_concept_id
(crosswalk Encounter.id)     →  visit_occurrence_id
(crosswalk Practitioner.id)  →  provider_id
```

### 10.3 MedicationRequest → drug_exposure

```
FHIR MedicationRequest          OMOP drug_exposure
──────────────────────────────  ──────────────────────────────
(derived)                    →  drug_exposure_id (auto)
(crosswalk Patient.id)       →  person_id
medicationCodeableConcept    →  drug_concept_id
                                (RxNorm preferred)
medicationCodeableConcept    →  drug_source_concept_id
medicationCodeableConcept
  .text                      →  drug_source_value
authoredOn                   →  drug_exposure_start_date
dispenseRequest
  .expectedSupplyDuration    →  (calculate) drug_exposure_end_date
38000177 (Rx written)        →  drug_type_concept_id
dosageInstruction[0]
  .doseAndRate.doseQuantity  →  quantity, dose_unit_source_value
dosageInstruction[0]
  .route                     →  route_concept_id
(crosswalk Encounter.id)     →  visit_occurrence_id
(crosswalk Practitioner.id)  →  provider_id
```

### 10.4 Observation (Lab) → measurement

```
FHIR Observation (lab)          OMOP measurement
──────────────────────────────  ──────────────────────────────
(derived)                    →  measurement_id (auto)
(crosswalk Patient.id)       →  person_id
Observation.code             →  measurement_concept_id
                                (LOINC preferred)
Observation.code             →  measurement_source_concept_id
Observation.code.text        →  measurement_source_value
Observation.effectiveDateTime→  measurement_date/datetime
44818702 (Lab result)        →  measurement_type_concept_id
Observation.valueQuantity
  .value                     →  value_as_number
Observation.valueCodeable
  Concept                    →  value_as_concept_id
Observation.valueQuantity
  .unit                      →  unit_source_value
Observation.valueQuantity
  .code (UCUM)               →  unit_concept_id
Observation.referenceRange
  .low.value                 →  range_low
Observation.referenceRange
  .high.value                →  range_high
(crosswalk Encounter.id)     →  visit_occurrence_id
(crosswalk Practitioner.id)  →  provider_id
```

### 10.5 Encounter → visit_occurrence

```
FHIR Encounter                  OMOP visit_occurrence
──────────────────────────────  ──────────────────────────────
(derived)                    →  visit_occurrence_id (auto)
(crosswalk Patient.id)       →  person_id
Encounter.class              →  visit_concept_id
                                  AMB → 9202 (Outpatient)
                                  IMP → 9201 (Inpatient)
                                  EMER → 9203 (Emergency)
                                  HH → 581476 (Home Health)
Encounter.period.start       →  visit_start_date/datetime
Encounter.period.end         →  visit_end_date/datetime
44818518 (Visit from EHR)    →  visit_type_concept_id
Encounter.class              →  visit_source_value
Encounter.hospitalization
  .admitSource               →  admitted_from_concept_id
Encounter.hospitalization
  .dischargeDisposition      →  discharged_to_concept_id
(crosswalk Location.id)      →  care_site_id
```

---

## 11. Code Examples

### 11.1 FHIR Bulk Export Client (Python)

```python
"""
parthenon/extraction/bulk_export.py
FHIR Bulk Data Export Client — SMART Backend Services
"""
import time
import json
import httpx
import jwt
from datetime import datetime, timedelta
from pathlib import Path
from cryptography.hazmat.primitives import serialization


class FHIRBulkExportClient:
    """Handles SMART Backend Services auth and Bulk Data Export operations."""

    def __init__(self, config: dict):
        """
        config = {
            "base_url": "https://fhir.hospital.org/api/FHIR/R4",
            "token_url": "https://fhir.hospital.org/oauth2/token",
            "client_id": "parthenon-app-id",
            "private_key_path": "/secrets/parthenon_private.pem",
            "group_id": "e1234567",  # Bulk export group
            "site_id": "hospital_a",
        }
        """
        self.config = config
        self.base_url = config["base_url"].rstrip("/")
        self.token_url = config["token_url"]
        self.client_id = config["client_id"]
        self.private_key = self._load_private_key(config["private_key_path"])
        self.access_token = None
        self.token_expires_at = datetime.min

    def _load_private_key(self, path: str) -> str:
        with open(path, "rb") as f:
            return f.read()

    def _get_client_assertion(self) -> str:
        """Create signed JWT for SMART Backend Services auth."""
        now = datetime.utcnow()
        payload = {
            "iss": self.client_id,
            "sub": self.client_id,
            "aud": self.token_url,
            "exp": now + timedelta(minutes=5),
            "iat": now,
            "jti": f"parthenon-{now.timestamp()}",
        }
        return jwt.encode(payload, self.private_key, algorithm="RS384")

    def authenticate(self):
        """Obtain access token via client_credentials + signed JWT."""
        if datetime.utcnow() < self.token_expires_at - timedelta(minutes=1):
            return  # Token still valid

        assertion = self._get_client_assertion()
        response = httpx.post(
            self.token_url,
            data={
                "grant_type": "client_credentials",
                "client_assertion_type":
                    "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                "client_assertion": assertion,
                "scope": "system/*.read",
            },
        )
        response.raise_for_status()
        token_data = response.json()
        self.access_token = token_data["access_token"]
        self.token_expires_at = (
            datetime.utcnow() + timedelta(seconds=token_data["expires_in"])
        )

    def start_export(
        self,
        since: str = None,
        resource_types: list[str] = None,
    ) -> str:
        """Kick off a Group-level Bulk Data Export. Returns polling URL."""
        self.authenticate()

        if resource_types is None:
            resource_types = [
                "Patient", "Condition", "Encounter",
                "MedicationRequest", "Observation",
                "Procedure", "Immunization",
                "AllergyIntolerance", "DiagnosticReport",
                "Device", "DocumentReference",
            ]

        params = {"_type": ",".join(resource_types)}
        if since:
            params["_since"] = since

        group_id = self.config["group_id"]
        response = httpx.get(
            f"{self.base_url}/Group/{group_id}/$export",
            params=params,
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "Accept": "application/fhir+json",
                "Prefer": "respond-async",
            },
        )

        if response.status_code == 202:
            return response.headers["Content-Location"]
        else:
            raise Exception(
                f"Export failed: {response.status_code} {response.text}"
            )

    def poll_export(
        self,
        polling_url: str,
        timeout_minutes: int = 120,
    ) -> dict:
        """Poll until export completes. Returns manifest with file URLs."""
        self.authenticate()
        deadline = datetime.utcnow() + timedelta(minutes=timeout_minutes)
        wait_seconds = 10

        while datetime.utcnow() < deadline:
            response = httpx.get(
                polling_url,
                headers={"Authorization": f"Bearer {self.access_token}"},
            )

            if response.status_code == 200:
                return response.json()  # Export complete
            elif response.status_code == 202:
                # Still processing — check Retry-After header
                retry_after = int(
                    response.headers.get("Retry-After", wait_seconds)
                )
                progress = response.headers.get("X-Progress", "unknown")
                print(f"  Export in progress: {progress}. "
                      f"Retrying in {retry_after}s...")
                time.sleep(retry_after)
                wait_seconds = min(wait_seconds * 1.5, 60)
            else:
                raise Exception(
                    f"Poll error: {response.status_code} {response.text}"
                )

        raise TimeoutError(
            f"Export did not complete within {timeout_minutes} minutes"
        )

    def download_files(
        self,
        manifest: dict,
        output_dir: Path,
    ) -> list[Path]:
        """Download NDJSON files from export manifest."""
        self.authenticate()
        output_dir.mkdir(parents=True, exist_ok=True)
        downloaded = []

        for entry in manifest.get("output", []):
            resource_type = entry["type"]
            url = entry["url"]

            # Derive filename
            idx = len([
                f for f in downloaded
                if f.name.startswith(resource_type)
            ]) + 1
            filename = f"{resource_type}-{idx}.ndjson"
            filepath = output_dir / filename

            print(f"  Downloading {filename}...")
            with httpx.stream(
                "GET", url,
                headers={"Authorization": f"Bearer {self.access_token}"},
            ) as stream:
                stream.raise_for_status()
                with open(filepath, "wb") as f:
                    for chunk in stream.iter_bytes():
                        f.write(chunk)

            downloaded.append(filepath)

        return downloaded
```

### 11.2 Spark Transformation Core (PySpark)

```python
"""
parthenon/transform/spark_transform.py
Core FHIR-to-OMOP transformation using PySpark
"""
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql import functions as F
from pyspark.sql.types import *


def create_spark_session() -> SparkSession:
    return (
        SparkSession.builder
        .appName("Parthenon-FHIR-to-OMOP")
        .config("spark.sql.adaptive.enabled", "true")
        .config("spark.sql.sources.partitionOverwriteMode", "dynamic")
        .getOrCreate()
    )


def read_ndjson(spark: SparkSession, path: str, resource_type: str) -> DataFrame:
    """Read NDJSON files for a specific resource type."""
    return (
        spark.read
        .option("multiLine", False)
        .json(f"{path}/{resource_type}-*.ndjson")
    )


def transform_patient_to_person(
    patients_df: DataFrame,
    vocab_df: DataFrame,
    crosswalk_df: DataFrame,
) -> DataFrame:
    """Transform FHIR Patient resources into OMOP person table."""

    # Gender mapping
    gender_map = {
        "male": 8507,
        "female": 8532,
        "other": 8521,
        "unknown": 8551,
    }
    gender_expr = F.create_map(
        [F.lit(x) for pair in gender_map.items() for x in pair]
    )

    return (
        patients_df
        # Join to crosswalk for person_id
        .join(crosswalk_df,
              patients_df["id"] == crosswalk_df["fhir_patient_id"],
              "inner")
        .select(
            F.col("person_id"),
            gender_expr[F.col("gender")].alias("gender_concept_id"),
            F.year(F.col("birthDate")).alias("year_of_birth"),
            F.month(F.col("birthDate")).alias("month_of_birth"),
            F.dayofmonth(F.col("birthDate")).alias("day_of_birth"),
            F.col("birthDate").cast("timestamp").alias("birth_datetime"),
            # Race — extract from US Core extension
            extract_race_concept(F.col("extension")).alias("race_concept_id"),
            extract_race_source(F.col("extension")).alias("race_source_value"),
            # Ethnicity — extract from US Core extension
            extract_ethnicity_concept(F.col("extension"))
                .alias("ethnicity_concept_id"),
            extract_ethnicity_source(F.col("extension"))
                .alias("ethnicity_source_value"),
            # Location
            F.col("address").getItem(0).getField("postalCode")
                .alias("location_source_value"),
            # Source
            F.col("id").alias("person_source_value"),
            F.col("gender").alias("gender_source_value"),
        )
    )


def transform_condition_to_condition_occurrence(
    conditions_df: DataFrame,
    concept_lookup: DataFrame,
    crosswalk_df: DataFrame,
    encounter_crosswalk: DataFrame,
) -> DataFrame:
    """Transform FHIR Condition → OMOP condition_occurrence."""

    # Explode coding array to find best code
    coded = (
        conditions_df
        .withColumn("coding", F.explode(F.col("code.coding")))
        .withColumn("code_system", F.col("coding.system"))
        .withColumn("code_value", F.col("coding.code"))
    )

    # Map FHIR system URIs to OMOP vocabulary IDs
    system_vocab_map = F.create_map(
        F.lit("http://snomed.info/sct"), F.lit("SNOMED"),
        F.lit("http://hl7.org/fhir/sid/icd-10-cm"), F.lit("ICD10CM"),
        F.lit("http://hl7.org/fhir/sid/icd-10"), F.lit("ICD10"),
    )

    coded = coded.withColumn(
        "vocabulary_id",
        system_vocab_map[F.col("code_system")]
    )

    # Join to OMOP CONCEPT table for concept_id + domain routing
    mapped = (
        coded
        .join(
            concept_lookup,
            (coded["vocabulary_id"] == concept_lookup["vocabulary_id"]) &
            (coded["code_value"] == concept_lookup["concept_code"]),
            "left"
        )
        # Prioritize SNOMED standard concepts
        .withColumn("priority", F.when(
            (F.col("vocabulary_id") == "SNOMED") &
            (F.col("standard_concept") == "S"), 1
        ).when(
            F.col("standard_concept") == "S", 2
        ).otherwise(3))
    )

    # Take best mapping per condition resource
    from pyspark.sql.window import Window
    w = Window.partitionBy("id").orderBy("priority")
    best_mapped = (
        mapped
        .withColumn("rn", F.row_number().over(w))
        .filter(F.col("rn") == 1)
    )

    # Build condition_occurrence
    return (
        best_mapped
        .join(crosswalk_df,
              F.col("subject.reference").contains(
                  crosswalk_df["fhir_patient_id"]),
              "inner")
        .join(encounter_crosswalk,
              F.col("encounter.reference").contains(
                  encounter_crosswalk["fhir_encounter_id"]),
              "left")
        .select(
            F.monotonically_increasing_id()
                .alias("condition_occurrence_id"),
            F.col("person_id"),
            F.coalesce(F.col("concept_id"), F.lit(0))
                .alias("condition_concept_id"),
            F.to_date(F.col("onsetDateTime"))
                .alias("condition_start_date"),
            F.col("onsetDateTime").cast("timestamp")
                .alias("condition_start_datetime"),
            F.to_date(F.col("abatementDateTime"))
                .alias("condition_end_date"),
            F.lit(32817).alias("condition_type_concept_id"),  # EHR
            F.col("code.text").alias("condition_source_value"),
            F.coalesce(
                F.col("concept_id"), F.lit(0)
            ).alias("condition_source_concept_id"),
            F.col("visit_occurrence_id"),
        )
    )
```

### 11.3 Vocabulary Lookup Service (Python)

```python
"""
parthenon/vocabulary/lookup.py
OMOP Vocabulary Lookup with caching for high-throughput ETL
"""
import sqlite3
from functools import lru_cache
from pathlib import Path
from typing import Optional


class VocabularyService:
    """
    Fast vocabulary lookup backed by a local SQLite copy
    of the OMOP CONCEPT and CONCEPT_RELATIONSHIP tables.

    For Spark-based transforms, broadcast this as a DataFrame.
    For Python-based transforms, use this service directly.
    """

    # FHIR system URI → OMOP vocabulary_id
    SYSTEM_TO_VOCAB = {
        "http://snomed.info/sct": "SNOMED",
        "http://loinc.org": "LOINC",
        "http://www.nlm.nih.gov/research/umls/rxnorm": "RxNorm",
        "http://hl7.org/fhir/sid/icd-10-cm": "ICD10CM",
        "http://hl7.org/fhir/sid/icd-10": "ICD10",
        "http://www.ama-assn.org/go/cpt": "CPT4",
        "http://hl7.org/fhir/sid/ndc": "NDC",
        "http://hl7.org/fhir/sid/cvx": "CVX",
        "urn:oid:2.16.840.1.113883.6.238": "Race",
        "urn:oid:2.16.840.1.113883.6.238": "Ethnicity",
    }

    # Priority order for vocabulary selection
    VOCAB_PRIORITY = {
        "SNOMED": 1, "LOINC": 2, "RxNorm": 3,
        "CPT4": 4, "ICD10CM": 5, "ICD10": 6,
        "NDC": 7, "CVX": 8,
    }

    def __init__(self, vocab_db_path: str):
        self.db = sqlite3.connect(vocab_db_path)
        self.db.row_factory = sqlite3.Row

    @lru_cache(maxsize=500_000)
    def lookup_concept(
        self, vocabulary_id: str, concept_code: str
    ) -> Optional[dict]:
        """Direct lookup in CONCEPT table."""
        row = self.db.execute(
            """
            SELECT concept_id, concept_name, domain_id,
                   vocabulary_id, standard_concept
            FROM concept
            WHERE vocabulary_id = ? AND concept_code = ?
            """,
            (vocabulary_id, concept_code),
        ).fetchone()
        return dict(row) if row else None

    @lru_cache(maxsize=500_000)
    def follow_maps_to(self, source_concept_id: int) -> Optional[dict]:
        """Follow 'Maps to' relationship to standard concept."""
        row = self.db.execute(
            """
            SELECT c.concept_id, c.concept_name, c.domain_id,
                   c.vocabulary_id, c.standard_concept
            FROM concept_relationship cr
            JOIN concept c ON cr.concept_id_2 = c.concept_id
            WHERE cr.concept_id_1 = ?
              AND cr.relationship_id = 'Maps to'
              AND c.standard_concept = 'S'
              AND cr.invalid_reason IS NULL
            """,
            (source_concept_id,),
        ).fetchone()
        return dict(row) if row else None

    def resolve_fhir_codings(
        self, codings: list[dict]
    ) -> dict:
        """
        Given a list of FHIR Coding objects, resolve the best
        OMOP concept_id with domain routing.

        Returns: {
            "concept_id": int,
            "source_concept_id": int,
            "domain_id": str,
            "source_value": str,
            "mapping_quality": "standard" | "mapped" | "unmapped"
        }
        """
        candidates = []

        for coding in codings:
            system = coding.get("system", "")
            code = coding.get("code", "")
            vocab_id = self.SYSTEM_TO_VOCAB.get(system)

            if not vocab_id:
                continue

            concept = self.lookup_concept(vocab_id, code)
            if not concept:
                continue

            priority = self.VOCAB_PRIORITY.get(vocab_id, 99)

            if concept["standard_concept"] == "S":
                candidates.append({
                    "concept_id": concept["concept_id"],
                    "source_concept_id": concept["concept_id"],
                    "domain_id": concept["domain_id"],
                    "source_value": f"{system}|{code}",
                    "mapping_quality": "standard",
                    "priority": priority,
                })
            else:
                # Try Maps to
                standard = self.follow_maps_to(concept["concept_id"])
                if standard:
                    candidates.append({
                        "concept_id": standard["concept_id"],
                        "source_concept_id": concept["concept_id"],
                        "domain_id": standard["domain_id"],
                        "source_value": f"{system}|{code}",
                        "mapping_quality": "mapped",
                        "priority": priority,
                    })

        if candidates:
            # Sort: standard > mapped, then by vocabulary priority
            candidates.sort(
                key=lambda c: (
                    0 if c["mapping_quality"] == "standard" else 1,
                    c["priority"],
                )
            )
            return candidates[0]

        # Unmapped
        source_val = ""
        if codings:
            source_val = (
                f"{codings[0].get('system','')}|{codings[0].get('code','')}"
            )

        return {
            "concept_id": 0,
            "source_concept_id": 0,
            "domain_id": "Unknown",
            "source_value": source_val,
            "mapping_quality": "unmapped",
        }
```

---

## 12. Risk Register & Mitigations

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| 1 | **FHIR API rate limiting** causes export timeouts | High | High | Implement backoff; coordinate with EHR IT for dedicated slots; cache intermediate results |
| 2 | **Vocabulary gaps** — local codes not in OHDSI vocabularies | Medium | High | Usagi mapping sprints per site; SOURCE_TO_CONCEPT_MAP versioning; track unmapped % |
| 3 | **Epic/Cerner structural differences** break shared transforms | Medium | Medium | Vendor-specific normalization layer; extensive integration testing per vendor |
| 4 | **FHIR data completeness** insufficient for research use cases | High | Medium | Identify gaps early via DQD; build supplementary Clarity/Millennium connectors for critical missing data |
| 5 | **Bulk export performance** at institutional scale (>1M patients) | Medium | Medium | Off-peak scheduling; incremental exports via `_since`; parallelize download |
| 6 | **Person identity resolution** across sites | High | Low | Deterministic MRN hashing; partner with institution's MPI; never merge without governance approval |
| 7 | **Schema drift** when EHR vendors update FHIR implementations | Medium | Low | Pin to FHIR R4 version; monitor vendor release notes; integration test suite per vendor |
| 8 | **HIPAA compliance** gaps in pipeline | Critical | Low | Encryption at rest/in-transit; no PHI in logs; RBAC; regular security audits |

---

## 13. Timeline & Milestones

| Phase | Duration | Milestone | Dependencies |
|---|---|---|---|
| **Phase 0: Setup** | Weeks 1-2 | Dev environment, credentials, Athena vocabulary loaded | EHR IT partnership |
| **Phase 1: Extraction** | Weeks 3-6 | Bulk export working for both Epic + Cerner sandbox | App registration approval |
| **Phase 2: Transform** | Weeks 5-10 | Core 6 resource types transforming to OMOP | Vocabulary DB ready |
| **Phase 3: Vocabulary** | Weeks 4-8 | ≥95% concept mapping rate | Usagi mapping sessions |
| **Phase 4: Loading** | Weeks 9-12 | PostgreSQL + one cloud DW loaded and validated | Transform outputs stable |
| **Phase 5: Validation** | Weeks 11-14 | DQD ≥99% conformance; ACHILLES running; ATLAS deployed | CDM populated |
| **Phase 6: Operations** | Weeks 13-16 | Airflow DAGs in production; daily incremental loads | All prior phases |
| **Phase 7: Multi-site** | Weeks 15-20 | Second institution onboarded in <200 person-hours | Playbook written |

**Total estimated timeline: 20 weeks (5 months) to multi-site production.**

---

## 14. References & Sources

### Standards & Specifications

- [OMOP CDM v5.4 Documentation](https://ohdsi.github.io/CommonDataModel/cdm54.html)
- [HL7 FHIR Bulk Data Access Specification](https://hl7.org/fhir/uv/bulkdata/export/index.html)
- [HL7 Vulcan FHIR-to-OMOP IG](https://build.fhir.org/ig/HL7/fhir-omop-ig/)
- [FHIR-to-OMOP IG GitHub Repository](https://github.com/HL7/fhir-omop-ig)
- [HL7 Vulcan FHIR to OMOP Project](https://hl7vulcan.org/projects/fhir-to-omop/)
- [Coded Field Mapping Principles (Vulcan IG)](https://build.fhir.org/ig/HL7/fhir-omop-ig/codemappings.html)

### EHR FHIR APIs

- [Epic on FHIR Documentation](https://fhir.epic.com/Documentation)
- [Epic FHIR API Specifications](https://fhir.epic.com/Specifications)
- [Epic Endpoints Directory](https://open.epic.com/MyApps/Endpoints)
- [Oracle Health Millennium Platform FHIR R4 Bulk Data](https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfbda/bulk_data_access.html)
- [Cerner FHIR R4 Bulk Data](https://fhir.cerner.com/soarian/r4/bulk-data/)

### OHDSI Tools & Data Quality

- [OHDSI Data Quality Dashboard (DQD)](https://ohdsi.github.io/DataQualityDashboard/)
- [DQD GitHub Repository](https://github.com/OHDSI/DataQualityDashboard)
- [The Book of OHDSI — Chapter 6: ETL](https://ohdsi.github.io/TheBookOfOhdsi/ExtractTransformLoad.html)
- [The Book of OHDSI — Chapter 15: Data Quality](https://ohdsi.github.io/TheBookOfOhdsi/DataQuality.html)
- [OHDSI Software Tools](https://www.ohdsi.org/software-tools/)

### Research & Implementations

- [OMOP-on-FHIR: Integrating Clinical Data via FHIR Bundle to OMOP (PubMed, 2025)](https://pubmed.ncbi.nlm.nih.gov/40380541/)
- [MENDS-on-FHIR: OMOP CDM and FHIR for Chronic Disease Surveillance (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11137321/)
- [German FHIR-Core ETL (SpringBatch, 10 university hospitals)](https://github.com/OHDSI/ETL-German-FHIR-Core)
- [ETL Process Design for FHIR/OMOP Harmonization (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S1386505622002398)
- [Mt. Sinai OMOP/OHDSI ATLAS Research Roadmap](https://researchroadmap.mssm.edu/reference/systems/omop/)
- [Mt. Sinai Data Warehouse OMOP CDM](https://labs.icahn.mssm.edu/msdw/data-dictionary/)
- [Johns Hopkins PCORnet-to-OMOP ETL](https://pure.johnshopkins.edu/en/publications/developing-an-etl-tool-for-converting-the-pcornet-cdm-into-the-om/)
- [OHDSI ETL Tutorial Materials](https://github.com/OHDSI/Tutorial-ETL)

### Commercial Solutions

- [InterSystems OMOP](https://www.intersystems.com/resources/intersystems-omop/)
- [Microsoft Azure OMOP Transformations](https://learn.microsoft.com/en-us/industry/healthcare/healthcare-data-solutions/omop-transformations)

### Scalable Data Processing

- [High Performance Computing on Flat FHIR Files (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7153160/)
- [FHIR NDJSON to Parquet Conversion](https://linuxforhealth.github.io/FHIR/blog/parquet/)

---

*Document generated for the Parthenon Project. This implementation plan is designed to be executed by Claude Code as a series of phased development tasks, with each phase producing testable, deployable artifacts.*
