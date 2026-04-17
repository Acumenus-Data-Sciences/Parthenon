<?php

namespace App\Http\Middleware;

use Carbon\Carbon;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Config;
use Symfony\Component\HttpFoundation\Response;

class ResolveLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $locale = $this->resolveLocale($request);
        $metadata = $this->localeMetadata($locale);
        $laravelLocale = (string) ($metadata['laravel'] ?? $this->toLaravelLocale($locale));

        App::setLocale($laravelLocale);
        Carbon::setLocale($laravelLocale);
        Config::set('parthenon-locales.current', $locale);
        $request->attributes->set('parthenon_locale', $locale);

        /** @var Response $response */
        $response = $next($request);
        $response->headers->set('X-Parthenon-Locale', $locale);

        return $response;
    }

    private function resolveLocale(Request $request): string
    {
        $supported = $this->supportedLocales();

        $userLocale = $request->user()?->locale;
        if ($locale = $this->normalizeLocale($userLocale, $supported)) {
            return $locale;
        }

        $explicitLocale = $request->headers->get('X-Parthenon-Locale')
            ?? $request->query('locale')
            ?? $request->query('lng');
        if ($locale = $this->normalizeLocale($explicitLocale, $supported)) {
            return $locale;
        }

        foreach ($request->getLanguages() as $acceptedLocale) {
            if ($locale = $this->normalizeLocale($acceptedLocale, $supported)) {
                return $locale;
            }
        }

        return (string) config('parthenon-locales.default', 'en-US');
    }

    /**
     * @return array<int, string>
     */
    private function supportedLocales(): array
    {
        return array_keys((array) config('parthenon-locales.supported', []));
    }

    /**
     * @return array<string, mixed>
     */
    private function localeMetadata(string $locale): array
    {
        return (array) config("parthenon-locales.supported.{$locale}", []);
    }

    /**
     * @param  array<int, string>  $supported
     */
    private function normalizeLocale(mixed $locale, array $supported): ?string
    {
        if (! is_string($locale) || trim($locale) === '') {
            return null;
        }

        $candidate = str_replace('_', '-', trim($locale));
        $lookup = [];
        foreach ($supported as $supportedLocale) {
            $lookup[strtolower($supportedLocale)] = $supportedLocale;
        }

        $exact = $lookup[strtolower($candidate)] ?? null;
        if ($exact !== null) {
            return $exact;
        }

        $language = strtolower(strtok($candidate, '-') ?: $candidate);
        foreach ($supported as $supportedLocale) {
            $supportedLanguage = strtolower(strtok($supportedLocale, '-') ?: $supportedLocale);
            if ($language === $supportedLanguage) {
                return $supportedLocale;
            }
        }

        return null;
    }

    private function toLaravelLocale(string $locale): string
    {
        return str_replace('-', '_', $locale);
    }
}
