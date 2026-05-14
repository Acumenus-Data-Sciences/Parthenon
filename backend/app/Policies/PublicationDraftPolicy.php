<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\App\PublicationDraft;
use App\Models\App\Study;
use App\Models\User;

class PublicationDraftPolicy
{
    public function view(User $user, PublicationDraft $draft): bool
    {
        if ((int) $draft->user_id === (int) $user->id) {
            return true;
        }

        if ($draft->visibility !== 'study' || $draft->study_id === null) {
            return false;
        }

        return Study::query()
            ->accessibleBy((int) $user->id)
            ->whereKey($draft->study_id)
            ->exists();
    }

    public function update(User $user, PublicationDraft $draft): bool
    {
        if ((int) $draft->user_id === (int) $user->id) {
            return true;
        }

        if (! $this->view($user, $draft)) {
            return false;
        }

        return $user->can('studies.edit');
    }

    public function delete(User $user, PublicationDraft $draft): bool
    {
        return (int) $draft->user_id === (int) $user->id;
    }

    public function share(User $user, PublicationDraft $draft): bool
    {
        return (int) $draft->user_id === (int) $user->id;
    }
}
