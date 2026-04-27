<?php

namespace App\Services\StudyDesign;

use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyArtifact;
use App\Models\App\StudyCohort;
use App\Models\App\StudyDesignAiEvent;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use BackedEnum;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use InvalidArgumentException;

class StudyDesignContextBuilder
{
    public function __construct(
        private readonly StudyCohortReadinessService $cohortReadinessService,
        private readonly StudyDesignReadinessService $designReadinessService,
    ) {}

    /**
     * @param  array{max_assets?: int, max_ai_events?: int, max_artifacts?: int}  $options
     * @return array<string, mixed>
     */
    public function build(Study $study, StudyDesignSession $session, ?StudyDesignVersion $version = null, array $options = []): array
    {
        $this->assertSessionBelongsToStudy($study, $session);
        $version ??= $this->currentVersion($session);

        if ($version instanceof StudyDesignVersion) {
            $this->assertVersionBelongsToSession($session, $version);
        }

        $maxAssets = max(1, (int) ($options['max_assets'] ?? 80));
        $maxAiEvents = max(1, (int) ($options['max_ai_events'] ?? 20));
        $maxArtifacts = max(1, (int) ($options['max_artifacts'] ?? 12));

        $assets = $version instanceof StudyDesignVersion
            ? $this->assetsForVersion($session, $version, $maxAssets)
            : collect();
        $nativeCohorts = $study->cohorts()->with('cohortDefinition')->orderBy('sort_order')->get();
        $nativeAnalyses = $study->analyses()->orderBy('id')->get();
        $artifacts = $study->artifacts()->orderByDesc('created_at')->limit($maxArtifacts)->get();
        $aiEvents = $this->aiEventsForContext($session, $version, $maxAiEvents);
        $readiness = $version instanceof StudyDesignVersion
            ? $this->readiness($study, $session, $version)
            : ['cohorts' => null, 'package_lock' => null];

        return [
            'schema_version' => 'study-design-context.v1',
            'generated_at' => now()->toISOString(),
            'policy' => 'Abby context packages summarize reviewed Study Designer compiler state and canonical OHDSI assets without raw protocol text or source-row samples.',
            'study' => $this->studySummary($study),
            'session' => $this->sessionSummary($session),
            'version' => $version instanceof StudyDesignVersion ? $this->versionSummary($version) : null,
            'assets' => [
                'summary' => $this->assetSummaryCounts($assets),
                'items' => $assets->map(fn (StudyDesignAsset $asset): array => $this->assetSummary($asset))->values()->all(),
            ],
            'native' => [
                'cohorts' => $nativeCohorts->map(fn (StudyCohort $cohort): array => $this->nativeCohortSummary($cohort))->values()->all(),
                'analyses' => $nativeAnalyses->map(fn (StudyAnalysis $analysis): array => $this->nativeAnalysisSummary($analysis))->values()->all(),
                'artifacts' => $artifacts->map(fn (StudyArtifact $artifact): array => $this->artifactSummary($artifact))->values()->all(),
            ],
            'readiness' => $readiness,
            'action_targets' => $this->actionTargets($readiness),
            'provenance' => [
                'ai_events' => $aiEvents->map(fn (StudyDesignAiEvent $event): array => $this->aiEventSummary($event))->values()->all(),
                'counts' => [
                    'ai_events' => $aiEvents->count(),
                    'native_cohorts' => $nativeCohorts->count(),
                    'native_analyses' => $nativeAnalyses->count(),
                    'study_artifacts' => $artifacts->count(),
                ],
            ],
        ];
    }

    private function assertSessionBelongsToStudy(Study $study, StudyDesignSession $session): void
    {
        if ((int) $session->study_id !== (int) $study->id) {
            throw new InvalidArgumentException('Study Design session does not belong to the requested study.');
        }
    }

    private function assertVersionBelongsToSession(StudyDesignSession $session, StudyDesignVersion $version): void
    {
        if ((int) $version->session_id !== (int) $session->id) {
            throw new InvalidArgumentException('Study Design version does not belong to the requested session.');
        }
    }

    private function currentVersion(StudyDesignSession $session): ?StudyDesignVersion
    {
        $activeVersion = $session->activeVersion()->first();
        if ($activeVersion instanceof StudyDesignVersion) {
            return $activeVersion;
        }

        return $session->versions()
            ->orderByDesc('version_number')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @return Collection<int, StudyDesignAsset>
     */
    private function assetsForVersion(StudyDesignSession $session, StudyDesignVersion $version, int $limit): Collection
    {
        return $session->assets()
            ->where('version_id', $version->id)
            ->with('reviewer:id,name,email')
            ->orderBy('asset_type')
            ->orderByDesc('rank_score')
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    /**
     * @return array<string, mixed>
     */
    private function readiness(Study $study, StudyDesignSession $session, StudyDesignVersion $version): array
    {
        return [
            'cohorts' => $this->cohortReadinessService->summarize($study, $session, $version),
            'package_lock' => $this->designReadinessService->lockReadiness($study, $session, $version),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function studySummary(Study $study): array
    {
        return [
            'id' => $study->id,
            'slug' => $study->slug,
            'title' => $study->title,
            'short_title' => $study->short_title,
            'study_type' => $study->study_type,
            'study_design' => $study->study_design,
            'phase' => $study->phase,
            'priority' => $study->priority,
            'status' => $study->status,
            'primary_objective' => $study->primary_objective,
            'scientific_rationale' => $study->scientific_rationale,
            'hypothesis' => $study->hypothesis,
            'tags' => $study->tags ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function sessionSummary(StudyDesignSession $session): array
    {
        return [
            'id' => $session->id,
            'study_id' => $session->study_id,
            'title' => $session->title,
            'status' => $session->status,
            'source_mode' => $session->source_mode,
            'active_version_id' => $session->active_version_id,
            'settings' => $this->safeValue($session->settings_json ?? []),
            'created_at' => $session->created_at?->toISOString(),
            'updated_at' => $session->updated_at?->toISOString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function versionSummary(StudyDesignVersion $version): array
    {
        return [
            'id' => $version->id,
            'session_id' => $version->session_id,
            'version_number' => $version->version_number,
            'status' => $version->status,
            'accepted_by' => $version->accepted_by,
            'accepted_at' => $version->accepted_at?->toISOString(),
            'locked_at' => $version->locked_at?->toISOString(),
            'intent' => $this->safeValue($version->intent_json ?? []),
            'normalized_spec' => $this->safeValue($version->normalized_spec_json ?? []),
            'provenance' => $this->safeValue($version->provenance_json ?? []),
        ];
    }

    /**
     * @param  Collection<int, StudyDesignAsset>  $assets
     * @return array<string, mixed>
     */
    private function assetSummaryCounts(Collection $assets): array
    {
        return [
            'total' => $assets->count(),
            'by_type' => $assets
                ->groupBy('asset_type')
                ->map(fn (Collection $items): int => $items->count())
                ->sortKeys()
                ->all(),
            'by_status' => $assets
                ->groupBy(fn (StudyDesignAsset $asset): string => $this->statusValue($asset->status))
                ->map(fn (Collection $items): int => $items->count())
                ->sortKeys()
                ->all(),
            'by_verification_status' => $assets
                ->groupBy(fn (StudyDesignAsset $asset): string => $this->statusValue($asset->verification_status))
                ->map(fn (Collection $items): int => $items->count())
                ->sortKeys()
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function assetSummary(StudyDesignAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'asset_type' => $asset->asset_type,
            'role' => $asset->role,
            'status' => $this->statusValue($asset->status),
            'verification_status' => $this->statusValue($asset->verification_status),
            'rank_score' => $asset->rank_score,
            'canonical' => [
                'type' => $asset->canonical_type,
                'id' => $asset->canonical_id,
            ],
            'materialized' => [
                'type' => $asset->materialized_type,
                'id' => $asset->materialized_id,
                'at' => $asset->materialized_at?->toISOString(),
            ],
            'review' => [
                'reviewed_by' => $asset->reviewed_by,
                'reviewed_at' => $asset->reviewed_at?->toISOString(),
                'reviewer' => $asset->reviewer?->only(['id', 'name', 'email']),
                'notes' => $asset->review_notes,
            ],
            'payload' => $this->safeValue($asset->draft_payload_json ?? []),
            'verification' => $this->safeValue($asset->verification_json ?? []),
            'provenance' => $this->safeValue($asset->provenance_json ?? []),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function nativeCohortSummary(StudyCohort $cohort): array
    {
        return [
            'id' => $cohort->id,
            'role' => $cohort->role,
            'label' => $cohort->label,
            'description' => $cohort->description,
            'cohort_definition_id' => $cohort->cohort_definition_id,
            'cohort_definition_name' => $cohort->cohortDefinition?->name,
            'cohort_definition_deprecated' => $cohort->cohortDefinition?->isDeprecated() ?? false,
            'concept_set_ids' => $cohort->concept_set_ids ?? [],
            'sort_order' => $cohort->sort_order,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function nativeAnalysisSummary(StudyAnalysis $analysis): array
    {
        $array = $analysis->toArray();

        return [
            'id' => $analysis->id,
            'analysis_type' => $array['analysis_type'] ?? $analysis->analysis_type,
            'analysis_id' => $analysis->analysis_id,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function artifactSummary(StudyArtifact $artifact): array
    {
        return [
            'id' => $artifact->id,
            'artifact_type' => $artifact->artifact_type,
            'title' => $artifact->title,
            'version' => $artifact->version,
            'mime_type' => $artifact->mime_type,
            'file_size_bytes' => $artifact->file_size_bytes,
            'url' => $artifact->url,
            'metadata' => $this->safeValue($artifact->metadata ?? []),
            'is_current' => $artifact->is_current,
            'created_at' => $artifact->created_at?->toISOString(),
        ];
    }

    /**
     * @return EloquentCollection<int, StudyDesignAiEvent>
     */
    private function aiEventsForContext(StudyDesignSession $session, ?StudyDesignVersion $version, int $limit): EloquentCollection
    {
        return $session->aiEvents()
            ->when($version instanceof StudyDesignVersion, fn ($query) => $query->where(function ($nested) use ($version): void {
                $nested->where('version_id', $version->id)
                    ->orWhereNull('version_id');
            }))
            ->orderByDesc('id')
            ->limit($limit)
            ->get();
    }

    /**
     * @return array<string, mixed>
     */
    private function aiEventSummary(StudyDesignAiEvent $event): array
    {
        return [
            'id' => $event->id,
            'event_type' => $event->event_type,
            'provider' => $event->provider,
            'model' => $event->model,
            'prompt_sha256' => $event->prompt_sha256,
            'input' => $this->safeValue($event->input_json ?? []),
            'output_summary' => [
                'keys' => array_keys(is_array($event->output_json) ? $event->output_json : []),
            ],
            'safety' => $this->safeValue($event->safety_json ?? []),
            'created_by' => $event->created_by,
            'created_at' => $event->created_at?->toISOString(),
        ];
    }

    /**
     * @param  array<string, mixed>  $readiness
     * @return list<array<string, mixed>>
     */
    private function actionTargets(array $readiness): array
    {
        $targets = [];

        foreach (['cohorts', 'package_lock'] as $section) {
            $payload = $readiness[$section] ?? null;
            if (! is_array($payload)) {
                continue;
            }

            foreach ($this->collectActionTargets($payload) as $target) {
                $targets[] = ['section' => $section, ...$target];
            }
        }

        return collect($targets)
            ->unique(fn (array $target): string => json_encode($target, JSON_THROW_ON_ERROR))
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function collectActionTargets(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $targets = [];
        if (isset($value['action']) && is_array($value['action'])) {
            $targets[] = $value['action'];
        }
        if (isset($value['action_targets']) && is_array($value['action_targets'])) {
            foreach ($value['action_targets'] as $target) {
                if (is_array($target)) {
                    $targets[] = $target;
                }
            }
        }

        foreach ($value as $nested) {
            if (is_array($nested)) {
                array_push($targets, ...$this->collectActionTargets($nested));
            }
        }

        return $targets;
    }

    private function statusValue(mixed $value): string
    {
        if ($value instanceof BackedEnum) {
            return (string) $value->value;
        }

        return is_scalar($value) ? (string) $value : '';
    }

    private function safeValue(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $safe = [];
        foreach ($value as $key => $item) {
            if (in_array($key, ['protocol_text', 'raw_protocol_text', 'source_rows', 'row_samples'], true)) {
                continue;
            }
            $safe[$key] = $this->safeValue($item);
        }

        return $safe;
    }
}
