<?php

declare(strict_types=1);

namespace App\Models\App;

use App\Models\User;
use Database\Factories\MappingReviewQueueItemFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Phase 3 Plan 7 Task 1 (T-024B): app.parthenon_mapping_review_queue row.
 *
 * One row per unmapped (source_code, source_vocab) pair fed by the
 * Plan 6 (T-024A) ConceptMappingSuggesterNode pipeline. The Harmonia
 * reviewer UI reads pending rows; the reviewer picks the right candidate
 * from candidate_ranking_json. Approve writes a row to
 * app.parthenon_concept_map and flips status to 'approved'. Reject and
 * Escalate keep the queue row but flip status; rows are never deleted so
 * reviewer decisions remain fully auditable.
 *
 * @property int $queue_id
 * @property string $source_code
 * @property string $source_vocab
 * @property string|null $source_text
 * @property int $seen_count
 * @property array<int, array{concept_id: int, concept_name: string, vocabulary_id: string, domain_id?: string, similarity: float}> $candidate_ranking_json
 * @property float $top1_confidence
 * @property string $model_version
 * @property string $status
 * @property int|null $approved_concept_id
 * @property int|null $approved_map_id
 * @property string|null $rejection_reason
 * @property int|null $reviewer_id
 * @property Carbon|null $reviewed_at
 * @property Carbon|null $escalated_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read array{concept_id: int, concept_name: string, vocabulary_id: string, similarity: float}|null $top_candidate
 */
class MappingReviewQueueItem extends Model
{
    /** @use HasFactory<MappingReviewQueueItemFactory> */
    use HasFactory;

    protected $table = 'parthenon_mapping_review_queue';

    protected $primaryKey = 'queue_id';

    protected $fillable = [
        'source_code',
        'source_vocab',
        'source_text',
        'seen_count',
        'candidate_ranking_json',
        'top1_confidence',
        'model_version',
        'status',
        'approved_concept_id',
        'approved_map_id',
        'rejection_reason',
        'reviewer_id',
        'reviewed_at',
        'escalated_at',
    ];

    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_ESCALATED = 'escalated';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'queue_id' => 'integer',
            'seen_count' => 'integer',
            'candidate_ranking_json' => 'array',
            'top1_confidence' => 'float',
            'approved_concept_id' => 'integer',
            'approved_map_id' => 'integer',
            'reviewer_id' => 'integer',
            'reviewed_at' => 'datetime',
            'escalated_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    /**
     * Top-1 candidate for the queue page (avoids shipping the full top-K
     * payload over the wire for the list view).
     *
     * @return Attribute<array{concept_id: int, concept_name: string, vocabulary_id: string, similarity: float}|null, never>
     */
    protected function topCandidate(): Attribute
    {
        return Attribute::make(
            get: function (): ?array {
                $ranking = $this->candidate_ranking_json;
                if (! is_array($ranking) || count($ranking) === 0) {
                    return null;
                }
                $first = $ranking[0] ?? null;
                if (! is_array($first)) {
                    return null;
                }

                return [
                    'concept_id' => (int) ($first['concept_id'] ?? 0),
                    'concept_name' => (string) ($first['concept_name'] ?? ''),
                    'vocabulary_id' => (string) ($first['vocabulary_id'] ?? ''),
                    'similarity' => (float) ($first['similarity'] ?? 0.0),
                ];
            },
        );
    }
}
