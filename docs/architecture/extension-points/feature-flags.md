---
doc_type: spec
status: historical
date: 2026-05-09
owner: acumenus
module: extension-points
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - frontend/src/contracts/featureFlags.ts
related_prs: []
---
# Extension Point: Feature Flags + EnterpriseGate

**Backend resolver:** `App\FeatureFlags\FeatureFlagResolver`
**Backend value object:** `App\FeatureFlags\FeatureFlag`
**Backend controller:** `App\Http\Controllers\Api\V1\System\FeatureFlagsController` (GET `/api/v1/system/feature-flags`)
**Backend service provider:** `App\Providers\FeatureFlagsServiceProvider`
**Backend config:** `backend/config/feature-flags.php`
**Frontend store:** `frontend/src/stores/featureFlagsStore.ts` (Zustand)
**Frontend hook:** `useFlag(name)` — typed boolean
**Frontend gate component:** `frontend/src/components/EnterpriseGate.tsx`
**Frontend extension contract:** `frontend/src/contracts/featureFlags.ts`
**Status:** Live since [Phase 2 #6](../../superpowers/plans/2026-05-09-ce-ee-fork-plan-02-06-feature-flags-enterprise-gate.md)

## Purpose

Decouple deployment-level capability discovery (what features exist on this install) from per-user RBAC (what this user can do). Server-driven flags let CE ship a closed UI that EE bundles can light up by:

1. Registering an EE driver (auth, audit, observability, etc.) — its presence flips a flag automatically.
2. Publishing additional entries through `config/feature-flags.php`.
3. Augmenting the `FlagNameRegistry` TypeScript interface in `enterprise/frontend/` to extend the union — typed `useFlag('foo')` calls then accept the new EE flag names without CE compile errors.

CE deployments get an effectively-empty flag set — every `<EnterpriseGate>` either renders nothing or shows a "see what you're missing" locked card with the Enterprise badge.

## Architecture

```
┌──────── Backend ────────┐         ┌──────── Frontend ────────┐
│ FeatureFlagResolver     │  GET    │  useFeatureFlagsQuery    │
│  ├── config/...flags    │ ──────▶ │  ↓ hydrates              │
│  ├── AuthDriverRegistry │         │  useFeatureFlagsStore    │
│  └── tenancy.resolver   │         │  ├── useFlag(name)       │
└─────────────────────────┘         │  └── <EnterpriseGate>    │
                                    └──────────────────────────┘
```

Flags reflect **deployment posture**, not per-user permissions. The endpoint is intentionally unauthenticated — every CE deployment ships an effectively-empty flag set and the response only describes capability presence (no PHI, no user data).

## Backend contract

### `FeatureFlag` value object

```php
final readonly class FeatureFlag
{
    public function __construct(
        public string $name,                // e.g. 'auth.saml', 'tenancy.multi'
        public bool $enabled,               // is this capability live on this deployment?
        public string $source,              // 'ce' | 'ee' | 'config' | 'license'
        public ?string $description = null, // human hint for admin UIs
    ) {}
}
```

### `FeatureFlagResolver`

The resolver composes flags from three sources, in this order:

1. **`config('feature-flags.flags')`** — explicit per-deployment overrides. CE ships an empty array; EE-published config or runtime overrides populate it.
2. **`AuthDriverRegistry`** — every driver whose name is *not* in `['local', 'authentik-oidc']` (CE baseline) becomes an `auth.<driver>` flag with `enabled=true, source='ee'`.
3. **`tenancy.resolver`** — emits `tenancy.multi` reflecting whether the configured TenantResolver is `SingleTenantResolver` (`enabled=false, source='ce'`) or anything else (`enabled=true, source='ee'`).

### How EE adds flags without patching CE

```php
// enterprise/backend/src/Providers/EnterpriseFeatureFlagsProvider.php
class EnterpriseFeatureFlagsProvider extends ServiceProvider
{
    public function register(): void
    {
        // Option A: append to config (best for static EE flags).
        $this->mergeConfigFrom(__DIR__.'/../../config/feature-flags.ee.php', 'feature-flags');
    }

    public function boot(): void
    {
        // Option B: re-bind the resolver to layer on dynamic EE logic.
        $this->app->extend(FeatureFlagResolver::class, function ($base, $app) {
            return new EnterpriseFeatureFlagResolver($base, $app->make(LicenseService::class));
        });
    }
}
```

CE's `FeatureFlagResolver` keeps emitting its own flags; EE's resolver wraps it.

### Endpoint

```
GET /api/v1/system/feature-flags

200 OK
{
  "data": [
    { "name": "tenancy.multi", "enabled": false, "source": "ce", "description": "Multi-tenant request routing." }
  ]
}
```

No auth required (deployment posture is public). The response is small (typically <2 KB) and deployment-stable — TanStack Query caches it for 5 minutes.

## Frontend contract

### Typed `FlagName` union (R6)

`frontend/src/types/featureFlags.ts` exposes a **closed** `FlagNameRegistry` interface. `useFlag('typo')` is a compile error and IDE autocomplete works:

```ts
export interface FlagNameRegistry {
  "auth.saml": true;
  "auth.scim": true;
  // ...
}
export type FlagName = keyof FlagNameRegistry;
```

EE extends the registry through TypeScript module augmentation:

```ts
// enterprise/frontend/src/types/featureFlags.d.ts
declare module "@/types/featureFlags" {
  interface FlagNameRegistry {
    "auth.keycloak-step-up": true;
    "auth.saml-step-up": true;
  }
}
```

After `tsc` merges the augmentation, EE consumers see the extended union. CE callers see only the closed CE union.

### Zustand store + hooks

```ts
import { useFlag, useFeatureFlag } from "@/stores/featureFlagsStore";

const samlEnabled = useFlag("auth.saml");           // boolean
const samlFlag = useFeatureFlag("auth.saml");       // FeatureFlag | undefined (when admin UI needs description/source)
```

The store hydrates on app mount via `<FlagsLoader />` (rendered inside `QueryClientProvider`, before `<RouterProvider>`). Subsequent renders are reactive — flipping a flag at runtime causes every gated subtree to re-render.

### `<EnterpriseGate>` modes

```tsx
// hide entirely (default)
<EnterpriseGate flag="auth.saml">
  <SamlConfigForm />
</EnterpriseGate>

// fall back to a marketing CTA
<EnterpriseGate flag="auth.saml" fallback={<UpgradeBanner />}>
  <SamlConfigForm />
</EnterpriseGate>

// "see what you're missing" — render dimmed + badged, non-interactive
<EnterpriseGate flag="auth.saml" showAsLocked>
  <SamlConfigForm />
</EnterpriseGate>
```

Locked mode is the recommended pattern for surfaces that exist conceptually in CE marketing material but only function in EE — admin pages for SAML/Keycloak/multi-tenant.

## Pluggability proof

The Plan 02-06 test suite exercises four pluggability behaviors:

1. **Config-driven flags surface** in the resolver and the endpoint.
2. **EE auth drivers** registered in `AuthDriverRegistry` become flags automatically (`auth.saml` → `enabled=true, source='ee'`).
3. **MultiTenantResolver** swap (via `config('tenancy.resolver')`) flips `tenancy.multi` to `enabled=true, source='ee'`.
4. **EnterpriseGate live re-render** when the store mutates — proves runtime EE registration paths take effect without a page reload.

CE callers never have to change. EE plugs in via service provider + module augmentation.

## Out of scope

- **Per-user feature flag overrides** (admin tooling that whitelists a single account into a flag) — separate plan.
- **Real-time flag updates over WebSocket / Reverb** — separate plan.
- **A/B testing rollouts** — Parthenon isn't a SaaS-style product; flags are deployment-scoped, not user-scoped.
- **Marketing pages explaining each flag** — handled in `docs/site/`.

## Anti-patterns

- ❌ Don't gate role-based actions on feature flags. RBAC stays in Spatie permissions; flags describe capability presence only.
- ❌ Don't fetch the flags endpoint inside hot paths. It's hydrated once on mount and cached for 5 minutes.
- ❌ Don't fall back to `| string` on `FlagName` (R6) — that defeats compile-time discovery of typos.
- ❌ Don't ship secret/PII data in `description` — the endpoint is unauthenticated by design.
