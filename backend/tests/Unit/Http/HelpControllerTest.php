<?php

use App\Http\Controllers\Api\V1\HelpController;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

uses(TestCase::class);

afterEach(function () {
    App::setLocale('en');
    Config::set('parthenon-locales.current', 'en-US');
});

it('returns localized help content when a locale file exists', function () {
    App::setLocale('es');
    Config::set('parthenon-locales.current', 'es-ES');

    $response = (new HelpController)->help('dashboard');
    $data = $response->getData(true);

    expect($response->getStatusCode())->toBe(200);
    expect($data['title'])->toBe('Panel');
    expect($data['locale'])->toBe('es-ES');
    expect($data['requested_locale'])->toBe('es-ES');
    expect($data['fallback_used'])->toBeFalse();
});

it('returns Korean help content when a locale file exists', function () {
    App::setLocale('ko');
    Config::set('parthenon-locales.current', 'ko-KR');

    $response = (new HelpController)->help('dashboard');
    $data = $response->getData(true);

    expect($response->getStatusCode())->toBe(200);
    expect($data['title'])->toBe('대시보드');
    expect($data['locale'])->toBe('ko-KR');
    expect($data['requested_locale'])->toBe('ko-KR');
    expect($data['fallback_used'])->toBeFalse();
});

it('falls back to legacy English help content when locale content is missing', function () {
    App::setLocale('ko');
    Config::set('parthenon-locales.current', 'ko-KR');

    $response = (new HelpController)->help('administration');
    $data = $response->getData(true);

    expect($response->getStatusCode())->toBe(200);
    expect($data['title'])->toBe('Administration');
    expect($data['locale'])->toBe('en-US');
    expect($data['requested_locale'])->toBe('ko-KR');
    expect($data['fallback_used'])->toBeTrue();
});

it('returns localized not found messages for missing help topics', function () {
    App::setLocale('es');
    Config::set('parthenon-locales.current', 'es-ES');

    $response = (new HelpController)->help('does-not-exist');
    $data = $response->getData(true);

    expect($response->getStatusCode())->toBe(404);
    expect($data['message'])->toBe('Tema de ayuda no encontrado.');
    expect($data['message_key'])->toBe('help.not_found');
    expect($data['message_meta']['requested_locale'])->toBe('es-ES');
    expect($data['message_meta']['message_locale'])->toBe('es-ES');
    expect($data['message_meta']['fallback_used'])->toBeFalse();
});
