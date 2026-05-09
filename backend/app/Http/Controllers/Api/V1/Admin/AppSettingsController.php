<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\AppSetting;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Throwable;

/**
 * @group Administration
 */
class AppSettingsController extends Controller
{
    private const TEMPLATES_HEALTH_CACHE_KEY = 'app-settings:templates-health';

    private const TEMPLATES_HEALTH_TTL_SECONDS = 30;

    /**
     * GET /api/v1/admin/app-settings
     *
     * Retrieve current application settings (available to all authenticated users).
     */
    public function index(): JsonResponse
    {
        $settings = AppSetting::instance();
        $dialects = AppSetting::availableDialects();

        return response()->json([
            'data' => [
                'default_sql_dialect' => $settings->default_sql_dialect,
                'available_dialects' => $dialects,
                'ingestion' => [
                    'templates_enabled' => $this->isTemplatesServiceHealthy(),
                ],
                'updated_at' => $settings->updated_at,
            ],
        ]);
    }

    /**
     * Probe the parthenon-templates service /health endpoint.
     *
     * Result is cached briefly so a single page load (and quick re-renders) do
     * not hammer the templates service. Returns false when the service is not
     * configured, unreachable, or returns a non-2xx response.
     */
    private function isTemplatesServiceHealthy(): bool
    {
        $url = (string) config('services.templates.url', '');
        if ($url === '') {
            return false;
        }

        $cached = Cache::get(self::TEMPLATES_HEALTH_CACHE_KEY);
        if (is_bool($cached)) {
            return $cached;
        }

        $healthy = false;
        try {
            $response = Http::timeout(2)->connectTimeout(1)
                ->acceptJson()
                ->get(rtrim($url, '/').'/health');
            $healthy = $response->successful();
        } catch (ConnectionException $e) {
            $healthy = false;
        } catch (Throwable $e) {
            Log::warning('Templates service health probe failed', [
                'error' => $e->getMessage(),
            ]);
            $healthy = false;
        }

        Cache::put(self::TEMPLATES_HEALTH_CACHE_KEY, $healthy, self::TEMPLATES_HEALTH_TTL_SECONDS);

        return $healthy;
    }

    /**
     * PATCH /api/v1/admin/app-settings
     *
     * Update application settings (super-admin only).
     */
    public function update(Request $request): JsonResponse
    {
        $dialectValues = array_column(AppSetting::availableDialects(), 'value');

        $validated = $request->validate([
            'default_sql_dialect' => ['sometimes', 'string', Rule::in($dialectValues)],
        ]);

        $settings = AppSetting::instance();
        $settings->fill($validated);
        $settings->updated_by = $request->user()?->id;
        $settings->save();

        return response()->json([
            'data' => [
                'default_sql_dialect' => $settings->default_sql_dialect,
                'available_dialects' => AppSetting::availableDialects(),
                'updated_at' => $settings->updated_at,
            ],
        ]);
    }
}
