# Parthenon Security Policies

**Document ID:** PARTH-SP-001
**Effective Date:** 2026-04-04
**Owner:** Sanjay Mudoshi
**Review Cycle:** Annual (next review: 2027-04-04)
**Status:** Active
**Framework References:** HIPAA §164.308(a)(1), NIST SP 800-53 PL-1

---

## 1. Purpose and Scope

These policies govern the security of the Parthenon OHDSI outcomes research platform, all systems that process, store, or transmit ePHI, and all personnel who access these systems. They establish the rules and standards by which Parthenon protects the confidentiality, integrity, and availability of electronic Protected Health Information.

These policies apply to the production environment at `parthenon.acumenus.net`, the Docker infrastructure (29 containers), the PostgreSQL database, all API services, and any development or testing environments that contain copies of production data.

---

## 2. Access Control Policy

**HIPAA:** §164.312(a)(1) | **NIST:** AC-1, AC-2, AC-3, AC-6

### 2.1 Authentication

All access to Parthenon is mediated by the Laravel Sanctum authentication system. The following rules are enforced:

- Every non-public API request must include a valid Sanctum bearer token in the `Authorization` header.
- Tokens expire after **480 minutes (8 hours)**. Token expiration must never be set to `null` or infinite.
- New users register with name and email only. A **12-character temporary password** is generated using `random_int()` (cryptographically secure) from the character set `A-Z, a-z, 2-9` (excluding ambiguous characters `0, O, 1, l, I`).
- Temporary passwords are delivered via the Resend email service to the registered email address. They are never displayed in the UI or API response.
- On first login, users are presented with a **non-dismissable password change modal** that blocks all application access until the password is changed.
- Password requirements: minimum 8 characters, hashed with bcrypt at 12 rounds.
- SSH access to the production server requires key-based authentication. Password authentication is disabled.

### 2.2 Authorization (Role-Based Access Control)

Parthenon uses Spatie Laravel Permission for role-based access control with the following hierarchy:

| Role | Access Level | Assignment |
|---|---|---|
| `super-admin` | All permissions (wildcard). System bootstrap and emergency access. | Bootstrap only (admin@acumenus.net) |
| `admin` | User management, role management, source management, system configuration, ETL operations. No direct research operations. | Explicit admin promotion |
| `researcher` | Full research lifecycle: cohorts, concept sets, analyses, studies (view, create, edit, run, delete). No admin functions. | Explicit promotion |
| `data-steward` | Data pipelines: ingestion (upload, run), mapping (review, override), data quality (run). No study execution. | Explicit promotion |
| `mapping-reviewer` | AI concept mapping review only. | Explicit promotion |
| `viewer` | Read-only access to all research outputs. **Default role for newly registered users.** | Automatic on registration |

**Rules:**
- New user accounts are assigned the `viewer` role only. Elevation to any other role requires explicit action by an `admin` or `super-admin`.
- Permission checks follow a three-layer model: (1) `auth:sanctum` middleware rejects unauthenticated requests; (2) `permission:{domain}.{action}` middleware enforces RBAC at the route level; (3) controller-level `$this->authorize()` or policy checks enforce ownership.
- The Horizon queue dashboard is gated by a Laravel Gate that requires the `super-admin` role.
- 20 permission domains are defined: users, roles, permissions, auth-providers, sources, vocabulary, ingestion, mapping, cohorts, concept-sets, analyses, studies, data-quality, jobs, profiles, system, gis, profiler, etl, surveys.

### 2.3 Account Management

- Inactive accounts (no login for 90+ days) should be reviewed quarterly and disabled or removed.
- Terminated personnel must have their Sanctum tokens revoked and accounts disabled within 24 hours.
- The `super-admin` account (`admin@acumenus.net`) must always exist as the emergency access path.
- Shared accounts are prohibited. Every user must have a unique email-based identity.

### 2.4 Automatic Session Termination

Sanctum tokens expire after 8 hours. Users must re-authenticate after expiration. There is no "remember me" or persistent session mechanism.

---

## 3. Data Classification and Handling Policy

**HIPAA:** §164.312(c)(1) | **NIST:** SC-28, MP-2

### 3.1 Classification Levels

| Level | Definition | Handling Requirements |
|---|---|---|
| **ePHI (Critical)** | Any individually identifiable health information: OMOP CDM person, visit, drug, condition, procedure, measurement, observation, note, death tables. DICOM medical images. Any data linkable to a patient. | Encrypted at rest (LUKS) and in transit (TLS). Access restricted by RBAC. Audit logged. No export without authorization. |
| **Sensitive** | API keys, database passwords, JWT secrets, Sanctum tokens, LUKS keys, Wazuh alert data. | Stored in `.env` files (chmod 600). Never committed to git. Passed to containers via `env_file` or file mounts. Rotated on suspected compromise. |
| **Internal** | Cohort definitions, analysis configurations, study metadata, user profiles, role assignments. | Protected by authentication. Available to authorized roles. |
| **Public** | OHDSI standardized vocabulary, open-source application code, documentation. | No restrictions on access or distribution. |

### 3.2 Data Handling Rules

- ePHI must never be transmitted via email, chat, or any unencrypted channel.
- ePHI must never appear in log files, error messages, or API error responses. Laravel `APP_DEBUG` must be `false` in production.
- Shared cohort links contain definition metadata only (no patient-level data) and are time-limited with cryptographically random tokens.
- The `interrogation` database connection (used by Abby AI) operates under the `abby_analyst` PostgreSQL role, which has read-only access.
- CdmModel (the base class for all OMOP CDM Eloquent models) is read-only. Write operations to CDM tables are prohibited at the application layer.

---

## 4. Encryption Policy

**HIPAA:** §164.312(a)(2)(iv), §164.312(e)(1) | **NIST:** SC-8, SC-13, SC-28

### 4.1 Encryption in Transit

- All external connections to `parthenon.acumenus.net` use TLS via Let's Encrypt certificates.
- HSTS is enforced with `max-age=31536000; includeSubDomains; preload` (via Traefik middleware and Apache headers).
- PostgreSQL connections use `sslmode=prefer` for Docker-internal communication. External connections should use `sslmode=require` or `verify-full`.
- Redis connections are password-authenticated (`--requirepass`).
- WebSocket connections (Reverb) use WSS.

### 4.2 Encryption at Rest

- Data volumes must be encrypted with LUKS. (Implementation in progress per remediation plan Wave 2.2.)
- Application-level encryption uses Laravel's `encrypted:array` cast for sensitive fields (stored as base64 in `text` columns).
- Secret files (`.env`, `.resendapikey`, `.claudeapikey`) must be `chmod 600`.
- Backup files contain ePHI and must be stored on encrypted volumes.

### 4.3 Key Management

- LUKS encryption keys stored as keyfiles on the root partition (`chmod 600`) or entered manually at boot.
- Application secrets managed through environment variables, never hardcoded in source code.
- Secret rotation: rotate immediately on suspected compromise. Routine rotation at least annually.

---

## 5. Network Security Policy

**HIPAA:** §164.312(e)(1) | **NIST:** SC-7, SC-8

### 5.1 Firewall Rules

- UFW firewall is enabled with default-deny inbound policy.
- Only the following ports are open externally: 22 (SSH), 80 (HTTP → redirect to HTTPS), 443 (HTTPS).
- Docker service ports (5175, 5480, 6333, 6381, 8000, 8002, 8042, 8082, 8083, 8088, 8090, 8765, 8786, 8787, 8880, 8888, 8983, 9090, 9100, 9121, 9187) are bound to localhost or Docker networks only.
- fail2ban monitors SSH, Apache, and Nginx for brute-force attacks with automatic IP banning.

### 5.2 Rate Limiting

- Authentication endpoints: 5 login attempts per 15 minutes, 3 password reset attempts per 15 minutes.
- Traefik global rate limiting: 100 requests/second average, 200 burst.
- Ingestion endpoints: 5 staging requests per 10 minutes.

### 5.3 Docker Networking

- Containers communicate over internal Docker networks.
- The Docker socket (`/var/run/docker.sock`) is mounted only into JupyterHub (required for DockerSpawner) and Alloy (log collection). No new services may mount the Docker socket without explicit authorization.
- No container runs with `privileged: true`.
- No container mounts the host root filesystem.

---

## 6. Incident Response Policy

**HIPAA:** §164.308(a)(6) | **NIST:** IR-1, IR-4

Security incidents must be handled according to the Incident Response Plan (`docs/compliance/incident-response-plan.md`). Key requirements:

- All suspected security incidents must be reported immediately upon discovery.
- Containment takes priority over investigation. Isolate compromised systems first.
- Compromised credentials must be rotated immediately.
- HIPAA breach notification timelines must be followed: 60 days to HHS, affected individuals, and media (if 500+ individuals in a state/jurisdiction).
- All incidents must be documented with timeline, root cause, and remediation actions.
- A post-incident review must occur within 7 days of resolution.

---

## 7. Data Retention and Disposal Policy

**HIPAA:** §164.310(d)(2), §164.530(j) | **NIST:** MP-6, SI-12

### 7.1 Retention Periods

| Data Type | Retention Period | Justification |
|---|---|---|
| Clinical data (OMOP CDM) | Duration of active research + 6 years | HIPAA minimum retention |
| HIPAA documentation (policies, assessments, training records) | 6 years from creation or last effective date | HIPAA §164.530(j) |
| Database backups | 30 days rolling | Operational recovery window |
| Audit logs (Wazuh) | 90 days online, 1 year archived | Incident investigation window |
| Application logs (Laravel, FastAPI) | 30 days | Operational debugging |
| User accounts | Until explicitly deactivated or 90 days post-termination | Access control hygiene |
| Sanctum tokens | 8 hours (automatic expiry) | Session security |

### 7.2 Disposal Procedures

- **Files:** `shred -vfz -n 5` for files containing ePHI or secrets on magnetic media. Single-pass overwrite sufficient for SSDs (due to wear leveling, full disk encryption is the primary protection).
- **Database schemas:** `DROP SCHEMA ... CASCADE` followed by `VACUUM FULL` to reclaim space.
- **Backups:** Expired backups automatically pruned by `db-backup.sh` (retains last 30 only).
- **Decommissioned drives:** NIST SP 800-88 media sanitization: degauss or physical destruction for drives that held ePHI.
- **Docker volumes:** `docker volume rm` followed by underlying storage wipe.

---

## 8. Change Management Policy

**NIST:** CM-1, CM-3

### 8.1 Code Changes

- All code changes are committed to Git with conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`, `test:`).
- Pre-commit hooks enforce code quality: Pint (PHP formatting), PHPStan level 8 (static analysis), TypeScript type checking.
- Feature branches follow naming conventions: `feature/phase-N-slug`, `fix/description`, `chore/description`.
- Production deployment via `deploy.sh` with options for PHP-only, frontend-only, database-only, or full deployment.

### 8.2 Infrastructure Changes

- Docker Compose configuration changes require `docker compose config --quiet` validation before deployment.
- New containers must include non-root `USER` directives in their Dockerfile.
- New routes must pass the security checklist in HIGHSEC.spec.md §2.3.
- Secrets must never be added to `docker-compose.yml` or Dockerfiles directly — use environment variable references.

### 8.3 Emergency Changes

- Emergency changes may bypass the pre-commit hook using `git commit --no-verify` but must be retroactively reviewed within 24 hours.
- Emergency credential rotation does not require change approval but must be documented.

---

## 9. Vulnerability Management Policy

**NIST:** RA-5, SI-2, SI-5

- Wazuh vulnerability detection runs continuously against the production system.
- CIS Ubuntu 24.04 and CIS Apache SCA benchmarks are active and assessed regularly.
- Critical and High CVEs must be triaged within 48 hours of detection.
- Patches for Critical CVEs must be applied within 7 days. High CVEs within 30 days.
- Dependency updates (npm, pip, composer) are reviewed monthly.
- `pip-audit` should be installed in the AI service container for ongoing Python dependency scanning.

---

## 10. Acceptable Use Policy

- Parthenon is used exclusively for authorized outcomes research on approved OMOP CDM datasets.
- Users must not attempt to re-identify de-identified data.
- Users must not export, copy, or transmit ePHI outside the platform without written authorization.
- Users must not share credentials, tokens, or API keys.
- Users must not install unauthorized software on the production server.
- Users must report suspected security incidents immediately.
- Violations may result in account suspension and, for workforce members, disciplinary action.

---

## 11. Policy Review and Updates

These policies are reviewed annually or whenever a significant change occurs (new system deployment, security incident, regulatory update). Changes are documented with effective dates and revision history.

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-04-04 | Sanjay Mudoshi | Initial release |

---

## 12. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Policy Owner | Sanjay Mudoshi | _________________________ | __________ |
| Reviewer | | _________________________ | __________ |
