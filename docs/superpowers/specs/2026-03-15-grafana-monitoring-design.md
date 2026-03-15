# Grafana Monitoring Stack — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Add Grafana + full observability stack to the Parthenon docker-compose, accessible from a launch card on the Admin System Health page at `https://parthenon.acumenus.net/grafana`.

---

## 1. Goal

Give Parthenon admins a single-click path from the System Health page to a full Grafana dashboard covering all Docker container metrics, host system metrics, and all container logs — with no separate login required.

---

## 2. New Services

Six services added inline to `docker-compose.yml`:

| Service | Image | Purpose | Host Port |
|---|---|---|---|
| `grafana` | `grafana/grafana:latest` | Visualization UI, anonymous read-only | none (internal only) |
| `prometheus` | `prom/prometheus:latest` | Metrics time-series DB + scraper | none |
| `cadvisor` | `gcr.io/cadvisor/cadvisor:latest` | Per-container CPU/mem/net/disk metrics | none |
| `node-exporter` | `prom/node-exporter:latest` | Host system metrics (CPU, RAM, disk, network) | none |
| `loki` | `grafana/loki:latest` | Log aggregation database | none |
| `promtail` | `grafana/promtail:latest` | Ships Docker container logs → Loki | none |

All services are internal only — no host ports exposed. Access is exclusively through the Apache2 → Docker nginx proxy chain.

---

## 3. Data Flow

```
Host system ──────────────────────────────► node-exporter ──► prometheus
Docker containers ────────────────────────► cadvisor       ──► prometheus
Docker container logs (/var/lib/docker/…) ► promtail       ──► loki
                                                                   │
                                                              grafana queries
                                                           prometheus + loki
```

Prometheus scrapes cAdvisor and Node Exporter every 15 seconds. Promtail tails Docker container log files via the Docker journal and ships to Loki. Grafana queries both data sources, with dashboards pre-provisioned on first boot.

---

## 4. Configuration File Structure

New `monitoring/` directory at the project root:

```
monitoring/
├── prometheus/
│   └── prometheus.yml              # Scrape configs: cadvisor, node-exporter
├── loki/
│   └── loki-config.yml             # Local filesystem storage, 15-day retention
├── promtail/
│   └── promtail-config.yml         # Docker log discovery, labels, Loki target
└── grafana/
    └── provisioning/
        ├── datasources/
        │   └── datasources.yml     # Auto-wires Prometheus + Loki on first boot
        └── dashboards/
            ├── dashboards.yml      # Points Grafana at dashboard JSON directory
            ├── node-exporter.json  # Grafana dashboard 1860 — Node Exporter Full
            └── cadvisor.json       # Grafana dashboard 14282 — Docker containers
```

All config is file-based. No manual Grafana UI configuration is needed.

---

## 5. Grafana Configuration

Grafana runs with anonymous access enabled (read-only viewer role) and served from the `/grafana` sub-path:

```
GF_AUTH_ANONYMOUS_ENABLED=true
GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
GF_AUTH_DISABLE_LOGIN_FORM=true
GF_SERVER_ROOT_URL=https://parthenon.acumenus.net/grafana
GF_SERVER_SERVE_FROM_SUB_PATH=true
```

Grafana admin credentials are set via env vars (`GF_SECURITY_ADMIN_USER`, `GF_SECURITY_ADMIN_PASSWORD`) from the `.env` file for future dashboard management. Anonymous users see all pre-provisioned dashboards without logging in.

Data is persisted in a named Docker volume (`grafana_data`). Loki chunks stored in `loki_data` volume.

---

## 6. Proxy Chain

Requests to `https://parthenon.acumenus.net/grafana` flow through:

```
Browser → Apache2 (:443) → Docker nginx (:8082) → grafana container (:3000)
```

### Apache2 SSL config additions (`parthenon.acumenus.net-le-ssl.conf`)

```apache
# Grafana metrics dashboard
ProxyPass /grafana/ http://127.0.0.1:8082/grafana/
ProxyPassReverse /grafana/ http://127.0.0.1:8082/grafana/
# WebSocket support for Grafana Live
RewriteRule ^/grafana/api/live/ws/(.*) ws://127.0.0.1:8082/grafana/api/live/ws/$1 [P,L]
```

### Docker nginx additions (`docker/nginx/default.conf`)

```nginx
location /grafana/ {
    set $grafana_upstream http://grafana:3000;
    proxy_pass $grafana_upstream/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

The `/grafana/` prefix is stripped by the trailing slash on `proxy_pass`, so Grafana receives requests at its root path while `GF_SERVER_SERVE_FROM_SUB_PATH=true` handles asset URL rewriting correctly.

---

## 7. Frontend Changes

### SystemHealthPage.tsx

A new **Grafana card** is added to the service grid alongside existing service cards. It:

- Displays a "Metrics & Logs" label with a chart icon
- Shows live Grafana service status (healthy/degraded/down) via the existing health check pattern
- Has an "Open Dashboard →" button that opens `https://parthenon.acumenus.net/grafana` in a new tab
- Follows the exact same card UI pattern as existing service cards

### Backend: SystemHealthController.php

A `grafana` entry is added to the services map. It pings `http://grafana:3000/api/health` and returns status + version, following the same pattern as the existing `ai`, `r`, and `orthanc` checks.

---

## 8. Resilience & Operational Details

- **Promtail** uses `ignore_errors: true` — a single unreadable log file does not crash the shipper
- **Prometheus** retention: 15 days (configurable via `PROMETHEUS_RETENTION_TIME` env var, default `15d`)
- **Loki** uses local filesystem storage with a named volume — no object store dependency
- **All 6 services** have Docker healthchecks so `docker compose ps` accurately reflects their state
- **Grafana down**: the launch card shows a degraded/down badge; the "Open Dashboard" button remains visible
- **cadvisor** requires access to host Docker socket and `/sys`, `/proc` — mounted read-only in compose

---

## 9. Files Changed or Created

| File | Change |
|---|---|
| `docker-compose.yml` | Add 6 monitoring services + named volumes |
| `monitoring/prometheus/prometheus.yml` | New — scrape configs |
| `monitoring/loki/loki-config.yml` | New — Loki config |
| `monitoring/promtail/promtail-config.yml` | New — Docker log discovery |
| `monitoring/grafana/provisioning/datasources/datasources.yml` | New — data sources |
| `monitoring/grafana/provisioning/dashboards/dashboards.yml` | New — dashboard loader |
| `monitoring/grafana/provisioning/dashboards/node-exporter.json` | New — Node Exporter Full dashboard |
| `monitoring/grafana/provisioning/dashboards/cadvisor.json` | New — Docker container dashboard |
| `docker/nginx/default.conf` | Add `/grafana/` proxy location |
| `/etc/apache2/sites-available/parthenon.acumenus.net-le-ssl.conf` | Add `/grafana/` ProxyPass + WS rewrite |
| `backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php` | Add `grafana` service check |
| `frontend/src/features/administration/pages/SystemHealthPage.tsx` | Add Grafana launch card |
| `.env.example` | Add `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`, `GRAFANA_URL` |
