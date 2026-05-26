<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\AiProviderSetting;
use App\Models\App\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Administration
 *
 * Runtime toggle for the AI agent copilots (Claude Agent SDK).
 * Persisted in `system_settings` under key `agents.enabled`.
 * Only super-admins may read or write this setting.
 */
class AgentSettingsController extends Controller
{
    /**
     * GET /api/v1/admin/ai-agents
     *
     * Returns the current agent toggle state and whether an Anthropic-capable
     * provider is configured and enabled (the prerequisite for Claude agents).
     */
    public function show(): JsonResponse
    {
        return response()->json($this->payload());
    }

    /**
     * PUT /api/v1/admin/ai-agents
     *
     * Toggles the `agents.enabled` system setting.
     *
     * Body: { "enabled": true|false }
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        SystemSetting::setValue(
            'agents.enabled',
            $request->boolean('enabled') ? '1' : '0',
            'agents',
        );

        return response()->json($this->payload());
    }

    /**
     * Build the response payload shared by show() and update().
     *
     * `anthropic_ready` is true when the `anthropic` AiProviderSetting row
     * exists and is_enabled=true (meaning the super-admin has explicitly
     * enabled it, which requires a valid api_key to have been saved).  If no
     * row exists yet we fall back to checking the ANTHROPIC_API_KEY env var so
     * fresh installs that set the key in .env before seeding still report
     * ready=true.
     *
     * @return array{enabled: bool, anthropic_ready: bool}
     */
    private function payload(): array
    {
        $enabled = SystemSetting::getValue('agents.enabled', '0') === '1';

        $anthropicReady = AiProviderSetting::where('provider_type', 'anthropic')
            ->where('is_enabled', true)
            ->exists();

        // Env-key fallback for installs that haven't seeded the provider table yet.
        if (! $anthropicReady) {
            $anthropicReady = (bool) env('ANTHROPIC_API_KEY');
        }

        return [
            'enabled' => $enabled,
            'anthropic_ready' => $anthropicReady,
        ];
    }
}
