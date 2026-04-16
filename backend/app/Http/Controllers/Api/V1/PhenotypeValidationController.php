<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Http\Controllers\Controller;
use App\Jobs\Analysis\RunPhenotypeValidationJob;
use App\Models\App\CohortDefinition;
use App\Models\App\CohortPhenotypeAdjudication;
use App\Models\App\CohortPhenotypePromotion;
use App\Models\App\CohortPhenotypeValidation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PhenotypeValidationController extends Controller
{
    public function index(CohortDefinition $cohortDefinition): JsonResponse
    {
        return response()->json([
            'data' => $cohortDefinition->hasMany(CohortPhenotypeValidation::class)
                ->with('source:id,source_name,source_key')
                ->latest()
                ->get(),
        ]);
    }

    public function store(Request $request, CohortDefinition $cohortDefinition): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => ['required', 'integer', 'exists:sources,id'],
            'mode' => ['required', 'string', 'max:40'],
            'counts' => ['required_if:mode,counts', 'nullable', 'array'],
            'counts.true_positives' => ['required_if:mode,counts', 'integer', 'min:0'],
            'counts.false_positives' => ['required_if:mode,counts', 'integer', 'min:0'],
            'counts.true_negatives' => ['required_if:mode,counts', 'integer', 'min:0'],
            'counts.false_negatives' => ['required_if:mode,counts', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($validated['mode'] === 'counts' && isset($validated['counts'])) {
            $total = (int) ($validated['counts']['true_positives'] ?? 0)
                + (int) ($validated['counts']['false_positives'] ?? 0)
                + (int) ($validated['counts']['true_negatives'] ?? 0)
                + (int) ($validated['counts']['false_negatives'] ?? 0);
            if ($total <= 0) {
                throw ValidationException::withMessages([
                    'counts' => 'Counts must contain at least one positive value.',
                ]);
            }
        }

        $authorId = $request->user()?->id;

        if ($validated['mode'] === 'counts' && isset($validated['counts'])) {
            $validation = CohortPhenotypeValidation::create([
                'cohort_definition_id' => $cohortDefinition->id,
                'source_id' => $validated['source_id'],
                'mode' => 'counts',
                'status' => ExecutionStatus::Queued,
                'review_state' => 'not_started',
                'settings_json' => ['counts' => $validated['counts']],
                'notes' => $validated['notes'] ?? null,
                'author_id' => $authorId,
                'created_by' => $authorId,
                'started_at' => now(),
            ]);

            RunPhenotypeValidationJob::dispatch($validation);

            return response()->json([
                'data' => $validation->load('source:id,source_name,source_key'),
                'message' => 'Phenotype validation queued.',
            ], 202);
        }

        if ($validated['mode'] === 'adjudication') {
            $validation = CohortPhenotypeValidation::create([
                'cohort_definition_id' => $cohortDefinition->id,
                'source_id' => $validated['source_id'],
                'mode' => 'adjudication',
                'status' => ExecutionStatus::Pending,
                'review_state' => 'draft',
                'settings_json' => ['review_state' => 'draft'],
                'notes' => $validated['notes'] ?? null,
                'author_id' => $authorId,
                'created_by' => $authorId,
            ]);

            return response()->json([
                'data' => $validation->load('source:id,source_name,source_key'),
                'message' => 'Phenotype review session created.',
            ], 201);
        }

        $validation = CohortPhenotypeValidation::create([
            'cohort_definition_id' => $cohortDefinition->id,
            'source_id' => $validated['source_id'],
            'mode' => $validated['mode'],
            'status' => ExecutionStatus::Pending,
            'review_state' => 'not_started',
            'settings_json' => $validated['counts'] ?? null ? ['counts' => $validated['counts']] : null,
            'notes' => $validated['notes'] ?? null,
            'author_id' => $authorId,
            'created_by' => $authorId,
        ]);

        return response()->json([
            'data' => $validation->load('source:id,source_name,source_key'),
            'message' => 'Phenotype validation created.',
        ], 201);
    }

    public function promotions(CohortDefinition $cohortDefinition): JsonResponse
    {
        return response()->json([
            'data' => CohortPhenotypePromotion::where('cohort_definition_id', $cohortDefinition->id)
                ->latest()
                ->get(),
        ]);
    }

    public function show(CohortDefinition $cohortDefinition, int $validation): JsonResponse
    {
        return response()->json([
            'data' => $this->validationForCohort($cohortDefinition, $validation)
                ->load(['source:id,source_name,source_key', 'adjudications']),
        ]);
    }

    public function adjudications(CohortDefinition $cohortDefinition, int $validation): JsonResponse
    {
        $record = $this->validationForCohort($cohortDefinition, $validation);

        return response()->json([
            'data' => $record->adjudications()->latest()->get(),
        ]);
    }

    public function sample(Request $request, CohortDefinition $cohortDefinition, int $validation): JsonResponse
    {
        $record = $this->validationForCohort($cohortDefinition, $validation);
        $validated = $request->validate([
            'cohort_member_count' => ['nullable', 'integer', 'min:0', 'max:500'],
            'non_member_count' => ['nullable', 'integer', 'min:0', 'max:500'],
            'seed' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_.:-]+$/', 'max:80'],
            'strategy' => ['nullable', 'string', 'max:80'],
        ]);

        $memberCount = $validated['cohort_member_count'] ?? 25;
        $nonMemberCount = $validated['non_member_count'] ?? 25;
        $created = collect();

        foreach (['cohort_member' => $memberCount, 'non_member' => $nonMemberCount] as $type => $count) {
            for ($i = 0; $i < $count; $i++) {
                $created->push(CohortPhenotypeAdjudication::create([
                    'phenotype_validation_id' => $record->id,
                    'person_id' => null,
                    'sample_group' => $type,
                    'status' => 'pending',
                    'payload_json' => [
                        'seed' => $validated['seed'] ?? null,
                        'strategy' => $validated['strategy'] ?? 'balanced',
                        'ordinal' => $i + 1,
                    ],
                ]));
            }
        }

        return response()->json([
            'data' => $created->values(),
            'message' => 'Phenotype validation sample created.',
        ], 201);
    }

    public function updateReviewState(Request $request, CohortDefinition $cohortDefinition, int $validation): JsonResponse
    {
        $record = $this->validationForCohort($cohortDefinition, $validation);
        $validated = $request->validate([
            'review_state' => ['required', 'string', 'max:40'],
        ]);

        $record->update(['review_state' => $validated['review_state']]);

        return response()->json(['data' => $record->fresh()]);
    }

    public function qualitySummary(CohortDefinition $cohortDefinition, int $validation): JsonResponse
    {
        $record = $this->validationForCohort($cohortDefinition, $validation);

        return response()->json([
            'data' => [
                'validation_id' => $record->id,
                'status' => $record->status,
                'review_state' => $record->review_state,
                'counts' => $record->counts_json,
                'metrics' => $record->metrics_json,
                'adjudication_counts' => $record->adjudications()
                    ->selectRaw('status, count(*) as total')
                    ->groupBy('status')
                    ->pluck('total', 'status'),
            ],
        ]);
    }

    public function evidenceExport(CohortDefinition $cohortDefinition, int $validation): JsonResponse
    {
        $record = $this->validationForCohort($cohortDefinition, $validation);

        return response()->json([
            'data' => [
                'format' => 'parthenon.phenotype-validation-evidence.v1',
                'cohort_definition' => $cohortDefinition->only(['id', 'name', 'description', 'quality_tier']),
                'validation' => $record->load(['source:id,source_name,source_key', 'adjudications'])->toArray(),
            ],
        ]);
    }

    public function updateAdjudication(Request $request, CohortDefinition $cohortDefinition, int $validation, int $adjudication): JsonResponse
    {
        $record = $this->adjudicationForValidation($cohortDefinition, $validation, $adjudication);
        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:40'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $record->update([
            ...$validated,
            'reviewed_by' => $request->user()?->id,
            'reviewed_at' => now(),
        ]);

        return response()->json(['data' => $record->fresh()]);
    }

    public function resolveAdjudication(Request $request, CohortDefinition $cohortDefinition, int $validation, int $adjudication): JsonResponse
    {
        $record = $this->adjudicationForValidation($cohortDefinition, $validation, $adjudication);
        $validated = $request->validate([
            'label' => ['required', 'string', 'max:40'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $record->update([
            'label' => $validated['label'],
            'notes' => $validated['notes'] ?? $record->notes,
            'status' => 'resolved',
            'reviewed_by' => $request->user()?->id,
            'reviewed_at' => now(),
        ]);

        return response()->json(['data' => $record->fresh()]);
    }

    public function computeFromAdjudications(CohortDefinition $cohortDefinition, int $validation): JsonResponse
    {
        $record = $this->validationForCohort($cohortDefinition, $validation);
        $labels = $record->adjudications()->pluck('label')->filter()->countBy();
        $counts = [
            'true_positives' => (int) ($labels['true_positive'] ?? $labels['tp'] ?? 0),
            'false_positives' => (int) ($labels['false_positive'] ?? $labels['fp'] ?? 0),
            'true_negatives' => (int) ($labels['true_negative'] ?? $labels['tn'] ?? 0),
            'false_negatives' => (int) ($labels['false_negative'] ?? $labels['fn'] ?? 0),
        ];

        $record->update([
            'counts_json' => $counts,
            'metrics_json' => $this->metricsFromCounts($counts),
            'status' => 'computed',
            'computed_at' => now(),
        ]);

        return response()->json(['data' => $record->fresh()]);
    }

    public function promote(Request $request, CohortDefinition $cohortDefinition, int $validation): JsonResponse
    {
        $record = $this->validationForCohort($cohortDefinition, $validation);
        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $cohortDefinition->update(['quality_tier' => 'validated']);

        $promotion = CohortPhenotypePromotion::create([
            'cohort_definition_id' => $cohortDefinition->id,
            'validation_id' => $record->id,
            'promoted_cohort_definition_id' => $cohortDefinition->id,
            'status' => 'promoted',
            'notes' => $validated['notes'] ?? null,
            'promoted_by' => $request->user()?->id,
            'promoted_at' => now(),
        ]);

        return response()->json([
            'data' => $promotion,
            'message' => 'Phenotype validation promoted.',
        ], 201);
    }

    private function validationForCohort(CohortDefinition $cohortDefinition, int $validation): CohortPhenotypeValidation
    {
        return CohortPhenotypeValidation::where('cohort_definition_id', $cohortDefinition->id)
            ->findOrFail($validation);
    }

    private function adjudicationForValidation(CohortDefinition $cohortDefinition, int $validation, int $adjudication): CohortPhenotypeAdjudication
    {
        $record = $this->validationForCohort($cohortDefinition, $validation);

        return $record->adjudications()->findOrFail($adjudication);
    }

    private function metricsFromCounts(array $counts): array
    {
        $tp = (int) ($counts['true_positives'] ?? 0);
        $fp = (int) ($counts['false_positives'] ?? 0);
        $tn = (int) ($counts['true_negatives'] ?? 0);
        $fn = (int) ($counts['false_negatives'] ?? 0);

        return [
            'ppv' => $tp + $fp > 0 ? round($tp / ($tp + $fp), 4) : null,
            'sensitivity' => $tp + $fn > 0 ? round($tp / ($tp + $fn), 4) : null,
            'specificity' => $tn + $fp > 0 ? round($tn / ($tn + $fp), 4) : null,
            'sample_size' => $tp + $fp + $tn + $fn,
        ];
    }
}
