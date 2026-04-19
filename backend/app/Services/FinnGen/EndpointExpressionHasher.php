<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

/**
 * Phase 18 D-10 per
 * .planning/phases/18-risteys-style-endpoint-dashboard/18-CONTEXT.md.
 *
 * Produces a stable SHA-256 hex digest of an endpoint's resolved expression
 * JSON. The digest is stored on each cached profile row and the drawer read
 * path returns status=needs_compute whenever cached_hash != current_hash, so
 * the cache invalidates automatically on real expression change.
 *
 * Stability contract (asserted by EndpointExpressionHasherTest):
 *   - Key order: recursive ksort on associative arrays; list order preserved
 *   - Whitespace / escape drift: JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
 *   - Integer vs float: 1234.0 → 1234 when the float is integral (|v|<PHP_INT_MAX)
 *
 * Pitfall 4 mitigation (hash stability): if canonicalization slips, every
 * endpoint re-import invalidates the cache and costs ~15 s of Darkstar CPU per
 * drawer open. The three test cases below pin the three drift vectors we've
 * seen in Phase 14 GwasCacheKeyHasher precedent.
 */
final class EndpointExpressionHasher
{
    /**
     * @param  array<mixed>  $expression
     */
    public function hash(array $expression): string
    {
        $canonical = $this->canonicalize($expression);
        $json = json_encode(
            $canonical,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        );

        return hash('sha256', $json);
    }

    /**
     * Recursively canonicalize a decoded JSON value:
     *   - Associative arrays: ksort (list order preserved)
     *   - Integral floats: cast to int
     *   - Other scalars: pass through
     *
     * @param  mixed  $value
     * @return mixed
     */
    private function canonicalize($value)
    {
        if (is_array($value)) {
            $isList = array_is_list($value);
            if (! $isList) {
                ksort($value);
            }

            return array_map(fn ($v) => $this->canonicalize($v), $value);
        }

        if (is_float($value) && floor($value) === $value && abs($value) < PHP_INT_MAX) {
            return (int) $value;
        }

        return $value;
    }
}
