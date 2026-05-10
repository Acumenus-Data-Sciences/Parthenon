<?php

declare(strict_types=1);

namespace App\Providers;

use App\Auth\AuthDriverRegistry;
use App\Contracts\TenantResolverInterface;
use App\FeatureFlags\FeatureFlagResolver;
use Illuminate\Contracts\Container\BindingResolutionException;
use Illuminate\Support\ServiceProvider;

/**
 * Wires the deployment-level feature-flag extension point.
 *
 *  - Merges `config/feature-flags.php` so EE's published config can override.
 *  - Singleton-binds {@see FeatureFlagResolver} so the controller and any
 *    in-process consumers (e.g., Blade conditionals, console commands) see
 *    the same resolver.
 *  - Resolves AuthDriverRegistry + TenantResolverInterface lazily so this
 *    provider boots even in minimal CLI contexts (e.g., `artisan tinker`)
 *    where tenancy/auth aren't yet bound.
 */
class FeatureFlagsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../../config/feature-flags.php', 'feature-flags');

        $this->app->singleton(FeatureFlagResolver::class, function ($app): FeatureFlagResolver {
            $auth = null;
            $tenants = null;

            try {
                $auth = $app->make(AuthDriverRegistry::class);
            } catch (BindingResolutionException) {
                // AuthDriverRegistry not bound — feature flags fall back to config-only.
            }

            try {
                $tenants = $app->make(TenantResolverInterface::class);
            } catch (BindingResolutionException) {
                // TenantResolver not bound — tenancy flag still emits via config('tenancy.resolver').
            }

            return new FeatureFlagResolver(
                authDrivers: $auth,
                tenants: $tenants,
            );
        });
    }
}
