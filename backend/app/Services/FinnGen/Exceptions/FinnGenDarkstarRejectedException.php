<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Exceptions;

class FinnGenDarkstarRejectedException extends \RuntimeException
{
    /** @param array<string, mixed>|null $darkstarError */
    public function __construct(
        string $message,
        public readonly ?array $darkstarError = null,
        public readonly int $status = 400,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }
}
