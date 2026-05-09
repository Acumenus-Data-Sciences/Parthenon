# CE/EE Fork — Plan 02-06: Frontend featureFlags + EnterpriseGate

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. See [Plan 02-01](2026-05-08-ce-ee-fork-plan-02-01-auth-driver.md) for the canonical TDD pattern.

**Goal:** Add a `featureFlags` Zustand store (frontend) backed by a `/api/v1/system/feature-flags` backend endpoint (CE), plus a `<EnterpriseGate>` React component that hides EE-only UI surfaces when the flag is off. CE has zero EE flags by default — every gate renders nothing extra. EE config flips flags on, revealing admin panels, multi-tenant switcher, SAML/SCIM UI, etc.

**Architecture:** Server-driven flags. Backend computes the flag set from license + active drivers + EE service-provider registrations (when EE is installed). Frontend fetches once on app mount, stores in Zustand, exposes typed `useFlag('foo')` hook + `<EnterpriseGate flag="foo">` component. Refetched on auth context change. CE flag set is empty (no EE features = no flags = no gates render).

**Tech Stack:** React 19 strict, TypeScript strict, Zustand 5, TanStack Query 5, Pest 3 (backend), Vitest + RTL (frontend).

**Spec reference:** Spec §5 row 6.

**Umbrella:** [Plan 02 umbrella](2026-05-08-ce-ee-fork-plan-02-extension-points-umbrella.md).

**Prerequisites:** Plan 01 merged. Recommended that at least one backend extension point (Plan 02-01..02-04) is merged so EnterpriseGate has at least one flag to demonstrate. Plan 02-02 (TenantResolver) is a particularly good companion because the multi-tenant switcher UI lives behind a flag.

---

## File structure

**Backend:**

| Path | Purpose | LOC |
|---|---|---|
| `backend/app/Http/Controllers/Api/V1/System/FeatureFlagsController.php` | GET `/api/v1/system/feature-flags` | ~80 |
| `backend/app/FeatureFlags/FeatureFlagResolver.php` | Composes flag set from drivers + license + EE provider | ~100 |
| `backend/app/FeatureFlags/FeatureFlag.php` | Value object: name, enabled, source | ~50 |
| `backend/app/Providers/FeatureFlagsServiceProvider.php` | Binds resolver | ~30 |
| `backend/config/feature-flags.php` | Built-in CE flag definitions (initially empty for EE flags) | ~50 |
| `backend/routes/api.php` | Add the route | ~5 |
| `backend/tests/Feature/Api/V1/FeatureFlagsControllerTest.php` | Endpoint tests | ~120 |
| `backend/tests/Feature/FeatureFlags/FeatureFlagResolverTest.php` | Resolver tests | ~100 |

**Frontend:**

| Path | Purpose | LOC |
|---|---|---|
| `frontend/src/stores/featureFlagsStore.ts` | Zustand store + types | ~80 |
| `frontend/src/features/system/api.ts` | TanStack Query hook for the endpoint | ~40 |
| `frontend/src/components/EnterpriseGate.tsx` | The gate component | ~80 |
| `frontend/src/components/EnterpriseBadge.tsx` | "Enterprise Edition" badge for gated surfaces | ~50 |
| `frontend/src/types/featureFlags.ts` | Flag-name unions + typed flag map | ~60 |
| `frontend/src/contracts/featureFlags.ts` | Public extension contract (typed shape EE consumers extend) | ~70 |
| `frontend/src/__tests__/EnterpriseGate.test.tsx` | RTL tests | ~150 |
| `frontend/src/stores/__tests__/featureFlagsStore.test.ts` | Store tests | ~80 |

**Modified files:**
- `frontend/src/App.tsx` (or `main.tsx`) — fetch flags on app mount
- `backend/bootstrap/providers.php` — register `FeatureFlagsServiceProvider`
- `docs/architecture/extension-points.md` — mark row 6 done

---

## Task 1: Backend resolver + endpoint

- [ ] **Step 1.1: FeatureFlag value object**

```php
<?php
namespace App\FeatureFlags;

final readonly class FeatureFlag
{
    public function __construct(
        public string $name,                  // e.g. 'auth.saml', 'tenancy.multi'
        public bool $enabled,
        public string $source,                // 'ce'|'ee'|'config'|'license'
        public ?string $description = null,
    ) {}

    public function toArray(): array {
        return ['name' => $this->name, 'enabled' => $this->enabled, 'source' => $this->source, 'description' => $this->description];
    }
}
```

- [ ] **Step 1.2: FeatureFlagResolver**

```php
<?php
namespace App\FeatureFlags;

use App\Auth\AuthDriverRegistry;
use App\Contracts\TenantResolverInterface;

class FeatureFlagResolver
{
    public function __construct(
        private readonly ?AuthDriverRegistry $authDrivers = null,
        private readonly ?TenantResolverInterface $tenants = null,
    ) {}

    /** @return array<int, FeatureFlag> */
    public function resolve(): array {
        $flags = [];

        // CE flags driven by configured drivers — EE injects more by registering its
        // own resolver via the container or by appending to config('feature-flags.flags').
        $configured = config('feature-flags.flags', []);
        foreach ($configured as $name => $spec) {
            $flags[] = new FeatureFlag(
                name: $name,
                enabled: (bool) ($spec['enabled'] ?? false),
                source: (string) ($spec['source'] ?? 'config'),
                description: $spec['description'] ?? null,
            );
        }

        // Auth drivers contribute flags for any non-default driver that is available.
        if ($this->authDrivers !== null) {
            foreach ($this->authDrivers->availableNames() as $driverName) {
                if (in_array($driverName, ['local', 'authentik-oidc'], true)) continue;
                $flags[] = new FeatureFlag(
                    name: "auth.{$driverName}",
                    enabled: true,
                    source: 'ee',
                    description: "Auth driver '{$driverName}' is registered.",
                );
            }
        }

        // Tenancy contributes a flag if multi-tenant resolver is in use.
        if ($this->tenants !== null) {
            $resolverClass = config('tenancy.resolver');
            $isMulti = $resolverClass !== \App\Tenancy\SingleTenantResolver::class;
            $flags[] = new FeatureFlag(
                name: 'tenancy.multi',
                enabled: $isMulti,
                source: $isMulti ? 'ee' : 'ce',
                description: 'Multi-tenant request routing.',
            );
        }

        return $flags;
    }
}
```

- [ ] **Step 1.3: Controller**

```php
<?php
namespace App\Http\Controllers\Api\V1\System;

use App\FeatureFlags\FeatureFlagResolver;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * @group System
 */
class FeatureFlagsController extends Controller
{
    /**
     * GET /api/v1/system/feature-flags
     *
     * Returns the active feature flags for the current request. Flags
     * are computed from registered drivers, configured flags, and the
     * EE license (if installed). CE deployments return an empty (or
     * minimal) flag set.
     */
    public function index(FeatureFlagResolver $resolver): JsonResponse {
        $flags = array_map(fn($f) => $f->toArray(), $resolver->resolve());
        return response()->json(['data' => $flags]);
    }
}
```

- [ ] **Step 1.4: Route**

```php
// backend/routes/api.php — under the v1 group, no auth required (flags are per-deployment, not per-user)
Route::get('/system/feature-flags', [FeatureFlagsController::class, 'index']);
```

Note: this endpoint is intentionally unauthenticated. Flags reflect deployment posture, not per-user permissions. They expose no PHI and only describe capability presence. RBAC for actions remains separate.

- [ ] **Step 1.5: Test**

```php
<?php
it('returns an empty or minimal flag list on a fresh CE install', function () {
    $res = $this->getJson('/api/v1/system/feature-flags');
    $res->assertOk();
    $names = collect($res->json('data'))->pluck('name')->all();
    expect($names)->not->toContain('auth.saml')
        ->and($names)->not->toContain('auth.keycloak');
});

it('includes tenancy.multi=false on CE single-tenant deployment', function () {
    $res = $this->getJson('/api/v1/system/feature-flags');
    $tenancyFlag = collect($res->json('data'))->firstWhere('name', 'tenancy.multi');
    expect($tenancyFlag['enabled'])->toBeFalse()
        ->and($tenancyFlag['source'])->toBe('ce');
});

it('does not require authentication', function () {
    $this->getJson('/api/v1/system/feature-flags')->assertOk();
});

it('flips tenancy.multi=true when MultiTenantResolver is bound', function () {
    config(['tenancy.resolver' => 'Tests\\Stub\\StubMultiTenantResolver']);
    $res = $this->getJson('/api/v1/system/feature-flags');
    $tenancyFlag = collect($res->json('data'))->firstWhere('name', 'tenancy.multi');
    expect($tenancyFlag['enabled'])->toBeTrue()
        ->and($tenancyFlag['source'])->toBe('ee');
});
```

- [ ] **Step 1.6: Commit**

```bash
git commit -m "feat(feature-flags): backend resolver + GET /api/v1/system/feature-flags"
```

---

## Task 2: Frontend types + Zustand store + Query hook

- [ ] **Step 2.1: Types**

```ts
// frontend/src/types/featureFlags.ts
export type FlagName =
  | 'auth.saml'
  | 'auth.scim'
  | 'auth.keycloak'
  | 'tenancy.multi'
  | 'audit.signed'
  | 'observability.datadog'
  | 'observability.splunk'
  | 'crypto.fips'
  | string;  // EE may add more; keep widening fallback

export interface FeatureFlag {
  name: FlagName;
  enabled: boolean;
  source: 'ce' | 'ee' | 'config' | 'license';
  description: string | null;
}

export type FeatureFlagMap = Record<FlagName, FeatureFlag>;
```

- [ ] **Step 2.2: Zustand store**

```ts
// frontend/src/stores/featureFlagsStore.ts
import { create } from 'zustand';
import type { FeatureFlag, FeatureFlagMap, FlagName } from '../types/featureFlags';

interface FeatureFlagsState {
  flags: FeatureFlagMap;
  loaded: boolean;
  error: string | null;
  setFlags: (flags: FeatureFlag[]) => void;
  setError: (msg: string) => void;
  isEnabled: (name: FlagName) => boolean;
  reset: () => void;
}

export const useFeatureFlagsStore = create<FeatureFlagsState>((set, get) => ({
  flags: {},
  loaded: false,
  error: null,

  setFlags: (flags) =>
    set({
      flags: Object.fromEntries(flags.map((f) => [f.name, f])),
      loaded: true,
      error: null,
    }),

  setError: (msg) => set({ error: msg, loaded: false }),

  isEnabled: (name) => Boolean(get().flags[name]?.enabled),

  reset: () => set({ flags: {}, loaded: false, error: null }),
}));

/** Hook: typed `useFlag('auth.saml')` returns boolean. */
export function useFlag(name: FlagName): boolean {
  return useFeatureFlagsStore((s) => Boolean(s.flags[name]?.enabled));
}
```

- [ ] **Step 2.3: API hook**

```ts
// frontend/src/features/system/api.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import type { FeatureFlag } from '../../types/featureFlags';
import { useFeatureFlagsStore } from '../../stores/featureFlagsStore';

export function useFeatureFlagsQuery() {
  const setFlags = useFeatureFlagsStore((s) => s.setFlags);
  const setError = useFeatureFlagsStore((s) => s.setError);

  return useQuery({
    queryKey: ['system', 'feature-flags'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ data: FeatureFlag[] }>('/system/feature-flags');
        setFlags(res.data.data);
        return res.data.data;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load feature flags');
        throw e;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2.4: Mount the fetch in `App.tsx`**

```tsx
// frontend/src/App.tsx — add at the top of the authenticated layout
import { useFeatureFlagsQuery } from './features/system/api';

function FlagsLoader() {
  useFeatureFlagsQuery();
  return null;
}

// inside the App component tree, near the top of authenticated layout:
<FlagsLoader />
```

If you prefer a synchronous-load gate, render children only after `loaded === true`. CE has effectively-empty flags so the wait is sub-50ms; EE may add more.

---

## Task 3: EnterpriseGate component

```tsx
// frontend/src/components/EnterpriseGate.tsx
import type { ReactNode } from 'react';
import { useFlag } from '../stores/featureFlagsStore';
import type { FlagName } from '../types/featureFlags';

interface Props {
  flag: FlagName;
  children: ReactNode;
  fallback?: ReactNode;
  /** When true, render children but disabled and badged. Default false (hide entirely). */
  showAsLocked?: boolean;
}

/**
 * Conditionally render children based on a server-resolved feature flag.
 *
 * CE deployments: every flag is off, so EnterpriseGate renders nothing
 * unless `fallback` is provided.
 *
 * EE deployments: flags are flipped server-side; EnterpriseGate reveals
 * the children.
 *
 * `showAsLocked={true}` enables a "see what you're missing" mode for
 * marketing — children render with reduced opacity + Enterprise badge,
 * blocking interaction.
 */
export function EnterpriseGate({ flag, children, fallback = null, showAsLocked = false }: Props) {
  const enabled = useFlag(flag);
  if (enabled) return <>{children}</>;
  if (showAsLocked) {
    return (
      <div className="opacity-50 pointer-events-none relative" data-testid={`gate-locked-${flag}`}>
        <div className="absolute top-2 right-2 z-10 pointer-events-auto">
          <EnterpriseBadge />
        </div>
        {children}
      </div>
    );
  }
  return <>{fallback}</>;
}
```

```tsx
// frontend/src/components/EnterpriseBadge.tsx
export function EnterpriseBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30">
      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L2 4v4c0 4 3 6 6 7 3-1 6-3 6-7V4l-6-3z"/></svg>
      Enterprise
    </span>
  );
}
```

---

## Task 4: Tests

- [ ] **Store test**

```ts
// frontend/src/stores/__tests__/featureFlagsStore.test.ts
import { useFeatureFlagsStore } from '../featureFlagsStore';

describe('featureFlagsStore', () => {
  beforeEach(() => useFeatureFlagsStore.getState().reset());

  it('starts empty + unloaded', () => {
    expect(useFeatureFlagsStore.getState().loaded).toBe(false);
    expect(Object.keys(useFeatureFlagsStore.getState().flags)).toHaveLength(0);
  });

  it('isEnabled returns false for unset flags', () => {
    expect(useFeatureFlagsStore.getState().isEnabled('auth.saml')).toBe(false);
  });

  it('setFlags hydrates the map', () => {
    useFeatureFlagsStore.getState().setFlags([
      { name: 'auth.saml', enabled: true, source: 'ee', description: null },
    ]);
    const s = useFeatureFlagsStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.isEnabled('auth.saml')).toBe(true);
  });
});
```

- [ ] **EnterpriseGate test**

```tsx
// frontend/src/__tests__/EnterpriseGate.test.tsx
import { render, screen } from '@testing-library/react';
import { EnterpriseGate } from '../components/EnterpriseGate';
import { useFeatureFlagsStore } from '../stores/featureFlagsStore';

describe('EnterpriseGate', () => {
  beforeEach(() => useFeatureFlagsStore.getState().reset());

  it('hides children when the flag is off (CE default)', () => {
    render(<EnterpriseGate flag="auth.saml"><div>SAML config</div></EnterpriseGate>);
    expect(screen.queryByText('SAML config')).toBeNull();
  });

  it('renders children when the flag is on (EE)', () => {
    useFeatureFlagsStore.getState().setFlags([
      { name: 'auth.saml', enabled: true, source: 'ee', description: null },
    ]);
    render(<EnterpriseGate flag="auth.saml"><div>SAML config</div></EnterpriseGate>);
    expect(screen.getByText('SAML config')).toBeInTheDocument();
  });

  it('renders fallback when flag is off and fallback provided', () => {
    render(<EnterpriseGate flag="auth.saml" fallback={<div>Upgrade to EE</div>}><div>x</div></EnterpriseGate>);
    expect(screen.getByText('Upgrade to EE')).toBeInTheDocument();
  });

  it('renders locked-mode (children dimmed + badge) when showAsLocked=true', () => {
    render(<EnterpriseGate flag="auth.saml" showAsLocked><div data-testid="kid">SAML</div></EnterpriseGate>);
    expect(screen.getByTestId('gate-locked-auth.saml')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    expect(screen.getByTestId('kid')).toBeInTheDocument();
  });
});
```

---

## Task 5: Use the gate in at least one place (smoke test in real UI)

Pick a forthcoming admin page that EE will eventually enable. For Plan 02-06's smoke, add a placeholder in `frontend/src/features/administration/pages/AdministrationPage.tsx`:

```tsx
<EnterpriseGate flag="auth.saml" showAsLocked>
  <div className="rounded-md border border-border p-4">
    <h3 className="font-semibold">SAML Single Sign-On</h3>
    <p className="text-sm text-muted-foreground">
      Configure SAML 2.0 IdP integration for your organization.
    </p>
    <button className="mt-2 btn-primary" disabled>Configure (Enterprise)</button>
  </div>
</EnterpriseGate>
```

In CE, this renders a dimmed card with the Enterprise badge — marketing surface that signals the feature exists in EE.

---

## Task 6: Documentation + PR

- [ ] Doc page covers: server-driven flag model, CE empty default, how EE registers flags, the typed `useFlag()` hook, EnterpriseGate modes (hidden / fallback / locked).
- [ ] PR title: "feat(feature-flags): featureFlags store + EnterpriseGate (Phase 2 #6 of 8)"

---

## Plan 02-06 completion checklist

- [ ] Backend `GET /api/v1/system/feature-flags` returns CE flag list (mostly empty)
- [ ] Frontend store hydrates on mount; `useFlag(name)` typed hook works
- [ ] EnterpriseGate hides/shows/locks children correctly
- [ ] At least one EnterpriseGate placeholder lives in real UI as smoke test
- [ ] All tests pass (Pest + Vitest)
- [ ] PR merged

## Out of scope

- Per-user feature flag overrides (admin tooling) — separate plan
- Real-time flag updates (Pusher / Reverb) — separate plan
- Marketing pages explaining each flag — separate plan
- A/B testing / rollout — out of scope (Parthenon isn't a SaaS-style product)

*End of Plan 02-06.*
