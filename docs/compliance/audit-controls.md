# Parthenon Audit Controls Documentation

**Document ID:** PARTH-AC-001
**Effective Date:** 2026-04-04
**Owner:** Sanjay Mudoshi
**Review Cycle:** Annual (next review: 2027-04-04)
**Status:** Active
**Framework References:** HIPAA §164.312(b), NIST SP 800-53 AU-1 through AU-12

---

## 1. Purpose

This document describes the audit controls implemented in Parthenon, the log sources that capture security-relevant events, the review procedures that ensure these logs are monitored, and the evidence trail that demonstrates ongoing compliance. It satisfies the HIPAA Security Rule requirement to implement hardware, software, and/or procedural mechanisms to record and examine activity in information systems that contain or use ePHI.

---

## 2. Audit Log Sources

### 2.1 Security Information and Event Management (SIEM)

**System:** Wazuh (open-source SIEM)
**Coverage:** 47,000+ HIPAA-tagged events as of assessment date

| Wazuh Module | What It Captures | HIPAA Mapping |
|---|---|---|
| Log collection | System events from all monitored hosts and containers | §164.312(b) — audit controls |
| File integrity monitoring (Syscheck) | Changes to /etc, /usr, .ssh, .env, critical config files | §164.312(c)(1) — integrity |
| Vulnerability detection | CVE inventory across installed packages (144 tracked) | NIST RA-5 |
| CIS SCA | Compliance scoring against CIS Ubuntu 24.04 + CIS Apache benchmarks | NIST CM-6 |
| Rootkit detection | Hidden processes, files, and kernel-level modifications | NIST SI-3 |
| Active response | Automatic blocking of IPs after threshold violations | §164.312(a)(1) — access control |
| Container monitoring | Docker container lifecycle events, resource anomalies (rule 100043) | NIST CM-7 |

### 2.2 Application-Level Audit Logs

| Source | What It Captures | Retention | Location |
|---|---|---|---|
| **UserAuditLog** (Laravel model) | Login, logout, password change, role assignment/revocation, account creation, failed login attempts | Database (indefinite) | `app.user_audit_logs` table |
| **Laravel application logs** | API requests, exceptions, job execution results, authentication events | 30 days | `backend/storage/logs/laravel.log` |
| **FastAPI logs** | AI service requests, embedding operations, LLM queries | 30 days | Container stdout → Loki |
| **R runtime logs** | HADES analytics execution, Plumber API requests | 30 days | Container stdout → Loki |

### 2.3 Infrastructure Logs

| Source | What It Captures | Retention | Location |
|---|---|---|---|
| **Apache access log** | All HTTPS requests to parthenon.acumenus.net (IP, method, path, status, user agent) | 90 days | `/var/log/apache2/access.log` |
| **Apache error log** | Server errors, SSL issues, proxy failures | 90 days | `/var/log/apache2/error.log` |
| **Nginx access log** | All internal proxy requests (forwarded from Apache) | 90 days | Container stdout → Loki |
| **PostgreSQL logs** | Slow queries (>1s), connection events, authentication failures, errors | 30 days | PostgreSQL log directory |
| **Redis logs** | Authentication failures, connection events, memory warnings | 30 days | Container stdout → Loki |
| **SSH auth log** | All SSH connection attempts (VERBOSE level), key fingerprints, success/failure | 90 days (via Wazuh) | `/var/log/auth.log` |
| **fail2ban log** | IP bans, unbans, jail activity | 90 days | `/var/log/fail2ban.log` |
| **Docker daemon log** | Container start/stop/crash events, image pulls, network changes | 30 days | `journalctl -u docker` |

### 2.4 Monitoring and Metrics

| Source | What It Captures | Retention | Access |
|---|---|---|---|
| **Prometheus** | CPU, memory, disk, network metrics; PostgreSQL connection counts and query duration; Redis memory usage; container resource consumption | 15 days (default) | http://localhost:9090 |
| **Grafana** | Dashboards and alert history for all Prometheus metrics | Dashboard configs indefinite; data per Prometheus retention | http://localhost:3000 (auth required) |
| **Loki** | Aggregated container logs from all 29 services (collected by Alloy) | 30 days | Via Grafana |
| **cAdvisor** | Per-container CPU, memory, network, filesystem metrics | Real-time | http://localhost:8080 |

---

## 3. Events That Must Be Logged

The following events are considered security-relevant and must be captured:

### 3.1 Authentication Events

| Event | Logged By | Log Location |
|---|---|---|
| Successful login | UserAuditLog + Wazuh | `app.user_audit_logs` + Wazuh alerts |
| Failed login attempt | UserAuditLog + Wazuh + fail2ban | `app.user_audit_logs` + Wazuh alerts + fail2ban.log |
| Account lockout (rate limit triggered) | Laravel throttle middleware | Laravel application log |
| Password change | UserAuditLog | `app.user_audit_logs` |
| Password reset request | UserAuditLog | `app.user_audit_logs` |
| Token creation | Sanctum (implicit) | Database `personal_access_tokens` table |
| Token expiration/revocation | Sanctum (implicit) | Token deleted from `personal_access_tokens` |
| SSH login attempt | sshd (VERBOSE) | `/var/log/auth.log` → Wazuh |

### 3.2 Authorization Events

| Event | Logged By | Log Location |
|---|---|---|
| Role assigned to user | UserAuditLog | `app.user_audit_logs` |
| Role removed from user | UserAuditLog | `app.user_audit_logs` |
| Permission denied (403) | Laravel middleware | Laravel application log |
| Horizon dashboard access attempt | HorizonServiceProvider Gate | Laravel application log |

### 3.3 Data Access Events

| Event | Logged By | Log Location |
|---|---|---|
| API request to ePHI endpoint | Apache/Nginx access logs | Access logs → Loki |
| Patient profile viewed | Application logging | Laravel application log |
| DICOM image retrieved | Orthanc + Nginx proxy logs | Nginx log → Loki |
| Cohort generated (SQL execution) | Laravel job logging | Laravel application log |
| Analysis executed | Laravel job logging | Laravel application log + Horizon |
| Data export | Application logging | Laravel application log |

### 3.4 System Events

| Event | Logged By | Log Location |
|---|---|---|
| File modified in monitored path | Wazuh syscheck | Wazuh alerts |
| Malware detected | YARA + Loki-RS | Wazuh alerts |
| CVE discovered | Wazuh vulnerability detection | Wazuh alerts |
| Container crash/restart | Docker daemon + Prometheus | Docker logs + Grafana alerts |
| Disk space warning | Prometheus + node-exporter | Grafana alerts |
| Database connection spike | postgres-exporter | Grafana alerts |
| Backup execution | db-backup.sh | `backups/cron.log` |

---

## 4. Log Protection

### 4.1 Integrity

- Wazuh SIEM stores events in its own indexed format, separate from the application. Tampering with application logs does not affect Wazuh's copy.
- Wazuh file integrity monitoring (syscheck) detects changes to log configuration files.
- Docker container logs are collected by Alloy and shipped to Loki, providing a second copy independent of the container filesystem.

### 4.2 Access Control

- Wazuh dashboard access requires authentication.
- Grafana anonymous access is disabled (`GF_AUTH_ANONYMOUS_ENABLED=false`).
- Horizon dashboard is gated to `super-admin` role only.
- Production log files on the server are readable only by root and the relevant service user.

### 4.3 Retention

| Log Type | Online Retention | Archive Retention |
|---|---|---|
| Wazuh alerts | 90 days | 1 year (recommended) |
| Application logs | 30 days | N/A (operational) |
| Apache/Nginx access logs | 90 days | 1 year (recommended) |
| SSH auth logs | 90 days (via Wazuh) | 1 year (recommended) |
| Prometheus metrics | 15 days | N/A (metrics are aggregated) |
| Loki logs | 30 days | N/A |
| Backup execution logs | Indefinite (append-only) | N/A |

---

## 5. Review Schedule

| Review Activity | Frequency | Reviewer | Time Estimate | Focus Areas |
|---|---|---|---|---|
| **Wazuh HIPAA dashboard review** | Weekly | Sanjay Mudoshi | 30 min | New critical/high alerts, unresolved incidents, HIPAA-tagged event trends |
| **Failed authentication review** | Weekly | Sanjay Mudoshi | 15 min | Patterns suggesting brute force, credential stuffing, or unauthorized access attempts |
| **Vulnerability scan review** | Weekly | Sanjay Mudoshi | 15 min | New CVEs, critical/high findings, patch status |
| **CIS SCA compliance review** | Monthly | Sanjay Mudoshi | 30 min | Score changes from baseline, new failures, remediation progress |
| **User access review** | Quarterly | Sanjay Mudoshi | 1 hour | Verify role assignments are current, identify inactive accounts (90+ days), remove stale accounts, confirm no unauthorized privilege escalations |
| **Full audit log sampling** | Quarterly | Sanjay Mudoshi | 1 hour | Randomly sample 50 security events, verify they were logged correctly in all expected locations, check for gaps in logging coverage |
| **Backup verification** | Monthly | Sanjay Mudoshi | 15 min | Verify backup files exist, timestamps are current, integrity JSON has valid counts |
| **Backup restore test** | Quarterly | Sanjay Mudoshi | 1 hour | Full restore to temporary database, row count comparison against manifest |

---

## 6. Review Procedures

### 6.1 Weekly Wazuh Review

```
1. Log into Wazuh dashboard
2. Navigate to: Modules > Security Events > HIPAA
3. Set time range to "Last 7 days"
4. Review:
   a. Total event count (compare to previous week — sudden spikes indicate issues)
   b. Critical and High severity alerts (each must be investigated)
   c. Top 10 alert rules triggered (identify recurring issues)
   d. Top source IPs for security events (identify potential attackers)
5. For each unresolved critical/high alert:
   a. Investigate root cause
   b. Determine if containment is needed
   c. Document finding and action taken
6. Navigate to: Modules > Vulnerability Detection
7. Review new vulnerabilities since last check
8. Triage any Critical/High CVEs per vulnerability management policy
9. Record review completion in the Review Log (§7)
```

### 6.2 Quarterly User Access Review

```
1. Query active users:
   SELECT id, name, email, last_login_at, created_at
   FROM app.users
   ORDER BY last_login_at DESC;

2. For each user, verify:
   a. The account is still needed (person is still active in the organization)
   b. The assigned roles are appropriate for current responsibilities
   c. No unexpected role escalations have occurred

3. Identify inactive accounts (no login in 90+ days):
   SELECT id, name, email, last_login_at
   FROM app.users
   WHERE last_login_at < NOW() - INTERVAL '90 days'
   OR last_login_at IS NULL;

4. For each inactive account: disable or delete per data retention policy

5. Verify the super-admin account (admin@acumenus.net) still exists and is functional

6. Document findings and actions in the Review Log (§7)
```

### 6.3 Quarterly Audit Log Sampling

```
1. Select 50 random security events from the past quarter:
   a. 15 authentication events (login success, login failure, password change)
   b. 10 authorization events (permission denied, role changes)
   c. 10 data access events (API requests to ePHI endpoints)
   d. 10 system events (file integrity, vulnerability, container events)
   e. 5 backup events (execution logs)

2. For each sampled event, verify:
   a. The event was captured in the expected log source
   b. The event contains sufficient detail (who, what, when, where, outcome)
   c. The event timestamp is accurate
   d. If the event should appear in multiple logs (e.g., login in both
      UserAuditLog and Wazuh), verify it appears in all expected locations

3. Document any gaps found and create remediation tasks

4. Record sampling results in the Review Log (§7)
```

---

## 7. Review Log

Record each review activity below. This log serves as evidence of ongoing audit control operation for HIPAA compliance.

| Date | Review Type | Reviewer | Findings | Actions Taken | Next Review Due |
|---|---|---|---|---|---|
| | | | | | |

---

## 8. Alerting Configuration

### 8.1 Automated Alerts

| Alert Condition | Detection System | Notification Method |
|---|---|---|
| Critical Wazuh alert | Wazuh active response | Email alert (configured in Wazuh manager) |
| Multiple failed SSH logins | fail2ban | Automatic IP ban + Wazuh alert |
| File integrity change on critical path | Wazuh syscheck | Real-time Wazuh alert |
| YARA malware detection | Wazuh + YARA | Real-time Wazuh alert |
| Container crash (repeated) | Prometheus + Grafana | Grafana alert rule |
| Disk usage > 85% | Prometheus + node-exporter | Grafana alert rule |
| Database connection count anomaly | postgres-exporter | Grafana alert rule |

### 8.2 Alert Response

All automated alerts must be reviewed within their severity-appropriate timeframe (per Incident Response Plan §4.2). Alerts that are determined to be false positives should be documented and, if recurring, the alert rule should be tuned to reduce noise while maintaining detection capability.

---

## 9. Compliance Evidence Collection

For audits and assessments, the following evidence can be produced:

| Evidence Type | Source | How to Produce |
|---|---|---|
| Authentication activity report | Wazuh HIPAA dashboard | Export: Modules > HIPAA > Authentication events > CSV |
| Access control inventory | `app.model_has_roles` table | `SELECT * FROM app.model_has_roles JOIN app.users ON ...` |
| Vulnerability status | Wazuh vulnerability detection | Export: Modules > Vulnerability Detection > CSV |
| Configuration compliance score | Wazuh CIS SCA | Export: Modules > Configuration Assessment > CSV |
| File integrity baselines | Wazuh syscheck | Export: Modules > Integrity Monitoring > CSV |
| Backup execution history | `backups/cron.log` | `cat backups/cron.log` |
| Restore test results | `backups/restore-verification.log` | `cat backups/restore-verification.log` |
| Incident history | `docs/compliance/evidence/incidents/` | Directory listing |
| Review log | This document §7 | This document |

Store exported evidence in `docs/compliance/evidence/` with dated filenames.

---

## 10. Plan Maintenance

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-04-04 | Sanjay Mudoshi | Initial release |

---

## 11. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Document Owner | Sanjay Mudoshi | _________________________ | __________ |
| Reviewer | | _________________________ | __________ |
