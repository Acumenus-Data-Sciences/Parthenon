<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Exceptions;

use RuntimeException;

final class RunInFlightException extends RuntimeException
{
    public function __construct(
        public readonly string $existingRunId,
        public readonly int $existingTrackingId,
        string $message = '',
    ) {
        parent::__construct(
            $message !== ''
                ? $message
                : "A GWAS run for this (endpoint, source, control, covariates) is still in flight (tracking #{$existingTrackingId}). Wait for completion or cancel the existing run."
        );
    }
}
