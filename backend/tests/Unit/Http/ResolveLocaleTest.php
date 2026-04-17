<?php

use App\Http\Middleware\ResolveLocale;
use App\Models\User;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

uses(TestCase::class);

function runParthenonResolveLocale(Request $request): Response
{
    return (new ResolveLocale)->handle($request, fn () => new Response('ok'));
}

it('resolves explicit locale headers', function () {
    $request = Request::create('/', 'GET', [], [], [], [
        'HTTP_X_PARTHENON_LOCALE' => 'pt-BR',
    ]);

    $response = runParthenonResolveLocale($request);

    expect($response->headers->get('X-Parthenon-Locale'))->toBe('pt-BR');
    expect($request->attributes->get('parthenon_locale'))->toBe('pt-BR');
    expect(app()->getLocale())->toBe('pt_BR');
});

it('prefers authenticated user locale over request headers', function () {
    $request = Request::create('/', 'GET', [], [], [], [
        'HTTP_X_PARTHENON_LOCALE' => 'fr-FR',
    ]);
    $request->setUserResolver(fn () => new User(['locale' => 'ko-KR']));

    $response = runParthenonResolveLocale($request);

    expect($response->headers->get('X-Parthenon-Locale'))->toBe('ko-KR');
    expect(app()->getLocale())->toBe('ko');
});

it('falls back from accept-language language tags to supported locales', function () {
    $request = Request::create('/', 'GET', [], [], [], [
        'HTTP_ACCEPT_LANGUAGE' => 'es;q=0.9,fr-FR;q=0.8',
    ]);

    $response = runParthenonResolveLocale($request);

    expect($response->headers->get('X-Parthenon-Locale'))->toBe('es-ES');
    expect(app()->getLocale())->toBe('es');
});

it('uses resolved locale for translated backend messages', function () {
    $request = Request::create('/', 'GET', [], [], [], [
        'HTTP_X_PARTHENON_LOCALE' => 'es-ES',
    ]);

    runParthenonResolveLocale($request);

    expect(__('profile.updated'))->toBe('Perfil actualizado correctamente');
});
