<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\MappingAction;
use App\Enums\ReviewTier;
use App\Http\Controllers\Controller;
use App\Models\App\ConceptMapping;
use App\Models\App\IngestionJob;
use App\Models\App\MappingCache;
use App\Models\App\MappingReview;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

#[Group('Data Ingestion', weight: 200)]
class MappingReviewController extends Controller
{
    /**
     * List mappings for an ingestion job with pagination and filters.
     */
    public function index(Request $request, IngestionJob $ingestionJob): JsonResponse
    {
        $query = $ingestionJob->conceptMappings()->with('candidates');

        if ($request->filled('review_tier')) {
            $query->where('review_tier', $request->input('review_tier'));
        }

        if ($request->filled('is_reviewed')) {
            $query->where('is_reviewed', filter_var($request->input('is_reviewed'), FILTER_VALIDATE_BOOLEAN));
        }

        $mappings = $query->orderBy('id')->paginate(50);

        return response()->json($mappings);
    }

    /**
     * Return review statistics for an ingestion job.
     */
    public function stats(IngestionJob $ingestionJob): JsonResponse
    {
        $mappings = $ingestionJob->conceptMappings();

        $total = $mappings->count();
        $reviewed = (clone $mappings)->where('is_reviewed', true)->count();

        $stats = [
            'total' => $total,
            'auto_accepted' => (clone $mappings)->where('review_tier', ReviewTier::AutoAccepted)->count(),
            'quick_review' => (clone $mappings)->where('review_tier', ReviewTier::QuickReview)->count(),
            'full_review' => (clone $mappings)->where('review_tier', ReviewTier::FullReview)->count(),
            'unmappable' => (clone $mappings)->where('review_tier', ReviewTier::Unmappable)->count(),
            'reviewed' => $reviewed,
            'pending' => $total - $reviewed,
        ];

        return response()->json(['data' => $stats]);
    }

    /**
     * Review a single concept mapping.
     */
    public function review(Request $request, IngestionJob $ingestionJob, ConceptMapping $conceptMapping): JsonResponse
    {
        $validated = $request->validate([
            'action' => ['required', 'string', Rule::in(['approve', 'reject', 'remap'])],
            'target_concept_id' => ['nullable', 'integer'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        $action = MappingAction::from($validated['action']);

        match ($action) {
            MappingAction::Approve => $conceptMapping->update([
                'is_reviewed' => true,
                'reviewer_id' => $request->user()->id,
            ]),
            MappingAction::Reject => $conceptMapping->update([
                'target_concept_id' => 0,
                'is_reviewed' => true,
                'reviewer_id' => $request->user()->id,
            ]),
            MappingAction::Remap => $conceptMapping->update([
                'target_concept_id' => $validated['target_concept_id'],
                'is_reviewed' => true,
                'reviewer_id' => $request->user()->id,
            ]),
        };

        // Create a review record
        MappingReview::create([
            'concept_mapping_id' => $conceptMapping->id,
            'reviewer_id' => $request->user()->id,
            'action' => $action,
            'target_concept_id' => $validated['target_concept_id'] ?? $conceptMapping->target_concept_id,
            'comment' => $validated['comment'] ?? null,
        ]);

        // Update the mapping cache
        $this->updateMappingCache($conceptMapping->fresh());

        return response()->json([
            'data' => $conceptMapping->fresh()->load('candidates'),
        ]);
    }

    /**
     * Batch review multiple concept mappings.
     */
    public function batchReview(Request $request, IngestionJob $ingestionJob): JsonResponse
    {
        $validated = $request->validate([
            'reviews' => ['required', 'array', 'min:1'],
            'reviews.*.mapping_id' => ['required', 'integer'],
            'reviews.*.action' => ['required', 'string', Rule::in(['approve', 'reject', 'remap'])],
            'reviews.*.target_concept_id' => ['nullable', 'integer'],
        ]);

        $counts = ['approved' => 0, 'rejected' => 0, 'remapped' => 0];

        foreach ($validated['reviews'] as $reviewData) {
            $mapping = $ingestionJob->conceptMappings()->find($reviewData['mapping_id']);

            if (! $mapping) {
                continue;
            }

            $action = MappingAction::from($reviewData['action']);

            match ($action) {
                MappingAction::Approve => $mapping->update([
                    'is_reviewed' => true,
                    'reviewer_id' => $request->user()->id,
                ]),
                MappingAction::Reject => $mapping->update([
                    'target_concept_id' => 0,
                    'is_reviewed' => true,
                    'reviewer_id' => $request->user()->id,
                ]),
                MappingAction::Remap => $mapping->update([
                    'target_concept_id' => $reviewData['target_concept_id'],
                    'is_reviewed' => true,
                    'reviewer_id' => $request->user()->id,
                ]),
            };

            MappingReview::create([
                'concept_mapping_id' => $mapping->id,
                'reviewer_id' => $request->user()->id,
                'action' => $action,
                'target_concept_id' => $reviewData['target_concept_id'] ?? $mapping->target_concept_id,
            ]);

            $this->updateMappingCache($mapping->fresh());

            match ($action) {
                MappingAction::Approve => $counts['approved']++,
                MappingAction::Reject => $counts['rejected']++,
                MappingAction::Remap => $counts['remapped']++,
            };
        }

        return response()->json(['data' => $counts]);
    }

    /**
     * Return all candidates for a mapping ordered by rank.
     */
    public function candidates(IngestionJob $ingestionJob, ConceptMapping $conceptMapping): JsonResponse
    {
        $candidates = $conceptMapping->candidates()->orderBy('rank')->get();

        return response()->json(['data' => $candidates]);
    }

    /**
     * Update or create a mapping cache entry from a reviewed mapping.
     */
    private function updateMappingCache(ConceptMapping $mapping): void
    {
        if ($mapping->target_concept_id === null || $mapping->target_concept_id <= 0) {
            return;
        }

        $existing = MappingCache::where('source_code', $mapping->source_code)
            ->where('source_vocabulary_id', $mapping->source_vocabulary_id)
            ->where('target_concept_id', $mapping->target_concept_id)
            ->first();

        if ($existing) {
            $existing->update([
                'confidence' => $mapping->confidence,
                'strategy' => $mapping->strategy ?? 'manual_review',
                'times_confirmed' => $existing->times_confirmed + 1,
                'last_confirmed_at' => now(),
            ]);
        } else {
            MappingCache::create([
                'source_code' => $mapping->source_code,
                'source_description' => $mapping->source_description,
                'source_vocabulary_id' => $mapping->source_vocabulary_id,
                'target_concept_id' => $mapping->target_concept_id,
                'confidence' => $mapping->confidence ?? 1.0000,
                'strategy' => $mapping->strategy ?? 'manual_review',
                'last_confirmed_at' => now(),
            ]);
        }
    }
}
