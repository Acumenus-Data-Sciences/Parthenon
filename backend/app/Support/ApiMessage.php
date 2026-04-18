<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Facades\Lang;

final class ApiMessage
{
    /**
     * Build a stable API message envelope.
     *
     * Existing clients can keep reading `message`; newer clients can use
     * `message_key` and `message_meta` for local rendering and fallback QA.
     *
     * @param  array<string, string|int|float>  $replace
     * @return array<string, mixed>
     */
    public static function payload(string $key, array $replace = [], mixed $locale = null): array
    {
        $requestedLocale = ParthenonLocales::normalize($locale)
            ?? ParthenonLocales::normalize(config('parthenon-locales.current'))
            ?? ParthenonLocales::default();

        $laravelLocale = ParthenonLocales::laravelLocale($requestedLocale);
        $fallbackLocale = ParthenonLocales::default();
        $fallbackLaravelLocale = ParthenonLocales::laravelLocale($fallbackLocale);

        $hasRequestedTranslation = Lang::hasForLocale($key, $laravelLocale);
        $hasFallbackTranslation = Lang::hasForLocale($key, $fallbackLaravelLocale);
        $messageLocale = $hasRequestedTranslation
            ? $requestedLocale
            : ($hasFallbackTranslation ? $fallbackLocale : null);

        $payload = [
            'message' => __($key, $replace, $laravelLocale),
            'message_key' => $key,
            'message_meta' => [
                'requested_locale' => $requestedLocale,
                'message_locale' => $messageLocale,
                'fallback_locale' => $fallbackLocale,
                'fallback_used' => ! $hasRequestedTranslation,
                'translation_missing' => ! $hasRequestedTranslation && ! $hasFallbackTranslation,
            ],
        ];

        if ($replace !== []) {
            $payload['message_params'] = $replace;
        }

        return $payload;
    }
}
