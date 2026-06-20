<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CohortPhenotypeAdjudication extends Model
{
    protected $fillable = [
        'phenotype_validation_id',
        'person_id',
        'sample_group',
        'label',
        'status',
        'notes',
        'payload_json',
        'demographics_json',
        'sampling_json',
        'sampled_at',
        'reviewer_id',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'payload_json' => 'array',
            'demographics_json' => 'array',
            'sampling_json' => 'array',
            'sampled_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function validation(): BelongsTo
    {
        return $this->belongsTo(CohortPhenotypeValidation::class, 'phenotype_validation_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(CohortPhenotypeAdjudicationReview::class, 'adjudication_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(CohortPhenotypeAdjudicationEvent::class, 'adjudication_id');
    }
}
