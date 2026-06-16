<?php

declare(strict_types=1);

namespace App\Services\Agents;

use App\Models\App\AiProviderSetting;
use App\Models\App\SystemSetting;

/**
 * Resolves which provider the action-taking Claude Agent SDK copilots
 * (Studies / Publish / Abby orchestrator) should use, from the super-admin's
 * runtime setting. Laravel is authoritative; python-ai treats the value it
 * sends as an override of its own AGENT_PROVIDER env default.
 *
 * Modes (system_settings key `agents.provider_mode`):
 *   - cloud (default) — Anthropic cloud (Claude). Preserves EE behavior.
 *   - local           — the local model via the claude-router proxy.
 *   - auto            — local IF the active AI provider is a proxy-frontable
 *                       local type (ollama) AND enabled; otherwise cloud.
 *
 * Default is `cloud` deliberately: the AiProviderSeeder makes `ollama` the
 * ACTIVE provider for the chat/RAG path, so an `auto`-by-default would flip the
 * copilots to a proxy that may not be running and break a cloud deployment.
 */
class AgentProviderResolver
{
    public const MODE_CLOUD = 'cloud';

    public const MODE_LOCAL = 'local';

    public const MODE_AUTO = 'auto';

    public const PROVIDER_ANTHROPIC = 'anthropic';

    public const PROVIDER_LOCAL = 'local';

    /**
     * Provider types the claude-router proxy can front for the copilots. The
     * proxy speaks the Anthropic Messages API and forwards to Ollama, so only
     * `ollama` qualifies — other cloud providers (openai, gemini, ...) are not
     * reachable through it and fall back to the Anthropic copilot path.
     *
     * @var list<string>
     */
    private const LOCAL_PROVIDER_TYPES = ['ollama'];

    /**
     * The provider override to send to python-ai: 'anthropic' or 'local'.
     */
    public function resolveProvider(): string
    {
        return match ($this->mode()) {
            self::MODE_LOCAL => self::PROVIDER_LOCAL,
            self::MODE_AUTO => $this->activeProviderIsLocal()
                ? self::PROVIDER_LOCAL
                : self::PROVIDER_ANTHROPIC,
            default => self::PROVIDER_ANTHROPIC,
        };
    }

    /**
     * Current provider mode, normalized to a known value (unknown → cloud).
     */
    public function mode(): string
    {
        $mode = (string) SystemSetting::getValue('agents.provider_mode', self::MODE_CLOUD);

        return in_array($mode, [self::MODE_CLOUD, self::MODE_LOCAL, self::MODE_AUTO], true)
            ? $mode
            : self::MODE_CLOUD;
    }

    /**
     * Whether a proxy-frontable local provider is the active, enabled one —
     * used by `auto` and surfaced to the admin UI as readiness for local mode.
     */
    public function activeProviderIsLocal(): bool
    {
        return AiProviderSetting::query()
            ->where('is_active', true)
            ->where('is_enabled', true)
            ->whereIn('provider_type', self::LOCAL_PROVIDER_TYPES)
            ->exists();
    }
}
