<?php

namespace App\Crypto;

use RuntimeException;
use Throwable;

class CryptoException extends RuntimeException
{
    public const CODE_INVALID_CIPHERTEXT = 1;

    public const CODE_TAMPERED = 2;

    public const CODE_PROVIDER_UNAVAILABLE = 3;

    public function __construct(
        string $message,
        int $code,
        public readonly string $providerName,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $code, $previous);
    }
}
