<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Exceptions;

use RuntimeException;

final class ControlCohortNotPreparedException extends RuntimeException
{
    public function __construct(
        public readonly int $controlCohortId,
        public readonly string $sourceKey,
        string $message = '',
    ) {
        parent::__construct(
            $message !== ''
                ? $message
                : "Control cohort #{$controlCohortId} has no generation against source '{$sourceKey}'."
        );
    }
}
