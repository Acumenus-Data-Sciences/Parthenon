<?php

namespace Tests\Feature\Auth;

use App\Auth\Drivers\AuthDriverResult;
use App\Contracts\AuthDriverInterface;
use App\Models\User;

/**
 * Test fixture: an alternate driver. Proves that the registry can resolve
 * drivers other than the two CE defaults — i.e., the extension point
 * actually allows extension. Used by AuthDriverRegistryTest.
 */
class StubAuthDriver implements AuthDriverInterface
{
    public function name(): string
    {
        return 'stub-test-only';
    }

    public function isAvailable(): bool
    {
        return true;
    }

    public function authenticate(array $credentials): AuthDriverResult
    {
        return new AuthDriverResult(
            user: User::factory()->create(),
            driverName: $this->name(),
        );
    }
}
