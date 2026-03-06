<?php

namespace App\Services\WebApi;

use App\Models\App\AtlasIdMapping;
use App\Models\App\AtlasMigration;
use App\Models\App\Characterization;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\App\EstimationAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AtlasEntityImporter
{
    private const ENTITY_ORDER = [
        'concept_sets',
        'cohort_definitions',
        'incidence_rates',
        'characterizations',
        'pathways',
        'estimations',
        'predictions',
    ];

    public function __construct(
        private readonly AtlasDiscoveryService $discovery,
    ) {}

    /**
     * Import selected entities for a migration in dependency order.
     */
    public function import(AtlasMigration $migration): void
    {
        $selected = $migration->selected_entities ?? [];
        $baseUrl = rtrim($migration->webapi_url, '/');
        $client = $this->discovery->buildClient($baseUrl, $migration->auth_type, $migration->auth_credentials);

        $totalCount = 0;
        foreach ($selected as $ids) {
            $totalCount += is_array($ids) ? count($ids) : 0;
        }

        $migration->update([
            'status' => 'importing',
            'started_at' => now(),
            'total_entities' => $totalCount,
            'imported_entities' => 0,
            'failed_entities' => 0,
            'skipped_entities' => 0,
        ]);

        $results = [];

        try {
            foreach (self::ENTITY_ORDER as $entityType) {
                $ids = $selected[$entityType] ?? [];
                if (empty($ids)) {
                    continue;
                }

                $migration->update(['current_step' => "Importing {$entityType}"]);

                $result = match ($entityType) {
                    'concept_sets' => $this->importConceptSets($migration, $ids, $client, $baseUrl),
                    'cohort_definitions' => $this->importCohortDefinitions($migration, $ids, $client, $baseUrl),
                    'incidence_rates' => $this->importIncidenceRates($migration, $ids, $client, $baseUrl),
                    'characterizations' => $this->importCharacterizations($migration, $ids, $client, $baseUrl),
                    'pathways' => $this->importPathways($migration, $ids, $client, $baseUrl),
                    'estimations' => $this->importEstimations($migration, $ids, $client, $baseUrl),
                    'predictions' => $this->importPredictions($migration, $ids, $client, $baseUrl),
                };

                $results[$entityType] = $result;
            }

            $migration->update([
                'status' => 'completed',
                'current_step' => null,
                'import_results' => $results,
                'completed_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Atlas migration failed', [
                'migration_id' => $migration->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $migration->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'import_results' => $results,
                'completed_at' => now(),
            ]);
        }
    }

    /**
     * @param  int[]  $ids  Atlas concept set IDs
     * @return array{imported: int, skipped: int, failed: int}
     */
    private function importConceptSets(AtlasMigration $migration, array $ids, PendingRequest $client, string $baseUrl): array
    {
        $imported = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($ids as $atlasId) {
            try {
                // Get concept set metadata
                $metaResponse = $client->get("{$baseUrl}/conceptset/{$atlasId}");
                if (! $metaResponse->successful()) {
                    $this->recordMapping($migration, 'concept_set', $atlasId, null, "ID {$atlasId}", 'failed', "HTTP {$metaResponse->status()}");
                    $failed++;
                    $this->incrementProgress($migration, 'failed');

                    continue;
                }

                $meta = $metaResponse->json();
                $name = $meta['name'] ?? "Atlas CS {$atlasId}";

                // Check if name already exists
                if (ConceptSet::where('name', $name)->exists()) {
                    $this->recordMapping($migration, 'concept_set', $atlasId, null, $name, 'skipped', 'Already exists');
                    $skipped++;
                    $this->incrementProgress($migration, 'skipped');

                    continue;
                }

                // Get expression (items)
                $exprResponse = $client->get("{$baseUrl}/conceptset/{$atlasId}/expression");
                $expression = $exprResponse->successful() ? $exprResponse->json() : null;

                DB::transaction(function () use ($migration, $atlasId, $meta, $name, $expression, &$imported) {
                    $conceptSet = ConceptSet::create([
                        'name' => $name,
                        'description' => $meta['description'] ?? null,
                        'expression_json' => $expression,
                        'author_id' => $migration->created_by,
                    ]);

                    // Create items from expression
                    $items = $expression['items'] ?? $expression ?? [];
                    if (is_array($items)) {
                        foreach ($items as $item) {
                            $concept = $item['concept'] ?? $item;
                            $conceptId = $concept['CONCEPT_ID'] ?? $concept['conceptId'] ?? null;

                            if ($conceptId) {
                                ConceptSetItem::create([
                                    'concept_set_id' => $conceptSet->id,
                                    'concept_id' => (int) $conceptId,
                                    'is_excluded' => (bool) ($item['isExcluded'] ?? false),
                                    'include_descendants' => (bool) ($item['includeDescendants'] ?? false),
                                    'include_mapped' => (bool) ($item['includeMapped'] ?? false),
                                ]);
                            }
                        }
                    }

                    $this->recordMapping($migration, 'concept_set', $atlasId, $conceptSet->id, $name, 'imported');
                    $imported++;
                });

                $this->incrementProgress($migration, 'imported');
            } catch (\Throwable $e) {
                Log::warning('Atlas concept set import failed', ['atlas_id' => $atlasId, 'error' => $e->getMessage()]);
                $this->recordMapping($migration, 'concept_set', $atlasId, null, "ID {$atlasId}", 'failed', $e->getMessage());
                $failed++;
                $this->incrementProgress($migration, 'failed');
            }
        }

        return compact('imported', 'skipped', 'failed');
    }

    /**
     * @param  int[]  $ids  Atlas cohort definition IDs
     * @return array{imported: int, skipped: int, failed: int}
     */
    private function importCohortDefinitions(AtlasMigration $migration, array $ids, PendingRequest $client, string $baseUrl): array
    {
        $imported = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($ids as $atlasId) {
            try {
                $response = $client->get("{$baseUrl}/cohortdefinition/{$atlasId}");
                if (! $response->successful()) {
                    $this->recordMapping($migration, 'cohort_definition', $atlasId, null, "ID {$atlasId}", 'failed', "HTTP {$response->status()}");
                    $failed++;
                    $this->incrementProgress($migration, 'failed');

                    continue;
                }

                $data = $response->json();
                $name = $data['name'] ?? "Atlas Cohort {$atlasId}";

                if (CohortDefinition::where('name', $name)->exists()) {
                    $this->recordMapping($migration, 'cohort_definition', $atlasId, null, $name, 'skipped', 'Already exists');
                    $skipped++;
                    $this->incrementProgress($migration, 'skipped');

                    continue;
                }

                $expression = $data['expression'] ?? null;

                // Remap concept set IDs embedded in the Circe expression
                if (is_array($expression)) {
                    $expression = $this->remapCohortExpression($migration, $expression);
                }

                $cohort = CohortDefinition::create([
                    'name' => $name,
                    'description' => $data['description'] ?? null,
                    'expression_json' => $expression,
                    'author_id' => $migration->created_by,
                ]);

                $this->recordMapping($migration, 'cohort_definition', $atlasId, $cohort->id, $name, 'imported');
                $imported++;
                $this->incrementProgress($migration, 'imported');
            } catch (\Throwable $e) {
                Log::warning('Atlas cohort import failed', ['atlas_id' => $atlasId, 'error' => $e->getMessage()]);
                $this->recordMapping($migration, 'cohort_definition', $atlasId, null, "ID {$atlasId}", 'failed', $e->getMessage());
                $failed++;
                $this->incrementProgress($migration, 'failed');
            }
        }

        return compact('imported', 'skipped', 'failed');
    }

    /**
     * @return array{imported: int, skipped: int, failed: int}
     */
    private function importIncidenceRates(AtlasMigration $migration, array $ids, PendingRequest $client, string $baseUrl): array
    {
        return $this->importGenericAnalysis(
            $migration, $ids, $client, $baseUrl,
            'incidence_rate', '/ir/', IncidenceRateAnalysis::class,
        );
    }

    /**
     * @return array{imported: int, skipped: int, failed: int}
     */
    private function importCharacterizations(AtlasMigration $migration, array $ids, PendingRequest $client, string $baseUrl): array
    {
        return $this->importGenericAnalysis(
            $migration, $ids, $client, $baseUrl,
            'characterization', '/cohort-characterization/', Characterization::class,
        );
    }

    /**
     * @return array{imported: int, skipped: int, failed: int}
     */
    private function importPathways(AtlasMigration $migration, array $ids, PendingRequest $client, string $baseUrl): array
    {
        return $this->importGenericAnalysis(
            $migration, $ids, $client, $baseUrl,
            'pathway', '/pathway-analysis/', PathwayAnalysis::class,
        );
    }

    /**
     * @return array{imported: int, skipped: int, failed: int}
     */
    private function importEstimations(AtlasMigration $migration, array $ids, PendingRequest $client, string $baseUrl): array
    {
        return $this->importGenericAnalysis(
            $migration, $ids, $client, $baseUrl,
            'estimation', '/estimation/', EstimationAnalysis::class,
        );
    }

    /**
     * @return array{imported: int, skipped: int, failed: int}
     */
    private function importPredictions(AtlasMigration $migration, array $ids, PendingRequest $client, string $baseUrl): array
    {
        return $this->importGenericAnalysis(
            $migration, $ids, $client, $baseUrl,
            'prediction', '/prediction/', PredictionAnalysis::class,
        );
    }

    /**
     * Generic importer for analysis entities that all share the same model pattern.
     *
     * @param  class-string  $modelClass
     * @return array{imported: int, skipped: int, failed: int}
     */
    private function importGenericAnalysis(
        AtlasMigration $migration,
        array $ids,
        PendingRequest $client,
        string $baseUrl,
        string $entityType,
        string $apiPath,
        string $modelClass,
    ): array {
        $imported = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($ids as $atlasId) {
            try {
                $response = $client->get("{$baseUrl}{$apiPath}{$atlasId}");
                if (! $response->successful()) {
                    $this->recordMapping($migration, $entityType, $atlasId, null, "ID {$atlasId}", 'failed', "HTTP {$response->status()}");
                    $failed++;
                    $this->incrementProgress($migration, 'failed');

                    continue;
                }

                $data = $response->json();
                $name = $data['name'] ?? "Atlas {$entityType} {$atlasId}";

                if ($modelClass::where('name', $name)->exists()) {
                    $this->recordMapping($migration, $entityType, $atlasId, null, $name, 'skipped', 'Already exists');
                    $skipped++;
                    $this->incrementProgress($migration, 'skipped');

                    continue;
                }

                // Extract the design/expression JSON — the full response IS the design
                $designJson = $data;

                // Remap embedded cohort/concept set IDs
                $designJson = $this->remapDesignJson($migration, $designJson);

                $record = $modelClass::create([
                    'name' => $name,
                    'description' => $data['description'] ?? null,
                    'design_json' => $designJson,
                    'author_id' => $migration->created_by,
                ]);

                $this->recordMapping($migration, $entityType, $atlasId, $record->id, $name, 'imported');
                $imported++;
                $this->incrementProgress($migration, 'imported');
            } catch (\Throwable $e) {
                Log::warning("Atlas {$entityType} import failed", ['atlas_id' => $atlasId, 'error' => $e->getMessage()]);
                $this->recordMapping($migration, $entityType, $atlasId, null, "ID {$atlasId}", 'failed', $e->getMessage());
                $failed++;
                $this->incrementProgress($migration, 'failed');
            }
        }

        return compact('imported', 'skipped', 'failed');
    }

    /**
     * Remap concept set IDs in a Circe cohort expression.
     */
    private function remapCohortExpression(AtlasMigration $migration, array $expression): array
    {
        // Remap ConceptSets array — each has an "id" field
        if (isset($expression['ConceptSets']) && is_array($expression['ConceptSets'])) {
            foreach ($expression['ConceptSets'] as &$cs) {
                $atlasId = $cs['id'] ?? null;
                if ($atlasId !== null) {
                    $mapped = $this->getMappedId($migration, 'concept_set', (int) $atlasId);
                    if ($mapped !== null) {
                        $cs['id'] = $mapped;
                    }
                }
            }
            unset($cs);
        }

        return $expression;
    }

    /**
     * Remap cohort definition and concept set IDs in a generic design JSON.
     */
    private function remapDesignJson(AtlasMigration $migration, array $json): array
    {
        $encoded = json_encode($json);

        // Load all mappings for this migration
        $cohortMappings = $migration->idMappings()
            ->where('entity_type', 'cohort_definition')
            ->whereNotNull('parthenon_id')
            ->pluck('parthenon_id', 'atlas_id')
            ->toArray();

        // We do structural remapping of known key patterns rather than regex
        // since the JSON structures vary by entity type
        return $this->remapDesignRecursive($json, $cohortMappings);
    }

    /**
     * Recursively walk a design JSON and remap known ID reference fields.
     */
    private function remapDesignRecursive(array $data, array $cohortMappings): array
    {
        foreach ($data as $key => &$value) {
            if (is_array($value)) {
                $value = $this->remapDesignRecursive($value, $cohortMappings);
            } elseif (is_int($value) || is_string($value)) {
                // Remap known cohort reference fields
                $cohortFields = ['cohortId', 'targetId', 'comparatorId', 'outcomeId', 'targetCohortId', 'outcomeCohortId', 'comparatorCohortId'];
                if (in_array($key, $cohortFields, true) && isset($cohortMappings[(int) $value])) {
                    $value = $cohortMappings[(int) $value];
                }
            }
        }
        unset($value);

        return $data;
    }

    /**
     * Get the Parthenon ID for a previously mapped Atlas entity.
     */
    private function getMappedId(AtlasMigration $migration, string $entityType, int $atlasId): ?int
    {
        return AtlasIdMapping::where('migration_id', $migration->id)
            ->where('entity_type', $entityType)
            ->where('atlas_id', $atlasId)
            ->where('status', 'imported')
            ->value('parthenon_id');
    }

    /**
     * Record an ID mapping entry.
     */
    private function recordMapping(
        AtlasMigration $migration,
        string $entityType,
        int $atlasId,
        ?int $parthenonId,
        string $atlasName,
        string $status,
        ?string $errorMessage = null,
    ): void {
        AtlasIdMapping::create([
            'migration_id' => $migration->id,
            'entity_type' => $entityType,
            'atlas_id' => $atlasId,
            'parthenon_id' => $parthenonId,
            'atlas_name' => $atlasName,
            'status' => $status,
            'error_message' => $errorMessage,
        ]);
    }

    /**
     * Increment migration progress counters.
     */
    private function incrementProgress(AtlasMigration $migration, string $type): void
    {
        $field = match ($type) {
            'imported' => 'imported_entities',
            'skipped' => 'skipped_entities',
            'failed' => 'failed_entities',
        };

        $migration->increment($field);
    }
}
