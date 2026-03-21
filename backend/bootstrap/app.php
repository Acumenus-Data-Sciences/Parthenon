<?php

use App\Http\Middleware\ForceJsonResponse;
use App\Http\Middleware\RecordUserActivity;
use App\Jobs\Analysis\CareGapNightlyRefreshJob;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        then: function () {
            Route::prefix('api/v1')
                ->middleware(['api'])
                ->group(base_path('routes/fhir.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->statefulApi();
        $middleware->api(prepend: [
            ForceJsonResponse::class,
        ]);
        $middleware->appendToGroup('api', [
            RecordUserActivity::class,
        ]);
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withSchedule(function (Schedule $schedule) {
        $schedule->job(new CareGapNightlyRefreshJob)
            ->dailyAt('02:00')
            ->withoutOverlapping(60)
            ->onOneServer()
            ->appendOutputTo(storage_path('logs/care-gap-refresh.log'));
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
