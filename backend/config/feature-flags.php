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
        // CE ships zero static entries here. The runtime `ai.agents` flag is
        // emitted by FeatureFlagResolver directly from the `system_settings` DB
        // row (key: agents.enabled) so super-admins can toggle it without a
        // redeploy. EE bundles may append entries via their own published
        // config or by binding their own FeatureFlagResolver subclass.
    ],
];
