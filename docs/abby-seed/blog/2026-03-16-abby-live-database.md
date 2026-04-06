---
slug: abby-live-database-tools
title: "Abby Gets Database Access: 8 Live Query Tools for Real-Time Platform Awareness"
authors: [mudoshi, claude]
tags: [development, ai, abby, database, postgresql, ohdsi, cohort, concept-sets]
date: 2026-03-16
---

Abby can now answer "What concept sets do we have for diabetes?" and "How many patients are in our CDM?" with real data — queried live from the Parthenon PostgreSQL database at response time. Eight contextual tools give her awareness of concept sets, cohort definitions, vocabulary concepts, Achilles characterization stats, data quality results, cohort generation counts, CDM summaries, and analysis executions.

<!-- truncate -->

<div style={{borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem'}}>
  <img src="/docs/img/Abby-AI.png" alt="Abby AI assistant" style={{width: '100%', display: 'block'}} />
</div>

---

## The Problem: An Assistant Disconnected from Her Own Platform

Even after the RAG overhaul gave Abby grounded responses from the knowledge base, she had a fundamental blind spot: she couldn't see what was actually in the Parthenon instance she was supposed to be helping with.

Ask "What concept sets do we have for diabetes?" and she'd either hallucinate names or give generic OHDSI methodology advice. She had 167,000 vectors of medical literature but zero awareness of the 79 concept sets, 25 cohort definitions, and 1,005,787 patients sitting in the database right next to her.

---

## The Solution: Intent-Routed Live SQL Tools

We added a third context enrichment step to Abby's pipeline — between ChromaDB RAG retrieval and page data injection:

```
1. Help knowledge    (static, page-specific docs)
2. RAG retrieval     (ChromaDB semantic search — 167K vectors)
3. Live database     (real-time PostgreSQL queries) ← NEW
4. Page data         (entity-specific frontend context)
```

The key design constraint: **only query the database when the message needs it**. General questions like "What is OMOP?" should never touch PostgreSQL. The context window is precious — every unnecessary token reduces response quality.

### Intent Detection

Each of the 8 tools has its own set of regex patterns. Only matching tools fire:

| Tool | Triggers On | Example Query |
|------|------------|---------------|
| `search_concept_sets` | "concept set", "what do we have defined" | "What concept sets exist for diabetes?" |
| `list_cohort_definitions` | "cohort", "cohort definition" | "List all our cohort definitions" |
| `query_vocabulary` | "SNOMED", "RxNorm", "search concept" | "Find LOINC codes for hemoglobin" |
| `get_achilles_stats` | "how many patients", "top conditions", "prevalence" | "How many patients have diabetes?" |
| `get_dqd_summary` | "data quality", "DQD" | "How's our data quality?" |
| `get_cohort_counts` | "how many patients matched", "cohort count" | "How many patients in our T2DM cohort?" |
| `get_cdm_summary` | "database", "data source", "how big" | "What databases do we have loaded?" |
| `get_analyses` | "analysis", "study", "estimation" | "What studies are we running?" |

A message like "What is OMOP CDM?" matches zero patterns — no SQL is executed, no tokens are consumed.

---

## The 8 Tools

### 1. Search Concept Sets

Queries `app.concept_sets` joined to `app.concept_set_items` and `omop.concept` to show actual OMOP concept names:

```
User: "What concept sets do we have for diabetes?"

Abby sees:
- **Type 2 Diabetes Conditions** (ID: 55, 3 concepts)
  Includes: Diabetic - poor control, Type 2 diabetes mellitus,
  Type 2 diabetes mellitus without complication
- **HbA1c Lab Tests** (ID: 56, 3 concepts)
  Includes: Hemoglobin A1c/Hemoglobin.total in Blood, ...
```

### 2. List Cohort Definitions (with Patient Counts)

Queries `app.cohort_definitions` with a lateral join to `app.cohort_generations` for the latest generation status and patient count:

```
User: "What cohorts do we have and how many patients matched?"

Abby sees:
- **Post-MI New-User Aspirin Monotherapy** (ID: 276, v1, 57,022 patients matched)
- **Type 2 Diabetes Mellitus** (ID: 13, v1, generation: queued)
```

### 3. Query Vocabulary

Searches `omop.concept` for standard concepts matching keywords, returning concept ID, domain, vocabulary, and class:

```
User: "Find SNOMED concepts for heart failure"

Abby sees:
- **Heart failure** (ID: 316139, Condition, SNOMED, Clinical Finding)
- **Congestive heart failure** (ID: 319835, Condition, SNOMED, Clinical Finding)
```

### 4. Achilles Stats

Queries `achilles_results.achilles_results` for CDM characterization — total persons, top conditions by record count, top drugs, and keyword-specific prevalence:

```
User: "How many patients have diabetes in our database?"

Abby sees:
CDM Summary: 1,005,787 total persons
Records matching 'diabetes':
- Type 2 diabetes mellitus (Condition): 134,155 records
- Diabetic - poor control (Condition): 21,598 records
```

### 5. DQD Summary

Queries data quality check results for top violations — so Abby can answer "How's our data quality?" with specific failed checks.

### 6. CDM Summary

Combines data sources, person count, domain record counts (from Achilles), and vocabulary statistics into a single overview:

```
User: "Give me an overview of our database"

Abby sees:
Data Sources:
- **Eunomia (demo)** (key: EUNOMIA)
- **OHDSI Acumenus CDM** (key: ACUMENUS)

Total Persons in CDM: 1,005,787

Domain Record Counts:
- Drug Exposures: 2,345,678
- Conditions: 1,234,567
- Procedures: 876,543
```

### 7. Get Analyses

Lists analysis executions with type and status from `app.analysis_executions`.

### 8. Broad Search

A catch-all for existence questions like "Do we have anything for hypertension?" that triggers concept sets + cohort definitions + analyses simultaneously.

---

## Architecture

The implementation is a single Python module (`ai/app/chroma/live_context.py`) with:

- **Intent router**: Regex patterns map message content to tool functions
- **Keyword extractor**: Strips filler words, keeps clinical terms for ILIKE matching
- **8 tool functions**: Each executes parameterized SQL and formats results as markdown
- **Connection pooling**: SQLAlchemy engine with pool_size=3, pre-ping
- **Graceful degradation**: Each tool catches exceptions independently; a failing table doesn't block other tools

All queries are read-only (SELECT only), parameterized (no SQL injection), and limited (LIMIT 10-25 rows per tool).

---

## Results

| Query | Tools Fired | Response Time | Data Returned |
|-------|------------|---------------|---------------|
| "What concept sets for diabetes?" | concept_sets | 10.4s | 6 real concept sets with OMOP names |
| "How many patients in our database?" | achilles, cdm_summary | 4.7s | "1,005,787 persons" |
| "What cohorts with patient counts?" | cohort_definitions | 14.1s | Real cohorts with generation counts |
| "What is OMOP CDM?" | (none) | 1.6s | No DB query — clean context window |

The intent detection correctly routes:
- Clinical/platform questions → live SQL tools
- General knowledge questions → RAG only (no DB overhead)

---

## What's Next

The current tools use keyword-based ILIKE matching. Future iterations could:

- **Expand to concept set descendants** — "This set includes 47 descendant concepts via the OMOP hierarchy"
- **Add Achilles temporal analysis** — "Diabetes prevalence increased 12% from 2018-2022"
- **Wire in text-to-SQL** — for arbitrary analytical questions the 8 tools don't cover
- **Add phenotype library search** — query the 1,100+ OHDSI phenotype definitions
