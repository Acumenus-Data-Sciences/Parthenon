<?php

declare(strict_types=1);

namespace App\DataTransferObjects;

use App\Enums\TranslationDataClass;

final class TranslationReviewRequest
{
    /**
     * @param  list<TranslationBatchItem>  $items
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public readonly string $sourceLocale,
        public readonly string $targetLocale,
        public readonly TranslationDataClass $dataClass,
        public readonly array $items,
        public readonly array $metadata = [],
    ) {}
}
