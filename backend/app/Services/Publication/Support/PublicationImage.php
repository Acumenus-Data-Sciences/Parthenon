<?php

namespace App\Services\Publication\Support;

final class PublicationImage
{
    public static function decodePngDataUrl(string $dataUrl): ?string
    {
        if ($dataUrl === '') {
            return null;
        }

        if (! preg_match('/^data:image\/png(?:;charset=[^;]+)?;base64,([A-Za-z0-9+\/=\s]+)$/', $dataUrl, $matches)) {
            return null;
        }

        $encoded = preg_replace('/\s+/', '', $matches[1]);
        if (! is_string($encoded) || $encoded === '') {
            return null;
        }

        $bytes = base64_decode($encoded, true);
        if (! is_string($bytes) || ! str_starts_with($bytes, "\x89PNG\r\n\x1A\n")) {
            return null;
        }

        $imageInfo = @getimagesizefromstring($bytes);
        if ($imageInfo === false || ($imageInfo['mime'] ?? '') !== 'image/png') {
            return null;
        }

        return $bytes;
    }

    public static function normalizePngDataUrl(string $dataUrl): ?string
    {
        $bytes = self::decodePngDataUrl($dataUrl);
        if ($bytes === null) {
            return null;
        }

        return 'data:image/png;base64,'.base64_encode($bytes);
    }
}
