<?php

namespace App\Policies\Concerns;

use App\Enums\LibraryStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

trait AuthorizesLibraryLifecycle
{
    public function promote(User $user, Model $item): bool
    {
        return $this->isOwner($user, $item) || $user->hasRole('super-admin');
    }

    public function archive(User $user, Model $item): bool
    {
        return $this->isOwner($user, $item) || $user->hasRole('super-admin');
    }

    public function restoreLifecycle(User $user, Model $item): bool
    {
        return $this->isOwner($user, $item) || $user->hasRole('super-admin');
    }

    public function hardDelete(User $user, Model $item): bool
    {
        if (! $user->hasRole('super-admin')) {
            return false;
        }

        $status = $item->status;
        $value = $status instanceof LibraryStatus ? $status : LibraryStatus::tryFrom((string) $status);

        return $value === LibraryStatus::ARCHIVED;
    }

    private function isOwner(User $user, Model $item): bool
    {
        return (int) $item->author_id === (int) $user->id;
    }
}
