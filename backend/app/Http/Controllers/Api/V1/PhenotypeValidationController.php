<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Http\Controllers\Controller;
use App\Jobs\Analysis\RunPhenotypeValidationJob;
use App\Models\App\CohortDefinition;
use App\Models\App\CohortPhenotypeAdjudication;
use App\Models\App\CohortPhenotypeAdjudicationEvent;
use App\Models\App\CohortPhenotypeAdjudicationReview;
use App\Models\App\CohortPhenotypePromotion;
use App\Models\App\CohortPhenotypeValidation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
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

        $newState = $validated['review_state'];

        if ($newState === 'completed') {
            $unlabeled = $record->adjudications()->whereNull('label')->count();
            if ($unlabeled > 0) {
                throw ValidationException::withMessages([
                    'review_state' => "Cannot complete review: {$unlabeled} adjudication(s) still need a label.",
                ]);
            }
        }

        $settings = is_array($record->settings_json) ? $record->settings_json : [];
        $settings['review_state'] = $newState;

        $record->update([
            'review_state' => $newState,
            'settings_json' => $settings,
        ]);

        return response()->json(['data' => $record->fresh()]);
    }

    public function qualitySummary(CohortDefinition $cohortDefinition, int $validation): JsonResponse
    {
        $record = $this->validationForCohort($cohortDefinition, $validation);

        return response()->json([
            'data' => [
                'validation_id' => $record->id,
                'status' => $record->status,
                'review_state' => $this->reviewState($record),
                'counts' => $this->countsFromAdjudications($record),
                'metrics' => $record->metrics_json,
                'agreement' => $this->agreementSummary($record),
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

        $adjudications = $record->adjudications()
            ->with('reviewer:id,name,email')
            ->orderBy('id')
            ->get();

        $auditHistory = CohortPhenotypeAdjudicationEvent::where('phenotype_validation_id', $record->id)
            ->with('actor:id,name,email')
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'data' => [
                'format' => 'parthenon.phenotype-validation-evidence.v1',
                'review_state' => $this->reviewState($record),
                'counts' => $this->countsFromAdjudications($record),
                'agreement' => $this->agreementSummary($record),
                'cohort_definition' => $cohortDefinition->only(['id', 'name', 'description', 'quality_tier']),
                'validation' => $record->load('source:id,source_name,source_key')->toArray(),
                'adjudications' => $adjudications->toArray(),
                'audit_history' => $auditHistory->toArray(),
            ],
        ]);
    }

    public function updateAdjudication(Request $request, CohortDefinition $cohortDefinition, int $validation, int $adjudication): JsonResponse
    {
        $validationRecord = $this->validationForCohort($cohortDefinition, $validation);
        $currentReviewState = $this->reviewState($validationRecord);
        if (in_array($currentReviewState, ['locked', 'completed'], true)) {
            throw ValidationException::withMessages([
                'review_state' => "Adjudications cannot be modified when review_state is '{$currentReviewState}'.",
            ]);
        }

        /** @var CohortPhenotypeAdjudication $record */
        $record = $validationRecord->adjudications()->findOrFail($adjudication);
        $validated = $request->validate([
            'label' => ['required', 'string', 'max:40'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->recordReview(
            $validationRecord,
            $record,
            $request->user()?->id,
            $validated['label'],
            $validated['notes'] ?? null,
            'review_update',
        );

        return response()->json([
            'data' => $record->fresh()->load('reviewer:id,name,email'),
            'counts' => $this->countsFromAdjudications($validationRecord),
            'agreement' => $this->agreementSummary($validationRecord),
        ]);
    }

    public function resolveAdjudication(Request $request, CohortDefinition $cohortDefinition, int $validation, int $adjudication): JsonResponse
    {
        $validationRecord = $this->validationForCohort($cohortDefinition, $validation);
        /** @var CohortPhenotypeAdjudication $record */
        $record = $validationRecord->adjudications()->findOrFail($adjudication);
        $validated = $request->validate([
            'label' => ['required', 'string', 'max:40'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $before = $record->label;
        $record->update([
            'label' => $validated['label'],
            'notes' => $validated['notes'] ?? $record->notes,
            'status' => 'resolved',
            'reviewer_id' => $request->user()?->id,
            'reviewed_at' => now(),
        ]);

        CohortPhenotypeAdjudicationEvent::create([
            'phenotype_validation_id' => $validationRecord->id,
            'adjudication_id' => $record->id,
            'actor_id' => $request->user()?->id,
            'event_type' => 'conflict_resolved',
            'before_json' => ['label' => $before],
            'after_json' => ['label' => $validated['label']],
        ]);

        return response()->json([
            'data' => $record->fresh()->load('reviewer:id,name,email'),
            'counts' => $this->countsFromAdjudications($validationRecord),
            'agreement' => $this->agreementSummary($validationRecord),
        ]);
    }

    public function computeFromAdjudications(Request $request, CohortDefinition $cohortDefinition, int $validation): JsonResponse
    {
        $record = $this->validationForCohort($cohortDefinition, $validation);
        $allowPartial = $request->boolean('allow_partial');
        $agreement = $this->agreementSummary($record);

        // Unresolved reviewer conflicts always block — they cannot be bypassed.
        if ($agreement['unresolved_conflict_adjudications'] > 0) {
            throw ValidationException::withMessages([
                'adjudications' => 'Resolve all reviewer conflicts before computing metrics.',
            ]);
        }

        // Unreviewed adjudications block unless the caller opts into a partial run.
        if ($agreement['unreviewed_adjudications'] > 0 && ! $allowPartial) {
            throw ValidationException::withMessages([
                'adjudications' => 'Some adjudications are unreviewed. Pass allow_partial to compute from the reviewed subset.',
            ]);
        }

        $counts = $this->countsFromAdjudications($record);
        $confusion = Arr::only($counts, ['true_positives', 'false_positives', 'true_negatives', 'false_negatives']);

        $settings = is_array($record->settings_json) ? $record->settings_json : [];
        $settings['counts'] = $confusion;

        $record->update([
            'status' => ExecutionStatus::Queued,
            'settings_json' => $settings,
            'counts_json' => $confusion,
            'metrics_json' => $this->metricsFromCounts($confusion),
            'started_at' => now(),
        ]);

        RunPhenotypeValidationJob::dispatch($record);

        return response()->json([
            'data' => $record->fresh(),
            'counts' => $counts,
            'agreement' => $this->agreementSummary($record),
            'message' => 'Phenotype validation queued from adjudications.',
        ], 202);
    }

    public function promote(Request $request, CohortDefinition $cohortDefinition, int $validation): JsonResponse
    {
        $record = $this->validationForCohort($cohortDefinition, $validation);
        $validated = $request->validate([
            'approval_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $reviewState = $this->reviewState($record);
        $agreement = $this->agreementSummary($record);
        $metrics = $record->result_json['metrics'] ?? $record->metrics_json ?? null;

        // Promotion is gated on a completed review with resolved, fully-reviewed
        // evidence and computed PheValuator metrics.
        if ($reviewState !== 'completed' || ! $agreement['ready_for_promotion']) {
            throw ValidationException::withMessages([
                'review_state' => 'Promotion requires a completed review with no unresolved conflicts or unreviewed adjudications.',
            ]);
        }

        if (empty($metrics)) {
            throw ValidationException::withMessages([
                'metrics' => 'Promotion requires computed PheValuator metrics.',
            ]);
        }

        $cohortDefinition->update(['quality_tier' => 'validated']);

        $promotion = CohortPhenotypePromotion::create([
            'cohort_definition_id' => $cohortDefinition->id,
            'phenotype_validation_id' => $record->id,
            'promoted_cohort_definition_id' => $cohortDefinition->id,
            'status' => 'promoted',
            'promoted_quality_tier' => 'validated',
            'quality_summary_json' => [
                'agreement' => $agreement,
                'counts' => $this->countsFromAdjudications($record),
                'metrics' => $metrics,
            ],
            'notes' => $validated['approval_notes'] ?? null,
            'approver_id' => $request->user()?->id,
            'promoted_at' => now(),
        ]);

        return response()->json([
            'data' => $promotion,
            'cohort_definition' => $cohortDefinition->fresh()->only(['id', 'name', 'quality_tier']),
            'message' => 'Phenotype validation promoted.',
        ]);
    }

    private function validationForCohort(CohortDefinition $cohortDefinition, int $validation): CohortPhenotypeValidation
    {
        return CohortPhenotypeValidation::where('cohort_definition_id', $cohortDefinition->id)
            ->findOrFail($validation);
    }

    private function reviewState(CohortPhenotypeValidation $validation): string
    {
        $settings = is_array($validation->settings_json) ? $validation->settings_json : [];

        return (string) ($settings['review_state'] ?? $validation->review_state);
    }

    /**
     * Map an adjudication's (sample_group, consensus label) to its
     * confusion-matrix cell. cohort_member+case = TP, cohort_member+non_case =
     * FP, non_member+non_case = TN, non_member+case = FN. Null when unlabeled.
     */
    private function outcomeCell(string $sampleGroup, ?string $label): ?string
    {
        if ($label === null) {
            return null;
        }

        $isCase = in_array($label, ['case', 'true_case', 'positive'], true);
        $isNonCase = in_array($label, ['non_case', 'noncase', 'negative'], true);
        if (! $isCase && ! $isNonCase) {
            return null;
        }

        $isMember = $sampleGroup === 'cohort_member';

        return match (true) {
            $isMember && $isCase => 'true_positives',
            $isMember && $isNonCase => 'false_positives',
            ! $isMember && $isNonCase => 'true_negatives',
            default => 'false_negatives',
        };
    }

    /**
     * @return array{true_positives: int, false_positives: int, true_negatives: int, false_negatives: int, unreviewed: int}
     */
    private function countsFromAdjudications(CohortPhenotypeValidation $validation): array
    {
        $tp = $fp = $tn = $fn = $unreviewed = 0;

        foreach ($validation->adjudications()->get() as $adjudication) {
            $cell = $this->outcomeCell($adjudication->sample_group, $adjudication->label);
            if ($cell === 'true_positives') {
                $tp++;
            } elseif ($cell === 'false_positives') {
                $fp++;
            } elseif ($cell === 'true_negatives') {
                $tn++;
            } elseif ($cell === 'false_negatives') {
                $fn++;
            } else {
                $unreviewed++;
            }
        }

        return [
            'true_positives' => $tp,
            'false_positives' => $fp,
            'true_negatives' => $tn,
            'false_negatives' => $fn,
            'unreviewed' => $unreviewed,
        ];
    }

    /**
     * Inter-reviewer agreement and promotion-readiness summary for a validation.
     *
     * @return array{review_records: int, double_reviewed_adjudications: int, conflict_adjudications: int, resolved_conflict_adjudications: int, unresolved_conflict_adjudications: int, unreviewed_adjudications: int, ready_for_promotion: bool}
     */
    private function agreementSummary(CohortPhenotypeValidation $validation): array
    {
        $adjudications = $validation->adjudications()->with('reviews')->get();

        $reviewRecords = 0;
        $doubleReviewed = 0;
        $conflict = 0;
        $resolvedConflict = 0;
        $unresolvedConflict = 0;
        $unreviewed = 0;

        foreach ($adjudications as $adjudication) {
            $reviews = $adjudication->reviews;
            $reviewRecords += $reviews->count();

            $distinctReviewers = $reviews->pluck('reviewer_id')->filter()->unique()->count();
            $distinctLabels = $reviews->pluck('label')->filter()->unique()->count();

            if ($distinctReviewers >= 2) {
                $doubleReviewed++;
            }

            $isConflict = $distinctLabels >= 2;
            $isResolved = $adjudication->status === 'resolved';

            if ($isConflict) {
                $conflict++;
                $isResolved ? $resolvedConflict++ : $unresolvedConflict++;
            }

            if ($adjudication->label === null && ! ($isConflict && ! $isResolved)) {
                $unreviewed++;
            }
        }

        return [
            'review_records' => $reviewRecords,
            'double_reviewed_adjudications' => $doubleReviewed,
            'conflict_adjudications' => $conflict,
            'resolved_conflict_adjudications' => $resolvedConflict,
            'unresolved_conflict_adjudications' => $unresolvedConflict,
            'unreviewed_adjudications' => $unreviewed,
            'ready_for_promotion' => $adjudications->count() > 0
                && $unresolvedConflict === 0
                && $unreviewed === 0,
        ];
    }

    private function recordReview(
        CohortPhenotypeValidation $validation,
        CohortPhenotypeAdjudication $adjudication,
        ?int $reviewerId,
        string $label,
        ?string $notes,
        string $eventType,
    ): void {
        $before = $adjudication->label;

        CohortPhenotypeAdjudicationReview::updateOrCreate(
            ['adjudication_id' => $adjudication->id, 'reviewer_id' => $reviewerId],
            [
                'phenotype_validation_id' => $validation->id,
                'label' => $label,
                'notes' => $notes,
                'reviewed_at' => now(),
            ],
        );

        $this->recomputeConsensus($adjudication, $reviewerId);

        CohortPhenotypeAdjudicationEvent::create([
            'phenotype_validation_id' => $validation->id,
            'adjudication_id' => $adjudication->id,
            'actor_id' => $reviewerId,
            'event_type' => $eventType,
            'before_json' => ['label' => $before],
            'after_json' => ['label' => $adjudication->fresh()?->label, 'review_label' => $label],
        ]);
    }

    /**
     * Recompute an adjudication's consensus label from its reviews: a single
     * distinct label becomes the consensus; two or more is an unresolved
     * conflict (null label). A resolved adjudication is authoritative.
     */
    private function recomputeConsensus(CohortPhenotypeAdjudication $adjudication, ?int $actorId): void
    {
        if ($adjudication->status === 'resolved') {
            return;
        }

        $labels = $adjudication->reviews()->pluck('label')->filter()->unique()->values();

        if ($labels->count() === 1) {
            $adjudication->update([
                'label' => $labels->first(),
                'reviewer_id' => $actorId,
                'reviewed_at' => now(),
            ]);
        } else {
            $adjudication->update([
                'label' => null,
                'reviewer_id' => null,
            ]);
        }
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
