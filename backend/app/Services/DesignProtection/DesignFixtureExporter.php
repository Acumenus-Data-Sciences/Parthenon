<?php

namespace App\Services\DesignProtection;

use App\Models\App\Characterization;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\HeorAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Log;

class DesignFixtureExporter
{
    /**
     * Common Latin words produced by PHP Faker's Lorem provider.
     * If a name+description contains ≥3 of these, the record is faker junk.
     */
    private const FAKER_LATIN_WORDS = [
        'voluptas', 'voluptatem', 'dolorem', 'doloremque', 'quibusdam',
        'molestiae', 'perspiciatis', 'occaecati', 'laborum', 'rerum',
        'maiores', 'nulla', 'nostrum', 'placeat', 'deserunt',
        'blanditiis', 'adipisci', 'consequuntur', 'accusantium', 'laudantium',
        'aperiam', 'beatae', 'inventore', 'veritatis', 'architecto',
        'explicabo', 'aspernatur', 'reprehenderit', 'voluptate', 'sequi',
        'nesciunt', 'sapiente', 'delectus', 'exercitationem', 'praesentium',
        'cupiditate', 'similique', 'provident', 'suscipit', 'laboriosam',
        'necessitatibus', 'repellendus', 'temporibus', 'quaerat', 'libero',
    ];

    /** Map entity_type → Eloquent model class */
    private const ENTITY_MAP = [
        'cohort_definition' => CohortDefinition::class,
        'concept_set' => ConceptSet::class,
        'characterization' => Characterization::class,
        'estimation_analysis' => EstimationAnalysis::class,
        'prediction_analysis' => PredictionAnalysis::class,
        'sccs_analysis' => SccsAnalysis::class,
        'incidence_rate_analysis' => IncidenceRateAnalysis::class,
        'pathway_analysis' => PathwayAnalysis::class,
        'evidence_synthesis_analysis' => EvidenceSynthesisAnalysis::class,
        'heor_analysis' => HeorAnalysis::class,
    ];

    /** Map entity_type → fixtures subdirectory name */
    private const DIR_MAP = [
        'cohort_definition' => 'cohort_definitions',
        'concept_set' => 'concept_sets',
        'characterization' => 'characterizations',
        'estimation_analysis' => 'estimation_analyses',
        'prediction_analysis' => 'prediction_analyses',
        'sccs_analysis' => 'sccs_analyses',
        'incidence_rate_analysis' => 'incidence_rate_analyses',
        'pathway_analysis' => 'pathway_analyses',
        'evidence_synthesis_analysis' => 'evidence_synthesis_analyses',
        'heor_analysis' => 'heor_analyses',
    ];

    private string $basePath;

    public function __construct()
    {
        $this->basePath = config('design_fixtures.path')
            ?? base_path('database/fixtures/designs');
    }

    /** Export a single entity to its fixture file. Returns true if written, false if skipped/missing. */
    public function exportEntity(string $entityType, int $entityId): bool
    {
        $modelClass = self::ENTITY_MAP[$entityType] ?? null;
        if ($modelClass === null) {
            Log::warning("DesignFixtureExporter: unknown entity_type '{$entityType}'");

            return false;
        }

        // Load with soft-deleted rows too (we export deleted_at state as-is)
        /** @var Model|null $model */
        $model = in_array(SoftDeletes::class, class_uses_recursive($modelClass))
            ? $modelClass::withTrashed()->find($entityId)
            : $modelClass::find($entityId);

        if ($model === null) {
            return false;
        }

        $name = (string) ($model->getAttribute('name') ?? '');
        $description = (string) ($model->getAttribute('description') ?? '');

        if ($this->isFakerGenerated($name, $description)) {
            Log::info("DesignFixtureExporter: skipping faker-generated {$entityType}#{$entityId} '{$name}'");

            return false;
        }

        $data = $model->toArray();

        // Special case: concept_set gets nested items
        if ($entityType === 'concept_set' && method_exists($model, 'items')) {
            $data['items'] = $model->items()->get()->toArray();
        }

        $dir = $this->ensureDir($entityType);
        $filename = $this->resolveFilename($entityType, $entityId, $name);
        $path = $dir.'/'.$filename;

        file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return true;
    }

    /** Remove the fixture file for a hard-deleted entity. */
    public function deleteEntityFile(string $entityType, int $entityId): void
    {
        $dir = $this->basePath.'/'.(self::DIR_MAP[$entityType] ?? $entityType);
        if (! is_dir($dir)) {
            return;
        }

        foreach (glob($dir.'/*.json') ?: [] as $file) {
            $data = json_decode((string) file_get_contents($file), true);
            if (isset($data['id']) && $data['id'] === $entityId) {
                unlink($file);

                return;
            }
        }
    }

    /** Export all entities of all types. Returns a summary. */
    public function exportAll(): ExportSummary
    {
        $summary = ExportSummary::empty();

        foreach (self::ENTITY_MAP as $entityType => $modelClass) {
            try {
                $models = in_array(SoftDeletes::class, class_uses_recursive($modelClass))
                    ? $modelClass::withTrashed()->get()
                    : $modelClass::all();

                foreach ($models as $model) {
                    try {
                        $written = $this->exportEntity($entityType, (int) $model->getKey());
                        $summary = $written ? $summary->addWritten() : $summary->addSkipped();
                    } catch (\Throwable $e) {
                        $summary = $summary->withError("{$entityType}#{$model->getKey()}: {$e->getMessage()}");
                    }
                }
            } catch (\Throwable $e) {
                $summary = $summary->withError("{$entityType}: {$e->getMessage()}");
            }
        }

        return $summary;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    private function ensureDir(string $entityType): string
    {
        $dir = $this->basePath.'/'.(self::DIR_MAP[$entityType] ?? $entityType);
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        return $dir;
    }

    /**
     * Returns the filename (not path) for an entity fixture.
     * If the slug collides with an existing file owned by a different id, appends -{id}.
     */
    private function resolveFilename(string $entityType, int $entityId, string $name): string
    {
        $dir = $this->basePath.'/'.(self::DIR_MAP[$entityType] ?? $entityType);
        $slug = $this->slugify($name, $entityId, $entityType);
        $candidate = $slug.'.json';

        $existing = $dir.'/'.$candidate;
        if (file_exists($existing)) {
            $existingData = json_decode((string) file_get_contents($existing), true);
            if (isset($existingData['id']) && $existingData['id'] !== $entityId) {
                $candidate = $slug.'-'.$entityId.'.json';
            }
        }

        return $candidate;
    }

    /**
     * Detect faker-generated Latin lorem text.
     * Returns true if the combined name+description contains ≥3 known faker Latin words.
     */
    private function isFakerGenerated(string $name, string $description): bool
    {
        $text = strtolower($name.' '.$description);
        $hits = 0;

        foreach (self::FAKER_LATIN_WORDS as $word) {
            if (str_contains($text, $word)) {
                $hits++;
                if ($hits >= 3) {
                    return true;
                }
            }
        }

        return false;
    }

    private function slugify(string $name, int $id, string $entityType, int $maxLength = 100): string
    {
        $name = trim($name);
        if ($name === '') {
            return "{$entityType}-{$id}";
        }

        $slug = strtolower($name);
        $slug = (string) preg_replace('/[^a-z0-9\s-]/', '', $slug);
        $slug = (string) preg_replace('/[\s-]+/', '-', $slug);
        $slug = trim($slug, '-');
        $slug = substr($slug, 0, $maxLength);

        if ($slug === '') {
            return "{$entityType}-{$id}";
        }

        return $slug;
    }
}
