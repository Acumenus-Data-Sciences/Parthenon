# Parthenon CE Extension Points

Parthenon Community Edition exposes 8 extension-point seams that allow drop-in alternative implementations without patching CE source. The extension points are designed for two consumers:

1. **Parthenon Enterprise Edition** — proprietary drivers in the `enterprise/` overlay (Keycloak, SAML, multi-tenant resolver, FIPS crypto, signed audit, observability shippers, etc.).
2. **Community contributors** — anyone running their own niche driver for a specific deployment (e.g., a research consortium with custom audit retention rules).

Each extension point ships with:

- A documented interface in `backend/app/Contracts/` (PHP) or appropriate per-language location.
- A default CE implementation that preserves CE behavior byte-for-byte.
- Tests that prove pluggability via at least one alternate driver.

## The 8 extension points

| # | Extension point | Interface | Detail page |
|---|---|---|---|
| 1 | Auth driver | `App\Contracts\AuthDriverInterface` | [auth-driver.md](extension-points/auth-driver.md) |
| 2 | Tenant resolver | `App\Contracts\TenantResolverInterface` | [tenant-resolver.md](extension-points/tenant-resolver.md) |
| 3 | Crypto provider | `App\Contracts\CryptoProviderInterface` | [crypto-provider.md](extension-points/crypto-provider.md) |
| 4 | Audit sink | `App\Contracts\AuditSinkInterface` | [audit-sink.md](extension-points/audit-sink.md) |
| 5 | Observability shipper | `App\Contracts\ObservabilityShipperInterface` | [observability-shipper.md](extension-points/observability-shipper.md) |
| 6 | Frontend feature flags + EnterpriseGate | `frontend/src/contracts/featureFlags.ts` | (Plan 02-06) |
| 7 | Acropolis installer phase registry | `acropolis/installer/phases/Phase` (Python) | (Plan 02-07) |
| 8 | Compose composition contract | `docker-compose.yml` override conventions | (Plan 02-08) |

## How to add a custom driver (community)

1. Implement the relevant interface in your fork or sidecar package.
2. Register the driver in your project's service provider (or via `register()` calls in a custom service provider).
3. Configure the active driver via `config/<feature>-drivers.php` or the corresponding mechanism for that extension point.

See each extension point's detail page for examples.

## How EE adds drivers

EE registers additional drivers from its own `EnterpriseServiceProvider` in `enterprise/backend/src/`. EE never patches CE files — it appends to the registries via runtime registration calls. This is the contract that keeps the CE/EE boundary auditable in code review.
