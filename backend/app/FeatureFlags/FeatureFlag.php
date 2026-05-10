<?php

declare(strict_types=1);

namespace App\FeatureFlags;

use App\Http\Controllers\Api\V1\System\FeatureFlagsController;

/**
 * Immutable description of a single deployment-level feature flag.
 *
 * The {@see FeatureFlagResolver} composes a list of these from the
 * configured drivers + license + EE registrations. The
 * {@see FeatureFlagsController}
 * serializes the list and the frontend hydrates it into Zustand.
 */
final readonly class FeatureFlag
{
    /**
     * @param  string  $name  Dotted name, e.g. 'auth.saml', 'tenancy.multi'
     * @param  bool  $enabled  Whether the deployment exposes the capability
     * @param  string  $source  'ce' | 'ee' | 'config' | 'license' — diagnostic only
     * @param  string|null  $description  Human-readable hint for admin UIs
     */
    public function __construct(
        public string $name,
        public bool $enabled,
        public string $source,
        public ?string $description = null,
    ) {}

    /**
     * @return array{name: string, enabled: bool, source: string, description: string|null}
     */
    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'enabled' => $this->enabled,
            'source' => $this->source,
            'description' => $this->description,
        ];
    }
}
