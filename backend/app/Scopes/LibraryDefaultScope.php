<?php

namespace App\Scopes;

use App\Enums\LibraryStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

class LibraryDefaultScope implements Scope
{
    /**
     * @param  Builder<Model>  $builder
     */
    public function apply(Builder $builder, Model $model): void
    {
        $userId = Auth::id();
        $table = $model->getTable();

        $builder->where(function (Builder $q) use ($table, $userId) {
            $q->where("{$table}.status", LibraryStatus::ACTIVE->value);

            if ($userId !== null) {
                $q->orWhere(function (Builder $sub) use ($table, $userId) {
                    $sub->where("{$table}.status", LibraryStatus::DRAFT->value)
                        ->where("{$table}.author_id", $userId);
                });
            }
        });
    }

    public function extend(Builder $builder): void
    {
        $bypass = fn (Builder $b) => $b->withoutGlobalScope(self::class);

        $builder->macro('withAnyStatus', $bypass);
        $builder->macro('withArchived', $bypass);
        $builder->macro('withDrafts', $bypass);
        $builder->macro('asSuperUser', $bypass);
    }
}
