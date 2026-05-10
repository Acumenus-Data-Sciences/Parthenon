<?php

declare(strict_types=1);

namespace App\FeatureFlags;

use App\Auth\AuthDriverRegistry;
use App\Contracts\TenantResolverInterface;
use App\Tenancy\SingleTenantResolver;

/**
 * Composes the active feature-flag set for the current deployment.
 *
 * Sources, in order:
 *  1. `config('feature-flags.flags')` — explicit per-deployment overrides.
 *  2. {@see AuthDriverRegistry} — every non-default auth driver registered
 *     (Keycloak, SAML, SCIM) becomes an `auth.<driver>` flag.
 *  3. Tenancy configuration — emits `tenancy.multi` reflecting whether
 *     a non-CE TenantResolver is bound.
 *
 * Both registry-driven flags are EE-coupled: CE's defaults emit nothing for
 * (2) and `tenancy.multi=false` for (3). EE bundles append more flags by
 * registering EE drivers + binding their own `MultiTenantResolver`.
 */
class FeatureFlagResolver
{
    /**
     * The auth driver names that ship with CE. They are NOT projected to
     * feature flags (no `auth.local` flag, no `auth.authentik-oidc` flag) —
     * those capabilities are part of the CE baseline. Only EE-additive
     * drivers (saml, keycloak, scim, ...) become flags.
     */
    private const CE_AUTH_DRIVERS = ['local', 'authentik-oidc'];

    public function __construct(
        private readonly ?AuthDriverRegistry $authDrivers = null,
        private readonly ?TenantResolverInterface $tenants = null,
    ) {}

    /**
     * @return array<int, FeatureFlag>
     */
    public function resolve(): array
    {
        $flags = [];

        $configured = config('feature-flags.flags', []);
        if (is_array($configured)) {
            foreach ($configured as $name => $spec) {
                if (! is_string($name) || ! is_array($spec)) {
                    continue;
                }
                $flags[] = new FeatureFlag(
                    name: $name,
                    enabled: (bool) ($spec['enabled'] ?? false),
                    source: is_string($spec['source'] ?? null) ? $spec['source'] : 'config',
                    description: is_string($spec['description'] ?? null) ? $spec['description'] : null,
                );
            }
        }

        if ($this->authDrivers !== null) {
            foreach ($this->authDrivers->availableNames() as $driverName) {
                if (in_array($driverName, self::CE_AUTH_DRIVERS, true)) {
                    continue;
                }
                $flags[] = new FeatureFlag(
                    name: "auth.{$driverName}",
                    enabled: true,
                    source: 'ee',
                    description: "Auth driver '{$driverName}' is registered.",
                );
            }
        }

        $resolverClass = config('tenancy.resolver');
        $isMulti = is_string($resolverClass) && $resolverClass !== SingleTenantResolver::class;
        $flags[] = new FeatureFlag(
            name: 'tenancy.multi',
            enabled: $isMulti,
            source: $isMulti ? 'ee' : 'ce',
            description: 'Multi-tenant request routing.',
        );

        return $flags;
    }
}
