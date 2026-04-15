<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CohortPhenotypeAdjudicationReview extends Model
{
    protected $fillable = [
        'phenotype_validation_id',
        'adjudication_id',
        'reviewer_id',
        'label',
        'notes',
        'reviewed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<CohortPhenotypeValidation, $this>
     */
    public function validation(): BelongsTo
    {
        return $this->belongsTo(CohortPhenotypeValidation::class, 'phenotype_validation_id');
    }

    /**
     * @return BelongsTo<CohortPhenotypeAdjudication, $this>
     */
    public function adjudication(): BelongsTo
    {
        return $this->belongsTo(CohortPhenotypeAdjudication::class, 'adjudication_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
