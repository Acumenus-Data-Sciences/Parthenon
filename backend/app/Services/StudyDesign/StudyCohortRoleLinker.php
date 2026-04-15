<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\Study;
use App\Models\App\StudyCohort;
use App\Models\App\StudyDesignAsset;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StudyCohortRoleLinker
{
    /**
     * @param  array<string, mixed>  $options
     */
    public function link(Study $study, StudyDesignAsset $asset, array $options = []): StudyCohort
    {
        if ($asset->asset_type !== 'cohort_draft') {
            throw ValidationException::withMessages([
                'asset' => 'Only cohort draft assets can be linked to a study cohort role.',
            ]);
        }

        if ($asset->status !== StudyDesignAssetStatus::MATERIALIZED->value || $asset->materialized_type !== CohortDefinition::class || $asset->materialized_id === null) {
            throw ValidationException::withMessages([
                'asset' => 'Materialize this cohort draft before linking it to the study.',
            ]);
        }

        $cohortDefinition = CohortDefinition::find($asset->materialized_id);
        if (! $cohortDefinition instanceof CohortDefinition) {
            throw ValidationException::withMessages([
                'asset' => 'The materialized cohort definition could not be found.',
            ]);
        }

        if ($cohortDefinition->isDeprecated()) {
            throw ValidationException::withMessages([
                'cohort_definition' => 'Deprecated cohort definitions cannot be linked to a study.',
            ]);
        }

        $payload = $asset->draft_payload_json ?? [];
        $role = $this->normalizeRole((string) ($options['role'] ?? $payload['role'] ?? $asset->role ?? 'target'));

        return DB::transaction(function () use ($study, $asset, $cohortDefinition, $payload, $role, $options): StudyCohort {
            $studyCohort = StudyCohort::updateOrCreate(
                [
                    'study_id' => $study->id,
                    'cohort_definition_id' => $cohortDefinition->id,
                    'role' => $role,
                ],
                [
                    'label' => (string) ($options['label'] ?? $payload['title'] ?? $cohortDefinition->name),
                    'description' => $options['description'] ?? $payload['logic_description'] ?? $cohortDefinition->description,
                    'json_definition' => $payload['expression_json'] ?? $cohortDefinition->expression_json,
                    'concept_set_ids' => $payload['concept_set_ids'] ?? null,
                    'sort_order' => StudyCohort::query()
                        ->where('study_id', $study->id)
                        ->where('role', $role)
                        ->count(),
                ],
            );

            $provenance = is_array($asset->provenance_json) ? $asset->provenance_json : [];
            $asset->update([
                'provenance_json' => [
                    ...$provenance,
                    'study_cohort_id' => $studyCohort->id,
                    'study_cohort_role' => $role,
                    'linked_at' => now()->toIso8601String(),
                ],
            ]);

            return $studyCohort->fresh('cohortDefinition') ?? $studyCohort;
        });
    }

    private function normalizeRole(string $role): string
    {
        return match (trim(strtolower($role))) {
            'population' => 'target',
            'exposure', 'intervention' => 'target',
            default => trim(strtolower($role)),
        };
    }
}
