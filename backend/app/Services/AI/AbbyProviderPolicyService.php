<?php

namespace App\Services\AI;

use App\Models\App\AbbyProviderProfile;
use App\Models\App\AbbySurfacePolicy;
use App\Models\App\AiProviderSetting;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class AbbyProviderPolicyService
{
    public const CAPABILITIES = [
        'chat',
        'streaming',
        'structured_output',
        'json_mode',
        'embeddings',
        'tool_calling',
        'agent_loop',
        'long_context',
        'vision',
        'clinical_rag',
        'patient_level_local_only',
    ];

    public const ENTITLEMENTS = [
        'local',
        'org_api_key',
        'user_api_key',
        'acumenus_managed_api',
        'external_subscription_app',
    ];

    public const MODES = [
        'local_only',
        'cloud_only',
        'local_first',
        'cloud_first',
        'auto_by_complexity',
        'auto_by_budget',
        'disabled',
    ];

    public const SURFACES = [
        'chat',
        'parse_cohort',
        'study_agent',
        'protocol_evaluator',
        'gis',
        'phenotype_interpreter',
        'embeddings',
    ];

    public const TRANSPORTS = [
        'ollama_chat',
        'anthropic_messages',
        'openai_responses',
        'openai_compatible_chat',
        'anthropic_compatible_proxy',
        'external_subscription_app',
    ];

    private const OPENAI_COMPATIBLE_BASE_URLS = [
        'deepseek' => 'https://api.deepseek.com',
        'mistral' => 'https://api.mistral.ai/v1',
        'moonshot' => 'https://api.moonshot.cn/v1',
        'qwen' => 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    ];

    /**
     * @return array<string, array<int, string>>
     */
    public function surfaceRequirements(): array
    {
        return [
            'chat' => ['chat', 'streaming'],
            'parse_cohort' => ['chat'],
            'study_agent' => ['agent_loop', 'tool_calling'],
            'protocol_evaluator' => ['chat'],
            'gis' => ['chat'],
            'phenotype_interpreter' => ['chat'],
            'embeddings' => ['embeddings'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function catalog(): array
    {
        return [
            'capabilities' => self::CAPABILITIES,
            'entitlements' => self::ENTITLEMENTS,
            'modes' => self::MODES,
            'surfaces' => self::SURFACES,
            'transports' => self::TRANSPORTS,
            'surface_requirements' => $this->surfaceRequirements(),
            'presets' => $this->presets(),
            'readiness' => $this->readiness(),
        ];
    }

    /**
     * Per-profile readiness states for admin diagnostics. Each configured profile
     * maps to one of: ready | missing_key | local_model_unconfigured |
     * unsupported_for_agent | disabled. Secret-safe (no key material).
     *
     * @return array<int, array<string, mixed>>
     */
    public function readiness(): array
    {
        if (! $this->tablesExist()) {
            return [];
        }

        return AbbyProviderProfile::query()
            ->orderBy('profile_id')
            ->get()
            ->map(function (AbbyProviderProfile $profile): array {
                return [
                    'profile_id' => $profile->profile_id,
                    'provider_type' => $profile->provider_type,
                    'transport' => $profile->transport,
                    'entitlement_type' => $profile->entitlement_type,
                    'state' => $this->readinessState($profile),
                    'agent_capable' => in_array('agent_loop', array_values($profile->capabilities ?? []), true)
                        && in_array('tool_calling', array_values($profile->capabilities ?? []), true),
                ];
            })
            ->all();
    }

    private function readinessState(AbbyProviderProfile $profile): string
    {
        if (! $profile->is_enabled) {
            return 'disabled';
        }

        if ($profile->transport === 'external_subscription_app') {
            return 'external_subscription_app';
        }

        if ($this->isCloudProfile($profile)) {
            $settings = $this->providerSettingsForProfile($profile);

            return ! empty($settings['api_key']) ? 'ready' : 'missing_key';
        }

        // Local profile: ready if a model is configured (live Ollama probe is the
        // python-ai /abby/provider-health responsibility, surfaced separately).
        return $profile->model ? 'ready' : 'local_model_unconfigured';
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<int, string>
     */
    public function validateProfileAttributes(array $attributes): array
    {
        $errors = [];
        $transport = (string) ($attributes['transport'] ?? '');
        $entitlement = (string) ($attributes['entitlement_type'] ?? 'local');
        $providerType = (string) ($attributes['provider_type'] ?? '');
        $capabilities = array_values($attributes['capabilities'] ?? []);

        $unknownCapabilities = array_values(array_diff($capabilities, self::CAPABILITIES));
        if ($unknownCapabilities !== []) {
            $errors[] = 'unknown_capabilities:'.implode(',', $unknownCapabilities);
        }

        if (! in_array($transport, self::TRANSPORTS, true)) {
            $errors[] = 'unsupported_transport';
        }

        if (! in_array($entitlement, self::ENTITLEMENTS, true)) {
            $errors[] = 'unsupported_entitlement';
        }

        if ($transport === 'ollama_chat' && empty($attributes['base_url'])) {
            $errors[] = 'base_url_required_for_ollama';
        }

        if ($transport === 'openai_compatible_chat' && empty($attributes['base_url'])) {
            $errors[] = 'base_url_required_for_openai_compatible';
        }

        if ($transport !== 'ollama_chat' && $entitlement === 'local') {
            $errors[] = 'cloud_transport_requires_non_local_entitlement';
        }

        if ($transport === 'ollama_chat' && $entitlement !== 'local') {
            $errors[] = 'ollama_transport_requires_local_entitlement';
        }

        if ($providerType === 'openai_compatible' && $transport === 'openai_compatible_chat') {
            $errors[] = 'openai_compatible_profile_requires_concrete_provider_type';
        }

        return $errors;
    }

    /**
     * @return array<int, string>
     */
    public function validateSurfacePolicy(AbbySurfacePolicy $policy): array
    {
        $errors = [];

        if (! in_array($policy->surface, self::SURFACES, true)) {
            $errors[] = 'unsupported_surface';
        }

        if (! in_array($policy->provider_mode, self::MODES, true)) {
            $errors[] = 'unsupported_provider_mode';
        }

        if ($policy->provider_mode === 'disabled') {
            return $errors;
        }

        $profile = $policy->default_profile_id
            ? AbbyProviderProfile::where('profile_id', $policy->default_profile_id)->first()
            : null;

        if ($profile === null) {
            $errors[] = 'default_profile_missing';
        } else {
            $errors = array_merge($errors, $this->validateProfileForSurface($profile, $policy));
        }

        foreach (($policy->fallback_profile_ids ?? []) as $profileId) {
            $fallback = AbbyProviderProfile::where('profile_id', $profileId)->first();
            if ($fallback === null) {
                $errors[] = "fallback_profile_missing:{$profileId}";
            } else {
                $errors = array_merge($errors, array_map(
                    fn (string $error): string => "fallback_profile_invalid:{$profileId}:{$error}",
                    $this->validateProfileForSurface($fallback, $policy),
                ));
            }
        }

        return $errors;
    }

    /**
     * @return array<int, string>
     */
    public function validateProfileForSurface(AbbyProviderProfile $profile, AbbySurfacePolicy $policy): array
    {
        $errors = [];
        $capabilities = array_values($profile->capabilities ?? []);
        $required = array_values($policy->required_capabilities ?: ($this->surfaceRequirements()[$policy->surface] ?? ['chat']));
        $missing = array_values(array_diff($required, $capabilities));

        if (! $profile->is_enabled) {
            $errors[] = 'profile_disabled';
        }

        if ($profile->transport === 'external_subscription_app') {
            $errors[] = 'external_subscription_app_not_backend_routable';
        }

        if ($missing !== []) {
            $errors[] = 'missing_capabilities:'.implode(',', $missing);
        }

        if ($this->isCloudProfile($profile) && ! $policy->allow_cloud) {
            $errors[] = 'cloud_not_allowed';
        }

        $patientLevelAllowed = (bool) Arr::get($profile->safety ?? [], 'patient_level_context_allowed', false);
        if (
            $this->isCloudProfile($profile)
            && $policy->never_send_phi_to_cloud
            && ! $patientLevelAllowed
        ) {
            $errors[] = 'patient_level_context_not_cloud_safe';
        }

        return $errors;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function payloadForSurface(string $surface): ?array
    {
        if (! $this->tablesExist()) {
            return null;
        }

        $policy = AbbySurfacePolicy::where('surface', $surface)->first();
        if ($policy === null) {
            return null;
        }

        if ($policy->provider_mode === 'disabled') {
            return [
                'provider_type' => 'ollama',
                'profile_id' => $policy->default_profile_id ?: 'local-medgemma',
                'mode' => 'disabled',
                'model' => '',
                'entitlement' => 'local',
                'settings' => [],
            ];
        }

        // Resolve in configured order: default profile first, then each fallback,
        // returning the first profile that is valid for this surface. This mirrors
        // the route simulator so the production payload path and the simulator
        // agree on which profile a turn will actually use.
        $candidateIds = array_merge(
            $policy->default_profile_id ? [$policy->default_profile_id] : [],
            $policy->fallback_profile_ids ?? [],
        );

        foreach ($candidateIds as $profileId) {
            $profile = AbbyProviderProfile::where('profile_id', $profileId)->first();
            if ($profile !== null && $this->validateProfileForSurface($profile, $policy) === []) {
                return $this->payloadForProfile($profile, $policy->provider_mode);
            }
        }

        return null;
    }

    /**
     * Named policy presets that fill sensible defaults for common deployments.
     * Super-admins apply one as a starting point, then adjust. The presets do
     * not by themselves change runtime state — they describe a surface policy.
     *
     * @return array<string, array<string, mixed>>
     */
    public function presets(): array
    {
        return [
            'clinical_local_only' => [
                'label' => 'Clinical local-only',
                'provider_mode' => 'local_only',
                'allow_cloud' => false,
                'never_send_phi_to_cloud' => true,
            ],
            'local_first_cloud_summaries' => [
                'label' => 'Local-first with cloud summaries',
                'provider_mode' => 'local_first',
                'allow_cloud' => true,
                'never_send_phi_to_cloud' => true,
            ],
            'cloud_first_phi_block' => [
                'label' => 'Cloud-first with PHI block',
                'provider_mode' => 'cloud_first',
                'allow_cloud' => true,
                'never_send_phi_to_cloud' => true,
            ],
            'byo_api_key' => [
                'label' => 'BYO API key',
                'provider_mode' => 'cloud_first',
                'allow_cloud' => true,
                'never_send_phi_to_cloud' => true,
                'entitlement' => 'user_api_key',
            ],
            'external_assistant_tools_only' => [
                'label' => 'External assistant tools only',
                'provider_mode' => 'disabled',
                'allow_cloud' => false,
                'never_send_phi_to_cloud' => true,
                'note' => 'Backend Abby disabled; external assistant uses approved read-only tools (not backend quota).',
            ],
            'agents_read_only_local' => [
                'label' => 'Agents read-only local',
                'provider_mode' => 'local_only',
                'allow_cloud' => false,
                'never_send_phi_to_cloud' => true,
                'surface' => 'study_agent',
            ],
            'agents_cloud_with_approvals' => [
                'label' => 'Agents cloud with approvals',
                'provider_mode' => 'cloud_first',
                'allow_cloud' => true,
                'never_send_phi_to_cloud' => true,
                'surface' => 'study_agent',
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function payloadForProfile(AbbyProviderProfile $profile, string $mode): array
    {
        $providerSettings = $this->providerSettingsForProfile($profile);
        $limits = $profile->limits ?? [];
        $baseUrl = $profile->base_url
            ?: ($providerSettings['base_url'] ?? null)
            ?: self::OPENAI_COMPATIBLE_BASE_URLS[strtolower($profile->provider_type)] ?? null;

        return [
            'provider_type' => strtolower($profile->provider_type),
            'profile_id' => $profile->profile_id,
            'mode' => $mode,
            'model' => $profile->model,
            'entitlement' => $profile->entitlement_type,
            'settings' => $this->onlyNonEmpty([
                'api_key' => $providerSettings['api_key'] ?? null,
                'base_url' => $baseUrl,
                'timeout' => $limits['timeout'] ?? $limits['timeout_seconds'] ?? $providerSettings['timeout'] ?? null,
                'max_output_tokens' => $limits['max_output_tokens'] ?? $providerSettings['max_output_tokens'] ?? null,
                'monthly_budget_usd' => $limits['monthly_budget_usd'] ?? $providerSettings['monthly_budget_usd'] ?? null,
                'entitlement' => $profile->entitlement_type,
            ]),
        ];
    }

    /**
     * @param  array<string, mixed>  $request
     * @return array<string, mixed>
     */
    public function simulateRoute(array $request): array
    {
        $surface = (string) ($request['surface'] ?? 'chat');
        $message = (string) ($request['message'] ?? '');
        $policy = AbbySurfacePolicy::where('surface', $surface)->first();

        if ($policy === null) {
            return [
                'configured' => false,
                'surface' => $surface,
                'reason' => 'surface_policy_missing',
                'will_call_paid_provider' => false,
                'blocked_reasons' => ['surface_policy_missing'],
            ];
        }

        if ($policy->provider_mode === 'disabled') {
            return [
                'configured' => true,
                'surface' => $surface,
                'provider_mode' => $policy->provider_mode,
                'reason' => 'provider_disabled',
                'will_call_paid_provider' => false,
                'blocked_reasons' => ['provider_disabled'],
            ];
        }

        $profile = AbbyProviderProfile::where('profile_id', (string) $policy->default_profile_id)->first();
        $blockedReasons = $profile === null
            ? ['default_profile_missing']
            : $this->validateProfileForSurface($profile, $policy);
        $selectedProfile = $profile;
        $fallbackUsed = false;

        if ($blockedReasons !== []) {
            foreach (($policy->fallback_profile_ids ?? []) as $profileId) {
                $candidate = AbbyProviderProfile::where('profile_id', $profileId)->first();
                if ($candidate !== null && $this->validateProfileForSurface($candidate, $policy) === []) {
                    $selectedProfile = $candidate;
                    $fallbackUsed = true;
                    break;
                }
            }
        }

        return [
            'configured' => true,
            'surface' => $surface,
            'provider_mode' => $policy->provider_mode,
            'message_length' => strlen($message),
            'requested_profile_id' => $policy->default_profile_id,
            'selected_profile' => $selectedProfile?->only([
                'profile_id',
                'display_name',
                'provider_type',
                'transport',
                'entitlement_type',
                'model',
                'is_enabled',
            ]),
            'fallback_profile_ids' => $policy->fallback_profile_ids ?? [],
            'fallback_used' => $fallbackUsed,
            'reason' => $blockedReasons === [] ? $policy->provider_mode : $blockedReasons[0],
            'blocked_reasons' => $blockedReasons,
            'will_call_paid_provider' => $selectedProfile !== null
                && $this->isCloudProfile($selectedProfile)
                && $blockedReasons === [],
            'estimated_budget_impact' => $selectedProfile !== null && $this->isCloudProfile($selectedProfile)
                ? 'unknown_until_provider_response'
                : 'zero_api_cost',
        ];
    }

    public function isCloudProfile(AbbyProviderProfile $profile): bool
    {
        return $profile->entitlement_type !== 'local' && $profile->transport !== 'ollama_chat';
    }

    /**
     * @return array<int, array{surface: string, role: string, index?: int}>
     */
    public function profilePolicyReferences(string $profileId): array
    {
        return AbbySurfacePolicy::query()
            ->orderBy('surface')
            ->get()
            ->flatMap(function (AbbySurfacePolicy $policy) use ($profileId): array {
                $references = [];

                if ($policy->default_profile_id === $profileId) {
                    $references[] = [
                        'surface' => $policy->surface,
                        'role' => 'default_profile_id',
                    ];
                }

                foreach (($policy->fallback_profile_ids ?? []) as $index => $fallbackProfileId) {
                    if ((string) $fallbackProfileId === $profileId) {
                        $references[] = [
                            'surface' => $policy->surface,
                            'role' => 'fallback_profile_ids',
                            'index' => $index,
                        ];
                    }
                }

                return $references;
            })
            ->values()
            ->all();
    }

    public function profileIsReferenced(string $profileId): bool
    {
        return $this->profilePolicyReferences($profileId) !== [];
    }

    private function tablesExist(): bool
    {
        return Schema::hasTable('abby_provider_profiles') && Schema::hasTable('abby_surface_policies');
    }

    /**
     * @return array<string, mixed>
     */
    private function providerSettingsForProfile(AbbyProviderProfile $profile): array
    {
        $providerType = $profile->provider_setting_type ?: $profile->provider_type;
        $provider = AiProviderSetting::where('provider_type', $providerType)
            ->where('is_enabled', true)
            ->first();

        return $provider?->settings ?? [];
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function onlyNonEmpty(array $values): array
    {
        return array_filter(
            $values,
            fn ($value): bool => $value !== null && $value !== '',
        );
    }

    /**
     * @param  array<int, string>  $errors
     *
     * @throws ValidationException
     */
    public function throwIfErrors(array $errors, string $key = 'policy'): void
    {
        if ($errors !== []) {
            throw ValidationException::withMessages([$key => $errors]);
        }
    }
}
