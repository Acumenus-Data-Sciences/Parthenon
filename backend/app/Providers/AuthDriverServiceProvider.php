<?php

namespace App\Providers;

use App\Auth\AuthDriverRegistry;
use App\Contracts\AuthDriverInterface;
use Illuminate\Support\ServiceProvider;

class AuthDriverServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AuthDriverRegistry::class);
    }

    public function boot(): void
    {
        /** @var AuthDriverRegistry $registry */
        $registry = $this->app->make(AuthDriverRegistry::class);

        foreach (config('auth-drivers.drivers', []) as $class) {
            /** @var AuthDriverInterface $driver */
            $driver = $this->app->make($class);
            $registry->register($driver);
        }
    }
}
