<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\AppSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * @group Administration
 */
class AppSettingsController extends Controller
{
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
                'updated_at' => $settings->updated_at,
            ],
        ]);
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
