<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Per-deployment explicit flags
    |--------------------------------------------------------------------------
    |
    | Keyed by flag name. Each entry can set { enabled, source, description }.
    | EE bundles append entries via their own published config or via a
    | container override on App\FeatureFlags\FeatureFlagResolver.
    |
    | CE ships ZERO entries here — every deployment-level flag is implied by
    | what drivers/resolvers are bound. EE's EnterpriseFeatureFlagsProvider
    | populates this list (or returns its own resolver) when the EE overlay
    | is installed.
    */
    'flags' => [
        // AI publication copilot (Claude Agent SDK) on the Publish page. Ships
        // dark: default OFF. Enable per-deployment with PUBLISH_AGENT_ENABLED=true
        // once the Anthropic account behind ANTHROPIC_API_KEY is credited.
        'publish.agent' => [
            'enabled' => (bool) env('PUBLISH_AGENT_ENABLED', false),
            'source' => 'config',
            'description' => 'AI publication copilot (Claude Agent SDK) on the Publish page.',
        ],
    ],
];
