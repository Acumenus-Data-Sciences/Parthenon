<?php

namespace App\Services\Auth\Oidc;

final readonly class ValidatedClaims
{
    /**
     * @param  list<string>  $groups
     */
    public function __construct(
        public string $sub,
        public string $email,
        public string $name,
        public array $groups,
    ) {}
}
