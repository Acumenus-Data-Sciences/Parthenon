<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Dto;

/**
 * Mutable running report collected during a FinnGenEndpointImporter::import()
 * call. Populated row-by-row; serialized to the per-release coverage JSON
 * file at end of run.
 */
final class ImportReport
{
    public int $total = 0;

    public int $imported = 0;

    public int $skipped = 0;

    /**
     * Endpoint counts per coverage bucket.
     *
     * @var array<string, int>
     */
    public array $coverage = [
        'FULLY_MAPPED' => 0,
        'PARTIAL' => 0,
        'SPARSE' => 0,
        'UNMAPPED' => 0,
        'CONTROL_ONLY' => 0,
    ];

    /**
     * Counts of unmapped source-code tokens, keyed by source_vocab.
     *
     * @var array<string, int>
     */
    public array $topUnmappedVocabularies = [];

    public string $reportPath = '';

    /**
     * Phase 13 — endpoint counts per portability classification. Keyed by
     * the lowercase CoverageProfile enum value ('universal' | 'partial' |
     * 'finland_only'). Populated by FinnGenEndpointImporter::processRow via
     * FinnGenCoverageProfileClassifier.
     *
     * @var array<string, int>
     */
    public array $coverageProfile = [
        'universal' => 0,
        'partial' => 0,
        'finland_only' => 0,
    ];

    /**
     * Phase 13 — count of rows where the classifier produced
     * coverage_bucket=UNMAPPED AND coverage_profile=UNIVERSAL (D-07
     * invariant). Should be zero after a clean re-import; CoverageInvariantTest
     * asserts this post-condition at the DB level.
     */
    public int $invariantViolations = 0;

    /**
     * Phase 13 — row count in finngen.endpoint_expressions_pre_phase13
     * after the pre-overwrite snapshot. Null when --overwrite was not passed.
     */
    public ?int $snapshotRowCount = null;
}
