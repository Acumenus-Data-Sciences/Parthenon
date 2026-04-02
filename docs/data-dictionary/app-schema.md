# Parthenon `app` Schema — Data Dictionary

**Last Updated:** 2026-04-02
**Schema:** `app`
**Platform:** Parthenon — Unified OHDSI Outcomes Research Platform on OMOP CDM v5.4

---

## Overview

The `app` schema contains all application-level tables for Parthenon. It does **not** contain clinical data — patient records, observations, drug exposures, and other OMOP CDM clinical tables live in per-source schemas (`omop`, `synpuf`, `irsf`, `pancreas`, `inpatient`, `eunomia`). The `vocab` schema holds shared OMOP vocabulary.

This dictionary catalogs every table and column in `app`, grouped by functional domain. It is intended for data stewards, researchers, developers, and infrastructure engineers.

**Conventions used in this document:**
- `bigint` — 64-bit integer (auto-increment primary keys use PostgreSQL sequences)
- `character varying` — variable-length string (`varchar`)
- `jsonb` / `json` — JSON documents; `jsonb` is binary-indexed, `json` is plain text
- `text` — unlimited-length string
- `timestamp without time zone` — UTC assumed throughout the application
- `FK to X.Y` — foreign key relationship to table X, column Y (not always enforced at DB level)
- Nullable = YES means the column accepts NULL values

---

## Table of Contents

1. [Users & Authentication](#1-users--authentication)
2. [Data Sources](#2-data-sources)
3. [Abby AI Assistant](#3-abby-ai-assistant)
4. [Cohort Definitions](#4-cohort-definitions)
5. [Concept Mapping & Vocabulary](#5-concept-mapping--vocabulary)
6. [Data Ingestion & ETL](#6-data-ingestion--etl)
7. [Achilles & Data Characterization](#7-achilles--data-characterization)
8. [Data Quality](#8-data-quality)
9. [Population-Level Analyses](#9-population-level-analyses)
10. [Risk Scores](#10-risk-scores)
11. [Care Gaps & Quality Measures](#11-care-gaps--quality-measures)
12. [Studies](#12-studies)
13. [Investigations & Evidence](#13-investigations--evidence)
14. [PROs & Surveys](#14-pros--surveys)
15. [Commons Workspace](#15-commons-workspace)
16. [FHIR Integration](#16-fhir-integration)
17. [Medical Imaging](#17-medical-imaging)
18. [Genomics](#18-genomics)
19. [GIS & Geospatial](#19-gis--geospatial)
20. [HEOR](#20-heor)
21. [Feasibility](#21-feasibility)
22. [Atlas Migration](#22-atlas-migration)
23. [Configuration & System](#23-configuration--system)
24. [Analytics & Orchestration](#24-analytics--orchestration)
25. [Audit & Logging](#25-audit--logging)
26. [Laravel Framework](#26-laravel-framework)

---

## 1. Users & Authentication

Application user accounts, Spatie RBAC roles and permissions, Sanctum API tokens, and session management. New users receive the `viewer` role only; promotion requires admin action per HIGHSEC policy.

### users

Core user account table. Manages authentication identity, profile metadata, and onboarding state. Integrates with Sanctum (API tokens) and Spatie RBAC (roles/permissions).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Full display name of the user |
| email | character varying | NO | | Unique email address used for login and notifications |
| email_verified_at | timestamp | YES | | Timestamp when email was verified; NULL means unverified |
| password | character varying | NO | | Bcrypt-hashed password (12 rounds) |
| avatar | character varying | YES | | URL or path to user avatar image |
| provider | character varying | YES | | OAuth provider name (e.g., `google`, `github`); NULL for local auth |
| provider_id | character varying | YES | | External OAuth provider user ID |
| last_login_at | timestamp | YES | | Timestamp of most recent successful login |
| remember_token | character varying | YES | | Laravel remember-me token for persistent sessions |
| created_at | timestamp | YES | | Account creation timestamp |
| updated_at | timestamp | YES | | Last profile update timestamp |
| notification_email | boolean | NO | true | Whether the user receives email notifications |
| notification_sms | boolean | NO | false | Whether the user receives SMS notifications |
| phone_number | character varying | YES | | Optional phone number for SMS notifications |
| notification_preferences | json | YES | | Granular per-event notification preferences as JSON object |
| must_change_password | boolean | NO | true | When true, forces ChangePasswordModal on next login (set false after first change) |
| onboarding_completed | boolean | NO | false | Whether the user has completed the initial onboarding wizard |
| job_title | character varying | YES | | User's professional job title |
| department | character varying | YES | | Organizational department |
| organization | character varying | YES | | Institution or organization name |
| bio | text | YES | | Free-text professional biography |
| workbench_mode | character varying | NO | `guided` | UI mode preference; `guided` or `advanced` |
| default_source_id | bigint | YES | | FK to sources.id — preferred default data source for analyses |

---

### roles

Spatie Permission roles available in the system. Predefined roles: `super-admin`, `admin`, `researcher`, `data-steward`, `mapping-reviewer`, `viewer`.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Role name (e.g., `researcher`, `viewer`) |
| guard_name | character varying | NO | | Laravel guard this role applies to (typically `sanctum`) |
| created_at | timestamp | YES | | Role creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### permissions

Spatie Permission individual permission nodes, each namespaced as `domain.action` (e.g., `cohorts.create`, `analyses.run`).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Permission name in `domain.action` format |
| guard_name | character varying | NO | | Laravel guard this permission applies to |
| created_at | timestamp | YES | | Permission creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### model_has_roles

Spatie pivot table assigning roles to models (typically `App\Models\User`).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| role_id | bigint | NO | | FK to roles.id |
| model_type | character varying | NO | | Fully-qualified model class (e.g., `App\Models\User`) |
| model_id | bigint | NO | | PK of the model instance receiving the role |

---

### model_has_permissions

Spatie pivot table for direct permission assignments to models (bypassing role).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| permission_id | bigint | NO | | FK to permissions.id |
| model_type | character varying | NO | | Fully-qualified model class |
| model_id | bigint | NO | | PK of the model instance receiving the permission |

---

### role_has_permissions

Spatie pivot table assigning permissions to roles.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| permission_id | bigint | NO | | FK to permissions.id |
| role_id | bigint | NO | | FK to roles.id |

---

### personal_access_tokens

Laravel Sanctum API tokens for SPA and API authentication. Tokens expire after 480 minutes (HIGHSEC policy).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| tokenable_type | character varying | NO | | Polymorphic model type (e.g., `App\Models\User`) |
| tokenable_id | bigint | NO | | PK of the owning model |
| name | text | NO | | Human-readable token name (e.g., `web`, `api`) |
| token | character varying | NO | | SHA-256 hash of the actual token value |
| abilities | text | YES | | JSON array of abilities granted to this token |
| last_used_at | timestamp | YES | | Timestamp of most recent API request using this token |
| expires_at | timestamp | YES | | Token expiration timestamp (480 minutes from creation per policy) |
| created_at | timestamp | YES | | Token creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### password_reset_tokens

Temporary password reset tokens generated by `forgotPassword` flow, stored by email.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| email | character varying | NO | | Email address of the account requesting reset |
| token | character varying | NO | | Hashed reset token |
| created_at | timestamp | YES | | Token generation timestamp |

---

### sessions

Laravel database session store for web-based sessions (non-API access).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | | Session identifier (random string) |
| user_id | bigint | YES | | FK to users.id — NULL for unauthenticated sessions |
| ip_address | character varying | YES | | Client IP address at session creation |
| user_agent | text | YES | | HTTP User-Agent string of the client |
| payload | text | NO | | Base64-encoded serialized session data |
| last_activity | integer | NO | | Unix timestamp of last session activity |

---

### user_audit_logs

Structured audit trail of significant user actions within the application for compliance and security review.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| user_id | bigint | YES | | FK to users.id — NULL if action occurred outside authenticated context |
| action | character varying | NO | | Action performed (e.g., `login`, `export`, `delete_cohort`) |
| feature | character varying | YES | | Feature area where the action occurred (e.g., `cohorts`, `analyses`) |
| ip_address | character varying | YES | | Client IP address |
| user_agent | text | YES | | HTTP User-Agent string |
| metadata | jsonb | YES | | Additional structured context for the action |
| occurred_at | timestamp | NO | now() | Timestamp when the action occurred |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 2. Data Sources

CDM data source registrations and their OHDSI daimon configurations. A source maps to a CDM schema (e.g., `omop`, `synpuf`) and defines where clinical, vocabulary, results, and temp data live.

### sources

Registered OMOP CDM data sources. Each source corresponds to a database schema containing clinical data. The `source_key` is used in API paths and SQL template substitution.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_name | character varying | NO | | Human-readable name (e.g., "Acumenus CDM") |
| source_key | character varying | NO | | Unique short identifier used in URLs and daimon lookups (e.g., `ACUMENUS`) |
| source_dialect | character varying | NO | `postgresql` | SQL dialect; always `postgresql` in current deployments |
| source_connection | text | YES | | Encrypted JDBC-style connection string (legacy; prefer db_host/db_port fields) |
| username | character varying | YES | | Database username for this source connection |
| password | text | YES | | Encrypted database password |
| is_cache_enabled | boolean | NO | false | Whether query results should be cached for this source |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp; non-NULL means source is deactivated |
| restricted_to_roles | jsonb | YES | | JSON array of role names that can access this source; NULL means all roles |
| imported_from_webapi | character varying | YES | | URL of OHDSI WebAPI this source was migrated from |
| db_host | character varying | YES | | Database host (used when source_connection is not set) |
| db_port | smallint | YES | | Database port |
| db_database | character varying | YES | | Database name |
| db_options | text | YES | | Additional connection options (e.g., search_path override) |
| is_default | boolean | NO | false | Whether this is the default source for new analyses |
| release_mode | character varying | NO | `auto` | How releases are tracked; `auto` or `manual` |
| source_type | character varying | YES | | Source classification (e.g., `cdm`, `claims`, `ehr`) |

---

### source_daimons

OHDSI daimon definitions for each source. A daimon maps a logical role (CDM, Vocabulary, Results, Temp) to a schema name. Each source should have at minimum a CDM daimon and a Vocabulary daimon pointing to the shared `vocab` schema.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| daimon_type | character varying | NO | | Daimon role: `CDM`, `Vocabulary`, `Results`, or `Temp` |
| table_qualifier | character varying | NO | | PostgreSQL schema name this daimon maps to (e.g., `omop`, `vocab`, `results`) |
| priority | integer | NO | 0 | Resolution priority when multiple daimons of same type exist |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### source_releases

Versioned data releases for a source, enabling delta tracking for DQD and Achilles results across releases.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| release_key | character varying | NO | | Short release identifier (e.g., `2025-Q1`, `v2.3`) |
| release_name | character varying | NO | | Human-readable release label |
| release_type | character varying | NO | | Release category (e.g., `quarterly`, `major`, `patch`) |
| cdm_version | character varying | YES | | OMOP CDM version of the release (e.g., `5.4`) |
| vocabulary_version | character varying | YES | | OMOP Vocabulary release version |
| etl_version | character varying | YES | | ETL pipeline version that produced this release |
| person_count | bigint | NO | 0 | Total person count at time of release |
| record_count | bigint | NO | 0 | Total clinical record count at time of release |
| notes | text | YES | | Free-text release notes |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| etl_metadata | json | YES | | Structured ETL provenance metadata |

---

## 3. Abby AI Assistant

Abby is Parthenon's clinical AI assistant. These tables record her actions, token usage, conversation history, user corrections, data findings, and personalized user profiles.

### abby_action_log

Audit trail of every tool call Abby executes (queries, analyses, exports). Supports rollback tracking for reversible actions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| user_id | bigint | YES | | FK to users.id — user who initiated the Abby session |
| action_type | character varying | NO | | High-level action category (e.g., `query`, `generate_cohort`, `export`) |
| tool_name | character varying | NO | | Specific tool Abby invoked |
| risk_level | character varying | NO | | Risk classification: `low`, `medium`, `high` |
| plan | jsonb | YES | | Abby's pre-execution reasoning plan |
| parameters | jsonb | YES | | Parameters passed to the tool |
| result | jsonb | YES | | Tool execution result |
| checkpoint_data | jsonb | YES | | Snapshot of state before action for rollback purposes |
| rolled_back | boolean | YES | false | Whether this action was subsequently rolled back |
| created_at | timestamp | YES | now() | Action timestamp |

---

### abby_cloud_usage

Tracks LLM API token consumption and cost for cloud model routing. Supports departmental cost allocation and budget monitoring.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| user_id | bigint | YES | | FK to users.id |
| department | character varying | YES | | User's department for cost allocation |
| tokens_in | integer | NO | | Input (prompt) token count |
| tokens_out | integer | NO | | Output (completion) token count |
| cost_usd | numeric | NO | | Estimated cost in USD for this request |
| model | character varying | NO | | Model identifier used (e.g., `claude-sonnet-4-6`, `medgemma`) |
| request_hash | character varying | YES | | SHA-256 hash of the prompt for deduplication |
| sanitizer_redaction_count | integer | YES | 0 | Number of PHI/PII redactions made by the sanitizer before sending to cloud |
| route_reason | character varying | YES | | Reason the request was routed to cloud vs. local model |
| created_at | timestamp | YES | now() | Request timestamp |

---

### abby_conversations

Conversation threads between users and Abby, grouped by page context.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| user_id | bigint | NO | | FK to users.id — conversation owner |
| title | character varying | YES | | Auto-generated or user-edited conversation title |
| page_context | character varying | NO | `general` | Parthenon page/module where conversation originated (e.g., `cohort_builder`, `results_explorer`) |
| created_at | timestamp | YES | | Conversation creation timestamp |
| updated_at | timestamp | YES | | Last message timestamp |

---

### abby_corrections

User-submitted corrections to Abby's responses, used for feedback learning and response improvement.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| user_id | bigint | YES | | FK to users.id |
| original_response | text | NO | | The response Abby originally gave |
| correction | text | NO | | The user's corrected version |
| context | jsonb | YES | | Conversation context when the correction was submitted |
| applied_globally | boolean | YES | false | Whether this correction has been incorporated into global behavior |
| created_at | timestamp | YES | now() | Correction submission timestamp |

---

### abby_data_findings

Structured anomalies and data quality issues discovered by Abby during analysis.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| discovered_by | bigint | YES | | FK to users.id — user session in which finding was discovered |
| affected_domain | character varying | YES | | OMOP CDM domain affected (e.g., `Drug`, `Condition`, `Measurement`) |
| affected_tables | ARRAY | YES | | PostgreSQL array of CDM table names involved |
| finding_summary | text | NO | | Plain-language description of the finding |
| severity | character varying | YES | `info` | Severity level: `info`, `warning`, `critical` |
| workaround | text | YES | | Suggested workaround or remediation |
| verified | boolean | YES | false | Whether a data steward has verified this finding |
| created_at | timestamp | YES | now() | Finding discovery timestamp |

---

### abby_user_profiles

Personalized Abby profiles learned from each user's interaction patterns, research interests, and preferences.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| user_id | bigint | NO | | FK to users.id — one profile per user |
| research_interests | ARRAY | YES | `{}` | Text array of research domains the user works in |
| expertise_domains | jsonb | YES | `{}` | JSON map of domain → proficiency level |
| interaction_preferences | jsonb | YES | `{}` | Preferences for response verbosity, format, etc. |
| frequently_used | jsonb | YES | `{}` | JSON map of tools/features ranked by usage frequency |
| learned_at | timestamp | YES | now() | Timestamp of last profile update from interaction |
| created_at | timestamp | YES | now() | Profile creation timestamp |
| updated_at | timestamp | YES | now() | Last update timestamp |

---

## 4. Cohort Definitions

OHDSI-compatible cohort definitions and their generated results. Cohort definitions use Circe JSON expressions equivalent to Atlas cohort definitions.

### cohort_definitions

Cohort definitions authored using the Parthenon cohort builder. The `expression_json` follows the OHDSI Circe cohort definition format.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Human-readable cohort name |
| description | text | YES | | Cohort purpose and inclusion/exclusion criteria narrative |
| expression_json | jsonb | YES | | Circe cohort definition JSON (OHDSI-compatible format) |
| author_id | bigint | NO | | FK to users.id — cohort author |
| is_public | boolean | NO | false | Whether cohort is visible to all users |
| version | integer | NO | 1 | Version counter incremented on each saved change |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |
| tags | jsonb | YES | | JSON array of tag strings for search/filtering |
| share_token | character varying | YES | | Cryptographically random token enabling anonymous read-only access |
| share_expires_at | timestamp | YES | | Expiration time for the share_token link |

---

### cohort_generations

Records each execution of a cohort definition against a data source, tracking patient counts and status.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| cohort_definition_id | bigint | NO | | FK to cohort_definitions.id |
| source_id | bigint | NO | | FK to sources.id — CDM source queried |
| status | character varying | NO | `pending` | Execution status: `pending`, `running`, `completed`, `failed` |
| started_at | timestamp | YES | | Generation start timestamp |
| completed_at | timestamp | YES | | Generation completion timestamp |
| person_count | bigint | YES | | Number of persons meeting cohort criteria |
| fail_message | text | YES | | Error message if status is `failed` |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### concept_sets

Named concept sets used as building blocks in cohort definitions. Analogous to Atlas Concept Sets.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Concept set name |
| description | text | YES | | Purpose and clinical scope of the concept set |
| expression_json | jsonb | YES | | Full concept set expression with inclusion/exclusion logic |
| author_id | bigint | NO | | FK to users.id |
| is_public | boolean | NO | false | Whether visible to all users |
| tags | jsonb | YES | | JSON array of tag strings |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |

---

### concept_set_items

Individual OMOP concept entries within a concept set, with traversal flags for hierarchy and mapping expansion.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| concept_set_id | bigint | NO | | FK to concept_sets.id |
| concept_id | integer | NO | | OMOP concept_id from vocab.concept |
| is_excluded | boolean | NO | false | When true, this concept is excluded from the set |
| include_descendants | boolean | NO | true | When true, all concept_ancestor descendants are included |
| include_mapped | boolean | NO | false | When true, non-standard concepts mapped to this concept are included |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 5. Concept Mapping & Vocabulary

Tools for mapping source codes (ICD-10, CPT, LOINC, custom codes) to OMOP standard concepts, including AI-assisted suggestions, review workflows, and caching.

### accepted_mappings

Final accepted source-code-to-OMOP-concept mappings for a given source. These drive ETL concept ID assignment.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id — the CDM source this mapping applies to |
| source_code | character varying | NO | | Source code value (e.g., ICD-10 code, custom lab code) |
| source_vocabulary_id | character varying | NO | | Source vocabulary identifier (e.g., `ICD10CM`, `CPT4`) |
| target_concept_id | integer | NO | | OMOP standard concept_id from vocab.concept |
| target_concept_name | character varying | YES | | Denormalized concept name for display |
| mapping_method | character varying | NO | `manual` | How the mapping was established: `manual`, `ai_suggested`, `exact_match` |
| confidence | numeric | YES | | Confidence score (0.0–1.0) for AI-suggested mappings |
| reviewed_by | bigint | YES | | FK to users.id — reviewer who accepted the mapping |
| reviewed_at | timestamp | YES | | Timestamp of acceptance |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### concept_mappings

Working-state concept mappings generated during ingestion or mapping projects, pending review.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_code | character varying | NO | | Source code being mapped |
| source_description | text | YES | | Human-readable description of the source code |
| source_vocabulary_id | character varying | YES | | Source vocabulary (e.g., `ICD10CM`, `LOINC`) |
| target_concept_id | integer | YES | | Proposed OMOP concept_id (NULL if no candidate found) |
| confidence | numeric | YES | | AI confidence score for the proposed mapping |
| strategy | character varying | YES | | Mapping strategy used: `semantic`, `exact`, `fuzzy`, `llm` |
| is_reviewed | boolean | NO | false | Whether a reviewer has acted on this mapping |
| reviewer_id | bigint | YES | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| ingestion_job_id | bigint | YES | | FK to ingestion_jobs.id — job that generated this mapping |
| source_table | character varying | YES | | Source table name where this code appears |
| source_column | character varying | YES | | Source column name where this code appears |
| source_frequency | integer | YES | | Frequency count of this code in the source data |
| review_tier | character varying | YES | | Priority tier for review queue ordering |

---

### mapping_cache

Persistent cache of confirmed code-to-concept mappings, shared across projects to avoid redundant AI calls.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_code | character varying | NO | | Source code value |
| source_description | text | YES | | Source code description |
| source_vocabulary_id | character varying | YES | | Source vocabulary identifier |
| target_concept_id | integer | NO | | Confirmed OMOP concept_id |
| confidence | numeric | NO | | Confidence score at time of caching |
| strategy | character varying | NO | | Strategy that produced this mapping |
| times_confirmed | integer | NO | 1 | Number of times this mapping has been confirmed by reviewers |
| last_confirmed_at | timestamp | NO | | Timestamp of most recent confirmation |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### mapping_candidates

AI-generated candidate target concepts for a given source code, ranked by confidence score.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| concept_mapping_id | bigint | NO | | FK to concept_mappings.id |
| target_concept_id | integer | NO | | OMOP concept_id candidate |
| concept_name | character varying | NO | | Denormalized concept name |
| domain_id | character varying | NO | | OMOP domain (e.g., `Condition`, `Drug`, `Measurement`) |
| vocabulary_id | character varying | NO | | OMOP vocabulary (e.g., `SNOMED`, `RxNorm`, `LOINC`) |
| standard_concept | character varying | YES | | `S` if standard concept, `C` if classification concept |
| score | numeric | NO | | Composite ranking score |
| strategy | character varying | NO | | Strategy that generated this candidate |
| strategy_scores | jsonb | YES | | Per-strategy sub-scores for transparency |
| rank | smallint | NO | | Ordinal rank among candidates for this source code (1 = best) |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### mapping_projects

User-created mapping projects for batch vocabulary mapping tasks, analogous to OHDSI Usagi sessions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| user_id | bigint | NO | | FK to users.id — project owner |
| name | character varying | NO | | Project name |
| description | text | YES | | Project purpose |
| source_terms | json | NO | | JSON array of source terms submitted for mapping |
| results | json | NO | | JSON map of source term → mapping results |
| decisions | json | NO | | JSON map of source term → reviewer decisions |
| target_vocabularies | json | YES | | JSON array of target vocabulary IDs to restrict mapping search |
| target_domains | json | YES | | JSON array of OMOP domain IDs to restrict mapping search |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### mapping_reviews

Individual reviewer decisions on concept_mapping entries within the review workflow.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| concept_mapping_id | bigint | NO | | FK to concept_mappings.id |
| reviewer_id | bigint | NO | | FK to users.id |
| action | character varying | NO | | Review decision: `accept`, `reject`, `override` |
| target_concept_id | integer | YES | | Override concept_id if reviewer chose a different target |
| comment | text | YES | | Reviewer notes |
| created_at | timestamp | YES | | Review submission timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### unmapped_code_reviews

Source codes that could not be automatically mapped and are queued for human review.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| source_code | character varying | NO | | The unmapped source code |
| source_vocabulary_id | character varying | NO | | Source vocabulary the code belongs to |
| status | character varying | NO | `pending` | Review status: `pending`, `reviewed`, `deferred` |
| notes | text | YES | | Reviewer notes |
| reviewed_by | bigint | YES | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### unmapped_source_codes

Aggregate counts of source codes that have no OMOP standard mapping, tracked per release for trend analysis.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| release_id | bigint | NO | | FK to source_releases.id |
| source_code | character varying | NO | | The unmapped source code value |
| source_vocabulary_id | character varying | NO | | Source vocabulary identifier |
| cdm_table | character varying | NO | | CDM table where this code appears |
| cdm_field | character varying | NO | | CDM column where this code appears |
| record_count | bigint | NO | | Number of records with this unmapped code |
| created_at | timestamp | NO | | Record creation timestamp |
| patient_count | integer | NO | 0 | Number of distinct persons affected by this unmapped code |

---

### vocabulary_imports

Tracks bulk OMOP vocabulary file imports into the `vocab` schema (Athena vocabulary download processing).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| user_id | bigint | NO | | FK to users.id — user who initiated the import |
| source_id | bigint | YES | | FK to sources.id — optional target source association |
| status | character varying | NO | `pending` | Import status: `pending`, `running`, `completed`, `failed` |
| progress_percentage | smallint | NO | 0 | Import progress 0–100 |
| file_name | character varying | NO | | Original uploaded file name |
| storage_path | character varying | NO | | Server-side storage path of the vocabulary archive |
| file_size | bigint | YES | | File size in bytes |
| log_output | text | YES | | Running import log output |
| error_message | text | YES | | Error detail if import failed |
| rows_loaded | integer | YES | | Total rows loaded across all vocabulary tables |
| target_schema | character varying | YES | | PostgreSQL schema to load into (typically `vocab`) |
| started_at | timestamp | YES | | Import start timestamp |
| completed_at | timestamp | YES | | Import completion timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 6. Data Ingestion & ETL

Projects for ingesting raw source data into OMOP CDM format, including file uploads, WhiteRabbit scan profiles, and ETL mappings.

### ingestion_projects

Top-level container for a data ingestion workflow. Supports file upload, direct DB connection, and FHIR streaming modes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Project name |
| source_id | bigint | YES | | FK to sources.id — target CDM source after ingestion |
| status | character varying | NO | `draft` | Project status: `draft`, `scanning`, `mapping`, `running`, `completed`, `failed` |
| created_by | bigint | NO | | FK to users.id |
| file_count | integer | NO | 0 | Number of files uploaded to this project |
| total_size_bytes | bigint | NO | 0 | Total size of uploaded files in bytes |
| notes | text | YES | | Freeform project notes |
| deleted_at | timestamp | YES | | Soft delete timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| db_connection_config | text | YES | | Encrypted connection config for direct DB ingestion mode |
| selected_tables | jsonb | YES | | JSON array of selected source tables for DB ingestion |
| fhir_connection_id | bigint | YES | | FK to fhir_connections.id — for FHIR streaming mode |
| fhir_sync_mode | character varying | YES | | FHIR sync mode: `full`, `incremental` |
| fhir_config | text | YES | | Encrypted FHIR-specific ingestion configuration |
| last_fhir_sync_run_id | bigint | YES | | FK to fhir_sync_runs.id — most recent FHIR sync run |
| last_fhir_sync_at | timestamp | YES | | Timestamp of last FHIR sync |
| last_fhir_sync_status | character varying | YES | | Status of last FHIR sync run |

---

### ingestion_jobs

Individual job runs within an ingestion project (one job per file or batch).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | YES | | FK to sources.id |
| status | character varying | NO | `pending` | Job status: `pending`, `running`, `completed`, `failed` |
| config_json | jsonb | YES | | JSON configuration for this job run |
| started_at | timestamp | YES | | Job start timestamp |
| completed_at | timestamp | YES | | Job completion timestamp |
| stats_json | jsonb | YES | | Structured statistics (rows processed, errors, etc.) |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| current_step | character varying | YES | | Name of the currently executing pipeline step |
| progress_percentage | smallint | NO | 0 | Progress 0–100 |
| error_message | text | YES | | Error detail if job failed |
| created_by | bigint | YES | | FK to users.id |
| ingestion_project_id | bigint | YES | | FK to ingestion_projects.id |
| staging_table_name | character varying | YES | | Temporary staging table created during this job |

---

### etl_projects

ETL design projects that map source schema columns to OMOP CDM target columns.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | YES | | FK to sources.id |
| cdm_version | character varying | NO | `5.4` | Target OMOP CDM version |
| name | character varying | NO | | ETL project name |
| status | character varying | NO | `draft` | Design status: `draft`, `in_progress`, `review`, `complete` |
| created_by | bigint | NO | | FK to users.id |
| scan_profile_id | bigint | YES | | FK to source_profiles.id — WhiteRabbit scan used for this ETL |
| notes | text | YES | | Design notes |
| deleted_at | timestamp | YES | | Soft delete timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| ingestion_project_id | bigint | YES | | FK to ingestion_projects.id — associated ingestion project |

---

### etl_table_mappings

Table-level mapping within an ETL project, defining how each source table maps to an OMOP CDM target table.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| etl_project_id | bigint | NO | | FK to etl_projects.id |
| source_table | character varying | NO | | Source table name |
| target_table | character varying | NO | | OMOP CDM target table name (e.g., `drug_exposure`, `condition_occurrence`) |
| logic | text | YES | | Free-text ETL logic description or SQL snippet |
| is_completed | boolean | NO | false | Whether this table mapping is marked complete |
| is_stem | boolean | NO | false | Whether this mapping uses the OMOP stem table intermediate |
| sort_order | integer | NO | 0 | Display order in the ETL design UI |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### etl_field_mappings

Column-level mappings within an ETL table mapping, including transformation logic and AI suggestions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| etl_table_mapping_id | bigint | NO | | FK to etl_table_mappings.id |
| source_column | character varying | YES | | Source column name (NULL for computed columns) |
| target_column | character varying | NO | | OMOP CDM target column name |
| mapping_type | character varying | NO | `direct` | Mapping type: `direct`, `computed`, `constant`, `lookup` |
| logic | text | YES | | SQL expression or transformation logic |
| is_required | boolean | NO | false | Whether the target column is required per CDM spec |
| confidence | double precision | YES | | AI confidence score for auto-suggested mapping |
| is_ai_suggested | boolean | NO | false | Whether this mapping was AI-generated |
| is_reviewed | boolean | NO | false | Whether a human has reviewed and accepted this mapping |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### source_profiles

WhiteRabbit scan profiles providing structural metadata about source datasets before ETL.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| ingestion_job_id | bigint | YES | | FK to ingestion_jobs.id |
| file_name | character varying | YES | | Original source file name |
| file_format | character varying | YES | | File format (e.g., `csv`, `parquet`, `xlsx`) |
| file_size | bigint | YES | | File size in bytes |
| row_count | integer | YES | | Number of data rows |
| column_count | integer | YES | | Number of columns |
| format_metadata | jsonb | YES | | Format-specific metadata (delimiter, encoding, etc.) |
| storage_path | character varying | YES | | Path to uploaded file on the server |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| source_id | bigint | YES | | FK to sources.id |
| scan_type | character varying | NO | `whiterabbit` | Scan tool used: `whiterabbit` or `parthenon_native` |
| scan_time_seconds | double precision | YES | | Time taken to complete the scan |
| overall_grade | character varying | YES | | Composite data quality grade for this source |
| table_count | integer | YES | | Number of tables/sheets scanned |
| total_rows | bigint | YES | | Total rows across all tables |
| summary_json | jsonb | YES | | Structured scan summary statistics |

---

### field_profiles

Column-level statistical profiles generated during WhiteRabbit scanning, including top values and PII detection.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_profile_id | bigint | NO | | FK to source_profiles.id |
| column_name | character varying | NO | | Column name in the source |
| column_index | integer | YES | | Zero-based column index |
| inferred_type | character varying | YES | | Inferred data type (e.g., `integer`, `date`, `string`) |
| non_null_count | integer | YES | | Count of non-NULL values |
| null_count | integer | YES | | Count of NULL values |
| null_percentage | numeric | YES | | Percentage of NULL values |
| distinct_count | integer | YES | | Count of distinct values |
| distinct_percentage | numeric | YES | | Percentage of rows with distinct values |
| top_values | jsonb | YES | | JSON array of most frequent values with counts |
| sample_values | jsonb | YES | | JSON array of random sample values |
| statistics | jsonb | YES | | Numeric statistics: min, max, mean, stddev, percentiles |
| is_potential_pii | boolean | NO | false | Whether this column was flagged as potential PHI/PII |
| pii_type | character varying | YES | | PII classification if flagged (e.g., `name`, `email`, `ssn`, `dob`) |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| table_name | character varying | YES | | Table name this column belongs to |
| row_count | bigint | YES | | Row count for the parent table at scan time |

---

### schema_mappings

AI-generated column-to-CDM mappings from the ingestion pipeline, tracking suggestion and confirmation state.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| ingestion_job_id | bigint | NO | | FK to ingestion_jobs.id |
| source_table | character varying | NO | | Source table name |
| source_column | character varying | NO | | Source column name |
| cdm_table | character varying | YES | | Suggested OMOP CDM target table |
| cdm_column | character varying | YES | | Suggested OMOP CDM target column |
| confidence | numeric | YES | | AI suggestion confidence score |
| mapping_logic | character varying | YES | | Short description of the mapping logic |
| transform_config | jsonb | YES | | Transformation configuration (type casting, value mapping, etc.) |
| is_confirmed | boolean | NO | false | Whether a human has confirmed this mapping |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### validation_results

Post-ingestion validation check results against CDM constraints and data quality rules.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| ingestion_job_id | bigint | NO | | FK to ingestion_jobs.id |
| check_name | character varying | NO | | Name of the validation check |
| check_category | character varying | NO | | Category (e.g., `completeness`, `conformance`, `plausibility`) |
| cdm_table | character varying | NO | | CDM table being validated |
| cdm_column | character varying | YES | | CDM column being validated (NULL for table-level checks) |
| severity | character varying | NO | | Check severity: `error`, `warning`, `info` |
| passed | boolean | NO | | Whether the check passed |
| violated_rows | integer | NO | 0 | Number of rows violating this check |
| total_rows | integer | NO | 0 | Total rows evaluated |
| violation_percentage | numeric | YES | | Percentage of rows in violation |
| description | text | NO | | Human-readable description of what this check validates |
| details | jsonb | YES | | Structured details and example violating values |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 7. Achilles & Data Characterization

OHDSI Achilles data characterization runs, step-level tracking, Heel data quality findings, and custom characterizations.

### achilles_runs

Top-level record for each Achilles characterization run against a CDM source.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| run_id | uuid | NO | | Unique UUID for this Achilles run (links to achilles_run_steps) |
| status | character varying | NO | `pending` | Run status: `pending`, `running`, `completed`, `failed` |
| total_analyses | integer | NO | 0 | Total number of Achilles analyses to execute |
| completed_analyses | integer | NO | 0 | Number of successfully completed analyses |
| failed_analyses | integer | NO | 0 | Number of failed analyses |
| categories | json | YES | | JSON object of category → analysis ID arrays for this run |
| started_at | timestamp | YES | | Run start timestamp |
| completed_at | timestamp | YES | | Run completion timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| release_id | bigint | YES | | FK to source_releases.id — associated CDM release |

---

### achilles_run_steps

Granular per-analysis step tracking within an Achilles run.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| run_id | uuid | NO | | FK to achilles_runs.run_id |
| analysis_id | integer | NO | | OHDSI Achilles analysis ID (1–2000 range) |
| analysis_name | character varying | NO | | Human-readable Achilles analysis name |
| category | character varying | NO | | Analysis category (e.g., `person`, `visit`, `drug`, `condition`) |
| status | character varying | NO | `pending` | Step status: `pending`, `running`, `completed`, `failed` |
| elapsed_seconds | double precision | YES | | Execution time in seconds |
| error_message | text | YES | | Error detail if step failed |
| started_at | timestamp | YES | | Step start timestamp |
| completed_at | timestamp | YES | | Step completion timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### achilles_heel_results

Achilles Heel data quality findings flagging anomalies in the CDM data (e.g., future dates, impossible values, low prevalence).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| rule_id | integer | NO | | Heel rule identifier |
| rule_name | character varying | NO | | Human-readable Heel rule name |
| severity | character varying | NO | | Issue severity: `error`, `warning`, `notification` |
| record_count | bigint | NO | 0 | Number of affected records |
| attribute_name | character varying | YES | | CDM field or concept attribute involved in the finding |
| attribute_value | text | YES | | Value of the attribute that triggered the rule |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| run_id | uuid | YES | | FK to achilles_runs.run_id |

---

### characterizations

Custom characterization analysis designs (beyond standard Achilles analyses).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Characterization name |
| description | text | YES | | Description of what this characterization measures |
| design_json | jsonb | YES | | Analysis design specification JSON |
| author_id | bigint | NO | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |

---

### clinical_coherence_results

Results from custom clinical coherence analyses checking domain-specific logical consistency.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| analysis_id | character varying | NO | | Custom coherence analysis identifier |
| analysis_name | character varying | NO | | Human-readable analysis name |
| category | character varying | NO | | Analysis category (e.g., `temporal`, `referential`, `domain`) |
| severity | character varying | NO | `informational` | Finding severity: `informational`, `warning`, `critical` |
| stratum_1 | character varying | YES | | Primary stratification value (e.g., concept_id) |
| stratum_2 | character varying | YES | | Secondary stratification value |
| stratum_3 | character varying | YES | | Tertiary stratification value |
| count_value | bigint | YES | | Numerator count |
| total_value | bigint | YES | | Denominator count |
| ratio_value | numeric | YES | | count_value / total_value |
| flagged | boolean | NO | false | Whether this result is flagged as a quality issue |
| notes | text | YES | | Analyst notes about this result |
| run_at | timestamp with time zone | NO | | Timestamp when the analysis was run |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 8. Data Quality

OHDSI Data Quality Dashboard (DQD) results, cross-release delta tracking, and SLA targets.

### dqd_results

Individual DQD check results following the OHDSI Data Quality Framework (completeness, conformance, plausibility).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| run_id | uuid | NO | | DQD run UUID for grouping results |
| check_id | character varying | NO | | DQD check identifier (e.g., `measureConditionEraCompleteness`) |
| category | character varying | NO | | DQD category: `completeness`, `conformance`, `plausibility` |
| subcategory | character varying | NO | | DQD subcategory (e.g., `atemporal`, `temporal`) |
| cdm_table | character varying | NO | | CDM table being evaluated |
| cdm_column | character varying | YES | | CDM column being evaluated (NULL for table-level checks) |
| severity | character varying | NO | | Check severity threshold classification |
| threshold | numeric | NO | 0 | Pass/fail threshold percentage |
| passed | boolean | NO | | Whether the check passed the threshold |
| violated_rows | bigint | NO | 0 | Number of rows violating this check |
| total_rows | bigint | NO | 0 | Total rows evaluated |
| violation_percentage | numeric | YES | | Percentage of rows in violation |
| description | text | NO | | OHDSI DQD check description |
| details | jsonb | YES | | Detailed breakdown of violations |
| execution_time_ms | integer | YES | | Check execution time in milliseconds |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| release_id | bigint | YES | | FK to source_releases.id |

---

### dqd_deltas

Cross-release delta comparisons for DQD checks, enabling trend monitoring of data quality over time.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| current_release_id | bigint | NO | | FK to source_releases.id — current (newer) release |
| previous_release_id | bigint | YES | | FK to source_releases.id — previous release for comparison |
| check_id | character varying | NO | | DQD check identifier |
| delta_status | character varying | NO | | Change status: `improved`, `regressed`, `unchanged`, `new`, `removed` |
| current_passed | boolean | NO | | Whether check passed in current release |
| previous_passed | boolean | YES | | Whether check passed in previous release (NULL if new) |
| created_at | timestamp | NO | | Record creation timestamp |

---

### dq_sla_targets

Configurable pass-rate SLA targets per data quality category for a given source.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| category | character varying | NO | | DQD category this SLA applies to (e.g., `completeness`) |
| min_pass_rate | numeric | NO | 80 | Minimum required pass rate percentage (0–100) |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 9. Population-Level Analyses

OHDSI population-level effect estimation, prediction, incidence, pathway, SCCS, feature, and evidence synthesis analyses.

### analysis_executions

Generic execution tracking for all population-level analysis types (CohortMethod, PLP, IR, Pathway, SCCS).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| analysis_type | character varying | NO | | Analysis type: `estimation`, `prediction`, `incidence_rate`, `pathway`, `sccs`, `feature`, `evidence_synthesis` |
| analysis_id | bigint | NO | | FK to the type-specific analysis table |
| source_id | bigint | NO | | FK to sources.id — CDM source for execution |
| status | character varying | NO | `pending` | Status: `pending`, `running`, `completed`, `failed` |
| started_at | timestamp | YES | | Execution start timestamp |
| completed_at | timestamp | YES | | Execution completion timestamp |
| result_json | jsonb | YES | | Structured result summary |
| fail_message | text | YES | | Error detail if execution failed |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### estimation_analyses

CohortMethod population-level effect estimation analyses (comparative cohort studies, PS matching/weighting).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Analysis name |
| description | text | YES | | Scientific rationale and methods description |
| design_json | jsonb | YES | | CohortMethod analysis design JSON |
| author_id | bigint | NO | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |

---

### prediction_analyses

PatientLevelPrediction (PLP) analyses for developing patient outcome prediction models.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Analysis name |
| description | text | YES | | Prediction task description |
| design_json | jsonb | YES | | PLP analysis design JSON (target/outcome cohorts, ML settings) |
| author_id | bigint | NO | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |

---

### incidence_rate_analyses

Incidence rate analyses computing crude and age/sex-standardized incidence rates for outcomes in target populations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Analysis name |
| description | text | YES | | Analysis description |
| design_json | jsonb | YES | | OHDSI incidence rate analysis design JSON |
| author_id | bigint | NO | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |

---

### pathway_analyses

OHDSI treatment pathway analyses visualizing sequences of drug/procedure exposures in a cohort.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Analysis name |
| description | text | YES | | Description of the pathway question |
| design_json | jsonb | YES | | OHDSI pathway analysis design JSON |
| author_id | bigint | NO | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |

---

### sccs_analyses

Self-Controlled Case Series (SCCS) analyses for vaccine safety and drug-event association studies.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Analysis name |
| description | text | YES | | Scientific rationale |
| design_json | jsonb | YES | | SCCS analysis design JSON |
| author_id | bigint | NO | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |

---

### feature_analyses

Feature extraction analyses (FeatureExtraction) computing cohort covariates.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Analysis name |
| description | text | YES | | Description of features being extracted |
| design_json | jsonb | YES | | FeatureExtraction design JSON |
| domain_id | character varying | YES | | OMOP domain focus for this feature analysis |
| author_id | bigint | NO | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |

---

### evidence_synthesis_analyses

EvidenceSynthesis meta-analyses combining results from multiple sites or studies.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Analysis name |
| description | text | YES | | Synthesis approach description |
| design_json | jsonb | YES | | EvidenceSynthesis design JSON (fixed-effects, random-effects, Bayesian) |
| author_id | bigint | NO | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |

---

### execution_logs

Granular log entries for analysis executions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| execution_id | bigint | NO | | FK to analysis_executions.id |
| level | character varying | NO | `info` | Log level: `debug`, `info`, `warning`, `error` |
| message | text | NO | | Log message text |
| context | jsonb | YES | | Structured context data for the log entry |
| created_at | timestamp | YES | | Log entry timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 10. Risk Scores

Clinical risk score analyses (CHADS₂-VASc, Charlson CCI, APACHE, custom) computed at both patient and population levels.

### risk_score_analyses

Risk score analysis definitions specifying which validated scores to compute and for which cohort.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Analysis name |
| description | text | YES | | Clinical purpose of the analysis |
| design_json | jsonb | NO | | Analysis design specifying score IDs, cohort, source, and output settings |
| author_id | bigint | YES | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |

---

### risk_score_patient_results

Per-patient risk score results for a specific execution, linked to a cohort generation.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| execution_id | bigint | NO | | FK to analysis_executions.id |
| source_id | bigint | NO | | FK to sources.id |
| cohort_definition_id | bigint | NO | | FK to cohort_definitions.id |
| person_id | bigint | NO | | OMOP person_id from the CDM source |
| score_id | character varying | NO | | Score identifier (e.g., `chadsvasc`, `charlson_v2`, `apache_ii`) |
| score_value | numeric | YES | | Computed numeric score value |
| risk_tier | character varying | YES | | Risk tier: `low`, `moderate`, `high`, `very_high` |
| confidence | numeric | YES | | Completeness-weighted confidence in the score (0.0–1.0) |
| completeness | numeric | YES | | Fraction of required score components with available data |
| missing_components | jsonb | YES | | JSON array of score components lacking data |
| created_at | timestamp | NO | now() | Record creation timestamp |

---

### risk_score_run_steps

Per-score execution step tracking within a risk score analysis run.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| execution_id | bigint | NO | | FK to analysis_executions.id |
| score_id | character varying | NO | | Score identifier being computed in this step |
| status | character varying | NO | `pending` | Step status: `pending`, `running`, `completed`, `failed` |
| started_at | timestamp | YES | | Step start timestamp |
| completed_at | timestamp | YES | | Step completion timestamp |
| elapsed_ms | integer | YES | | Execution time in milliseconds |
| patient_count | integer | YES | | Number of patients scored in this step |
| error_message | text | YES | | Error detail if step failed |
| created_at | timestamp | NO | now() | Record creation timestamp |

---

### population_risk_score_results

Aggregate population-level risk score distributions by source, score, category, and risk tier.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| score_id | character varying | NO | | Score identifier |
| score_name | character varying | NO | | Human-readable score name |
| category | character varying | NO | | Clinical category (e.g., `atrial_fibrillation`, `comorbidity`) |
| risk_tier | character varying | NO | | Risk tier label |
| patient_count | integer | NO | 0 | Number of patients in this tier |
| total_eligible | integer | YES | | Total eligible patients for this score |
| mean_score | numeric | YES | | Mean score value in this tier |
| p25_score | numeric | YES | | 25th percentile score |
| median_score | numeric | YES | | Median score |
| p75_score | numeric | YES | | 75th percentile score |
| mean_confidence | numeric | YES | | Mean confidence across patients in this tier |
| mean_completeness | numeric | YES | | Mean data completeness across patients in this tier |
| missing_components | text | YES | | Most frequently missing score components |
| run_at | timestamp with time zone | NO | | Timestamp when this aggregate was computed |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### population_characterization_results

Aggregate population characterization results (similar to Achilles results but for custom stratifications).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| analysis_id | character varying | NO | | Custom analysis identifier |
| stratum_1 | character varying | NO | `''` | Primary stratum (e.g., concept_id, year, gender) |
| stratum_2 | character varying | NO | `''` | Secondary stratum |
| stratum_3 | character varying | NO | `''` | Tertiary stratum |
| count_value | bigint | YES | | Numerator count for this stratum |
| total_value | bigint | YES | | Denominator count |
| ratio_value | numeric | YES | | count_value / total_value |
| run_at | timestamp with time zone | NO | | Analysis run timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 11. Care Gaps & Quality Measures

Clinical care gap tracking using ECQM-aligned quality measures organized into condition bundles. Enables population health management and compliance reporting.

### condition_bundles

Clinical condition bundles grouping related ICD-10 codes and OMOP concepts, aligned with CMS eCQM bundles.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| bundle_code | character varying | NO | | Short unique bundle code (e.g., `DM`, `HTN`, `CHF`) |
| condition_name | character varying | NO | | Human-readable condition name |
| description | text | YES | | Condition and bundle scope description |
| icd10_patterns | jsonb | NO | | JSON array of ICD-10 code patterns for patient identification |
| omop_concept_ids | jsonb | NO | | JSON array of OMOP concept_ids for this condition |
| bundle_size | integer | NO | 0 | Number of quality measures in this bundle |
| ecqm_references | jsonb | YES | | JSON array of CMS eCQM measure identifiers |
| disease_category | character varying | YES | | Broad disease category (e.g., `cardiovascular`, `endocrine`) |
| author_id | bigint | YES | | FK to users.id |
| is_active | boolean | NO | true | Whether this bundle is active |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |

---

### quality_measures

Individual quality measures (analogous to HEDIS or CMS eCQM measures) within a condition bundle.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| measure_code | character varying | NO | | Unique measure code (e.g., `DM_A1C_CONTROL`, `HTN_BP_CONTROL`) |
| measure_name | character varying | NO | | Human-readable measure name |
| description | text | YES | | Measure definition and clinical rationale |
| measure_type | character varying | NO | | Measure type: `process`, `outcome`, `intermediate_outcome`, `structural` |
| domain | character varying | NO | | Clinical domain (e.g., `Measurement`, `Drug`, `Procedure`) |
| concept_set_id | bigint | YES | | FK to concept_sets.id — relevant OMOP concept set |
| numerator_criteria | jsonb | YES | | Numerator cohort criteria JSON |
| denominator_criteria | jsonb | YES | | Denominator cohort criteria JSON |
| exclusion_criteria | jsonb | YES | | Exclusion criteria JSON |
| frequency | character varying | YES | | Recommended measurement frequency (e.g., `annual`, `biannual`) |
| is_active | boolean | NO | true | Whether this measure is active |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### bundle_measures

Pivot table linking quality measures to condition bundles with ordering.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| bundle_id | bigint | NO | | FK to condition_bundles.id |
| measure_id | bigint | NO | | FK to quality_measures.id |
| ordinal | integer | NO | 0 | Display order of this measure within the bundle |

---

### bundle_overlap_rules

Rules governing deduplication of care gaps when a patient qualifies under multiple overlapping bundles.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| rule_code | character varying | NO | | Unique rule identifier |
| shared_domain | character varying | NO | | Clinical domain shared by overlapping bundles |
| applicable_bundle_codes | jsonb | NO | | JSON array of bundle codes this rule applies to |
| canonical_measure_code | character varying | NO | | The measure to use when deduplicating overlaps |
| description | text | YES | | Rule rationale |
| is_active | boolean | NO | true | Whether this rule is enforced |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### care_gap_evaluations

Full care gap evaluation runs against a source and bundle, capturing aggregate compliance results.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| bundle_id | bigint | NO | | FK to condition_bundles.id |
| source_id | bigint | NO | | FK to sources.id |
| cohort_definition_id | bigint | YES | | FK to cohort_definitions.id — optional population restriction |
| status | character varying | NO | `pending` | Status: `pending`, `running`, `completed`, `failed` |
| evaluated_at | timestamp | YES | | Evaluation completion timestamp |
| result_json | jsonb | YES | | Full structured evaluation results |
| person_count | integer | YES | | Number of persons evaluated |
| compliance_summary | jsonb | YES | | Per-measure compliance rates |
| fail_message | text | YES | | Error detail if evaluation failed |
| author_id | bigint | YES | | FK to users.id — who initiated the evaluation |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### care_gap_patient_bundles

Per-patient bundle enrollment for care gap tracking, indicating which patients are enrolled in which bundles.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| bundle_id | bigint | NO | | FK to condition_bundles.id |
| person_id | bigint | NO | | OMOP person_id |
| enrolled_at | date | NO | | Date patient was enrolled in this bundle |
| refreshed_at | timestamp with time zone | NO | | Last time this enrollment was refreshed |

---

### care_gap_patient_measures

Per-patient, per-measure care gap status tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| bundle_id | bigint | NO | | FK to condition_bundles.id |
| measure_id | bigint | NO | | FK to quality_measures.id |
| person_id | bigint | NO | | OMOP person_id |
| status | character varying | NO | `open` | Gap status: `open`, `met`, `excluded` |
| last_service_date | date | YES | | Most recent date this measure was fulfilled |
| due_date | date | YES | | Date by which this measure is next due |
| days_overdue | integer | YES | | Days past due date (NULL if not overdue) |
| is_deduplicated | boolean | NO | false | Whether this gap was deduplicated per bundle_overlap_rules |
| refreshed_at | timestamp with time zone | NO | | Last time this gap status was recalculated |

---

### care_gap_snapshots

Point-in-time population-level care gap compliance snapshots for trend analysis.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| bundle_id | bigint | NO | | FK to condition_bundles.id |
| cohort_definition_id | bigint | YES | | FK to cohort_definitions.id |
| snapshot_date | date | NO | | Date of this snapshot |
| person_count | integer | NO | 0 | Number of persons in the snapshot population |
| measures_met | integer | NO | 0 | Count of patient-measure pairs with status `met` |
| measures_open | integer | NO | 0 | Count of patient-measure pairs with status `open` |
| measures_excluded | integer | NO | 0 | Count of patient-measure pairs with status `excluded` |
| compliance_pct | numeric | NO | 0 | Overall compliance percentage (measures_met / (measures_met + measures_open)) |
| risk_high_count | integer | NO | 0 | Number of high-risk patients |
| risk_medium_count | integer | NO | 0 | Number of medium-risk patients |
| risk_low_count | integer | NO | 0 | Number of low-risk patients |
| etl_duration_ms | integer | YES | | Time to compute this snapshot in milliseconds |
| computed_at | timestamp with time zone | NO | | Timestamp when this snapshot was computed |

---

## 12. Studies

Multi-site observational research studies with full lifecycle management: protocol, team, cohorts, analyses, sites, executions, results, and synthesis.

### studies

Top-level study record representing a population-level research study from inception through publication.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| title | character varying | NO | | Full study title |
| description | text | YES | | Study abstract or overview |
| study_type | character varying | YES | | Study type (e.g., `cohort`, `case_control`, `cross_sectional`, `rct`) |
| created_by | bigint | NO | | FK to users.id — study creator |
| status | character varying | NO | `draft` | Study lifecycle status: `draft`, `protocol`, `execution`, `analysis`, `reporting`, `published`, `archived` |
| metadata | jsonb | YES | | Flexible metadata (IRB numbers, funding codes, etc.) |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |
| short_title | character varying | YES | | Brief acronym or short title |
| slug | character varying | YES | | URL-safe slug derived from short_title |
| study_design | character varying | YES | | Study design category (e.g., `observational`, `interventional`) |
| phase | character varying | NO | `pre_study` | Internal project phase: `pre_study`, `protocol_development`, `execution`, `analysis`, `dissemination` |
| priority | character varying | NO | `medium` | Priority level: `low`, `medium`, `high`, `critical` |
| principal_investigator_id | bigint | YES | | FK to users.id |
| lead_data_scientist_id | bigint | YES | | FK to users.id |
| lead_statistician_id | bigint | YES | | FK to users.id |
| scientific_rationale | text | YES | | Scientific background and rationale |
| hypothesis | text | YES | | Study hypothesis |
| primary_objective | text | YES | | Primary research objective |
| secondary_objectives | jsonb | YES | | JSON array of secondary objectives |
| study_start_date | date | YES | | Planned study start date |
| study_end_date | date | YES | | Planned study end date |
| target_enrollment_sites | integer | YES | | Target number of participating sites |
| actual_enrollment_sites | integer | NO | 0 | Current number of active sites |
| protocol_version | character varying | YES | | Study protocol version (e.g., `v1.2`) |
| protocol_finalized_at | timestamp | YES | | Timestamp when protocol was finalized |
| funding_source | text | YES | | Grant or funding source description |
| clinicaltrials_gov_id | character varying | YES | | ClinicalTrials.gov NCT number |
| tags | jsonb | YES | | JSON array of tag strings |
| settings | jsonb | YES | | Study-level configuration settings |

---

### study_team_members

Study team roster with roles and optional site assignments.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to studies.id |
| user_id | bigint | NO | | FK to users.id |
| role | character varying | NO | | Team role (e.g., `pi`, `co_investigator`, `data_scientist`, `statistician`, `coordinator`) |
| site_id | bigint | YES | | FK to study_sites.id — site-specific team member |
| permissions | jsonb | YES | | JSON map of granted study-level permissions |
| joined_at | timestamp | NO | now() | Date/time member joined the team |
| left_at | timestamp | YES | | Date/time member left (NULL if still active) |
| is_active | boolean | NO | true | Whether member is currently active on the study |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### study_cohorts

Cohort definitions linked to a study with their role (target, comparator, outcome, subgroup).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to studies.id |
| cohort_definition_id | bigint | NO | | FK to cohort_definitions.id |
| role | character varying | NO | | Cohort role: `target`, `comparator`, `outcome`, `subgroup`, `exclusion` |
| label | character varying | NO | | Study-specific display label for this cohort |
| description | text | YES | | Role-specific description within the study |
| sql_definition | text | YES | | Generated SQL cohort definition |
| json_definition | jsonb | YES | | Circe JSON cohort definition (snapshot at time of linking) |
| concept_set_ids | jsonb | YES | | JSON array of concept set IDs used in this cohort |
| sort_order | integer | NO | 0 | Display order among study cohorts |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### study_analyses

Links population-level analyses to studies.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to studies.id |
| analysis_type | character varying | NO | | Analysis type identifier (mirrors analysis_executions.analysis_type) |
| analysis_id | bigint | NO | | FK to the type-specific analysis table |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### study_sites

Participating sites (data partners) for a multi-site study, with IRB and DUA tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to studies.id |
| source_id | bigint | NO | | FK to sources.id — CDM source at this site |
| site_role | character varying | NO | `data_partner` | Site role: `lead`, `data_partner`, `coordinating_center` |
| status | character varying | NO | `invited` | Site participation status: `invited`, `onboarding`, `active`, `paused`, `withdrawn` |
| irb_protocol_number | character varying | YES | | Site-specific IRB protocol number |
| irb_approval_date | date | YES | | IRB approval date |
| irb_expiry_date | date | YES | | IRB expiration date |
| irb_type | character varying | YES | | IRB type: `local`, `central`, `reliance` |
| dua_signed_at | timestamp | YES | | Data Use Agreement signing timestamp |
| site_contact_user_id | bigint | YES | | FK to users.id — primary contact at this site |
| cdm_version | character varying | YES | | CDM version at this site |
| vocabulary_version | character varying | YES | | Vocabulary version at this site |
| data_freshness_date | date | YES | | Date through which CDM data is current |
| patient_count_estimate | bigint | YES | | Estimated eligible patient count at this site |
| feasibility_results | jsonb | YES | | Feasibility assessment results for this site |
| execution_log | jsonb | YES | | Execution log for this site's analysis runs |
| results_received_at | timestamp | YES | | Timestamp when results were received from this site |
| notes | text | YES | | Site-specific notes |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |

---

### study_executions

Individual analysis execution runs at a specific site for a study analysis.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to studies.id |
| study_analysis_id | bigint | NO | | FK to study_analyses.id |
| site_id | bigint | YES | | FK to study_sites.id |
| status | character varying | NO | `queued` | Execution status: `queued`, `running`, `completed`, `failed` |
| submitted_by | bigint | NO | | FK to users.id |
| submitted_at | timestamp | NO | now() | Submission timestamp |
| started_at | timestamp | YES | | Execution start timestamp |
| completed_at | timestamp | YES | | Execution completion timestamp |
| execution_engine | character varying | NO | `hades_r` | Engine used: `hades_r`, `python`, `sql` |
| execution_params | jsonb | YES | | Engine-specific execution parameters |
| log_output | text | YES | | Full log output from the execution |
| error_message | text | YES | | Error detail if execution failed |
| result_hash | character varying | YES | | SHA-256 hash of the result file for integrity verification |
| result_file_path | character varying | YES | | Server path to the result file |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### study_results

Reviewed and classified results from study executions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| execution_id | bigint | NO | | FK to study_executions.id |
| study_id | bigint | NO | | FK to studies.id |
| study_analysis_id | bigint | NO | | FK to study_analyses.id |
| site_id | bigint | YES | | FK to study_sites.id |
| result_type | character varying | NO | | Result artifact type (e.g., `hr`, `kaplan_meier`, `ps_distribution`) |
| summary_data | jsonb | NO | | Structured result summary for display |
| diagnostics | jsonb | YES | | Diagnostic metrics (PS diagnostics, balance statistics, etc.) |
| is_primary | boolean | NO | false | Whether this is a primary endpoint result |
| is_publishable | boolean | NO | false | Whether this result has been approved for publication |
| reviewed_by | bigint | YES | | FK to users.id — reviewer |
| reviewed_at | timestamp | YES | | Review timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### study_synthesis

Cross-site evidence synthesis outputs (meta-analysis, Bayesian pooling) for multi-site study results.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to studies.id |
| study_analysis_id | bigint | YES | | FK to study_analyses.id |
| synthesis_type | character varying | NO | | Synthesis method: `fixed_effects`, `random_effects`, `bayesian`, `descriptive` |
| input_result_ids | jsonb | NO | | JSON array of study_results.id values used as inputs |
| method_settings | jsonb | NO | | Method-specific settings (heterogeneity model, priors, etc.) |
| output | jsonb | YES | | Synthesized result output |
| generated_at | timestamp | YES | | Synthesis computation timestamp |
| generated_by | bigint | NO | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### study_artifacts

Files and documents attached to studies (protocols, SAPs, analysis code packages, reports).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to studies.id |
| artifact_type | character varying | NO | | Artifact type: `protocol`, `sap`, `code_package`, `report`, `presentation`, `data_dictionary` |
| title | character varying | NO | | Artifact title |
| description | text | YES | | Description of this artifact's content |
| version | character varying | NO | `1.0` | Artifact version string |
| file_path | character varying | YES | | Server-side storage path |
| file_size_bytes | bigint | YES | | File size in bytes |
| mime_type | character varying | YES | | MIME type of the artifact |
| url | character varying | YES | | Public or internal URL to the artifact |
| metadata | jsonb | YES | | Additional structured metadata |
| uploaded_by | bigint | NO | | FK to users.id |
| is_current | boolean | NO | true | Whether this is the current version |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### study_milestones

Study milestone tracking for project management.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to studies.id |
| title | character varying | NO | | Milestone name |
| description | text | YES | | Milestone description |
| milestone_type | character varying | NO | | Type: `protocol`, `irb`, `data_lock`, `analysis`, `submission`, `publication` |
| target_date | date | YES | | Planned completion date |
| actual_date | date | YES | | Actual completion date |
| status | character varying | NO | `pending` | Status: `pending`, `in_progress`, `completed`, `overdue`, `blocked` |
| assigned_to | bigint | YES | | FK to users.id — responsible person |
| sort_order | integer | NO | 0 | Display order among milestones |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### study_comments

Threaded discussion comments attached to study entities (cohorts, analyses, results, etc.).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to studies.id |
| parent_id | bigint | YES | | FK to study_comments.id — parent comment for threading |
| commentable_type | character varying | NO | | Polymorphic entity type being commented on |
| commentable_id | bigint | NO | | PK of the entity being commented on |
| user_id | bigint | NO | | FK to users.id |
| body | text | NO | | Comment text (may include Markdown) |
| is_resolved | boolean | NO | false | Whether this comment thread has been resolved |
| resolved_by | bigint | YES | | FK to users.id — person who resolved |
| created_at | timestamp | YES | | Comment creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### study_activity_log

Immutable audit log of all significant study-level actions for GCP/regulatory compliance.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to studies.id |
| user_id | bigint | YES | | FK to users.id — NULL for system-generated events |
| action | character varying | NO | | Action performed (e.g., `status_changed`, `member_added`, `result_approved`) |
| entity_type | character varying | YES | | Type of entity affected |
| entity_id | bigint | YES | | PK of the entity affected |
| old_value | jsonb | YES | | Previous state snapshot |
| new_value | jsonb | YES | | New state snapshot |
| ip_address | character varying | YES | | Client IP address |
| occurred_at | timestamp | NO | now() | Event timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 13. Investigations & Evidence

Multi-domain clinical investigations integrating phenotype, clinical, genomic, and synthesis evidence into structured research narratives.

### investigations

Top-level investigation record integrating phenotype, clinical, genomic, and synthesis evidence domains into a structured research workflow.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| title | character varying | NO | | Investigation title |
| research_question | text | YES | | Structured research question |
| status | character varying | NO | `draft` | Status: `draft`, `active`, `reviewing`, `complete`, `archived` |
| owner_id | bigint | NO | | FK to users.id — investigation owner |
| phenotype_state | jsonb | NO | `{}` | Saved state of the Phenotype Explorer panel |
| clinical_state | jsonb | NO | `{}` | Saved state of the Clinical Analysis panel |
| genomic_state | jsonb | NO | `{}` | Saved state of the Genomic Analysis panel |
| synthesis_state | jsonb | NO | `{}` | Saved state of the Synthesis/Evidence panel |
| completed_at | timestamp | YES | | Timestamp when investigation was marked complete |
| last_modified_by | bigint | YES | | FK to users.id — last user to save changes |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### investigation_versions

Point-in-time snapshots of investigation state for version history and rollback.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| investigation_id | bigint | NO | | FK to investigations.id |
| version_number | integer | NO | | Sequential version number (starting at 1) |
| snapshot | jsonb | NO | | Full JSON snapshot of the investigation at this version |
| created_by | bigint | NO | | FK to users.id — who saved this version |
| created_at | timestamp | YES | | Version creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### evidence_pins

Pinned findings and evidence items within an investigation, ordered into a narrative synthesis.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| investigation_id | bigint | NO | | FK to investigations.id |
| domain | character varying | NO | | Evidence domain: `phenotype`, `clinical`, `genomic`, `imaging` |
| section | character varying | NO | | Named section within the domain panel |
| finding_type | character varying | NO | | Type of finding (e.g., `chart`, `table`, `statistic`, `variant`) |
| finding_payload | jsonb | NO | | Full serialized finding data for rendering |
| sort_order | integer | NO | 0 | Order within the pinned evidence narrative |
| is_key_finding | boolean | NO | false | Whether this is highlighted as a key finding |
| narrative_before | text | YES | | Narrative text to display before this finding |
| narrative_after | text | YES | | Narrative text to display after this finding |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| concept_ids | ARRAY | YES | `{}` | Integer array of OMOP concept_ids referenced in this finding |
| gene_symbols | ARRAY | YES | `{}` | Array of gene symbols referenced in this finding |

---

## 14. PROs & Surveys

Patient-Reported Outcomes (PROs) instrument library, administration, and OMOP-mapped response storage. Supports standardized instruments (PHQ-9, GAD-7, KCCQ-12, EQ-5D, etc.) and honest-broker-blinded survey campaigns.

### survey_instruments

PRO instrument definitions, including LOINC panel codes and OMOP concept mappings.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Full instrument name (e.g., "Patient Health Questionnaire-9") |
| abbreviation | character varying | NO | | Short abbreviation (e.g., `PHQ-9`, `KCCQ-12`) |
| version | character varying | NO | `1.0` | Instrument version |
| description | text | YES | | Instrument purpose and validated population |
| domain | character varying | NO | | Clinical domain (e.g., `depression`, `anxiety`, `cardiology`) |
| item_count | smallint | NO | 0 | Number of questions in the instrument |
| scoring_method | jsonb | YES | | JSON description of scoring algorithm including subscales |
| loinc_panel_code | character varying | YES | | LOINC panel code for this instrument |
| omop_concept_id | bigint | YES | | OMOP concept_id from vocab.concept for this instrument |
| license_type | character varying | NO | `public` | License type: `public`, `restricted`, `licensed` |
| license_detail | character varying | YES | | License details or citation requirements |
| is_public_domain | boolean | NO | true | Whether the instrument is in the public domain |
| is_active | boolean | NO | true | Whether this instrument is available for use |
| omop_coverage | character varying | NO | `no` | Whether OMOP standard codes exist: `full`, `partial`, `no` |
| created_by | bigint | YES | | FK to users.id — who added this instrument to the library |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |
| snomed_code | character varying | YES | | SNOMED CT code for the instrument |
| has_snomed | boolean | NO | false | Whether a SNOMED code exists for this instrument |

---

### survey_items

Individual questions (items) within a PRO instrument, with LOINC and OMOP concept mappings per item.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| survey_instrument_id | bigint | NO | | FK to survey_instruments.id |
| item_number | smallint | NO | | Item number within the instrument |
| item_text | text | NO | | Full question text as presented to the respondent |
| response_type | character varying | NO | `likert` | Response format: `likert`, `numeric`, `boolean`, `text`, `date` |
| omop_concept_id | bigint | YES | | OMOP concept_id for this item from vocab.concept |
| loinc_code | character varying | YES | | LOINC code for this specific item |
| subscale_name | character varying | YES | | Subscale this item contributes to |
| is_reverse_coded | boolean | NO | false | Whether this item is reverse-scored before summation |
| min_value | numeric | YES | | Minimum valid response value |
| max_value | numeric | YES | | Maximum valid response value |
| display_order | smallint | NO | | Display order within the instrument |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| snomed_code | character varying | YES | | SNOMED CT code for this item |

---

### survey_answer_options

Defined answer choices for each survey item with OMOP and LOINC answer codes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| survey_item_id | bigint | NO | | FK to survey_items.id |
| option_text | character varying | NO | | Display text for this answer option |
| option_value | numeric | YES | | Numeric score value assigned to this option |
| omop_concept_id | bigint | YES | | OMOP concept_id for this answer from vocab.concept |
| loinc_la_code | character varying | YES | | LOINC Answer (LA) code for this option |
| display_order | smallint | NO | | Display order among answer options |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| snomed_code | character varying | YES | | SNOMED CT code for this answer option |

---

### survey_conduct

OMOP-modeled survey administration records (one row per instrument completion), analogous to OMOP survey_conduct.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| person_id | bigint | YES | | OMOP person_id (NULL for blinded/anonymous administrations) |
| survey_instrument_id | bigint | NO | | FK to survey_instruments.id |
| survey_concept_id | bigint | YES | | OMOP concept_id for the survey from vocab.concept |
| visit_occurrence_id | bigint | YES | | OMOP visit_occurrence_id linking this administration to a visit |
| survey_start_datetime | timestamp | YES | | Survey start timestamp |
| survey_end_datetime | timestamp | YES | | Survey completion timestamp |
| respondent_type_concept_id | bigint | YES | | OMOP concept_id for respondent type (patient, proxy, clinician) |
| survey_mode_concept_id | bigint | YES | | OMOP concept_id for administration mode (paper, electronic, phone) |
| completion_status | character varying | NO | `complete` | Completion status: `complete`, `partial`, `abandoned` |
| total_score | numeric | YES | | Computed total score |
| subscale_scores | jsonb | YES | | JSON map of subscale name → score |
| source_identifier | character varying | YES | | External identifier from the survey delivery system |
| source_id | bigint | YES | | FK to sources.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| campaign_id | bigint | YES | | FK to survey_campaigns.id |

---

### survey_responses

Individual item-level responses, OMOP-mapped to observation_id for CDM integration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| survey_conduct_id | bigint | NO | | FK to survey_conduct.id |
| survey_item_id | bigint | NO | | FK to survey_items.id |
| observation_id | bigint | YES | | OMOP observation_id in the CDM (when written back to CDM) |
| value_as_number | numeric | YES | | Numeric response value |
| value_as_concept_id | bigint | YES | | OMOP concept_id of the selected answer option |
| value_as_string | text | YES | | Free-text response |
| response_datetime | timestamp | YES | | Timestamp when this item was answered |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### survey_campaigns

Survey delivery campaigns linking an instrument to a cohort for outreach.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Campaign name |
| survey_instrument_id | bigint | NO | | FK to survey_instruments.id |
| cohort_generation_id | bigint | YES | | FK to cohort_generations.id — eligible population |
| status | character varying | NO | `draft` | Campaign status: `draft`, `active`, `closed`, `archived` |
| publish_token | character varying | YES | | Token used in public-facing survey URL |
| description | text | YES | | Campaign purpose description |
| closed_at | timestamp | YES | | Timestamp when campaign was closed |
| created_by | bigint | YES | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| requires_honest_broker | boolean | NO | false | Whether this campaign uses honest broker blinding |

---

### survey_honest_broker_links

Honest-broker identity links connecting blinded participant tokens to CDM person_ids. The honest broker pattern ensures researchers never see the identity-survey response link.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| survey_campaign_id | bigint | NO | | FK to survey_campaigns.id |
| survey_conduct_id | bigint | YES | | FK to survey_conduct.id — linked after survey completion |
| person_id | bigint | YES | | OMOP person_id (known only to the honest broker, not researchers) |
| source_id | bigint | YES | | FK to sources.id |
| cohort_generation_id | bigint | YES | | FK to cohort_generations.id |
| blinded_participant_id | character varying | NO | | Pseudonymous participant identifier shared with researchers |
| respondent_identifier_hash | character varying | NO | | Hash of the real-world respondent identifier |
| respondent_identifier | text | YES | | Encrypted real-world identifier (name, MRN) for honest broker use only |
| match_status | character varying | NO | `registered` | Match status: `registered`, `invited`, `submitted`, `linked`, `unmatched` |
| submitted_at | timestamp | YES | | Timestamp when survey was submitted via this link |
| notes | text | YES | | Honest broker operational notes |
| created_by | bigint | YES | | FK to users.id — honest broker who created this link |
| updated_by | bigint | YES | | FK to users.id — last updater |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### survey_honest_broker_contacts

Delivery contact information for honest broker participants (email, phone), stored separately from CDM identity.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| survey_honest_broker_link_id | bigint | NO | | FK to survey_honest_broker_links.id |
| preferred_channel | character varying | NO | `email` | Preferred delivery channel: `email`, `sms` |
| delivery_email | text | YES | | Encrypted delivery email address |
| delivery_phone | text | YES | | Encrypted delivery phone number |
| destination_hash | character varying | YES | | Hash of the delivery destination for deduplication |
| last_sent_at | timestamp | YES | | Timestamp of last outreach attempt |
| created_by | bigint | YES | | FK to users.id |
| updated_by | bigint | YES | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### survey_honest_broker_invitations

Individual invitation dispatch records with delivery status and one-time access tokens.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| survey_campaign_id | bigint | NO | | FK to survey_campaigns.id |
| survey_honest_broker_link_id | bigint | NO | | FK to survey_honest_broker_links.id |
| survey_honest_broker_contact_id | bigint | YES | | FK to survey_honest_broker_contacts.id |
| delivery_channel | character varying | NO | `email` | Delivery channel used for this invitation |
| destination_hash | character varying | NO | | Hash of destination (email/phone) for deduplication |
| one_time_token_hash | character varying | NO | | Hashed one-time access token for survey URL |
| token_last_four | character varying | NO | | Last 4 characters of token for display/audit |
| delivery_status | character varying | NO | `pending` | Status: `pending`, `sent`, `delivered`, `failed`, `bounced` |
| sent_at | timestamp | YES | | Timestamp when invitation was sent |
| opened_at | timestamp | YES | | Timestamp when invitation link was first opened |
| submitted_at | timestamp | YES | | Timestamp when survey was submitted |
| expires_at | timestamp | YES | | Token expiration timestamp |
| revoked_at | timestamp | YES | | Timestamp if token was revoked |
| last_error | text | YES | | Error detail for failed deliveries |
| message_subject | character varying | YES | | Email subject or SMS preview |
| created_by | bigint | YES | | FK to users.id |
| updated_by | bigint | YES | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### survey_honest_broker_audit_logs

Immutable audit trail for all honest broker operations for regulatory and privacy compliance.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| survey_campaign_id | bigint | YES | | FK to survey_campaigns.id |
| survey_honest_broker_link_id | bigint | YES | | FK to survey_honest_broker_links.id |
| survey_honest_broker_invitation_id | bigint | YES | | FK to survey_honest_broker_invitations.id |
| actor_id | bigint | YES | | FK to users.id — the honest broker performing the action |
| action | character varying | NO | | Action performed (e.g., `link_created`, `invitation_sent`, `identity_linked`) |
| metadata | json | YES | | Structured audit context |
| occurred_at | timestamp | NO | | Action timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 15. Commons Workspace

Real-time collaboration workspace: Slack-like channels, messaging, announcements, wiki, calls, and activity feeds for research teams.

### commons_channels

Communication channels, which may be public topic channels, private group channels, or study-linked channels.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Display name of the channel |
| slug | character varying | NO | | URL-safe unique slug |
| description | text | YES | | Channel purpose description |
| type | character varying | NO | `topic` | Channel type: `topic`, `private`, `direct`, `study` |
| visibility | character varying | NO | `public` | Visibility: `public` (visible to all), `private` (invite only) |
| study_id | bigint | YES | | FK to studies.id — for study-linked channels |
| created_by | bigint | NO | | FK to users.id — channel creator |
| archived_at | timestamp | YES | | Timestamp when channel was archived |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### commons_channel_members

Channel membership with role and notification preferences.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| channel_id | bigint | NO | | FK to commons_channels.id |
| user_id | bigint | NO | | FK to users.id |
| role | character varying | NO | `member` | Member role: `owner`, `admin`, `member` |
| notification_preference | character varying | NO | `mentions` | Notification setting: `all`, `mentions`, `none` |
| last_read_at | timestamp | YES | | Timestamp of last read message (for unread count calculation) |
| joined_at | timestamp | NO | now() | Membership join timestamp |

---

### commons_messages

Channel messages with threading support and soft deletion.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| channel_id | bigint | NO | | FK to commons_channels.id |
| user_id | bigint | NO | | FK to users.id — message author |
| parent_id | bigint | YES | | FK to commons_messages.id — parent message for thread replies |
| body | text | NO | | Raw message body (Markdown) |
| body_html | text | YES | | Rendered HTML for display |
| is_edited | boolean | NO | false | Whether message has been edited |
| edited_at | timestamp | YES | | Timestamp of last edit |
| deleted_at | timestamp | YES | | Soft delete timestamp (message body replaced with deletion notice) |
| created_at | timestamp | YES | | Message send timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| depth | smallint | NO | 0 | Thread depth (0 = top-level, 1 = reply, etc.) |

---

### commons_message_reactions

Emoji reactions to messages.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| message_id | bigint | NO | | FK to commons_messages.id |
| user_id | bigint | NO | | FK to users.id |
| emoji | character varying | NO | | Emoji character or shortcode |
| created_at | timestamp | NO | now() | Reaction timestamp |

---

### commons_attachments

Files attached to messages.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| message_id | bigint | NO | | FK to commons_messages.id |
| user_id | bigint | NO | | FK to users.id — uploader |
| original_name | character varying | NO | | Original filename |
| stored_path | character varying | NO | | Server storage path |
| mime_type | character varying | NO | | MIME type of the attachment |
| size_bytes | bigint | NO | | File size in bytes |
| created_at | timestamp | NO | now() | Upload timestamp |

---

### commons_pinned_messages

Messages pinned in channels for quick reference.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| channel_id | bigint | NO | | FK to commons_channels.id |
| message_id | bigint | NO | | FK to commons_messages.id |
| pinned_by | bigint | NO | | FK to users.id — who pinned the message |
| pinned_at | timestamp | NO | now() | Pin timestamp |

---

### commons_notifications

In-app notifications for channel events (mentions, replies, announcements).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| user_id | bigint | NO | | FK to users.id — recipient |
| type | character varying | NO | | Notification type (e.g., `mention`, `reply`, `announcement`, `review_request`) |
| title | character varying | NO | | Notification title |
| body | text | YES | | Notification body text |
| channel_id | bigint | YES | | FK to commons_channels.id |
| message_id | bigint | YES | | FK to commons_messages.id |
| actor_id | bigint | YES | | FK to users.id — user who triggered the notification |
| read_at | timestamp | YES | | Timestamp when notification was read |
| created_at | timestamp | YES | | Notification creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### commons_announcements

Broadcast announcements to channels or the whole workspace.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| channel_id | bigint | YES | | FK to commons_channels.id — NULL means workspace-wide |
| user_id | bigint | NO | | FK to users.id — announcement author |
| title | character varying | NO | | Announcement title |
| body | text | NO | | Announcement body (Markdown) |
| body_html | text | YES | | Rendered HTML |
| category | character varying | NO | `general` | Category: `general`, `maintenance`, `research`, `urgent` |
| is_pinned | boolean | NO | false | Whether announcement is pinned at the top |
| expires_at | timestamp | YES | | Optional expiration timestamp |
| created_at | timestamp | YES | | Creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### commons_announcement_bookmarks

User bookmarks for announcements.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| announcement_id | bigint | NO | | FK to commons_announcements.id |
| user_id | bigint | NO | | FK to users.id |
| created_at | timestamp | NO | now() | Bookmark creation timestamp |

---

### commons_calls

Video/audio call sessions initiated from channels.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| channel_id | bigint | NO | | FK to commons_channels.id |
| room_name | character varying | NO | | Call room identifier (used with WebRTC/Jitsi/LiveKit) |
| call_type | character varying | NO | `video` | Call type: `video`, `audio` |
| status | character varying | NO | `active` | Call status: `active`, `ended` |
| started_by | bigint | NO | | FK to users.id — call initiator |
| ended_by | bigint | YES | | FK to users.id — who ended the call |
| started_at | timestamp | NO | | Call start timestamp |
| ended_at | timestamp | YES | | Call end timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### commons_activities

Activity feed events for channels, capturing cross-platform actions (analyses started, cohorts created, etc.).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| channel_id | bigint | YES | | FK to commons_channels.id — NULL for workspace-wide activities |
| user_id | bigint | YES | | FK to users.id — actor |
| event_type | character varying | NO | | Event type (e.g., `cohort_created`, `analysis_completed`, `result_pinned`) |
| title | character varying | NO | | Activity title for display |
| description | text | YES | | Detailed description |
| referenceable_type | character varying | YES | | Polymorphic type of the referenced object |
| referenceable_id | bigint | YES | | PK of the referenced object |
| metadata | jsonb | YES | | Structured metadata for the activity |
| created_at | timestamp | NO | now() | Activity timestamp |

---

### commons_object_references

Structured references to Parthenon objects (cohorts, studies, analyses) embedded in messages.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| message_id | bigint | NO | | FK to commons_messages.id |
| referenceable_type | character varying | NO | | Model type of the referenced object |
| referenceable_id | bigint | NO | | PK of the referenced object |
| display_name | character varying | NO | | Display label for the reference |
| created_at | timestamp | NO | now() | Reference creation timestamp |

---

### commons_review_requests

Structured review requests attached to messages for peer review workflows.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| message_id | bigint | NO | | FK to commons_messages.id |
| channel_id | bigint | NO | | FK to commons_channels.id |
| requested_by | bigint | NO | | FK to users.id — requestor |
| reviewer_id | bigint | YES | | FK to users.id — assigned reviewer (NULL if open) |
| status | character varying | NO | `pending` | Review status: `pending`, `in_progress`, `approved`, `rejected` |
| comment | text | YES | | Reviewer comment |
| resolved_at | timestamp | YES | | Timestamp when review was resolved |
| created_at | timestamp | YES | | Request creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### commons_wiki_articles

Collaborative wiki articles for research team knowledge management.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| title | character varying | NO | | Article title |
| slug | character varying | NO | | URL-safe unique slug |
| body | text | NO | | Article body (Markdown) |
| body_html | text | YES | | Rendered HTML |
| tags | jsonb | NO | `[]` | JSON array of tag strings |
| created_by | bigint | NO | | FK to users.id — article creator |
| last_edited_by | bigint | YES | | FK to users.id — last editor |
| created_at | timestamp | YES | | Article creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### commons_wiki_revisions

Version history for wiki article edits.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| article_id | bigint | NO | | FK to commons_wiki_articles.id |
| body | text | NO | | Full article body at this revision |
| edited_by | bigint | NO | | FK to users.id |
| edit_summary | character varying | YES | | Short description of what changed |
| created_at | timestamp | NO | now() | Revision timestamp |

---

## 16. FHIR Integration

FHIR R4 connections, bulk export jobs, incremental sync runs, and CDM identity crosswalk tables for all resource types.

### fhir_connections

FHIR R4 server connections using SMART Backend Services (RFC 7521 JWT bearer) or direct auth.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| site_name | character varying | NO | | Human-readable site name |
| site_key | character varying | NO | | Short unique site identifier used in crosswalk tables |
| ehr_vendor | character varying | NO | `epic` | EHR vendor: `epic`, `cerner`, `azure_fhir`, `hapi`, `other` |
| fhir_base_url | character varying | NO | | FHIR R4 base URL |
| token_endpoint | character varying | NO | | OAuth2 token endpoint URL |
| client_id | character varying | NO | | SMART Backend Services client ID |
| private_key_pem | text | YES | | Encrypted RSA private key PEM for JWT signing |
| jwks_url | character varying | YES | | JWKS URL if using public key registration |
| scopes | character varying | NO | `system/*.read` | OAuth2 scopes to request |
| group_id | character varying | YES | | FHIR Group resource ID for bulk export scope restriction |
| export_resource_types | character varying | YES | | Comma-separated FHIR resource types to export |
| target_source_id | bigint | YES | | FK to sources.id — target CDM source for this FHIR feed |
| sync_config | json | YES | | Additional sync configuration options |
| is_active | boolean | NO | false | Whether this connection is currently active |
| incremental_enabled | boolean | NO | true | Whether incremental (_since) sync is enabled |
| last_sync_at | timestamp | YES | | Last successful sync timestamp |
| last_sync_status | character varying | YES | | Status of last sync run |
| last_sync_records | integer | NO | 0 | Number of records synced in last run |
| created_by | bigint | NO | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| auth_mode | character varying | NO | `smart_backend_services` | Authentication mode: `smart_backend_services`, `client_credentials`, `basic` |

---

### fhir_sync_runs

Individual FHIR bulk export sync run records tracking extraction and CDM writing metrics.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| fhir_connection_id | bigint | NO | | FK to fhir_connections.id |
| status | character varying | NO | `pending` | Status: `pending`, `exporting`, `downloading`, `mapping`, `writing`, `completed`, `failed` |
| export_url | character varying | YES | | FHIR $export operation kick-off URL |
| since_param | timestamp | YES | | The `_since` parameter used for incremental sync |
| resource_types | json | YES | | JSON array of resource types in this run |
| files_downloaded | integer | NO | 0 | Number of NDJSON files downloaded |
| records_extracted | integer | NO | 0 | Total FHIR resources extracted |
| records_mapped | integer | NO | 0 | Records successfully mapped to CDM |
| records_written | integer | NO | 0 | Records written to CDM schema |
| records_failed | integer | NO | 0 | Records that failed mapping or writing |
| mapping_coverage | numeric | YES | | Fraction of records successfully mapped (0.0–1.0) |
| error_message | text | YES | | Error detail if run failed |
| started_at | timestamp | YES | | Run start timestamp |
| finished_at | timestamp | YES | | Run completion timestamp |
| triggered_by | bigint | YES | | FK to users.id — NULL for scheduled runs |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| ingestion_project_id | bigint | YES | | FK to ingestion_projects.id |

---

### fhir_export_jobs

FHIR bulk export job tracking for export operations initiated from Parthenon.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | | UUID primary key |
| source_id | bigint | NO | | FK to sources.id |
| status | character varying | NO | `pending` | Export status: `pending`, `running`, `completed`, `failed` |
| resource_types | jsonb | NO | | JSON array of FHIR resource types to export |
| since | timestamp | YES | | `_since` parameter for incremental export |
| patient_ids | jsonb | YES | | JSON array of specific patient IDs to export |
| files | jsonb | YES | | JSON array of generated export file metadata |
| started_at | timestamp | YES | | Export start timestamp |
| finished_at | timestamp | YES | | Export completion timestamp |
| error_message | text | YES | | Error detail if export failed |
| user_id | bigint | NO | | FK to users.id — user who initiated the export |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### fhir_patient_crosswalk

Maps FHIR Patient resource IDs to OMOP person_id values per site.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| person_id | bigint | NO | auto | OMOP person_id (PK) |
| site_key | character varying | NO | | Site identifier matching fhir_connections.site_key |
| fhir_patient_id | character varying | NO | | FHIR Patient.id |
| mrn_hash | character varying | YES | | SHA-256 hash of the MRN for optional cross-site deduplication |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### fhir_encounter_crosswalk

Maps FHIR Encounter resource IDs to OMOP visit_occurrence_id values per site.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| visit_occurrence_id | bigint | NO | auto | OMOP visit_occurrence_id (PK) |
| site_key | character varying | NO | | Site identifier |
| fhir_encounter_id | character varying | NO | | FHIR Encounter.id |
| person_id | bigint | NO | | OMOP person_id for this encounter |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### fhir_provider_crosswalk

Maps FHIR Practitioner resource IDs to OMOP provider_id values.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| provider_id | bigint | NO | auto | OMOP provider_id (PK) |
| site_key | character varying | NO | | Site identifier |
| fhir_practitioner_id | character varying | NO | | FHIR Practitioner.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### fhir_caresite_crosswalk

Maps FHIR Organization resource IDs to OMOP care_site_id values.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| care_site_id | bigint | NO | auto | OMOP care_site_id (PK) |
| site_key | character varying | NO | | Site identifier |
| fhir_organization_id | character varying | NO | | FHIR Organization.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### fhir_location_crosswalk

Maps FHIR Location resource IDs to OMOP location_id values.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| location_id | bigint | NO | auto | OMOP location_id (PK) |
| site_key | character varying | NO | | Site identifier |
| fhir_location_id | character varying | NO | | FHIR Location.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### fhir_dedup_tracking

Content-hash-based deduplication tracker preventing duplicate CDM rows on incremental FHIR syncs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| site_key | character varying | NO | | Site identifier |
| fhir_resource_type | character varying | NO | | FHIR resource type (e.g., `Condition`, `MedicationRequest`) |
| fhir_resource_id | character varying | NO | | FHIR resource ID |
| cdm_table | character varying | NO | | CDM table where this resource was written |
| cdm_row_id | bigint | NO | | Row ID in the CDM table |
| content_hash | character varying | NO | | SHA-256 hash of the FHIR resource content for change detection |
| last_synced_at | timestamp | NO | | Last successful sync timestamp for this resource |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 17. Medical Imaging

DICOM study, series, and instance metadata with AI-derived features, quantitative measurements, response assessments, and PACS connection management.

### imaging_studies

DICOM study-level metadata, linked to OMOP person_id and a PACS connection via Orthanc.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| person_id | bigint | YES | | OMOP person_id (linked after patient matching) |
| study_instance_uid | character varying | NO | | DICOM Study Instance UID (globally unique) |
| accession_number | character varying | YES | | Radiology accession number |
| modality | character varying | YES | | Primary modality (e.g., `CT`, `MRI`, `PET`, `US`) |
| body_part_examined | character varying | YES | | DICOM body part examined attribute |
| study_description | character varying | YES | | DICOM study description |
| referring_physician | character varying | YES | | Referring physician name (de-identified where required) |
| study_date | date | YES | | Study acquisition date |
| num_series | integer | NO | 0 | Number of series in this study |
| num_images | integer | NO | 0 | Total number of images in this study |
| orthanc_study_id | character varying | YES | | Orthanc internal study UUID |
| wadors_uri | character varying | YES | | WADO-RS URI for fetching study via DICOMweb |
| status | character varying | NO | `indexed` | Processing status: `indexed`, `processing`, `ready`, `error` |
| image_occurrence_id | bigint | YES | | OMOP image_occurrence_id if written to CDM |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| patient_name_dicom | character varying | YES | | DICOM patient name (may be de-identified) |
| patient_id_dicom | character varying | YES | | DICOM patient ID |
| institution_name | character varying | YES | | DICOM institution name |
| file_dir | character varying | YES | | Local file directory path for direct file storage |

---

### imaging_series

DICOM series-level metadata within a study.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to imaging_studies.id |
| series_instance_uid | character varying | NO | | DICOM Series Instance UID |
| series_description | character varying | YES | | DICOM series description |
| modality | character varying | YES | | Series modality (may differ from study modality in multi-modality studies) |
| body_part_examined | character varying | YES | | DICOM body part examined |
| series_number | integer | YES | | DICOM series number |
| num_images | integer | NO | 0 | Number of images (instances) in this series |
| slice_thickness_mm | numeric | YES | | Slice thickness in millimeters |
| manufacturer | character varying | YES | | Scanner manufacturer |
| manufacturer_model | character varying | YES | | Scanner model name |
| orthanc_series_id | character varying | YES | | Orthanc internal series UUID |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| pixel_spacing | character varying | YES | | DICOM pixel spacing (row spacing\column spacing) |
| rows_x_cols | character varying | YES | | Image matrix dimensions (e.g., `512x512`) |
| kvp | character varying | YES | | Peak kilovoltage (CT) |
| file_dir | character varying | YES | | Local file directory path |

---

### imaging_instances

DICOM SOP instance (individual image) metadata.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to imaging_studies.id |
| series_id | bigint | NO | | FK to imaging_series.id |
| sop_instance_uid | character varying | NO | | DICOM SOP Instance UID (globally unique) |
| sop_class_uid | character varying | YES | | DICOM SOP Class UID identifying the image type |
| instance_number | integer | YES | | DICOM instance number (slice index) |
| slice_location | numeric | YES | | Z-axis slice location in mm |
| file_path | character varying | YES | | Local file path for direct file access |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### imaging_features

AI-derived or algorithmically extracted imaging features (radiomics, AI segmentation results).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to imaging_studies.id |
| source_id | bigint | NO | | FK to sources.id |
| person_id | bigint | YES | | OMOP person_id |
| feature_type | character varying | NO | | Feature category (e.g., `radiomic`, `semantic`, `segmentation`, `ai_score`) |
| algorithm_name | character varying | YES | | Name of algorithm or model that extracted this feature |
| algorithm_version | character varying | YES | | Algorithm/model version |
| feature_name | character varying | NO | | Feature name (e.g., `volume_ml`, `mean_hu`, `entropy`) |
| feature_source_value | character varying | YES | | Raw feature source value for ETL provenance |
| value_as_number | numeric | YES | | Numeric feature value |
| value_as_string | character varying | YES | | String feature value (for categorical features) |
| value_concept_id | bigint | YES | | OMOP concept_id for categorical feature values |
| unit_source_value | character varying | YES | | Measurement unit (e.g., `mL`, `HU`) |
| confidence | numeric | YES | | Algorithm confidence score for this feature |
| body_site | character varying | YES | | Anatomical body site |
| image_feature_id | bigint | YES | | OMOP image_feature_id if written to CDM |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### imaging_measurements

Quantitative radiological measurements (tumor dimensions, lesion sizes) used in response assessment.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| study_id | bigint | NO | | FK to imaging_studies.id |
| person_id | bigint | YES | | OMOP person_id |
| series_id | bigint | YES | | FK to imaging_series.id |
| measurement_type | character varying | NO | | Measurement type (e.g., `longest_diameter`, `volume`, `suv_max`) |
| measurement_name | character varying | NO | | Human-readable measurement name |
| value_as_number | numeric | NO | | Measurement value |
| unit | character varying | NO | | Measurement unit (e.g., `mm`, `mL`, `g/mL`) |
| body_site | character varying | YES | | Anatomical site measured |
| laterality | character varying | YES | | Laterality: `left`, `right`, `bilateral` |
| algorithm_name | character varying | YES | | Algorithm used for measurement |
| confidence | numeric | YES | | Measurement confidence |
| created_by | bigint | YES | | FK to users.id |
| measured_at | date | YES | | Date of measurement |
| is_target_lesion | boolean | NO | false | Whether this is a RECIST target lesion |
| target_lesion_number | integer | YES | | RECIST target lesion number (1-indexed) |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### imaging_response_assessments

Tumor response assessments per RECIST 1.1, iRECIST, or other criteria.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| person_id | bigint | NO | | OMOP person_id |
| criteria_type | character varying | NO | | Response criteria: `RECIST_1_1`, `iRECIST`, `WHO`, `Cheson`, `custom` |
| assessment_date | date | NO | | Date of this response assessment |
| body_site | character varying | YES | | Body site assessed |
| baseline_study_id | bigint | NO | | FK to imaging_studies.id — baseline imaging study |
| current_study_id | bigint | NO | | FK to imaging_studies.id — current imaging study |
| baseline_value | numeric | YES | | Baseline sum of target lesion diameters (mm) |
| nadir_value | numeric | YES | | Nadir (smallest recorded) sum of diameters (mm) |
| current_value | numeric | YES | | Current sum of target lesion diameters (mm) |
| percent_change_from_baseline | numeric | YES | | Percent change from baseline (negative = shrinkage) |
| percent_change_from_nadir | numeric | YES | | Percent change from nadir (positive = growth) |
| response_category | character varying | NO | | RECIST response: `CR`, `PR`, `SD`, `PD` |
| rationale | text | YES | | Reviewer rationale for the assessment |
| assessed_by | bigint | YES | | FK to users.id — radiologist or reviewer |
| is_confirmed | boolean | NO | false | Whether response has been confirmed by repeat imaging |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### imaging_cohort_criteria

Imaging-based cohort criteria definitions (e.g., include patients with specific modality/feature).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| created_by | bigint | NO | | FK to users.id |
| name | character varying | NO | | Criteria name |
| criteria_type | character varying | NO | | Criteria type (e.g., `modality`, `feature_threshold`, `response_category`) |
| criteria_definition | jsonb | NO | | JSON definition of the criteria logic |
| description | character varying | YES | | Criteria description |
| is_shared | boolean | NO | false | Whether this criteria is shared with all users |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### pacs_connections

PACS (Picture Archiving and Communication System) connection configurations for DICOM sources.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Connection display name |
| type | character varying | NO | | Connection type: `orthanc`, `dcm4chee`, `dimse`, `wado` |
| base_url | text | NO | | Base URL for the PACS server |
| auth_type | character varying | NO | `none` | Authentication type: `none`, `basic`, `bearer` |
| credentials | text | YES | | Encrypted credentials for this connection |
| is_default | boolean | NO | false | Whether this is the default PACS connection |
| is_active | boolean | NO | true | Whether this connection is active |
| source_id | bigint | YES | | FK to sources.id — associated CDM source |
| last_health_check_at | timestamp | YES | | Timestamp of last connectivity health check |
| last_health_status | character varying | YES | | Status of last health check: `ok`, `error` |
| metadata_cache | jsonb | YES | | Cached PACS metadata (supported features, modalities) |
| metadata_cached_at | timestamp | YES | | Timestamp when metadata was last cached |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 18. Genomics

Genomic variant uploads, OMOP-mapped variants, ClinVar reference data, variant-drug interactions, and cohort criteria.

### genomic_uploads

VCF or other genomic file upload records tracking processing status.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| created_by | bigint | NO | | FK to users.id — uploader |
| filename | character varying | NO | | Original filename |
| file_format | character varying | NO | | File format: `vcf`, `vcf.gz`, `tsv`, `maf` |
| file_size_bytes | bigint | NO | 0 | File size in bytes |
| status | character varying | NO | `pending` | Processing status: `pending`, `parsing`, `mapping`, `completed`, `failed` |
| genome_build | character varying | YES | | Reference genome build: `GRCh37`, `GRCh38` |
| sample_id | character varying | YES | | Sample identifier from the VCF |
| total_variants | integer | NO | 0 | Total variants in the file |
| mapped_variants | integer | NO | 0 | Variants successfully mapped to OMOP concepts |
| review_required | integer | NO | 0 | Variants flagged for manual review |
| error_message | text | YES | | Error detail if processing failed |
| storage_path | character varying | YES | | Server storage path |
| parsed_at | timestamp | YES | | Timestamp when parsing completed |
| imported_at | timestamp | YES | | Timestamp when variants were imported to CDM |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### genomic_variants

Individual genomic variant records with OMOP mapping and clinical annotation.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| upload_id | bigint | NO | | FK to genomic_uploads.id |
| source_id | bigint | NO | | FK to sources.id |
| person_id | bigint | YES | | OMOP person_id (linked after sample-patient matching) |
| sample_id | character varying | YES | | Sample identifier from the VCF header |
| chromosome | character varying | NO | | Chromosome (e.g., `chr1`, `chrX`) |
| position | bigint | NO | | Genomic position (1-based) |
| reference_allele | text | NO | | Reference allele sequence |
| alternate_allele | text | NO | | Alternate (variant) allele sequence |
| genome_build | character varying | YES | | Reference genome build |
| gene_symbol | character varying | YES | | HGNC gene symbol |
| hgvs_c | character varying | YES | | HGVS coding sequence notation (e.g., `c.1799T>A`) |
| hgvs_p | character varying | YES | | HGVS protein notation (e.g., `p.Val600Glu`) |
| variant_type | character varying | YES | | Variant type: `SNV`, `indel`, `CNV`, `structural` |
| variant_class | character varying | YES | | Variant class: `missense`, `nonsense`, `frameshift`, `splice_site` |
| consequence | character varying | YES | | VEP/Ensembl consequence annotation |
| quality | numeric | YES | | VCF QUAL score |
| filter_status | character varying | YES | | VCF FILTER field (e.g., `PASS`) |
| zygosity | character varying | YES | | Zygosity: `heterozygous`, `homozygous`, `hemizygous` |
| allele_frequency | numeric | YES | | Variant allele frequency (0.0–1.0) |
| read_depth | integer | YES | | Total sequencing read depth at this position |
| clinvar_id | character varying | YES | | ClinVar variation ID |
| clinvar_significance | character varying | YES | | ClinVar clinical significance |
| cosmic_id | character varying | YES | | COSMIC variant ID |
| tmb_contribution | numeric | YES | | Contribution to tumor mutational burden |
| is_msi_marker | boolean | NO | false | Whether this variant is a microsatellite instability marker |
| measurement_concept_id | bigint | NO | 0 | OMOP measurement_concept_id for the mapped variant |
| measurement_source_value | text | YES | | Source value for OMOP measurement mapping |
| value_as_concept_id | bigint | YES | | OMOP concept_id for the variant significance value |
| mapping_status | character varying | NO | `unmapped` | OMOP mapping status: `unmapped`, `mapped`, `review_required` |
| omop_measurement_id | bigint | YES | | OMOP measurement_id in CDM if written back |
| raw_info | jsonb | YES | | Raw VCF INFO field key-value pairs |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| clinvar_disease | text | YES | | ClinVar associated disease names |
| clinvar_review_status | character varying | YES | | ClinVar review status (e.g., `practice_guideline`, `reviewed_by_expert_panel`) |

---

### genomic_cohort_criteria

Genomic-based cohort criteria definitions (e.g., include patients with BRCA1 pathogenic variants).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| created_by | bigint | NO | | FK to users.id |
| name | character varying | NO | | Criteria name |
| criteria_type | character varying | NO | | Criteria type (e.g., `gene_variant`, `tmb_threshold`, `msi_status`) |
| criteria_definition | jsonb | NO | | JSON definition of the genomic criteria logic |
| description | character varying | YES | | Criteria description |
| is_shared | boolean | NO | false | Whether shared with all users |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### clinvar_variants

ClinVar reference variant database, synced periodically from NCBI.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| variation_id | character varying | YES | | ClinVar variation ID |
| rs_id | character varying | YES | | dbSNP rs ID |
| chromosome | character varying | NO | | Chromosome |
| position | bigint | NO | | Genomic position |
| reference_allele | character varying | NO | | Reference allele |
| alternate_allele | character varying | NO | | Alternate allele |
| genome_build | character varying | NO | `GRCh38` | Reference genome build |
| gene_symbol | character varying | YES | | Gene symbol |
| hgvs | character varying | YES | | HGVS notation |
| clinical_significance | character varying | YES | | ClinVar clinical significance classification |
| disease_name | text | YES | | Associated disease name(s) |
| review_status | character varying | YES | | ClinVar review status |
| is_pathogenic | boolean | NO | false | Whether classified as pathogenic or likely pathogenic |
| last_synced_at | timestamp | YES | | Timestamp of last sync from ClinVar |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### clinvar_sync_log

Tracking log for ClinVar database sync operations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| genome_build | character varying | NO | `GRCh38` | Genome build synced |
| papu_only | boolean | NO | false | Whether sync was limited to pathogenic/likely-pathogenic variants only |
| source_url | character varying | YES | | ClinVar FTP/API URL used |
| status | character varying | NO | `running` | Sync status: `running`, `completed`, `failed` |
| variants_inserted | integer | NO | 0 | New variants inserted |
| variants_updated | integer | NO | 0 | Existing variants updated |
| error_message | text | YES | | Error detail if sync failed |
| started_at | timestamp | YES | | Sync start timestamp |
| finished_at | timestamp | YES | | Sync completion timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### variant_drug_interactions

Pharmacogenomic variant-drug interaction reference data (e.g., BRAF V600E → vemurafenib sensitivity).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| gene_symbol | character varying | NO | | Gene symbol (e.g., `BRAF`, `KRAS`, `EGFR`) |
| hgvs_p | character varying | YES | | HGVS protein notation for specific variant |
| variant_class | character varying | YES | | Variant class (NULL means any variant in gene) |
| drug_concept_id | bigint | YES | | OMOP concept_id from vocab.concept for the drug |
| drug_name | character varying | NO | | Drug name |
| relationship | character varying | NO | | Pharmacogenomic relationship: `sensitivity`, `resistance`, `toxicity`, `dosing` |
| mechanism | text | YES | | Molecular mechanism description |
| evidence_level | character varying | NO | `clinical_trial` | Evidence level: `FDA_approved`, `clinical_trial`, `preclinical`, `case_report` |
| confidence | character varying | NO | `medium` | Confidence: `high`, `medium`, `low` |
| evidence_summary | text | YES | | Summary of supporting evidence |
| source_url | character varying | YES | | Reference source URL |
| is_active | boolean | NO | true | Whether this interaction is active |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 19. GIS & Geospatial

Geospatial boundary registry, import tracking, and OMOP-extended tables for environmental exposures and location history. PostGIS geometries live in the `gis` schema; these `app` tables provide metadata and import tracking.

### gis_boundary_levels

Registry of administrative boundary levels (e.g., state, county, census tract, ZIP code).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| code | character varying | NO | | Unique level code (e.g., `state`, `county`, `zcta`, `census_tract`) |
| label | character varying | NO | | Human-readable label |
| description | text | YES | | Description of this boundary type |
| sort_order | integer | NO | 0 | Display order |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### gis_imports

GIS data import job tracking for shapefile, GeoJSON, and CSV-with-coordinates ingestion.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| user_id | bigint | NO | | FK to users.id |
| filename | character varying | NO | | Uploaded filename |
| import_mode | character varying | NO | | Import mode: `shapefile`, `geojson`, `csv_geocode`, `census_auto` |
| status | character varying | NO | `pending` | Status: `pending`, `running`, `completed`, `failed` |
| column_mapping | jsonb | NO | `{}` | JSON map of source columns to GIS schema fields |
| abby_suggestions | jsonb | NO | `{}` | Abby AI column mapping suggestions |
| config | jsonb | NO | `{}` | Import configuration (coordinate system, precision, etc.) |
| summary_snapshot | jsonb | NO | `{}` | Post-import summary statistics |
| row_count | integer | YES | | Number of geographic features imported |
| progress_percentage | integer | NO | 0 | Import progress 0–100 |
| error_log | jsonb | NO | `[]` | JSON array of import errors |
| log_output | text | YES | | Full import log output |
| started_at | timestamp | YES | | Import start timestamp |
| completed_at | timestamp | YES | | Import completion timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### external_exposure

OMOP CDM extension table for environmental and social exposures (air quality, temperature, social determinants). Extends the CDM observation pattern for non-clinical exposures.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| external_exposure_id | bigint | NO | auto | Primary key |
| person_id | bigint | NO | | OMOP person_id |
| exposure_concept_id | bigint | NO | | OMOP concept_id for the exposure type (e.g., PM2.5, social vulnerability index) |
| exposure_start_date | date | NO | | Exposure period start date |
| exposure_end_date | date | YES | | Exposure period end date |
| value_as_number | double precision | YES | | Numeric exposure value |
| value_as_string | character varying | YES | | String exposure value |
| value_as_concept_id | bigint | YES | | OMOP concept_id for categorical exposure value |
| unit_source_value | character varying | YES | | Exposure unit (e.g., `µg/m³`, `index_score`) |
| unit_concept_id | bigint | YES | | OMOP concept_id for the unit |
| location_id | bigint | YES | | OMOP location_id for the exposure location |
| boundary_id | bigint | YES | | FK to gis.boundaries.id for spatial linkage |
| qualifier_concept_id | bigint | YES | | OMOP qualifier concept |
| exposure_type_concept_id | bigint | YES | | OMOP concept_id for the exposure type classification |
| exposure_source_concept_id | bigint | YES | | Source concept_id before standard mapping |
| exposure_source_value | character varying | YES | | Raw source value |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### location_history

OMOP CDM extension tracking temporal changes in entity location (supports patient residential history).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| location_history_id | bigint | NO | auto | Primary key |
| entity_id | bigint | NO | | ID of the entity (person_id, care_site_id, etc.) |
| domain_id | character varying | NO | | OMOP domain of the entity (e.g., `Person`, `Care Site`) |
| location_id | bigint | NO | | OMOP location_id |
| start_date | date | NO | | Date location record begins |
| end_date | date | YES | | Date location record ends (NULL if current) |
| relationship_type_concept_id | bigint | YES | | OMOP concept_id for the location relationship type |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 20. HEOR

Health Economics and Outcomes Research analyses: cost-effectiveness (CEA), budget impact, value-based contracts.

### heor_analyses

Top-level HEOR analysis definitions with perspective, time horizon, and cohort linkage.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| created_by | bigint | NO | | FK to users.id |
| source_id | bigint | YES | | FK to sources.id — CDM source for real-world data |
| name | character varying | NO | | Analysis name |
| analysis_type | character varying | NO | `cea` | Analysis type: `cea` (cost-effectiveness), `budget_impact`, `value_contract`, `roi` |
| description | text | YES | | Analysis purpose and scope |
| perspective | character varying | NO | `payer` | Analysis perspective: `payer`, `provider`, `societal`, `patient` |
| time_horizon | character varying | NO | `1_year` | Time horizon: `1_year`, `3_year`, `5_year`, `lifetime` |
| discount_rate | numeric | NO | 0.03 | Annual discount rate (3% standard) |
| currency | character varying | NO | `USD` | Currency code |
| target_cohort_id | integer | YES | | FK to cohort_definitions.id — intervention cohort |
| comparator_cohort_id | integer | YES | | FK to cohort_definitions.id — comparator cohort |
| status | character varying | NO | `draft` | Analysis status: `draft`, `running`, `completed`, `failed` |
| completed_at | timestamp | YES | | Analysis completion timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| deleted_at | timestamp | YES | | Soft delete timestamp |

---

### heor_scenarios

Analysis scenarios (base case and sensitivity scenarios) within an HEOR analysis.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| analysis_id | bigint | NO | | FK to heor_analyses.id |
| name | character varying | NO | | Scenario name |
| scenario_type | character varying | NO | `intervention` | Scenario type: `base_case`, `intervention`, `comparator`, `sensitivity` |
| description | text | YES | | Scenario description |
| parameter_overrides | jsonb | YES | | JSON map of parameter overrides for this scenario |
| is_base_case | boolean | NO | false | Whether this is the base case scenario |
| sort_order | integer | NO | 0 | Display order |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### heor_cost_parameters

Cost and utility parameters for HEOR analyses, with probabilistic sensitivity analysis ranges.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| analysis_id | bigint | NO | | FK to heor_analyses.id |
| scenario_id | bigint | YES | | FK to heor_scenarios.id — NULL means applies to all scenarios |
| parameter_name | character varying | NO | | Parameter name (e.g., `drug_cost_per_cycle`, `utility_responder`) |
| parameter_type | character varying | NO | | Parameter type: `cost`, `utility`, `probability`, `rate` |
| value | numeric | NO | | Point estimate |
| unit | character varying | YES | | Unit (e.g., `USD`, `QALY`, `per_month`) |
| lower_bound | numeric | YES | | Lower bound for probabilistic sensitivity analysis |
| upper_bound | numeric | YES | | Upper bound for probabilistic sensitivity analysis |
| distribution | character varying | YES | | Distribution for PSA: `gamma`, `beta`, `lognormal`, `normal` |
| omop_concept_id | integer | YES | | OMOP concept_id if parameter is linked to a clinical concept |
| source_reference | text | YES | | Citation or source for parameter value |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### heor_results

Computed HEOR analysis results including ICER, NMB, and budget impact.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| analysis_id | bigint | NO | | FK to heor_analyses.id |
| scenario_id | bigint | NO | | FK to heor_scenarios.id |
| total_cost | numeric | YES | | Total cost for the intervention arm |
| total_qalys | numeric | YES | | Total QALYs for the intervention arm |
| total_lys | numeric | YES | | Total life-years for the intervention arm |
| incremental_cost | numeric | YES | | Incremental cost vs. comparator |
| incremental_qalys | numeric | YES | | Incremental QALYs vs. comparator |
| icer | numeric | YES | | Incremental Cost-Effectiveness Ratio (cost per QALY) |
| net_monetary_benefit | numeric | YES | | Net Monetary Benefit at willingness-to-pay threshold |
| willingness_to_pay_threshold | numeric | YES | | WTP threshold used for NMB calculation |
| roi_percent | numeric | YES | | Return on investment percentage |
| payback_period_months | numeric | YES | | Payback period in months |
| budget_impact_year1 | numeric | YES | | Budget impact in year 1 |
| budget_impact_year3 | numeric | YES | | Cumulative budget impact through year 3 |
| budget_impact_year5 | numeric | YES | | Cumulative budget impact through year 5 |
| sensitivity_results | jsonb | YES | | One-way sensitivity analysis results |
| tornado_data | jsonb | YES | | Tornado diagram data (parameter, low, high impact) |
| cohort_size | integer | YES | | Patient cohort size used in this analysis |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### heor_scenarios

*(See above — listed once, referenced twice in this section)*

---

### heor_value_contracts

Value-based contract definitions linking clinical outcomes to pricing rebate tiers.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| analysis_id | bigint | NO | | FK to heor_analyses.id |
| created_by | bigint | NO | | FK to users.id |
| contract_name | character varying | NO | | Contract name |
| drug_name | character varying | YES | | Drug or therapy name |
| contract_type | character varying | NO | `outcomes_based` | Contract type: `outcomes_based`, `indication_based`, `volume_based` |
| outcome_metric | character varying | NO | | Primary outcome metric (e.g., `hba1c_reduction`, `readmission_rate`) |
| baseline_rate | numeric | YES | | Historical baseline rate for the outcome metric |
| rebate_tiers | jsonb | YES | | JSON array of threshold → rebate percentage tiers |
| list_price | numeric | YES | | List price per unit |
| net_price_floor | numeric | YES | | Minimum net price floor |
| measurement_period_months | integer | NO | 12 | Measurement period in months |
| status | character varying | NO | `draft` | Contract status: `draft`, `active`, `completed`, `terminated` |
| effective_date | timestamp | YES | | Contract effective date |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 21. Feasibility

Multi-source feasibility assessment for study planning, evaluating CDM coverage across data domains before full analysis commitment.

### feasibility_assessments

Feasibility assessment runs evaluating cohort criteria feasibility across multiple CDM sources.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Assessment name |
| criteria | jsonb | NO | | JSON assessment criteria (concept sets, domains, date ranges, patient thresholds) |
| sources_assessed | integer | NO | 0 | Number of CDM sources evaluated |
| sources_passed | integer | NO | 0 | Number of sources meeting all feasibility thresholds |
| created_by | bigint | NO | | FK to users.id |
| created_at | timestamp | NO | | Assessment creation/run timestamp |

---

### feasibility_assessment_results

Per-source results for each feasibility assessment, with domain-level pass/fail scores.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| assessment_id | bigint | NO | | FK to feasibility_assessments.id |
| source_id | bigint | NO | | FK to sources.id |
| domain_pass | boolean | NO | | Whether domain coverage passed |
| concept_pass | boolean | NO | | Whether required OMOP concepts are present |
| visit_pass | boolean | NO | | Whether visit volume meets threshold |
| date_pass | boolean | NO | | Whether data covers the required date range |
| patient_pass | boolean | NO | | Whether patient count meets minimum threshold |
| overall_pass | boolean | NO | | Whether all checks passed |
| details | jsonb | NO | `{}` | Detailed check results per domain |
| domain_score | smallint | NO | 0 | Domain coverage score 0–100 |
| concept_score | smallint | NO | 0 | Concept presence score 0–100 |
| visit_score | smallint | NO | 0 | Visit volume score 0–100 |
| date_score | smallint | NO | 0 | Date range score 0–100 |
| patient_score | smallint | NO | 0 | Patient count score 0–100 |
| composite_score | smallint | NO | 0 | Composite weighted feasibility score 0–100 |

---

### feasibility_templates

Reusable feasibility criteria templates for common study designs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Template name |
| description | character varying | YES | | Template description |
| criteria | json | NO | | JSON feasibility criteria definition |
| created_by | bigint | NO | | FK to users.id |
| is_public | boolean | NO | false | Whether visible to all users |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 22. Atlas Migration

Tools for migrating OHDSI Atlas/WebAPI cohort definitions, concept sets, and analyses into Parthenon.

### atlas_migrations

Atlas migration job records tracking the import of OHDSI Atlas entities into Parthenon.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| webapi_url | character varying | NO | | Source OHDSI WebAPI base URL |
| webapi_name | character varying | YES | | Human-readable name for the WebAPI source |
| auth_type | character varying | NO | `none` | WebAPI auth type: `none`, `db`, `ldap`, `ad` |
| auth_credentials | text | YES | | Encrypted WebAPI credentials |
| status | character varying | NO | `pending` | Migration status: `pending`, `discovery`, `importing`, `validating`, `completed`, `failed` |
| selected_entities | json | YES | | JSON array of entity types selected for import |
| discovery_results | json | YES | | JSON discovery scan results (available entities and counts) |
| import_results | json | YES | | JSON import results per entity type |
| validation_results | json | YES | | JSON post-import validation results |
| current_step | character varying | YES | | Current step name |
| total_entities | integer | NO | 0 | Total entities to import |
| imported_entities | integer | NO | 0 | Successfully imported entities |
| failed_entities | integer | NO | 0 | Failed entities |
| skipped_entities | integer | NO | 0 | Skipped entities (duplicates, errors) |
| error_message | text | YES | | Error detail |
| started_at | timestamp | YES | | Migration start timestamp |
| completed_at | timestamp | YES | | Migration completion timestamp |
| created_by | bigint | NO | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### atlas_id_mappings

Maps Atlas integer IDs to Parthenon entity IDs for referential integrity after migration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| migration_id | bigint | NO | | FK to atlas_migrations.id |
| entity_type | character varying | NO | | Entity type: `cohort_definition`, `concept_set`, `estimation_analysis`, etc. |
| atlas_id | integer | NO | | Original Atlas integer ID |
| parthenon_id | integer | YES | | Mapped Parthenon ID after import |
| atlas_name | character varying | NO | | Entity name in Atlas |
| status | character varying | NO | `pending` | Mapping status: `pending`, `mapped`, `failed`, `skipped` |
| error_message | text | YES | | Error if mapping failed |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### webapi_registries

Registered OHDSI WebAPI instances for federated operations and Atlas migration sources.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Registry display name |
| base_url | character varying | NO | | WebAPI base URL |
| auth_type | character varying | NO | `none` | Auth type: `none`, `db`, `ldap`, `ad`, `oidc` |
| auth_credentials | text | YES | | Encrypted auth credentials |
| is_active | boolean | NO | true | Whether this registry is active |
| last_synced_at | timestamp | YES | | Last synchronization timestamp |
| created_by | bigint | YES | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 23. Configuration & System

Application-level and system-level settings, AI provider configuration, auth provider settings, and feature flags.

### app_settings

Singleton application settings for the Parthenon installation.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| default_sql_dialect | character varying | NO | `postgresql` | Default SQL dialect for OHDSI SQL template rendering |
| updated_by | bigint | YES | | FK to users.id — last admin to update settings |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### system_settings

Key-value system configuration store with grouping and secret flagging.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| key | character varying | NO | | Unique setting key (e.g., `smtp.host`, `feature.genomics.enabled`) |
| value | text | YES | | Setting value (encrypted at rest when is_secret=true) |
| group | character varying | NO | `general` | Setting group for UI organization |
| is_secret | boolean | NO | false | Whether this value is sensitive and should be masked in UI |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### ai_provider_settings

AI provider configurations (Ollama, Anthropic, OpenAI) for Abby and other AI features.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| provider_type | character varying | NO | | Provider type: `ollama`, `anthropic`, `openai`, `azure_openai`, `google` |
| display_name | character varying | NO | | Display name |
| is_enabled | boolean | NO | false | Whether this provider is enabled |
| is_active | boolean | NO | false | Whether this is the currently active provider |
| model | character varying | NO | `''` | Model identifier (e.g., `medgemma`, `claude-sonnet-4-6`) |
| settings | text | YES | | Encrypted provider-specific settings (API keys, endpoints) |
| updated_by | bigint | YES | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### auth_provider_settings

External authentication provider configurations (LDAP, SAML, OIDC) for SSO integration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| provider_type | character varying | NO | | Provider type: `ldap`, `saml`, `oidc`, `google`, `github` |
| display_name | character varying | NO | | Display name shown on login page |
| is_enabled | boolean | NO | false | Whether this provider is enabled |
| priority | integer | NO | 0 | Display priority on login page (lower = higher priority) |
| settings | text | YES | | Encrypted provider-specific configuration |
| updated_by | bigint | YES | | FK to users.id |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### features

Laravel Pennant feature flags controlling feature availability by scope.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| name | character varying | NO | | Feature flag name |
| scope | character varying | NO | | Scope of the flag (e.g., `global`, user ID, role name) |
| value | text | NO | | Feature value (typically `true`/`false` serialized) |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 24. Analytics & Orchestration

FinnGen external analysis runs, Poseidon (Dagster) pipeline orchestration, query library, and OHDSI PhenotypeLibrary synchronization.

### finngen_runs

External analytics service runs (FinnGen, Cromwell, or other workflow services) tracking request/response lifecycle.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| service_name | character varying | NO | | External service name (e.g., `finngen`, `cromwell`) |
| status | character varying | NO | `ok` | Run status |
| source_id | bigint | NO | | FK to sources.id |
| submitted_by | bigint | YES | | FK to users.id |
| source_snapshot | jsonb | YES | | Snapshot of source configuration at submission time |
| request_payload | jsonb | YES | | Request payload sent to the external service |
| result_payload | jsonb | YES | | Result payload received from the service |
| runtime_payload | jsonb | YES | | Runtime diagnostics and logs |
| artifact_index | jsonb | YES | | Index of generated artifacts |
| submitted_at | timestamp | NO | now() | Submission timestamp |
| completed_at | timestamp | YES | | Completion timestamp |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| investigation_id | bigint | YES | | FK to investigations.id — associated investigation |

---

### poseidon_runs

Dagster pipeline run records from Poseidon, Parthenon's data orchestration engine.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| dagster_run_id | character varying | NO | | Dagster run UUID |
| source_id | bigint | YES | | FK to sources.id |
| schedule_id | bigint | YES | | FK to poseidon_schedules.id — if triggered by a schedule |
| run_type | character varying | NO | | Pipeline run type (e.g., `achilles`, `dqd`, `etl`, `full_refresh`) |
| status | character varying | NO | `pending` | Status: `pending`, `started`, `success`, `failure`, `canceled` |
| started_at | timestamp with time zone | YES | | Dagster run start timestamp |
| completed_at | timestamp with time zone | YES | | Dagster run completion timestamp |
| stats | jsonb | YES | | Run statistics (steps executed, duration, etc.) |
| error_message | text | YES | | Error detail for failed runs |
| triggered_by | character varying | NO | `manual` | Trigger source: `manual`, `schedule`, `sensor`, `api` |
| created_by | bigint | YES | | FK to users.id — NULL for automated runs |
| created_at | timestamp with time zone | YES | | Record creation timestamp |
| updated_at | timestamp with time zone | YES | | Last update timestamp |

---

### poseidon_schedules

Scheduled Dagster job configurations for automated pipeline execution.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | NO | | FK to sources.id |
| schedule_type | character varying | NO | `manual` | Schedule type: `manual`, `cron`, `sensor` |
| cron_expr | character varying | YES | | Cron expression for scheduled runs (e.g., `0 2 * * 0`) |
| sensor_config | jsonb | YES | | Dagster sensor configuration for event-driven triggers |
| is_active | boolean | NO | false | Whether this schedule is active |
| dbt_selector | character varying | YES | | dbt node selector string for selective pipeline execution |
| last_run_at | timestamp with time zone | YES | | Timestamp of last triggered run |
| next_run_at | timestamp with time zone | YES | | Computed next run time |
| created_by | bigint | YES | | FK to users.id |
| created_at | timestamp with time zone | YES | | Record creation timestamp |
| updated_at | timestamp with time zone | YES | | Last update timestamp |
| deleted_at | timestamp with time zone | YES | | Soft delete timestamp |

---

### query_library_entries

Curated OHDSI SQL query templates for common clinical questions, usable by Abby and the Query Library UI.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| slug | character varying | NO | | URL-safe unique identifier |
| name | character varying | NO | | Query name |
| domain | character varying | NO | | Clinical domain (e.g., `condition`, `drug`, `measurement`) |
| category | character varying | NO | | Query category (e.g., `prevalence`, `trend`, `distribution`) |
| summary | character varying | NO | | One-line description |
| description | text | YES | | Detailed description and usage guidance |
| sql_template | text | NO | | OHDSI SQL template with `{@parameter}` placeholders |
| parameters_json | json | YES | | JSON array of template parameter definitions |
| tags_json | json | YES | | JSON array of searchable tags |
| example_questions_json | json | YES | | JSON array of example natural language questions this query answers |
| template_language | character varying | NO | `ohdsi_sql` | Template language: `ohdsi_sql`, `postgresql`, `sql_render` |
| is_aggregate | boolean | NO | false | Whether this query returns aggregated (non-patient-level) results |
| safety | character varying | NO | `safe` | Safety classification: `safe` (no PHI), `restricted` (PHI possible) |
| source | character varying | NO | `parthenon_curated` | Query source: `parthenon_curated`, `ohdsi_community`, `user_contributed` |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

### phenotype_library

Synchronized OHDSI PhenotypeLibrary cohort definitions (1,100+ validated phenotypes).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| cohort_id | integer | NO | | OHDSI PhenotypeLibrary cohort ID (external ID) |
| cohort_name | character varying | NO | | Phenotype name from the OHDSI library |
| description | text | YES | | Phenotype description |
| expression_json | json | YES | | Circe cohort definition JSON from OHDSI PhenotypeLibrary |
| logic_description | character varying | YES | | Plain-language logic description |
| tags | json | YES | | JSON array of clinical tags |
| domain | character varying | YES | | Clinical domain (e.g., `cardiovascular`, `oncology`) |
| severity | character varying | YES | | Condition severity classification |
| is_imported | boolean | NO | false | Whether this phenotype has been imported as a local cohort_definition |
| imported_cohort_id | bigint | YES | | FK to cohort_definitions.id — the local copy if imported |
| created_at | timestamp | YES | | Record creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |

---

## 25. Audit & Logging

Design audit logs, chart annotations, and JupyterHub access audit logs.

### design_audit_log

Immutable audit trail for all create/update/delete operations on research design entities (cohorts, analyses, studies).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| entity_type | character varying | NO | | Entity type (e.g., `cohort_definition`, `estimation_analysis`) |
| entity_id | bigint | NO | | PK of the affected entity |
| entity_name | character varying | NO | | Name of the entity at time of action |
| action | character varying | NO | | Action: `created`, `updated`, `deleted`, `restored` |
| actor_id | bigint | YES | | FK to users.id — NULL for system actions |
| actor_email | character varying | YES | | Denormalized actor email for audit readability |
| old_json | jsonb | YES | | Full JSON snapshot before the change |
| new_json | jsonb | YES | | Full JSON snapshot after the change |
| changed_fields | jsonb | YES | | JSON array of field names that changed |
| ip_address | character varying | YES | | Client IP address |
| created_at | timestamp | NO | now() | Audit event timestamp |

---

### chart_annotations

User-added annotations to Achilles/results charts for data notes and observations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| source_id | bigint | YES | | FK to sources.id |
| chart_type | character varying | NO | | Chart type identifier (e.g., `achilles_histogram`, `dqd_trend`) |
| chart_context | jsonb | NO | `{}` | Chart context identifying the specific chart (analysis_id, concept_id, etc.) |
| x_value | character varying | NO | | X-axis value at the annotation point |
| y_value | double precision | YES | | Y-axis value at the annotation point |
| annotation_text | text | NO | | Annotation content |
| created_by | bigint | NO | | FK to users.id |
| created_at | timestamp | YES | | Annotation creation timestamp |
| updated_at | timestamp | YES | | Last update timestamp |
| tag | character varying | YES | | Optional category tag for filtering annotations |
| parent_id | bigint | YES | | FK to chart_annotations.id — for threaded annotation replies |

---

### jupyter_audit_log

Access audit log for JupyterHub sessions, tracking notebook launches and authentication events.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| user_id | bigint | YES | | FK to users.id — NULL for unauthenticated events (auth failures) |
| event | character varying | NO | | Event type (e.g., `server.start`, `server.stop`, `auth.success`, `auth.failure`) |
| metadata | jsonb | NO | `{}` | Structured event metadata (server name, spawn parameters, etc.) |
| ip_address | inet | YES | | Client IP address |
| created_at | timestamp with time zone | NO | now() | Event timestamp |

---

### jupyter_audit_log_archive

Archive partition of jupyter_audit_log for older records (rotated periodically for performance).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| user_id | bigint | YES | | FK to users.id |
| event | character varying | NO | | Event type |
| metadata | jsonb | NO | `{}` | Structured event metadata |
| ip_address | inet | YES | | Client IP address |
| created_at | timestamp with time zone | NO | | Event timestamp |

---

## 26. Laravel Framework

Internal Laravel framework tables. Not application data — used by Laravel internals for migrations, caching, job queuing, and batch processing.

### migrations

Laravel migration tracking table recording which migrations have been applied.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | auto | Primary key |
| migration | character varying | NO | | Migration filename (e.g., `2024_01_01_000000_create_users_table`) |
| batch | integer | NO | | Batch number grouping migrations run together |

---

### cache

Laravel cache driver table for database-backed caching.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| key | character varying | NO | | Unique cache key |
| value | text | NO | | Serialized cached value |
| expiration | integer | NO | | Unix timestamp of cache expiration |

---

### cache_locks

Laravel atomic lock driver table for distributed locking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| key | character varying | NO | | Lock key |
| owner | character varying | NO | | Lock owner token |
| expiration | integer | NO | | Lock expiration as Unix timestamp |

---

### jobs

Laravel Horizon/queue jobs table for queued job payloads.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| queue | character varying | NO | | Queue name (e.g., `default`, `high`, `low`) |
| payload | text | NO | | Serialized job payload |
| attempts | smallint | NO | | Number of times this job has been attempted |
| reserved_at | integer | YES | | Unix timestamp when worker reserved this job |
| available_at | integer | NO | | Unix timestamp when job becomes available |
| created_at | integer | NO | | Unix timestamp of job creation |

---

### job_batches

Laravel job batch tracking for Bus::batch() grouped jobs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | | Unique batch UUID |
| name | character varying | NO | | Human-readable batch name |
| total_jobs | integer | NO | | Total jobs in this batch |
| pending_jobs | integer | NO | | Jobs remaining to process |
| failed_jobs | integer | NO | | Failed jobs count |
| failed_job_ids | text | NO | | Serialized array of failed job IDs |
| options | text | YES | | Serialized batch options |
| cancelled_at | integer | YES | | Unix timestamp if batch was cancelled |
| created_at | integer | NO | | Unix timestamp of batch creation |
| finished_at | integer | YES | | Unix timestamp when batch finished |

---

### failed_jobs

Failed job archive for inspection and retry.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | auto | Primary key |
| uuid | character varying | NO | | Unique job UUID for idempotency |
| connection | text | NO | | Queue connection name |
| queue | text | NO | | Queue name where job failed |
| payload | text | NO | | Serialized job payload |
| exception | text | NO | | Full PHP exception stack trace |
| failed_at | timestamp | NO | now() | Failure timestamp |

---

*End of Data Dictionary — `app` schema, Parthenon v1.x*

*Generated: 2026-04-02 | ~160 tables | ~1,500 columns | OMOP CDM v5.4 platform*
