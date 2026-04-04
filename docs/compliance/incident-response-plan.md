# Parthenon Incident Response Plan

**Document ID:** PARTH-IR-001
**Effective Date:** 2026-04-04
**Incident Commander:** Sanjay Mudoshi
**Review Cycle:** Annual and after every incident (next review: 2027-04-04)
**Status:** Active
**Framework References:** HIPAA §164.308(a)(6), NIST SP 800-53 IR-1 through IR-8

---

## 1. Purpose

This plan establishes procedures for detecting, responding to, containing, eradicating, and recovering from security incidents affecting the Parthenon outcomes research platform. It ensures that incidents are handled in a manner that minimizes damage to ePHI, reduces recovery time, and meets HIPAA breach notification requirements.

---

## 2. Scope

This plan covers all security events affecting the systems, networks, and data stores that comprise Parthenon, including the 29 Docker containers, PostgreSQL database (all schemas), the production server at `parthenon.acumenus.net`, and any connected infrastructure (Wazuh SIEM, Traefik, monitoring stack).

---

## 3. Roles and Responsibilities

| Role | Person | Responsibilities |
|---|---|---|
| **Incident Commander** | Sanjay Mudoshi | Overall incident ownership: detection triage, containment decisions, communication, documentation, post-incident review |
| **Technical Responder** | Sanjay Mudoshi | System investigation, log analysis, containment actions, eradication, recovery |
| **Legal Counsel** | *[To be designated]* | Breach notification compliance, regulatory communication, BAA review |
| **Hosting Provider** | *[Provider support]* | Hardware-level response, network-level blocking, physical security |

Note: In the current single-person operations model, the Incident Commander and Technical Responder are the same person. If the team grows, these roles should be separated.

---

## 4. Incident Classification

### 4.1 Definition

A **security incident** is any event that compromises — or has the potential to compromise — the confidentiality, integrity, or availability of Parthenon's systems or data.

A **breach** is a security incident that results in the unauthorized acquisition, access, use, or disclosure of ePHI in a manner not permitted by the HIPAA Privacy Rule.

### 4.2 Severity Levels

| Severity | Definition | Examples | Response Time |
|---|---|---|---|
| **Critical** | Confirmed ePHI breach, active intrusion, ransomware, data exfiltration | Unauthorized access to OMOP CDM person/visit tables; ransomware encrypting database; stolen database dump appearing externally | **Immediate** (within 15 minutes of detection) |
| **High** | Suspected breach, privilege escalation, persistent unauthorized access attempt | Multiple failed auth attempts from same IP followed by success; Docker container escape; unauthorized role elevation; Orthanc images accessed without auth token | **< 1 hour** |
| **Medium** | Blocked intrusion attempt, policy violation, suspicious activity not involving ePHI | fail2ban blocking repeated SSH attempts; YARA malware detection (contained); CIS SCA compliance regression; unauthorized software installation | **< 4 hours** |
| **Low** | Vulnerability discovered, configuration drift, minor policy deviation | New CVE in dependency; expired SSL certificate (before exposure); misconfigured file permissions; Wazuh syscheck alert on non-critical file | **< 24 hours** |

---

## 5. Detection Sources

Parthenon has multiple overlapping detection mechanisms:

| Source | What It Detects | Alert Mechanism |
|---|---|---|
| **Wazuh SIEM** | Authentication failures, file integrity changes, CVEs, HIPAA-tagged events, rootkit detection, container anomalies | Real-time alerts (47,000+ HIPAA-tagged events) |
| **Wazuh Syscheck** | File modifications in /etc, /usr, .ssh, .env | Real-time alerts on FIM events |
| **YARA Engine** | Known malware patterns in real-time file scanning | Alert on detection |
| **Loki-RS** | Malware binary sweeps across filesystem | Scheduled sweep results |
| **fail2ban** | SSH brute force, Apache/Nginx abuse, repeated auth failures | Automatic IP banning + log entries |
| **Laravel Audit Log** | UserAuditLog: login, logout, password change, role change events | Database entries queryable via API |
| **Apache/Nginx Logs** | HTTP requests, response codes, referrers, user agents | Collected by Alloy → Loki → Grafana |
| **Docker Health Checks** | Container failures, resource exhaustion | `docker compose ps` status changes |
| **Prometheus/Grafana** | CPU, memory, disk, network anomalies; PostgreSQL connection counts; Redis memory | Alert rules in Grafana |
| **Application Errors** | Laravel exceptions, FastAPI errors, R runtime failures | Log files + Loki aggregation |
| **User Reports** | Anything users notice that seems wrong | Email to Incident Commander |

---

## 6. Response Procedures

### Phase 1: Detection and Triage (0–15 minutes)

**Objective:** Confirm the incident is real and classify its severity.

1. **Receive alert** from any detection source listed in §5.
2. **Verify the alert** — determine if it's a true positive or false positive:
   - Check Wazuh dashboard for correlated events
   - Review relevant logs (`docker compose logs <service>`, Apache access logs, Laravel logs)
   - Check `docker compose ps` for service health
3. **Classify severity** per §4.2.
4. **Open an incident record** — create a timestamped entry in `docs/compliance/evidence/incidents/`:
   ```
   docs/compliance/evidence/incidents/YYYY-MM-DD-short-description.md
   ```
   Record: date/time detected, detection source, initial classification, affected systems.

### Phase 2: Containment (15 minutes – 1 hour)

**Objective:** Stop the incident from spreading. Preserve evidence.

**Immediate containment actions (choose as appropriate):**

| Scenario | Containment Action |
|---|---|
| Compromised user account | Revoke all Sanctum tokens: `DELETE FROM personal_access_tokens WHERE tokenable_id = <user_id>` |
| Compromised container | `docker compose stop <service>` |
| Active network intrusion | `sudo ufw deny from <IP>` or `sudo fail2ban-client set <jail> banip <IP>` |
| Suspected database breach | `docker compose stop php nginx` (cut API access while preserving DB for forensics) |
| Malware detected | Isolate affected files. Do NOT delete — preserve for analysis. |
| SSH compromise | `sudo systemctl stop sshd` (use console access), rotate SSH keys |
| Full system compromise | Take the server offline at the hosting provider level |

**Evidence preservation:**
```bash
# Snapshot current state
docker compose ps > /tmp/incident-docker-state.txt
docker compose logs --since 1h > /tmp/incident-docker-logs.txt
sudo cp /var/log/auth.log /tmp/incident-auth.log
sudo cp /var/log/apache2/access.log /tmp/incident-apache.log

# Wazuh alert export
# Export from Wazuh dashboard: Events > filter by time range > export CSV

# Database state (if DB is suspected compromised but not yet encrypted by ransomware)
sudo -u postgres pg_dump parthenon > /tmp/incident-db-snapshot.sql
```

### Phase 3: Eradication (1–4 hours)

**Objective:** Remove the threat and close the vulnerability.

1. **Identify root cause** — analyze logs, Wazuh alerts, and preserved evidence.
2. **Remove the threat:**
   - Delete malware files identified by YARA/Loki-RS
   - Remove unauthorized user accounts or role assignments
   - Revert unauthorized configuration changes (check Wazuh syscheck for file diffs)
3. **Patch the vulnerability:**
   - Apply security updates (`apt upgrade`, `pip install --upgrade`, `composer update`)
   - Fix misconfiguration (firewall rules, file permissions, Docker settings)
   - Update application code if the vulnerability is in Parthenon itself
4. **Rotate credentials:**
   - Database password (`DB_PASSWORD` in `.env`)
   - Redis password (`REDIS_PASSWORD` in `.env`)
   - Sanctum application key (`APP_KEY` in `.env`)
   - SSH keys (if SSH was compromised)
   - Any API keys that may have been exposed
   - **Remember:** `docker compose restart` does NOT reload `.env` — you must run `docker compose up -d` to recreate containers with new credentials.

### Phase 4: Recovery (4–24 hours)

**Objective:** Restore normal operations and verify system integrity.

1. **Restore from backup** if data integrity was compromised:
   ```bash
   # Identify last clean backup (before incident start time)
   ls -lt backups/*.sql

   # Restore to production
   docker compose down
   sudo -u postgres psql parthenon < backups/YYYY-MM-DD_HH-MM.sql
   docker compose up -d
   ```
2. **Rebuild containers** if container images were compromised:
   ```bash
   docker compose build --no-cache <service>
   docker compose up -d <service>
   ```
3. **Verify system integrity:**
   - Run Wazuh syscheck scan: wait for next scheduled scan or trigger manually
   - Run CIS SCA benchmark check
   - Verify all 29 containers healthy: `docker compose ps`
   - Verify API health: `curl https://parthenon.acumenus.net/api/v1/health`
   - Verify database integrity: compare row counts against backup manifest
4. **Monitor closely** for 48 hours post-recovery. Watch for:
   - Recurring alerts from the same detection source
   - New alerts that suggest the attacker maintained persistence
   - Performance anomalies suggesting hidden processes

### Phase 5: Post-Incident Review (1–7 days after resolution)

**Objective:** Learn from the incident and improve defenses.

1. **Complete the incident record** with:
   - Full timeline (detection → containment → eradication → recovery)
   - Root cause analysis
   - Data affected (schemas, tables, record counts)
   - Whether ePHI was accessed or disclosed
   - All actions taken with timestamps
   - What worked well in the response
   - What could be improved
2. **Update security controls:**
   - Add new Wazuh rules if the detection was delayed
   - Update firewall rules if network controls were insufficient
   - Strengthen the specific vulnerability that was exploited
3. **Update documentation:**
   - Revise this IR plan if procedures were inadequate
   - Update risk assessment (docs/compliance/risk-assessment.md) if new threats identified
   - Update security policies if policy gaps contributed to the incident
4. **File the incident record** in `docs/compliance/evidence/incidents/`.

---

## 7. HIPAA Breach Notification Procedures

If the post-incident analysis determines that ePHI was accessed, acquired, used, or disclosed without authorization, the following notification procedures apply per HIPAA §164.404–408.

### 7.1 Breach Assessment

Apply the four-factor test to determine if notification is required:

1. **Nature and extent of ePHI involved** — What types of identifiers? How many records?
2. **Unauthorized person who used or received the ePHI** — Who accessed it? Internal or external?
3. **Whether ePHI was actually acquired or viewed** — Did they download it or just access the system?
4. **Extent to which risk has been mitigated** — Were credentials rotated? Was data recovered?

If the assessment cannot demonstrate a "low probability of compromise," notification is required.

### 7.2 Notification Timelines

| Notification | Recipient | Deadline | Method |
|---|---|---|---|
| **Individual notice** | Each affected individual | 60 days from discovery | Written letter (first-class mail) or email if individual consented to electronic notice |
| **HHS notice (< 500 individuals)** | HHS Office for Civil Rights | Within 60 days of calendar year end | HHS breach portal (hhs.gov/hipaa/for-professionals/breach-notification) |
| **HHS notice (≥ 500 individuals)** | HHS Office for Civil Rights | 60 days from discovery | HHS breach portal |
| **Media notice (≥ 500 in a state)** | Prominent media outlets in the state | 60 days from discovery | Press release or direct media contact |

### 7.3 Notification Content

Individual notification letters must include:
- Description of the breach (what happened, date of breach, date of discovery)
- Types of ePHI involved (names, dates, diagnoses, SSNs, etc.)
- Steps the individual should take to protect themselves
- What the organization is doing in response
- Contact information for questions

### 7.4 Breach Log

Maintain a running breach log at `docs/compliance/evidence/breach-log.md`:

```markdown
| Date Discovered | Date of Breach | Description | # Individuals | ePHI Types | HHS Reported | Individual Notice |
|---|---|---|---|---|---|---|
| [none to date] | | | | | | |
```

This log is retained for 6 years per HIPAA §164.530(j).

---

## 8. Contact Directory

| Role | Name | Primary Contact | Secondary Contact |
|---|---|---|---|
| Incident Commander | Sanjay Mudoshi | smudoshi@gmail.com | *[Phone]* |
| Hosting Provider Support | *[Provider]* | *[Support URL]* | *[Support phone]* |
| Legal Counsel | *[To be designated]* | | |
| Cyber Insurance | *[To be designated]* | *[Policy #]* | *[Claims line]* |
| HHS OCR Breach Portal | — | hhs.gov/hipaa/for-professionals/breach-notification | — |

**Action item:** Fill in hosting provider, legal counsel, and cyber insurance contacts.

---

## 9. Testing and Maintenance

### 9.1 Annual Testing

| Exercise | Frequency | Description |
|---|---|---|
| **Tabletop exercise** | Annually | Simulate a breach scenario. Walk through the response phases with all involved parties. Document lessons learned. |
| **Technical drill** | Annually | Test actual response capabilities: backup restore, credential rotation, container rebuild, Wazuh alert response. |
| **Detection validation** | Quarterly | Verify detection sources are operational: trigger a test Wazuh alert, verify fail2ban is active, confirm YARA scanning is running. |

### 9.2 Plan Maintenance

This plan is reviewed and updated:
- Annually (at minimum)
- After every real security incident
- When significant infrastructure changes occur (new services, new data sources, new personnel)
- When regulatory requirements change

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-04-04 | Sanjay Mudoshi | Initial release |

---

## 10. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Incident Commander | Sanjay Mudoshi | _________________________ | __________ |
| Reviewer | | _________________________ | __________ |

---

## Appendix A: Quick Reference Card

Print and post near the workstation:

```
╔══════════════════════════════════════════════════════════════╗
║                 INCIDENT RESPONSE QUICK REF                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  1. STOP — Don't panic. Don't destroy evidence.              ║
║                                                              ║
║  2. ASSESS — What systems? What data? Still active?          ║
║     • Wazuh dashboard: check latest alerts                   ║
║     • docker compose ps: check container health              ║
║     • Check /var/log/auth.log for SSH events                 ║
║                                                              ║
║  3. CONTAIN — Isolate the threat:                            ║
║     • Revoke tokens: DELETE FROM personal_access_tokens       ║
║     • Stop service: docker compose stop <svc>                ║
║     • Block IP: sudo ufw deny from <IP>                      ║
║     • Nuclear: take server offline at hosting provider        ║
║                                                              ║
║  4. PRESERVE — Save logs BEFORE making changes:              ║
║     • docker compose logs --since 1h > /tmp/incident.log     ║
║     • sudo cp /var/log/auth.log /tmp/                        ║
║     • Export Wazuh alerts to CSV                              ║
║                                                              ║
║  5. FIX — Remove threat, patch vuln, rotate creds            ║
║     • Remember: docker compose UP -d (not restart) for .env  ║
║                                                              ║
║  6. RECOVER — Restore from backup if needed                  ║
║     • backups/latest.sql + integrity JSON                    ║
║     • Monitor for 48 hours post-recovery                     ║
║                                                              ║
║  7. DOCUMENT — Write it all down in                          ║
║     docs/compliance/evidence/incidents/                       ║
║                                                              ║
║  Contact: smudoshi@gmail.com                                 ║
╚══════════════════════════════════════════════════════════════╝
```
