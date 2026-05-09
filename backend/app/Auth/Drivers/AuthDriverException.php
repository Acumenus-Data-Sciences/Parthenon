<?php

namespace App\Auth\Drivers;

use Exception;
use Throwable;

class AuthDriverException extends Exception
{
    public const CODE_INVALID_CREDENTIALS = 401;

    public const CODE_ACCOUNT_DISABLED = 403;

    public const CODE_MALFORMED_CREDENTIALS = 422;

    public const CODE_PROVIDER_UNREACHABLE = 500;

    public function __construct(
        string $message,
        int $code,
        public readonly string $driverName,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $code, $previous);
    }
}
