<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

/**
 * Expands the Finnish-style regex-like code patterns used in the FinnGen
 * curated endpoint library. The file uses a tiny dialect:
 *
 *   - pipe-alternation:  I21|I22                  → ['I21','I22']
 *   - char-class:        F3[2-3]                  → ['F32','F33']
 *   - combined:          I21|F3[2-3]              → ['I21','F32','F33']
 *   - literal-with-suffix: 4019X                   → ['4019X']   (no expansion)
 *   - empty / null     →                          → []
 *
 * Anything outside these three forms is treated as a literal token. The
 * ICD-9 trailing-letter stripping that Finnish sub-codes require ("4019X"
 * → "4019" / "401.9") is NOT done here — that's the resolver's concern.
 */
final class FinnGenPatternExpander
{
    /**
     * @return list<string>
     */
    public static function expand(?string $raw): array
    {
        if ($raw === null) {
            return [];
        }
        $raw = trim($raw);
        if ($raw === '') {
            return [];
        }

        $out = [];
        foreach (explode('|', $raw) as $tok) {
            $tok = trim($tok);
            if ($tok === '') {
                continue;
            }
            // Char-class [m-n] expansion — single digit range only, which is
            // the only form observed in the upstream file.
            if (preg_match('/^(.*?)\[(\d)-(\d)\](.*)$/', $tok, $m)) {
                $lo = (int) $m[2];
                $hi = (int) $m[3];
                if ($lo <= $hi) {
                    for ($i = $lo; $i <= $hi; $i++) {
                        $out[] = $m[1].$i.$m[4];
                    }
                }

                continue;
            }
            $out[] = $tok;
        }

        return array_values(array_unique($out));
    }
}
