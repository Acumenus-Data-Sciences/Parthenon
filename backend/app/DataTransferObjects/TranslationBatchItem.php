<?php

declare(strict_types=1);

namespace App\DataTransferObjects;

final class TranslationBatchItem
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public readonly string $key,
        public readonly string $sourceText,
        public readonly ?string $targetText = null,
        public readonly array $metadata = [],
    ) {}
}
