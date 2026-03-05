<?php

namespace App\Jobs\Vocabulary;

use App\Models\App\VocabularyImport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

class VocabularyImportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Allow up to 6 hours — large Athena zips take substantial time to load.
     */
    public int $timeout = 21600;

    public int $tries = 1;

    /**
     * Mapping of OMOP table names to Athena CSV filenames and column lists.
     * Load order is dependency-aware: reference tables first.
     *
     * @var array<string, array{file: string, columns: list<string>}>
     */
    private array $tableConfig = [
        'vocabulary' => [
            'file' => 'VOCABULARY.csv',
            'columns' => ['vocabulary_id', 'vocabulary_name', 'vocabulary_reference', 'vocabulary_version', 'vocabulary_concept_id'],
        ],
        'domain' => [
            'file' => 'DOMAIN.csv',
            'columns' => ['domain_id', 'domain_name', 'domain_concept_id'],
        ],
        'concept_class' => [
            'file' => 'CONCEPT_CLASS.csv',
            'columns' => ['concept_class_id', 'concept_class_name', 'concept_class_concept_id'],
        ],
        'relationship' => [
            'file' => 'RELATIONSHIP.csv',
            'columns' => ['relationship_id', 'relationship_name', 'is_hierarchical', 'defines_ancestry', 'reverse_relationship_id', 'relationship_concept_id'],
        ],
        'concept' => [
            'file' => 'CONCEPT.csv',
            'columns' => ['concept_id', 'concept_name', 'domain_id', 'vocabulary_id', 'concept_class_id', 'standard_concept', 'concept_code', 'valid_start_date', 'valid_end_date', 'invalid_reason'],
        ],
        'concept_relationship' => [
            'file' => 'CONCEPT_RELATIONSHIP.csv',
            'columns' => ['concept_id_1', 'concept_id_2', 'relationship_id', 'valid_start_date', 'valid_end_date', 'invalid_reason'],
        ],
        'concept_ancestor' => [
            'file' => 'CONCEPT_ANCESTOR.csv',
            'columns' => ['ancestor_concept_id', 'descendant_concept_id', 'min_levels_of_separation', 'max_levels_of_separation'],
        ],
        'concept_synonym' => [
            'file' => 'CONCEPT_SYNONYM.csv',
            'columns' => ['concept_id', 'concept_synonym_name', 'language_concept_id'],
        ],
        'drug_strength' => [
            'file' => 'DRUG_STRENGTH.csv',
            'columns' => ['drug_concept_id', 'ingredient_concept_id', 'amount_value', 'amount_unit_concept_id', 'numerator_value', 'numerator_unit_concept_id', 'denominator_value', 'denominator_unit_concept_id', 'box_size', 'valid_start_date', 'valid_end_date', 'invalid_reason'],
        ],
    ];

    public function __construct(
        public readonly VocabularyImport $import,
    ) {
        $this->queue = 'default';
    }

    public function handle(): void
    {
        $import = $this->import;

        try {
            $import->update([
                'status' => 'running',
                'started_at' => now(),
                'progress_percentage' => 0,
            ]);
            $import->appendLog('Vocabulary import started.');

            // Resolve storage path
            $storagePath = Storage::path($import->storage_path);
            if (! file_exists($storagePath)) {
                throw new \RuntimeException("Upload file not found at: {$storagePath}");
            }

            // Extract ZIP
            $csvDir = $this->extractZip($storagePath, $import);
            $import->update(['progress_percentage' => 5]);

            // Determine target schema
            $schema = $import->target_schema ?? 'vocab';
            $import->appendLog("Target schema: {$schema}");

            // Truncate existing vocab tables in reverse order
            $this->truncateTables($schema, $import);
            $import->update(['progress_percentage' => 10]);

            // Load tables
            $totalRows = 0;
            $tableNames = array_keys($this->tableConfig);
            $tableCount = count($tableNames);

            foreach ($tableNames as $idx => $table) {
                $config = $this->tableConfig[$table];
                $filePath = $csvDir.'/'.$config['file'];

                if (! file_exists($filePath)) {
                    $import->appendLog("  Skipping {$table} — {$config['file']} not found in ZIP.");

                    continue;
                }

                $rows = $this->loadTable($schema, $table, $filePath, $config['columns'], $import);
                $totalRows += $rows;

                // Progress: 10% for setup + 70% for loading + 10% indexes + 10% analyze
                $loadProgress = (int) (10 + (($idx + 1) / $tableCount) * 70);
                $import->update([
                    'progress_percentage' => $loadProgress,
                    'rows_loaded' => $totalRows,
                ]);
            }

            // Create indexes
            $import->appendLog('Creating indexes...');
            $this->createIndexes($schema, $import);
            $import->update(['progress_percentage' => 90]);

            // ANALYZE
            $import->appendLog('Running ANALYZE...');
            $this->analyzeAllTables($schema, $import);

            // Cleanup temp dir
            $this->cleanupDir($csvDir);

            // Cleanup uploaded zip
            Storage::delete($import->storage_path);

            $import->update([
                'status' => 'completed',
                'progress_percentage' => 100,
                'rows_loaded' => $totalRows,
                'completed_at' => now(),
            ]);
            $import->appendLog("Import complete. Total rows loaded: {$totalRows}");

            Log::info('VocabularyImportJob completed', [
                'import_id' => $import->id,
                'total_rows' => $totalRows,
                'schema' => $schema,
            ]);
        } catch (\Throwable $e) {
            Log::error('VocabularyImportJob failed', [
                'import_id' => $import->id,
                'error' => $e->getMessage(),
            ]);

            $import->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'completed_at' => now(),
            ]);
            $import->appendLog('ERROR: '.$e->getMessage());

            throw $e;
        }
    }

    private function extractZip(string $zipPath, VocabularyImport $import): string
    {
        $extractDir = sys_get_temp_dir().'/parthenon_vocab_'.uniqid();
        mkdir($extractDir, 0755, true);

        $import->appendLog('Extracting ZIP archive...');

        $zip = new ZipArchive;
        if ($zip->open($zipPath) !== true) {
            throw new \RuntimeException('Failed to open ZIP file.');
        }

        $zip->extractTo($extractDir);
        $zip->close();

        $import->appendLog("Extracted to temporary directory.");

        // Athena ZIPs sometimes have a top-level folder — find the CSV files
        $csvFiles = glob($extractDir.'/*.csv');
        if (empty($csvFiles)) {
            // Look one level deeper
            $subdirs = glob($extractDir.'/*', GLOB_ONLYDIR);
            if (! empty($subdirs)) {
                return $subdirs[0];
            }
        }

        return $extractDir;
    }

    /**
     * @param  list<string>  $columns
     */
    private function loadTable(string $schema, string $table, string $filePath, array $columns, VocabularyImport $import): int
    {
        $fileSize = filesize($filePath);
        $fileSizeMb = round((int) $fileSize / 1024 / 1024, 1);
        $import->appendLog("Loading {$table} ({$fileSizeMb} MB)...");

        $startTime = microtime(true);

        /** @var \PDO $pdo */
        $pdo = DB::connection('vocab')->getPdo();

        // Apply target schema
        $pdo->exec("SET search_path TO {$schema}, public");

        $columnList = implode(',', $columns);
        $tempFile = tempnam(sys_get_temp_dir(), 'vocab_') ?: '/tmp/vocab_temp';

        $input = fopen($filePath, 'r');
        if ($input === false) {
            $import->appendLog("  ERROR: Cannot open {$filePath}");

            return 0;
        }

        $output = fopen($tempFile, 'w');
        if ($output === false) {
            fclose($input);
            $import->appendLog('  ERROR: Cannot create temp file.');

            return 0;
        }

        // Skip header row, stream data to temp file
        fgets($input);
        while (($line = fgets($input)) !== false) {
            fwrite($output, $line);
        }
        fclose($input);
        fclose($output);

        $pdo->pgsqlCopyFromFile(
            "{$schema}.{$table}",
            $tempFile,
            "\t",
            '',
            $columnList
        );

        unlink($tempFile);

        /** @var object{cnt: string} $result */
        $result = DB::connection('vocab')->selectOne("SELECT count(*) as cnt FROM {$schema}.{$table}");
        $count = (int) $result->cnt;

        $elapsed = round(microtime(true) - $startTime, 1);
        $rate = $elapsed > 0 ? number_format((int) ($count / $elapsed)) : (string) $count;
        $import->appendLog("  -> {$count} rows in {$elapsed}s ({$rate} rows/s)");

        return $count;
    }

    private function truncateTables(string $schema, VocabularyImport $import): void
    {
        $import->appendLog('Truncating existing vocabulary tables...');

        $reverseOrder = array_reverse(array_keys($this->tableConfig));

        foreach ($reverseOrder as $table) {
            try {
                DB::connection('vocab')->statement("TRUNCATE TABLE {$schema}.{$table} CASCADE");
                $import->appendLog("  Truncated {$table}");
            } catch (\Throwable $e) {
                $import->appendLog("  Skipped truncate on {$table} ({$e->getMessage()})");
            }
        }
    }

    private function createIndexes(string $schema, VocabularyImport $import): void
    {
        $btreeIndexes = [
            ["{$schema}.concept", "idx_{$schema}_concept_vocabulary_id", 'vocabulary_id'],
            ["{$schema}.concept", "idx_{$schema}_concept_domain_id", 'domain_id'],
            ["{$schema}.concept", "idx_{$schema}_concept_concept_code", 'concept_code'],
            ["{$schema}.concept", "idx_{$schema}_concept_standard_concept", 'standard_concept'],
            ["{$schema}.concept_relationship", "idx_{$schema}_cr_concept_id_2", 'concept_id_2'],
            ["{$schema}.concept_relationship", "idx_{$schema}_cr_relationship_id", 'relationship_id'],
            ["{$schema}.concept_ancestor", "idx_{$schema}_ca_descendant", 'descendant_concept_id'],
            ["{$schema}.concept_synonym", "idx_{$schema}_cs_concept_id", 'concept_id'],
            ["{$schema}.drug_strength", "idx_{$schema}_ds_ingredient", 'ingredient_concept_id'],
        ];

        foreach ($btreeIndexes as [$tableName, $indexName, $column]) {
            try {
                DB::connection('vocab')->statement(
                    "CREATE INDEX IF NOT EXISTS {$indexName} ON {$tableName} ({$column})"
                );
                $import->appendLog("  Index: {$indexName}");
            } catch (\Throwable $e) {
                $import->appendLog("  Skipped index {$indexName}: {$e->getMessage()}");
            }
        }

        // Trigram GIN index for fuzzy concept name search
        try {
            DB::connection('vocab')->statement(
                "CREATE INDEX IF NOT EXISTS idx_{$schema}_concept_name_trgm ON {$schema}.concept USING gin (concept_name gin_trgm_ops)"
            );
            $import->appendLog("  GIN trigram index on concept.concept_name");
        } catch (\Throwable $e) {
            $import->appendLog("  Skipped GIN index: {$e->getMessage()}");
        }
    }

    private function analyzeAllTables(string $schema, VocabularyImport $import): void
    {
        foreach (array_keys($this->tableConfig) as $table) {
            try {
                DB::connection('vocab')->statement("ANALYZE {$schema}.{$table}");
            } catch (\Throwable $e) {
                $import->appendLog("  ANALYZE {$table} skipped: {$e->getMessage()}");
            }
        }
        $import->appendLog('ANALYZE complete.');
    }

    private function cleanupDir(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }

        $files = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($files as $file) {
            if ($file->isDir()) {
                rmdir($file->getRealPath());
            } else {
                unlink($file->getRealPath());
            }
        }

        rmdir($dir);
    }
}
