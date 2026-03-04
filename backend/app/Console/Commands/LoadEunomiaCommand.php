<?php

namespace App\Console\Commands;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use ZipArchive;

class LoadEunomiaCommand extends Command
{
    protected $signature = 'parthenon:load-eunomia
        {--path= : Path to GiBleed ZIP file (downloads automatically if not provided)}
        {--fresh : Drop existing eunomia schemas and reload}';

    protected $description = 'Download, load, and characterize the OHDSI Eunomia GiBleed dataset (~2,694 patients)';

    private const DOWNLOAD_URL = 'https://raw.githubusercontent.com/OHDSI/EunomiaDatasets/main/datasets/GiBleed/GiBleed_5.3.zip';

    private const CDM_SCHEMA = 'eunomia';

    private const RESULTS_SCHEMA = 'eunomia_results';

    /** Non-essential tables to skip */
    private const SKIP_TABLES = [
        'cohort', 'cohort_attribute', 'cdm_source', 'metadata',
        'fact_relationship', 'note', 'note_nlp',
    ];

    public function handle(): int
    {
        $zipPath = $this->option('path');

        if (! $zipPath) {
            $zipPath = $this->downloadDataset();
            if (! $zipPath) {
                return self::FAILURE;
            }
        }

        $csvDir = $this->extractZip((string) $zipPath);
        if (! $csvDir) {
            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->dropSchemas();
        }

        // Phase 1: Create schema and load CDM tables
        $this->info('=== Phase 1: Loading CDM tables ===');
        $this->createSchema(self::CDM_SCHEMA);
        $loaded = $this->loadCdmTables($csvDir);

        if ($loaded === 0) {
            $this->error('No tables loaded. Aborting.');

            return self::FAILURE;
        }

        // Phase 2: Create Achilles results
        $this->newLine();
        $this->info('=== Phase 2: Computing Achilles characterization ===');
        $this->createSchema(self::RESULTS_SCHEMA);
        $this->createAchillesTables();
        $this->runMiniAchilles();

        // Phase 3: Seed source
        $this->newLine();
        $this->info('=== Phase 3: Registering data source ===');
        $this->seedSource();

        // Cleanup temp files
        $this->cleanup($csvDir);

        $this->newLine();
        $this->info('Eunomia GiBleed dataset loaded and characterized successfully!');

        return self::SUCCESS;
    }

    private function downloadDataset(): ?string
    {
        $this->info('Downloading GiBleed dataset from GitHub...');
        $zipPath = sys_get_temp_dir().'/eunomia_gibleed.zip';

        $context = stream_context_create(['http' => [
            'timeout' => 120,
            'user_agent' => 'Parthenon/1.0',
        ]]);

        $content = @file_get_contents(self::DOWNLOAD_URL, false, $context);

        if ($content === false) {
            $this->error('Failed to download dataset. Use --path to provide a local ZIP.');

            return null;
        }

        file_put_contents($zipPath, $content);
        $sizeMb = round(filesize($zipPath) / 1024 / 1024, 1);
        $this->info("Downloaded {$sizeMb} MB to {$zipPath}");

        return $zipPath;
    }

    private function extractZip(string $zipPath): ?string
    {
        if (! file_exists($zipPath)) {
            $this->error("ZIP file not found: {$zipPath}");

            return null;
        }

        $extractPath = sys_get_temp_dir().'/eunomia_'.uniqid();
        @mkdir($extractPath, 0755, true);

        $zip = new ZipArchive;
        if ($zip->open($zipPath) !== true) {
            $this->error('Failed to open ZIP file.');

            return null;
        }

        $zip->extractTo($extractPath);
        $zip->close();

        // Find the actual CSV directory (may be nested like GiBleed_5.3/)
        $dirs = glob($extractPath.'/*', GLOB_ONLYDIR);
        foreach ($dirs as $dir) {
            if (basename($dir) !== '__MACOSX' && glob($dir.'/*.csv')) {
                $this->info('Extracted to: '.$dir);

                return $dir;
            }
        }

        // CSVs might be in root
        if (glob($extractPath.'/*.csv')) {
            return $extractPath;
        }

        $this->error('No CSV files found in ZIP.');

        return null;
    }

    private function dropSchemas(): void
    {
        $this->warn('Dropping existing schemas...');
        $db = DB::connection('eunomia');
        $db->statement('DROP SCHEMA IF EXISTS '.self::CDM_SCHEMA.' CASCADE');
        $db->statement('DROP SCHEMA IF EXISTS '.self::RESULTS_SCHEMA.' CASCADE');
        $this->info('Schemas dropped.');
    }

    private function createSchema(string $schema): void
    {
        DB::connection('eunomia')->statement("CREATE SCHEMA IF NOT EXISTS {$schema}");
        $this->info("Schema '{$schema}' ready.");
    }

    private function loadCdmTables(string $csvDir): int
    {
        $csvFiles = glob($csvDir.'/*.csv');
        if (! $csvFiles) {
            $this->error('No CSV files found in: '.$csvDir);

            return 0;
        }

        $totalRows = 0;
        $totalTables = 0;

        foreach ($csvFiles as $csvFile) {
            $tableName = strtolower(pathinfo($csvFile, PATHINFO_FILENAME));

            // Skip non-essential tables
            if (in_array($tableName, self::SKIP_TABLES, true)) {
                continue;
            }

            $rows = $this->loadSingleTable($csvFile, $tableName);
            if ($rows >= 0) {
                $totalRows += $rows;
                $totalTables++;
            }
        }

        $this->newLine();
        $this->info("Loaded {$totalRows} rows across {$totalTables} tables.");

        return $totalTables;
    }

    private function loadSingleTable(string $csvFile, string $tableName): int
    {
        $handle = fopen($csvFile, 'r');
        if ($handle === false) {
            $this->warn("Cannot open: {$csvFile}");

            return -1;
        }

        // Read header using CSV parser (handles quoted fields)
        $columns = fgetcsv($handle);
        if ($columns === false || empty($columns)) {
            fclose($handle);

            return -1;
        }

        $columns = array_map(fn ($col) => strtolower(trim($col)), $columns);

        if ($columns[0] === '') {
            fclose($handle);

            return -1;
        }

        $db = DB::connection('eunomia');
        $schema = self::CDM_SCHEMA;

        // Create table
        $columnDefs = array_map(
            fn ($col) => "\"{$col}\" ".$this->inferColumnType($col),
            $columns
        );
        $createSql = "CREATE TABLE IF NOT EXISTS {$schema}.{$tableName} (\n  "
            .implode(",\n  ", $columnDefs)."\n)";
        $db->statement($createSql);

        // Check if table already has data (idempotent)
        $existing = $db->selectOne("SELECT COUNT(*) as cnt FROM {$schema}.{$tableName}");
        if ((int) $existing->cnt > 0) {
            fclose($handle);
            $this->line("  {$tableName}: already loaded ({$existing->cnt} rows), skipping.");

            return (int) $existing->cnt;
        }

        // Convert CSV to PostgreSQL text format (tab-delimited, \N for nulls)
        $tempFile = tempnam(sys_get_temp_dir(), 'eun_') ?: '/tmp/eun_temp';
        $output = fopen($tempFile, 'w');
        if ($output === false) {
            fclose($handle);

            return -1;
        }

        $lineCount = 0;
        while (($fields = fgetcsv($handle)) !== false) {
            if ($fields === [null]) {
                continue; // skip blank lines
            }
            // Convert empty/null fields to a unique null marker
            // Use tab-delimited format with __EUNOMIA_NULL__ as null representation
            $processed = array_map(function ($f) {
                if ($f === null || $f === '') {
                    return '__EUNOMIA_NULL__';
                }
                // Escape backslashes and tabs for PG text format
                return str_replace(['\\', "\t"], ['\\\\', '\\t'], $f);
            }, $fields);
            fwrite($output, implode("\t", $processed)."\n");
            $lineCount++;
        }

        fclose($handle);
        fclose($output);

        if ($lineCount === 0) {
            unlink($tempFile);
            $this->line("  {$tableName}: empty (header only)");

            return 0;
        }

        // Load via COPY using PostgreSQL text format (tab-delimited, \N for nulls)
        $columnList = implode(',', array_map(fn ($c) => "\"{$c}\"", $columns));

        /** @var \PDO $pdo */
        $pdo = $db->getPdo();

        try {
            $pdo->pgsqlCopyFromFile(
                "{$schema}.{$tableName}",
                $tempFile,
                "\t",
                '__EUNOMIA_NULL__',
                $columnList
            );
        } catch (\Throwable $e) {
            $this->warn("  {$tableName}: COPY failed — {$e->getMessage()}");
            unlink($tempFile);

            return 0;
        }

        unlink($tempFile);

        $sizeMb = round(filesize($csvFile) / 1024 / 1024, 1);
        $this->info("  {$tableName}: {$lineCount} rows ({$sizeMb} MB)");

        return $lineCount;
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
            return 'integer';
        }
        // Vocabulary table IDs are string-based in OMOP CDM, not numeric.
        // e.g. domain_id='Condition', vocabulary_id='SNOMED', relationship_id='Maps to'
        if (in_array($col, [
            'domain_id', 'vocabulary_id', 'relationship_id', 'concept_class_id',
            'standard_concept', 'invalid_reason',
        ], true)) {
            return 'text';
        }
        if (str_ends_with($col, '_id')) {
            return 'bigint';
        }
        if (in_array($col, ['year_of_birth', 'month_of_birth', 'day_of_birth', 'priority', 'is_default'])) {
            return 'integer';
        }
        if (in_array($col, ['quantity', 'amount_value', 'numerator_value', 'denominator_value',
            'days_supply', 'range_low', 'range_high', 'value_as_number',
            'paid_copay', 'paid_coinsurance', 'paid_toward_deductible',
            'paid_by_payer', 'paid_by_coordination_benefits', 'total_paid',
            'total_out_of_pocket', 'total_payer', 'ingredient_cost',
            'dispensing_fee', 'average_wholesale_price'])) {
            return 'numeric';
        }

        return 'text';
    }

    private function createAchillesTables(): void
    {
        $schema = self::RESULTS_SCHEMA;
        $db = DB::connection('eunomia');

        $db->statement("
            CREATE TABLE IF NOT EXISTS {$schema}.achilles_results (
                analysis_id integer,
                stratum_1 varchar(255),
                stratum_2 varchar(255),
                stratum_3 varchar(255),
                stratum_4 varchar(255),
                stratum_5 varchar(255),
                count_value bigint
            )
        ");

        $db->statement("
            CREATE TABLE IF NOT EXISTS {$schema}.achilles_results_dist (
                analysis_id integer,
                stratum_1 varchar(255),
                stratum_2 varchar(255),
                stratum_3 varchar(255),
                stratum_4 varchar(255),
                stratum_5 varchar(255),
                count_value bigint,
                min_value numeric,
                max_value numeric,
                avg_value numeric,
                stdev_value numeric,
                median_value numeric,
                p10_value numeric,
                p25_value numeric,
                p75_value numeric,
                p90_value numeric
            )
        ");

        $db->statement("
            CREATE TABLE IF NOT EXISTS {$schema}.achilles_analysis (
                analysis_id integer,
                analysis_name varchar(255),
                stratum_1_name varchar(255),
                stratum_2_name varchar(255),
                stratum_3_name varchar(255),
                stratum_4_name varchar(255),
                stratum_5_name varchar(255),
                is_default integer,
                category varchar(255)
            )
        ");

        $this->info('Achilles tables created.');
    }

    private function runMiniAchilles(): void
    {
        $cdm = self::CDM_SCHEMA;
        $res = self::RESULTS_SCHEMA;
        $db = DB::connection('eunomia');

        // Clear any existing results
        $db->statement("TRUNCATE {$res}.achilles_results");
        $db->statement("TRUNCATE {$res}.achilles_results_dist");
        $db->statement("TRUNCATE {$res}.achilles_analysis");

        $this->info('Running mini-Achilles analyses...');

        // ── Demographics ──

        // Analysis 0 & 1: Total person count
        $db->statement("
            INSERT INTO {$res}.achilles_results (analysis_id, count_value)
            SELECT 0, COUNT(*) FROM {$cdm}.person
        ");
        $db->statement("
            INSERT INTO {$res}.achilles_results (analysis_id, count_value)
            SELECT 1, COUNT(*) FROM {$cdm}.person
        ");
        $this->line('  [1/20] Person count');

        // Analysis 2: Persons by gender
        $db->statement("
            INSERT INTO {$res}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 2, gender_concept_id::text, COUNT(*)
            FROM {$cdm}.person
            GROUP BY gender_concept_id
        ");
        $this->line('  [2/20] Gender distribution');

        // Analysis 3: Persons by year of birth
        $db->statement("
            INSERT INTO {$res}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 3, year_of_birth::text, COUNT(*)
            FROM {$cdm}.person
            GROUP BY year_of_birth
        ");
        $this->line('  [3/20] Year of birth distribution');

        // Analysis 4: Persons by race
        $db->statement("
            INSERT INTO {$res}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 4, race_concept_id::text, COUNT(*)
            FROM {$cdm}.person
            GROUP BY race_concept_id
        ");
        $this->line('  [4/20] Race distribution');

        // Analysis 5: Persons by ethnicity
        $db->statement("
            INSERT INTO {$res}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 5, ethnicity_concept_id::text, COUNT(*)
            FROM {$cdm}.person
            GROUP BY ethnicity_concept_id
        ");
        $this->line('  [5/20] Ethnicity distribution');

        // Analysis 10: Persons by year of birth × gender
        $db->statement("
            INSERT INTO {$res}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 10, year_of_birth::text, gender_concept_id::text, COUNT(*)
            FROM {$cdm}.person
            GROUP BY year_of_birth, gender_concept_id
        ");
        $this->line('  [6/20] Year of birth x gender');

        // ── Observation Periods ──

        // Analysis 101: Observation period count
        $db->statement("
            INSERT INTO {$res}.achilles_results (analysis_id, count_value)
            SELECT 101, COUNT(*) FROM {$cdm}.observation_period
        ");
        $this->line('  [7/20] Observation period count');

        // Analysis 105: Observation duration distribution (dist table)
        $db->statement("
            INSERT INTO {$res}.achilles_results_dist
                (analysis_id, count_value, min_value, max_value, avg_value, stdev_value,
                 median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT 105,
                COUNT(*),
                MIN(dur), MAX(dur), AVG(dur), STDDEV(dur),
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dur),
                PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY dur),
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY dur),
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY dur),
                PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY dur)
            FROM (
                SELECT (observation_period_end_date - observation_period_start_date)::integer AS dur
                FROM {$cdm}.observation_period
            ) sub
        ");
        $this->line('  [8/20] Observation duration distribution');

        // Analysis 108: Persons by number of observation periods
        $db->statement("
            INSERT INTO {$res}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 108, num_periods::text, COUNT(*)
            FROM (
                SELECT person_id, COUNT(*) AS num_periods
                FROM {$cdm}.observation_period
                GROUP BY person_id
            ) sub
            GROUP BY num_periods
        ");
        $this->line('  [9/20] Periods per person');

        // Analysis 109: Persons with continuous observation by year
        $db->statement("
            INSERT INTO {$res}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 109, yr::text, COUNT(DISTINCT person_id)
            FROM {$cdm}.observation_period,
                 generate_series(
                     EXTRACT(YEAR FROM observation_period_start_date)::int,
                     EXTRACT(YEAR FROM observation_period_end_date)::int
                 ) AS yr
            GROUP BY yr
        ");
        $this->line('  [10/20] Continuous observation by year');

        // Analysis 111: Observation period start month
        $db->statement("
            INSERT INTO {$res}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 111, to_char(observation_period_start_date, 'YYYYMM'), COUNT(*)
            FROM {$cdm}.observation_period
            GROUP BY to_char(observation_period_start_date, 'YYYYMM')
        ");
        $this->line('  [11/20] Obs start months');

        // Analysis 106: Observation period end month (used for end distribution)
        $db->statement("
            INSERT INTO {$res}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 106, to_char(observation_period_end_date, 'YYYYMM'), COUNT(*)
            FROM {$cdm}.observation_period
            GROUP BY to_char(observation_period_end_date, 'YYYYMM')
        ");
        $this->line('  [12/20] Obs end months');

        // Analysis 113: Age at first observation period (dist table)
        $db->statement("
            INSERT INTO {$res}.achilles_results_dist
                (analysis_id, count_value, min_value, max_value, avg_value, stdev_value,
                 median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT 113,
                COUNT(*), MIN(age), MAX(age), AVG(age), STDDEV(age),
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY age),
                PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY age),
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY age),
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY age),
                PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY age)
            FROM (
                SELECT EXTRACT(YEAR FROM op.observation_period_start_date)::int - p.year_of_birth AS age
                FROM {$cdm}.observation_period op
                JOIN {$cdm}.person p ON op.person_id = p.person_id
            ) sub
        ");
        $this->line('  [13/20] Age at first observation dist');

        // ── Domain Record Counts (per concept) ──

        $domainTables = [
            ['analysis' => 200, 'table' => 'visit_occurrence', 'concept_col' => 'visit_concept_id', 'date_col' => 'visit_start_date', 'type_col' => 'visit_type_concept_id', 'month_analysis' => 211, 'type_analysis' => 201, 'gender_analysis' => 202],
            ['analysis' => 400, 'table' => 'condition_occurrence', 'concept_col' => 'condition_concept_id', 'date_col' => 'condition_start_date', 'type_col' => 'condition_type_concept_id', 'month_analysis' => 411, 'type_analysis' => 401, 'gender_analysis' => 402],
            ['analysis' => 600, 'table' => 'procedure_occurrence', 'concept_col' => 'procedure_concept_id', 'date_col' => 'procedure_date', 'type_col' => 'procedure_type_concept_id', 'month_analysis' => 611, 'type_analysis' => 601, 'gender_analysis' => 602],
            ['analysis' => 700, 'table' => 'drug_exposure', 'concept_col' => 'drug_concept_id', 'date_col' => 'drug_exposure_start_date', 'type_col' => 'drug_type_concept_id', 'month_analysis' => 711, 'type_analysis' => 701, 'gender_analysis' => 702],
            ['analysis' => 800, 'table' => 'observation', 'concept_col' => 'observation_concept_id', 'date_col' => 'observation_date', 'type_col' => 'observation_type_concept_id', 'month_analysis' => 811, 'type_analysis' => 801, 'gender_analysis' => 802],
            ['analysis' => 1800, 'table' => 'measurement', 'concept_col' => 'measurement_concept_id', 'date_col' => 'measurement_date', 'type_col' => 'measurement_type_concept_id', 'month_analysis' => 1811, 'type_analysis' => 1801, 'gender_analysis' => 1802],
        ];

        $step = 14;
        foreach ($domainTables as $domain) {
            $t = $domain['table'];
            $c = $domain['concept_col'];
            $d = $domain['date_col'];
            $ty = $domain['type_col'];

            // Check if table exists and has data
            try {
                $count = $db->selectOne("SELECT COUNT(*) as cnt FROM {$cdm}.{$t}");
                if ((int) $count->cnt === 0) {
                    continue;
                }
            } catch (\Throwable) {
                continue;
            }

            // Record count per concept
            $db->statement("
                INSERT INTO {$res}.achilles_results (analysis_id, stratum_1, count_value)
                SELECT {$domain['analysis']}, {$c}::text, COUNT(*)
                FROM {$cdm}.{$t}
                GROUP BY {$c}
            ");

            // Monthly trends per concept
            $db->statement("
                INSERT INTO {$res}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
                SELECT {$domain['month_analysis']}, {$c}::text, to_char({$d}, 'YYYYMM'), COUNT(*)
                FROM {$cdm}.{$t}
                GROUP BY {$c}, to_char({$d}, 'YYYYMM')
            ");

            // Type distribution per concept
            $db->statement("
                INSERT INTO {$res}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
                SELECT {$domain['type_analysis']}, {$c}::text, {$ty}::text, COUNT(*)
                FROM {$cdm}.{$t}
                GROUP BY {$c}, {$ty}
            ");

            // Gender distribution per concept
            $db->statement("
                INSERT INTO {$res}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
                SELECT {$domain['gender_analysis']}, t.{$c}::text, p.gender_concept_id::text, COUNT(*)
                FROM {$cdm}.{$t} t
                JOIN {$cdm}.person p ON t.person_id = p.person_id
                GROUP BY t.{$c}, p.gender_concept_id
            ");

            $this->line("  [{$step}/20] {$t} analyses");
            $step++;
        }

        // ── Populate achilles_analysis catalog ──
        $this->populateAnalysisCatalog();

        // Count total results
        $resultCount = $db->selectOne("SELECT COUNT(*) as cnt FROM {$res}.achilles_results");
        $distCount = $db->selectOne("SELECT COUNT(*) as cnt FROM {$res}.achilles_results_dist");
        $this->newLine();
        $this->info("Mini-Achilles complete: {$resultCount->cnt} result rows, {$distCount->cnt} distribution rows.");
    }

    private function populateAnalysisCatalog(): void
    {
        $res = self::RESULTS_SCHEMA;
        $db = DB::connection('eunomia');

        $analyses = [
            [0, 'Number of persons', null, null, 'Person'],
            [1, 'Number of persons', null, null, 'Person'],
            [2, 'Number of persons by gender', 'gender_concept_id', null, 'Person'],
            [3, 'Number of persons by year of birth', 'year_of_birth', null, 'Person'],
            [4, 'Number of persons by race', 'race_concept_id', null, 'Person'],
            [5, 'Number of persons by ethnicity', 'ethnicity_concept_id', null, 'Person'],
            [10, 'Number of persons by year of birth by gender', 'year_of_birth', 'gender_concept_id', 'Person'],
            [101, 'Number of observation period records', null, null, 'Observation Period'],
            [105, 'Length of observation (days) of first observation period', null, null, 'Observation Period'],
            [106, 'Number of persons by observation period end month', 'calendar_month', null, 'Observation Period'],
            [108, 'Number of persons by number of observation periods', 'number_of_observation_periods', null, 'Observation Period'],
            [109, 'Number of persons with continuous observation in each year', 'calendar_year', null, 'Observation Period'],
            [111, 'Number of persons by observation period start month', 'calendar_month', null, 'Observation Period'],
            [113, 'Distribution of observation period length', null, null, 'Observation Period'],
            [200, 'Number of visit occurrence records by visit_concept_id', 'visit_concept_id', null, 'Visit'],
            [201, 'Number of visit occurrence records by visit type', 'visit_concept_id', 'visit_type_concept_id', 'Visit'],
            [202, 'Number of persons by visit type by gender', 'visit_concept_id', 'gender_concept_id', 'Visit'],
            [211, 'Number of visit records by visit concept and month', 'visit_concept_id', 'calendar_month', 'Visit'],
            [400, 'Number of condition occurrence records by condition_concept_id', 'condition_concept_id', null, 'Condition'],
            [401, 'Number of condition records by condition type', 'condition_concept_id', 'condition_type_concept_id', 'Condition'],
            [402, 'Number of persons by condition by gender', 'condition_concept_id', 'gender_concept_id', 'Condition'],
            [411, 'Number of condition records by concept and month', 'condition_concept_id', 'calendar_month', 'Condition'],
            [600, 'Number of procedure occurrence records by procedure_concept_id', 'procedure_concept_id', null, 'Procedure'],
            [601, 'Number of procedure records by procedure type', 'procedure_concept_id', 'procedure_type_concept_id', 'Procedure'],
            [602, 'Number of persons by procedure by gender', 'procedure_concept_id', 'gender_concept_id', 'Procedure'],
            [611, 'Number of procedure records by concept and month', 'procedure_concept_id', 'calendar_month', 'Procedure'],
            [700, 'Number of drug exposure records by drug_concept_id', 'drug_concept_id', null, 'Drug'],
            [701, 'Number of drug records by drug type', 'drug_concept_id', 'drug_type_concept_id', 'Drug'],
            [702, 'Number of persons by drug by gender', 'drug_concept_id', 'gender_concept_id', 'Drug'],
            [711, 'Number of drug records by concept and month', 'drug_concept_id', 'calendar_month', 'Drug'],
            [800, 'Number of observation records by observation_concept_id', 'observation_concept_id', null, 'Observation'],
            [801, 'Number of observation records by observation type', 'observation_concept_id', 'observation_type_concept_id', 'Observation'],
            [802, 'Number of persons by observation by gender', 'observation_concept_id', 'gender_concept_id', 'Observation'],
            [811, 'Number of observation records by concept and month', 'observation_concept_id', 'calendar_month', 'Observation'],
            [1800, 'Number of measurement records by measurement_concept_id', 'measurement_concept_id', null, 'Measurement'],
            [1801, 'Number of measurement records by measurement type', 'measurement_concept_id', 'measurement_type_concept_id', 'Measurement'],
            [1802, 'Number of persons by measurement by gender', 'measurement_concept_id', 'gender_concept_id', 'Measurement'],
            [1811, 'Number of measurement records by concept and month', 'measurement_concept_id', 'calendar_month', 'Measurement'],
        ];

        foreach ($analyses as [$id, $name, $s1, $s2, $category]) {
            $s1Sql = $s1 ? "'{$s1}'" : 'NULL';
            $s2Sql = $s2 ? "'{$s2}'" : 'NULL';
            $db->statement("
                INSERT INTO {$res}.achilles_analysis (analysis_id, analysis_name, stratum_1_name, stratum_2_name, is_default, category)
                VALUES ({$id}, '{$name}', {$s1Sql}, {$s2Sql}, 1, '{$category}')
            ");
        }
    }

    private function seedSource(): void
    {
        // Remove old key if present from a pre-2026-03-04 run
        Source::where('source_key', 'eunomia-gibleed')->delete();

        $source = Source::updateOrCreate(
            ['source_key' => 'EUNOMIA'],
            [
                'source_name' => 'Eunomia GiBleed',
                'source_dialect' => 'postgresql',
                'source_connection' => 'eunomia',
                'is_cache_enabled' => false,
            ]
        );

        $daimons = [
            ['daimon_type' => DaimonType::CDM->value,       'table_qualifier' => self::CDM_SCHEMA,     'priority' => 0],
            ['daimon_type' => DaimonType::Vocabulary->value, 'table_qualifier' => self::CDM_SCHEMA,     'priority' => 0],
            ['daimon_type' => DaimonType::Results->value,    'table_qualifier' => self::RESULTS_SCHEMA, 'priority' => 0],
        ];

        foreach ($daimons as $daimon) {
            SourceDaimon::updateOrCreate(
                ['source_id' => $source->id, 'daimon_type' => $daimon['daimon_type']],
                ['table_qualifier' => $daimon['table_qualifier'], 'priority' => $daimon['priority']]
            );
        }

        $verb = $source->wasRecentlyCreated ? 'Created' : 'Updated';
        $this->info("{$verb} source: {$source->source_name} (id={$source->id})");
    }

    private function cleanup(string $csvDir): void
    {
        // Remove extracted files
        $files = glob($csvDir.'/*');
        if ($files) {
            foreach ($files as $file) {
                @unlink($file);
            }
        }
        @rmdir($csvDir);

        // Remove __MACOSX if present
        $parent = dirname($csvDir);
        $macos = $parent.'/__MACOSX';
        if (is_dir($macos)) {
            $macFiles = glob($macos.'/**/*') ?: [];
            foreach (array_reverse($macFiles) as $file) {
                is_dir($file) ? @rmdir($file) : @unlink($file);
            }
            @rmdir($macos);
        }

        @rmdir($parent);
    }
}
