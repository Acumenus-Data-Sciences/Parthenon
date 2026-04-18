<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Exceptions;

use RuntimeException;

final class EndpointNotMaterializedException extends RuntimeException
{
    public function __construct(
        public readonly string $endpointName,
        public readonly string $sourceKey,
        string $message = '',
    ) {
        parent::__construct(
            $message !== ''
                ? $message
                : "Endpoint '{$endpointName}' has not been materialized against source '{$sourceKey}' — generate it first."
        );
    }
}
