<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Exceptions;

use App\Services\FinnGen\GwasRunService;
use RuntimeException;

/**
 * Thrown by {@see GwasRunService}::dispatchStep2
 * when the regenie step-1 LOCO artifact for the computed cache_key is
 * not present on the `finngen-artifacts` volume. The step-1 run must
 * complete first (D-03 — explicit two-call contract; no auto-step-1).
 *
 * Phase 15 (GENOMICS-03) will map this to HTTP 422.
 */
final class Step1ArtifactMissingException extends RuntimeException
{
    public function __construct(
        public readonly string $cacheKey,
        string $message = '',
    ) {
        parent::__construct($message !== '' ? $message : sprintf(
            'regenie step-1 artifact missing for cache_key %s; run finngen.gwas.regenie.step1 first',
            $cacheKey,
        ));
    }
}
