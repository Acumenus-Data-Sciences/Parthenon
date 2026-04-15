<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CohortPhenotypePromotion extends Model
{
    protected $fillable = [
        'cohort_definition_id',
        'validation_id',
        'promoted_cohort_definition_id',
        'status',
        'notes',
        'promoted_by',
        'promoted_at',
    ];

    protected function casts(): array
    {
        return [
            'promoted_at' => 'datetime',
        ];
    }

    public function cohortDefinition(): BelongsTo
    {
        return $this->belongsTo(CohortDefinition::class);
    }

    public function validation(): BelongsTo
    {
        return $this->belongsTo(CohortPhenotypeValidation::class, 'validation_id');
    }

    public function promotedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'promoted_by');
    }
}
