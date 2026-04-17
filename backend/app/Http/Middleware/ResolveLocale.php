<?php

namespace App\Http\Middleware;

use App\Support\ParthenonLocales;
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
        $laravelLocale = ParthenonLocales::laravelLocale($locale);

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
        $userLocale = $request->user()?->locale;
        if ($locale = ParthenonLocales::normalize($userLocale)) {
            return $locale;
        }

        $explicitLocale = $request->headers->get('X-Parthenon-Locale')
            ?? $request->query('locale')
            ?? $request->query('lng');
        if ($locale = ParthenonLocales::normalize($explicitLocale)) {
            return $locale;
        }

        foreach ($request->getLanguages() as $acceptedLocale) {
            if ($locale = ParthenonLocales::normalize($acceptedLocale)) {
                return $locale;
            }
        }

        return ParthenonLocales::default();
    }
}
