<?php

namespace Database\Seeders;

use App\Models\App\AiProviderSetting;
use Illuminate\Database\Seeder;

class AiProviderSeeder extends Seeder
{
    public function run(): void
    {
        $providers = [
            [
                'provider_type' => 'ollama',
                'display_name'  => 'Local Ollama',
                'is_enabled'    => true,
                'is_active'     => true,
                'model'         => 'MedAIBase/MedGemma1.5:4b',
                'settings'      => ['base_url' => 'http://host.docker.internal:11434'],
            ],
            [
                'provider_type' => 'anthropic',
                'display_name'  => 'Anthropic',
                'is_enabled'    => false,
                'is_active'     => false,
                'model'         => 'claude-sonnet-4-6',
                'settings'      => ['api_key' => ''],
            ],
            [
                'provider_type' => 'openai',
                'display_name'  => 'OpenAI',
                'is_enabled'    => false,
                'is_active'     => false,
                'model'         => 'gpt-4o',
                'settings'      => ['api_key' => ''],
            ],
            [
                'provider_type' => 'gemini',
                'display_name'  => 'Google Gemini',
                'is_enabled'    => false,
                'is_active'     => false,
                'model'         => 'gemini-2.0-flash',
                'settings'      => ['api_key' => ''],
            ],
            [
                'provider_type' => 'deepseek',
                'display_name'  => 'DeepSeek',
                'is_enabled'    => false,
                'is_active'     => false,
                'model'         => 'deepseek-chat',
                'settings'      => ['api_key' => ''],
            ],
            [
                'provider_type' => 'qwen',
                'display_name'  => 'Alibaba Qwen',
                'is_enabled'    => false,
                'is_active'     => false,
                'model'         => 'qwen-max',
                'settings'      => ['api_key' => ''],
            ],
            [
                'provider_type' => 'moonshot',
                'display_name'  => 'Moonshot (Kimi)',
                'is_enabled'    => false,
                'is_active'     => false,
                'model'         => 'moonshot-v1-128k',
                'settings'      => ['api_key' => ''],
            ],
            [
                'provider_type' => 'mistral',
                'display_name'  => 'Mistral',
                'is_enabled'    => false,
                'is_active'     => false,
                'model'         => 'mistral-large-latest',
                'settings'      => ['api_key' => ''],
            ],
        ];

        foreach ($providers as $data) {
            AiProviderSetting::updateOrCreate(
                ['provider_type' => $data['provider_type']],
                $data,
            );
        }
    }
}
