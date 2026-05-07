<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\HarmoniaApproveMappingRequest;
use App\Http\Requests\Api\HarmoniaEscalateMappingRequest;
use App\Http\Requests\Api\HarmoniaRejectMappingRequest;
use App\Models\App\MappingReviewQueueItem;
use App\Models\Vocabulary\Concept;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Phase 3 Plan 7 Task 1 (T-024B) — concept-mapping reviewer API.
 *
 * Surfaces the Plan 6 (T-024A / Harmonia) rerank queue to the reviewer UI.
 * Decisions write to app.parthenon_concept_map and flip queue rows.
 *
 * Routes are mounted in routes/api.php under
 *   auth:sanctum + permission:mapping.review (read)
 *   auth:sanctum + permission:mapping.approve (writes)
 * per HIGHSEC §2 (three-layer route protection).
 *
 * @group Concept Mapping Review (Harmonia)
 */
class HarmoniaReviewController extends Controller
{
    public function __construct(
        private readonly ConnectionInterface $db,
    ) {}

    /**
     * GET /api/v1/mapping-review/queue
     *
     * Paginated reviewer queue with filters by status, source_vocab, and
     * sort by confidence/age.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string', 'in:pending,approved,rejected,escalated,all'],
            'source_vocab' => ['nullable', 'string', 'max:100'],
            'q' => ['nullable', 'string', 'max:255'],
            'sort_by' => ['nullable', 'string', 'in:confidence_asc,confidence_desc,age_asc,age_desc,seen_count_desc'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:200'],
        ]);

        $status = $validated['status'] ?? 'pending';
        $query = MappingReviewQueueItem::query()->with('reviewer:id,name,email');

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        if (! empty($validated['source_vocab'])) {
            $query->where('source_vocab', $validated['source_vocab']);
        }

        if (! empty($validated['q'])) {
            $needle = $validated['q'];
            $query->where(function ($qq) use ($needle): void {
                $qq->where('source_code', 'ilike', "%{$needle}%")
                    ->orWhere('source_text', 'ilike', "%{$needle}%");
            });
        }

        match ($validated['sort_by'] ?? 'confidence_asc') {
            'confidence_desc' => $query->orderBy('top1_confidence', 'desc')->orderBy('queue_id'),
            'age_asc' => $query->orderBy('created_at', 'asc')->orderBy('queue_id'),
            'age_desc' => $query->orderBy('created_at', 'desc')->orderBy('queue_id'),
            'seen_count_desc' => $query->orderBy('seen_count', 'desc')->orderBy('queue_id'),
            default => $query->orderBy('top1_confidence', 'asc')->orderBy('queue_id'),
        };

        $perPage = (int) ($validated['per_page'] ?? 50);
        $page = $query->paginate($perPage);

        // Strip the heavy candidate_ranking_json from list rows; expose the
        // top-1 only via the appended attribute. Detail endpoint serves the full payload.
        $items = $page->getCollection()->map(fn (MappingReviewQueueItem $row): array => [
            'queue_id' => $row->queue_id,
            'source_code' => $row->source_code,
            'source_vocab' => $row->source_vocab,
            'source_text' => $row->source_text,
            'seen_count' => $row->seen_count,
            'top1_confidence' => $row->top1_confidence,
            'top_candidate' => $row->top_candidate,
            'model_version' => $row->model_version,
            'status' => $row->status,
            'reviewer' => $row->reviewer ? ['id' => $row->reviewer->id, 'name' => $row->reviewer->name] : null,
            'created_at' => $row->created_at?->toIso8601String(),
            'reviewed_at' => $row->reviewed_at?->toIso8601String(),
        ]);

        return response()->json([
            'data' => $items->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    /**
     * GET /api/v1/mapping-review/queue/stats
     *
     * Lightweight counts for the queue header — pending / approved /
     * rejected / escalated. Powers the queue page badges.
     */
    public function stats(): JsonResponse
    {
        $rows = MappingReviewQueueItem::query()
            ->selectRaw('status, count(*) as n')
            ->groupBy('status')
            ->pluck('n', 'status');

        return response()->json([
            'data' => [
                'pending' => (int) ($rows[MappingReviewQueueItem::STATUS_PENDING] ?? 0),
                'approved' => (int) ($rows[MappingReviewQueueItem::STATUS_APPROVED] ?? 0),
                'rejected' => (int) ($rows[MappingReviewQueueItem::STATUS_REJECTED] ?? 0),
                'escalated' => (int) ($rows[MappingReviewQueueItem::STATUS_ESCALATED] ?? 0),
            ],
        ]);
    }

    /**
     * GET /api/v1/mapping-review/queue/{queueId}
     *
     * Full detail row including all top-K candidates with similarity scores.
     */
    public function show(int $queueId): JsonResponse
    {
        $row = MappingReviewQueueItem::query()
            ->with('reviewer:id,name,email')
            ->where('queue_id', $queueId)
            ->firstOrFail();

        // Hydrate concept-name + domain hints for each candidate from
        // vocab.concept so the UI can render "Maps to" provenance without
        // re-running the rerank pipeline.
        $candidates = is_array($row->candidate_ranking_json) ? $row->candidate_ranking_json : [];
        $conceptIds = array_values(array_filter(array_map(
            static fn (array $c): int => (int) ($c['concept_id'] ?? 0),
            $candidates,
        )));

        $byId = [];
        if ($conceptIds !== []) {
            $byId = Concept::query()
                ->whereIn('concept_id', $conceptIds)
                ->get(['concept_id', 'concept_name', 'vocabulary_id', 'domain_id', 'concept_class_id', 'standard_concept'])
                ->keyBy('concept_id');
        }

        $hydrated = array_map(static function (array $c) use ($byId): array {
            $cid = (int) ($c['concept_id'] ?? 0);
            $live = $byId[$cid] ?? null;

            return [
                'concept_id' => $cid,
                'concept_name' => $live?->concept_name ?? (string) ($c['concept_name'] ?? ''),
                'vocabulary_id' => $live?->vocabulary_id ?? (string) ($c['vocabulary_id'] ?? ''),
                'domain_id' => $live?->domain_id ?? (string) ($c['domain_id'] ?? ''),
                'concept_class_id' => $live?->concept_class_id,
                'standard_concept' => $live?->standard_concept,
                'similarity' => (float) ($c['similarity'] ?? 0.0),
                'rerank_score' => isset($c['rerank_score']) ? (float) $c['rerank_score'] : null,
                'rerank_rationale' => isset($c['rationale']) ? (string) $c['rationale'] : null,
                'concept_still_valid' => $live !== null,
            ];
        }, $candidates);

        return response()->json([
            'data' => [
                'queue_id' => $row->queue_id,
                'source_code' => $row->source_code,
                'source_vocab' => $row->source_vocab,
                'source_text' => $row->source_text,
                'seen_count' => $row->seen_count,
                'top1_confidence' => $row->top1_confidence,
                'model_version' => $row->model_version,
                'status' => $row->status,
                'rejection_reason' => $row->rejection_reason,
                'approved_concept_id' => $row->approved_concept_id,
                'approved_map_id' => $row->approved_map_id,
                'reviewer' => $row->reviewer ? [
                    'id' => $row->reviewer->id,
                    'name' => $row->reviewer->name,
                    'email' => $row->reviewer->email,
                ] : null,
                'reviewed_at' => $row->reviewed_at?->toIso8601String(),
                'escalated_at' => $row->escalated_at?->toIso8601String(),
                'created_at' => $row->created_at?->toIso8601String(),
                'candidates' => $hydrated,
            ],
        ]);
    }

    /**
     * POST /api/v1/mapping-review/queue/{queueId}/approve
     *
     * Approve a single candidate. Writes to app.parthenon_concept_map and
     * flips the queue row to status='approved'. Idempotent: re-approving
     * the same queue row replaces the prior parthenon_concept_map row
     * (UNIQUE on source_code+source_vocab).
     */
    public function approve(HarmoniaApproveMappingRequest $request, int $queueId): JsonResponse
    {
        $validated = $request->validated();
        $conceptId = (int) $validated['concept_id'];

        return $this->db->transaction(function () use ($queueId, $conceptId, $validated, $request): JsonResponse {
            $row = MappingReviewQueueItem::query()
                ->where('queue_id', $queueId)
                ->lockForUpdate()
                ->firstOrFail();

            $candidates = is_array($row->candidate_ranking_json) ? $row->candidate_ranking_json : [];
            $candidate = null;
            foreach ($candidates as $c) {
                if (is_array($c) && (int) ($c['concept_id'] ?? 0) === $conceptId) {
                    $candidate = $c;
                    break;
                }
            }
            if ($candidate === null) {
                return response()->json([
                    'message' => 'concept_id is not in this queue row\'s candidate set; reject or escalate instead of approving an off-list concept.',
                ], 422);
            }

            $confidence = isset($validated['confidence_override'])
                ? (float) $validated['confidence_override']
                : (float) ($candidate['similarity'] ?? $row->top1_confidence);
            $confidence = max(0.0, min(1.0, $confidence));

            $userId = (int) $request->user()->id;

            // Insert-or-update the persistent mapping. UNIQUE(source_code, source_vocab)
            // keeps a single canonical mapping per source pair across re-reviews.
            $mapId = (int) DB::selectOne(<<<'SQL'
                INSERT INTO app.parthenon_concept_map (
                    source_code, source_vocab, source_text, omop_concept_id,
                    confidence, reviewer_id, reviewed_at, model_version,
                    candidate_ranking_json
                ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?::jsonb)
                ON CONFLICT (source_code, source_vocab) DO UPDATE SET
                    source_text            = EXCLUDED.source_text,
                    omop_concept_id        = EXCLUDED.omop_concept_id,
                    confidence             = EXCLUDED.confidence,
                    reviewer_id            = EXCLUDED.reviewer_id,
                    reviewed_at            = EXCLUDED.reviewed_at,
                    model_version          = EXCLUDED.model_version,
                    candidate_ranking_json = EXCLUDED.candidate_ranking_json
                RETURNING map_id
            SQL, [
                $row->source_code,
                $row->source_vocab,
                $row->source_text,
                $conceptId,
                $confidence,
                $userId,
                $row->model_version,
                json_encode($candidates, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ])->map_id;

            $row->update([
                'status' => MappingReviewQueueItem::STATUS_APPROVED,
                'approved_concept_id' => $conceptId,
                'approved_map_id' => $mapId,
                'rejection_reason' => null,
                'reviewer_id' => $userId,
                'reviewed_at' => now(),
                'escalated_at' => null,
            ]);

            return response()->json([
                'data' => $row->fresh()->load('reviewer:id,name,email'),
                'meta' => ['approved_map_id' => $mapId],
            ]);
        });
    }

    /**
     * POST /api/v1/mapping-review/queue/{queueId}/reject
     *
     * Reject all candidates. Keeps the queue row (status='rejected') with
     * the supplied reason; does NOT write to parthenon_concept_map. The
     * reviewer can later re-open a rejected row when better candidates
     * are produced by a re-run of Harmonia.
     */
    public function reject(HarmoniaRejectMappingRequest $request, int $queueId): JsonResponse
    {
        $validated = $request->validated();

        return $this->db->transaction(function () use ($queueId, $validated, $request): JsonResponse {
            $row = MappingReviewQueueItem::query()
                ->where('queue_id', $queueId)
                ->lockForUpdate()
                ->firstOrFail();

            $row->update([
                'status' => MappingReviewQueueItem::STATUS_REJECTED,
                'rejection_reason' => $validated['rejection_reason'],
                'approved_concept_id' => null,
                'approved_map_id' => null,
                'reviewer_id' => $request->user()->id,
                'reviewed_at' => now(),
                'escalated_at' => null,
            ]);

            return response()->json([
                'data' => $row->fresh()->load('reviewer:id,name,email'),
            ]);
        });
    }

    /**
     * POST /api/v1/mapping-review/queue/{queueId}/escalate
     *
     * Mark the row for senior-reviewer attention. Sets escalated_at;
     * a senior reviewer can later approve / reject and the audit trail
     * preserves the escalation note in rejection_reason (we reuse the
     * column to keep the schema small; semantic distinction is by status).
     */
    public function escalate(HarmoniaEscalateMappingRequest $request, int $queueId): JsonResponse
    {
        $validated = $request->validated();

        return $this->db->transaction(function () use ($queueId, $validated, $request): JsonResponse {
            $row = MappingReviewQueueItem::query()
                ->where('queue_id', $queueId)
                ->lockForUpdate()
                ->firstOrFail();

            $row->update([
                'status' => MappingReviewQueueItem::STATUS_ESCALATED,
                'rejection_reason' => $validated['note'],
                'approved_concept_id' => null,
                'approved_map_id' => null,
                'reviewer_id' => $request->user()->id,
                'escalated_at' => now(),
                'reviewed_at' => null,
            ]);

            return response()->json([
                'data' => $row->fresh()->load('reviewer:id,name,email'),
            ]);
        });
    }
}
