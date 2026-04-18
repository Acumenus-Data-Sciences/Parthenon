<?php

use App\Contracts\TranslationProviderInterface;
use App\DataTransferObjects\TranslationBatchItem;
use App\DataTransferObjects\TranslationBatchRequest;
use App\DataTransferObjects\TranslationReviewRequest;
use App\Enums\TranslationDataClass;
use App\Services\Translation\PlaceholderIntegrityService;
use App\Services\Translation\Providers\LocalFileTranslationProvider;
use App\Services\Translation\TranslationPolicyService;

it('resolves the configured local translation provider by contract', function () {
    expect(app(TranslationProviderInterface::class))
        ->toBeInstanceOf(LocalFileTranslationProvider::class);
});

it('uses reviewed target strings and marks source fallbacks', function () {
    $provider = app(TranslationProviderInterface::class);

    $result = $provider->translateBatch(new TranslationBatchRequest(
        sourceLocale: 'en-US',
        targetLocale: 'es-ES',
        dataClass: TranslationDataClass::ProductCopy,
        items: [
            new TranslationBatchItem('dashboard.title', 'Dashboard', 'Panel'),
            new TranslationBatchItem('dashboard.empty', 'No results'),
        ],
    ));

    expect($result->provider)->toBe('local')
        ->and($result->translatedTextFor('dashboard.title'))->toBe('Panel')
        ->and($result->translatedTextFor('dashboard.empty'))->toBe('No results')
        ->and($result->items[0]['status'])->toBe('reviewed_target')
        ->and($result->items[1]['status'])->toBe('source_fallback')
        ->and($result->warnings)->toHaveCount(1);
});

it('reviews placeholder and tag parity before import', function () {
    $provider = app(TranslationProviderInterface::class);

    $result = $provider->reviewBatch(new TranslationReviewRequest(
        sourceLocale: 'en-US',
        targetLocale: 'ko-KR',
        dataClass: TranslationDataClass::Documentation,
        items: [
            new TranslationBatchItem(
                'commons.message',
                'Review <strong>{{count}}</strong> messages by :date.',
                '<strong>{{count}}</strong>개의 메시지를 :date까지 검토하세요.',
            ),
            new TranslationBatchItem(
                'commons.broken',
                'Review <strong>{{count}}</strong> messages by :date.',
                '{{count}}개의 메시지를 검토하세요.',
            ),
        ],
    ));

    expect($result->passed())->toBeFalse()
        ->and($result->items[0]['passed'])->toBeTrue()
        ->and($result->items[1]['passed'])->toBeFalse()
        ->and($result->items[1]['violations'])->toHaveCount(2);
});

it('blocks phi translation by default while allowing class zero assets', function () {
    $provider = app(TranslationProviderInterface::class);
    $policy = app(TranslationPolicyService::class);

    expect($provider->supportsLocale('en-US', 'ko-KR'))->toBeTrue()
        ->and($provider->supportsLocale('en-US', 'tlh'))->toBeFalse()
        ->and($policy->allowsProvider($provider, TranslationDataClass::ProductCopy))->toBeTrue()
        ->and($policy->allowsProvider($provider, TranslationDataClass::Documentation))->toBeTrue()
        ->and($policy->allowsProvider($provider, TranslationDataClass::UserGenerated))->toBeFalse()
        ->and($policy->allowsProvider($provider, TranslationDataClass::Phi))->toBeFalse();
});

it('exposes placeholder extraction for tooling parity', function () {
    $service = app(PlaceholderIntegrityService::class);

    expect($service->placeholders('Hello {{name}}, max :max, %s.'))
        ->toBe(['%s', ':max', '{{name}}'])
        ->and($service->violations('Hello {{name}}', 'Hola {{name}}'))
        ->toBe([]);
});
