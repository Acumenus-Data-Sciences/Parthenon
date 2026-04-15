<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Exceptions;

class FinnGenDarkstarMalformedResponseException extends \RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $rawBody = '',
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }
}
