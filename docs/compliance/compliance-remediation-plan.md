# Parthenon Compliance Remediation Plan

**Date:** 2026-04-03
**Timeline:** 14 days (aggressive)
**Frameworks:** HIPAA Security Rule, NIST 800-53, IT Hygiene baseline
**Baseline:** ~65% compliant — technical controls strong, documentation gaps significant

---

## Current Posture Summary

Parthenon already has robust technical controls: Wazuh SIEM with 47K+ HIPAA-tagged events, Sanctum/Spatie RBAC with a 6-role hierarchy, fail2ban + YARA + Loki-RS intrusion detection, CIS SCA benchmarks, SSL everywhere, non-root containers, and 8-hour token expiration. The remaining gaps fall into three categories: quick security header/patching fixes, a LUKS encryption task, and a set of policy documents that auditors require as evidence of a managed security program.

---

## Wave 1 — Quick Wins (Day 1, < 1 hour total)

### 1.1 Add HSTS Header to Apache

**Gap:** No `Strict-Transport-Security` header on the production Apache vhost.
**Framework:** HIPAA 164.312(e), NIST SC-8, IT Hygiene.
**Effort:** 5 minutes.

Note: Traefik already has HSTS configured in `acropolis/traefik/dynamic/middleware.yml` with `stsSeconds: 31536000` and `stsPreload: true`. This fix targets the production Apache layer at `parthenon.acumenus.net` which sits in front of Traefik.

**File:** `/etc/apache2/sites-available/parthenon-ssl.conf` (production)
**Reference:** `docs/architecture/apache-vhost-ssl.conf`

Add inside the `<VirtualHost *:443>` block, near the existing security headers:

```apache
# HSTS — force HTTPS for 1 year, include subdomains, allow preload list submission
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
```

**Verify:**
```bash
# After reloading Apache
sudo systemctl reload apache2
curl -sI https://parthenon.acumenus.net | grep -i strict-transport
# Expected: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

Also update the reference config in the repo:

```bash
# In docs/architecture/apache-vhost-ssl.conf, add alongside existing headers:
# Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
```

---

### 1.2 Add X-XSS-Protection Header to Apache

**Gap:** Missing from Apache layer (already present in Nginx and Traefik).
**Framework:** IT Hygiene.
**Effort:** 5 minutes.

```apache
# Deprecated but still expected by compliance scanners
Header always set X-XSS-Protection "1; mode=block"
```

**Note:** Nginx (`docker/nginx/default.conf.template`) already sends this header. Adding it to Apache ensures it's present on all response paths, including static assets served directly by Apache.

---

### 1.3 Patch or Remove Thunderbird

**Gap:** 52 Critical + 53 High CVEs on a desktop mail client running on the server.
**Framework:** NIST RA-5, NIST SI-2.
**Effort:** 5 minutes.

```bash
# Option A: Upgrade (if you use it)
sudo apt update && sudo apt upgrade thunderbird -y

# Option B: Remove (recommended — it's a desktop app on a server)
sudo apt remove --purge thunderbird -y && sudo apt autoremove -y
```

**Verify:**
```bash
dpkg -l | grep thunderbird
# Expected: empty (removed) or updated version with no critical CVEs
```

---

### 1.4 Upgrade Vulnerable Python Packages

**Gap:** Known High CVEs in onnx, langchain-core, pypdf, pyasn1.
**Framework:** NIST SI-2, NIST RA-5.
**Effort:** 30 minutes (includes testing).

```bash
# Enter the AI service container
docker compose exec python-ai bash

# Upgrade the flagged packages
pip install --upgrade onnx langchain-core pypdf pyasn1 --break-system-packages

# Verify no import errors
python -c "import onnx; import langchain_core; import pypdf; import pyasn1; print('All imports OK')"

# Run the AI service test suite
cd /app && pytest
```

Also update `ai/requirements.txt` to pin the new minimum versions so future container builds pick them up:

```bash
# On the host, after confirming the upgrades work inside the container:
# Get current versions
docker compose exec python-ai pip show onnx langchain-core pypdf pyasn1 | grep -E "^(Name|Version)"

# Update ai/requirements.txt with the new pinned versions
```

**Verify:**
```bash
# Re-run Wazuh vulnerability scan or check manually
docker compose exec python-ai pip audit 2>/dev/null || echo "pip-audit not installed — install it for ongoing checks"
```

---

### 1.5 Schedule Automated Backups

**Gap:** `scripts/db-backup.sh` exists but is not scheduled via cron.
**Framework:** HIPAA 164.308(a)(7).
**Effort:** 15 minutes.

The backup script already supports cron execution (noted in its comments: "17 3 * * *"). It dumps schemas `app`, `irsf`, `irsf_results`, `vocab`, `results`, `omop`, and `public` (Orthanc), keeps 30 days of backups with auto-pruning, and writes integrity-check JSON.

```bash
# Add to the server's crontab
sudo crontab -e -u smudoshi

# Add these lines:
# Daily database backup at 3:17 AM
17 3 * * * /home/smudoshi/Github/Parthenon/scripts/db-backup.sh >> /home/smudoshi/Github/Parthenon/backups/cron.log 2>&1

# Weekly Wazuh config backup (Sunday 4:00 AM)
0 4 * * 0 /home/smudoshi/Github/Parthenon/scripts/wazuh-backup.sh >> /home/smudoshi/Github/Parthenon/backups/wazuh-cron.log 2>&1
```

**Verify:**
```bash
# List the crontab to confirm
crontab -l | grep backup

# Do a manual test run
bash /home/smudoshi/Github/Parthenon/scripts/db-backup.sh
ls -la backups/latest.sql
```

---

## Wave 2 — Technical Gaps (Days 2–5)

### 2.1 Add Content-Security-Policy Header

**Gap:** No CSP on any layer. This is the most impactful missing header.
**Framework:** IT Hygiene, NIST SI-10.
**Effort:** 1–2 hours (requires testing each vhost/proxy path).

CSP must be tuned to Parthenon's specific needs: inline styles (Tailwind), WebSocket connections (Reverb), OHIF DICOM viewer (WADO-RS), Grafana iframes, and the Vite dev server in development.

**Production Apache CSP** (`/etc/apache2/sites-available/parthenon-ssl.conf`):

```apache
Header always set Content-Security-Policy "\
  default-src 'self'; \
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; \
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; \
  font-src 'self' https://fonts.gstatic.com; \
  img-src 'self' data: blob: https://*.tile.openstreetmap.org; \
  connect-src 'self' wss://parthenon.acumenus.net https://parthenon.acumenus.net; \
  frame-src 'self' https://parthenon.acumenus.net; \
  media-src 'self' blob:; \
  object-src 'none'; \
  base-uri 'self'; \
  form-action 'self'; \
  frame-ancestors 'self'; \
  upgrade-insecure-requests"
```

**Important notes:**
- `unsafe-inline` for scripts is needed temporarily if any inline scripts exist. Audit and move to nonce-based CSP over time.
- `unsafe-eval` may be required by OHIF viewer and some charting libraries (Recharts, Plotly). Test removal.
- `blob:` in img-src is needed for DICOM image rendering.
- `*.tile.openstreetmap.org` is for the GIS Explorer map tiles.

**Testing protocol:**
```bash
# 1. Set CSP in report-only mode first
Header always set Content-Security-Policy-Report-Only "..."

# 2. Browse every major feature and check browser console for violations:
#    - Login/auth flow
#    - Vocabulary search
#    - Cohort builder
#    - GIS Explorer (map tiles)
#    - OHIF DICOM viewer
#    - Abby AI chat (SSE streaming)
#    - Grafana dashboards
#    - JupyterHub

# 3. Once clean, switch from Report-Only to enforcing
Header always set Content-Security-Policy "..."

# 4. Reload Apache
sudo systemctl reload apache2
```

---

### 2.2 Encrypt Data Volume at Rest (LUKS)

**Gap:** No disk encryption at rest for the data partition.
**Framework:** HIPAA 164.312(a)(2)(iv) — encryption of ePHI at rest.
**Effort:** Complex. Requires downtime and careful planning.

This is the highest-effort item. `/mnt/md0` likely holds PostgreSQL data, backups, and possibly DICOM files.

**Pre-requisites:**
- Full backup verified (run `db-backup.sh` and verify the dump)
- Scheduled maintenance window (2-4 hours)
- Enough temporary storage to hold the data during migration

**High-level procedure:**

```bash
# 1. BEFORE ANYTHING: Full backup
bash /home/smudoshi/Github/Parthenon/scripts/db-backup.sh
# Verify backup integrity
cat backups/latest.json  # Check row counts

# 2. Stop all services
docker compose down
sudo systemctl stop postgresql

# 3. Copy data off /mnt/md0 to temporary location
sudo rsync -aHAX /mnt/md0/ /tmp/md0-backup/

# 4. Unmount and encrypt
sudo umount /mnt/md0
sudo cryptsetup luksFormat /dev/md0   # WARNING: Destroys data. Ensure backup is solid.
sudo cryptsetup luksOpen /dev/md0 md0_crypt
sudo mkfs.ext4 /dev/mapper/md0_crypt
sudo mount /dev/mapper/md0_crypt /mnt/md0

# 5. Restore data
sudo rsync -aHAX /tmp/md0-backup/ /mnt/md0/

# 6. Configure auto-unlock (choose one):
#    Option A: Keyfile (unattended boot, key stored on root partition)
sudo dd if=/dev/urandom of=/root/.luks-keyfile bs=4096 count=1
sudo chmod 600 /root/.luks-keyfile
sudo cryptsetup luksAddKey /dev/md0 /root/.luks-keyfile
# Add to /etc/crypttab: md0_crypt /dev/md0 /root/.luks-keyfile luks

#    Option B: Manual passphrase on boot (more secure, requires console access)
# Add to /etc/crypttab: md0_crypt /dev/md0 none luks

# 7. Update /etc/fstab to use /dev/mapper/md0_crypt instead of /dev/md0

# 8. Restart services
sudo systemctl start postgresql
docker compose up -d

# 9. Verify everything is running
docker compose ps
curl -s https://parthenon.acumenus.net/api/v1/health
```

**Risk mitigation:** Do this on a weekend. Keep the backup copy on a separate physical drive until you've verified the encrypted volume works for 48+ hours.

---

### 2.3 Backup Restore Verification

**Gap:** Backups exist but restore has never been formally tested.
**Framework:** HIPAA 164.308(a)(7)(ii)(D).
**Effort:** 1 hour.

```bash
# 1. Create a test database
sudo -u postgres createdb parthenon_restore_test

# 2. Restore the latest backup into it
sudo -u postgres pg_restore -d parthenon_restore_test backups/latest.sql 2>&1 | tee backups/restore-test.log
# OR if it's a plain SQL dump:
sudo -u postgres psql parthenon_restore_test < backups/latest.sql 2>&1 | tee backups/restore-test.log

# 3. Verify row counts match the backup manifest
sudo -u postgres psql parthenon_restore_test -c "SELECT count(*) FROM app.users;"
sudo -u postgres psql parthenon_restore_test -c "SELECT count(*) FROM vocab.concept;"
sudo -u postgres psql parthenon_restore_test -c "SELECT count(*) FROM omop.person;"
# Compare against backups/latest.json row counts

# 4. Document the result
echo "Restore test completed: $(date)" >> backups/restore-verification.log
echo "Status: [PASS/FAIL]" >> backups/restore-verification.log
echo "Row count comparison: [matching/discrepancy details]" >> backups/restore-verification.log

# 5. Clean up
sudo -u postgres dropdb parthenon_restore_test
```

**Ongoing:** Schedule quarterly restore tests. Add a reminder to the Poseidon scheduler or a cron job that runs `db-backup.sh` + restore test on the 1st of each quarter.

---

### 2.4 Remediate CIS SCA Benchmark Failures

**Gap:** CIS Ubuntu 24.04 + CIS Apache SCA policies are active but failures not fully remediated.
**Framework:** NIST CM-6.
**Effort:** 1–2 hours.

```bash
# 1. Pull the current SCA results from Wazuh
# Via Wazuh API or dashboard: Configuration Assessment > parthenon agent > Failed checks

# 2. Common CIS Ubuntu failures and fixes:
# Ensure permissions on /etc/crontab
sudo chmod 600 /etc/crontab
sudo chown root:root /etc/crontab

# Ensure permissions on cron directories
sudo chmod 700 /etc/cron.d /etc/cron.daily /etc/cron.hourly /etc/cron.monthly /etc/cron.weekly

# Ensure SSH MaxAuthTries is set to 4 or less
sudo sed -i 's/^#MaxAuthTries.*/MaxAuthTries 4/' /etc/ssh/sshd_config
sudo systemctl reload sshd

# Ensure SSH ClientAliveInterval is configured
sudo sed -i 's/^#ClientAliveInterval.*/ClientAliveInterval 300/' /etc/ssh/sshd_config
sudo sed -i 's/^#ClientAliveCountMax.*/ClientAliveCountMax 3/' /etc/ssh/sshd_config
sudo systemctl reload sshd

# 3. Re-run SCA scan
# Trigger via Wazuh manager or wait for next scheduled scan
```

---

## Wave 3 — Policy Documentation (Days 6–14)

These are the documents auditors care most about. The technical controls are already in place — these documents formalize and evidence them. Each section below includes a starter template.

### 3.1 Risk Assessment Document

**Gap:** No formal written risk assessment.
**Framework:** HIPAA 164.308(a)(1)(ii)(A).
**Effort:** 3–4 hours.
**Output:** `docs/compliance/risk-assessment.md`

This is the single most important compliance document. It demonstrates you've identified threats to ePHI and have controls in place.

```markdown
# Parthenon Risk Assessment
**Date:** 2026-04-XX
**Assessor:** Sanjay Mudoshi
**Review Cycle:** Annual (next: 2027-04-XX)

## 1. Scope
This assessment covers the Parthenon OHDSI outcomes research platform hosted at
parthenon.acumenus.net, including all components that store, process, or transmit
electronic Protected Health Information (ePHI) from OMOP CDM clinical datasets.

### Systems in Scope
- PostgreSQL 17 database (OMOP CDM schemas: omop, synpuf, irsf, pancreas, inpatient)
- Laravel 11 application server (API, authentication, RBAC)
- Python FastAPI AI service (concept embeddings, MedGemma LLM)
- R Plumber runtime (HADES analytics: CohortMethod, PatientLevelPrediction)
- Orthanc DICOM server (medical imaging)
- Solr 9.7 search (vocabulary, clinical data indexing)
- Docker infrastructure (16 containers)
- Wazuh SIEM (monitoring and alerting)

## 2. Threat Identification

| Threat | Likelihood | Impact | Risk Level |
|--------|-----------|--------|------------|
| Unauthorized access to ePHI via API | Medium | High | High |
| SQL injection against OMOP queries | Low | Critical | High |
| Compromised Docker container | Low | High | Medium |
| Unpatched CVEs in dependencies | Medium | Medium | Medium |
| Insider threat (credential misuse) | Low | High | Medium |
| Data loss from hardware failure | Low | Critical | High |
| Ransomware/malware | Low | Critical | High |
| Social engineering (phishing) | Medium | Medium | Medium |

## 3. Existing Controls

| Threat | Control | Evidence |
|--------|---------|----------|
| Unauthorized access | Sanctum auth + Spatie RBAC (6 roles), 8hr token expiry | HIGHSEC.spec.md, authStore.ts |
| SQL injection | Eloquent ORM parameterized queries, CdmModel read-only | CdmModel.php, HIGHSEC §3.2 |
| Container compromise | Non-root containers, no privileged mode, Wazuh monitoring | docker-compose.yml, HIGHSEC §4 |
| Unpatched CVEs | Wazuh vulnerability detection (144 CVEs tracked), regular updates | Wazuh dashboard |
| Insider threat | Role-based access, audit logging, forced password change | AuthController.php, auth-system.md |
| Data loss | Daily automated backups, 30-day retention, integrity checks | db-backup.sh, cron schedule |
| Ransomware | YARA real-time scanning, Loki-RS, file integrity monitoring | Wazuh syscheck config |
| Phishing | Key-only SSH, no password auth, temp password flow | sshd_config, auth flow |

## 4. Residual Risks

| Risk | Status | Mitigation Plan |
|------|--------|----------------|
| Disk encryption at rest | In progress | LUKS encryption of /mnt/md0 (Wave 2.2) |
| No formal incident response plan | In progress | Written plan (Wave 3.3) |
| Single-person operations | Accepted | Document procedures for bus-factor mitigation |

## 5. Sign-off
Assessed by: _________________________ Date: ___________
```

---

### 3.2 Security Policies Document

**Gap:** No written security policies.
**Framework:** HIPAA 164.308(a)(1), NIST PL-1.
**Effort:** 3–4 hours.
**Output:** `docs/compliance/security-policies.md`

```markdown
# Parthenon Security Policies
**Effective:** 2026-04-XX
**Owner:** Sanjay Mudoshi
**Review Cycle:** Annual

## 1. Access Control Policy
- All users authenticate via Sanctum bearer tokens (8-hour expiry).
- New accounts receive `viewer` (read-only) role. Promotion requires admin action.
- Passwords: minimum 8 characters, bcrypt 12 rounds, forced change on first login.
- SSH: key-based authentication only. Password auth disabled.
- Service accounts: credentials via environment variables, never hardcoded.
- Administrative access (Horizon, system config) restricted to `super-admin` role.

## 2. Data Classification
- **ePHI (Critical):** OMOP CDM person, visit, drug, condition, procedure, measurement,
  observation, note, death tables. DICOM medical images. Any data linkable to an individual.
- **Sensitive:** API keys, database credentials, encryption keys, Wazuh alerts.
- **Internal:** Cohort definitions, analysis configurations, study metadata.
- **Public:** Vocabulary data (standardized concepts), documentation, open-source code.

## 3. Acceptable Use
- Parthenon is used exclusively for authorized outcomes research on approved datasets.
- No PHI may be exported, shared, or transmitted outside the platform without authorization.
- No personal devices may connect directly to the database.
- All access is logged and subject to audit review.

## 4. Incident Response (see separate IR Plan)
- Security incidents must be reported immediately.
- Containment, eradication, recovery, and lessons-learned steps are documented.
- HIPAA breach notification timelines: 60 days to HHS, affected individuals, and media (if >500).

## 5. Data Retention and Disposal
- Clinical data (OMOP CDM): retained for the duration of active research plus 6 years (HIPAA).
- Backups: 30-day rolling retention. Offsite copies encrypted.
- Disposal: `shred -vfz -n 5` for files. `pg_dump` schemas dropped with `CASCADE`.
- Decommissioned drives: NIST 800-88 media sanitization (degauss or destroy).

## 6. Change Management
- All code changes go through git with conventional commits.
- Pre-commit hooks enforce Pint, PHPStan (level 8), and TypeScript checks.
- Infrastructure changes documented in architecture decision records.
- Docker image rebuilds require explicit version pinning.

## 7. Encryption
- In transit: TLS 1.2+ on all connections (Apache SSL, PostgreSQL SSL, Redis TLS).
- At rest: LUKS on data volumes (in progress). PostgreSQL WAL not separately encrypted.
- Secrets: `.env` files chmod 600, never committed to git.
```

---

### 3.3 Incident Response Plan

**Gap:** No written IR plan.
**Framework:** HIPAA 164.308(a)(6).
**Effort:** 2 hours.
**Output:** `docs/compliance/incident-response-plan.md`

```markdown
# Parthenon Incident Response Plan
**Effective:** 2026-04-XX
**Incident Commander:** Sanjay Mudoshi
**Contact:** smudoshi@gmail.com

## 1. Definitions
- **Security Incident:** Any event that compromises the confidentiality, integrity,
  or availability of Parthenon systems or data.
- **Breach:** A security incident resulting in unauthorized access to, or disclosure of, ePHI.

## 2. Detection
Sources of incident detection:
- Wazuh SIEM alerts (47K+ HIPAA-tagged events, real-time)
- Wazuh file integrity monitoring (syscheck on /etc, /usr, .ssh, .env)
- YARA real-time malware scanning
- fail2ban intrusion alerts
- Application error logs (Laravel, FastAPI)
- User reports

## 3. Classification

| Severity | Definition | Response Time |
|----------|-----------|---------------|
| Critical | Confirmed ePHI breach, active intrusion, ransomware | Immediate |
| High | Suspected breach, privilege escalation, data exfiltration attempt | < 1 hour |
| Medium | Failed intrusion attempt, policy violation, suspicious activity | < 4 hours |
| Low | Vulnerability discovered, configuration drift, minor policy deviation | < 24 hours |

## 4. Response Procedure

### Phase 1: Containment (0–30 minutes)
1. Assess scope: which systems, which data, which users affected
2. Isolate compromised systems: `docker compose stop <service>` or UFW block
3. Revoke compromised credentials: Sanctum token revocation, SSH key removal
4. Preserve evidence: snapshot logs, database state, filesystem timestamps

### Phase 2: Eradication (30 min – 4 hours)
1. Identify root cause (Wazuh alerts, access logs, application logs)
2. Remove malware/unauthorized access
3. Patch vulnerability or misconfiguration
4. Rotate all potentially compromised credentials

### Phase 3: Recovery (4–24 hours)
1. Restore from verified backup if data integrity is compromised
2. Rebuild affected containers from known-good images
3. Verify system integrity (Wazuh syscheck, CIS SCA scan)
4. Monitor closely for 48 hours post-recovery

### Phase 4: Post-Incident (1–7 days)
1. Document timeline, actions taken, root cause, and remediation
2. Update risk assessment if new threats identified
3. Implement preventive controls
4. Conduct lessons-learned review

## 5. HIPAA Breach Notification
If ePHI was accessed or disclosed without authorization:
- **Individual notice:** Within 60 days of discovery, written notification to affected individuals
- **HHS notice:** Within 60 days via HHS breach portal (hhs.gov/hipaa/for-professionals/breach-notification)
- **Media notice:** Required if breach affects 500+ individuals in a single state/jurisdiction
- **Documentation:** Maintain breach log for 6 years

## 6. Contact List

| Role | Name | Contact |
|------|------|---------|
| Incident Commander | Sanjay Mudoshi | smudoshi@gmail.com |
| Hosting Provider | [Provider name] | [Support contact] |
| Legal Counsel | [Attorney name] | [Contact] |
| Cyber Insurance | [Carrier name] | [Policy #, claims line] |

## 7. Annual Testing
- Tabletop exercise: annually (simulate a breach scenario, walk through response)
- Technical drill: annually (test backup restore, credential rotation, container rebuild)
- Plan review: after every real incident and at minimum annually
```

---

### 3.4 Contingency / Disaster Recovery Plan

**Gap:** No written DR plan (backup script exists, plan does not).
**Framework:** HIPAA 164.308(a)(7).
**Effort:** 1.5 hours.
**Output:** `docs/compliance/disaster-recovery-plan.md`

```markdown
# Parthenon Disaster Recovery Plan
**Effective:** 2026-04-XX
**Recovery Point Objective (RPO):** 24 hours (daily backups)
**Recovery Time Objective (RTO):** 4 hours

## 1. Backup Inventory

| Component | Backup Method | Schedule | Retention | Location |
|-----------|--------------|----------|-----------|----------|
| PostgreSQL (all schemas) | pg_dump via db-backup.sh | Daily 3:17 AM | 30 days | /backups/ |
| PostgreSQL (base backup) | pg-host-basebackup.sh | Weekly | 4 weeks | /backups/ |
| Wazuh config | wazuh-backup.sh | Weekly Sun 4 AM | 4 weeks | /backups/ |
| Application code | Git (GitHub) | Every commit | Indefinite | GitHub |
| Docker images | docker-compose.yml rebuild | On demand | N/A | Dockerfiles in repo |
| .env / secrets | Manual encrypted copy | On change | Current | Offsite encrypted |

## 2. Recovery Procedures

### Scenario A: Database Corruption
1. Stop application: `docker compose down`
2. Identify last clean backup: `ls -lt backups/*.sql`
3. Restore: `psql parthenon < backups/YYYY-MM-DD_HH-MM.sql`
4. Verify row counts against backup manifest JSON
5. Restart: `docker compose up -d`
6. Verify: `curl https://parthenon.acumenus.net/api/v1/health`

### Scenario B: Full Server Loss
1. Provision new Ubuntu 24.04 server
2. Clone repo: `git clone [repo-url]`
3. Run installer: `python3 install.py --with-infrastructure`
4. Restore .env from encrypted offsite copy
5. Restore database from offsite backup
6. Restore LUKS keyfile or re-encrypt data volume
7. Configure DNS for parthenon.acumenus.net
8. Run deploy.sh
9. Verify all 16 Docker services healthy: `docker compose ps`

### Scenario C: Single Container Failure
1. Check which service failed: `docker compose ps`
2. Check logs: `docker compose logs <service>`
3. Restart: `docker compose restart <service>`
4. If persistent: rebuild image: `docker compose build <service> && docker compose up -d <service>`

## 3. Testing Schedule
- Monthly: verify backup file existence and integrity JSON
- Quarterly: full restore test to a separate database
- Annually: full DR drill (simulate server loss, rebuild from scratch)
```

---

### 3.5 Audit Controls Documentation

**Gap:** Controls exist (Wazuh) but review process not documented.
**Framework:** HIPAA 164.312(b).
**Effort:** 1 hour.
**Output:** `docs/compliance/audit-controls.md`

```markdown
# Parthenon Audit Controls
**Effective:** 2026-04-XX

## 1. Audit Log Sources

| Source | What It Captures | Retention |
|--------|-----------------|-----------|
| Wazuh SIEM | System events, file changes, auth failures, CVEs, HIPAA-tagged events | 90 days (configurable) |
| Apache access/error logs | All HTTP requests to parthenon.acumenus.net | 90 days |
| Laravel application logs | API requests, auth events, job execution, errors | 30 days |
| PostgreSQL logs | Slow queries, connection events, errors | 30 days |
| Docker container logs | Per-service stdout/stderr | Via Loki/Alloy stack |
| SSH auth logs | All SSH connection attempts (VERBOSE) | 90 days (via Wazuh) |
| fail2ban logs | Blocked IPs, ban/unban events | 90 days |

## 2. Review Schedule

| Review | Frequency | Reviewer | What to Check |
|--------|-----------|----------|---------------|
| Wazuh HIPAA dashboard | Weekly | Sanjay | New critical/high alerts, unresolved incidents |
| Failed login attempts | Weekly | Sanjay | Patterns suggesting brute force or credential stuffing |
| Vulnerability scan results | Weekly | Sanjay | New CVEs, unpatched packages |
| CIS SCA compliance score | Monthly | Sanjay | Regression from baseline, new failures |
| User access review | Quarterly | Sanjay | Verify role assignments are current, remove stale accounts |
| Full audit log review | Quarterly | Sanjay | Sample 50 events, verify logging completeness |

## 3. Review Procedure
1. Log into Wazuh dashboard
2. Navigate to HIPAA compliance dashboard
3. Review all alerts since last review
4. For each unresolved alert: investigate, document finding, remediate or accept risk
5. Record review completion in this document's appendix (date, reviewer, findings)

## 4. Review Log
| Date | Reviewer | Findings | Actions Taken |
|------|----------|----------|---------------|
| | | | |
```

---

### 3.6 Workforce Security Training

**Gap:** No training documentation.
**Framework:** HIPAA 164.308(a)(5).
**Effort:** 30 minutes (for self-attestation as a sole operator).
**Output:** `docs/compliance/workforce-training.md`

```markdown
# Parthenon Workforce Security Awareness Training
**Effective:** 2026-04-XX

## 1. Training Topics
All personnel with access to Parthenon must understand:
- What constitutes ePHI and how it's protected in the system
- RBAC roles and the principle of least privilege
- Password policy and forced-change flow
- How to report a suspected security incident
- Acceptable use of clinical data
- Data retention and disposal procedures

## 2. Training Completion Log
| Name | Role | Date Completed | Method | Next Due |
|------|------|----------------|--------|----------|
| Sanjay Mudoshi | Super-admin / Developer | 2026-04-XX | Self-study + attestation | 2027-04-XX |

## 3. Attestation
I have reviewed and understand the Parthenon Security Policies, Incident Response Plan,
and Data Retention Policy. I understand my responsibilities for protecting ePHI.

Signature: _________________________ Date: ___________
```

---

### 3.7 Business Associate Agreements (BAA)

**Gap:** BAAs needed if any third party touches ePHI.
**Framework:** HIPAA 164.308(b)(1).
**Effort:** Varies (legal).
**Output:** Inventory + action items.

Audit your third-party relationships:

| Service | Touches ePHI? | BAA Needed? | Status |
|---------|--------------|-------------|--------|
| Hosting provider (server) | Yes (hosts DB) | Yes | [Check if in place] |
| Resend (email service) | No (sends temp passwords, no PHI) | No | N/A |
| GitHub (code hosting) | No (PHI not in code) | No | N/A |
| Let's Encrypt (SSL certs) | No | No | N/A |
| Anthropic (Claude API) | Depends on usage | If Abby processes PHI | [Review] |

Action: For each "Yes" — contact the vendor, request their BAA, execute it, and file it in `docs/compliance/baas/`.

---

## 14-Day Timeline

| Day | Tasks | Estimated Hours |
|-----|-------|----------------|
| **1** | Wave 1: HSTS header, XSS header, patch Thunderbird, upgrade Python packages, schedule cron backups | 1 hr |
| **2** | Wave 2.1: CSP header (report-only mode), begin testing across all features | 2 hrs |
| **3** | Wave 2.1: Finalize CSP (switch to enforcing). Wave 2.4: CIS SCA remediation | 2 hrs |
| **4** | Wave 2.3: Backup restore verification. Document results. | 1 hr |
| **5** | Wave 2.2: LUKS encryption planning — full backup, verify, schedule maintenance window | 2 hrs |
| **6** | Wave 2.2: Execute LUKS encryption during maintenance window | 3 hrs |
| **7** | Wave 2.2: Verify encrypted volume stability. Monitor for 24 hrs. | 0.5 hr |
| **8** | Wave 3.1: Write Risk Assessment document | 3 hrs |
| **9** | Wave 3.2: Write Security Policies document | 3 hrs |
| **10** | Wave 3.3: Write Incident Response Plan | 2 hrs |
| **11** | Wave 3.4: Write Disaster Recovery Plan | 1.5 hrs |
| **12** | Wave 3.5: Write Audit Controls documentation. Wave 3.6: Training attestation. | 1.5 hrs |
| **13** | Wave 3.7: BAA inventory and outreach. Review all documents. | 2 hrs |
| **14** | Final verification: run full checklist (§ below). Fix any gaps. | 2 hrs |

**Total estimated effort:** ~26 hours over 14 days.

---

## Final Verification Checklist

Run this on Day 14 to confirm everything is in place:

```bash
# === Technical Controls ===

# 1. HSTS header present
curl -sI https://parthenon.acumenus.net | grep -i "strict-transport-security"

# 2. CSP header present
curl -sI https://parthenon.acumenus.net | grep -i "content-security-policy"

# 3. X-XSS-Protection present
curl -sI https://parthenon.acumenus.net | grep -i "x-xss-protection"

# 4. Thunderbird removed or updated
dpkg -l | grep thunderbird

# 5. Python packages patched
docker compose exec python-ai pip show onnx langchain-core pypdf pyasn1 | grep Version

# 6. Automated backups running
crontab -l | grep backup
ls -lt backups/*.sql | head -3  # Should show recent daily backups

# 7. Backup restore tested
cat backups/restore-verification.log

# 8. LUKS encryption active
lsblk -f | grep crypt
# Or: cryptsetup status md0_crypt

# 9. CIS SCA score improved
# Check Wazuh dashboard > Configuration Assessment

# === Documentation ===

# 10. All compliance docs exist
ls -la docs/compliance/
# Expected: risk-assessment.md, security-policies.md, incident-response-plan.md,
#           disaster-recovery-plan.md, audit-controls.md, workforce-training.md

# 11. Documents are populated (not just templates)
wc -l docs/compliance/*.md

# === Ongoing ===

# 12. Wazuh still monitoring
docker compose exec wazuh-manager /var/ossec/bin/agent_control -l

# 13. All Docker services healthy
docker compose ps --format "table {{.Name}}\t{{.Status}}"

# 14. Sanctum token expiration still set
grep 'expiration' backend/config/sanctum.php
```

---

## Directory Structure for Compliance Docs

```
docs/
  compliance/
    risk-assessment.md
    security-policies.md
    incident-response-plan.md
    disaster-recovery-plan.md
    audit-controls.md
    workforce-training.md
    baas/                          # Executed BAA documents (PDF/scan)
    evidence/                      # Screenshots, Wazuh exports, scan results
      wazuh-hipaa-dashboard.png
      cis-sca-results.png
      backup-restore-test.log
      vulnerability-scan.pdf
```

Create this structure now:

```bash
mkdir -p docs/compliance/baas docs/compliance/evidence
```

---

## Key Insight

The technical security posture is strong — Wazuh, RBAC, SSL, non-root containers, fail2ban, YARA, and file integrity monitoring put you well ahead of most HIPAA-covered entities. The 14-day sprint is primarily about wrapping those controls in the documentation that auditors need to see: written policies, a risk assessment that references your actual controls, and evidence of regular review. Wazuh provides most of the evidence automatically. The documents formalize the process around it.
