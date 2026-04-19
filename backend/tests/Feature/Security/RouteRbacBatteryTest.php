<?php

declare(strict_types=1);

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Route RBAC Battery
|--------------------------------------------------------------------------
|
| Data-driven guard that enumerates every registered API route carrying a
| `permission:*` middleware string and asserts that:
|
|   1. An unauthenticated request is rejected (401).
|   2. A `viewer` user who LACKS the required permission is rejected
|      (any 4xx — 403 canonical, 404/405/422 also acceptable).
|
| Routes whose permission is already granted to the `viewer` role (typically
| the `*.view` permissions) are skipped for the 403 check — there is no
| unauthorized user to simulate for those.
|
| For URIs with route parameters we substitute placeholder integers. We
| only care about the auth/permission gate, not successful execution. The
| test FAILS only if an unauthorized user receives a 2xx or 5xx, which
| would indicate the gate is missing or broken.
|
| We use a single test that iterates internally rather than a Pest dataset
| because Pest evaluates `dataset()` closures before the Laravel app is
| bootstrapped, which means `Route::getRoutes()` is unavailable at that
| moment. Collecting inside the test body gives us a fully bootstrapped
| container plus per-route diagnostic output on failure.
|
*/

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

/**
 * Collect every route that carries a `permission:*` middleware string.
 *
 * @return list<array{method: string, uri: string, permission: string, primary: string, name: string}>
 */
function collectPermissionGatedRoutes(): array
{
    $collected = [];
    $seen = [];

    foreach (Route::getRoutes() as $route) {
        $middlewares = $route->gatherMiddleware();

        foreach ($middlewares as $middleware) {
            if (! is_string($middleware) || ! str_starts_with($middleware, 'permission:')) {
                continue;
            }

            $permission = substr($middleware, strlen('permission:'));
            // Some routes chain multiple permissions separated by `|`; the
            // Spatie middleware treats them as OR. Track each one so the
            // skip-if-viewer-has-any check works correctly.
            $primary = explode('|', $permission)[0];

            foreach ($route->methods() as $method) {
                if ($method === 'HEAD') {
                    continue;
                }

                $uri = '/'.ltrim($route->uri(), '/');
                $key = $method.' '.$uri.' '.$permission;
                if (isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;

                $collected[] = [
                    'method' => $method,
                    'uri' => $uri,
                    'permission' => $permission,
                    'primary' => $primary,
                    'wheres' => $route->wheres ?? [],
                    'name' => $route->getName() ?? ($method.' '.$uri),
                ];
            }
        }
    }

    return $collected;
}

/**
 * Substitute any {param} placeholders in a URI with a plausible value that
 * satisfies the route's `where` constraints (so Laravel can match the route
 * and dispatch the auth middleware instead of returning an early 404).
 *
 * @param  array<string, string>  $wheres
 */
function substituteRouteParams(string $uri, array $wheres = []): string
{
    // Drop optional params entirely.
    $uri = preg_replace('/\{([^}]+)\?\}/', '', $uri) ?? $uri;

    // Replace each required param individually so we can honor constraints.
    $uri = preg_replace_callback('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', function ($m) use ($wheres): string {
        $name = $m[1];
        $constraint = $wheres[$name] ?? null;

        // Prefer a value that matches the constraint regex if one exists.
        if ($constraint !== null) {
            // Try common candidates in order of specificity.
            foreach (['1', 'PGS000001', 'abc', 'a1', 'a', 'name', 'token'] as $candidate) {
                if (@preg_match('/^(?:'.$constraint.')$/', $candidate) === 1) {
                    return $candidate;
                }
            }

            // Fall back: synthesize based on a simple heuristic.
            if (str_contains($constraint, '[0-9]')) {
                return '1';
            }

            return 'name';
        }

        // No constraint — "1" is the simplest universally-matching token.
        return '1';
    }, $uri) ?? $uri;

    // Collapse any double slashes introduced by dropped optional params.
    $uri = preg_replace('#/+#', '/', $uri) ?? $uri;

    return rtrim($uri, '/') ?: '/';
}

/**
 * Dispatch a JSON request for an arbitrary HTTP method.
 */
function dispatchJson(TestCase $test, string $method, string $uri): TestResponse
{
    $method = strtoupper($method);

    return match ($method) {
        'GET' => $test->getJson($uri),
        'POST' => $test->postJson($uri, []),
        'PUT' => $test->putJson($uri, []),
        'PATCH' => $test->patchJson($uri, []),
        'DELETE' => $test->deleteJson($uri),
        'OPTIONS' => $test->optionsJson($uri),
        default => $test->json($method, $uri),
    };
}

it('enforces permission middleware on every gated API route', function () {
    $this->withoutMiddleware(ThrottleRequests::class);

    $routes = collectPermissionGatedRoutes();

    expect($routes)->not->toBeEmpty(
        'No routes with permission:* middleware were discovered — route loading may have failed.'
    );

    /** @var list<array{route: array, stage: string, status: int}> $failures */
    $failures = [];
    $anonChecked = 0;
    $viewerChecked = 0;
    $viewerSkipped = 0;

    // -------- Stage 1: unauthenticated request must get 401 --------
    //
    // This pass runs BEFORE any actingAs() call so the auth guard stays
    // empty. Laravel's TestCase caches the authenticated user across
    // requests in the same test, so once actingAs() is called subsequent
    // requests remain authenticated — we must do all anon probes first.
    foreach ($routes as $route) {
        $uri = substituteRouteParams($route['uri'], $route['wheres']);

        $anon = dispatchJson($this, $route['method'], $uri);
        $anonStatus = $anon->status();
        $anonChecked++;

        if ($anonStatus !== 401) {
            $failures[] = [
                'route' => $route,
                'stage' => 'unauth',
                'status' => $anonStatus,
            ];
        }
    }

    // -------- Stage 2: viewer lacking the permission must get 4xx --------
    $viewer = User::factory()->create(['must_change_password' => false]);
    $viewer->assignRole('viewer');
    $this->actingAs($viewer);

    foreach ($routes as $route) {
        $chained = explode('|', $route['permission']);
        $viewerHasOne = false;
        foreach ($chained as $perm) {
            if ($viewer->can($perm)) {
                $viewerHasOne = true;
                break;
            }
        }

        if ($viewerHasOne) {
            $viewerSkipped++;

            continue;
        }

        $viewerChecked++;

        $uri = substituteRouteParams($route['uri'], $route['wheres']);
        $viewerResponse = dispatchJson($this, $route['method'], $uri);
        $viewerStatus = $viewerResponse->status();

        // Acceptable: any 4xx (403 canonical; 404/405/422 also mean access denied
        // or validator rejected the request before the controller ran).
        // Failing: 2xx (reached controller as unauthorized user) or 5xx.
        if ($viewerStatus < 400 || $viewerStatus >= 500) {
            $failures[] = [
                'route' => $route,
                'stage' => 'viewer',
                'status' => $viewerStatus,
            ];
        }
    }

    // Always print the totals so the harness reports progress even on pass.
    fwrite(STDERR, sprintf(
        "\n[RBAC Battery] routes=%d  anon_checked=%d  viewer_checked=%d  viewer_skipped=%d  failures=%d\n",
        count($routes),
        $anonChecked,
        $viewerChecked,
        $viewerSkipped,
        count($failures),
    ));

    if ($failures !== []) {
        $lines = ["\nRBAC battery found ".count($failures).' failure(s):'];
        foreach ($failures as $f) {
            $lines[] = sprintf(
                '  [%s] %s %s (permission=%s) -> HTTP %d',
                strtoupper($f['stage']),
                $f['route']['method'],
                $f['route']['uri'],
                $f['route']['permission'],
                $f['status'],
            );
        }
        $this->fail(implode("\n", $lines));
    }

    expect($failures)->toBe([]);
});
