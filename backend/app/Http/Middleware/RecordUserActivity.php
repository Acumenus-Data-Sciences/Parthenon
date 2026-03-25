<?php

namespace App\Http\Middleware;

use App\Models\App\UserAuditLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Records authenticated API access events for the user audit trail.
 * Only logs on first access per (user, feature, day) to avoid flooding.
 */
class RecordUserActivity
{
    /** API path prefixes → feature slugs */
    private const FEATURE_MAP = [
        'admin/users' => 'admin.users',
        'admin/roles' => 'admin.roles',
        'admin/system-health' => 'admin.system-health',
        'admin/ai-providers' => 'admin.ai-providers',
        'admin/auth-providers' => 'admin.auth-providers',
        'admin/vocabulary' => 'admin.vocabulary',
        'admin/user-audit' => 'admin.user-audit',
        'admin' => 'admin',
        'cohort-definitions' => 'cohort-definitions',
        'concept-sets' => 'concept-sets',
        'studies' => 'studies',
        'analyses/characterization' => 'analyses.characterization',
        'analyses/incidence-rate' => 'analyses.incidence-rate',
        'analyses/estimation' => 'analyses.estimation',
        'analyses/prediction' => 'analyses.prediction',
        'analyses/sccs' => 'analyses.sccs',
        'analyses/evidence-synthesis' => 'analyses.evidence-synthesis',
        'analyses' => 'analyses',
        'jobs' => 'jobs',
        'sources' => 'sources',
        'data-explorer' => 'data-explorer',
        'results' => 'results',
        'genomics' => 'genomics',
        'gis' => 'gis',
        'fhir' => 'fhir',
        'heor' => 'heor',
        'commons' => 'commons',
        'phenotypes' => 'phenotypes',
        'mappings' => 'mappings',
        'vocabulary' => 'vocabulary',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Only track authenticated read-like requests (not mutations per se — just first touch)
        $user = $request->user();
        if (! $user) {
            return $response;
        }

        // Skip auth endpoints (handled explicitly in AuthController)
        $path = ltrim($request->path(), '/');
        if (str_starts_with($path, 'api/v1/auth/')) {
            return $response;
        }

        // Resolve to a feature slug
        $apiPath = preg_replace('/^api\/v1\//', '', $path) ?? $path;
        $feature = $this->resolveFeature($apiPath);

        if ($feature === null) {
            return $response;
        }

        // Audit logging is non-critical — never break the request
        try {
            // Throttle: one entry per (user, feature) per hour to avoid log flood
            $recentKey = "audit:{$user->id}:{$feature}:".now()->format('Y-m-d-H');
            if (cache()->has($recentKey)) {
                return $response;
            }
            cache()->put($recentKey, 1, 3600);

            UserAuditLog::create([
                'user_id' => $user->id,
                'action' => 'api_access',
                'feature' => $feature,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'metadata' => [
                    'method' => $request->method(),
                    'path' => $request->path(),
                ],
            ]);
        } catch (\Throwable) {
            // Cache or DB unavailable — silently skip audit logging
        }

        return $response;
    }

    private function resolveFeature(string $path): ?string
    {
        foreach (self::FEATURE_MAP as $prefix => $slug) {
            if (str_starts_with($path, $prefix)) {
                return $slug;
            }
        }

        return null;
    }
}
