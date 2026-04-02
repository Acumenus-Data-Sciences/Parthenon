---
phase: quick-12
plan: 01
subsystem: acropolis/wazuh
tags: [security, wazuh, siem, hardening, infrastructure]
dependency_graph:
  requires: []
  provides: [wazuh-fim, wazuh-sca, wazuh-log-collection, wazuh-ism-retention]
  affects: [acropolis/docker-compose.enterprise.yml]
tech_stack:
  added: []
  patterns: [wazuh-ossec-config, opensearch-ism, opensearch-security]
key_files:
  created:
    - acropolis/scripts/wazuh-post-install.sh
  modified:
    - acropolis/config/wazuh/wazuh_cluster/wazuh_manager.conf
    - acropolis/config/wazuh/wazuh_indexer/internal_users.yml
decisions:
  - "90-day ISM retention for wazuh-alerts-* and wazuh-archives-* indices"
  - "Single-node shard template (1 shard, 0 replicas) for all wazuh-* indices"
  - "CIS benchmarks: Ubuntu 24.04, PostgreSQL 13, Nginx 1, Apache 2.4"
metrics:
  duration: 2min
  completed: "2026-04-02"
  tasks: 3/3
  files: 3
---

# Quick Task 12: Implement All Critical Wazuh Post-Install Hardening

FIM with realtime monitoring, 4 CIS SCA policies, 5 host log sources, demo user removal, 5m disconnect alerts, and 90-day ISM retention policy.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | FIM, SCA, log collection, alerts, whitelist | 8be1ada9b | syscheck block, 4 CIS policies, 5 localfile entries, 5m alert, whitelist |
| 2 | Remove demo users from indexer | 4c1266c0e | Removed kibanaro, logstash, readall, snapshotrestore; kept admin + kibanaserver |
| 3 | ISM retention + shard template script | 69da309c9 | wazuh-post-install.sh with 90d retention and single-node template |

## Configuration Details

### C1: File Integrity Monitoring (syscheck)
- Realtime: /etc, /usr/bin, /usr/sbin, /boot, /var/ossec/etc
- Check all: SSH keys (~/.ssh), backend/.env
- Ignored: mtab, hosts.deny, adjtime, .log/.swp files
- Nodiff: /etc/ssl/private

### C2: Security Configuration Assessment
- cis_ubuntu24-04.yml
- cis_postgre-sql-13.yml
- cis_nginx_1.yml
- cis_apache_24.yml

### C3: Log Collection
- /var/log/auth.log (syslog)
- /var/log/syslog (syslog)
- /var/log/apache2/access.log (apache)
- /var/log/apache2/error.log (apache)
- /var/log/ufw.log (syslog)

### C4: Demo User Removal
- Removed: kibanaro, logstash, readall, snapshotrestore
- Kept: admin (reserved, backend_roles: admin), kibanaserver (reserved)

### C5: Alert Configuration
- agents_disconnection_alert_time: 5m (was 0/disabled)
- Localhost whitelist: 127.0.0.1, ::1

### C6: ISM Retention + Shard Template
- 90-day hot state, then delete for wazuh-alerts-* and wazuh-archives-*
- 1 shard, 0 replicas for all wazuh-* indices (single-node optimization)

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| syscheck block present | 1 (PASS) |
| cis_ubuntu24-04 policy | 1 (PASS) |
| Demo users removed | 0 matches (PASS) |
| Script syntax (bash -n) | PASS |
| Script executable | PASS |
