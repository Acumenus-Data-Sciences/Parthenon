<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Maps legacy OHDSI Atlas and WebAPI URL patterns to Parthenon equivalents.
 *
 * Mounted at /atlas/ and /WebAPI/ prefixes for backward-compatible redirects.
 */
class LegacyAtlasRedirectController extends Controller
{
    /**
     * Atlas hash-based SPA routes → Parthenon SPA routes.
     *
     * Atlas URLs use hash routing (/#/cohortdefinition/123).
     * The fragment is not sent to the server, so we redirect the base path
     * and let the client-side handle the hash if present.
     */
    private const ATLAS_ROUTE_MAP = [
        'cohortdefinition' => '/cohort-definitions',
        'conceptset' => '/concept-sets',
        'incidencerates' => '/analyses/incidence-rates',
        'characterizations' => '/analyses/characterizations',
        'estimation' => '/analyses/estimations',
        'prediction' => '/analyses/predictions',
        'pathways' => '/analyses/pathways',
        'profiles' => '/profiles',
        'datasources' => '/data-sources',
        'search' => '/vocabulary',
        'home' => '/',
        'jobs' => '/jobs',
    ];

    /**
     * Catch-all for /atlas/* requests.
     *
     * Since Atlas uses hash-based routing (/#/path), the server only sees /atlas/
     * or /atlas/index.html. This handles known sub-paths and falls back to dashboard.
     */
    public function atlasRedirect(Request $request, ?string $path = null): RedirectResponse
    {
        if (! $path) {
            return redirect('/')->with('legacy_redirect', true);
        }

        $segments = explode('/', trim($path, '/'));
        $key = strtolower($segments[0] ?? '');
        $id = $segments[1] ?? null;

        if (isset(self::ATLAS_ROUTE_MAP[$key])) {
            $target = self::ATLAS_ROUTE_MAP[$key];
            if ($id && is_numeric($id)) {
                $target .= "/{$id}";
            }

            return redirect($target, 301);
        }

        return redirect('/')
            ->with('legacy_redirect', true)
            ->with('legacy_redirect_message', "The Atlas URL '/{$path}' has no direct equivalent in Parthenon.");
    }

    /**
     * WebAPI REST-style redirects → Parthenon API.
     *
     * Maps common WebAPI endpoints to their Parthenon API equivalents.
     */
    public function webApiRedirect(Request $request, ?string $path = null): RedirectResponse
    {
        if (! $path) {
            return redirect('/api/v1/health', 301);
        }

        $segments = explode('/', trim($path, '/'));
        $resource = strtolower($segments[0] ?? '');
        $id = $segments[1] ?? null;
        $action = $segments[2] ?? null;

        // WebAPI /source/ → Parthenon /api/v1/sources
        if ($resource === 'source') {
            $target = '/api/v1/sources';
            if ($id && is_numeric($id)) {
                $target .= "/{$id}";
            }

            return redirect($target, 301);
        }

        // WebAPI /cohortdefinition/{id} → Parthenon /api/v1/cohort-definitions/{id}
        if ($resource === 'cohortdefinition') {
            $target = '/api/v1/cohort-definitions';
            if ($id && is_numeric($id)) {
                $target .= "/{$id}";

                // /cohortdefinition/{id}/generate/{sourceKey}
                if ($action === 'generate') {
                    $target .= '/generate';
                }
            }

            return redirect($target, 301);
        }

        // WebAPI /vocabulary/search → Parthenon /api/v1/vocabulary/search
        if ($resource === 'vocabulary') {
            $subPath = implode('/', array_slice($segments, 1));
            $target = '/api/v1/vocabulary';
            if ($subPath) {
                $target .= "/{$subPath}";
            }
            if ($request->getQueryString()) {
                $target .= "?{$request->getQueryString()}";
            }

            return redirect($target, 301);
        }

        // WebAPI /conceptset/{id}
        if ($resource === 'conceptset') {
            $target = '/api/v1/concept-sets';
            if ($id && is_numeric($id)) {
                $target .= "/{$id}";
            }

            return redirect($target, 301);
        }

        // WebAPI /ir/{id}
        if ($resource === 'ir') {
            $target = '/api/v1/incidence-rates';
            if ($id && is_numeric($id)) {
                $target .= "/{$id}";
            }

            return redirect($target, 301);
        }

        // Unknown WebAPI paths → health check
        return redirect('/api/v1/health', 301);
    }
}
