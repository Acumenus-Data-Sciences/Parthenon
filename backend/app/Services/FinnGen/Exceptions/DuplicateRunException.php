<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Exceptions;

use RuntimeException;

final class DuplicateRunException extends RuntimeException
{
    public function __construct(
        public readonly string $existingRunId,
        public readonly int $existingTrackingId,
        string $message = '',
    ) {
        parent::__construct(
            $message !== ''
                ? $message
                : 'A GWAS run already succeeded for this (endpoint, source, control, covariates). Set overwrite=true to re-run.'
        );
    }
}
