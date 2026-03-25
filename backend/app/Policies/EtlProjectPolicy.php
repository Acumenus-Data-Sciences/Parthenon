<?php

namespace App\Policies;

use App\Models\App\EtlProject;
use App\Models\User;

class EtlProjectPolicy
{
    public function view(User $user, EtlProject $project): bool
    {
        return $user->id === $project->created_by
            || $user->hasRole(['admin', 'super-admin']);
    }

    public function update(User $user, EtlProject $project): bool
    {
        return $user->id === $project->created_by
            || $user->hasRole(['admin', 'super-admin']);
    }

    public function delete(User $user, EtlProject $project): bool
    {
        return $user->id === $project->created_by
            || $user->hasRole(['admin', 'super-admin']);
    }
}
