<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Exceptions;

use RuntimeException;

final class CovariateSetNotFoundException extends RuntimeException
{
    public function __construct(
        public readonly int $covariateSetId,
        string $message = '',
    ) {
        parent::__construct(
            $message !== ''
                ? $message
                : "Covariate set #{$covariateSetId} not found in finngen.gwas_covariate_sets."
        );
    }
}
