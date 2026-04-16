# Grafana Monitoring Stack Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Grafana + full observability stack (Prometheus, cAdvisor, Node Exporter, Loki, Promtail) to Parthenon, with a launch card on the Admin System Health page opening `https://parthenon.acumenus.net/grafana`.

**Architecture:** Six new Docker services join the existing `parthenon` Docker network (except node-exporter which uses host networking). Apache2 proxies `/grafana/` to Docker nginx, which forwards to the Grafana container. Grafana is pre-provisioned via config files with anonymous viewer access and two pre-built dashboards.

**Tech Stack:** Docker Compose, Grafana 11.4.0, Prometheus v3.1.0, cAdvisor v0.49.1, Node Exporter v1.8.2, Loki 3.0.0, Promtail 3.0.0, Laravel/PHP (backend), React 19 + TypeScript (frontend).

---

## Chunk 1: Monitoring Config Files + Docker Compose

### Task 1: Create Prometheus config

**Files:**
- Create: `monitoring/prometheus/prometheus.yml`

- [ ] **Step 1: Create the directory and config file**

```bash
mkdir -p monitoring/prometheus
```

Create `monitoring/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: cadvisor
    static_configs:
      - targets: ['cadvisor:8080']

  - job_name: node-exporter
    static_configs:
      - targets: ['host.docker.internal:9100']
```

- [ ] **Step 2: Verify file exists and is valid YAML**

```bash
cat monitoring/prometheus/prometheus.yml
```

Expected: Contents displayed without error.

- [ ] **Step 3: Commit**

```bash
git add monitoring/prometheus/prometheus.yml
git commit -m "chore: add Prometheus scrape config"
```

---

### Task 2: Create Loki config

**Files:**
- Create: `monitoring/loki/loki-config.yml`

- [ ] **Step 1: Create the directory and config file**

```bash
mkdir -p monitoring/loki
```

Create `monitoring/loki/loki-config.yml`:

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

- [ ] **Step 2: Verify file**

```bash
cat monitoring/loki/loki-config.yml
```

- [ ] **Step 3: Commit**

```bash
git add monitoring/loki/loki-config.yml
git commit -m "chore: add Loki config (v3 tsdb schema, 15-day retention)"
```

---

### Task 3: Create Promtail config

**Files:**
- Create: `monitoring/promtail/promtail-config.yml`

- [ ] **Step 1: Create the directory and config file**

```bash
mkdir -p monitoring/promtail
```

Create `monitoring/promtail/promtail-config.yml`:

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

- [ ] **Step 2: Verify file**

```bash
cat monitoring/promtail/promtail-config.yml
```

- [ ] **Step 3: Commit**

```bash
git add monitoring/promtail/promtail-config.yml
git commit -m "chore: add Promtail config for Docker log tailing"
```

---

### Task 4: Create Grafana provisioning configs

**Files:**
- Create: `monitoring/grafana/provisioning/datasources/datasources.yml`
- Create: `monitoring/grafana/provisioning/dashboards/dashboards.yml`

- [ ] **Step 1: Create datasources provisioning**

```bash
mkdir -p monitoring/grafana/provisioning/datasources
```

Create `monitoring/grafana/provisioning/datasources/datasources.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: false
    editable: false
```

- [ ] **Step 2: Create dashboards provisioning**

```bash
mkdir -p monitoring/grafana/provisioning/dashboards
```

Create `monitoring/grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: default
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    allowUiUpdates: false
    options:
      path: /etc/grafana/provisioning/dashboards
      foldersFromFilesStructure: false
```

- [ ] **Step 3: Verify both files**

```bash
cat monitoring/grafana/provisioning/datasources/datasources.yml
cat monitoring/grafana/provisioning/dashboards/dashboards.yml
```

- [ ] **Step 4: Commit**

```bash
git add monitoring/grafana/
git commit -m "chore: add Grafana provisioning configs (datasources + dashboards)"
```

---

### Task 5: Download pre-built Grafana dashboard JSONs

**Files:**
- Create: `monitoring/grafana/provisioning/dashboards/node-exporter.json`
- Create: `monitoring/grafana/provisioning/dashboards/cadvisor.json`

- [ ] **Step 1: Download Node Exporter Full dashboard (ID 1860)**

```bash
curl -fsSL "https://grafana.com/api/dashboards/1860/revisions/37/download" \
  -o monitoring/grafana/provisioning/dashboards/node-exporter.json
```

- [ ] **Step 2: Verify the download**

```bash
python3 -c "import json; d=json.load(open('monitoring/grafana/provisioning/dashboards/node-exporter.json')); print('title:', d.get('title','?'), '| panels:', len(d.get('panels',[])))"
```

Expected output: `title: Node Exporter Full | panels: <some number>`

- [ ] **Step 3: Update datasource references to use provisioned name**

The downloaded JSON may contain hardcoded datasource UIDs. Replace them with the provisioned datasource name so the dashboard works without manual configuration:

```bash
# Replace any datasource uid/type references with the name-based reference
python3 - <<'EOF'
import json, re

for fname, ds_name in [
    ('monitoring/grafana/provisioning/dashboards/node-exporter.json', 'Prometheus'),
    ('monitoring/grafana/provisioning/dashboards/cadvisor.json', 'Prometheus'),
]:
    try:
        with open(fname) as f:
            content = f.read()
        data = json.loads(content)

        def fix_ds(obj):
            if isinstance(obj, dict):
                if 'datasource' in obj:
                    ds = obj['datasource']
                    if isinstance(ds, dict):
                        obj['datasource'] = {'type': 'prometheus', 'uid': '${DS_PROMETHEUS}'}
                    elif isinstance(ds, str) and ds not in ('', '-- Grafana --'):
                        obj['datasource'] = {'type': 'prometheus', 'uid': '${DS_PROMETHEUS}'}
                return {k: fix_ds(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [fix_ds(i) for i in obj]
            return obj

        data = fix_ds(data)
        with open(fname, 'w') as f:
            json.dump(data, f, indent=2)
        print(f'Fixed {fname}')
    except FileNotFoundError:
        print(f'Skipping {fname} (not yet downloaded)')
EOF
```

- [ ] **Step 4: Download cAdvisor dashboard (ID 14282)**

```bash
curl -fsSL "https://grafana.com/api/dashboards/14282/revisions/2/download" \
  -o monitoring/grafana/provisioning/dashboards/cadvisor.json
```

- [ ] **Step 5: Verify cAdvisor download**

```bash
python3 -c "import json; d=json.load(open('monitoring/grafana/provisioning/dashboards/cadvisor.json')); print('title:', d.get('title','?'), '| panels:', len(d.get('panels',[])))"
```

Expected output: `title: <dashboard title> | panels: <some number>`

- [ ] **Step 6: Run the datasource fix script again to cover the cAdvisor JSON**

Run the same Python script from Step 3 again (it handles both files).

- [ ] **Step 7: Commit**

```bash
git add monitoring/grafana/provisioning/dashboards/
git commit -m "chore: add pre-provisioned Grafana dashboards (Node Exporter, cAdvisor)"
```

---

### Task 6: Add monitoring services to docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add the 6 monitoring services**

Open `docker-compose.yml`. Add the following block just before the `volumes:` section at the end of the file. Insert after the last existing service block:

```yaml
  # ── Monitoring Stack ─────────────────────────────────────────────────────

  grafana:
    container_name: parthenon-grafana
    image: grafana/grafana:11.4.0
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
      - GF_SERVER_ROOT_URL=https://parthenon.acumenus.net/grafana
      - GF_SERVER_SERVE_FROM_SUB_PATH=true
      - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-changeme}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - parthenon
    depends_on:
      - prometheus
      - loki
    restart: unless-stopped

  prometheus:
    container_name: parthenon-prometheus
    image: prom/prometheus:v3.1.0
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'
      - '--web.enable-lifecycle'
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    extra_hosts:
      - "host.docker.internal:host-gateway"
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:9090/-/healthy || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    networks:
      - parthenon
    restart: unless-stopped

  cadvisor:
    container_name: parthenon-cadvisor
    image: gcr.io/cadvisor/cadvisor:v0.49.1
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:8080/healthz || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    networks:
      - parthenon
    restart: unless-stopped

  node-exporter:
    container_name: parthenon-node-exporter
    image: prom/node-exporter:v1.8.2
    network_mode: host
    pid: host
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:9100/metrics || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    restart: unless-stopped

  loki:
    container_name: parthenon-loki
    image: grafana/loki:3.0.0
    command: -config.file=/etc/loki/loki-config.yml
    volumes:
      - ./monitoring/loki/loki-config.yml:/etc/loki/loki-config.yml:ro
      - loki_data:/loki
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:3100/ready || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - parthenon
    restart: unless-stopped

  promtail:
    container_name: parthenon-promtail
    image: grafana/promtail:3.0.0
    command: -config.file=/etc/promtail/promtail-config.yml
    volumes:
      - ./monitoring/promtail/promtail-config.yml:/etc/promtail/promtail-config.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:9080/ready || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    networks:
      - parthenon
    depends_on:
      - loki
    restart: unless-stopped
```

- [ ] **Step 2: Add named volumes for grafana, prometheus, and loki data**

In the `volumes:` section at the end of `docker-compose.yml`, add:

```yaml
  grafana_data:
  prometheus_data:
  loki_data:
```

- [ ] **Step 3: Verify docker-compose syntax**

```bash
docker compose config --quiet && echo "OK"
```

Expected: `OK` (no errors)

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add Grafana monitoring stack to docker-compose (6 services)"
```

---

## Chunk 2: Proxy Configuration

### Task 7: Update Docker nginx config

**Files:**
- Modify: `docker/nginx/default.conf`

- [ ] **Step 1: Add Grafana proxy location**

Open `docker/nginx/default.conf`. Find the `location /r/` block (near the end of the service proxies). Add the Grafana location **after** the `/r/` block and **before** the `location /storage/` block:

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

**Critical:** `proxy_pass http://grafana:3000;` — no trailing slash. This preserves the full `/grafana/...` URI when forwarding to Grafana, required by `GF_SERVER_SERVE_FROM_SUB_PATH=true`. A trailing slash would strip the prefix and break all asset URLs.

- [ ] **Step 2: Verify nginx config syntax**

```bash
docker compose exec nginx nginx -t
```

Expected: `nginx: configuration file /etc/nginx/nginx.conf test is successful`

If the Grafana container is not yet running, nginx will emit a DNS warning for `grafana` — this is non-fatal. The `resolver 127.0.0.11` directive already handles optional upstreams.

- [ ] **Step 3: Commit**

```bash
git add docker/nginx/default.conf
git commit -m "feat: add /grafana/ proxy location to Docker nginx"
```

---

### Task 8: Update Apache2 SSL vhost

**Files:**
- Modify: `/etc/apache2/sites-available/parthenon.acumenus.net-le-ssl.conf`

- [ ] **Step 1: Enable mod_proxy_wstunnel (required for WebSocket proxying)**

```bash
sudo a2enmod proxy_wstunnel
```

Expected: `Module proxy_wstunnel already enabled` or `Enabling module proxy_wstunnel.`

- [ ] **Step 2: Add Grafana ProxyPass directives to the SSL vhost**

Open `/etc/apache2/sites-available/parthenon.acumenus.net-le-ssl.conf`.

Find the `# Horizon dashboard` block:
```apache
    # Horizon dashboard
    ProxyPass /horizon http://127.0.0.1:8082/horizon
    ProxyPassReverse /horizon http://127.0.0.1:8082/horizon
```

Add the following **immediately after** that block:

```apache
    # Grafana metrics dashboard
    ProxyPass /grafana/api/live/ws ws://127.0.0.1:8082/grafana/api/live/ws
    ProxyPassReverse /grafana/api/live/ws ws://127.0.0.1:8082/grafana/api/live/ws
    ProxyPass /grafana/ http://127.0.0.1:8082/grafana/
    ProxyPassReverse /grafana/ http://127.0.0.1:8082/grafana/
```

**Note:** The WebSocket `ProxyPass` must appear **before** the HTTP `ProxyPass` for `/grafana/` so Apache matches the more-specific WebSocket path first.

- [ ] **Step 3: Test Apache config**

```bash
sudo apache2ctl configtest
```

Expected: `Syntax OK`

- [ ] **Step 4: Reload Apache**

```bash
sudo systemctl reload apache2
```

- [ ] **Step 5: Commit the vhost change to repo for reference**

The live Apache config is outside the repo. Keep a copy in the repo as documentation:

```bash
cp /etc/apache2/sites-available/parthenon.acumenus.net-le-ssl.conf \
   docs/architecture/apache-vhost-ssl.conf
git add docs/architecture/apache-vhost-ssl.conf
git commit -m "docs: update Apache SSL vhost reference with Grafana proxy"
```

---

### Task 9: Start monitoring stack and verify Grafana is reachable

- [ ] **Step 1: Pull the new images**

```bash
docker compose pull grafana prometheus cadvisor loki promtail
```

(node-exporter uses `docker pull` directly since it has `network_mode: host`)

```bash
docker pull prom/node-exporter:v1.8.2
```

- [ ] **Step 2: Start the monitoring services**

```bash
docker compose up -d grafana prometheus cadvisor node-exporter loki promtail
```

- [ ] **Step 3: Wait for services to become healthy**

```bash
docker compose ps grafana prometheus cadvisor loki promtail
```

Wait ~30 seconds, then re-run. Expected: all services show `healthy` or `running`.

node-exporter will not appear in `docker compose ps` since it uses `network_mode: host` — check it separately:

```bash
docker ps --filter "name=parthenon-node-exporter"
```

- [ ] **Step 4: Verify Grafana is accessible through the full proxy chain**

```bash
curl -sI https://parthenon.acumenus.net/grafana/api/health
```

Expected: HTTP 200 with JSON body `{"commit":"...","database":"ok","version":"11.4.0"}`

- [ ] **Step 5: Verify Prometheus is scraping targets**

```bash
curl -s http://localhost:9090/-/healthy 2>/dev/null || \
  docker compose exec prometheus wget -qO- http://localhost:9090/api/v1/targets | python3 -c "import json,sys; t=json.load(sys.stdin)['data']['activeTargets']; [print(x['labels']['job'], x['health']) for x in t]"
```

Expected: `cadvisor up` and `node-exporter up`

- [ ] **Step 6: Verify Loki is receiving logs**

```bash
docker compose exec promtail wget -qO- http://localhost:9080/ready
```

Expected: `ready`

---

## Chunk 3: Backend — Grafana Health Check

### Task 10: Write failing test for Grafana service in system health

**Files:**
- Create: `backend/tests/Feature/Api/V1/Admin/SystemHealthGrafanaTest.php`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/Feature/Api/V1/Admin/SystemHealthGrafanaTest.php`:

```php
<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function adminUser(): User
{
    $user = User::factory()->create();
    $user->assignRole('admin');

    return $user;
}

test('system health index includes grafana service', function () {
    Http::fake([
        'grafana:3000/api/health' => Http::response(
            ['commit' => 'abc123', 'database' => 'ok', 'version' => '11.4.0'],
            200
        ),
    ]);

    $this->actingAs(adminUser(), 'sanctum')
        ->getJson('/api/v1/admin/system-health')
        ->assertOk()
        ->assertJsonFragment(['key' => 'grafana']);
});

test('grafana service shows healthy when api health returns ok', function () {
    Http::fake([
        'grafana:3000/api/health' => Http::response(
            ['commit' => 'abc123', 'database' => 'ok', 'version' => '11.4.0'],
            200
        ),
    ]);

    $this->actingAs(adminUser(), 'sanctum')
        ->getJson('/api/v1/admin/system-health')
        ->assertOk()
        ->assertJsonFragment(['key' => 'grafana', 'status' => 'healthy']);
});

test('grafana service shows down when api health is unreachable', function () {
    Http::fake([
        'grafana:3000/api/health' => Http::throwRequest(),
    ]);

    $this->actingAs(adminUser(), 'sanctum')
        ->getJson('/api/v1/admin/system-health')
        ->assertOk()
        ->assertJsonFragment(['key' => 'grafana', 'status' => 'down']);
});

test('grafana service shows degraded when api health returns non-200', function () {
    Http::fake([
        'grafana:3000/api/health' => Http::response([], 503),
    ]);

    $this->actingAs(adminUser(), 'sanctum')
        ->getJson('/api/v1/admin/system-health')
        ->assertOk()
        ->assertJsonFragment(['key' => 'grafana', 'status' => 'degraded']);
});

test('system health show returns grafana detail', function () {
    Http::fake([
        'grafana:3000/api/health' => Http::response(
            ['commit' => 'abc123', 'database' => 'ok', 'version' => '11.4.0'],
            200
        ),
    ]);

    $this->actingAs(adminUser(), 'sanctum')
        ->getJson('/api/v1/admin/system-health/grafana')
        ->assertOk()
        ->assertJsonPath('service.key', 'grafana')
        ->assertJsonPath('service.status', 'healthy');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && vendor/bin/pest tests/Feature/Api/V1/Admin/SystemHealthGrafanaTest.php -v
```

Expected: All 5 tests FAIL (grafana key not found in response / method not found).

---

### Task 11: Implement Grafana health check in SystemHealthController

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php`

- [ ] **Step 1: Add `grafana` to the `$checkers` array in the constructor**

In `SystemHealthController.php`, find the `$this->checkers = [...]` block in `__construct()`. Add `grafana` as the last entry:

```php
            'grafana'      => fn () => $this->checkGrafana(),
```

The full checkers array becomes:
```php
        $this->checkers = [
            'backend'      => fn () => $this->checkBackend(),
            'redis'        => fn () => $this->checkRedis(),
            'ai'           => fn () => $this->checkAiService(),
            'darkstar'     => fn () => $this->checkDarkstar(),
            'solr'         => fn () => $this->checkSolr(),
            'orthanc'      => fn () => $this->checkOrthanc(),
            'queue'        => fn () => $this->checkQueue(),
            'chromadb'     => fn () => $this->checkChromaDb(),
            'study-agent'  => fn () => $this->checkStudyAgent(),
            'grafana'      => fn () => $this->checkGrafana(),
        ];
```

- [ ] **Step 2: Add `grafana` to the `getLogsForService` match**

Find the `getLogsForService` method. Add `grafana` before the `default` case:

```php
            'grafana'      => [],
```

- [ ] **Step 3: Add `grafana` to the `getMetricsForService` match**

Find the `getMetricsForService` method. Add `grafana` before the `default` case:

```php
            'grafana'      => $this->getGrafanaMetrics(),
```

- [ ] **Step 4: Add the `checkGrafana()` method**

Add this method after `checkStudyAgent()` and before the log retrieval section (`// ── Log Retrieval ────`):

```php
    private function checkGrafana(): array
    {
        $url = rtrim(env('GRAFANA_URL', 'http://grafana:3000'), '/');

        try {
            $response = Http::timeout(3)->get("{$url}/api/health");

            if ($response->successful()) {
                $version = $response->json('version', 'unknown');

                return [
                    'name'    => 'Grafana',
                    'key'     => 'grafana',
                    'status'  => 'healthy',
                    'message' => "Grafana {$version} is running.",
                ];
            }

            return [
                'name'    => 'Grafana',
                'key'     => 'grafana',
                'status'  => 'degraded',
                'message' => "Grafana returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return [
                'name'    => 'Grafana',
                'key'     => 'grafana',
                'status'  => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }
```

- [ ] **Step 5: Add the `getGrafanaMetrics()` method**

Add this method after `checkGrafana()` and before the `// ── Log Retrieval ────` section:

```php
    /**
     * @return array<string, mixed>
     */
    private function getGrafanaMetrics(): array
    {
        $url = rtrim(env('GRAFANA_URL', 'http://grafana:3000'), '/');

        try {
            $response = Http::timeout(3)->get("{$url}/api/health");

            return $response->successful() ? ($response->json() ?? []) : [];
        } catch (\Throwable) {
            return [];
        }
    }
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && vendor/bin/pest tests/Feature/Api/V1/Admin/SystemHealthGrafanaTest.php -v
```

Expected: All 5 tests PASS.

- [ ] **Step 7: Run full backend test suite to check for regressions**

```bash
cd backend && vendor/bin/pest --parallel
```

Expected: All existing tests pass.

- [ ] **Step 8: Run PHPStan**

```bash
cd backend && vendor/bin/phpstan analyse app/Http/Controllers/Api/V1/Admin/SystemHealthController.php
```

Expected: `[OK] No errors`

- [ ] **Step 9: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php \
        backend/tests/Feature/Api/V1/Admin/SystemHealthGrafanaTest.php
git commit -m "feat: add Grafana service health check to SystemHealthController"
```

---

## Chunk 4: Frontend — Grafana Launch Card

### Task 12: Write failing test for GrafanaLaunchCard

**Files:**
- Create: `frontend/src/features/administration/components/__tests__/GrafanaLaunchCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```bash
mkdir -p frontend/src/features/administration/components/__tests__
```

Create `frontend/src/features/administration/components/__tests__/GrafanaLaunchCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GrafanaLaunchCard } from '../GrafanaLaunchCard';
import type { SystemHealthService } from '@/types/models';

const healthyService: SystemHealthService = {
  key: 'grafana',
  name: 'Grafana',
  status: 'healthy',
  message: 'Grafana 11.4.0 is running.',
};

const downService: SystemHealthService = {
  key: 'grafana',
  name: 'Grafana',
  status: 'down',
  message: 'Connection refused.',
};

describe('GrafanaLaunchCard', () => {
  it('renders the service name and message', () => {
    render(<GrafanaLaunchCard service={healthyService} grafanaUrl="/grafana" />);
    expect(screen.getByText('Grafana')).toBeInTheDocument();
    expect(screen.getByText('Grafana 11.4.0 is running.')).toBeInTheDocument();
  });

  it('shows healthy badge when status is healthy', () => {
    render(<GrafanaLaunchCard service={healthyService} grafanaUrl="/grafana" />);
    expect(screen.getByText('healthy')).toBeInTheDocument();
  });

  it('shows down badge when status is down', () => {
    render(<GrafanaLaunchCard service={downService} grafanaUrl="/grafana" />);
    expect(screen.getByText('down')).toBeInTheDocument();
  });

  it('renders the Open Dashboard link pointing to grafanaUrl', () => {
    render(<GrafanaLaunchCard service={healthyService} grafanaUrl="https://parthenon.acumenus.net/grafana" />);
    const link = screen.getByRole('link', { name: /open dashboard/i });
    expect(link).toHaveAttribute('href', 'https://parthenon.acumenus.net/grafana');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/features/administration/components/__tests__/GrafanaLaunchCard.test.tsx
```

Expected: FAIL — `GrafanaLaunchCard` module not found.

---

### Task 13: Implement GrafanaLaunchCard component

**Files:**
- Create: `frontend/src/features/administration/components/GrafanaLaunchCard.tsx`

- [ ] **Step 1: Check what types are available for SystemHealthService**

```bash
grep -n "SystemHealthService\|SystemHealth" frontend/src/types/models.ts | head -20
```

Note the shape of `SystemHealthService`. It should have at minimum `key`, `name`, `status`, `message`.

- [ ] **Step 2: Create the component**

Create `frontend/src/features/administration/components/GrafanaLaunchCard.tsx`:

```tsx
import { ExternalLink, BarChart2 } from "lucide-react";
import { Panel, Badge, StatusDot, type BadgeVariant, type StatusDotVariant } from "@/components/ui";
import type { SystemHealthService } from "@/types/models";

const STATUS_MAP: Record<string, { badge: BadgeVariant; dot: StatusDotVariant }> = {
  healthy:  { badge: "success",  dot: "healthy" },
  degraded: { badge: "warning",  dot: "degraded" },
  down:     { badge: "critical", dot: "critical" },
};

interface GrafanaLaunchCardProps {
  service: SystemHealthService;
  grafanaUrl: string;
}

export function GrafanaLaunchCard({ service, grafanaUrl }: GrafanaLaunchCardProps) {
  const { badge, dot } = STATUS_MAP[service.status] ?? STATUS_MAP.down;

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusDot status={dot} />
          <div>
            <p className="font-semibold text-foreground">{service.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{service.message}</p>
          </div>
        </div>
        <Badge variant={badge}>{service.status}</Badge>
      </div>

      <div className="mt-3">
        <a
          href={grafanaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <BarChart2 className="h-3.5 w-3.5" />
          Open Dashboard
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </Panel>
  );
}
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/features/administration/components/__tests__/GrafanaLaunchCard.test.tsx
```

Expected: All 4 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/administration/components/GrafanaLaunchCard.tsx \
        frontend/src/features/administration/components/__tests__/GrafanaLaunchCard.test.tsx
git commit -m "feat: add GrafanaLaunchCard component with status and external link"
```

---

### Task 14: Wire GrafanaLaunchCard into SystemHealthPage

**Files:**
- Modify: `frontend/src/features/administration/pages/SystemHealthPage.tsx`

- [ ] **Step 1: Add the import at the top of SystemHealthPage.tsx**

Find the existing imports at the top. Add:

```tsx
import { GrafanaLaunchCard } from "../components/GrafanaLaunchCard";
```

- [ ] **Step 2: Update the service cards grid to render GrafanaLaunchCard for the grafana key**

Find the grid map in the JSX:

```tsx
          {(data?.services ?? []).map((s) => (
            <ServiceCard key={s.key} service={s} />
          ))}
```

Replace it with:

```tsx
          {(data?.services ?? []).map((s) =>
            s.key === "grafana" ? (
              <GrafanaLaunchCard
                key={s.key}
                service={s}
                grafanaUrl="/grafana"
              />
            ) : (
              <ServiceCard key={s.key} service={s} />
            )
          )}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Run the full frontend test suite**

```bash
cd frontend && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/administration/pages/SystemHealthPage.tsx
git commit -m "feat: render GrafanaLaunchCard in System Health page for grafana service"
```

---

### Task 15: Add GRAFANA env vars to .env.example

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Add Grafana env vars**

Open `backend/.env.example`. Find the section with other service URLs (e.g., `AI_SERVICE_URL`, `R_PLUMBER_URL`). Add after them:

```
# Grafana monitoring dashboard
GRAFANA_URL=http://grafana:3000
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=changeme
```

- [ ] **Step 2: Commit**

```bash
git add backend/.env.example
git commit -m "chore: add GRAFANA_URL and admin credential vars to .env.example"
```

---

### Task 16: Rebuild frontend and verify end-to-end

- [ ] **Step 1: Run full lint and type checks**

```bash
cd frontend && npx tsc --noEmit && npx eslint . --max-warnings 0
cd backend && vendor/bin/phpstan analyse && vendor/bin/pint --test
```

Expected: No errors or warnings.

- [ ] **Step 2: Build the production frontend**

```bash
./deploy.sh --frontend
```

Or manually:

```bash
docker compose exec node sh -c "cd /app && npx vite build"
```

- [ ] **Step 3: Reload nginx to pick up nginx config changes**

```bash
docker compose exec nginx nginx -s reload
```

- [ ] **Step 4: Open System Health page and verify Grafana card appears**

Navigate to `https://parthenon.acumenus.net/admin/system-health` as an admin user.

Expected:
- A "Grafana" card appears in the service grid with a healthy/green status
- The card shows "Metrics & Logs" label and an "Open Dashboard →" external link
- Clicking "Open Dashboard →" opens `https://parthenon.acumenus.net/grafana` in a new tab
- The Grafana UI loads with the pre-provisioned Node Exporter and cAdvisor dashboards visible

- [ ] **Step 5: Verify dashboards have data**

In Grafana, open the Node Exporter Full dashboard. Expected: host CPU, memory, and disk metrics visible with data points.

Open the cAdvisor dashboard. Expected: per-container CPU and memory metrics for all running Parthenon containers.

- [ ] **Step 6: Verify logs in Grafana**

In Grafana, go to Explore → select Loki datasource → run `{job="docker"}`. Expected: log streams from all Parthenon containers visible.

- [ ] **Step 7: Final commit**

```bash
git add -A
git status  # verify only expected files
git commit -m "feat: Grafana monitoring stack — dashboards, logs, System Health launch card"
```
