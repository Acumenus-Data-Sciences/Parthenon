<?php

declare(strict_types=1);

namespace App\Policies\FinnGen;

use App\Models\App\FinnGen\Run;
use App\Models\User;

class RunPolicy
{
    /**
     * Admins + super-admins see everything. Everyone else sees only their own
     * runs.
     */
    public function view(User $user, Run $run): bool
    {
        if ($user->hasAnyRole(['admin', 'super-admin'])) {
            return true;
        }

        return $run->user_id === $user->id;
    }

    /**
     * Owner must also have analyses.run permission (HIGHSEC §4.1.2).
     */
    public function cancel(User $user, Run $run): bool
    {
        return $run->user_id === $user->id && $user->can('analyses.run');
    }

    public function pin(User $user, Run $run): bool
    {
        return $run->user_id === $user->id;
    }
}
