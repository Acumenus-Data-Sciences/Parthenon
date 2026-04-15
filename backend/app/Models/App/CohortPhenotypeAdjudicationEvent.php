<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CohortPhenotypeAdjudicationEvent extends Model
{
    protected $fillable = [
        'phenotype_validation_id',
        'adjudication_id',
        'actor_id',
        'event_type',
        'before_json',
        'after_json',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'before_json' => 'array',
            'after_json' => 'array',
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
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
