<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use ZipArchive;

class LoadVocabularies extends Command
{
    /**
     * @var string
     */
    protected $signature = 'parthenon:load-vocabularies
        {--zip= : Path to Athena vocabulary ZIP file}
        {--path= : Path to directory containing extracted CSV files}
        {--skip-indexes : Skip index creation after loading}
        {--tables= : Comma-separated list of specific tables to load}';

    /**
     * @var string
     */
    protected $description = 'Load OMOP Athena vocabulary files into the vocab schema';

    /**
     * Mapping of table names to their CSV filenames and column lists.
     * Load order matters: reference tables first, then dependent tables.
     *
     * @var array<string, array{file: string, columns: list<string>}>
     */
    private array $tableConfig = [
        'vocabularies' => [
            'file' => 'VOCABULARY.csv',
            'columns' => ['vocabulary_id', 'vocabulary_name', 'vocabulary_reference', 'vocabulary_version', 'vocabulary_concept_id'],
        ],
        'domains' => [
            'file' => 'DOMAIN.csv',
            'columns' => ['domain_id', 'domain_name', 'domain_concept_id'],
        ],
        'concept_classes' => [
            'file' => 'CONCEPT_CLASS.csv',
            'columns' => ['concept_class_id', 'concept_class_name', 'concept_class_concept_id'],
        ],
        'relationships' => [
            'file' => 'RELATIONSHIP.csv',
            'columns' => ['relationship_id', 'relationship_name', 'is_hierarchical', 'defines_ancestry', 'reverse_relationship_id', 'relationship_concept_id'],
        ],
        'concepts' => [
            'file' => 'CONCEPT.csv',
            'columns' => ['concept_id', 'concept_name', 'domain_id', 'vocabulary_id', 'concept_class_id', 'standard_concept', 'concept_code', 'valid_start_date', 'valid_end_date', 'invalid_reason'],
        ],
        'concept_relationships' => [
            'file' => 'CONCEPT_RELATIONSHIP.csv',
            'columns' => ['concept_id_1', 'concept_id_2', 'relationship_id', 'valid_start_date', 'valid_end_date', 'invalid_reason'],
        ],
        'concept_ancestors' => [
            'file' => 'CONCEPT_ANCESTOR.csv',
            'columns' => ['ancestor_concept_id', 'descendant_concept_id', 'min_levels_of_separation', 'max_levels_of_separation'],
        ],
        'concept_synonyms' => [
            'file' => 'CONCEPT_SYNONYM.csv',
            'columns' => ['concept_id', 'concept_synonym_name', 'language_concept_id'],
        ],
        'drug_strengths' => [
            'file' => 'DRUG_STRENGTH.csv',
            'columns' => ['drug_concept_id', 'ingredient_concept_id', 'amount_value', 'amount_unit_concept_id', 'numerator_value', 'numerator_unit_concept_id', 'denominator_value', 'denominator_unit_concept_id', 'box_size', 'valid_start_date', 'valid_end_date', 'invalid_reason'],
        ],
    ];

    public function handle(): int
    {
        if (! $this->hasUmlsApiKey()) {
            $this->error('UMLS_API_KEY is not configured. Vocabulary imports require it for CPT-4 and related vocabulary workflows.');

            return self::FAILURE;
        }

        $zipPath = $this->option('zip');
        $csvPath = $this->option('path');

        if (! $zipPath && ! $csvPath) {
            $this->error('You must provide either --zip or --path option.');

            return self::FAILURE;
        }

        // Extract ZIP if provided
        if ($zipPath) {
            $csvPath = $this->extractZip((string) $zipPath);
            if (! $csvPath) {
                return self::FAILURE;
            }
        }

        $csvPath = rtrim((string) $csvPath, '/');

        // Determine which tables to load
        $tablesToLoad = $this->getTablesToLoad();

        $this->info('Starting vocabulary loading from: '.$csvPath);
        $this->newLine();

        // Truncate tables in reverse dependency order
        $this->truncateTables($tablesToLoad);

        // Load each table
        $totalRows = 0;
        foreach ($tablesToLoad as $table) {
            if (! isset($this->tableConfig[$table])) {
                $this->warn("Unknown table: {$table}, skipping.");

                continue;
            }

            $config = $this->tableConfig[$table];
            $filePath = $csvPath.'/'.$config['file'];

            if (! file_exists($filePath)) {
                $this->warn("File not found: {$config['file']}, skipping {$table}.");

                continue;
            }

            $rows = $this->loadTable($table, $filePath, $config['columns']);
            $totalRows += $rows;
        }

        $this->newLine();
        $this->info("Loaded {$totalRows} total rows.");

        // Create indexes
        if (! $this->option('skip-indexes')) {
            $this->createIndexes();
        }

        // Run ANALYZE
        $this->analyzeAllTables($tablesToLoad);

        $this->newLine();
        $this->info('Vocabulary loading complete!');

        $this->newLine();
        $this->info('Building concept hierarchy tree...');
        $this->call('vocabulary:build-hierarchy', ['--populate-results' => true]);

        return self::SUCCESS;
    }

    private function hasUmlsApiKey(): bool
    {
        return trim((string) env('UMLS_API_KEY', '')) !== '';
    }

    private function extractZip(string $zipPath): ?string
    {
        if (! file_exists($zipPath)) {
            $this->error("ZIP file not found: {$zipPath}");

            return null;
        }

        $extractPath = sys_get_temp_dir().'/parthenon_vocab_'.uniqid();
        mkdir($extractPath, 0755, true);

        $this->info("Extracting ZIP to: {$extractPath}");

        $zip = new ZipArchive;
        if ($zip->open($zipPath) !== true) {
            $this->error('Failed to open ZIP file.');

            return null;
        }

        $zip->extractTo($extractPath);
        $zip->close();

        $this->info('ZIP extracted successfully.');

        return $extractPath;
    }

    /**
     * @return list<string>
     */
    private function getTablesToLoad(): array
    {
        $tablesOption = $this->option('tables');

        if ($tablesOption) {
            return array_map('trim', explode(',', (string) $tablesOption));
        }

        return array_keys($this->tableConfig);
    }

    /**
     * @param  list<string>  $tables
     */
    private function truncateTables(array $tables): void
    {
        $this->info('Truncating existing data...');

        // Reverse order to respect dependencies
        $reverseOrder = array_reverse($tables);

        foreach ($reverseOrder as $table) {
            if (isset($this->tableConfig[$table])) {
                DB::connection('omop')->statement("TRUNCATE TABLE vocab.{$table} CASCADE");
            }
        }
    }

    /**
     * Load a single table from an Athena CSV using chunked COPY FROM STDIN.
     * Athena CSVs are tab-delimited with a header row and empty strings for NULLs.
     *
     * @param  list<string>  $columns
     */
    private function loadTable(string $table, string $filePath, array $columns): int
    {
        $fileSize = filesize($filePath);
        $fileSizeMb = round((int) $fileSize / 1024 / 1024, 1);

        $this->info("Loading {$table} ({$fileSizeMb} MB)...");

        $startTime = microtime(true);

        /** @var \PDO $pdo */
        $pdo = DB::connection('omop')->getPdo();

        // Strip header line and write to temp file for COPY FROM
        $tempFile = tempnam(sys_get_temp_dir(), 'vocab_') ?: '/tmp/vocab_temp';
        $columnList = implode(',', $columns);

        $input = fopen($filePath, 'r');
        if ($input === false) {
            $this->error("Cannot open: {$filePath}");

            return 0;
        }

        // Skip the header row
        fgets($input);

        $output = fopen($tempFile, 'w');
        if ($output === false) {
            fclose($input);
            $this->error('Cannot create temp file');

            return 0;
        }

        // Stream data to temp file (avoids loading entire file into memory)
        while (($line = fgets($input)) !== false) {
            fwrite($output, $line);
        }

        fclose($input);
        fclose($output);

        // Use COPY FROM with the header-stripped temp file
        $pdo->pgsqlCopyFromFile(
            "vocab.{$table}",
            $tempFile,
            "\t",
            '',
            $columnList
        );

        unlink($tempFile);

        // Get row count
        /** @var object{cnt: string} $result */
        $result = DB::connection('omop')->selectOne("SELECT count(*) as cnt FROM vocab.{$table}");
        $count = (int) $result->cnt;

        $elapsed = round(microtime(true) - $startTime, 1);
        $rate = $elapsed > 0 ? round($count / $elapsed) : $count;
        $this->info("  -> {$count} rows in {$elapsed}s ({$rate} rows/s)");

        return $count;
    }

    private function createIndexes(): void
    {
        $this->newLine();
        $this->info('Creating indexes (this may take several minutes)...');

        $btreeIndexes = [
            ['vocab.concepts', 'idx_concepts_vocabulary_id', 'vocabulary_id'],
            ['vocab.concepts', 'idx_concepts_domain_id', 'domain_id'],
            ['vocab.concepts', 'idx_concepts_concept_code', 'concept_code'],
            ['vocab.concepts', 'idx_concepts_standard_concept', 'standard_concept'],
            ['vocab.concept_relationships', 'idx_cr_concept_id_2', 'concept_id_2'],
            ['vocab.concept_relationships', 'idx_cr_relationship_id', 'relationship_id'],
            ['vocab.concept_ancestors', 'idx_ca_descendant', 'descendant_concept_id'],
            ['vocab.concept_synonyms', 'idx_cs_concept_id', 'concept_id'],
            ['vocab.drug_strengths', 'idx_ds_ingredient', 'ingredient_concept_id'],
        ];

        foreach ($btreeIndexes as [$tableName, $indexName, $column]) {
            $shortTable = str_replace('vocab.', '', $tableName);
            $this->info("  B-tree: {$indexName} on {$shortTable}.{$column}");
            DB::connection('omop')->statement(
                "CREATE INDEX IF NOT EXISTS {$indexName} ON {$tableName} ({$column})"
            );
        }

        // Trigram GIN index for fuzzy concept name search
        $this->info('  GIN trigram: idx_concepts_name_trgm on concepts.concept_name');
        DB::connection('omop')->statement(
            'CREATE INDEX IF NOT EXISTS idx_concepts_name_trgm ON vocab.concepts USING gin (concept_name gin_trgm_ops)'
        );

        $this->info('Indexes created.');
    }

    /**
     * @param  list<string>  $tables
     */
    private function analyzeAllTables(array $tables): void
    {
        $this->info('Running ANALYZE on loaded tables...');

        foreach ($tables as $table) {
            if (isset($this->tableConfig[$table])) {
                DB::connection('omop')->statement("ANALYZE vocab.{$table}");
            }
        }

        $this->info('ANALYZE complete.');
    }
}
