<?php

namespace App\Providers;

use App\Contracts\TenantResolverInterface;
use App\Tenancy\SingleTenantResolver;
use Illuminate\Support\ServiceProvider;

class TenancyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $resolverClass = config('tenancy.resolver', SingleTenantResolver::class);
        $this->app->singleton(TenantResolverInterface::class, $resolverClass);
        $this->app->alias(TenantResolverInterface::class, 'tenancy.resolver');

        // Concrete resolver classes are also bound so tests can resolve them
        // directly without going through the interface (preserves memoization).
        $this->app->singleton(SingleTenantResolver::class);
    }
}
