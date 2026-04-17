<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use Illuminate\Support\Facades\DB;

/**
 * Resolves FinnGen source codes (ICD-10, Finnish ICD-9, ATC, ICD-8, ICDO3,
 * NOMESCO, KELA_REIMB) to OMOP standard concept IDs.
 *
 * Phase 13 standard-first resolver:
 * 1. STCM lookup against vocab.source_to_concept_map (curated FinnGen cross-walk)
 *    runs FIRST for every method.
 * 2. Where the source vocabulary also exists in vocab.concept (ICD10CM, ICD9CM, ATC),
 *    resolveLikeAny runs as a fallback and its results are merged with STCM.
 * 3. Where the source vocabulary is NOT in vocab.concept (ICD-8, ICDO3, NOMESCO,
 *    KELA_REIMB, ICD-10-FI extensions), STCM is the ONLY path.
 *
 * Returned `standard` and `source` arrays are bounded at MAX_RESOLVED IDs each.
 * Public method signatures are stable across the Phase 13 upgrade — callers
 * (FinnGenEndpointImporter, R worker payload builders) do not need to change.
 *
 * Per ADR-001: all STCM SQL fully qualifies vocab.source_to_concept_map.
 * Per RESEARCH §Pitfall 2: resolveLikeAny filters invalid_reason IS NULL on
 * both the standard concept and the relationship row.
 */
class FinnGenConceptResolver
{
    /** @var int Maximum number of concept_ids returned per vocab category. */
    public const MAX_RESOLVED = 500;

    /**
     * ICD-10 → standard. STCM-first against ICD10_FIN extensions, then
     * existing LIKE-ANY against ICD10CM in vocab.concept. Results merged.
     *
     * @param  list<string>  $patterns
     * @return array{standard: list<int>, source: list<int>, truncated: bool}
     */
    public function resolveIcd10(array $patterns): array
    {
        $prefixes = [];
        foreach ($this->sanitize($patterns) as $p) {
            $prefixes[] = $p;
            if (strlen($p) >= 4 && ! str_contains($p, '.')) {
                $prefixes[] = substr($p, 0, 3).'.'.substr($p, 3);
            }
        }
        $prefixes = array_values(array_unique($prefixes));
        if ($prefixes === []) {
            return ['standard' => [], 'source' => [], 'truncated' => false];
        }

        // STCM-first: ICD-10-FI extensions cross-walked to ICD-10-CM / SNOMED.
        $stcmStandard = $this->resolveViaStcm('ICD10_FIN', $prefixes);

        // Fallback: LIKE-ANY against ICD10CM in vocab.concept.
        $likeAny = $this->resolveLikeAny('ICD10CM', $prefixes);

        return $this->mergeStcmWithLikeAny($stcmStandard, $likeAny);
    }

    /**
     * Finnish ICD-9 → standard. STCM-first against ICD9_FIN, then LIKE-ANY
     * against ICD9CM with trailing-letter stripping.
     *
     * @param  list<string>  $patterns
     * @return array{standard: list<int>, source: list<int>, truncated: bool}
     */
    public function resolveIcd9(array $patterns): array
    {
        $prefixes = [];
        foreach ($this->sanitize($patterns) as $p) {
            $stripped = preg_replace('/[A-Za-z]+$/', '', $p) ?? $p;
            if ($stripped === '') {
                continue;
            }
            $prefixes[] = $stripped;
            if (ctype_digit($stripped) && strlen($stripped) >= 4) {
                $dotted = substr($stripped, 0, 3).'.'.substr($stripped, 3);
                $prefixes[] = $dotted;
            }
        }
        $prefixes = array_values(array_unique($prefixes));
        if ($prefixes === []) {
            return ['standard' => [], 'source' => [], 'truncated' => false];
        }

        // STCM-first: Finnish ICD-9 extensions cross-walked to ICD-10-CM.
        $stcmStandard = $this->resolveViaStcm('ICD9_FIN', $prefixes);

        // Fallback: LIKE-ANY against ICD9CM.
        $likeAny = $this->resolveLikeAny('ICD9CM', $prefixes);

        return $this->mergeStcmWithLikeAny($stcmStandard, $likeAny);
    }

    /**
     * ATC → RxNorm + ATC sources. STCM-first against KELA_REIMB-mapped ATC,
     * then LIKE-ANY against ATC in vocab.concept.
     *
     * @param  list<string>  $patterns
     * @return array{standard: list<int>, source: list<int>, truncated: bool}
     */
    public function resolveAtc(array $patterns): array
    {
        $prefixes = $this->sanitize($patterns);
        if ($prefixes === []) {
            return ['standard' => [], 'source' => [], 'truncated' => false];
        }

        // No STCM path for ATC itself (KELA_REIMB → ATC is a different method).
        return $this->resolveLikeAny('ATC', $prefixes);
    }

    /**
     * ICD-8 → standard via STCM only. ICD-8 is NOT in vocab.concept, so
     * the cross-walk is the only resolution path.
     *
     * @param  list<string>  $patterns
     * @return array{standard: list<int>, source: list<int>, truncated: bool}
     */
    public function resolveIcd8(array $patterns): array
    {
        $prefixes = $this->sanitize($patterns);
        if ($prefixes === []) {
            return ['standard' => [], 'source' => [], 'truncated' => false];
        }

        $stcm = $this->resolveViaStcm('ICD8', $prefixes);
        $truncated = count($stcm) > self::MAX_RESOLVED;

        return [
            'standard' => array_slice($stcm, 0, self::MAX_RESOLVED),
            'source' => [],
            'truncated' => $truncated,
        ];
    }

    /**
     * ICDO3 → SNOMED Procedure / Neoplasm via STCM. ICDO3 is NOT loaded as
     * a vocab.vocabulary; cross-walk rows in vocab.source_to_concept_map
     * carry source_vocabulary_id='ICDO3' as free-form TEXT.
     *
     * @param  list<string>  $patterns
     * @return array{standard: list<int>, source: list<int>, truncated: bool}
     */
    public function resolveIcdO3(array $patterns): array
    {
        $prefixes = $this->sanitize($patterns);
        if ($prefixes === []) {
            return ['standard' => [], 'source' => [], 'truncated' => false];
        }

        $stcm = $this->resolveViaStcm('ICDO3', $prefixes);
        $truncated = count($stcm) > self::MAX_RESOLVED;

        return [
            'standard' => array_slice($stcm, 0, self::MAX_RESOLVED),
            'source' => [],
            'truncated' => $truncated,
        ];
    }

    /**
     * NOMESCO surgical procedure code → SNOMED Procedure via STCM.
     *
     * @param  list<string>  $patterns
     * @return array{standard: list<int>, source: list<int>, truncated: bool}
     */
    public function resolveNomesco(array $patterns): array
    {
        $prefixes = $this->sanitize($patterns);
        if ($prefixes === []) {
            return ['standard' => [], 'source' => [], 'truncated' => false];
        }

        $stcm = $this->resolveViaStcm('NOMESCO', $prefixes);
        $truncated = count($stcm) > self::MAX_RESOLVED;

        return [
            'standard' => array_slice($stcm, 0, self::MAX_RESOLVED),
            'source' => [],
            'truncated' => $truncated,
        ];
    }

    /**
     * KELA reimbursement category → ATC drug class via STCM.
     *
     * @param  list<string>  $patterns
     * @return array{standard: list<int>, source: list<int>, truncated: bool}
     */
    public function resolveKelaReimb(array $patterns): array
    {
        $prefixes = $this->sanitize($patterns);
        if ($prefixes === []) {
            return ['standard' => [], 'source' => [], 'truncated' => false];
        }

        $stcm = $this->resolveViaStcm('KELA_REIMB', $prefixes);
        $truncated = count($stcm) > self::MAX_RESOLVED;

        return [
            'standard' => array_slice($stcm, 0, self::MAX_RESOLVED),
            'source' => [],
            'truncated' => $truncated,
        ];
    }

    /**
     * STCM lookup: query vocab.source_to_concept_map for matching standard
     * target_concept_ids. Per ADR-001 the table is fully qualified.
     *
     * @param  list<string>  $prefixes  already sanitized
     * @return list<int> standard target_concept_ids (deduped, NOT yet capped)
     */
    private function resolveViaStcm(string $sourceVocab, array $prefixes): array
    {
        if ($prefixes === []) {
            return [];
        }
        $like = array_map(static fn (string $p): string => $p.'%', $prefixes);
        $arrayLiteral = '{'.implode(',', $like).'}';

        $rows = DB::connection('vocab')->select(
            'SELECT DISTINCT stcm.target_concept_id
               FROM vocab.source_to_concept_map stcm
              WHERE stcm.source_vocabulary_id = ?
                AND stcm.source_code LIKE ANY(?::text[])
                AND stcm.invalid_reason IS NULL
                AND stcm.target_concept_id <> 0',
            [$sourceVocab, $arrayLiteral]
        );

        $standard = [];
        foreach ($rows as $row) {
            $standard[(int) $row->target_concept_id] = true;
        }

        return array_keys($standard);
    }

    /**
     * Central LIKE-ANY query on vocab.concept with Maps-to traversal.
     * Per RESEARCH §Pitfall 2 — adds invalid_reason IS NULL guards on
     * both the standard concept and the relationship row.
     *
     * @param  list<string>  $prefixes  already sanitized
     * @return array{standard: list<int>, source: list<int>, truncated: bool}
     */
    private function resolveLikeAny(string $vocab, array $prefixes): array
    {
        $like = array_map(static fn (string $p): string => $p.'%', $prefixes);
        $arrayLiteral = '{'.implode(',', $like).'}';

        $rows = DB::connection('vocab')->select(
            "SELECT DISTINCT src.concept_id AS source_id, cr.concept_id_2 AS standard_id
               FROM vocab.concept src
               LEFT JOIN vocab.concept_relationship cr
                 ON cr.concept_id_1 = src.concept_id
                AND cr.relationship_id = 'Maps to'
                AND cr.invalid_reason IS NULL
               LEFT JOIN vocab.concept std
                 ON std.concept_id = cr.concept_id_2
                AND std.standard_concept = 'S'
                AND std.invalid_reason IS NULL
              WHERE src.vocabulary_id = ?
                AND src.concept_code LIKE ANY(?::text[])
                AND src.invalid_reason IS NULL",
            [$vocab, $arrayLiteral]
        );

        $source = [];
        $standard = [];
        foreach ($rows as $row) {
            if ($row->source_id !== null) {
                $source[(int) $row->source_id] = true;
            }
            if ($row->standard_id !== null) {
                $standard[(int) $row->standard_id] = true;
            }
        }

        $source = array_keys($source);
        $standard = array_keys($standard);
        $truncated = false;
        if (count($standard) > self::MAX_RESOLVED) {
            $standard = array_slice($standard, 0, self::MAX_RESOLVED);
            $truncated = true;
        }
        if (count($source) > self::MAX_RESOLVED) {
            $source = array_slice($source, 0, self::MAX_RESOLVED);
            $truncated = true;
        }

        return ['standard' => $standard, 'source' => $source, 'truncated' => $truncated];
    }

    /**
     * Merge a STCM standard-id list with a resolveLikeAny result.
     *
     * @param  list<int>  $stcmStandard
     * @param  array{standard:list<int>,source:list<int>,truncated:bool}  $likeAny
     * @return array{standard:list<int>,source:list<int>,truncated:bool}
     */
    private function mergeStcmWithLikeAny(array $stcmStandard, array $likeAny): array
    {
        $merged = array_values(array_unique(array_merge($likeAny['standard'], $stcmStandard)));
        $truncated = $likeAny['truncated'] || count($merged) > self::MAX_RESOLVED;
        if (count($merged) > self::MAX_RESOLVED) {
            $merged = array_slice($merged, 0, self::MAX_RESOLVED);
        }

        return [
            'standard' => $merged,
            'source' => $likeAny['source'],
            'truncated' => $truncated,
        ];
    }

    /**
     * Reject tokens that aren't plausible source codes:
     *  - shorter than 2 chars
     *  - containing characters outside [A-Za-z0-9.\-_]
     *
     * @param  list<string>  $patterns
     * @return list<string>
     */
    private function sanitize(array $patterns): array
    {
        $out = [];
        foreach ($patterns as $p) {
            $p = trim($p);
            if (strlen($p) < 2) {
                continue;
            }
            if (preg_match('/^[A-Za-z0-9._\-]+$/', $p) === 1) {
                $out[] = $p;
            }
        }

        return array_values(array_unique($out));
    }
}
