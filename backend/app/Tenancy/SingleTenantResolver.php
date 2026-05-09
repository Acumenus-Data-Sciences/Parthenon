<?php

namespace App\Tenancy;

use App\Contracts\TenantResolverInterface;

/**
 * Community Edition default tenant resolver — always returns Tenant#1.
 *
 * Single-tenant deployments use this; behavior is byte-identical to
 * pre-tenancy Parthenon because Tenant#1 is auto-seeded and every
 * tenant-scoped table defaults to tenant_id = 1.
 *
 * EE replaces this binding with MultiTenantResolver via TENANCY_RESOLVER
 * env or its own service provider.
 */
class SingleTenantResolver implements TenantResolverInterface
{
    private ?Tenant $current = null;

    public function current(): Tenant
    {
        return $this->current ??= Tenant::default();
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

    /** R2: queued-job lifecycle — single tenant always resolves to id=1; nothing to snapshot. */
    public function snapshot(): array
    {
        return [];
    }

    public function restore(array $snap): void
    {
        // no-op: SingleTenantResolver always resolves to Tenant#1
    }
}
