<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Exceptions;

use RuntimeException;

final class SourceNotFoundException extends RuntimeException
{
    public function __construct(
        public readonly string $sourceKey,
        string $message = '',
    ) {
        parent::__construct(
            $message !== ''
                ? $message
                : "Source '{$sourceKey}' not found in app.sources."
        );
    }
}
