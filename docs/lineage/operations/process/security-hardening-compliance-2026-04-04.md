# Security Hardening & Compliance Remediation

**Date:** 2026-04-04
**Scope:** Server hardening, SIEM integration, compliance documentation
**Frameworks:** HIPAA Security Rule, NIST 800-53, IT Hygiene, CIS Ubuntu 24.04

---

## Context

Wazuh SIEM was already deployed via the Acropolis stack but revealed a significant attack surface: 40,143 failed SSH authentication events from 20+ unique source IPs, 3,880 high-severity alerts (99.97% OOM-related), and no automated intrusion prevention. The server had no fail2ban, no YARA malware scanning, no IOC sweep capability, and SSH was using default settings with password authentication enabled.

## What Was Done

### Layer 1: fail2ban (Real-Time IP Banning)

Installed fail2ban v1.1.0 with 8 active jails:

| Jail | Trigger | Ban Duration |
|------|---------|-------------|
| sshd | 3 failures / 5 min | 1 hour (aggressive mode) |
| recidive | 3 bans / 12 hours | 24 hours, all ports |
| apache-auth | 5 failures / 10 min | 1 hour |
| apache-badbots | 2 hits / 10 min | 2 hours |
| apache-noscript | 3 hits / 10 min | 1 hour |
| apache-overflows | 2 hits / 10 min | 1 hour |
| apache-shellshock | 1 hit | 24 hours |
| pam-generic | 5 failures / 10 min | 1 hour |

- Config: `/etc/fail2ban/jail.local`
- Whitelist: LAN (192.168.1.0/24), Docker (172.16.0.0/12, 10.0.0.0/8)
- 17 persistent IP blocks added to iptables for worst offenders (>200 attempts each)
- fail2ban log integrated into Wazuh agent for dashboard visibility

### Layer 2: YARA + Wazuh Active Response (Real-Time File Scanning)

- Installed YARA 4.5.4 with YARA Forge Core ruleset (167K lines)
- Rules at `/etc/yara/rules/yara-rules-core.yar`
- Wazuh active-response script (`/var/ossec/active-response/bin/yara-scan.sh`) triggers YARA scan on every file change detected by syscheck (rules 550, 553, 554)
- Custom Wazuh rules: 100070 (YARA alert, level 12), 100071 (clean, level 3)
- Validated with EICAR test pattern — correctly detected

### Layer 3: Loki-RS (Scheduled IOC Sweeps)

- Installed Loki-RS v2.10.0 (Rust rewrite of LOKI by Florian Roth / Neo23x0)
- 5,007 YARA rules + 1,844 C2 IOC indicators loaded
- Daily cron sweep at 3 AM, 30% CPU throttle
- Scans: /etc, /usr/bin, /usr/sbin, /usr/local/bin, /boot, /home, /root, /var/www, /tmp, /var/tmp, /opt, /var/spool/cron + process memory
- Syslog output to Wazuh (UDP 127.0.0.1:514) + local logs with 30-day rotation
- Signature updates weekly (Sundays)
- Custom Wazuh rules: 100075 (Loki alert, level 12), 100076 (info, level 3)

### SSH Hardening

Deployed `/etc/ssh/sshd_config.d/hardened.conf`:

- `PermitRootLogin no` — root SSH eliminated
- `PasswordAuthentication no` — key-only auth (ed25519 + RSA-SHA2)
- `AllowUsers smudoshi` — only one account can SSH
- `MaxAuthTries 3`, `MaxStartups 3:50:10` — brute-force throttling
- `X11Forwarding no`, `AllowTcpForwarding no`, `AllowAgentForwarding no`
- `LogLevel VERBOSE` for Wazuh ingestion
- `ClientAliveInterval 300` / `ClientAliveCountMax 3` — 15-min idle timeout
- `Banner /etc/issue.net` — legal warning banner

### Apache Security Headers (Global)

Deployed `/etc/apache2/conf-available/security-headers.conf` applying to all 19 SSL vhosts:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy` (enforcing) — locked to self, Google Fonts, OpenStreetMap tiles, WebSocket
- `ServerTokens Prod` / `ServerSignature Off` — no version leakage

### CIS Ubuntu 24.04 Benchmark Remediation

- Cron permissions: `/etc/crontab` 600, cron dirs 700
- `/dev/shm` hardened: remounted with `nodev,nosuid,noexec`, added to fstab
- Disabled unused kernel modules: cramfs, freevxfs, hfs, hfsplus, jffs2, udf, usb-storage
- Sysctl hardening: SYN cookies, no redirects, martian logging, ASLR, no source routing, no core dumps, reverse path filtering
- File permissions: /etc/passwd 644, /etc/shadow 640, SSH keys 600
- Password quality: minlen 14, requires upper/lower/digit/special (pam_pwquality)
- Login defaults: PASS_MAX_DAYS 365, PASS_MIN_DAYS 1, UMASK 027
- SSH login banner

### CVE Remediation

- Removed Thunderbird (52 Critical + 53 High CVEs eliminated)
- Upgraded Python packages: onnx 1.21.0, langchain-core 1.2.26, pypdf 6.9.2, pyasn1 0.6.3

### Backup Restore Verification (HIPAA 164.308(a)(7)(ii)(D))

- Tested restore of `app-20260403-141701.sql.gz` (980MB compressed) into throwaway database
- All 7 key tables matched production row counts exactly (173 tables total)
- Documented PG17 `\restrict` compatibility issue and pgvector prerequisite
- Evidence: `docs/compliance/evidence/backup-restore-verification.log`

### Compliance Documentation (Wave 3)

Created `docs/compliance/` with:
- `risk-assessment.md` — Formal HIPAA risk assessment
- `security-policies.md` — Access control, data classification, encryption, retention
- `incident-response-plan.md` — Detection, classification, 4-phase response, HIPAA breach notification
- `disaster-recovery-plan.md` — RPO 24h, RTO 4h, 3 recovery scenarios
- `audit-controls.md` — Log sources, review schedule, procedures
- `workforce-training.md` — Training topics and attestation

### Wazuh Custom Rules Added

| Rule ID | Level | Description |
|---------|-------|-------------|
| 100070 | 12 | YARA malware signature detected |
| 100071 | 3 | YARA scan clean |
| 100075 | 12 | Loki-RS IOC/malware indicator |
| 100076 | 3 | Loki-RS scan info |

## Compliance Posture Change

| Framework | Before | After |
|-----------|--------|-------|
| HIPAA Security Rule | ~65% | ~90% (documentation gap closed) |
| NIST 800-53 | ~60% | ~85% (technical + policy controls) |
| IT Hygiene | ~70% | ~95% (headers, patching, CIS) |
| CIS Ubuntu 24.04 | Unknown | Actively monitored + remediated |

## Remaining Items

- LUKS disk encryption at rest (deferred — requires maintenance window)
- AIDE (compensated by Wazuh syscheck)
- auditd (compensated by Wazuh audit logging)
- Separate /tmp and /home partitions (requires repartitioning)
- BAA inventory and vendor outreach (legal task)
