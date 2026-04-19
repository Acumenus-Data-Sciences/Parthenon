<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Phase 18 D-11 — upserts `finngen.endpoint_profile_access` on every
 * GET /api/v1/finngen/endpoints/{name}/profile request.
 *
 * Pitfall 3 + T-18-05 mitigation (PostgreSQL transaction poisoning per
 * CLAUDE.md Gotcha #12): ALL DB writes wrapped in try-catch Throwable. If the
 * access-log table is unavailable, the request proceeds normally — the warmer
 * is the only consumer of the table, and missing warm signals are preferable
 * to a 500 on the drawer open. The request pipeline is NEVER broken by the
 * middleware.
 *
 * Access log is keyed on (endpoint_name, source_key). Composite natural PK
 * enforced by the `finngen.endpoint_profile_access` migration (Plan 18-02).
 * Upsert is done via raw SQL with ON CONFLICT so the statement is atomic even
 * if multiple drawer-open requests collide on the same (endpoint, source).
 */
class TrackEndpointProfileAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        // Execute the request FIRST so we never couple the access-log to the
        // controller outcome. If the controller returns 4xx/5xx, we still log
        // the access attempt (the drawer was opened).
        $response = $next($request);

        try {
            $endpointName = (string) $request->route('name');
            $sourceKey = (string) $request->query('source_key', '');
            if ($endpointName === '' || $sourceKey === '') {
                return $response;
            }

            DB::connection('finngen')->statement(
                'INSERT INTO endpoint_profile_access
                    (endpoint_name, source_key, last_accessed_at, access_count, created_at, updated_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT (endpoint_name, source_key) DO UPDATE
                    SET last_accessed_at = EXCLUDED.last_accessed_at,
                        access_count     = endpoint_profile_access.access_count + 1,
                        updated_at       = EXCLUDED.updated_at',
                [$endpointName, $sourceKey]
            );
        } catch (Throwable $e) {
            // T-18-05: never break the request. Log and continue.
            logger()->warning('TrackEndpointProfileAccess upsert failed', [
                'error' => $e->getMessage(),
            ]);
        }

        return $response;
    }
}
