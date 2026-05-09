<?php

namespace App\Tenancy\Concerns;

use App\Contracts\TenantResolverInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * Eloquent model trait — auto-fills tenant_id from the resolver on create
 * and registers the TenantScope global scope so queries are tenant-scoped.
 *
 * `withoutGlobalScope(TenantScope::class)` bypasses the filter for admin
 * tooling and cross-tenant migrations. The scope keys off the resolver's
 * `currentId()`, so swapping the resolver (CE SingleTenantResolver →
 * EE MultiTenantResolver) changes scoping behavior automatically.
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope);

        static::creating(function (Model $model) {
            if ($model->tenant_id === null) {
                $model->tenant_id = app(TenantResolverInterface::class)->currentId();
            }
        });
    }
}
