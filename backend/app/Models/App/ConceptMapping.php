<?php

namespace App\Models\App;

use App\Enums\ReviewTier;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConceptMapping extends Model
{
    protected $fillable = [
        'ingestion_job_id',
        'source_code',
        'source_description',
        'source_vocabulary_id',
        'target_concept_id',
        'confidence',
        'strategy',
        'is_reviewed',
        'reviewer_id',
        'source_table',
        'source_column',
        'source_frequency',
        'review_tier',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'confidence' => 'decimal:4',
            'is_reviewed' => 'boolean',
            'review_tier' => ReviewTier::class,
        ];
    }

    /**
     * @return BelongsTo<IngestionJob, $this>
     */
    public function ingestionJob(): BelongsTo
    {
        return $this->belongsTo(IngestionJob::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    /**
     * @return HasMany<MappingReview, $this>
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(MappingReview::class);
    }

    /**
     * @return HasMany<MappingCandidate, $this>
     */
    public function candidates(): HasMany
    {
        return $this->hasMany(MappingCandidate::class);
    }
}
