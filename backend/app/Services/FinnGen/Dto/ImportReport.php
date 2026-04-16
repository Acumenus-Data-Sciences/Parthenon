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
}
