<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;

class LoadIrsfCommand extends Command
{
    protected $signature = 'parthenon:load-irsf
        {--path= : Path to staging CSV directory (default: scripts/irsf_etl/output/staging)}
        {--fresh : Drop existing IRSF clinical tables and reload}
        {--table= : Load only a specific table (e.g., person, measurement)}';

    protected $description = 'Load IRSF Natural History Study staging CSVs into the OMOP CDM schema';

    private const CDM_SCHEMA = 'omop';

    /** @var array<int, array{csv: string, table: string, mode: string}> */
    private const LOAD_ORDER = [
        // Custom vocabulary (append to existing Athena tables)
        ['csv' => 'vocabulary.csv', 'table' => 'vocabulary', 'mode' => 'append'],
        ['csv' => 'concept.csv', 'table' => 'concept', 'mode' => 'append'],
        ['csv' => 'source_to_concept_map.csv', 'table' => 'source_to_concept_map', 'mode' => 'append'],
        // Clinical foundation
        ['csv' => 'person.csv', 'table' => 'person', 'mode' => 'create'],
        ['csv' => 'visit_occurrence.csv', 'table' => 'visit_occurrence', 'mode' => 'create'],
        // Clinical events (FK to person + visit)
        ['csv' => 'death.csv', 'table' => 'death', 'mode' => 'create'],
        ['csv' => 'drug_exposure.csv', 'table' => 'drug_exposure', 'mode' => 'create'],
        ['csv' => 'condition_occurrence.csv', 'table' => 'condition_occurrence', 'mode' => 'create'],
        ['csv' => 'measurement.csv', 'table' => 'measurement', 'mode' => 'create'],
        // Observations (merged from 3 files)
        ['csv' => '__merged_observation__', 'table' => 'observation', 'mode' => 'create'],
    ];

    /** Tables that are created by this loader (clinical, not vocabulary) */
    private const CLINICAL_TABLES = [
        'person', 'visit_occurrence', 'death', 'drug_exposure',
        'condition_occurrence', 'measurement', 'observation',
        'observation_period',
    ];

    /** Observation source files in merge order */
    private const OBSERVATION_FILES = [
        'observation_mba.csv',
        'observation_genotype.csv',
        'observation_categorical.csv',
    ];

    /** Columns that should be treated as integer despite CSV containing floats like "2011.0" */
    private const INTEGER_COLUMNS = [
        'year_of_birth', 'month_of_birth', 'day_of_birth',
    ];

    public function handle(): int
    {
        $stagingDir = $this->resolveStagingDir();
        if ($stagingDir === null) {
            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->dropIrsfData();
        }

        // Create infrastructure tables that don't come from CSVs
        $this->createInfrastructureTables();

        // Adapt existing table schemas for IRSF data compatibility
        $this->adaptExistingSchemas();

        $singleTable = $this->option('table');
        $manifest = $singleTable
            ? array_values(array_filter(self::LOAD_ORDER, fn ($entry) => $entry['table'] === $singleTable))
            : self::LOAD_ORDER;

        if ($singleTable && empty($manifest)) {
            $this->error("Table '{$singleTable}' not found in load manifest.");

            return self::FAILURE;
        }

        $this->info('=== IRSF-NHS CDM Loading ===');
        $this->info('Loading '.count($manifest).' tables in FK order...');
        $this->newLine();

        $totalRows = 0;
        $totalTables = 0;
        $skipped = [];
        $startTime = microtime(true);
        $step = 0;

        foreach ($manifest as $entry) {
            $step++;
            $label = '['.str_pad((string) $step, 2, ' ', STR_PAD_LEFT).'/'.count($manifest).']';

            if ($entry['csv'] === '__merged_observation__') {
                $rows = $this->loadMergedObservations($stagingDir, $label);
            } else {
                $csvPath = $stagingDir.'/'.$entry['csv'];
                if (! file_exists($csvPath)) {
                    $this->warn("  {$label} {$entry['table']}: SKIPPED (CSV not found)");
                    $skipped[] = $entry['table'];

                    continue;
                }
                $rows = $this->loadSingleTable($csvPath, $entry['table'], $entry['mode'], $label);
            }

            if ($rows > 0) {
                $totalRows += $rows;
                $totalTables++;
            } elseif ($rows === -1) {
                $skipped[] = $entry['table'];
            }
        }

        $elapsed = round(microtime(true) - $startTime, 1);
        $this->newLine();
        $this->info('Loaded '.number_format($totalRows)." rows across {$totalTables} tables in {$elapsed}s.");

        if (! empty($skipped)) {
            $this->warn('Skipped tables: '.implode(', ', $skipped));
        }

        return self::SUCCESS;
    }

    private function resolveStagingDir(): ?string
    {
        $path = $this->option('path');
        if ($path) {
            $resolved = realpath((string) $path);
        } else {
            $resolved = realpath(base_path('../../scripts/irsf_etl/output/staging'));
            if (! $resolved) {
                // Also try from project root (when running outside Docker)
                $resolved = realpath(base_path('../scripts/irsf_etl/output/staging'));
            }
        }

        if (! $resolved || ! is_dir($resolved)) {
            $this->error('Staging directory not found. Use --path to specify location.');
            $this->error('Expected: scripts/irsf_etl/output/staging/');

            return null;
        }

        $csvCount = count(glob($resolved.'/*.csv') ?: []);
        $this->info("Staging directory: {$resolved} ({$csvCount} CSV files)");

        return $resolved;
    }

    private function dropIrsfData(): void
    {
        $this->warn('Dropping IRSF clinical data...');
        $db = DB::connection('omop');
        $schema = self::CDM_SCHEMA;

        // Drop clinical tables in reverse FK order
        foreach (array_reverse(self::CLINICAL_TABLES) as $table) {
            $db->statement("DROP TABLE IF EXISTS {$schema}.{$table} CASCADE");
        }

        // Clean up appended vocabulary rows
        $db->statement("DELETE FROM {$schema}.vocabulary WHERE vocabulary_id = 'IRSF-NHS'");
        $db->statement("DELETE FROM {$schema}.concept WHERE vocabulary_id = 'IRSF-NHS'");
        $db->statement("DELETE FROM {$schema}.source_to_concept_map WHERE source_vocabulary_id = 'IRSF-NHS'");
        $db->statement("DELETE FROM {$schema}.cdm_source WHERE cdm_source_abbreviation = 'IRSF-NHS'");

        $this->info('IRSF data dropped.');
    }

    private function createInfrastructureTables(): void
    {
        $db = DB::connection('omop');
        $schema = self::CDM_SCHEMA;

        // observation_period — needed by 11-02
        $db->statement("
            CREATE TABLE IF NOT EXISTS {$schema}.observation_period (
                observation_period_id bigint,
                person_id bigint,
                observation_period_start_date date,
                observation_period_end_date date,
                period_type_concept_id integer
            )
        ");

        // cdm_source — needed by LOAD-04
        $db->statement("
            CREATE TABLE IF NOT EXISTS {$schema}.cdm_source (
                cdm_source_name text,
                cdm_source_abbreviation text,
                cdm_holder text,
                source_description text,
                source_documentation_reference text,
                cdm_etl_reference text,
                source_release_date date,
                cdm_release_date date,
                cdm_version text,
                cdm_version_concept_id integer,
                vocabulary_version text
            )
        ");
    }

    /**
     * Adapt existing OMOP table schemas for IRSF data compatibility.
     *
     * The standard OMOP DDL has constraints that conflict with IRSF data:
     * - person.year_of_birth NOT NULL (some IRSF patients lack DOB)
     * - drug_exposure.drug_source_value varchar(50) (some source values > 50 chars)
     * - observation.*_concept_id integer (SNOMED codes exceed int range)
     */
    private function adaptExistingSchemas(): void
    {
        $db = DB::connection('omop');
        $schema = self::CDM_SCHEMA;

        $alterations = [
            // Allow NULL year_of_birth for patients without DOB
            "ALTER TABLE {$schema}.person ALTER COLUMN year_of_birth DROP NOT NULL",
            // Widen drug_source_value to text for long RxNorm descriptions
            "ALTER TABLE {$schema}.drug_exposure ALTER COLUMN drug_source_value TYPE text",
            // Widen concept_id columns to bigint for SNOMED codes > 2^31
            "ALTER TABLE {$schema}.observation ALTER COLUMN observation_concept_id TYPE bigint",
            "ALTER TABLE {$schema}.observation ALTER COLUMN observation_source_concept_id TYPE bigint",
        ];

        foreach ($alterations as $sql) {
            try {
                $db->statement($sql);
            } catch (\Throwable) {
                // Table may not exist yet (will be created later) or already altered
            }
        }
    }

    /**
     * Load a single CSV into the omop schema.
     *
     * @return int Row count loaded (0 if skipped/empty, -1 if error)
     */
    private function loadSingleTable(string $csvPath, string $tableName, string $mode, string $label): int
    {
        $handle = fopen($csvPath, 'r');
        if ($handle === false) {
            $this->warn("  {$label} {$tableName}: cannot open CSV");

            return -1;
        }

        $columns = fgetcsv($handle);
        if ($columns === false || $columns === [null] || empty($columns)) {
            fclose($handle);
            $this->warn("  {$label} {$tableName}: empty or invalid CSV");

            return -1;
        }

        $columns = array_map(fn ($col) => strtolower(trim((string) $col)), $columns);

        $db = DB::connection('omop');
        $schema = self::CDM_SCHEMA;

        // Create table if mode is 'create'
        if ($mode === 'create') {
            $columnDefs = array_map(
                fn ($col) => "\"{$col}\" ".$this->inferColumnType($col),
                $columns
            );
            $db->statement("CREATE TABLE IF NOT EXISTS {$schema}.{$tableName} (\n  "
                .implode(",\n  ", $columnDefs)."\n)");
        }

        // Idempotency check
        if ($this->tableHasData($tableName, $mode)) {
            fclose($handle);

            return 0;
        }

        // Identify integer column positions (for .0 stripping)
        $integerPositions = [];
        foreach ($columns as $i => $col) {
            if (in_array($col, self::INTEGER_COLUMNS, true)) {
                $integerPositions[] = $i;
            }
        }

        // Convert CSV to PG text format
        $tempFile = tempnam(sys_get_temp_dir(), 'irsf_') ?: '/tmp/irsf_temp';
        $rowCount = $this->csvToTempFile($handle, $tempFile, $integerPositions);
        fclose($handle);

        if ($rowCount === 0) {
            @unlink($tempFile);
            $this->line("  {$label} {$tableName}: empty (header only)");

            return 0;
        }

        // COPY into PostgreSQL
        $columnList = implode(',', array_map(fn ($c) => "\"{$c}\"", $columns));
        $elapsed = $this->copyFromFile($db, $schema, $tableName, $tempFile, $columnList);
        @unlink($tempFile);

        if ($elapsed === null) {
            return -1;
        }

        $modeTag = $mode === 'append' ? ' (append)' : '';
        $this->info("  {$label} {$tableName}: ".number_format($rowCount)." rows ({$elapsed}s){$modeTag}");

        return $rowCount;
    }

    /**
     * Merge 3 observation CSVs and load as one table.
     *
     * @return int Total rows loaded (-1 on error)
     */
    private function loadMergedObservations(string $stagingDir, string $label): int
    {
        $tableName = 'observation';
        $db = DB::connection('omop');
        $schema = self::CDM_SCHEMA;

        // Idempotency
        if ($this->tableHasData($tableName, 'create')) {
            return 0;
        }

        $allFiles = [];
        foreach (self::OBSERVATION_FILES as $filename) {
            $path = $stagingDir.'/'.$filename;
            if (file_exists($path)) {
                $allFiles[] = $path;
            } else {
                $this->warn("  Observation file missing: {$filename}");
            }
        }

        if (empty($allFiles)) {
            $this->warn("  {$label} observation: SKIPPED (no observation CSVs found)");

            return -1;
        }

        // Read header from first file to get column list
        $firstHandle = fopen($allFiles[0], 'r');
        if ($firstHandle === false) {
            return -1;
        }
        $columns = fgetcsv($firstHandle);
        fclose($firstHandle);

        if ($columns === false || $columns === [null] || empty($columns)) {
            return -1;
        }
        $columns = array_map(fn ($col) => strtolower(trim((string) $col)), $columns);

        // Find observation_id column position
        $idPos = array_search('observation_id', $columns, true);
        if ($idPos === false) {
            $this->error("  {$label} observation: observation_id column not found");

            return -1;
        }

        // Create table
        $columnDefs = array_map(
            fn ($col) => "\"{$col}\" ".$this->inferColumnType($col),
            $columns
        );
        $db->statement("CREATE TABLE IF NOT EXISTS {$schema}.{$tableName} (\n  "
            .implode(",\n  ", $columnDefs)."\n)");

        // Merge all files into a single temp file with re-numbered IDs
        $tempFile = tempnam(sys_get_temp_dir(), 'irsf_obs_') ?: '/tmp/irsf_obs_temp';
        $output = fopen($tempFile, 'w');
        if ($output === false) {
            return -1;
        }

        $totalRows = 0;
        $nextId = 1;
        $fileCount = 0;

        foreach ($allFiles as $filePath) {
            $handle = fopen($filePath, 'r');
            if ($handle === false) {
                continue;
            }

            // Skip header
            fgetcsv($handle);
            $fileRows = 0;

            while (($fields = fgetcsv($handle)) !== false) {
                if ($fields === [null]) {
                    continue;
                }

                // Re-number observation_id
                $fields[$idPos] = (string) $nextId;
                $nextId++;

                // Convert to PG text format
                $processed = array_map(function ($f) {
                    if ($f === null || $f === '') {
                        return '__IRSF_NULL__';
                    }

                    $clean = str_replace(["\r", "\n"], ['', ' '], $f);

                    return str_replace(['\\', "\t"], ['\\\\', '\\t'], $clean);
                }, $fields);

                fwrite($output, implode("\t", $processed)."\n");
                $fileRows++;
            }

            fclose($handle);
            $totalRows += $fileRows;
            $fileCount++;
        }

        fclose($output);

        if ($totalRows === 0) {
            @unlink($tempFile);
            $this->warn("  {$label} observation: no data rows");

            return 0;
        }

        // COPY into PostgreSQL
        $columnList = implode(',', array_map(fn ($c) => "\"{$c}\"", $columns));
        $elapsed = $this->copyFromFile($db, $schema, $tableName, $tempFile, $columnList);
        @unlink($tempFile);

        if ($elapsed === null) {
            return -1;
        }

        $this->info("  {$label} observation: ".number_format($totalRows)." rows (merged {$fileCount} files, {$elapsed}s)");

        return $totalRows;
    }

    /**
     * Check if IRSF data already exists in the table (idempotency).
     *
     * For vocabulary tables: checks for IRSF-NHS vocabulary_id.
     * For clinical tables: checks for IRSF person_source_values in the person table,
     * since tables may contain data from other datasets (Synthea, MIMIC).
     */
    private function tableHasData(string $tableName, string $mode): bool
    {
        $db = DB::connection('omop');
        $schema = self::CDM_SCHEMA;

        try {
            if ($mode === 'append') {
                // For vocabulary tables, check if IRSF-specific rows exist
                $sentinelCol = match ($tableName) {
                    'vocabulary' => 'vocabulary_id',
                    'concept' => 'vocabulary_id',
                    'source_to_concept_map' => 'source_vocabulary_id',
                    default => null,
                };

                if ($sentinelCol !== null) {
                    $result = $db->selectOne(
                        "SELECT COUNT(*) as cnt FROM {$schema}.{$tableName} WHERE {$sentinelCol} = ?",
                        ['IRSF-NHS']
                    );
                    if ((int) $result->cnt > 0) {
                        $this->line("  {$tableName}: already loaded ({$result->cnt} IRSF rows), skipping.");

                        return true;
                    }
                }

                return false;
            }

            // For clinical tables, check if IRSF-specific data exists.
            // The person table uses person_source_value; other tables use a
            // JOIN to person to detect IRSF person_ids.
            if ($tableName === 'person') {
                $result = $db->selectOne(
                    "SELECT COUNT(*) as cnt FROM {$schema}.person WHERE person_source_value IS NOT NULL AND person_source_value = person_id::text"
                );
                if ((int) $result->cnt > 0) {
                    $this->line("  {$tableName}: IRSF data already loaded (".number_format((int) $result->cnt).' rows), skipping.');

                    return true;
                }

                return false;
            }

            // For death, the table may not exist yet
            if ($tableName === 'death') {
                $result = $db->selectOne("SELECT COUNT(*) as cnt FROM {$schema}.death d WHERE EXISTS (SELECT 1 FROM {$schema}.person p WHERE p.person_id = d.person_id AND p.person_source_value = p.person_id::text)");
                if ((int) $result->cnt > 0) {
                    $this->line("  {$tableName}: IRSF data already loaded (".number_format((int) $result->cnt).' rows), skipping.');

                    return true;
                }

                return false;
            }

            // Generic check for tables with person_id column
            $personIdTables = ['visit_occurrence', 'drug_exposure', 'condition_occurrence', 'measurement', 'observation'];
            if (in_array($tableName, $personIdTables, true)) {
                // First check table exists
                $db->selectOne("SELECT 1 FROM {$schema}.{$tableName} LIMIT 1");

                // Check for IRSF data by joining to person (IRSF persons have person_source_value = person_id)
                $result = $db->selectOne(
                    "SELECT EXISTS (SELECT 1 FROM {$schema}.{$tableName} t INNER JOIN {$schema}.person p ON p.person_id = t.person_id WHERE p.person_source_value = p.person_id::text LIMIT 1) as exists_flag"
                );
                if ($result->exists_flag) {
                    $this->line("  {$tableName}: IRSF data already loaded, skipping.");

                    return true;
                }

                return false;
            }

            return false;
        } catch (\Throwable) {
            // Table doesn't exist yet
            return false;
        }
    }

    /**
     * Convert CSV data to PostgreSQL tab-delimited text format.
     *
     * @param  resource  $handle  Open CSV file handle (positioned after header)
     * @param  array<int>  $integerPositions  Column indices needing .0 stripping
     * @return int Number of rows written
     */
    private function csvToTempFile($handle, string $tempFile, array $integerPositions = []): int
    {
        $output = fopen($tempFile, 'w');
        if ($output === false) {
            return 0;
        }

        $rowCount = 0;
        while (($fields = fgetcsv($handle)) !== false) {
            if ($fields === [null]) {
                continue;
            }

            $processed = [];
            foreach ($fields as $i => $f) {
                if ($f === null || $f === '') {
                    $processed[] = '__IRSF_NULL__';
                } else {
                    $value = $f;
                    // Strip .0 suffix from integer columns (pandas writes 2011.0 for int)
                    if (in_array($i, $integerPositions, true) && str_ends_with($value, '.0')) {
                        $value = substr($value, 0, -2);
                    }
                    // Strip embedded newlines/carriage returns (CSVs have \r and \n in quoted fields)
                    $value = str_replace(["\r", "\n"], ['', ' '], $value);
                    $processed[] = str_replace(['\\', "\t"], ['\\\\', '\\t'], $value);
                }
            }

            fwrite($output, implode("\t", $processed)."\n");
            $rowCount++;
        }

        fclose($output);

        return $rowCount;
    }

    /**
     * Execute pgsqlCopyFromFile and return elapsed time, or null on failure.
     */
    private function copyFromFile(
        Connection $db,
        string $schema,
        string $tableName,
        string $tempFile,
        string $columnList
    ): ?string {
        /** @var \PDO $pdo */
        $pdo = $db->getPdo();

        $start = microtime(true);

        try {
            $pdo->pgsqlCopyFromFile(
                "{$schema}.{$tableName}",
                $tempFile,
                "\t",
                '__IRSF_NULL__',
                $columnList
            );
        } catch (\Throwable $e) {
            $this->error("  {$tableName}: COPY failed - {$e->getMessage()}");

            return null;
        }

        return (string) round(microtime(true) - $start, 1);
    }

    private function inferColumnType(string $col): string
    {
        if (str_ends_with($col, '_datetime') || $col === 'birth_datetime') {
            return 'timestamp';
        }
        if (str_ends_with($col, '_date')) {
            return 'date';
        }
        if (str_ends_with($col, '_concept_id')) {
            // Use bigint for concept_id columns -- SNOMED codes can exceed int32 range
            return 'bigint';
        }
        // Vocabulary string-based IDs
        if (in_array($col, [
            'domain_id', 'vocabulary_id', 'relationship_id', 'reverse_relationship_id',
            'concept_class_id', 'standard_concept', 'invalid_reason',
            'source_vocabulary_id', 'target_vocabulary_id',
        ], true)) {
            return 'text';
        }
        if (str_ends_with($col, '_id')) {
            return 'bigint';
        }
        if (in_array($col, ['year_of_birth', 'month_of_birth', 'day_of_birth', 'priority', 'is_default'], true)) {
            return 'integer';
        }
        if (in_array($col, [
            'quantity', 'amount_value', 'numerator_value', 'denominator_value',
            'days_supply', 'range_low', 'range_high', 'value_as_number',
        ], true)) {
            return 'numeric';
        }

        return 'text';
    }
}
