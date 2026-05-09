<?php

namespace App\Tenancy\Concerns;

use App\Contracts\TenantResolverInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Eloquent global scope that filters queries to the current tenant.
 *
 * Applied via the BelongsToTenant trait. Use `withoutGlobalScope(TenantScope::class)`
 * for admin tooling that needs cross-tenant visibility.
 */
class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $resolver = app(TenantResolverInterface::class);
        $builder->where($model->getTable().'.tenant_id', $resolver->currentId());
    }
}
