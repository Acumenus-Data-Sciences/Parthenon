<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\MappingAction;
use App\Enums\ReviewTier;
use App\Http\Controllers\Controller;
use App\Models\App\ConceptMapping;
use App\Models\App\IngestionJob;
use App\Models\App\MappingCache;
use App\Models\App\MappingReview;
use App\Services\Solr\MappingSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * @group Data Ingestion
 */
class MappingReviewController extends Controller
{
    public function __construct(
        private readonly MappingSearchService $mappingSearch,
    ) {}

    /**
     * Search mappings across all jobs via Solr (or fallback to DB).
     */
    public function search(Request $request): JsonResponse
    {
        $query = $request->input('q', '');
        $filters = $request->only([
            'ingestion_job_id', 'review_tier', 'is_reviewed',
            'source_vocabulary_id', 'target_domain_id',
            'confidence_min', 'confidence_max',
        ]);
        $limit = (int) $request->input('limit', 50);
        $offset = (int) $request->input('offset', 0);

        if (isset($filters['is_reviewed'])) {
            $filters['is_reviewed'] = filter_var($filters['is_reviewed'], FILTER_VALIDATE_BOOLEAN);
        }

        // Try Solr first
        if ($this->mappingSearch->isAvailable()) {
            $result = $this->mappingSearch->search($query, $filters, $limit, $offset);
            if ($result !== null) {
                return response()->json([
                    'data' => $result['items'],
                    'total' => $result['total'],
                    'facets' => $result['facets'],
                    'engine' => 'solr',
                ]);
            }
        }

        // Fallback to DB
        $dbQuery = ConceptMapping::with(['candidates' => fn ($q) => $q->orderBy('rank')->limit(1)]);

        if (! empty($filters['ingestion_job_id'])) {
            $dbQuery->where('ingestion_job_id', (int) $filters['ingestion_job_id']);
        }
        if (! empty($filters['review_tier'])) {
            $dbQuery->where('review_tier', $filters['review_tier']);
        }
        if (isset($filters['is_reviewed'])) {
            $dbQuery->where('is_reviewed', $filters['is_reviewed']);
        }
        if ($query !== '') {
            $dbQuery->where(function ($q) use ($query) {
                $q->where('source_code', 'ilike', "%{$query}%")
                    ->orWhere('source_description', 'ilike', "%{$query}%");
            });
        }

        $total = $dbQuery->count();
        $items = $dbQuery->orderBy('confidence', 'desc')->skip($offset)->take($limit)->get();

        return response()->json([
            'data' => $items,
            'total' => $total,
            'facets' => [],
            'engine' => 'database',
        ]);
    }

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
