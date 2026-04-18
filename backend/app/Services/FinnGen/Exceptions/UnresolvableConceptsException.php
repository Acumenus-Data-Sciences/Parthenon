<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Exceptions;

use RuntimeException;

final class UnresolvableConceptsException extends RuntimeException
{
    public function __construct(
        public readonly string $coverageBucket,
        string $message = '',
    ) {
        parent::__construct(
            $message !== ''
                ? $message
                : "Endpoint has unresolvable concepts (coverage: {$coverageBucket}). Cannot dispatch GWAS."
        );
    }
}
