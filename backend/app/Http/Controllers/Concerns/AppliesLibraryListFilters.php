<?php

namespace App\Http\Controllers\Concerns;

use App\Scopes\LibraryDefaultScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

trait AppliesLibraryListFilters
{
    /**
     * Apply lifecycle status filter and super-admin `?scope=all` override to a list query.
     *
     * Behavior:
     * - `?scope=all` is honored only for super-admins; otherwise it is silently ignored.
     * - Active tab (default) shows everyone's active items via the global scope.
     * - Drafts/Archived/All tabs are scoped to the current user's items unless the caller
     *   is a super-admin with `?scope=all`, in which case all owners' items are returned.
     *
     * @param  Builder<*>  $query
     * @return Builder<*>
     */
    protected function applyLibraryListFilters(Builder $query, Request $request): Builder
    {
        $user = $request->user();
        $isSuper = $user?->hasRole('super-admin') ?? false;
        $scopeAll = $isSuper && $request->input('scope') === 'all';
        $status = (string) $request->input('status', 'active');

        if ($scopeAll) {
            $query->withoutGlobalScope(LibraryDefaultScope::class);

            return match ($status) {
                'draft' => $query->where('status', 'draft'),
                'archived' => $query->where('status', 'archived'),
                'all' => $query,
                default => $query->where('status', 'active'),
            };
        }

        $userId = $user?->id;

        return match ($status) {
            'draft' => $query->withoutGlobalScope(LibraryDefaultScope::class)
                ->where('status', 'draft')
                ->when($userId !== null, fn (Builder $q) => $q->where('author_id', $userId)),
            'archived' => $query->withoutGlobalScope(LibraryDefaultScope::class)
                ->where('status', 'archived')
                ->when($userId !== null, fn (Builder $q) => $q->where('author_id', $userId)),
            'all' => $query->withoutGlobalScope(LibraryDefaultScope::class)
                ->when($userId !== null, fn (Builder $q) => $q->where('author_id', $userId)),
            default => $query, // 'active' uses default global scope
        };
    }
}
