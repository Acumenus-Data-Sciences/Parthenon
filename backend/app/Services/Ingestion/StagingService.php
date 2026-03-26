<?php

namespace App\Services\Ingestion;

use App\Models\App\IngestionJob;
use App\Models\App\IngestionProject;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use RuntimeException;

class StagingService
{
    /**
     * Create the staging schema for a project if it does not already exist.
     */
    public function createSchema(IngestionProject $project): void
    {
        $schema = $project->staging_schema;

        DB::connection('pgsql')->statement(
            'CREATE SCHEMA IF NOT EXISTS '.$this->quoteIdentifier($schema)
        );
    }

    /**
     * Stage a file into the project's staging schema.
     *
     * @return int Total rows loaded
     */
    public function stageFile(
        IngestionProject $project,
        IngestionJob $job,
        string $filePath,
        string $tableName,
        string $format,
    ): int {
        $this->createSchema($project);

        $schema = $project->staging_schema;
        $sanitizedTable = ColumnNameSanitizer::sanitizeTableName($tableName);

        if ($format === 'csv') {
            $delimiter = $this->detectDelimiter($filePath);
            $headers = $this->readCsvHeaders($filePath, $delimiter);
            $columnNames = array_map(
                [ColumnNameSanitizer::class, 'sanitizeColumnName'],
                $headers,
            );
            $columnNames = ColumnNameSanitizer::deduplicateNames($columnNames);

            $this->createTable($schema, $sanitizedTable, $columnNames);

            return $this->loadCsv($schema, $sanitizedTable, $filePath, $delimiter, $columnNames);
        }

        if (in_array($format, ['xlsx', 'xls', 'excel'], true)) {
            return $this->loadExcel($schema, $sanitizedTable, $filePath, []);
        }

        throw new RuntimeException("Unsupported file format: {$format}");
    }

    /**
     * Create a staging table with __row_id SERIAL PRIMARY KEY and TEXT columns.
     *
     * @param  list<string>  $columnNames  Already-sanitized column names
     */
    public function createTable(string $schema, string $tableName, array $columnNames): void
    {
        $quotedSchema = $this->quoteIdentifier($schema);
        $quotedTable = $this->quoteIdentifier($tableName);

        $columnDefs = [$this->quoteIdentifier('__row_id').' SERIAL PRIMARY KEY'];
        foreach ($columnNames as $col) {
            $columnDefs[] = $this->quoteIdentifier($col).' TEXT';
        }

        $sql = sprintf(
            'CREATE TABLE %s.%s (%s)',
            $quotedSchema,
            $quotedTable,
            implode(', ', $columnDefs),
        );

        DB::connection('pgsql')->statement($sql);
    }

    /**
     * Load a CSV file into a staging table using PostgreSQL COPY.
     *
     * @param  list<string>  $columnNames  Already-sanitized column names
     * @return int Number of rows loaded
     */
    public function loadCsv(
        string $schema,
        string $tableName,
        string $filePath,
        string $delimiter,
        array $columnNames,
    ): int {
        // Strip the header row into a temp file for COPY
        $tempFile = tempnam(sys_get_temp_dir(), 'staging_csv_');

        try {
            $input = fopen($filePath, 'r');
            $output = fopen($tempFile, 'w');

            // Skip header line
            fgets($input);

            while (($line = fgets($input)) !== false) {
                fwrite($output, $line);
            }

            fclose($input);
            fclose($output);

            $columnList = implode(', ', array_map(
                fn (string $col): string => $this->quoteIdentifier($col),
                $columnNames,
            ));

            /** @var \PDO $pdo */
            $pdo = DB::connection('pgsql')->getPdo();

            $pdo->pgsqlCopyFromFile(
                "{$schema}.{$tableName}",
                $tempFile,
                $delimiter,
                '',    // null_as
                $columnList,
            );
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }

        return $this->countRows($schema, $tableName);
    }

    /**
     * Load an Excel file into staging tables (one table per worksheet).
     *
     * @param  list<string>  $columnNames  Ignored for Excel — headers are read from each sheet
     * @return int Total rows loaded across all sheets
     */
    public function loadExcel(
        string $schema,
        string $tableName,
        string $filePath,
        array $columnNames,
    ): int {
        $fileSize = filesize($filePath);
        if ($fileSize > 100 * 1024 * 1024) {
            throw new RuntimeException(
                "Excel file exceeds 100MB limit ({$this->formatBytes($fileSize)}). "
                .'Convert to CSV for large datasets.'
            );
        }

        $reader = IOFactory::createReaderForFile($filePath);
        $reader->setReadDataOnly(true);

        $spreadsheet = $reader->load($filePath);
        $totalRows = 0;

        foreach ($spreadsheet->getSheetNames() as $sheetIndex => $sheetName) {
            $worksheet = $spreadsheet->getSheet($sheetIndex);

            $highestRow = $worksheet->getHighestRow();
            $highestColumn = $worksheet->getHighestColumn();

            if ($highestRow < 2) {
                // No data rows (only header or empty)
                continue;
            }

            // Read header row
            $headers = [];
            $headerRow = $worksheet->rangeToArray("A1:{$highestColumn}1", null, false, false)[0];
            foreach ($headerRow as $cell) {
                $headers[] = (string) ($cell ?? '');
            }

            // Filter out empty trailing headers
            while (count($headers) > 0 && $headers[count($headers) - 1] === '') {
                array_pop($headers);
            }

            if (count($headers) === 0) {
                continue;
            }

            $sanitizedColumns = array_map(
                [ColumnNameSanitizer::class, 'sanitizeColumnName'],
                $headers,
            );
            $sanitizedColumns = ColumnNameSanitizer::deduplicateNames($sanitizedColumns);

            // Determine sheet table name
            $sheetCount = count($spreadsheet->getSheetNames());
            $sheetTableName = $sheetCount > 1
                ? ColumnNameSanitizer::sanitizeTableName($tableName.'_'.$sheetName)
                : $tableName;

            $this->createTable($schema, $sheetTableName, $sanitizedColumns);

            // Batch insert in chunks of 1000
            $colCount = count($sanitizedColumns);
            $batch = [];
            $batchSize = 1000;

            for ($row = 2; $row <= $highestRow; $row++) {
                $rowData = $worksheet->rangeToArray("A{$row}:{$highestColumn}{$row}", null, false, false)[0];
                // Trim or pad to match column count
                $rowData = array_slice($rowData, 0, $colCount);
                while (count($rowData) < $colCount) {
                    $rowData[] = null;
                }

                $batch[] = $rowData;

                if (count($batch) >= $batchSize) {
                    $this->insertBatch($schema, $sheetTableName, $sanitizedColumns, $batch);
                    $batch = [];
                }
            }

            // Flush remaining rows
            if (count($batch) > 0) {
                $this->insertBatch($schema, $sheetTableName, $sanitizedColumns, $batch);
            }

            $totalRows += $this->countRows($schema, $sheetTableName);
        }

        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        return $totalRows;
    }

    /**
     * Drop a staging table.
     */
    public function dropTable(string $schema, string $tableName): void
    {
        $sql = sprintf(
            'DROP TABLE IF EXISTS %s.%s',
            $this->quoteIdentifier($schema),
            $this->quoteIdentifier($tableName),
        );

        DB::connection('pgsql')->statement($sql);
    }

    /**
     * Drop an entire staging schema and all its contents.
     */
    public function dropSchema(string $schema): void
    {
        $sql = sprintf(
            'DROP SCHEMA IF EXISTS %s CASCADE',
            $this->quoteIdentifier($schema),
        );

        DB::connection('pgsql')->statement($sql);
    }

    /**
     * Preview rows from a staging table.
     *
     * @return array{columns: list<string>, rows: list<array<string, mixed>>, total: int}
     */
    public function previewTable(string $schema, string $tableName, int $limit = 100, int $offset = 0): array
    {
        $quotedSchema = $this->quoteIdentifier($schema);
        $quotedTable = $this->quoteIdentifier($tableName);

        $total = $this->countRows($schema, $tableName);

        $rows = DB::connection('pgsql')
            ->select(
                "SELECT * FROM {$quotedSchema}.{$quotedTable} ORDER BY \"__row_id\" LIMIT ? OFFSET ?",
                [$limit, $offset],
            );

        // Convert stdClass rows to arrays
        $rowArrays = array_map(fn ($row) => (array) $row, $rows);

        // Extract column names from first row or table metadata
        $columns = [];
        if (count($rowArrays) > 0) {
            $columns = array_keys($rowArrays[0]);
        } else {
            // Query information_schema for column names
            $colInfo = DB::connection('pgsql')
                ->select(
                    'SELECT column_name FROM information_schema.columns '
                    .'WHERE table_schema = ? AND table_name = ? '
                    .'ORDER BY ordinal_position',
                    [$schema, $tableName],
                );
            $columns = array_map(fn ($col) => $col->column_name, $colInfo);
        }

        return [
            'columns' => $columns,
            'rows' => $rowArrays,
            'total' => $total,
        ];
    }

    /**
     * Quote a PostgreSQL identifier (schema, table, or column name).
     */
    public function quoteIdentifier(string $name): string
    {
        return '"'.str_replace('"', '""', $name).'"';
    }

    /**
     * Detect CSV delimiter by counting occurrences in the first line.
     */
    private function detectDelimiter(string $filePath): string
    {
        $handle = fopen($filePath, 'r');
        $firstLine = fgets($handle);
        fclose($handle);

        if ($firstLine === false) {
            return ',';
        }

        $delimiters = [',' => 0, "\t" => 0, '|' => 0, ';' => 0];
        foreach ($delimiters as $d => &$count) {
            $count = substr_count($firstLine, $d);
        }

        return array_search(max($delimiters), $delimiters);
    }

    /**
     * Read CSV headers from the first line of a file.
     *
     * @return list<string>
     */
    private function readCsvHeaders(string $filePath, string $delimiter): array
    {
        $handle = fopen($filePath, 'r');
        $headers = fgetcsv($handle, 0, $delimiter);
        fclose($handle);

        if ($headers === false || $headers === [null]) {
            throw new RuntimeException("Could not read headers from CSV file: {$filePath}");
        }

        return array_map('trim', $headers);
    }

    /**
     * Count rows in a table.
     */
    private function countRows(string $schema, string $tableName): int
    {
        $result = DB::connection('pgsql')
            ->selectOne(
                sprintf(
                    'SELECT count(*) as cnt FROM %s.%s',
                    $this->quoteIdentifier($schema),
                    $this->quoteIdentifier($tableName),
                ),
            );

        return (int) $result->cnt;
    }

    /**
     * Insert a batch of rows using parameterized INSERT.
     *
     * @param  list<string>  $columnNames
     * @param  list<list<mixed>>  $rows
     */
    private function insertBatch(string $schema, string $tableName, array $columnNames, array $rows): void
    {
        if (count($rows) === 0) {
            return;
        }

        $quotedSchema = $this->quoteIdentifier($schema);
        $quotedTable = $this->quoteIdentifier($tableName);
        $quotedColumns = implode(', ', array_map(
            fn (string $col): string => $this->quoteIdentifier($col),
            $columnNames,
        ));

        $colCount = count($columnNames);
        $placeholders = '('.implode(', ', array_fill(0, $colCount, '?')).')';
        $allPlaceholders = implode(', ', array_fill(0, count($rows), $placeholders));

        $values = [];
        foreach ($rows as $row) {
            foreach ($row as $cell) {
                $values[] = $cell !== null ? (string) $cell : null;
            }
        }

        DB::connection('pgsql')->insert(
            "INSERT INTO {$quotedSchema}.{$quotedTable} ({$quotedColumns}) VALUES {$allPlaceholders}",
            $values,
        );
    }

    private function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $unitIndex = 0;
        $size = (float) $bytes;

        while ($size >= 1024 && $unitIndex < count($units) - 1) {
            $size /= 1024;
            $unitIndex++;
        }

        return round($size, 1).' '.$units[$unitIndex];
    }
}
