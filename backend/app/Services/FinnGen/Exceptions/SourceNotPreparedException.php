<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Exceptions;

use App\Services\FinnGen\GwasRunService;
use RuntimeException;

/**
 * Thrown by {@see GwasRunService} when a GWAS
 * dispatch targets a source that has no row in
 * `app.finngen_source_variant_indexes`. The source must be prepared
 * via `php artisan finngen:prepare-source-variants --source=X` first.
 *
 * Phase 15 (GENOMICS-03) will map this to HTTP 422 in the public
 * dispatch route. Phase 14's smoke-test command surfaces it directly.
 */
final class SourceNotPreparedException extends RuntimeException
{
    public function __construct(
        public readonly string $sourceKey,
        string $message = '',
    ) {
        parent::__construct($message !== '' ? $message : sprintf(
            "Source '%s' has no variant index; run 'php artisan finngen:prepare-source-variants --source=%s' first",
            $sourceKey,
            strtoupper($sourceKey),
        ));
    }
}
