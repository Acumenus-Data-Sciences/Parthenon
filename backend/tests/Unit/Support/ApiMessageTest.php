<?php

use App\Support\ApiMessage;
use App\Support\ParthenonLocales;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

uses(TestCase::class);

it('adds stable message keys and locale metadata to localized API messages', function () {
    Config::set('parthenon-locales.current', 'es-ES');

    expect(ApiMessage::payload('profile.updated'))->toMatchArray([
        'message' => 'Perfil actualizado correctamente',
        'message_key' => 'profile.updated',
        'message_meta' => [
            'requested_locale' => 'es-ES',
            'message_locale' => 'es-ES',
            'fallback_locale' => 'en-US',
            'fallback_used' => false,
            'translation_missing' => false,
        ],
    ]);
});

it('records replacement params when a translated message uses placeholders', function () {
    Config::set('parthenon-locales.current', 'en-US');

    expect(ApiMessage::payload('validation.in', ['attribute' => 'locale']))
        ->toHaveKey('message_params')
        ->and(ApiMessage::payload('validation.in', ['attribute' => 'locale'])['message_params'])
        ->toBe(['attribute' => 'locale']);
});

it('reports fallback metadata when the requested locale does not have a message key', function () {
    Config::set('parthenon-locales.current', 'fr-FR');

    expect(ApiMessage::payload('finngen.errors.unknown'))->toMatchArray([
        'message' => 'The analysis failed for an unknown reason. See details below.',
        'message_key' => 'finngen.errors.unknown',
        'message_meta' => [
            'requested_locale' => 'fr-FR',
            'message_locale' => 'en-US',
            'fallback_locale' => 'en-US',
            'fallback_used' => true,
            'translation_missing' => false,
        ],
    ]);
});

it('has localized contract keys for every backend i18n locale', function () {
    foreach (ParthenonLocales::supported() as $locale) {
        foreach ([
            'auth.unauthenticated',
            'auth.forbidden',
            'help.not_found',
            'validation.failed',
            'study.created',
            'study.transitioned',
            'study.errors.invalid_status_transition',
        ] as $key) {
            expect(ApiMessage::payload($key, [], $locale)['message_meta']['translation_missing'])
                ->toBeFalse("Missing {$key} for {$locale}");
        }
    }
});
