<?php

namespace App\Support\Hashing;

/**
 * Computes stable, content-addressable SHA-256 fingerprints of OMOP definition
 * expressions (concept-set items, cohort expressions, analysis designs, study
 * packages).
 *
 * Hashing is canonicalized so semantically identical definitions hash
 * identically regardless of key ordering: associative arrays are recursively
 * key-sorted, while lists preserve their order (order is meaningful in OHDSI
 * criteria lists). The result is a reliable provenance fingerprint that detects
 * silent post-hoc mutation.
 */
class DefinitionHasher
{
    /**
     * @param  array<mixed>|null  $expression
     */
    public function hashExpression(?array $expression): string
    {
        $canonical = $this->canonicalize($expression ?? []);
        $json = json_encode($canonical, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return hash('sha256', $json === false ? '[]' : $json);
    }

    /**
     * Recursively key-sort associative arrays; preserve list order.
     */
    private function canonicalize(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $isList = array_is_list($value);

        $result = [];
        foreach ($value as $key => $item) {
            $result[$key] = $this->canonicalize($item);
        }

        if (! $isList) {
            ksort($result);
        }

        return $result;
    }
}
