<?php

namespace App\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * No-op stub. Full default-scope behavior is wired in Task A7.
 */
class LibraryDefaultScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        // Intentionally empty — Task A7 wires the default visibility rules.
    }
}
