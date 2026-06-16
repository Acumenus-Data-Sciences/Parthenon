<?php

declare(strict_types=1);

namespace Tests\Feature\Services\Agents;

use App\Models\App\AiProviderSetting;
use App\Models\App\SystemSetting;
use App\Services\Agents\AgentProviderResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AgentProviderResolverTest extends TestCase
{
    use RefreshDatabase;

    private function setMode(string $mode): void
    {
        SystemSetting::setValue('agents.provider_mode', $mode, 'agents');
    }

    private function seedProvider(string $type, bool $active, bool $enabled): void
    {
        AiProviderSetting::create([
            'provider_type' => $type,
            'display_name' => ucfirst($type),
            'is_active' => $active,
            'is_enabled' => $enabled,
            'model' => 'x',
            'settings' => [],
        ]);
    }

    public function test_defaults_to_anthropic_when_unset(): void
    {
        $this->assertSame('anthropic', (new AgentProviderResolver)->resolveProvider());
        $this->assertSame('cloud', (new AgentProviderResolver)->mode());
    }

    public function test_cloud_mode_resolves_anthropic(): void
    {
        $this->setMode('cloud');
        $this->assertSame('anthropic', (new AgentProviderResolver)->resolveProvider());
    }

    public function test_local_mode_resolves_local(): void
    {
        $this->setMode('local');
        $this->assertSame('local', (new AgentProviderResolver)->resolveProvider());
    }

    public function test_auto_mode_resolves_local_when_ollama_is_active_and_enabled(): void
    {
        $this->setMode('auto');
        $this->seedProvider('ollama', active: true, enabled: true);

        $resolver = new AgentProviderResolver;
        $this->assertTrue($resolver->activeProviderIsLocal());
        $this->assertSame('local', $resolver->resolveProvider());
    }

    public function test_auto_mode_resolves_anthropic_when_active_is_cloud(): void
    {
        $this->setMode('auto');
        $this->seedProvider('anthropic', active: true, enabled: true);

        $this->assertSame('anthropic', (new AgentProviderResolver)->resolveProvider());
    }

    public function test_auto_mode_ignores_inactive_or_disabled_local_provider(): void
    {
        $this->setMode('auto');
        // Ollama present but DISABLED — must not count as a local target.
        $this->seedProvider('ollama', active: true, enabled: false);

        $this->assertFalse((new AgentProviderResolver)->activeProviderIsLocal());
        $this->assertSame('anthropic', (new AgentProviderResolver)->resolveProvider());
    }

    public function test_unknown_mode_normalizes_to_cloud(): void
    {
        $this->setMode('weird-value');
        $resolver = new AgentProviderResolver;
        $this->assertSame('cloud', $resolver->mode());
        $this->assertSame('anthropic', $resolver->resolveProvider());
    }
}
