<?php

declare(strict_types=1);

namespace App\DataTransferObjects;

final class TranslationBatchResult
{
    /**
     * @param  list<array{key: string, source_text: string, target_text: string, status: string, metadata?: array<string, mixed>}>  $items
     * @param  list<string>  $warnings
     */
    public function __construct(
        public readonly string $provider,
        public readonly string $sourceLocale,
        public readonly string $targetLocale,
        public readonly array $items,
        public readonly array $warnings = [],
    ) {}

    public function translatedTextFor(string $key): ?string
    {
        foreach ($this->items as $item) {
            if ($item['key'] === $key) {
                return $item['target_text'];
            }
        }

        return null;
    }
}
