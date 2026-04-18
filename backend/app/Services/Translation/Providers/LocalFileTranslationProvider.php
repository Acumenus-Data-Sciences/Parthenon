<?php

declare(strict_types=1);

namespace App\Services\Translation\Providers;

use App\Contracts\TranslationProviderInterface;
use App\DataTransferObjects\TranslationBatchRequest;
use App\DataTransferObjects\TranslationBatchResult;
use App\DataTransferObjects\TranslationReviewRequest;
use App\DataTransferObjects\TranslationReviewResult;
use App\Enums\TranslationDataClass;
use App\Services\Translation\PlaceholderIntegrityService;
use App\Support\ParthenonLocales;

final class LocalFileTranslationProvider implements TranslationProviderInterface
{
    public function __construct(
        private readonly PlaceholderIntegrityService $placeholderIntegrity,
    ) {}

    public function translateBatch(TranslationBatchRequest $request): TranslationBatchResult
    {
        $items = [];
        $warnings = [];

        foreach ($request->items as $item) {
            $targetText = $item->targetText ?: $item->sourceText;
            $status = $item->targetText ? 'reviewed_target' : 'source_fallback';

            if (! $item->targetText) {
                $warnings[] = "{$item->key} used source fallback for {$request->targetLocale}.";
            }

            $items[] = [
                'key' => $item->key,
                'source_text' => $item->sourceText,
                'target_text' => $targetText,
                'status' => $status,
                'metadata' => $item->metadata,
            ];
        }

        return new TranslationBatchResult(
            provider: 'local',
            sourceLocale: $request->sourceLocale,
            targetLocale: $request->targetLocale,
            items: $items,
            warnings: $warnings,
        );
    }

    public function reviewBatch(TranslationReviewRequest $request): TranslationReviewResult
    {
        $items = [];
        $warnings = [];

        foreach ($request->items as $item) {
            if (! $item->targetText) {
                $warnings[] = "{$item->key} has no target text for {$request->targetLocale}.";
            }

            $violations = $item->targetText
                ? $this->placeholderIntegrity->violations($item->sourceText, $item->targetText)
                : [[
                    'type' => 'missing-target',
                    'missing' => [$request->targetLocale],
                    'extra' => [],
                ]];

            $items[] = [
                'key' => $item->key,
                'passed' => $violations === [],
                'violations' => $violations,
            ];
        }

        return new TranslationReviewResult(
            provider: 'local',
            sourceLocale: $request->sourceLocale,
            targetLocale: $request->targetLocale,
            items: $items,
            warnings: $warnings,
        );
    }

    public function supportsLocale(string $source, string $target): bool
    {
        return ParthenonLocales::normalize($source) !== null
            && ParthenonLocales::normalize($target) !== null;
    }

    public function supportsDataClass(TranslationDataClass $class): bool
    {
        if ($class === TranslationDataClass::Phi) {
            return (bool) config('translation.allow_phi', false);
        }

        return in_array($class->value, (array) config('translation.allowed_data_classes', []), true);
    }
}
