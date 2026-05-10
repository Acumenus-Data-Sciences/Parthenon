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
        // Example (commented):
        // 'audit.signed' => [
        //     'enabled' => false,
        //     'source'  => 'ce',
        //     'description' => 'Signed (HMAC) audit chain shipped to WORM storage.',
        // ],
    ],
];
