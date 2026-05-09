<?php

namespace App\Providers;

use App\Audit\AuditDispatcher;
use App\Audit\AuditSinkRegistry;
use App\Audit\Sinks\DatabaseAuditSink;
use App\Contracts\AuditSinkInterface;
use Illuminate\Support\ServiceProvider;

class AuditServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AuditSinkRegistry::class);
        $this->app->singleton(AuditDispatcher::class);
    }

    public function boot(): void
    {
        /** @var AuditSinkRegistry $registry */
        $registry = $this->app->make(AuditSinkRegistry::class);

        foreach (config('audit.sinks', [DatabaseAuditSink::class]) as $sinkClass) {
            /** @var AuditSinkInterface $sink */
            $sink = $this->app->make($sinkClass);
            $registry->register($sink);
        }
    }
}
