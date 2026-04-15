<?php

namespace App\Services\Auth\Oidc\Exceptions;

use RuntimeException;

class OidcException extends RuntimeException
{
    public function __construct(
        public readonly string $reason,
        string $message = '',
        ?\Throwable $previous = null
    ) {
        parent::__construct($message !== '' ? $message : $reason, 0, $previous);
    }
}
