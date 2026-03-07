<?php

namespace App\Console\Commands;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Services\Solr\SolrClientWrapper;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SolrIndexClinical extends Command
{
    protected $signature = 'solr:index-clinical
        {--source= : Only index events for a specific source ID}
        {--fresh : Delete all documents before indexing}
        {--domain= : Only index a specific domain (condition/drug/procedure/measurement/observation/visit)}
        {--limit=0 : Maximum events per domain per source (0=unlimited)}';

    protected $description = 'Index clinical events from CDM tables into the Solr clinical core';

    /** @var array<string, array{table: string, id_col: string, concept_col: string, start_col: string, end_col: string|null, extra_cols: list<string>}> */
    private array $domains = [
        'condition' => [
            'table' => 'condition_occurrence',
            'id_col' => 'condition_occurrence_id',
            'concept_col' => 'condition_concept_id',
            'start_col' => 'condition_start_date',
            'end_col' => 'condition_end_date',
            'type_col' => 'condition_type_concept_id',
            'extra_cols' => [],
        ],
        'drug' => [
            'table' => 'drug_exposure',
            'id_col' => 'drug_exposure_id',
            'concept_col' => 'drug_concept_id',
            'start_col' => 'drug_exposure_start_date',
            'end_col' => 'drug_exposure_end_date',
            'type_col' => 'drug_type_concept_id',
            'extra_cols' => [],
        ],
        'procedure' => [
            'table' => 'procedure_occurrence',
            'id_col' => 'procedure_occurrence_id',
            'concept_col' => 'procedure_concept_id',
            'start_col' => 'procedure_date',
            'end_col' => null,
            'type_col' => 'procedure_type_concept_id',
            'extra_cols' => [],
        ],
        'measurement' => [
            'table' => 'measurement',
            'id_col' => 'measurement_id',
            'concept_col' => 'measurement_concept_id',
            'start_col' => 'measurement_date',
            'end_col' => null,
            'type_col' => 'measurement_type_concept_id',
            'extra_cols' => ['value_as_number', 'value_source_value'],
        ],
        'observation' => [
            'table' => 'observation',
            'id_col' => 'observation_id',
            'concept_col' => 'observation_concept_id',
            'start_col' => 'observation_date',
            'end_col' => null,
            'type_col' => 'observation_type_concept_id',
            'extra_cols' => ['value_as_number', 'value_as_string'],
        ],
        'visit' => [
            'table' => 'visit_occurrence',
            'id_col' => 'visit_occurrence_id',
            'concept_col' => 'visit_concept_id',
            'start_col' => 'visit_start_date',
            'end_col' => 'visit_end_date',
            'type_col' => 'visit_type_concept_id',
            'extra_cols' => [],
        ],
    ];

    public function handle(SolrClientWrapper $solr, SqlRendererService $sqlRenderer): int
    {
        if (! $solr->isEnabled()) {
            $this->error('Solr is not enabled. Set SOLR_ENABLED=true in .env');

            return self::FAILURE;
        }

        $core = config('solr.cores.clinical', 'clinical');

        if (! $solr->ping($core)) {
            $this->error("Cannot reach Solr core '{$core}'. Is the Solr container running?");

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->info('Deleting all existing documents...');
            $solr->deleteAll($core);
        }

        $sourceId = $this->option('source');
        $domainFilter = $this->option('domain');
        $maxLimit = (int) $this->option('limit');

        $sources = $sourceId
            ? Source::where('id', $sourceId)->with('daimons')->get()
            : Source::whereHas('daimons', fn ($q) => $q->where('daimon_type', 'cdm'))->with('daimons')->get();

        if ($sources->isEmpty()) {
            $this->warn('No sources with CDM daimons found.');

            return self::SUCCESS;
        }

        $totalIndexed = 0;
        $totalErrors = 0;
        $startTime = microtime(true);

        foreach ($sources as $source) {
            $this->info("Indexing clinical events for source: {$source->source_name} (ID: {$source->id})...");

            $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
            $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;

            if (! $cdmSchema) {
                $this->warn('  Skipping — no CDM schema configured.');

                continue;
            }

            $connectionName = $source->source_connection ?? 'cdm';
            $dialect = $source->source_dialect ?? 'postgresql';

            $domainsToIndex = $domainFilter
                ? [$domainFilter => $this->domains[$domainFilter] ?? null]
                : $this->domains;

            foreach ($domainsToIndex as $domainName => $domainConfig) {
                if (! $domainConfig) {
                    $this->warn("  Unknown domain: {$domainName}");

                    continue;
                }

                $this->line("  Indexing {$domainName}...");

                try {
                    [$indexed, $errors] = $this->indexDomain(
                        $solr,
                        $sqlRenderer,
                        $core,
                        $source,
                        $domainName,
                        $domainConfig,
                        $cdmSchema,
                        $vocabSchema,
                        $connectionName,
                        $dialect,
                        $maxLimit,
                    );
                    $totalIndexed += $indexed;
                    $totalErrors += $errors;
                    $this->line("    {$indexed} events indexed.");
                } catch (\Throwable $e) {
                    $this->warn("    Failed: {$e->getMessage()}");
                    $totalErrors++;
                }
            }
        }

        $this->info('Committing...');
        $solr->commit($core);

        $elapsed = round(microtime(true) - $startTime, 1);
        $docCount = $solr->documentCount($core);

        $this->info("Total indexed: {$totalIndexed} | Errors: {$totalErrors} | Time: {$elapsed}s");
        $this->info("Solr document count: {$docCount}");

        if ($totalErrors > 0) {
            $this->warn("Completed with {$totalErrors} errors.");

            return self::FAILURE;
        }

        $this->info('Clinical indexing complete.');

        return self::SUCCESS;
    }

    /**
     * @param  array<string, mixed>  $domainConfig
     * @return array{0: int, 1: int}
     */
    private function indexDomain(
        SolrClientWrapper $solr,
        SqlRendererService $sqlRenderer,
        string $core,
        Source $source,
        string $domainName,
        array $domainConfig,
        string $cdmSchema,
        string $vocabSchema,
        string $connectionName,
        string $dialect,
        int $maxLimit,
    ): array {
        $table = $domainConfig['table'];
        $idCol = $domainConfig['id_col'];
        $conceptCol = $domainConfig['concept_col'];
        $startCol = $domainConfig['start_col'];
        $endCol = $domainConfig['end_col'] ?? null;
        $typeCol = $domainConfig['type_col'] ?? null;
        $extraCols = $domainConfig['extra_cols'] ?? [];

        // Build SELECT list
        $selectParts = [
            "t.{$idCol} AS occurrence_id",
            't.person_id',
            "t.{$conceptCol} AS concept_id",
            "COALESCE(c.concept_name, 'Unknown') AS concept_name",
            "COALESCE(c.domain_id, '') AS domain_id",
            "COALESCE(c.vocabulary_id, '') AS vocabulary_id",
            "t.{$startCol} AS event_date",
        ];

        if ($endCol) {
            $selectParts[] = "t.{$endCol} AS event_end_date";
        }

        if ($typeCol) {
            $selectParts[] = "COALESCE(tc.concept_name, '') AS type_concept_name";
        }

        foreach ($extraCols as $col) {
            $selectParts[] = "t.{$col}";
        }

        $selectSql = implode(",\n                ", $selectParts);
        $typeJoin = $typeCol
            ? "LEFT JOIN {@vocabSchema}.concept tc ON t.{$typeCol} = tc.concept_id"
            : '';

        $limitClause = $maxLimit > 0 ? "LIMIT {$maxLimit}" : '';

        $sql = "
            SELECT
                {$selectSql}
            FROM {@cdmSchema}.{$table} t
            LEFT JOIN {@vocabSchema}.concept c ON t.{$conceptCol} = c.concept_id
            {$typeJoin}
            ORDER BY t.{$idCol}
            {$limitClause}
        ";

        $params = ['cdmSchema' => $cdmSchema, 'vocabSchema' => $vocabSchema];
        $renderedSql = $sqlRenderer->render($sql, $params, $dialect);

        $conn = DB::connection($connectionName);
        $conn->statement('SET statement_timeout = 300000');

        $indexed = 0;
        $errors = 0;
        $batch = [];
        $batchSize = 500;

        // Use cursor for memory efficiency on large tables
        $cursor = $conn->cursor($renderedSql);

        foreach ($cursor as $row) {
            $row = (array) $row;

            $doc = [
                'event_id' => "{$domainName}_{$source->id}_{$row['occurrence_id']}",
                'event_type' => $domainName,
                'person_id' => (int) $row['person_id'],
                'concept_id' => (int) $row['concept_id'],
                'concept_name' => $row['concept_name'] ?? 'Unknown',
                'domain_id' => $row['domain_id'] ?? '',
                'vocabulary_id' => $row['vocabulary_id'] ?? '',
                'source_id' => $source->id,
                'source_name' => $source->source_name,
            ];

            // Event date — convert to Solr ISO format
            if (! empty($row['event_date'])) {
                $doc['event_date'] = date('Y-m-d\TH:i:s\Z', strtotime((string) $row['event_date']));
            }
            if (! empty($row['event_end_date'])) {
                $doc['event_end_date'] = date('Y-m-d\TH:i:s\Z', strtotime((string) $row['event_end_date']));
            }

            if (isset($row['type_concept_name'])) {
                $doc['type_concept_name'] = $row['type_concept_name'];
            }

            if (isset($row['value_as_number']) && $row['value_as_number'] !== null) {
                $doc['value_as_number'] = (float) $row['value_as_number'];
            }
            if (isset($row['value_as_string']) && $row['value_as_string'] !== null) {
                $doc['value_as_string'] = (string) $row['value_as_string'];
            }
            if (isset($row['value_source_value']) && $row['value_source_value'] !== null) {
                $doc['value_as_string'] = (string) $row['value_source_value'];
            }

            // Unit from measurement (unit_concept_id would need join — skip for now, use source value)

            $batch[] = $doc;

            if (count($batch) >= $batchSize) {
                if ($solr->addDocuments($core, $batch)) {
                    $indexed += count($batch);
                } else {
                    $errors += count($batch);
                }
                $batch = [];

                // Progress output every 5000
                if ($indexed % 5000 === 0 && $indexed > 0) {
                    $this->line("    ... {$indexed} events indexed so far");
                }
            }
        }

        // Flush remaining batch
        if (! empty($batch)) {
            if ($solr->addDocuments($core, $batch)) {
                $indexed += count($batch);
            } else {
                $errors += count($batch);
            }
        }

        $conn->statement('SET statement_timeout = 0');

        return [$indexed, $errors];
    }
}
