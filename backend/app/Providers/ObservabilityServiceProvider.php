<?php

declare(strict_types=1);

namespace App\Providers;

use App\Contracts\TenantResolverInterface;
use App\Observability\Observer;
use App\Observability\ShipperRegistry;
use Illuminate\Contracts\Container\BindingResolutionException;
use Illuminate\Support\ServiceProvider;

/**
 * Wires the observability shipper extension point.
 *
 *  - Binds {@see ShipperRegistry} as a singleton so EE bundles can register
 *    shippers at boot time without rebuilding the registry.
 *  - Resolves {@see Observer} with the registry plus the tenant resolver
 *    (when available — falls back to null in test environments where
 *    tenancy is bypassed).
 *  - On boot, instantiates the shippers listed in config('observability.shippers').
 */
class ObservabilityServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../../config/observability.php', 'observability');

        $this->app->singleton(ShipperRegistry::class);

        $this->app->singleton(Observer::class, function ($app): Observer {
            $tenants = null;
            try {
                $tenants = $app->make(TenantResolverInterface::class);
            } catch (BindingResolutionException) {
                // Tenancy not bound (e.g. minimal CLI bootstraps) — Observer copes.
            }

            return new Observer(
                registry: $app->make(ShipperRegistry::class),
                tenants: $tenants,
            );
        });
    }

    public function boot(): void
    {
        /** @var ShipperRegistry $registry */
        $registry = $this->app->make(ShipperRegistry::class);

        $shippers = config('observability.shippers', []);
        if (! is_array($shippers)) {
            return;
        }

        foreach ($shippers as $class) {
            if (! is_string($class) || $class === '') {
                continue;
            }
            $registry->register($this->app->make($class));
        }
    }
}
