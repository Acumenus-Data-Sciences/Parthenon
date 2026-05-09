<?php

namespace App\Auth;

use App\Contracts\AuthDriverInterface;
use InvalidArgumentException;

/**
 * Resolves AuthDriverInterface instances by name.
 *
 * Drivers are registered at boot from config/auth-drivers.php by
 * AuthDriverServiceProvider. EE registers additional drivers
 * (KeycloakAuthDriver, SamlAuthDriver, ScimSyncAuthDriver) via its own
 * service provider.
 */
class AuthDriverRegistry
{
    /** @var array<string, AuthDriverInterface> */
    private array $drivers = [];

    public function register(AuthDriverInterface $driver): void
    {
        $this->drivers[$driver->name()] = $driver;
    }

    public function driver(string $name): AuthDriverInterface
    {
        if (! isset($this->drivers[$name])) {
            throw new InvalidArgumentException(
                "Unknown auth driver: '{$name}'. Registered drivers: ".
                (empty($this->drivers) ? '(none)' : implode(', ', $this->names()))
            );
        }

        return $this->drivers[$name];
    }

    /** @return array<int, string> */
    public function names(): array
    {
        return array_keys($this->drivers);
    }

    /** @return array<int, string> Names of drivers reporting isAvailable() === true */
    public function availableNames(): array
    {
        return array_values(array_filter(
            $this->names(),
            fn (string $name) => $this->drivers[$name]->isAvailable(),
        ));
    }
}
