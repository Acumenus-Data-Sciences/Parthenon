# CE/EE Fork — Plan 04: First-Pass EE Migration

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. This is the largest plan in the CE/EE fork — it builds the actual EE features against Plan 02's extension points, migrates Acropolis enterprise services from CE to EE, and lights up the customer demo path.

**Goal:** Land the first commercially-meaningful Enterprise Edition release. After this plan: EE customers can install Parthenon with Keycloak SSO + SAML/SCIM, multi-tenancy, FIPS-mode crypto, signed audit retention, Datadog/Splunk/OTel observability, and a Kubernetes operator skeleton. Acropolis enterprise services (n8n, Superset, DataHub, Wazuh, Keycloak) live in EE; CE no longer ships them.

**Architecture:** Three parallel work tracks land into `Acumenus-Data-Sciences/Parthenon-EE`:
- **Track A — migrations CE→EE:** Move enterprise-only files out of public CE and into `enterprise/` overlay, with a 1-version deprecation window in CE.
- **Track B — EE drivers consuming Plan 02 contracts:** Six driver implementations (Keycloak, SAML, SCIM, MultiTenantResolver, FipsCryptoProvider, SignedAuditSink) plus three observability shippers.
- **Track C — net-new EE services:** Parthenon Operator skeleton, license module, EE installer phases.

**Tech Stack:** PHP 8.4 + Laravel 11 (drivers), Python 3.12 (operator + installer phases), TypeScript + React 19 (admin UIs), Kubernetes 1.30+ + Helm 3, OpenSSL FIPS module 3.x, simplesamlphp/laravel-saml2, OpenTelemetry collector.

**Spec reference:** Spec §4.2, §7 Phase 4.

**Prerequisites:**
- Plan 01 fully merged (AGPLv3 live)
- Plan 02 fully executed (8 extension points merged; license-guard passes; admin UIs gated by `<EnterpriseGate>`)
- Plan 03 fully executed (`Parthenon-EE` repo live, daily CE sync running, EE CI on `beastmode` self-hosted runner, signed image build proven)
- Counsel-finalized `LICENSE-EE` in repo (no longer DRAFT)
- CLA Assistant gating CE contributions

**Out of scope:**
- Full Parthenon Operator implementation (only skeleton CRDs + reconciler stubs ship here; full controller logic → v1.2)
- Acumenus-hosted managed Abby AI service (post-Hyperscaler-Terraforms)
- Telemetry phone-home implementation (extension point ready; impl deferred)
- Migration to Approach C (proper packages) — that's the v2.5 path
- HSM integration for crypto provider — future

---

## Pre-flight

```bash
# In the EE repo
cd /home/smudoshi/Github/Parthenon-EE
git checkout main && git pull
./scripts/sync-from-ce.sh   # ensure CE pin is current

# Verify Plan 02 extension points exist in the pinned CE subtree
test -f parthenon/backend/app/Contracts/AuthDriverInterface.php || echo "FAIL: Plan 02-01 not merged"
test -f parthenon/backend/app/Contracts/TenantResolverInterface.php || echo "FAIL: Plan 02-02 not merged"
test -f parthenon/backend/app/Contracts/CryptoProviderInterface.php || echo "FAIL: Plan 02-03 not merged"
test -f parthenon/backend/app/Contracts/AuditSinkInterface.php || echo "FAIL: Plan 02-04 not merged"
test -f parthenon/backend/app/Contracts/ObservabilityShipperInterface.php || echo "FAIL: Plan 02-05 not merged"

# Verify Plan 03 infrastructure
gh api repos/Acumenus-Data-Sciences/Parthenon-EE/actions/runners --jq '.runners[].name'  # → "beastmode"
test -f .acumenus/cosign/cosign.pub
test -x scripts/build-ee.sh
```

---

## Plan 04 task ordering

The plan has 15 tasks. Many are independent and can be parallelized; follow this dependency order if working sequentially:

```
Foundation:           Task 0 (EE packaging — composer.json, npm scope, templates/commercial decision)
Track A (migrations): Tasks 1, 2 (pair-PR per asset)
Track B (drivers):    Tasks 3 (license module — first because everything else gates on it),
                      Tasks 4-9 (drivers, parallelizable)
Track C (infra):      Tasks 10 (operator skeleton), 11 (EE installer phases)
Bookkeeping:          Tasks 12 (CE README/ROADMAP), 13 (smoke), 14 (release)
```

---

## Task 0: EE packaging foundation (C2, C3, I2, I5)

**Why first:** Without these structural pieces, every later task breaks. Composer can't autoload the `Acumenus\Parthenon\Enterprise\` namespace, the EE service provider can't register, and the existing `templates/commercial/` directory creates an architectural conflict.

### 0.1 EE backend `composer.json` (C3)

```bash
cd /home/smudoshi/Github/Parthenon-EE
mkdir -p enterprise/backend/src
cat > enterprise/backend/composer.json <<'EOF'
{
  "$schema": "https://getcomposer.org/schema.json",
  "name": "acumenus-data-sciences/parthenon-ee-backend",
  "description": "Parthenon Enterprise Edition — proprietary backend overlay extending parthenon-backend (AGPL-3.0-only) via documented extension points.",
  "type": "library",
  "license": "proprietary",
  "require": {
    "php": "^8.4",
    "firebase/php-jwt": "^7.0",
    "aacotroneo/laravel-saml2": "^7.0",
    "league/oauth2-client": "^2.7"
  },
  "require-dev": {
    "pestphp/pest": "^3.8",
    "mockery/mockery": "^1.6"
  },
  "autoload": {
    "psr-4": {
      "Acumenus\\Parthenon\\Enterprise\\": "src/"
    }
  },
  "autoload-dev": {
    "psr-4": {
      "Acumenus\\Parthenon\\Enterprise\\Tests\\": "tests/"
    }
  },
  "extra": {
    "laravel": {
      "providers": [
        "Acumenus\\Parthenon\\Enterprise\\EnterpriseServiceProvider"
      ]
    }
  },
  "minimum-stability": "stable"
}
EOF
```

### 0.2 Composer install layering — CE first, then EE (I5)

CE's `parthenon/backend/composer.lock` is authoritative for shared deps. EE adds dependencies that don't exist in CE; if EE needs a different version of a CE dep, **that's a contract breach and must be resolved by upstreaming the version bump to CE first**.

The combined install runs in order:
1. `composer install --working-dir=parthenon/backend --no-dev --no-interaction` — installs CE deps + locks autoloader
2. Overlay EE PSR-4 namespace by appending to CE's autoload at runtime via the EE service provider's `register()` hook (composer doesn't natively merge two `composer.json` files in one project)

The overlay mechanism: EE's `Dockerfile.fips` (Task 8) mounts `enterprise/backend/src/` into the CE PHP container at `/var/www/html/enterprise-overlay/src/` and adds a custom autoload entry to `vendor/composer/autoload_psr4.php` via a `composer-merge-plugin` registered in `enterprise/backend/composer.json`:

```bash
# enterprise/backend/Dockerfile.layer (built on top of CE's parthenon-php image)
FROM ghcr.io/acumenus-data-sciences/parthenon-php:${PARTHENON_IMAGE_TAG}

USER root
RUN composer global require wikimedia/composer-merge-plugin:^2.1
COPY enterprise/backend/composer.json /var/www/html/enterprise/composer.json
COPY enterprise/backend/src /var/www/html/enterprise/src

# Merge EE composer.json into CE's via composer-merge-plugin
WORKDIR /var/www/html
RUN composer config extra.merge-plugin.include "enterprise/composer.json" && \
    composer install --no-dev --no-interaction --no-scripts && \
    composer dump-autoload -o
USER www-data
```

**Pin versions in `enterprise/backend/composer.json`** (no `^`-style ranges) for reproducibility. Update via Renovate / Dependabot configured separately on the EE repo.

### 0.3 EE frontend packaging (I2)

EE frontend code lives at `enterprise/frontend/src/features/admin-enterprise/`. Decision: **relative imports through the subtree, no separate npm package**. Rationale:

- One Vite build pipeline; no peer-dep matching dance
- EE devs see one tree in IDE; better DX
- `vite build` from `parthenon/frontend/` with `enterprise/frontend/` added as an extra `resolve.alias` entry produces a single bundle
- EE-only routes register via `enterprise/frontend/src/registerRoutes.ts` which is conditionally imported when the `auth.keycloak` (or any EE) flag is set

Add to `parthenon/frontend/vite.config.ts` a CE-side conditional that respects the EE working tree:

```ts
// enterprise/frontend/vite.config.overlay.ts (EE side; loaded when present)
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../parthenon/frontend/vite.config';

export default mergeConfig(baseConfig, defineConfig({
  resolve: {
    alias: {
      '@enterprise': '../../enterprise/frontend/src',
    },
  },
}));
```

EE devs run `vite build --config enterprise/frontend/vite.config.overlay.ts` from the EE working tree root. CE devs run the standard `vite build` and never see EE code.

The CE frontend's `App.tsx` does **not** import from `@enterprise/...` — only the EE-built bundle does. EE-only views are dynamically imported behind the corresponding `<EnterpriseGate>`:

```tsx
// In parthenon/frontend/src/App.tsx — CE has no static reference to enterprise/.
// EE's overlay vite config injects this dynamic import:
const EeAdminPanel = React.lazy(() => import('@enterprise/features/admin-enterprise/AdminPanel'));
```

### 0.4 `templates/commercial/` decision (C2)

The pre-existing `templates/commercial/` directory in CE (and its companion `parthenon-templates-commercial` wheel + `community-wheel-isolation` CI job) is a CE-resident proprietary tier that **predates** the CE/EE fork plans. Decision: **migrate it to EE**.

Rationale:
- Spec model says proprietary code lives in `Parthenon-EE`. CE-resident proprietary code violates that.
- The existing `community-wheel-isolation` CI job becomes redundant once the proprietary code is no longer in the CE tree.
- Customers who use the templates-commercial wheel can install it from the EE namespace going forward.

Migration steps (treat as Task 2 sub-asset):

1. **EE side** — copy `templates/commercial/` (from the pinned CE subtree) into `enterprise/templates/commercial/`:
   ```bash
   cp -r parthenon/templates/commercial enterprise/templates/commercial
   ```
2. **EE side** — update the wheel's `pyproject.toml`:
   - Rename package: `parthenon-templates-commercial` → `acumenus-data-sciences-parthenon-templates-commercial`
   - Update GitHub source URL in metadata
   - Update license to `proprietary` (was implicit before)
3. **EE side** — wire the EE wheel build into `scripts/build-ee.sh`:
   ```bash
   docker buildx build -t ghcr.io/acumenus-data-sciences/parthenon-ee-templates-commercial:${TAG} \
     -f enterprise/templates/Dockerfile.commercial .
   ```
4. **CE side (paired PR)** — delete `templates/commercial/` from CE; remove the `community-wheel-isolation` CI job (its sole purpose was preventing accidental inclusion of proprietary code; once that code is gone, the job is moot); update `templates/pyproject.toml` to drop the `runtime/commercial` exclusion (the path no longer exists).
5. **CE side** — add a brief note in `CHANGELOG.md` explaining that the templates-commercial wheel has moved to EE; existing users get instructions to switch the install source.

This is a **breaking change for any existing customer using the templates-commercial wheel**. Coordinate with customer-success before merging the CE deletion PR. The EE addition PR can land first; CE deletion follows after a 1-version deprecation period (consistent with the deprecation pattern used in Tasks 1 and 2).

### 0.5 Done criteria for Task 0

- [ ] `enterprise/backend/composer.json` exists; `composer install` from EE working tree succeeds
- [ ] `enterprise/backend/Dockerfile.layer` builds on top of `parthenon-php` and produces a working autoloader
- [ ] EE frontend overlay vite config builds without touching CE code
- [ ] `enterprise/templates/commercial/` lives in EE; CE deprecation PR opened
- [ ] `composer-merge-plugin` overlay verified: `php artisan tinker` from inside EE container can `new \Acumenus\Parthenon\Enterprise\License\LicenseService(...)` without autoload error

---

## Task 1: Migrate Acropolis enterprise compose CE→EE

The Acropolis enterprise compose file lives at `acropolis/docker-compose.enterprise.yml` in CE today. Move it to EE.

### 1.1 EE side — add the file

```bash
cd /home/smudoshi/Github/Parthenon-EE
git checkout -b feat/migrate-acropolis-ee-compose

mkdir -p enterprise/acropolis
cp parthenon/acropolis/docker-compose.enterprise.yml enterprise/acropolis/docker-compose.enterprise.yml

# Edit: rewrite image refs to ghcr.io/acumenus-data-sciences/parthenon-ee-* where applicable
sed -i 's|ghcr\.io/acumenus-data-sciences/parthenon-|ghcr.io/acumenus-data-sciences/parthenon-ee-|g' enterprise/acropolis/docker-compose.enterprise.yml

# Edit: ensure ports >= 8100 per Plan 02-08 contract; add parthenon-ee-* prefix to volumes
# (manual review of each service — see compose-composition.md rules 1, 3, 7)
```

Add a top-level `enterprise/acropolis/README.md` documenting the move and the relationship to the CE Acropolis community compose.

### 1.2 CE side — deprecation notice (paired PR against `Acumenus-Data-Sciences/Parthenon`)

```bash
cd /home/smudoshi/Github/Parthenon
git checkout main && git pull
git checkout -b chore/deprecate-acropolis-enterprise-compose

# Add a deprecation header to acropolis/docker-compose.enterprise.yml
cat > /tmp/depr-header <<'EOF'
# DEPRECATED — Parthenon Enterprise Edition has moved to a separate repository.
#
# This file is retained for one minor version (until v1.x.0) so existing
# Acumenus-Data-Sciences EE customers running the old single-repo deployment
# can continue to operate while they migrate to the EE repo's
# docker-compose.ee.yml.
#
# To migrate:
#   1. Obtain access to github.com/Acumenus-Data-Sciences/Parthenon-EE
#      (contact licensing@acumenus.net)
#   2. Run docker compose -f parthenon/docker-compose.yml -f docker-compose.ee.yml up -d
#      from inside the Parthenon-EE checkout.
#
# After v1.x.0 (the next minor release of CE), this file will be deleted.
EOF
cat /tmp/depr-header acropolis/docker-compose.enterprise.yml > /tmp/new-compose
mv /tmp/new-compose acropolis/docker-compose.enterprise.yml

git add acropolis/docker-compose.enterprise.yml
git commit -m "chore(deprecate): mark acropolis/docker-compose.enterprise.yml deprecated

EE has moved to github.com/Acumenus-Data-Sciences/Parthenon-EE. This file
remains for one minor version so existing customers can migrate.

Removal scheduled: v1.x.0 (next minor release)."
git push -u origin chore/deprecate-acropolis-enterprise-compose
gh pr create --title "chore(deprecate): acropolis/docker-compose.enterprise.yml moved to EE" \
  --body "EE compose moved to github.com/Acumenus-Data-Sciences/Parthenon-EE per Plan 04 Task 1. This deprecation header lives in CE for one minor version. After v1.x.0, the file is deleted (separate cleanup PR)."
```

### 1.3 EE side — finish + push

```bash
cd /home/smudoshi/Github/Parthenon-EE
# Merge the new docker-compose.ee.yml structure: extend CE compose with enterprise services
# Plan 03 left a stub; this task replaces it with the full EE composition.
git add enterprise/acropolis/
git commit -m "feat(ee): migrate Acropolis enterprise compose from CE"
git push -u origin feat/migrate-acropolis-ee-compose
gh pr create --title "feat(ee): migrate Acropolis enterprise compose from CE" --body "Pair-PR with chore/deprecate-acropolis-enterprise-compose in CE. Per Plan 02-08 compose-composition contract: image refs updated to ghcr.io/acumenus-data-sciences/parthenon-ee-*, volumes prefixed parthenon-ee-*, ports >= 8100."
```

---

## Task 2: Migrate remaining enterprise assets (per asset table)

Same paired-PR pattern as Task 1, applied to each asset. Each row is its own PR-pair (small, reviewable diffs).

| Asset | CE source | EE destination |
|---|---|---|
| n8n config | `acropolis/config/n8n*` | `enterprise/acropolis/n8n/` |
| Apache Superset config | `acropolis/config/superset*` | `enterprise/acropolis/superset/` |
| DataHub config | `acropolis/config/datahub*` | `enterprise/acropolis/datahub/` |
| Wazuh config (if present) | `acropolis/config/wazuh*` | `enterprise/acropolis/wazuh/` |
| K8s / Helm charts | `acropolis/k8s/` | `enterprise/k8s/` |
| Keycloak migration scaffolding (per ROADMAP v1.2) | (not yet present in CE) | `enterprise/acropolis/keycloak/` (build new) |
| Enterprise docs | `docs/handoffs/*-enterprise-*`, `docs/architecture/*-enterprise-*` | `enterprise/docs/` |

Per asset:
1. Copy from CE → EE; rewrite paths and image refs per Plan 02-08 contract
2. Add deprecation header in CE; commit + open paired-PR
3. Add to EE composition (`docker-compose.ee.yml`); commit + open EE PR
4. Coordinate merge: CE deprecation PR first, EE addition PR after CE merge

For Wazuh and DataHub, verify they actually exist in CE first; if not, build fresh in EE.

**Do NOT migrate yet:**
- Authentik configs — Authentik stays in CE per the architecture (Acropolis Community Edition uses Authentik). EE replaces Authentik with Keycloak (Task 4 below).

---

## Task 3: License module (gates everything else in EE)

EE features check a license entitlement. Without a valid license, EE drivers register but refuse to operate.

### 3.1 License token format

JWT signed with the Acumenus license-server private key. Customer receives the JWT as a single string. Header includes `kid` for key rotation. Claims:

```json
{
  "iss": "Acumenus Data Sciences, Inc.",
  "sub": "Customer Name (Org)",
  "aud": "parthenon-ee",
  "iat": 1715000000,
  "nbf": 1715000000,
  "exp": 1746536000,
  "tier": "enterprise",
  "support": "premium",
  "entitlements": [
    "auth.keycloak", "auth.saml", "auth.scim",
    "tenancy.multi", "audit.signed",
    "observability.datadog", "observability.splunk",
    "crypto.fips", "operator.k8s"
  ],
  "max_users": 5000,
  "max_tenants": 50,
  "license_id": "acumenus-license-001"
}
```

### 3.2 EE License service

```php
// enterprise/backend/src/License/LicenseService.php
<?php
namespace Acumenus\Parthenon\Enterprise\License;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Support\Facades\Cache;

class LicenseService
{
    public function __construct(
        private readonly string $publicKeyPem,    // shipped at /etc/parthenon-ee/license-pub.pem
        private readonly string $licenseToken,    // from env LICENSE_TOKEN
    ) {}

    public function claims(): LicenseClaims
    {
        // I4: cache TTL is intentionally short (60s) to bound the
        // revocation window. If a customer's license is revoked
        // (cancellation, fraud), they keep working for at most 60s.
        // For investor MVP this is sufficient; v1.x adds a CRL
        // (certificate revocation list) fetch + license-server check-in.
        // Tunable via LICENSE_CACHE_TTL_SECONDS env (min 30, max 3600).
        $ttl = max(30, min(3600, (int) env('LICENSE_CACHE_TTL_SECONDS', 60)));
        return Cache::remember('parthenon-ee.license', $ttl, function () {
            try {
                $decoded = JWT::decode($this->licenseToken, new Key($this->publicKeyPem, 'RS256'));
                $claims = LicenseClaims::fromObject($decoded);
                // Belt-and-braces: enforce nbf/exp here even though JWT::decode does too.
                $now = time();
                if ($claims->expiresAt < $now) {
                    throw new InvalidLicenseException('License expired at ' . date('c', $claims->expiresAt));
                }
                if ($claims->notBefore > $now) {
                    throw new InvalidLicenseException('License not yet valid (nbf=' . date('c', $claims->notBefore) . ')');
                }
                return $claims;
            } catch (\Throwable $e) {
                throw new InvalidLicenseException('License validation failed: ' . $e->getMessage(), 0, $e);
            }
        });
    }

    public function hasEntitlement(string $entitlement): bool
    {
        try {
            return in_array($entitlement, $this->claims()->entitlements, true);
        } catch (InvalidLicenseException) {
            return false;
        }
    }

    public function assertEntitlement(string $entitlement): void
    {
        if (!$this->hasEntitlement($entitlement)) {
            throw new InvalidLicenseException("Missing entitlement: $entitlement");
        }
    }
}
```

```php
// enterprise/backend/src/License/LicenseClaims.php
<?php
namespace Acumenus\Parthenon\Enterprise\License;

final readonly class LicenseClaims
{
    public function __construct(
        public string $issuer,
        public string $subject,
        public int $issuedAt,
        public int $notBefore,
        public int $expiresAt,
        public string $tier,
        public string $support,
        /** @var array<int, string> */
        public array $entitlements,
        public int $maxUsers,
        public int $maxTenants,
        public string $licenseId,
    ) {}

    public static function fromObject(\stdClass $o): self
    {
        return new self(
            issuer: $o->iss,
            subject: $o->sub,
            issuedAt: $o->iat,
            notBefore: $o->nbf,
            expiresAt: $o->exp,
            tier: $o->tier ?? 'enterprise',
            support: $o->support ?? 'standard',
            entitlements: $o->entitlements ?? [],
            maxUsers: $o->max_users ?? PHP_INT_MAX,
            maxTenants: $o->max_tenants ?? PHP_INT_MAX,
            licenseId: $o->license_id ?? 'unknown',
        );
    }
}
```

### 3.3 Service provider registers all EE features behind license check

```php
// enterprise/backend/src/EnterpriseServiceProvider.php
<?php
namespace Acumenus\Parthenon\Enterprise;

use Acumenus\Parthenon\Enterprise\License\LicenseService;
use App\Auth\AuthDriverRegistry;
use App\Audit\AuditSinkRegistry;
use App\Observability\ShipperRegistry;
use App\Contracts\TenantResolverInterface;
use App\Contracts\CryptoProviderInterface;
use Illuminate\Support\ServiceProvider;

class EnterpriseServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(LicenseService::class, fn() => new LicenseService(
            publicKeyPem: file_get_contents(env('LICENSE_PUBLIC_KEY_PATH', '/etc/parthenon-ee/license-pub.pem')),
            licenseToken: env('LICENSE_TOKEN', ''),
        ));
    }

    public function boot(): void
    {
        /** @var LicenseService $license */
        $license = $this->app->make(LicenseService::class);

        // Each EE feature is registered only if its entitlement is present.
        // Missing entitlement = feature stays unregistered = EE driver isn't available.

        if ($license->hasEntitlement('auth.keycloak')) {
            $this->app->make(AuthDriverRegistry::class)
                ->register($this->app->make(\Acumenus\Parthenon\Enterprise\Auth\KeycloakAuthDriver::class));
        }
        if ($license->hasEntitlement('auth.saml')) {
            $this->app->make(AuthDriverRegistry::class)
                ->register($this->app->make(\Acumenus\Parthenon\Enterprise\Auth\SamlAuthDriver::class));
        }
        if ($license->hasEntitlement('auth.scim')) {
            // SCIM controllers register routes (see SCIMRoutes.php) gated by entitlement
        }
        if ($license->hasEntitlement('tenancy.multi')) {
            $this->app->bind(TenantResolverInterface::class, \Acumenus\Parthenon\Enterprise\Tenant\MultiTenantResolver::class);
        }
        if ($license->hasEntitlement('crypto.fips')) {
            $this->app->bind(CryptoProviderInterface::class, \Acumenus\Parthenon\Enterprise\Crypto\FipsCryptoProvider::class);
        }
        if ($license->hasEntitlement('audit.signed')) {
            $this->app->make(AuditSinkRegistry::class)
                ->register($this->app->make(\Acumenus\Parthenon\Enterprise\Audit\SignedAuditSink::class));
        }
        if ($license->hasEntitlement('observability.datadog')) {
            $this->app->make(ShipperRegistry::class)
                ->register($this->app->make(\Acumenus\Parthenon\Enterprise\Observability\DatadogShipper::class));
        }
        if ($license->hasEntitlement('observability.splunk')) {
            $this->app->make(ShipperRegistry::class)
                ->register($this->app->make(\Acumenus\Parthenon\Enterprise\Observability\SplunkShipper::class));
        }
        if ($license->hasEntitlement('observability.opentelemetry')) {
            $this->app->make(ShipperRegistry::class)
                ->register($this->app->make(\Acumenus\Parthenon\Enterprise\Observability\OtelShipper::class));
        }
    }
}
```

### 3.4 Tests

Tests live at `enterprise/backend/tests/License/`. Cover: valid license, expired license, tampered signature, missing token, entitlement missing → feature not registered.

### 3.5 PR

```bash
git checkout -b feat/license-module
# ... add the three files above + tests + composer.json autoload entry ...
git push -u origin feat/license-module
gh pr create --title "feat(ee): license module (JWT entitlements + service provider)"
```

---

## Task 4: KeycloakAuthDriver (consumes Plan 02-01 AuthDriverInterface)

Replaces Authentik in EE deployments. Implements the OIDC handshake against Keycloak's `master` or per-tenant realm.

### 4.1 Add the Keycloak service to `enterprise/acropolis/docker-compose.enterprise.yml`

```yaml
keycloak:
  container_name: parthenon-ee-keycloak
  image: quay.io/keycloak/keycloak:25.0
  command: start --hostname https://keycloak.${DOMAIN}
  environment:
    KC_DB: postgres
    KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
    KC_DB_USERNAME: keycloak
    KC_DB_PASSWORD: ${KEYCLOAK_DB_PASSWORD}
    KEYCLOAK_ADMIN: ${KEYCLOAK_ADMIN_USER}
    KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
    KC_PROXY: edge
  ports:
    - "8181:8080"
  networks:
    - parthenon
    - acropolis-backend
  depends_on:
    postgres: { condition: service_healthy }
  healthcheck:
    test: ["CMD-SHELL", "curl -f http://localhost:8080/health/ready || exit 1"]
    interval: 30s
    retries: 5
```

### 4.2 KeycloakAuthDriver implementation

```php
// enterprise/backend/src/Auth/KeycloakAuthDriver.php
<?php
namespace Acumenus\Parthenon\Enterprise\Auth;

use App\Auth\Drivers\AuthDriverException;
use App\Auth\Drivers\AuthDriverResult;
use App\Contracts\AuthDriverInterface;
use App\Models\User;
use Acumenus\Parthenon\Enterprise\Auth\Oidc\KeycloakClient;

class KeycloakAuthDriver implements AuthDriverInterface
{
    public function __construct(private readonly KeycloakClient $client) {}

    public function name(): string { return 'keycloak'; }

    public function isAvailable(): bool {
        return !empty(config('services.keycloak.realm'))
            && !empty(config('services.keycloak.client_id'));
    }

    public function authenticate(array $credentials): AuthDriverResult {
        if (!isset($credentials['code'], $credentials['state'])) {
            throw new AuthDriverException('Missing code/state', AuthDriverException::CODE_MALFORMED_CREDENTIALS, $this->name());
        }
        try {
            $tokens = $this->client->exchangeCodeForTokens($credentials['code'], $credentials['state']);
            $userInfo = $this->client->userInfo($tokens->accessToken);
        } catch (\Throwable $e) {
            throw new AuthDriverException('Keycloak validation failed', AuthDriverException::CODE_INVALID_CREDENTIALS, $this->name(), $e);
        }

        $user = User::firstOrCreate(
            ['email' => strtolower($userInfo->email)],
            ['name' => $userInfo->name, 'password' => null, 'must_change_password' => false],
        );

        // C1 + HIGHSEC §1.1: every newly-provisioned SSO user gets the viewer
        // role baseline. Group → role mapping then PROMOTES on top of that
        // baseline. This ensures a misconfigured group claim or empty
        // groups list never leaves a fresh user with no role at all,
        // and never silently elevates beyond what the IdP asserts.
        if ($user->wasRecentlyCreated) {
            $user->assignRole(['viewer']);
        }

        // Group → role mapping (PROMOTES from viewer based on IdP groups)
        $this->mapGroupsToRoles($user, $userInfo->groups);

        return new AuthDriverResult(
            user: $user,
            driverName: $this->name(),
            mustChangePassword: false,
            providerSubject: $userInfo->sub,
            providerClaims: [
                'email' => $userInfo->email,
                'name' => $userInfo->name,
                'groups' => $userInfo->groups,
                'mfa_authenticated' => $userInfo->amrIncludesMfa,
            ],
        );
    }
    // ...
}
```

### 4.3 Cross-Plan note (Plan 02-01 contract gap)

Plan 02-01's `AuthDriverResult` does **not** carry an `mfa_authenticated` flag in its constructor. SAML and Keycloak step-up flows need this for downstream RBAC. **Action:** Plan 02-01 needs a contract revision adding an optional `bool $mfaAuthenticated = false` parameter. The change is backward-compatible (default value = current behavior). See *Cross-Plan Revision Notes* at the end of this plan.

### 4.4 Tests + PR

Tests at `enterprise/backend/tests/Auth/KeycloakAuthDriverTest.php`. Mock the `KeycloakClient` to verify token exchange, user upsert, group→role mapping, MFA claim propagation, and the C1 `viewer`-role-baseline assignment for newly-provisioned users.

Open PR: `feat(ee-auth): KeycloakAuthDriver`

### 4.5 Customer migration: Authentik → Keycloak (I1)

Existing pilot customers (Geisinger, Hive Networks, any other private-fork users) running CE+EE in the single-repo deployment have user data + groups in Authentik. After Plan 04 ships they're upgrading to the EE repo's Keycloak. Here's the user-data migration runbook:

#### Pre-migration checklist

- [ ] Export Authentik users + groups + permissions (admin → Backup → Configurable JSON)
- [ ] Identify in-flight Sanctum tokens issued through Authentik OIDC (these stay valid until `sanctum.expiration` — 8h per HIGHSEC §1.2 — so plan a window)
- [ ] Notify users 7 days ahead: SSO sign-in flow changing; logout/login required
- [ ] Snapshot the Acumenus database (Authentik's user_external_identities rows must survive)

#### Migration day

1. **Stand up Keycloak** alongside Authentik (both running, no traffic to Keycloak yet):
   ```bash
   docker compose -f parthenon/docker-compose.yml \
                  -f docker-compose.ee.yml \
                  up -d keycloak
   ```

2. **Bootstrap the realm** by running the EE installer's `keycloak_setup` phase (Plan 02-07 + Plan 04 Task 12):
   ```bash
   python3 enterprise/installer/main.py --phase=keycloak_setup --tier=enterprise
   ```
   This creates the Parthenon realm, the `parthenon-app` client, and applies the standard mapper set (email, given_name, family_name, groups).

3. **Import users from Authentik** via Keycloak's bulk import:
   ```bash
   # Convert Authentik export JSON → Keycloak realm JSON via the helper
   python3 enterprise/installer/scripts/authentik-to-keycloak.py \
     --authentik-export ~/authentik-backup-$(date -I).json \
     --output /tmp/keycloak-realm-import.json

   # Import (Keycloak admin CLI)
   docker compose exec keycloak \
     /opt/keycloak/bin/kcadm.sh create partial-import \
     -r parthenon \
     -f /tmp/keycloak-realm-import.json \
     -s ifResourceExists=OVERWRITE
   ```

4. **Verify group → role mapping** by running a smoke test for each role tier (super-admin, admin, researcher, data-steward, mapping-reviewer, viewer): create one test user per tier in Keycloak with the appropriate group membership; log in via the new flow; confirm Spatie permissions match the IdP groups.

5. **Switch Parthenon's auth driver** by setting in `enterprise/.env`:
   ```
   AUTH_DEFAULT_DRIVER=keycloak
   ```
   then restart php + node containers. The login page auto-discovers via `GET /api/v1/system/feature-flags` and routes new logins to Keycloak.

6. **Drain Authentik traffic.** Sanctum tokens issued under Authentik continue to work until they expire (≤8h). New logins go to Keycloak. The Authentik container can stay running for the 8h window for in-flight session continuity, then be stopped.

7. **Decommission Authentik** after the 8h drain:
   ```bash
   docker compose stop authentik
   docker compose rm -f authentik
   docker volume rm parthenon-authentik-data    # AFTER backing up the volume
   ```

#### Rollback

If Keycloak login fails for any tier during step 4 verification:

1. `AUTH_DEFAULT_DRIVER=authentik-oidc` in `.env`; restart php+node
2. Authentik resumes serving login traffic
3. File a bug; do not proceed until it's resolved
4. Imported Keycloak users remain (idempotent on next attempt)

#### Customers running their own IdP

For customers who already use Okta / Azure AD / Auth0 via Authentik as a federation broker: Keycloak supports the same broker pattern. Configure the Keycloak Identity Provider in the Parthenon realm to point at their existing IdP. No user-data migration needed — Keycloak just acts as a different broker.

#### Documentation deliverable

Add this runbook to `enterprise/docs/customer-migrations/authentik-to-keycloak.md` as a deliverable of this PR.

---

## Task 5: SamlAuthDriver (consumes Plan 02-01)

### 5.1 Composer dependency

```bash
docker compose -f parthenon/docker-compose.yml exec -T php sh -c \
  'cd /var/www/html && composer require aacotroneo/laravel-saml2:^7.0'
```

(Done from inside the EE working tree — composer install picks up enterprise/backend/composer.json which extends CE's composer.json with EE-only requires.)

### 5.2 SamlAuthDriver implementation

```php
// enterprise/backend/src/Auth/SamlAuthDriver.php
<?php
namespace Acumenus\Parthenon\Enterprise\Auth;

use App\Auth\Drivers\AuthDriverException;
use App\Auth\Drivers\AuthDriverResult;
use App\Contracts\AuthDriverInterface;
use App\Models\User;
use Aacotroneo\Saml2\Saml2Auth;

class SamlAuthDriver implements AuthDriverInterface
{
    public function __construct(private readonly Saml2Auth $saml) {}

    public function name(): string { return 'saml'; }

    public function isAvailable(): bool {
        return !empty(config('saml2_settings.idp_entityId'));
    }

    public function authenticate(array $credentials): AuthDriverResult {
        // SAML differs from OIDC: the IdP POSTs the assertion to our ACS endpoint.
        // The SamlController::acs() route catches the assertion, calls this driver
        // with credentials = ['saml_response' => $base64Response, 'relay_state' => ...].

        if (!isset($credentials['saml_response'])) {
            throw new AuthDriverException('Missing saml_response', AuthDriverException::CODE_MALFORMED_CREDENTIALS, $this->name());
        }

        try {
            $this->saml->processSamlResponse($credentials['saml_response']);
            $samlUser = $this->saml->getSaml2User();
        } catch (\Throwable $e) {
            throw new AuthDriverException('SAML assertion validation failed', AuthDriverException::CODE_INVALID_CREDENTIALS, $this->name(), $e);
        }

        $email = $samlUser->getAttribute('email')[0] ?? throw new AuthDriverException('SAML response missing email', AuthDriverException::CODE_MALFORMED_CREDENTIALS, $this->name());
        $user = User::firstOrCreate(
            ['email' => strtolower($email)],
            ['name' => $samlUser->getAttribute('displayName')[0] ?? $email],
        );

        // C1 + HIGHSEC §1.1: SAML-provisioned new users get viewer role only.
        // SAML group attribute → role mapping (when implemented) PROMOTES from
        // this baseline. Default safety: no role claim = viewer.
        if ($user->wasRecentlyCreated) {
            $user->assignRole(['viewer']);
        }

        return new AuthDriverResult(
            user: $user,
            driverName: $this->name(),
            providerSubject: $samlUser->getNameId(),
            providerClaims: $samlUser->getAttributes(),
            // Per Plan 02-01 revision: mfaAuthenticated TRUE if AuthnContext indicates step-up.
            // mfaAuthenticated: $this->isAuthnContextMfa($samlUser),
        );
    }
}
```

### 5.3 ACS controller route

```php
// enterprise/backend/src/Auth/SamlController.php
public function acs(\Illuminate\Http\Request $request, AuthDriverRegistry $registry): JsonResponse {
    try {
        $result = $registry->driver('saml')->authenticate([
            'saml_response' => $request->input('SAMLResponse'),
            'relay_state' => $request->input('RelayState'),
        ]);
    } catch (AuthDriverException $e) {
        return response()->json(['error' => $e->getMessage()], 401);
    }
    $token = $result->user->createToken('auth-token')->plainTextToken;
    return response()->json(['token' => $token, 'user' => $result->user]);
}
```

### 5.4 Tests + PR

Test the assertion processing with a fixture SAML response (sample at `enterprise/backend/tests/Auth/fixtures/saml-response-sample.xml`).

PR: `feat(ee-auth): SamlAuthDriver`

---

## Task 6: ScimSyncService + SCIM 2.0 controllers

SCIM is **not a request-time auth driver** — it's a server-to-server provisioning protocol. The IdP (Okta, Azure AD) calls our SCIM endpoints to create/update/disable users. We register SCIM routes that map onto our User model.

### 6.1 SCIM endpoints

```php
// enterprise/backend/src/Auth/Scim/ScimController.php
//
// Implements RFC 7644 endpoints:
//   GET    /api/scim/v2/Users
//   POST   /api/scim/v2/Users
//   GET    /api/scim/v2/Users/{id}
//   PUT    /api/scim/v2/Users/{id}
//   PATCH  /api/scim/v2/Users/{id}
//   DELETE /api/scim/v2/Users/{id}
//   ... and equivalent /Groups endpoints
```

### 6.2 Bearer token auth

SCIM clients authenticate with a per-IdP bearer token. Tokens are issued by an admin in the EE admin UI (see Task 9 frontend) and stored in a new `scim_clients` table.

### 6.3 PR

`feat(ee-auth): SCIM 2.0 endpoints + ScimSyncService`

---

## Task 7: MultiTenantResolver (consumes Plan 02-02)

```php
// enterprise/backend/src/Tenant/MultiTenantResolver.php
<?php
namespace Acumenus\Parthenon\Enterprise\Tenant;

use App\Contracts\TenantResolverInterface;
use App\Tenancy\Tenant;
use Illuminate\Http\Request;

class MultiTenantResolver implements TenantResolverInterface
{
    private ?Tenant $current = null;

    public function __construct(private readonly Request $request) {}

    public function current(): Tenant {
        if ($this->current) return $this->current;

        // Resolution order: subdomain > X-Tenant-Slug header > JWT claim > authenticated user's primary tenant
        $slug = $this->resolveFromSubdomain()
              ?? $this->request->header('X-Tenant-Slug')
              ?? $this->resolveFromJwtClaim()
              ?? $this->resolveFromUser();

        if ($slug === null) {
            throw new \RuntimeException('Could not resolve tenant from any source');
        }

        return $this->current = Tenant::where('slug', $slug)->firstOrFail();
    }

    public function currentId(): int { return $this->current()->id; }
    public function setCurrent(Tenant $tenant): void { $this->current = $tenant; }
    public function clear(): void { $this->current = null; }

    private function resolveFromSubdomain(): ?string {
        $host = $this->request->getHost();
        if (preg_match('/^([a-z0-9-]+)\.parthenon\.acumenus\.net$/', $host, $m)) {
            return $m[1];
        }
        return null;
    }

    // ... other resolution helpers
}
```

### 7.1 Cross-Plan note (Plan 02-02 contract gap)

Plan 02-02 defines `TenantResolverInterface` for **request-scoped** context, but Laravel **queued jobs** do not have an HTTP request. When a job dispatches with the current tenant context, that context must serialize into the job payload and restore on dequeue. Plan 02-02's interface doesn't address this.

**Action:** Plan 02-02 needs a contract revision adding two methods:

```php
public function snapshot(): array;     // serialize current tenant for queue payload
public function restore(array $snap): void;  // restore on job execution
```

CE's `SingleTenantResolver` implements these as no-ops (single tenant always resolves to id=1 anyway). EE's `MultiTenantResolver` serializes/deserializes the tenant slug.

A queued-job middleware (`SetTenantContextMiddleware`) reads the snapshot from the job payload and calls `restore()` before the job's `handle()` runs.

See *Cross-Plan Revision Notes* at the end.

### 7.2 Tenant-aware queued job middleware

```php
// enterprise/backend/src/Tenant/Middleware/SetTenantContextMiddleware.php
class SetTenantContextMiddleware {
    public function handle(\Illuminate\Bus\Queueable $job, \Closure $next) {
        $resolver = app(TenantResolverInterface::class);
        if (isset($job->tenantSnapshot)) {
            $resolver->restore($job->tenantSnapshot);
        }
        return $next($job);
    }
}
```

### 7.3 Tests + PR

`feat(ee-tenancy): MultiTenantResolver + queued job middleware`

---

## Task 8: FipsCryptoProvider (consumes Plan 02-03)

### 8.1 FIPS-validated PHP image

EE PHP container is built from a base with OpenSSL FIPS module 3.x:

```dockerfile
# enterprise/backend/Dockerfile.fips
FROM php:8.4-fpm

# Install OpenSSL FIPS module (build-time)
RUN apt-get update && apt-get install -y openssl libssl-dev wget && \
    wget https://www.openssl.org/source/openssl-3.0.13.tar.gz && \
    tar xzf openssl-3.0.13.tar.gz && \
    cd openssl-3.0.13 && \
    ./Configure enable-fips && make && make install_fips && \
    cd .. && rm -rf openssl-3.0.13*

# Configure PHP to use FIPS module
COPY enterprise/backend/openssl-fips.cnf /etc/ssl/openssl.cnf
ENV OPENSSL_FIPS=1
```

### 8.2 FipsCryptoProvider implementation

Same interface as CE's `LaravelNativeCryptoProvider`, but every call routes through the FIPS module:

```php
// enterprise/backend/src/Crypto/FipsCryptoProvider.php
<?php
namespace Acumenus\Parthenon\Enterprise\Crypto;

use App\Contracts\CryptoProviderInterface;
use App\Crypto\CryptoException;

class FipsCryptoProvider implements CryptoProviderInterface
{
    public function __construct(private readonly string $activeKeyId) {}

    public function name(): string { return 'fips-openssl'; }

    public function isAvailable(): bool {
        return getenv('OPENSSL_FIPS') === '1' && extension_loaded('openssl');
    }

    public function hashPassword(string $plain): string {
        // bcrypt is not FIPS-approved; use PBKDF2-HMAC-SHA256 with 600,000 iterations.
        $salt = random_bytes(16);
        $hash = hash_pbkdf2('sha256', $plain, $salt, 600000, 32, true);
        return 'pbkdf2$' . base64_encode($salt) . '$' . base64_encode($hash);
    }

    public function verifyPassword(string $plain, string $hash): bool {
        if (!str_starts_with($hash, 'pbkdf2$')) return false;
        [, $saltB64, $hashB64] = explode('$', $hash, 3);
        $salt = base64_decode($saltB64);
        $expected = base64_decode($hashB64);
        $actual = hash_pbkdf2('sha256', $plain, $salt, 600000, 32, true);
        return hash_equals($expected, $actual);
    }

    public function needsRehash(string $hash): bool { /* check iteration count */ }

    public function encrypt(string $plaintext): string {
        // AES-256-GCM via FIPS-validated OpenSSL
        $key = $this->getActiveKey();
        $nonce = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag);
        if ($cipher === false) {
            throw new CryptoException('AES-256-GCM encryption failed', CryptoException::CODE_PROVIDER_UNAVAILABLE, $this->name());
        }
        return base64_encode($this->activeKeyId . '|' . $nonce . '|' . $tag . '|' . $cipher);
    }

    public function decrypt(string $ciphertext): string {
        $parts = explode('|', base64_decode($ciphertext), 4);
        if (count($parts) !== 4) throw new CryptoException('Invalid ciphertext format', CryptoException::CODE_INVALID_CIPHERTEXT, $this->name());
        [$keyId, $nonce, $tag, $cipher] = $parts;
        $key = $this->getKeyById($keyId);
        $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag);
        if ($plain === false) {
            throw new CryptoException('Decryption failed (tampered or wrong key)', CryptoException::CODE_TAMPERED, $this->name());
        }
        return $plain;
    }

    public function hmac(string $key, string $message): string { return hash_hmac('sha256', $message, $key); }
    public function verifyHmac(string $key, string $message, string $expected): bool {
        return hash_equals($this->hmac($key, $message), $expected);
    }

    private function getActiveKey(): string { /* read from KMS or filesystem */ }
    private function getKeyById(string $keyId): string { /* read by id */ }
}
```

### 8.3 Cross-Plan note (Plan 02-03 contract gap)

Plan 02-03's `CryptoProviderInterface::encrypt(string $plaintext): string` returns a single string. FIPS requires **key rotation**: ciphertext must encode which key encrypted it so decrypt can pick the right key. The current single-string return supports this (we encode keyId in the payload), but the interface doesn't make this explicit.

**Action:** Plan 02-03 needs a doc update (not an interface change) clarifying that `encrypt()` may embed metadata in its output, and that `decrypt()` must handle ciphertexts produced by past keys for backward compatibility. The existing `LaravelNativeCryptoProvider` already does this via Laravel's `Crypt` facade (which encodes a key id). The contract documentation needs to reflect this requirement explicitly so EE FIPS implementation is on solid ground.

See *Cross-Plan Revision Notes*.

### 8.4 Tests + PR

`feat(ee-crypto): FipsCryptoProvider with PBKDF2 + AES-256-GCM + key rotation`

---

## Task 9: SignedAuditSink (consumes Plan 02-04)

### 9.1 Architecture

Every audit event:
1. Computes `event_hash = HMAC-SHA-256(signing_key, canonical(event) || prev_event_hash)`
2. Persists `(event, prev_event_hash, event_hash)` to a queued job
3. Job ships JSONL to S3 / Azure Blob with **Object Lock / immutability** enabled
4. The most-recent `event_hash` per tenant is retained in `app.audit_chain_state`

This produces a tamper-evident hash chain. Anyone with the signing key can verify the chain end-to-end.

### 9.2 Cross-Plan note (Plan 02-04 contract gap)

Plan 02-04 defines `prev_event_hash` and `event_hash` columns but **does not specify a canonical-form serialization**. Two implementations could compute different hashes for "the same" event, breaking interoperability and audit verification.

**Action:** Plan 02-04 needs a revision adding a canonical-form spec — most simply, JSON Canonical Form (RFC 8785). The `AuditEvent::toArray()` method should convert to canonical JSON via `json_encode($arr, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)` with **deterministic key ordering**.

See *Cross-Plan Revision Notes*.

### 9.3 SignedAuditSink implementation sketch

```php
// enterprise/backend/src/Audit/SignedAuditSink.php
class SignedAuditSink implements AuditSinkInterface
{
    public function name(): string { return 'signed'; }
    public function isAvailable(): bool { return env('AUDIT_SIGNING_KEY_PATH') && env('AUDIT_S3_BUCKET'); }
    public function isSynchronous(): bool { return false; }   // queued

    public function write(AuditEvent $event): bool {
        $prevHash = AuditChainState::lockAndGetPrevHash($event->tenantId);
        $canonical = $this->canonicalize($event);
        $eventHash = $this->crypto->hmac($this->signingKey, $canonical . $prevHash);

        $signed = [
            'event' => $event->toArray(),
            'prev_event_hash' => $prevHash,
            'event_hash' => $eventHash,
            'signed_at' => now()->toIso8601String(),
        ];

        // Update chain state in DB
        AuditChainState::advance($event->tenantId, $eventHash);

        // Queue the WORM ship
        ShipSignedAuditEventJob::dispatch($signed)->onQueue('audit-worm');

        return true;
    }

    private function canonicalize(AuditEvent $event): string {
        return $event->canonicalJson();   // calls into Plan 02-04 revision
    }
}
```

### 9.4 ShipSignedAuditEventJob

A queued job that PUTs the JSONL line to S3/Azure Blob with `x-amz-object-lock-mode: COMPLIANCE` (S3) or `x-ms-immutability-policy-mode: locked` (Azure).

### 9.5 PR

`feat(ee-audit): SignedAuditSink with HMAC chain + WORM shipping`

---

## Task 10: Observability shippers (consumes Plan 02-05)

Three shippers, all under `enterprise/backend/src/Observability/Shippers/`:

### 10.1 DatadogShipper

POST logs to `https://http-intake.logs.datadoghq.com/api/v2/logs`, metrics to `https://api.datadoghq.com/api/v1/series`, traces via OTel HTTP forwarder. Use the existing `obs()->log()/metric()/span()` API; DatadogShipper transforms the values into Datadog-formatted payloads.

### 10.2 SplunkShipper

POST to Splunk HEC (`https://<host>:8088/services/collector`).

### 10.3 OtelShipper

Standard OTLP/HTTP to `https://<otel-collector-host>/v1/{logs,metrics,traces}`.

### 10.4 PR

One PR per shipper: `feat(ee-observability): {datadog|splunk|otel} shipper`

---

## Task 11: Parthenon Operator skeleton

Skeleton only — full operator logic is v1.2.

### 11.1 CRDs

Three CRDs at `enterprise/operator/crds/`:

```yaml
# enterprise/operator/crds/sources.parthenon.acumenus.net.yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: sources.parthenon.acumenus.net
spec:
  group: parthenon.acumenus.net
  versions:
    - name: v1alpha1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                connectionString: { type: string }
                cdmVersion: { type: string, enum: ["5.3", "5.4"] }
                vocabularyDaimon: { type: string }
                clinicalDaimon: { type: string }
                resultsDaimon: { type: string }
            status:
              type: object
              properties:
                phase: { type: string, enum: ["Pending", "Validating", "Ready", "Failed"] }
                achillesLastRun: { type: string }
                dqdLastRun: { type: string }
  scope: Namespaced
  names:
    plural: sources
    singular: source
    kind: ParthenonSource
    shortNames: [psrc]
```

Similar for `cohorts.parthenon.acumenus.net.yaml` and `analyses.parthenon.acumenus.net.yaml`.

### 11.2 Reconciler stubs (Go, kubebuilder layout)

```go
// enterprise/operator/cmd/operator/main.go
func main() {
    // kubebuilder boilerplate; SourcesReconciler::Reconcile is a no-op stub.
}
```

The skeleton compiles, deploys, and watches CRDs but doesn't actually do anything yet. Customers see "operator installed" but `kubectl get sources` returns empty — that's expected at this milestone.

### 11.3 Helm chart for operator

`enterprise/k8s/helm/parthenon-operator/` with Chart.yaml, values.yaml, templates/ for Deployment + RBAC + CRDs.

### 11.4 PR

`feat(ee-operator): Parthenon Operator skeleton (CRDs + reconciler stubs)`

Note: The full reconciler logic is deferred to v1.2. This PR proves the build pipeline + Helm packaging work; customers get an operator that does nothing yet but is upgradable when v1.2 ships.

---

## Task 12: EE installer phases (consumes Plan 02-07)

Per Plan 02-07's entry-point discovery, EE phases register via `pyproject.toml`:

```toml
# enterprise/installer/pyproject.toml (or whatever EE Python packaging looks like)
[project.entry-points."parthenon.acropolis.phases"]
fips_bootstrap = "enterprise.installer.phases.fips:FipsBootstrapPhase"
multi_tenant_init = "enterprise.installer.phases.multi_tenant:MultiTenantInitPhase"
keycloak_setup = "enterprise.installer.phases.keycloak:KeycloakSetupPhase"
license_validate = "enterprise.installer.phases.license:LicenseValidatePhase"
signed_audit_setup = "enterprise.installer.phases.signed_audit:SignedAuditSetupPhase"
```

Each phase under `enterprise/installer/phases/<name>.py`:

```python
# enterprise/installer/phases/keycloak.py
from acropolis.installer.phases.base import Phase, PhaseResult


class KeycloakSetupPhase(Phase):
    id = "enterprise.keycloak_setup"
    order = 350    # after community.network (300), before community.deploy (400)
    requires_enterprise = True
    depends_on = ["community.network"]

    def run(self, config) -> PhaseResult:
        # 1. Read or generate Keycloak admin credentials
        # 2. Render keycloak realm.json template with Parthenon client config
        # 3. Mount realm.json into the keycloak container
        # 4. Wait for Keycloak readiness
        # 5. Create initial Acumenus admin user
        return PhaseResult(self.id, success=True, message="Keycloak realm configured")
```

### 12.1 PR

`feat(ee-installer): EE installer phases registered via entry points`

---

## Task 13: Bookkeeping in CE — README/ROADMAP updates

Open a paired CE PR:

```bash
cd /home/smudoshi/Github/Parthenon
git checkout main && git pull
git checkout -b chore/ee-availability-callout

# README.md — extend the existing "License" section (added in Plan 01) with:
#   "Enterprise Edition is now available — see github.com/Acumenus-Data-Sciences/Parthenon-EE
#   (private; contact licensing@acumenus.net for access)."

# ROADMAP.md — extend the "Editions" callout added in Plan 01 with v1.2 dates and the
# fact that EE Phase 4 has shipped.

git commit -am "docs: announce EE availability + v1.2 ROADMAP entry"
gh pr create --title "docs: announce EE availability + v1.2 ROADMAP entry"
```

---

## Task 14: End-to-end customer install demo

This is the **investor-grade demo** for Plan 04 closure.

### 14.1 Set up a clean test VM

A fresh Ubuntu 24.04 VM with Docker installed. No prior Parthenon state.

### 14.2 Customer install flow

```bash
# Step 1: customer obtains GHCR PAT (issued by Acumenus customer ops)
echo "$CUSTOMER_GHCR_PAT" | docker login ghcr.io -u <customer-org> --password-stdin

# Step 2: customer obtains license JWT (issued by Acumenus license server)
export LICENSE_TOKEN="eyJ..."

# Step 3: clone Parthenon-EE (customer has read access)
git clone git@github.com:Acumenus-Data-Sciences/Parthenon-EE.git
cd Parthenon-EE

# Step 4: run the EE installer
LICENSE_TOKEN="$LICENSE_TOKEN" python3 enterprise/installer/main.py --tier=enterprise

# Expected:
# - All CE phases run (preflight, network, deploy, traefik, verify)
# - All EE phases run (license_validate, fips_bootstrap, keycloak_setup, multi_tenant_init, signed_audit_setup)
# - Final verification: GET /api/v1/system/feature-flags returns
#   tenancy.multi=true, auth.keycloak=true, auth.saml=true, audit.signed=true,
#   crypto.fips=true, observability.datadog/splunk/otel based on customer config
```

### 14.3 Demo script for investors

```bash
# 1. Show CE running (open browser at https://<ce-host>) — full research platform
# 2. Show EE running (open browser at https://<ee-host>):
#    - Same UI
#    - Click "Admin" → Multi-tenant switcher visible (gated by EnterpriseGate)
#    - Click "SSO" → Keycloak login flow (EE)
#    - Click "Audit log" → cryptographically-signed entries with chain validation button
#    - Click "Tenants" → create a second tenant; show data isolation
# 3. kubectl get sources/cohorts/analyses (operator skeleton — no data yet, but CRDs exist)
# 4. Show Datadog dashboard with live metrics from EE deployment
```

---

## Cross-Plan Revision Notes

The following revisions to Plans 02-01..02-08 surfaced while drafting Plan 04. Each is small, backward-compatible, and should be folded into the corresponding Plan 02 sub-plan **before** Phase 2 execution.

### Revision R1: Plan 02-01 — `AuthDriverResult` needs `mfaAuthenticated` field

**Why:** SAML and Keycloak MFA step-up flows need to communicate "this auth event included a second factor" to downstream RBAC. Without it, EE customers can't enforce step-up for sensitive operations.

**Change:** Add to the `AuthDriverResult` constructor:
```php
public bool $mfaAuthenticated = false,
```

**Compatibility:** Default value preserves CE behavior (`local` and `authentik-oidc` drivers don't currently signal MFA, and the field defaults to `false`).

### Revision R2: Plan 02-02 — `TenantResolverInterface` needs `snapshot()` / `restore()` for queued jobs

**Why:** Laravel queued jobs serialize the payload and restore on dequeue. Tenant context must survive that boundary, but the current `TenantResolverInterface` is request-only.

**Change:** Add to the interface:
```php
public function snapshot(): array;
public function restore(array $snap): void;
```

`SingleTenantResolver`'s implementation is `[]` / no-op (always Tenant#1). EE's `MultiTenantResolver` serializes `['slug' => $tenant->slug]` and resolves by slug on restore.

**Compatibility:** Both methods are new; CE behavior unchanged.

### Revision R3: Plan 02-03 — `CryptoProviderInterface` documentation needs key-rotation guidance

**Why:** FIPS providers must support key rotation. Ciphertexts produced by past keys must remain decryptable by future provider instances.

**Change:** Update the `encrypt()` / `decrypt()` docblocks in `CryptoProviderInterface`:
```
* @return string Ciphertext encoding (base64). Implementations MAY embed
*   metadata (key id, algorithm version) inside this string. The format
*   is provider-specific; only the same implementation that produced a
*   ciphertext is required to decrypt it.
*
* `decrypt()` MUST handle ciphertexts produced by past key rotations
* of the same provider, falling back to historical keys as needed.
```

**Compatibility:** Doc-only change; no signature break. `LaravelNativeCryptoProvider` already meets this requirement via Laravel's `Crypt` facade.

### Revision R4: Plan 02-04 — `AuditEvent` needs `canonicalJson()` for signed-chain interop

**Why:** SignedAuditSink computes `event_hash = HMAC(canonical(event) || prev_event_hash)`. Two implementations must compute identical canonical forms to verify the chain. Current `toArray()` doesn't guarantee deterministic JSON output.

**Change:** Add to `AuditEvent`:
```php
public function canonicalJson(): string {
    $arr = $this->toArray();
    ksort($arr);   // deterministic key order
    foreach ($arr as &$v) if (is_array($v)) ksort($v);
    return json_encode($arr, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}
```

Reference the JSON Canonical Form spec (RFC 8785) in the `AuditSinkInterface` docs.

**Compatibility:** New method; `toArray()` unchanged.

### Revision R5: Plan 02-05 — `ObservabilityShipper` `recordMetric` should accept aggregation type and unit

**Why:** Datadog/Prometheus distinguish counters vs. gauges vs. histograms; OTel additionally needs unit hints (`bytes`, `seconds`, `1` for unitless). The current `MetricEvent('counter', ...)` covers type, but unit is missing.

**Change:** Add to `MetricEvent`:
```php
public string $unit = '',
```

**Compatibility:** Default empty; no behavior change for shippers that don't use unit.

### Revision R6: Plan 02-06 — `FlagName` union should not include arbitrary `string` fallback

**Why:** TypeScript type safety. Today the type is `'auth.saml' | 'auth.scim' | ... | string`, which collapses to `string` and disables IDE autocomplete. EE ships its own `FlagName` extension that uses TypeScript's interface-merging or a union extension instead.

**Change:** Drop `| string` fallback. Document the EE-side convention for adding flag names via interface merging:

```ts
// In EE's enterprise/frontend/src/types/featureFlags.d.ts
declare module '@acumenus-data-sciences/parthenon-frontend/types/featureFlags' {
  type AdditionalEnterpriseFlags = 'auth.keycloak' | 'auth.saml-step-up' | ...;
  // (TS module augmentation pattern)
}
```

**Compatibility:** Strictly speaking this can break consumers using arbitrary strings. Add a deprecation warning in CE's docs first.

### Revision R7: Plan 02-07 — Phase Result should support partial-success state

**Why:** Some EE phases (signed_audit_setup, datadog integration) may succeed in primary action but fail an optional verification (e.g. test event ship). Currently `PhaseResult` has only `success: bool`. Customers need to distinguish "fully succeeded" from "succeeded with non-fatal warnings".

**Change:** Add to `PhaseResult`:
```python
warnings: list[str] = []   # non-fatal issues; phase still considered successful
```

**Compatibility:** New field with default empty list; CE phases unchanged.

### Revision R8: Plan 02-08 — Compose contract should explicitly cover `extra_hosts`

**Why:** EE Keycloak typically needs `extra_hosts: { "host.docker.internal:host-gateway" }` for IdP federation testing. The current contract doesn't address whether EE may add extra_hosts on stable services.

**Change:** Add a 10th rule:
> **10. `extra_hosts` is additive.** EE may add entries to a stable service's `extra_hosts:` block. EE MUST NOT remove or override CE-added hosts.

---

## Plan 04 completion checklist

### Track A — migrations CE→EE
- [ ] Acropolis enterprise compose moved + paired CE deprecation merged
- [ ] n8n / Superset / DataHub / (Wazuh) configs moved
- [ ] K8s / Helm charts moved
- [ ] Enterprise installer phases moved
- [ ] Enterprise docs moved

### Track B — drivers
- [ ] License module live; EnterpriseServiceProvider gates everything
- [ ] KeycloakAuthDriver registered when `auth.keycloak` entitled
- [ ] SamlAuthDriver registered when `auth.saml` entitled
- [ ] SCIM 2.0 endpoints live when `auth.scim` entitled
- [ ] MultiTenantResolver bound when `tenancy.multi` entitled
- [ ] FipsCryptoProvider bound when `crypto.fips` entitled
- [ ] SignedAuditSink registered when `audit.signed` entitled
- [ ] DatadogShipper, SplunkShipper, OtelShipper registered per entitlement

### Track C — net-new
- [ ] Parthenon Operator skeleton CRDs + reconciler stubs deploy clean via Helm
- [ ] EE installer phases discoverable via entry points; run cleanly in tier=enterprise

### Bookkeeping
- [ ] CE README + ROADMAP updated with EE availability callout
- [ ] CHANGELOG-EE.md updated with vEE-1.0.0 release notes
- [ ] vEE-1.0.0 tagged + signed images published
- [ ] End-to-end customer install demo scripted and rehearsed

### Cross-Plan Revisions
- [ ] R1-R8 folded back into Plans 02-01..02-08 BEFORE Phase 2 execution begins

---

## Phase 4 exit criteria (from spec)

When Plan 04 is complete:

- EE first-pass migration done: enterprise infra, SAML/SCIM/Keycloak drivers, multi-tenancy, FIPS, signed audit, observability shippers all functional in EE.
- Investor demo path: spin up CE on a workstation; spin up EE on a customer-grade environment; show same UI, more capabilities (multi-tenant switcher, SAML login, FIPS mode, Datadog dashboards).
- CE behavior unchanged.
- Existing `parthenon.acumenus.net` production deployment unchanged.

---

## What's beyond Plan 04

- Plan 05 (v2.5 packages migration) — when EE engineer count >5 OR EE customer SLA requires faster cadence than CE OR fully separable operator install path needed
- Full Parthenon Operator (v1.2 — moves beyond skeleton)
- Acumenus-hosted managed Abby AI (post-Hyperscaler-Terraforms)
- Telemetry phone-home implementation
- HSM integration for crypto provider
- Per-tenant Solr cores + per-tenant storage path scoping
- Audit log search/export UI in EE
- Real-time audit streaming to SIEM (overlap with Plan 02-05 + EE shippers)

*End of Plan 04.*
