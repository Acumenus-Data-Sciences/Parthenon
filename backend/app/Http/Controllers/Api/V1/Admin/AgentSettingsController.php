<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\AiProviderSetting;
use App\Models\App\SystemSetting;
use App\Services\Agents\AgentProviderResolver;
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
        $validated = $request->validate([
            'enabled' => ['required_without:provider_mode', 'boolean'],
            'provider_mode' => [
                'required_without:enabled',
                'in:'.implode(',', [
                    AgentProviderResolver::MODE_CLOUD,
                    AgentProviderResolver::MODE_LOCAL,
                    AgentProviderResolver::MODE_AUTO,
                ]),
            ],
        ]);

        if (array_key_exists('enabled', $validated)) {
            SystemSetting::setValue(
                'agents.enabled',
                $request->boolean('enabled') ? '1' : '0',
                'agents',
            );
        }

        if (array_key_exists('provider_mode', $validated)) {
            SystemSetting::setValue(
                'agents.provider_mode',
                $validated['provider_mode'],
                'agents',
            );
        }

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
     * `provider_mode` is which provider the action-taking copilots use
     * (cloud=Anthropic / local=claude-router proxy / auto=follow active).
     * `local_ready` is true when a proxy-frontable local provider (ollama) is
     * the active, enabled one — the prerequisite for local/auto to run locally.
     *
     * @return array{enabled: bool, anthropic_ready: bool, provider_mode: string, local_ready: bool}
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

        $resolver = new AgentProviderResolver;

        return [
            'enabled' => $enabled,
            'anthropic_ready' => $anthropicReady,
            'provider_mode' => $resolver->mode(),
            'local_ready' => $resolver->activeProviderIsLocal(),
        ];
    }
}
