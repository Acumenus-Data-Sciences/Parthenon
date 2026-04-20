<?php

use App\Support\ParthenonLocales;
use Tests\TestCase;

uses(TestCase::class);

it('normalizes exact, case-insensitive, underscore, and language-only locale values', function () {
    expect(ParthenonLocales::normalize('es-ES'))->toBe('es-ES')
        ->and(ParthenonLocales::normalize('KO-kr'))->toBe('ko-KR')
        ->and(ParthenonLocales::normalize('pt_br'))->toBe('pt-BR')
        ->and(ParthenonLocales::normalize('ko'))->toBe('ko-KR')
        ->and(ParthenonLocales::normalize('tlh'))->toBeNull()
        ->and(ParthenonLocales::normalizeOrDefault('tlh'))->toBe('en-US');
});

it('publishes the initial rollout metadata contract', function () {
    expect(ParthenonLocales::metadata('es-ES'))->toMatchArray([
        'laravel' => 'es',
        'docusaurus' => 'es',
        'release_tier' => 'tier-a-pilot',
        'direction' => 'ltr',
    ])->and(ParthenonLocales::metadata('ko-KR'))->toMatchArray([
        'laravel' => 'ko',
        'docusaurus' => 'ko',
        'release_tier' => 'tier-a-candidate',
        'direction' => 'ltr',
    ])->and(ParthenonLocales::metadata('ar'))->toMatchArray([
        'laravel' => 'ar',
        'docusaurus' => 'ar',
        'release_tier' => 'rtl-canary',
        'direction' => 'rtl',
    ])->and(ParthenonLocales::metadata('en-XA'))->toMatchArray([
        'laravel' => 'en',
        'docusaurus' => 'en',
        'release_tier' => 'qa',
        'selectable' => false,
        'qa_only' => true,
    ]);
});

it('limits persisted user-selectable locales to completed public app locales', function () {
    expect(ParthenonLocales::normalizeSelectable('en'))->toBe('en-US')
        ->and(ParthenonLocales::normalizeSelectable('es'))->toBe('es-ES')
        ->and(ParthenonLocales::normalizeSelectable('fr'))->toBe('fr-FR')
        ->and(ParthenonLocales::normalizeSelectable('de'))->toBe('de-DE')
        ->and(ParthenonLocales::normalizeSelectable('pt'))->toBe('pt-BR')
        ->and(ParthenonLocales::normalizeSelectable('ko'))->toBe('ko-KR')
        ->and(ParthenonLocales::normalizeSelectable('ar'))->toBeNull()
        ->and(ParthenonLocales::normalizeSelectable('fi'))->toBeNull()
        ->and(ParthenonLocales::normalizeSelectable('en-XA'))->toBeNull();
});

it('keeps every supported locale enabled with formatting and fallback metadata', function () {
    foreach (ParthenonLocales::supported() as $locale) {
        $metadata = ParthenonLocales::metadata($locale);

        expect($metadata)
            ->toHaveKeys([
                'label',
                'native_label',
                'direction',
                'laravel',
                'docusaurus',
                'date_locale',
                'number_locale',
                'fallbacks',
                'release_tier',
                'enabled',
                'selectable',
            ])
            ->and($metadata['enabled'])->toBeTrue()
            ->and($metadata['fallbacks'])->not->toBeEmpty();
    }
});
