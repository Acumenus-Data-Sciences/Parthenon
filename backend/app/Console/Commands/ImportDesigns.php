<?php

namespace App\Console\Commands;

use App\Models\App\Characterization;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\HeorAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class ImportDesigns extends Command
{
    protected $signature = 'parthenon:import-designs {--dry-run : Show what would be imported without writing to the database}';

    protected $description = 'Restore all design entities (cohorts, concept sets, analyses) from git-tracked JSON fixture files';

    /** Map subdirectory name → [model class, author column] */
    private const ENTITY_CONFIG = [
        'cohort_definitions' => ['model' => CohortDefinition::class,          'author_col' => 'author_id'],
        'concept_sets' => ['model' => ConceptSet::class,                'author_col' => 'author_id'],
        'characterizations' => ['model' => Characterization::class,          'author_col' => 'author_id'],
        'estimation_analyses' => ['model' => EstimationAnalysis::class,        'author_col' => 'author_id'],
        'prediction_analyses' => ['model' => PredictionAnalysis::class,        'author_col' => 'author_id'],
        'sccs_analyses' => ['model' => SccsAnalysis::class,              'author_col' => 'author_id'],
        'incidence_rate_analyses' => ['model' => IncidenceRateAnalysis::class,     'author_col' => 'author_id'],
        'pathway_analyses' => ['model' => PathwayAnalysis::class,           'author_col' => 'author_id'],
        'evidence_synthesis_analyses' => ['model' => EvidenceSynthesisAnalysis::class, 'author_col' => 'author_id'],
        'heor_analyses' => ['model' => HeorAnalysis::class,              'author_col' => 'created_by'],
    ];

    public function handle(): int
    {
        $admin = User::where('email', 'admin@acumenus.net')->first();
        if ($admin === null) {
            $this->error('Admin user admin@acumenus.net not found. Run: php artisan admin:seed');

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $basePath = config('design_fixtures.path') ?? base_path('database/fixtures/designs');

        if (! is_dir((string) $basePath)) {
            $this->warn("Fixtures directory not found: {$basePath}");
            $this->warn('Run: php artisan parthenon:export-designs to generate fixtures first.');

            return self::SUCCESS;
        }

        $totals = ['created' => 0, 'updated' => 0, 'skipped' => 0];

        try {
            DB::beginTransaction();

            foreach (self::ENTITY_CONFIG as $dirName => $config) {
                $dir = $basePath.'/'.$dirName;
                if (! is_dir($dir)) {
                    continue;
                }

                $counts = ['created' => 0, 'updated' => 0, 'skipped' => 0];
                $modelClass = $config['model'];
                $authorCol = $config['author_col'];

                foreach (glob($dir.'/*.json') ?: [] as $file) {
                    $raw = file_get_contents($file);
                    if ($raw === false) {
                        $this->warn("  Skipping unreadable file: {$file}");

                        continue;
                    }

                    $data = json_decode($raw, true);
                    if ($data === null) {
                        $this->warn("  Skipping malformed JSON: {$file}");

                        continue;
                    }

                    // Remap author to admin if original user doesn't exist
                    if (isset($data[$authorCol]) && ! User::where('id', $data[$authorCol])->exists()) {
                        $data[$authorCol] = $admin->id;
                    }

                    $fillable = $this->prepareFillable($data);

                    $existing = $this->findExisting($modelClass, $data['name']);

                    if ($existing === null) {
                        if (! $dryRun) {
                            $modelClass::create($fillable);
                        }
                        $counts['created']++;
                    } else {
                        $candidate = array_intersect_key($fillable, array_flip($existing->getFillable()));
                        $dirty = collect($candidate)
                            ->filter(fn ($v, $k) => $existing->getAttribute($k) != $v)
                            ->isNotEmpty();

                        if ($dirty) {
                            if (! $dryRun) {
                                $existing->update($fillable);
                            }
                            $counts['updated']++;
                        } else {
                            $counts['skipped']++;
                        }
                    }

                    // concept_sets: replace items
                    if ($dirName === 'concept_sets' && isset($data['items']) && ! $dryRun) {
                        $cs = ConceptSet::where('name', $data['name'])->first();
                        if ($cs !== null) {
                            ConceptSetItem::where('concept_set_id', $cs->id)->delete();
                            foreach ($data['items'] as $item) {
                                ConceptSetItem::create([
                                    'concept_set_id' => $cs->id,
                                    'concept_id' => $item['concept_id'],
                                    'is_excluded' => $item['is_excluded'] ?? false,
                                    'include_descendants' => $item['include_descendants'] ?? false,
                                    'include_mapped' => $item['include_mapped'] ?? false,
                                ]);
                            }
                        }
                    }
                }

                $this->line(sprintf(
                    '  %-35s created: %d  updated: %d  skipped: %d',
                    $dirName,
                    $counts['created'],
                    $counts['updated'],
                    $counts['skipped']
                ));

                $totals['created'] += $counts['created'];
                $totals['updated'] += $counts['updated'];
                $totals['skipped'] += $counts['skipped'];
            }

            if ($dryRun) {
                DB::rollBack();
                $this->info('[DRY RUN] No changes written.');
            } else {
                DB::commit();
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error("Import failed: {$e->getMessage()}");

            return self::FAILURE;
        }

        $this->info("Import complete. Created: {$totals['created']}, Updated: {$totals['updated']}, Skipped: {$totals['skipped']}");

        return self::SUCCESS;
    }

    /**
     * Find an existing record by name, supporting soft-deleted models.
     *
     * @param  class-string<Model>  $modelClass
     */
    private function findExisting(string $modelClass, string $name): ?Model
    {
        $usesSoftDeletes = in_array(
            SoftDeletes::class,
            class_uses_recursive($modelClass)
        );

        /** @var Builder<Model> $query */
        $query = $modelClass::query();

        if ($usesSoftDeletes) {
            /** @phpstan-ignore-next-line */
            $query = $modelClass::withTrashed();
        }

        return $query->where('name', $name)->first();
    }

    /**
     * Prepare the fillable data for create/update — strip id, timestamps, and nested relations.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function prepareFillable(array $data): array
    {
        foreach (['id', 'created_at', 'updated_at', 'items'] as $key) {
            unset($data[$key]);
        }

        return $data;
    }
}
