<?php

namespace App\Concerns;

use App\Enums\LibraryStatus;
use App\Models\User;
use App\Scopes\LibraryDefaultScope;
use Illuminate\Database\Eloquent\Builder;

trait HasLibraryLifecycle
{
    public static function bootHasLibraryLifecycle(): void
    {
        static::addGlobalScope(new LibraryDefaultScope);
    }

    public function initializeHasLibraryLifecycle(): void
    {
        $this->mergeCasts([
            'status' => LibraryStatus::class,
            'archived_at' => 'datetime',
            'promoted_at' => 'datetime',
        ]);
    }

    public function promote(User $actor): static
    {
        if ($this->status === LibraryStatus::ACTIVE) {
            return $this;
        }

        $this->status = LibraryStatus::ACTIVE;

        if ($this->promoted_at === null) {
            $this->promoted_at = now();
        }

        $this->archived_at = null;
        $this->archived_by = null;
        $this->save();

        return $this;
    }

    public function archive(User $actor): static
    {
        if ($this->status === LibraryStatus::ARCHIVED) {
            return $this;
        }

        $this->status = LibraryStatus::ARCHIVED;
        $this->archived_at = now();
        $this->archived_by = $actor->id;
        $this->save();

        return $this;
    }

    public function restore_lifecycle(User $actor): static
    {
        if ($this->status !== LibraryStatus::ARCHIVED) {
            return $this;
        }

        $this->status = LibraryStatus::ACTIVE;
        $this->archived_at = null;
        $this->archived_by = null;
        $this->save();

        return $this;
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where($this->getTable().'.status', LibraryStatus::ACTIVE->value);
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeDraft(Builder $query): Builder
    {
        return $query->where($this->getTable().'.status', LibraryStatus::DRAFT->value);
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeArchived(Builder $query): Builder
    {
        return $query->where($this->getTable().'.status', LibraryStatus::ARCHIVED->value);
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeOwnedBy(Builder $query, User $user): Builder
    {
        return $query->where($this->getTable().'.author_id', $user->id);
    }
}
