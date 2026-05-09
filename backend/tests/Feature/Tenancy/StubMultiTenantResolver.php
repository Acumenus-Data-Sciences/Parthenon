<?php

namespace Tests\Feature\Tenancy;

use App\Contracts\TenantResolverInterface;
use App\Tenancy\Tenant;

/**
 * Test fixture: an alternate resolver that resolves tenant by an
 * X-Tenant-Slug request header.
 *
 * Demonstrates the contract that EE's MultiTenantResolver fulfills —
 * proving the TenantResolverInterface extension point actually allows
 * EE to plug in a custom resolver without patching CE.
 */
class StubMultiTenantResolver implements TenantResolverInterface
{
    private ?Tenant $current = null;

    public function current(): Tenant
    {
        if ($this->current !== null) {
            return $this->current;
        }

        $headerSlug = request()?->header('X-Tenant-Slug') ?? 'default';

        return $this->current = Tenant::where('slug', $headerSlug)->firstOrFail();
    }

    public function currentId(): int
    {
        return $this->current()->id;
    }

    public function setCurrent(Tenant $tenant): void
    {
        $this->current = $tenant;
    }

    public function clear(): void
    {
        $this->current = null;
    }

    /** R2: serialize tenant slug for queue payload restoration. */
    public function snapshot(): array
    {
        return ['slug' => $this->current()->slug];
    }

    public function restore(array $snap): void
    {
        if (isset($snap['slug']) && is_string($snap['slug'])) {
            $this->current = Tenant::where('slug', $snap['slug'])->first();
        }
    }
}
