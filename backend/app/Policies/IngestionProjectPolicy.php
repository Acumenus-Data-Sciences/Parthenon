<?php

namespace App\Policies;

use App\Models\App\IngestionProject;
use App\Models\User;

class IngestionProjectPolicy
{
    public function view(User $user, IngestionProject $project): bool
    {
        return $user->id === $project->created_by || $user->hasRole(['admin', 'super-admin']);
    }

    public function update(User $user, IngestionProject $project): bool
    {
        return $user->id === $project->created_by || $user->hasRole(['admin', 'super-admin']);
    }

    public function delete(User $user, IngestionProject $project): bool
    {
        return $user->id === $project->created_by || $user->hasRole(['admin', 'super-admin']);
    }
}
