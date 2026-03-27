<?php

namespace App\Exceptions;

use RuntimeException;

class AiProviderRequestException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $provider = '',
        public readonly int $httpStatus = 0,
    ) {
        parent::__construct($message);
    }
}
