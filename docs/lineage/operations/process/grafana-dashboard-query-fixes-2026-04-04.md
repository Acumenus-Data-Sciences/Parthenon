# Grafana Dashboard Query Fixes — Metric Names, Missing Variables, and cAdvisor Stability

**Date:** 2026-04-04
**Author:** Dr. Sanjay Udoshi
**Status:** Complete
**Impact:** Fixed 8 broken dashboard panels; stabilized cAdvisor (was crash-looping with 1,451 restarts)
**Follows:** [grafana-observability-overhaul-2026-04-03.md](grafana-observability-overhaul-2026-04-03.md)

---

## Summary

Multiple Grafana dashboard panels were showing "No data" despite all 4 Prometheus targets reporting healthy and Loki ingesting logs. Root causes were metric name mismatches, a missing template variable, cgroup v2 network metric limitations, and cAdvisor memory exhaustion.

## Root Causes

### 1. PostgreSQL Metric Name Mismatch (2 panels)

The dashboard used `_sum` suffixed metric names (`pg_stat_database_xact_commit_sum`, `pg_stat_database_blks_hit_sum`) which don't exist in postgres-exporter v0.16.0. The actual metrics have no `_sum` suffix.

| Panel | Broken Query | Fixed Query |
|-------|-------------|-------------|
| PG Transactions/sec | `pg_stat_database_xact_commit_sum` | `pg_stat_database_xact_commit` |
| PG Transactions/sec | `pg_stat_database_xact_rollback_sum` | `pg_stat_database_xact_rollback` |
| PG Cache Hit Ratio | `pg_stat_database_blks_hit_sum` / `_read_sum` | `pg_stat_database_blks_hit` / `_blks_read` |

### 2. Loki Job Label Mismatch (2 panels)

The Alloy config labels Apache logs as `job="apache"`, but the dashboard queried `job="apache_access"`.

| Panel | Broken | Fixed |
|-------|--------|-------|
| HTTP 5xx Rate | `{job="apache_access"}` | `{job="apache"}` |
| Apache Access Logs | `{job="apache_access"}` | `{job="apache"}` |

### 3. Missing `$search` Template Variable (4 panels)

All 4 log panels (PHP/Laravel Errors, PostgreSQL Logs, Apache Access Logs, AI Service Logs) used `|~ "$search"` in their LogQL queries, but the `$search` variable was never defined in the dashboard templating. Grafana couldn't interpolate it, resulting in empty results.

Fix: Added a `textbox` type variable named `search` with empty default. Users can now type a search term to filter log output across all log panels.

### 4. Network I/O Per-Container Metrics Unavailable (1 panel)

cAdvisor with cgroup v2 does not export per-container `container_network_receive_bytes_total` metrics — only the root cgroup (`id="/"`) has network counters. The dashboard queried `container_network_receive_bytes_total{name=~"parthenon-.*"}` which matched zero series.

Fix: Replaced with node_exporter host-level network metrics:
- `node_network_receive_bytes_total{device!~"lo|veth.*|br-.*|docker.*"}` — physical interfaces only
- Panel renamed from "Network I/O by Container" to "Network I/O (Host)"

### 5. cAdvisor Crash-Loop (intermittent gaps in container metrics)

cAdvisor had restarted **1,451 times** due to:
- 256 MB memory limit monitoring 68 containers
- Default metric collectors adding unnecessary overhead

Fix:
- Memory limit: 256 MB → 1 GB
- Added `--docker_only=true` (skip non-Docker cgroups)
- Added `--housekeeping_interval=30s` (reduce collection frequency)
- Disabled unused metric collectors: `advtcp`, `cpu_topology`, `cpuset`, `hugetlb`, `memory_numa`, `process`, `referenced_memory`, `resctrl`, `sched`, `tcp`, `udp`
- Health check retries: 3 → 5, start period: 15s → 30s

## Debugging Approach

1. Verified all Prometheus targets were `up` (they were — the issue wasn't connectivity)
2. Tested each dashboard metric name against Prometheus API — found `_sum` variants returned 0 series
3. Checked Loki label values — found `job="apache"` existed but `job="apache_access"` did not
4. Discovered `$search` variable referenced in queries but absent from templating list
5. Checked cAdvisor raw `/metrics` endpoint — confirmed only root-level network metrics exported
6. Checked `docker inspect` — confirmed 1,451 restart count on cAdvisor

## Files Modified

| File | Change |
|------|--------|
| `monitoring/grafana/provisioning/dashboards/parthenon.json` | Fixed 5 metric names, 2 job labels, added `$search` variable, rewrote Network I/O panel |
| `docker-compose.yml` | cAdvisor: 1 GB memory, `--docker_only`, `--housekeeping_interval=30s`, disabled unused collectors |

## Verification

- All 4 Prometheus targets: up
- PG Transactions/sec: 4 series (was 0)
- PG Cache Hit Ratio: 4 series (was 0)
- HTTP 5xx Rate: querying correct Loki job
- All 4 log panels: data flowing
- Network I/O (Host): showing physical interface rx/tx
- cAdvisor: healthy, 0 restarts since fix
- Dashboard variables: `container`, `log_level`, `interval`, `search`
