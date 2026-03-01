<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConceptMapping extends Model
{
    protected $fillable = [
        'source_code',
        'source_description',
        'source_vocabulary_id',
        'target_concept_id',
        'confidence',
        'strategy',
        'is_reviewed',
        'reviewer_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'confidence' => 'decimal:4',
            'is_reviewed' => 'boolean',
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
     * @return HasMany<MappingReview, $this>
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(MappingReview::class);
    }
}
