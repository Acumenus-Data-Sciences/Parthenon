<?php

namespace App\Providers;

use App\Contracts\CryptoProviderInterface;
use Illuminate\Support\ServiceProvider;

class CryptoProviderServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(
            CryptoProviderInterface::class,
            fn ($app) => $app->make(config('crypto.provider')),
        );
    }
}
