<?php

declare(strict_types=1);

namespace App\DataTransferObjects;

final class TranslationReviewResult
{
    /**
     * @param  list<array{key: string, passed: bool, violations: list<array<string, mixed>>}>  $items
     * @param  list<string>  $warnings
     */
    public function __construct(
        public readonly string $provider,
        public readonly string $sourceLocale,
        public readonly string $targetLocale,
        public readonly array $items,
        public readonly array $warnings = [],
    ) {}

    public function passed(): bool
    {
        foreach ($this->items as $item) {
            if (! $item['passed']) {
                return false;
            }
        }

        return true;
    }
}
