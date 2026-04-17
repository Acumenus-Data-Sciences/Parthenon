<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Enums\CoverageProfile;

/**
 * Phase 13 — pure-function classifier mapping resolver output to CoverageProfile.
 *
 * Inputs are the standard FinnGenConceptResolver return shape per vocab:
 *   ['standard' => list<int>, 'source' => list<int>, 'truncated' => bool]
 *
 * Classification rules (locked by ADR-002):
 *   - FINLAND_ONLY — every group has standard === [] (no portable resolution)
 *   - UNIVERSAL    — every group has standard !== [] (everything resolves on a non-Finnish CDM)
 *   - PARTIAL      — at least one group resolves, at least one does not
 *
 * Truncation rule (ADR-002 Rule 2): a group with `truncated === true` and
 * `standard` of length MAX_RESOLVED still counts as RESOLVED. The cap is a
 * display protection, not a resolution failure. Only `standard !== []` matters.
 *
 * No database access. No I/O. Importer (Plan 06) calls this once per endpoint row
 * after the 7 resolver invocations.
 */
final class FinnGenCoverageProfileClassifier
{
    /**
     * @param  array{standard: list<int>, source: list<int>, truncated: bool}  $icd10
     * @param  array{standard: list<int>, source: list<int>, truncated: bool}  $icd9
     * @param  array{standard: list<int>, source: list<int>, truncated: bool}  $atc
     * @param  array{standard: list<int>, source: list<int>, truncated: bool}  $icd8
     * @param  array{standard: list<int>, source: list<int>, truncated: bool}  $icdO3
     * @param  array{standard: list<int>, source: list<int>, truncated: bool}  $nomesco
     * @param  array{standard: list<int>, source: list<int>, truncated: bool}  $kelaReimb
     */
    public static function classify(
        array $icd10,
        array $icd9,
        array $atc,
        array $icd8,
        array $icdO3,
        array $nomesco,
        array $kelaReimb,
    ): CoverageProfile {
        $groups = [
            'icd10' => $icd10['standard'] !== [],
            'icd9' => $icd9['standard'] !== [],
            'atc' => $atc['standard'] !== [],
            'icd8' => $icd8['standard'] !== [],
            'icdO3' => $icdO3['standard'] !== [],
            'nomesco' => $nomesco['standard'] !== [],
            'kelaReimb' => $kelaReimb['standard'] !== [],
        ];

        $hasResolved = in_array(true, $groups, strict: true);
        if (! $hasResolved) {
            return CoverageProfile::FINLAND_ONLY;
        }

        $allResolved = ! in_array(false, $groups, strict: true);
        if ($allResolved) {
            return CoverageProfile::UNIVERSAL;
        }

        return CoverageProfile::PARTIAL;
    }
}
