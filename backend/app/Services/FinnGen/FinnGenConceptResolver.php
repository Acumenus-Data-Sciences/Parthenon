<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use Illuminate\Support\Facades\DB;

/**
 * Resolves FinnGen source codes (ICD-10, Finnish ICD-9, ATC, ICD-8) to
 * OMOP concept IDs by matching `concept_code LIKE ANY(?::text[])` against
 * vocab.concept and then traversing `Maps to` relationships to standard
 * concepts.
 *
 * All methods take an already-expanded list of token prefixes (produced by
 * FinnGenPatternExpander), NOT raw FinnGen pattern strings. Token
 * sanitization (reject non-alphanumeric/.-) happens here as a second
 * defense against SQL-pattern injection — the LIKE strings are bound as
 * text[] parameters so this is belt-and-suspenders.
 *
 * Returned `standard` and `source` arrays are bounded at 500 IDs each
 * (RESEARCH §7 Pitfall 5). A marker token ('truncated') is NOT part of
 * the array contract — caller inspects counts if needed.
 */
class FinnGenConceptResolver
{
    /** @var int Maximum number of concept_ids returned per vocab category. */
    public const MAX_RESOLVED = 500;

    /**
     * @param  list<string>  $patterns
     * @return array{standard: list<int>, source: list<int>, truncated: bool}
     */
    public function resolveIcd10(array $patterns): array
    {
        $prefixes = $this->sanitize($patterns);
        if ($prefixes === []) {
            return ['standard' => [], 'source' => [], 'truncated' => false];
        }

        return $this->resolveLikeAny('ICD10CM', $prefixes);
    }

    /**
     * Finnish ICD-9 uses trailing-letter suffixes (4019X, 4029A) that don't
     * exist in US ICD9CM. Strip any trailing [A-Z] before matching, and
     * also offer a dotted variant (4019 → 401.9) since ICD9CM stores
     * dotted codes.
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
            // Dotted variant: 4019 → 401.9 (3-digit base + decimal)
            if (ctype_digit($stripped) && strlen($stripped) >= 4) {
                $dotted = substr($stripped, 0, 3).'.'.substr($stripped, 3);
                $prefixes[] = $dotted;
            }
        }
        $prefixes = array_values(array_unique($prefixes));
        if ($prefixes === []) {
            return ['standard' => [], 'source' => [], 'truncated' => false];
        }

        return $this->resolveLikeAny('ICD9CM', $prefixes);
    }

    /**
     * ATC codes: map to RxNorm ingredients via 'Maps to'.  We also return
     * the ATC source concepts themselves since OMOP cohort queries often
     * join on either drug_concept_id (RxNorm) or drug_source_concept_id
     * (ATC).
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

        return $this->resolveLikeAny('ATC', $prefixes);
    }

    /**
     * ICD-8 is not loaded in vocab.concept — always returns empty arrays.
     * Caller is responsible for recording the unmapped codes in
     * app.finngen_unmapped_codes.
     *
     * @param  list<string>  $patterns
     * @return array{standard: list<int>, source: list<int>, truncated: bool}
     */
    public function resolveIcd8(array $patterns): array
    {
        return ['standard' => [], 'source' => [], 'truncated' => false];
    }

    /**
     * Central LIKE-ANY query on vocab.concept with Maps-to traversal.
     *
     * @param  list<string>  $prefixes  already sanitized
     * @return array{standard: list<int>, source: list<int>, truncated: bool}
     */
    private function resolveLikeAny(string $vocab, array $prefixes): array
    {
        $like = array_map(static fn (string $p): string => $p.'%', $prefixes);
        // Build PG text[] literal "{a,b,c}" — prefixes are sanitized alphanumeric/.- only.
        $arrayLiteral = '{'.implode(',', $like).'}';

        // Use the shared 'vocab' connection (search_path = vocab,omop,php). The
        // NoBareConnectionCallRule bans 'omop' here to force SourceAware, but
        // this import is vocab-global (no CDM source tied to it), so the
        // dedicated 'vocab' connection is the correct long-term entry point.
        $rows = DB::connection('vocab')->select(
            "SELECT DISTINCT src.concept_id AS source_id, cr.concept_id_2 AS standard_id
               FROM vocab.concept src
               LEFT JOIN vocab.concept_relationship cr
                 ON cr.concept_id_1 = src.concept_id
                AND cr.relationship_id = 'Maps to'
               LEFT JOIN vocab.concept std
                 ON std.concept_id = cr.concept_id_2
                AND std.standard_concept = 'S'
              WHERE src.vocabulary_id = ?
                AND src.concept_code LIKE ANY(?::text[])",
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
     * Reject tokens containing anything outside [A-Za-z0-9.\-_].
     *
     * @param  list<string>  $patterns
     * @return list<string>
     */
    private function sanitize(array $patterns): array
    {
        $out = [];
        foreach ($patterns as $p) {
            $p = trim($p);
            if ($p === '') {
                continue;
            }
            if (preg_match('/^[A-Za-z0-9._\-]+$/', $p) === 1) {
                $out[] = $p;
            }
        }

        return array_values(array_unique($out));
    }
}
