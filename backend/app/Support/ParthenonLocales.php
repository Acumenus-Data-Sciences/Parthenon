<?php

declare(strict_types=1);

namespace App\Support;

final class ParthenonLocales
{
    public static function default(): string
    {
        return (string) config('parthenon-locales.default', 'en-US');
    }

    /**
     * @return array<int, string>
     */
    public static function supported(): array
    {
        $supported = (array) config('parthenon-locales.supported', []);

        return array_values(array_filter(
            array_keys($supported),
            fn (string $locale): bool => (bool) ($supported[$locale]['enabled'] ?? true),
        ));
    }

    /**
     * @return array<string, mixed>
     */
    public static function metadata(string $locale): array
    {
        return (array) config("parthenon-locales.supported.{$locale}", []);
    }

    public static function normalize(mixed $locale): ?string
    {
        if (! is_string($locale) || trim($locale) === '') {
            return null;
        }

        $candidate = str_replace('_', '-', trim($locale));
        $supported = self::supported();
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

    public static function normalizeOrDefault(mixed $locale): string
    {
        return self::normalize($locale) ?? self::default();
    }

    public static function laravelLocale(string $locale): string
    {
        $metadata = self::metadata($locale);

        return (string) ($metadata['laravel'] ?? str_replace('-', '_', $locale));
    }

    public static function direction(string $locale): string
    {
        $metadata = self::metadata($locale);

        return (string) ($metadata['direction'] ?? 'ltr');
    }

    public static function isSelectable(string $locale): bool
    {
        $metadata = self::metadata($locale);

        return (bool) ($metadata['selectable'] ?? false);
    }

    public static function normalizeSelectable(mixed $locale): ?string
    {
        $normalized = self::normalize($locale);
        if ($normalized === null || ! self::isSelectable($normalized)) {
            return null;
        }

        return $normalized;
    }
}
