<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 13 — seed FinnGen-curated cross-walk into vocab.source_to_concept_map.
 *
 * Per ADR-001: target schema is `vocab.source_to_concept_map` (not omop.*).
 * Per ADR-002 Rule 3: ICDO3 source codes are allowed even though no
 * vocab.vocabulary row exists (column is free-form TEXT).
 * Per HIGHSEC §4.1: explicit GRANT to parthenon_app inside pg_roles guard.
 *
 * Idempotent: DELETE rows where source_vocabulary_id IN (...6 FinnGen vocabs...),
 * then re-INSERT from CSVs. IRSF-NHS rows are NOT touched.
 *
 * Source CSVs live in `backend/database/fixtures/finngen/crosswalk/`. Comment
 * lines (starting with `#`) are skipped. Header line is detected by literal
 * match on `source_code,source_concept_id,...`.
 */
return new class extends Migration
{
    private const FINNGEN_OWNED_VOCABS = [
        'ICD8',
        'ICD9_FIN',
        'ICD10_FIN',
        'NOMESCO',
        'KELA_REIMB',
        'ICDO3',
    ];

    private const FIXTURE_DIR = 'database/fixtures/finngen/crosswalk';

    private const CSV_FILES = [
        'icd8_to_icd10cm.csv',
        'icd9_fin_to_icd10cm.csv',
        'icd10_fin_to_icd10cm.csv',
        'nomesco_to_snomed.csv',
        'kela_reimb_to_atc.csv',
        'icdo3_to_snomed.csv',
    ];

    public function up(): void
    {
        $crosswalkPath = base_path(self::FIXTURE_DIR);

        DB::connection('vocab')->transaction(function () use ($crosswalkPath): void {
            // Step 1 — purge FinnGen-owned vocab rows. IRSF-NHS untouched.
            DB::connection('vocab')->table('vocab.source_to_concept_map')
                ->whereIn('source_vocabulary_id', self::FINNGEN_OWNED_VOCABS)
                ->delete();

            // Step 2 — load each CSV, batching INSERTs at 1000 rows.
            foreach (self::CSV_FILES as $filename) {
                $path = $crosswalkPath.DIRECTORY_SEPARATOR.$filename;
                if (! file_exists($path)) {
                    throw new RuntimeException("Cross-walk CSV missing: {$path}");
                }
                $this->loadCsv($path);
            }
        });

        // Step 3 — HIGHSEC §4.1 grants on the table (idempotent, runs after data load).
        DB::statement("
            DO \$grants\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                    GRANT SELECT ON vocab.source_to_concept_map TO parthenon_app;
                END IF;
            END
            \$grants\$
        ");
    }

    public function down(): void
    {
        // Reverse the seed: only delete the 6 FinnGen-owned vocab rows.
        DB::connection('vocab')->table('vocab.source_to_concept_map')
            ->whereIn('source_vocabulary_id', self::FINNGEN_OWNED_VOCABS)
            ->delete();
    }

    private function loadCsv(string $path): void
    {
        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new RuntimeException("Cannot open CSV: {$path}");
        }

        $headerSeen = false;
        $batch = [];
        try {
            while (($line = fgets($handle)) !== false) {
                $trimmed = trim($line);
                if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                    continue;
                }
                if (! $headerSeen) {
                    // First non-comment line MUST be the header — validate.
                    if (! str_starts_with($trimmed, 'source_code,source_concept_id,source_vocabulary_id')) {
                        throw new RuntimeException("Bad CSV header in {$path}: {$trimmed}");
                    }
                    $headerSeen = true;

                    continue;
                }
                $cols = str_getcsv($trimmed);
                if (count($cols) !== 10) {
                    throw new RuntimeException(sprintf(
                        'Malformed row in %s — expected 10 columns, got %d: %s',
                        basename($path), count($cols), $trimmed,
                    ));
                }
                $batch[] = [
                    'source_code' => $cols[0],
                    'source_concept_id' => (int) $cols[1],
                    'source_vocabulary_id' => $cols[2],
                    'source_code_description' => $cols[3] !== '' ? $cols[3] : null,
                    'target_concept_id' => (int) $cols[4],
                    'target_vocabulary_id' => $cols[5],
                    'valid_start_date' => $cols[6],
                    'valid_end_date' => $cols[7],
                    'invalid_reason' => $cols[8] !== '' ? $cols[8] : null,
                    // Note: provenance_tag (col 9) is documentation in the CSV,
                    // not stored in vocab.source_to_concept_map (no such column).
                ];
                if (count($batch) >= 1000) {
                    DB::connection('vocab')->table('vocab.source_to_concept_map')->insert($batch);
                    $batch = [];
                }
            }
            if ($batch !== []) {
                DB::connection('vocab')->table('vocab.source_to_concept_map')->insert($batch);
            }
        } finally {
            fclose($handle);
        }
    }
};
