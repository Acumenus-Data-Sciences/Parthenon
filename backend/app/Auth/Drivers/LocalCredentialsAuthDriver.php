<?php

namespace App\Auth\Drivers;

use App\Contracts\AuthDriverInterface;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class LocalCredentialsAuthDriver implements AuthDriverInterface
{
    public function name(): string
    {
        return 'local';
    }

    public function isAvailable(): bool
    {
        // Local credentials are always available — no external dependency.
        return true;
    }

    public function authenticate(array $credentials): AuthDriverResult
    {
        if (
            ! isset($credentials['email'], $credentials['password'])
            || ! is_string($credentials['email'])
            || ! is_string($credentials['password'])
        ) {
            throw new AuthDriverException(
                'Malformed credentials: expected string email and password',
                AuthDriverException::CODE_MALFORMED_CREDENTIALS,
                $this->name(),
            );
        }

        $email = strtolower(trim($credentials['email']));
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw new AuthDriverException(
                'Invalid credentials',
                AuthDriverException::CODE_INVALID_CREDENTIALS,
                $this->name(),
            );
        }

        return new AuthDriverResult(
            user: $user,
            driverName: $this->name(),
            mustChangePassword: (bool) $user->must_change_password,
        );
    }
}
