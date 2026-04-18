<?php

declare(strict_types=1);

namespace App\Contracts;

use App\DataTransferObjects\TranslationBatchRequest;
use App\DataTransferObjects\TranslationBatchResult;
use App\DataTransferObjects\TranslationReviewRequest;
use App\DataTransferObjects\TranslationReviewResult;
use App\Enums\TranslationDataClass;

interface TranslationProviderInterface
{
    public function translateBatch(TranslationBatchRequest $request): TranslationBatchResult;

    public function reviewBatch(TranslationReviewRequest $request): TranslationReviewResult;

    public function supportsLocale(string $source, string $target): bool;

    public function supportsDataClass(TranslationDataClass $class): bool;
}
