# OMOP on FHIR: Landscape Research — March 2026

## Executive Summary

The OMOP-FHIR interoperability space has matured significantly through 2025–2026, converging around a handful of serious efforts. The most consequential milestone is the **HL7/Vulcan FHIR-to-OMOP Implementation Guide (IG)**, which went to formal HL7 ballot in September 2025 — the first standards-track attempt to codify transformation rules between these two dominant health data paradigms. Alongside the IG, several production-grade codebases exist for both directions of transformation (FHIR→OMOP and OMOP→FHIR), with Georgia Tech's **OMOPonFHIR** server and NACHC-CAD's **fhir-to-omop** Java toolkit being the most mature and actively maintained.

Despite this progress, no single turnkey solution exists. Each implementation addresses a different slice of the problem — some are FHIR servers exposing OMOP data, others are ETL pipelines ingesting FHIR into OMOP warehouses, and still others are reference architectures for digital quality measurement. This document catalogs the major efforts, their maturity, and their relevance to Parthenon.

---

## 1. The HL7/Vulcan FHIR-to-OMOP Implementation Guide

**Status:** v1.0.0-ballot released July 30, 2025; HL7 ballot cycle September 2025
**Repository:** [HL7/fhir-omop-ig](https://github.com/HL7/fhir-omop-ig) — 499 commits, 15 stars
**CI Build:** [build.fhir.org/ig/HL7/fhir-omop-ig](https://build.fhir.org/ig/HL7/fhir-omop-ig/)
**Vulcan Project Page:** [hl7vulcan.org/projects/fhir-to-omop](https://hl7vulcan.org/projects/fhir-to-omop/)

This is the single most important effort in the space. Jointly developed by the OHDSI community and HL7's Vulcan FHIR Accelerator, it aims to be the authoritative reference for how to transform data between FHIR and OMOP CDM.

### What the IG Contains

- **Narrative guidance** drawn from experienced ETL developers on mapping principles, common pitfalls, and best practices.
- **Concept mapping principles** — detailed patterns for how FHIR CodeableConcepts, codings, and value sets align with OMOP standard concepts, source concepts, and the vocabulary tables.
- **FHIR Logical Models** representing OMOP CDM tables — these allow FHIR tooling (validators, structure map engines) to understand OMOP's schema.
- **Machine-readable Structure Maps** for transformations between FHIR resources and OMOP tables.
- **Mappings from core FHIR IGs** including International Patient Access (IPA), US Core, and International Patient Summary (IPS) to their relevant OMOP domains.
- **Guidance for Echidna Terminology Server API** — critical for vocabulary/concept mapping during transformation.

### Scope and Limitations

The IG is intentionally a "foundational primer." It covers the common core of EHR data (demographics, encounters, conditions, medications, observations, procedures) but does not attempt to map every FHIR resource or every OMOP domain. It addresses FHIR→OMOP as the primary direction, with OMOP→FHIR as a secondary concern.

### Relevance to Parthenon

This IG should be Parthenon's canonical reference for any FHIR-to-OMOP ingestion pipeline. The Structure Maps and Logical Models could potentially be consumed by a FHIR structure map engine to automate portions of the ETL. The vocabulary mapping guidance directly applies to how Parthenon's `vocab` schema relates to incoming FHIR coded data.

---

## 2. OMOPonFHIR (Georgia Tech / GTRI)

**Direction:** OMOP → FHIR (read/write FHIR server backed by OMOP CDM)
**Website:** [omoponfhir.org](https://omoponfhir.org/)
**GitHub Org:** [github.com/omoponfhir](https://github.com/omoponfhir)
**Funding:** NIH/NCATS (award UL1TR002378)
**License:** Apache 2.0
**Maturity:** High — the most established OMOP-backed FHIR server

### Architecture

OMOPonFHIR is a **Java-based FHIR server** built on HAPI FHIR libraries that sits on top of an OMOP CDM database. It translates standard FHIR REST queries into SQL against OMOP tables and returns proper FHIR resources. It also supports write operations — posting FHIR resources that get transformed and written into OMOP tables.

Key architectural properties:

- **Bidirectional:** Supports both read (OMOP→FHIR) and write (FHIR→OMOP) operations.
- **FHIR versions:** DSTU2, STU3, R4.
- **OMOP CDM versions:** v5.3.1, v5.4, v6.0.
- **Database-agnostic:** Uses OHDSI's SQLRender for SQL dialect translation (PostgreSQL, SQL Server, etc.).
- **Containerized:** Docker-based deployment for both native and cloud environments.
- **SMART on FHIR compatible:** Can integrate with SMART apps, CQL engines, and Atlas.

### Key Repositories (as of early 2026)

| Repository | Purpose | Last Updated |
|---|---|---|
| `omoponfhir-main-v54-r4` | Main server: OMOP v5.4 + FHIR R4 | Jun 2025 |
| `omoponfhir-omopv5-sql` | SQLRender database layer | Jan 2026 |
| `omoponfhir-omopv5-r4-mapping` | OMOP v5 ↔ FHIR R4 mapping layer | Jun 2025 |
| `omoponfhir-r4-server` | FHIR R4 server component | Jun 2025 |
| `omoponfhir-omopv5-jpabase` | JPA base framework | Apr 2023 |

### Relevance to Parthenon

OMOPonFHIR is the most direct path to exposing Parthenon's OMOP data as a standard FHIR API. Since Parthenon already runs OMOP CDM v5.4 on PostgreSQL, the `omoponfhir-main-v54-r4` repository is a near-exact fit. This would enable SMART on FHIR app integration, CQL-based quality measurement, and standards-based data exchange — all reading directly from Parthenon's existing schemas. The existing `fhir-to-cdm` Docker service in Parthenon could potentially be replaced or augmented with OMOPonFHIR.

---

## 3. NACHC-CAD fhir-to-omop

**Direction:** FHIR → OMOP (ETL toolkit)
**Repository:** [github.com/NACHC-CAD/fhir-to-omop](https://github.com/NACHC-CAD/fhir-to-omop)
**Language:** Java (98.3%)
**License:** Apache 2.0
**Commits:** 1,013 | **Releases:** 23 (latest v1.7.053, July 2024)
**Maturity:** High — actively developed, well-documented, production-tested

### What It Does

This is the most feature-complete open-source FHIR→OMOP ETL toolkit. It goes beyond simple resource mapping to provide a full suite of tools:

- **FHIR Patient/$everything parsing** — ingests complete patient bundles.
- **Terminology mapping** — maps FHIR codes/terminologies to OMOP standard concepts using the vocabulary tables.
- **Full OMOP instance creation** — can create an entire OMOP CDM instance from scratch, including populating vocabulary tables.
- **Bulk server ingestion** — can pull and process the entire contents of a FHIR Patient server.
- **Parallelized writing** — multi-threaded write to OMOP database.
- **Database support:** MS SQL Server (primary), PostgreSQL (added recently).

### Documentation

Comprehensive documentation site with getting-started guides, tool listings, and architecture descriptions at [nachc-cad.github.io/fhir-to-omop](https://nachc-cad.github.io/fhir-to-omop/pages/navbar/getting-started/list-of-tools/ListOfTools.html).

### Relevance to Parthenon

This is the strongest candidate for a FHIR ingestion pipeline feeding into Parthenon's OMOP CDM. Its support for Patient/$everything bundles and bulk server ingestion aligns well with health information network (HIN) data acquisition patterns. The recent PostgreSQL support makes it directly compatible with Parthenon's database. Its Java implementation could run as a sidecar service similar to existing Docker services.

---

## 4. OHDSI/FhirToCdm

**Direction:** FHIR → OMOP (batch conversion)
**Repository:** [github.com/OHDSI/FhirToCdm](https://github.com/OHDSI/FhirToCdm)
**Language:** C# (.NET Core)
**License:** Apache 2.0
**Stars:** 19 | **Commits:** 15
**Maturity:** Low — minimal activity, sparse documentation

### What It Does

A .NET Core console application that reads FHIR files and produces tab-delimited CSV files organized by OMOP CDM table. Supports CDM v5.2, v5.3, and v6.0. Can load via ODBC to PostgreSQL, MySQL, or SQL Server.

### Assessment

This is OHDSI's official FHIR-to-CDM converter, but it has seen minimal development (15 commits total, no open issues or PRs). The CSV-output approach is simple but less sophisticated than NACHC-CAD's direct database integration. Useful as a reference for mapping logic but not production-ready for high-volume or real-time use cases.

---

## 5. ETL-German-FHIR-Core (MIRACUM Consortium)

**Direction:** FHIR → OMOP (incremental ETL)
**Repository:** [github.com/OHDSI/ETL-German-FHIR-Core](https://github.com/OHDSI/ETL-German-FHIR-Core)
**Context:** German Medical Informatics Initiative (MII) / MIRACUM Consortium
**Maturity:** High — deployed at 10 German university hospitals
**Publication:** [JMIR Medical Informatics 2023](https://medinform.jmir.org/2023/1/e47310)

### What It Does

An ETL process that transforms German FHIR Core profiles into OMOP CDM. It supports both bulk loading and **incremental loading** — a critical feature for ongoing data synchronization that most other tools lack.

### Key Achievements

- Tested with 392,022 FHIR resources; ETL execution completed in approximately one minute.
- 99% conformance to OMOP CDM.
- Successfully integrated at all 10 MIRACUM consortium university hospitals.
- Designed for the European regulatory context (DARWIN EU / EMA).

### Relevance to Parthenon

The incremental loading pattern is extremely relevant — Parthenon needs ongoing synchronization, not just one-time bulk loads. However, the ETL is tuned to the German MII FHIR Core profiles rather than US Core, so the FHIR profile mappings would need adaptation. The architecture and incremental approach are worth studying regardless.

---

## 6. MENDS-on-FHIR (CDC Chronic Disease Surveillance)

**Direction:** OMOP → FHIR (public health reporting pipeline)
**Repository:** [github.com/CU-DBMI/mends-on-fhir](https://github.com/CU-DBMI/mends-on-fhir)
**Funding:** CDC
**Publication:** [JAMIA Open 2024](https://academic.oup.com/jamiaopen/article/7/2/ooae045/7685048)
**Maturity:** Research-grade, demonstrated at production scale

### What It Does

MENDS-on-FHIR is a CDC-funded pilot that replaced custom institution-specific ETL routines with a standards-based pipeline: OMOP CDM → FHIR R4/US Core → Bulk FHIR $export → MENDS surveillance database.

Key technical details:

- **Transformation engine:** Google's Whistle (JSON-to-JSON transformation language) for OMOP→FHIR conversion.
- **Output:** FHIR R4 v4.0.1 / US Core IG v4.0.0 conformant resources.
- **Scale:** 1.13 trillion resources extracted and inserted.
- **Validation:** Less than 1% non-compliance rate.
- **Transport:** REST-based Bulk FHIR $export.

### Relevance to Parthenon

This demonstrates the OMOP→FHIR direction at serious scale, which is the complement to Parthenon's FHIR ingestion needs. The Whistle transformation language and Bulk FHIR patterns could inform how Parthenon exports data for public health reporting or federated research networks. The validation approach (< 1% non-compliance) sets a benchmark.

---

## 7. HL7 FHIR-Reasoning OMOP Reference Implementation

**Direction:** Bidirectional (OMOP ↔ FHIR for Digital Quality Measures)
**Repository:** [github.com/HL7/fhir-reasoning-omop-ri](https://github.com/HL7/fhir-reasoning-omop-ri)
**Focus:** Digital Quality Measures (dQM) using CQL over OMOP data
**Maturity:** Reference implementation / development environment

### What It Does

A Docker-based development environment that wires together:

- **ETL-Synthea** — translates Synthea patients into OMOP CDM.
- **OMOPonFHIR** — exposes OMOP data as FHIR.
- **CQF Ruler** — executes CQL-based quality measures against the FHIR API.
- **HAPI FHIR CLI** — populates FHIR servers with vocabularies and patients.

This creates a full loop: synthetic patient data → OMOP CDM → FHIR API → CQL quality measure evaluation.

### Relevance to Parthenon

This architecture is directly relevant to Parthenon's quality measurement and DQD capabilities. It demonstrates how to layer CQL-based digital quality measures on top of OMOP data through a FHIR façade — exactly what healthcare organizations need for CMS reporting requirements.

---

## 8. TermX Bidirectional Transformations (2026)

**Direction:** Bidirectional (FHIR ↔ OMOP via FHIR Mapping Language)
**Publication:** [Frontiers in Medicine, 2026](https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2026.1736785/full)
**Maturity:** Research / proof-of-concept

### What It Does

Uses **TermX** (open-source terminology and data interoperability platform) to create bidirectional transformation rules between FHIR and OMOP CDM using the **FHIR Mapping Language (FML)** and **ConceptMap-based terminology mappings**.

### Key Results

- **FHIR→OMOP:** 74% mapping coverage (unmapped elements primarily structural discrepancies).
- **OMOP→FHIR:** ~23% coverage (captures values previously mapped from FHIR→OMOP).
- Focus on vital signs data (Observation, Patient, Encounter, Organization, Practitioner).

### Assessment

This is the newest research, demonstrating that FML-based transformations are feasible but coverage gaps remain significant, especially in the OMOP→FHIR direction. The 74% FHIR→OMOP coverage for just vital signs underscores how much work remains for comprehensive bidirectional mapping.

---

## 9. Other Notable Efforts

### FHIR-Ontop-OMOP (Knowledge Graphs)
Builds clinical knowledge graphs in FHIR RDF from OMOP CDM data using the Ontop virtual knowledge graph engine. Published 2022 in Journal of Biomedical Semantics. Relevant for semantic web / linked data use cases.

### Sciforce OMOP-to-FHIR Pipeline
A commercial implementation automating research-to-care data integration. Demonstrates a scalable OMOP→FHIR pipeline for returning research findings to clinical care settings.

### OMOP-on-FHIR Bundle Integration (Vienna, 2025)
Published at MedInfo 2025 by Ludwig Boltzmann Institute. Uses FHIR Bundles with XSLT-based ETL for real-time clinical data exchange into OMOP CDM. Demonstrates a lightweight approach using standard XML tooling.

---

## Comparative Matrix

| Project | Direction | Language | OMOP Versions | FHIR Versions | Maturity | Activity |
|---|---|---|---|---|---|---|
| **HL7 FHIR-to-OMOP IG** | Bidirectional (spec) | FHIR Shorthand | v5.x | R4 | Ballot | Active |
| **OMOPonFHIR** | Bidirectional (server) | Java | v5.3, v5.4, v6.0 | DSTU2, STU3, R4 | Production | Active |
| **NACHC-CAD fhir-to-omop** | FHIR→OMOP | Java | v5.x | R4 | Production | Active |
| **OHDSI/FhirToCdm** | FHIR→OMOP | C# | v5.2, v5.3, v6.0 | R4 | Low | Stale |
| **ETL-German-FHIR-Core** | FHIR→OMOP | — | v5.x | German Core R4 | Production (10 hospitals) | Active |
| **MENDS-on-FHIR** | OMOP→FHIR | Whistle | v5.x | R4/US Core | Research (scale) | Moderate |
| **HL7 OMOP-RI (dQM)** | Bidirectional (ref impl) | Docker/multi | v5.x | R4 | Reference | Moderate |
| **TermX** | Bidirectional (FML) | FML | v5.x | R4 | Research | New |

---

## Key Challenges Across All Implementations

**Terminology alignment** remains the hardest problem. FHIR uses diverse coding systems (SNOMED-CT, LOINC, ICD-10, RxNorm, local codes) while OMOP mandates mapping everything to "standard concepts" in its vocabulary. Every implementation spends the majority of its complexity on this mapping layer.

**Structural mismatches** between the models are fundamental. FHIR is resource-oriented (Patient, Encounter, Observation, etc.) while OMOP is domain-oriented (person, visit_occurrence, measurement, observation, condition_occurrence, etc.). Some FHIR resources split across multiple OMOP tables; some OMOP domains aggregate data from multiple FHIR resource types.

**Primary/foreign key generation** is non-trivial. FHIR uses string-based logical references; OMOP uses integer foreign keys. Every implementation must maintain its own ID mapping strategy.

**Incomplete FHIR data** — real-world FHIR resources frequently lack fields that OMOP requires (e.g., missing vocabulary codes, absent encounter references), requiring fallback strategies.

**Bidirectional round-tripping** is still largely unsolved. Converting FHIR→OMOP→FHIR produces significant data loss, as evidenced by TermX's 74%/23% coverage asymmetry.

---

## Recommendations for Parthenon

1. **Adopt the HL7 FHIR-to-OMOP IG** as the canonical mapping reference once it achieves STU status. Track the ballot resolution and subsequent publications.

2. **Evaluate OMOPonFHIR v5.4-R4** as a FHIR façade over Parthenon's existing OMOP CDM. This would provide SMART-on-FHIR, CQL, and Bulk FHIR capabilities without duplicating data. The existing `fhir-to-cdm` service could be complemented or replaced.

3. **Evaluate NACHC-CAD fhir-to-omop** for FHIR ingestion pipelines. Its Patient/$everything parsing, vocabulary mapping, and PostgreSQL support align with Parthenon's architecture.

4. **Study the ETL-German-FHIR-Core incremental loading pattern** for ongoing synchronization design, even though the FHIR profiles differ from US Core.

5. **Monitor MENDS-on-FHIR's Whistle approach** for public health reporting and data export use cases.

6. **Consider the HL7 OMOP-RI Docker architecture** as a reference for integrating CQL-based quality measurement into Parthenon's DQD capabilities.

---

*Research compiled March 28, 2026*
