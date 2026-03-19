<?php

namespace App\Services\Ingestion;

use App\Models\App\IngestionJob;
use App\Models\App\SchemaMapping;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class CdmWriterService
{
    private const BATCH_SIZE = 1000;

    public function __construct(
        private readonly DomainRouterService $domainRouter,
    ) {}

    /**
     * Write source records to CDM tables based on schema and concept mappings.
     *
     * Loads the source file, applies schema mappings to route columns to CDM tables,
     * applies concept mappings for the concept triple pattern, and bulk inserts
     * into CDM tables using the cdm database connection.
     *
     * @return array<string, int>
     */
    public function writeRecords(IngestionJob $job): array
    {
        $counts = [];

        // Load schema mappings (only confirmed ones)
        $schemaMappings = $job->schemaMappings()
            ->where('is_confirmed', true)
            ->whereNotNull('cdm_table')
            ->get();

        if ($schemaMappings->isEmpty()) {
            Log::warning("No confirmed schema mappings for job {$job->id}");

            return $counts;
        }

        // Load concept mappings (reviewed and with valid target concept)
        $conceptMappings = $job->conceptMappings()
            ->where('is_reviewed', true)
            ->where('target_concept_id', '>', 0)
            ->get()
            ->keyBy(fn ($m) => "{$m->source_table}|{$m->source_column}|{$m->source_code}");

        // Load the source file
        $sourceProfile = $job->profiles()->first();

        if (! $sourceProfile) {
            Log::warning("No source profile for job {$job->id}");

            return $counts;
        }

        $filePath = Storage::disk('ingestion')->path($sourceProfile->storage_path);
        /** @var array<string, mixed>|null $formatMetadata */
        $formatMetadata = $sourceProfile->format_metadata;
        $delimiter = $formatMetadata['delimiter'] ?? ',';

        // Group schema mappings by CDM table
        $mappingsByTable = $schemaMappings->groupBy('cdm_table');

        // Read and process the source file
        $handle = fopen($filePath, 'r');

        if ($handle === false) {
            Log::error("Cannot open source file: {$filePath}");

            return $counts;
        }

        // Read header row
        $headers = fgetcsv($handle, 0, $delimiter);

        if ($headers === false) {
            fclose($handle);

            return $counts;
        }

        $headers = array_map('trim', $headers);
        $headerIndex = array_flip($headers);

        // Buffer rows per CDM table for batch insert
        /** @var array<string, list<array<string, mixed>>> $buffers */
        $buffers = [];

        foreach ($mappingsByTable->keys() as $table) {
            $buffers[$table] = [];
            $counts[$table] = 0;
        }

        $rowNumber = 0;

        while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
            $rowNumber++;

            foreach ($mappingsByTable as $cdmTable => $tableMappings) {
                $cdmRow = $this->buildCdmRow(
                    $row,
                    $headerIndex,
                    $tableMappings,
                    $conceptMappings,
                    $sourceProfile->file_name,
                    $cdmTable,
                );

                if (empty($cdmRow)) {
                    continue;
                }

                $buffers[$cdmTable][] = $cdmRow;

                if (count($buffers[$cdmTable]) >= self::BATCH_SIZE) {
                    $this->flushBuffer($cdmTable, $buffers[$cdmTable]);
                    $counts[$cdmTable] += count($buffers[$cdmTable]);
                    $buffers[$cdmTable] = [];
                }
            }
        }

        fclose($handle);

        // Flush remaining buffers
        foreach ($buffers as $cdmTable => $rows) {
            if (! empty($rows)) {
                $this->flushBuffer($cdmTable, $rows);
                $counts[$cdmTable] += count($rows);
            }
        }

        return $counts;
    }

    /**
     * Build a single CDM row from a source row using the schema mappings.
     *
     * @param  list<string>  $row
     * @param  array<string, int>  $headerIndex
     * @param  \Illuminate\Support\Collection<int, \App\Models\App\SchemaMapping>  $tableMappings
     * @param  \Illuminate\Support\Collection<string, \App\Models\App\ConceptMapping>  $conceptMappings
     * @return array<string, mixed>
     */
    private function buildCdmRow(
        array $row,
        array $headerIndex,
        $tableMappings,
        $conceptMappings,
        string $sourceTable,
        string $cdmTable,
    ): array {
        $cdmRow = [];

        foreach ($tableMappings as $mapping) {
            $sourceColIndex = $headerIndex[$mapping->source_column] ?? null;

            if ($sourceColIndex === null) {
                continue;
            }

            $sourceValue = $row[$sourceColIndex] ?? null;

            if ($sourceValue === null || trim($sourceValue) === '') {
                continue;
            }

            $sourceValue = trim($sourceValue);

            // Apply transform if configured
            $value = $this->applyTransform($sourceValue, $mapping);
            $cdmRow[$mapping->cdm_column] = $value;

            // Apply concept triple pattern for concept_id columns
            $this->applyConceptTriple(
                $cdmRow,
                $mapping,
                $sourceValue,
                $conceptMappings,
                $sourceTable,
                $cdmTable,
            );
        }

        return $cdmRow;
    }

    /**
     * Apply transformation logic to a source value.
     */
    private function applyTransform(string $value, SchemaMapping $mapping): mixed
    {
        /** @var array<string, mixed>|null $transformConfig */
        $transformConfig = $mapping->transform_config;

        return match ($mapping->mapping_logic) {
            'transform' => $this->applyTransformConfig($value, $transformConfig ?? []),
            'constant' => $transformConfig['value'] ?? $value,
            default => $value,
        };
    }

    /**
     * Apply transform config to a value.
     *
     * @param  array<string, mixed>  $config
     */
    private function applyTransformConfig(string $value, array $config): mixed
    {
        $type = $config['type'] ?? null;

        return match ($type) {
            'date_format' => $this->transformDate($value, $config),
            'integer' => (int) $value,
            'decimal' => (float) $value,
            'uppercase' => strtoupper($value),
            'lowercase' => strtolower($value),
            default => $value,
        };
    }

    /**
     * Transform a date value using the configured format.
     *
     * @param  array<string, mixed>  $config
     */
    private function transformDate(string $value, array $config): ?string
    {
        $inputFormat = $config['input_format'] ?? 'Y-m-d';
        $outputFormat = $config['output_format'] ?? 'Y-m-d';

        $date = \DateTime::createFromFormat($inputFormat, $value);

        if ($date === false) {
            return null;
        }

        return $date->format($outputFormat);
    }

    /**
     * Apply the OMOP concept triple pattern:
     * - {domain}_concept_id (standard concept)
     * - {domain}_source_concept_id (source concept)
     * - {domain}_source_value (original value)
     *
     * @param  array<string, mixed>  &$cdmRow
     * @param  \Illuminate\Support\Collection<string, \App\Models\App\ConceptMapping>  $conceptMappings
     */
    private function applyConceptTriple(
        array &$cdmRow,
        SchemaMapping $mapping,
        string $sourceValue,
        Collection $conceptMappings,
        string $sourceTable,
        string $cdmTable,
    ): void {
        // Only apply for source_value columns that might have concept mappings
        if (! str_ends_with($mapping->cdm_column, '_source_value')) {
            return;
        }

        $prefix = $this->domainRouter->getConceptPrefix($cdmTable);

        if ($prefix === null) {
            return;
        }

        // Look up concept mapping for this source value
        $lookupKey = "{$sourceTable}|{$mapping->source_column}|{$sourceValue}";
        $conceptMapping = $conceptMappings->get($lookupKey);

        if ($conceptMapping && $conceptMapping->target_concept_id > 0) {
            $cdmRow["{$prefix}_concept_id"] = $conceptMapping->target_concept_id;
            $cdmRow["{$prefix}_source_concept_id"] = $conceptMapping->target_concept_id;
        } else {
            $cdmRow["{$prefix}_concept_id"] = 0;
            $cdmRow["{$prefix}_source_concept_id"] = 0;
        }
    }

    /**
     * Flush a batch of rows to the CDM database.
     *
     * @param  list<array<string, mixed>>  $rows
     */
    private function flushBuffer(string $table, array $rows): void
    {
        if (empty($rows)) {
            return;
        }

        try {
            DB::connection('omop')->table($table)->insert($rows);
        } catch (\Exception $e) {
            Log::error("CDM write error for table {$table}: {$e->getMessage()}", [
                'table' => $table,
                'row_count' => count($rows),
            ]);

            throw $e;
        }
    }
}
