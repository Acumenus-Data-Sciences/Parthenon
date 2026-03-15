# Grafana Monitoring Stack — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Add Grafana + full observability stack to the Parthenon docker-compose, accessible from a launch card on the Admin System Health page at `https://parthenon.acumenus.net/grafana`.

---

## 1. Goal

Give Parthenon admins a single-click path from the System Health page to a full Grafana dashboard covering all Docker container metrics, host system metrics, and all container logs — with no separate login required (anonymous viewer access).

---

## 2. New Services

Six services added inline to `docker-compose.yml`. All pinned image tags:

| Service | Image | Purpose | Network |
|---|---|---|---|
| `grafana` | `grafana/grafana:11.4.0` | Visualization UI, anonymous read-only | app-network |
| `prometheus` | `prom/prometheus:v3.1.0` | Metrics time-series DB + scraper | app-network |
| `cadvisor` | `gcr.io/cadvisor/cadvisor:v0.49.1` | Per-container CPU/mem/net/disk metrics | app-network |
| `node-exporter` | `prom/node-exporter:v1.8.2` | Host system metrics (CPU, RAM, disk, network) | `network_mode: host` |
| `loki` | `grafana/loki:3.0.0` | Log aggregation database | app-network |
| `promtail` | `grafana/promtail:3.0.0` | Ships Docker container logs → Loki | app-network |

**node-exporter host networking:** Node Exporter must run with `network_mode: "host"` to report accurate host network interface statistics (not the Docker bridge). As a result it cannot join the named app network. Prometheus scrapes it at `host.docker.internal:9100` — requires `extra_hosts: ["host.docker.internal:host-gateway"]` on the prometheus service.

**No host ports exposed.** Grafana is accessible only via the Apache2 → Docker nginx proxy chain.

---

## 3. Data Flow

```
Host system ──────────────────────────────► node-exporter (host net, :9100) ──► prometheus
Docker containers ────────────────────────► cadvisor (:8080) ──────────────────► prometheus
Docker container logs (/var/lib/docker/…) ► promtail ──────────────────────────► loki (:3100)
                                                                                      │
                                                                               grafana queries
                                                                            prometheus + loki
```

Prometheus scrapes cAdvisor (`:8080`) and Node Exporter (`:9100`) every 15 seconds. Promtail tails Docker container log files directly from `/var/lib/docker/containers/*/*-json.log` (mounted read-only) and ships to Loki. Grafana queries both data sources, with dashboards pre-provisioned on first boot.

---

## 4. Configuration File Structure

New `monitoring/` directory at the project root:

```
monitoring/
├── prometheus/
│   └── prometheus.yml              # Scrape configs: cadvisor (:8080), node-exporter via host.docker.internal:9100
├── loki/
│   └── loki-config.yml             # Loki v3 config — local filesystem, tsdb schema, 15-day retention
├── promtail/
│   └── promtail-config.yml         # Docker log file tailing (/var/lib/docker/containers/), Loki push target
└── grafana/
    └── provisioning/
        ├── datasources/
        │   └── datasources.yml     # Auto-wires Prometheus + Loki on first boot
        └── dashboards/
            ├── dashboards.yml      # Points Grafana at dashboard JSON directory
            ├── node-exporter.json  # Dashboard ID 1860 — Node Exporter Full (downloaded from grafana.com)
            └── cadvisor.json       # Dashboard ID 14282 — Docker containers (downloaded from grafana.com)
```

**Dashboard JSON notes:** Both JSONs are downloaded from `grafana.com/grafana/dashboards/<id>/revisions/<rev>/download` at implementation time. The `datasource` fields inside each JSON must be updated to use the provisioned datasource names (`Prometheus`, `Loki`) rather than UIDs, to ensure portability across installations.

---

## 5. Key Config Skeletons

### prometheus.yml
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: cadvisor
    static_configs:
      - targets: ['cadvisor:8080']

  - job_name: node-exporter
    static_configs:
      - targets: ['host.docker.internal:9100']
```

### loki-config.yml (v3 schema)
```yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  instance_addr: 127.0.0.1
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

limits_config:
  retention_period: 15d

compactor:
  working_directory: /loki/compactor
  retention_enabled: true
```

### promtail-config.yml (file-based Docker log tailing)
```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: containers
    static_configs:
      - targets: [localhost]
        labels:
          job: docker
          __path__: /var/lib/docker/containers/*/*-json.log
    pipeline_stages:
      - json:
          expressions:
            log: log
            stream: stream
            time: time
      - timestamp:
          source: time
          format: RFC3339Nano
      - labels:
          stream:
      - output:
          source: log
```

Promtail volume mounts: `/var/lib/docker/containers:/var/lib/docker/containers:ro` and `/var/run/docker.sock:/var/run/docker.sock:ro` (for container name label discovery).

---

## 6. Grafana Configuration

```
GF_AUTH_ANONYMOUS_ENABLED=true
GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
GF_SERVER_ROOT_URL=https://parthenon.acumenus.net/grafana
GF_SERVER_SERVE_FROM_SUB_PATH=true
```

**Note:** `GF_AUTH_DISABLE_LOGIN_FORM` is intentionally NOT set. The login form remains available so admins can log in with the admin account to edit dashboards or manage datasources. Anonymous users automatically get Viewer access without logging in.

Admin credentials (`GF_SECURITY_ADMIN_USER`, `GF_SECURITY_ADMIN_PASSWORD`) are set via `.env` and used for the login form and Grafana HTTP API calls.

Data persisted in named Docker volumes: `grafana_data`, `loki_data`.

---

## 7. Proxy Chain

Requests to `https://parthenon.acumenus.net/grafana` flow through:

```
Browser → Apache2 (:443) → Docker nginx (:8082) → grafana container (:3000)
```

### Apache2 SSL config additions (`parthenon.acumenus.net-le-ssl.conf`)

`mod_proxy_wstunnel` must be enabled (`a2enmod proxy_wstunnel`). Add inside the `<VirtualHost *:443>` block:

```apache
# Grafana metrics dashboard — WebSocket MUST come before HTTP so Apache matches more-specific path first
ProxyPass /grafana/api/live/ws ws://127.0.0.1:8082/grafana/api/live/ws
ProxyPassReverse /grafana/api/live/ws ws://127.0.0.1:8082/grafana/api/live/ws
ProxyPass /grafana/ http://127.0.0.1:8082/grafana/
ProxyPassReverse /grafana/ http://127.0.0.1:8082/grafana/
```

`RewriteEngine On` is already present in this vhost (used for the HTTP redirect in the companion HTTP vhost; the SSL vhost itself does not need it). WebSocket proxying uses `ProxyPass ws://` via `mod_proxy_wstunnel` — no `RewriteRule` needed.

### Docker nginx additions (`docker/nginx/default.conf`)

Add before the catch-all `location /` block:

```nginx
location /grafana/ {
    proxy_pass http://grafana:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Critical:** `proxy_pass http://grafana:3000;` has no trailing slash and no path component. This preserves the full `/grafana/...` URI when forwarding to Grafana, which is required by `GF_SERVER_SERVE_FROM_SUB_PATH=true`. A trailing slash (`proxy_pass http://grafana:3000/;`) would strip the `/grafana/` prefix, causing 404s on all assets and API calls.

---

## 8. Docker Healthchecks

All six services include healthchecks (interval: 30s, timeout: 10s, retries: 3):

| Service | Healthcheck command |
|---|---|
| grafana | `wget -q --spider http://localhost:3000/api/health \|\| exit 1` |
| prometheus | `wget -q --spider http://localhost:9090/-/healthy \|\| exit 1` |
| cadvisor | `wget -q --spider http://localhost:8080/healthz \|\| exit 1` |
| node-exporter | `wget -q --spider http://localhost:9100/metrics \|\| exit 1` |
| loki | `wget -q --spider http://localhost:3100/ready \|\| exit 1` |
| promtail | `wget -q --spider http://localhost:9080/ready \|\| exit 1` |

---

## 9. Frontend Changes

### SystemHealthPage.tsx

A new **Grafana launch card** is added to the service grid alongside existing service cards. It:

- Displays a "Metrics & Logs" label with a chart icon
- Shows live Grafana service status (healthy/degraded/down) sourced from the backend health check
- Has an "Open Dashboard →" button that opens `https://parthenon.acumenus.net/grafana` in a new tab
- Follows the exact same card UI pattern as existing service cards

### Backend: SystemHealthController.php

A `grafana` entry is added to the services map, pinging `http://grafana:3000/api/health` and returning status + version. Follows the identical pattern as the existing `orthanc` and `ai` checks.

---

## 10. Resilience & Operational Details

- **Promtail** uses `ignore_errors: true` — a single unreadable log file does not crash the shipper
- **Prometheus retention** is set via the compose `command:` block: `--storage.tsdb.retention.time=15d` (not an env var — Prometheus does not read this from the environment)
- **Loki** uses local filesystem storage with a named volume — no object store dependency
- **cAdvisor** volume mounts: `/:/rootfs:ro`, `/var/run:/var/run:ro`, `/sys:/sys:ro`, `/var/lib/docker/:/var/lib/docker:ro`, `/var/run/docker.sock:/var/run/docker.sock:ro`
- **Grafana down**: the launch card shows a degraded/down badge; the "Open Dashboard" button remains visible
- **Docker network**: all monitoring services (except node-exporter) join the existing app network defined in `docker-compose.yml`

---

## 11. Named Volumes

Three new named volumes declared in the top-level `volumes:` section of `docker-compose.yml`:

```yaml
volumes:
  grafana_data:
  prometheus_data:
  loki_data:
```

---

## 12. Files Changed or Created

| File | Change |
|---|---|
| `docker-compose.yml` | Add 6 monitoring services + `grafana_data`/`loki_data` named volumes |
| `monitoring/prometheus/prometheus.yml` | New |
| `monitoring/loki/loki-config.yml` | New |
| `monitoring/promtail/promtail-config.yml` | New |
| `monitoring/grafana/provisioning/datasources/datasources.yml` | New |
| `monitoring/grafana/provisioning/dashboards/dashboards.yml` | New |
| `monitoring/grafana/provisioning/dashboards/node-exporter.json` | New (downloaded from grafana.com/dashboards/1860) |
| `monitoring/grafana/provisioning/dashboards/cadvisor.json` | New (downloaded from grafana.com/dashboards/14282) |
| `docker/nginx/default.conf` | Add `/grafana/` proxy location |
| `/etc/apache2/sites-available/parthenon.acumenus.net-le-ssl.conf` | Add `/grafana/` ProxyPass + WebSocket ProxyPass |
| `backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php` | Add `grafana` service check |
| `frontend/src/features/administration/pages/SystemHealthPage.tsx` | Add Grafana launch card |
| `.env.example` | Add `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD` |
