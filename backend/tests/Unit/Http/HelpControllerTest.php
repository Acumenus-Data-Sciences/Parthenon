<?php

use App\Http\Controllers\Api\V1\HelpController;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\File;
use PHPUnit\Framework\Assert;
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
    App::setLocale('fr');
    Config::set('parthenon-locales.current', 'fr-FR');

    $response = (new HelpController)->help('dashboard');
    $data = $response->getData(true);

    expect($response->getStatusCode())->toBe(200);
    expect($data['title'])->toBe('Dashboard');
    expect($data['locale'])->toBe('en-US');
    expect($data['requested_locale'])->toBe('fr-FR');
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

it('has pilot locale help content for every English help topic', function () {
    $helpPath = resource_path('help');
    $sourceTopics = collect(File::files($helpPath))
        ->filter(fn (SplFileInfo $file): bool => $file->getExtension() === 'json')
        ->map(fn (SplFileInfo $file): string => $file->getFilename())
        ->sort()
        ->values();

    expect($sourceTopics)->not->toBeEmpty();

    foreach (['es-ES', 'ko-KR'] as $locale) {
        $localePath = $helpPath.DIRECTORY_SEPARATOR.$locale;
        $missingTopics = $sourceTopics
            ->reject(fn (string $topic): bool => File::exists($localePath.DIRECTORY_SEPARATOR.$topic))
            ->values()
            ->all();

        Assert::assertSame(
            [],
            $missingTopics,
            "{$locale} missing localized help topic(s): ".implode(', ', $missingTopics),
        );

        foreach ($sourceTopics as $topic) {
            $source = json_decode(File::get($helpPath.DIRECTORY_SEPARATOR.$topic), true);
            $target = json_decode(File::get($localePath.DIRECTORY_SEPARATOR.$topic), true);

            Assert::assertSame(
                $source['key'] ?? null,
                $target['key'] ?? null,
                "{$locale}/{$topic} must keep the same help key as the English source.",
            );
        }
    }
});
