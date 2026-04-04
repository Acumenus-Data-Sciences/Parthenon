# Parthenon Risk Assessment

**Document ID:** PARTH-RA-001
**Effective Date:** 2026-04-04
**Assessor:** Sanjay Mudoshi, System Administrator / Developer
**Review Cycle:** Annual (next review: 2027-04-04)
**Status:** Active
**Framework References:** HIPAA §164.308(a)(1)(ii)(A), NIST SP 800-53 RA-3

---

## 1. Purpose

This document identifies and evaluates threats and vulnerabilities to electronic Protected Health Information (ePHI) processed, stored, and transmitted by the Parthenon outcomes research platform. It satisfies the HIPAA Security Rule requirement for a formal risk assessment and establishes the basis for the organization's security management process.

---

## 2. Scope

### 2.1 Systems in Scope

The following systems and components are covered by this assessment:

**Application Layer:**
- Laravel 11 API server (parthenon-php) — authentication, authorization, business logic
- React 19 SPA frontend — clinical research user interface
- Python FastAPI AI service (parthenon-ai) — concept embeddings, MedGemma LLM, RAG pipeline
- R Plumber API (parthenon-darkstar) — HADES analytics (CohortMethod, PatientLevelPrediction)
- Hecate concept search engine (parthenon-hecate) — Rust-based vocabulary search

**Data Layer:**
- PostgreSQL 16/17 — single `parthenon` database with schema isolation
  - Clinical data schemas: `omop`, `synpuf`, `irsf`, `pancreas`, `inpatient`, `inpatient_ext`
  - Shared vocabulary schema: `vocab`
  - Results schemas: `results`, `synpuf_results`, `irsf_results`, `pancreas_results`
  - Application schema: `app` (users, roles, cohorts, studies, analyses)
  - AI workspace: `temp_abby`
  - GIS data: `gis`
  - Demo: `eunomia`, `eunomia_results`
- Redis 7 — session cache, queue broker (password-authenticated)
- ChromaDB — document and concept embeddings
- Qdrant v1.17.1 — vector similarity search
- Solr 9.7 — full-text search (10 configsets: vocabulary, cohorts, analyses, mappings, clinical, imaging, claims, gis_spatial, vector_explorer, query_library)

**Infrastructure:**
- Ubuntu 24.04 LTS production server
- Docker Compose (29 containers)
- Apache 2.4 reverse proxy with Let's Encrypt TLS
- Nginx 1.27 internal proxy
- Traefik reverse proxy (Acropolis infrastructure layer)
- Orthanc DICOM server (medical imaging)
- JupyterHub (interactive notebooks)
- Dagster (Poseidon orchestration)

**Monitoring:**
- Wazuh SIEM (47,000+ HIPAA-tagged events)
- Prometheus + Grafana metrics stack
- Loki + Alloy log aggregation
- fail2ban intrusion prevention
- YARA real-time malware scanning
- Loki-RS malware sweeps

### 2.2 Data Classifications

| Classification | Description | Examples |
|---|---|---|
| **ePHI (Critical)** | Individually identifiable health information | OMOP CDM person, visit_occurrence, drug_exposure, condition_occurrence, procedure_occurrence, measurement, observation, note, death tables; DICOM medical images; any data linkable to a patient |
| **Sensitive** | Credentials, keys, system secrets | API keys, database passwords, JWT secrets, Sanctum tokens, Wazuh alert data, LUKS keys |
| **Internal** | Non-public operational data | Cohort definitions, analysis configurations, study metadata, user profiles, role assignments |
| **Public** | Openly available data | OHDSI standardized vocabulary concepts, open-source codebase, documentation |

### 2.3 ePHI Inventory

| Dataset | Schema | Records (approx.) | Source | PHI Elements |
|---|---|---|---|---|
| Acumenus CDM | `omop` | Production dataset | Clinical data | Demographics, diagnoses, procedures, medications, lab values, notes |
| CMS SynPUF | `synpuf` | 2.3M patients | CMS synthetic | Synthetic but structurally identical to real claims |
| IRSF Natural History | `irsf` | Study cohort | Research study | Demographics, diagnoses, outcomes |
| Pancreatic Cancer Corpus | `pancreas` | Oncology cohort | Multimodal research | Demographics, diagnoses, imaging, genomics |
| Morpheus Inpatient | `inpatient` | ICU dataset | Inpatient records | Demographics, vital signs, medications, ventilator data |
| DICOM Images | Orthanc | Medical imaging | Clinical imaging | Patient identifiers embedded in DICOM headers |

---

## 3. Threat Identification and Risk Evaluation

### 3.1 Risk Scoring Methodology

**Likelihood:** Low (1) = unlikely to occur within 1 year; Medium (2) = possible within 1 year; High (3) = expected within 1 year.
**Impact:** Low (1) = minor operational disruption; Medium (2) = limited data exposure or extended outage; High (3) = breach of ePHI, regulatory notification required; Critical (4) = large-scale breach, multi-dataset exposure.
**Risk Score:** Likelihood × Impact. Scores 1–3 = Low; 4–6 = Medium; 8–9 = High; 12 = Critical.

### 3.2 Threat Matrix

| ID | Threat | Likelihood | Impact | Risk | Existing Controls | Residual Risk |
|---|---|---|---|---|---|---|
| T-01 | **Unauthorized API access to ePHI** | Medium (2) | Critical (4) | **8 — High** | Sanctum auth (8hr token expiry), Spatie RBAC (6 roles, 20 permission domains), three-layer route protection (auth → permission → ownership), rate limiting on auth endpoints (5/15min login, 3/15min reset) | Low — only 5 unauthenticated routes (health, login, register, forgot-password, shared cohort link), none serve ePHI |
| T-02 | **SQL injection against OMOP queries** | Low (1) | Critical (4) | **4 — Medium** | Eloquent ORM with parameterized queries, CdmModel read-only abstraction (no write operations), `$fillable` on all models (no `$guarded = []`), interrogation connection uses read-only `abby_analyst` PG role | Low — framework-level prevention; CdmModel prohibits write operations |
| T-03 | **Compromised Docker container** | Low (1) | High (3) | **3 — Low** | Non-root users on all application containers (www-data, appuser, node, agentuser, hecate, ruser, jupyterhub), no `privileged: true` flags, Wazuh container monitoring (rule 100043), Docker socket mounted only for JupyterHub (documented exception) | Low — principle of least privilege enforced; socket mount is a known accepted risk |
| T-04 | **Unpatched dependency CVEs** | Medium (2) | Medium (2) | **4 — Medium** | Wazuh vulnerability detection (144 CVEs tracked), CIS Ubuntu 24.04 + CIS Apache SCA policies active, regular dependency updates | Medium — Python AI service has known High CVEs (onnx, langchain-core, pypdf, pyasn1) pending patch |
| T-05 | **Insider threat / credential misuse** | Low (1) | High (3) | **3 — Low** | Role-based access (viewer default for new users, researcher/admin by explicit promotion), forced password change on first login, 8-hour token expiry, audit logging (UserAuditLog: login/logout/password changes), Wazuh SSH VERBOSE logging | Low — principle of least privilege + audit trail |
| T-06 | **Data loss from hardware failure** | Low (1) | Critical (4) | **4 — Medium** | Daily automated backups (db-backup.sh at 3:17 AM) of 7 schemas (app, irsf, irsf_results, vocab, results, omop, public), 30-day retention with auto-pruning, integrity checks (JSON row count manifests), pg-host-basebackup.sh for WAL-level backup | Medium — backup restore not yet formally tested; offsite copy procedure not documented |
| T-07 | **Ransomware / malware infection** | Low (1) | Critical (4) | **4 — Medium** | YARA real-time scanning, Loki-RS binary sweeps, VirusTotal integration, Wazuh file integrity monitoring (syscheck on /etc, /usr, .ssh, .env), fail2ban + UFW firewall | Low — multi-layer detection and prevention |
| T-08 | **Phishing / social engineering** | Medium (2) | Medium (2) | **4 — Medium** | Key-only SSH (password auth disabled), temp password flow (no user-chosen passwords at registration), Sanctum tokens (not session cookies), no publicly-exposed admin panels | Medium — single-person operations limits social engineering surface but also means no second set of eyes |
| T-09 | **Unencrypted data at rest** | Medium (2) | High (3) | **6 — Medium** | PostgreSQL SSL connections (`sslmode=prefer`), application-level encryption for sensitive fields (`encrypted:array` cast), secrets in `.env` files (chmod 600) | **High — data volumes not LUKS-encrypted; HIPAA §164.312(a)(2)(iv) gap** |
| T-10 | **Network-level intrusion** | Low (1) | High (3) | **3 — Low** | UFW firewall, iptables rules, fail2ban (SSH, Apache, nginx), SSH key-only auth with VERBOSE logging, Wazuh intrusion detection (NIST SI-4), Traefik rate limiting (100 req/s avg, 200 burst) | Low — multiple overlapping network defenses |
| T-11 | **Medical image exfiltration** | Low (1) | Critical (4) | **4 — Medium** | Orthanc authentication enabled, WADO-RS endpoints behind `auth:sanctum`, DICOM proxy with authorization header pass-through, Nginx CORS headers (Cross-Origin-Resource-Policy) | Low — addressed in 2026-03-20 security hardening |
| T-12 | **Loss of availability (DoS/DDoS)** | Low (1) | Medium (2) | **2 — Low** | Traefik rate limiting, fail2ban, UFW, Apache connection limits, Nginx fastcgi buffers tuned for load, PHP-FPM process limits (max 20 children, 500 requests before recycle) | Low — single-server architecture is inherently less resilient but adequate for current scale |

---

## 4. Control Inventory

### 4.1 Administrative Controls

| Control | HIPAA Reference | Status | Evidence |
|---|---|---|---|
| Risk assessment | §164.308(a)(1)(ii)(A) | **This document** | docs/compliance/risk-assessment.md |
| Security policies | §164.308(a)(1)(ii)(B) | Active | docs/compliance/security-policies.md |
| Workforce training | §164.308(a)(5)(i) | Active | docs/compliance/workforce-training.md |
| Incident response plan | §164.308(a)(6)(i) | Active | docs/compliance/incident-response-plan.md |
| Contingency plan | §164.308(a)(7)(i) | Active | docs/compliance/disaster-recovery-plan.md |
| Business associate agreements | §164.308(b)(1) | In review | docs/compliance/baas/ |

### 4.2 Technical Controls

| Control | HIPAA Reference | NIST Reference | Implementation | Evidence |
|---|---|---|---|---|
| Access control | §164.312(a)(1) | AC-2 | Sanctum auth + Spatie RBAC, 6-role hierarchy, forced password change | AuthController.php, RolePermissionSeeder.php |
| Audit controls | §164.312(b) | AU-2 | Wazuh SIEM (47K+ events), Apache/Nginx logs, Laravel app logs, UserAuditLog model | Wazuh dashboard, docs/compliance/audit-controls.md |
| Integrity controls | §164.312(c)(1) | SI-7 | Wazuh syscheck (file integrity monitoring on /etc, /usr, .ssh, .env), CdmModel read-only, `$fillable` mass assignment protection | Wazuh syscheck config, HIGHSEC.spec.md §3 |
| Transmission security | §164.312(e)(1) | SC-8 | Apache SSL (Let's Encrypt), PostgreSQL `sslmode=prefer`, Redis password auth, HSTS header (Traefik: 1-year, preload) | apache-vhost-ssl.conf, database.php, middleware.yml |
| Encryption at rest | §164.312(a)(2)(iv) | SC-28 | **LUKS encryption: in progress** | Wave 2.2 of remediation plan |
| Emergency access | §164.312(a)(2)(ii) | CP-2 | super-admin account (admin@acumenus.net), backup restore procedures | disaster-recovery-plan.md |
| Automatic logoff | §164.312(a)(2)(iii) | AC-11 | Sanctum token expiry: 480 minutes (8 hours) | config/sanctum.php |
| Unique user identification | §164.312(a)(2)(i) | IA-2 | Email-based accounts, Sanctum bearer tokens, no shared credentials | User.php, AuthController.php |

### 4.3 Physical Controls

| Control | HIPAA Reference | Status | Notes |
|---|---|---|---|
| Facility access controls | §164.310(a)(1) | N/A | Cloud/hosted server — physical security is provider's responsibility (requires BAA) |
| Workstation security | §164.310(b) | Partial | Production server hardened (CIS benchmarks); developer workstations not in scope |
| Device and media controls | §164.310(d)(1) | Planned | Data retention and disposal policy documented in security-policies.md |

---

## 5. Vulnerability Scan Results

### 5.1 Infrastructure Vulnerabilities (Wazuh)

As of the assessment date, Wazuh vulnerability detection reports **144 tracked CVEs** across the production environment. These are actively monitored and triaged.

### 5.2 Application Dependencies

| Component | Known High/Critical CVEs | Status |
|---|---|---|
| Thunderbird (desktop app on server) | 52 Critical + 53 High | **Pending removal** (Wave 1.3) |
| Python AI: onnx | High | **Pending upgrade** (Wave 1.4) |
| Python AI: langchain-core | High | **Pending upgrade** (Wave 1.4) |
| Python AI: pypdf | High | **Pending upgrade** (Wave 1.4) |
| Python AI: pyasn1 | High | **Pending upgrade** (Wave 1.4) |

### 5.3 CIS Benchmark Compliance

CIS Ubuntu 24.04 and CIS Apache SCA policies are active in Wazuh. Current compliance score and specific failures are tracked in the Wazuh Configuration Assessment dashboard.

---

## 6. Residual Risk Summary

| Risk Level | Count | Items |
|---|---|---|
| **High** | 1 | T-09: Unencrypted data at rest (LUKS remediation in progress) |
| **Medium** | 5 | T-01 (API access), T-04 (CVEs), T-06 (data loss/backup testing), T-08 (phishing), T-11 (image exfil) |
| **Low** | 6 | T-02 (SQLi), T-03 (container), T-05 (insider), T-07 (ransomware), T-10 (network), T-12 (DoS) |

### 6.1 Accepted Risks

The following risks have been evaluated and accepted:

1. **Single-person operations** — Sanjay Mudoshi serves as sole administrator, developer, and security officer. This limits separation of duties but is mitigated by automated controls (Wazuh, RBAC, audit logging). Bus-factor mitigation: all procedures documented, passwords in encrypted store, infrastructure as code.

2. **JupyterHub Docker socket mount** — Required for DockerSpawner functionality. Mitigated by running JupyterHub as non-root user and restricting Hub access to authenticated users. Documented as a known risk in HIGHSEC.spec.md §4.3.

3. **PostgreSQL SSL `prefer` mode** — Connections upgrade to SSL when available but do not enforce it. Acceptable for same-host Docker networking. Production external connections should enforce `require` or `verify-full`.

---

## 7. Remediation Plan

Active remediation is tracked in `docs/architecture/compliance-remediation-plan.md` with a 14-day timeline. Key actions:

| Priority | Action | Target Date | Status |
|---|---|---|---|
| Wave 1 | HSTS header, XSS header, Thunderbird removal, Python CVE patches, backup scheduling | Day 1 | Pending |
| Wave 2 | CSP header, LUKS encryption, backup restore test, CIS remediation | Days 2–7 | Pending |
| Wave 3 | Risk assessment (this doc), security policies, IR plan, DR plan, audit controls, training | Days 8–14 | **In progress** |

---

## 8. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Assessor | Sanjay Mudoshi | _________________________ | __________ |
| Reviewer | | _________________________ | __________ |

---

## Appendix A: Assessment Methodology

This risk assessment was conducted using the following approach:

1. **Asset inventory** — enumeration of all systems, services, and data stores processing ePHI
2. **Threat identification** — based on NIST SP 800-30 Rev. 1 threat sources and events
3. **Vulnerability analysis** — Wazuh vulnerability detection, CIS SCA benchmarks, manual code review
4. **Control assessment** — mapping existing controls to HIPAA Security Rule requirements and NIST 800-53 controls
5. **Risk determination** — likelihood × impact scoring with qualitative assessment of residual risk
6. **Documentation review** — audit of existing policies, procedures, and technical configurations

## Appendix B: References

- HIPAA Security Rule: 45 CFR Part 164, Subpart C
- NIST SP 800-53 Rev. 5: Security and Privacy Controls for Information Systems and Organizations
- NIST SP 800-30 Rev. 1: Guide for Conducting Risk Assessments
- NIST SP 800-66 Rev. 2: Implementing the HIPAA Security Rule
- CIS Benchmarks: Ubuntu 24.04, Apache HTTP Server 2.4
- Parthenon HIGHSEC Specification: `.claude/rules/HIGHSEC.spec.md`
- Parthenon Compliance Remediation Plan: `docs/architecture/compliance-remediation-plan.md`
