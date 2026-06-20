<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CohortPhenotypePromotion extends Model
{
    protected $fillable = [
        'cohort_definition_id',
        'phenotype_validation_id',
        'promoted_cohort_definition_id',
        'status',
        'promoted_quality_tier',
        'quality_summary_json',
        'notes',
        'approver_id',
        'promoted_at',
    ];

    protected function casts(): array
    {
        return [
            'quality_summary_json' => 'array',
            'promoted_at' => 'datetime',
        ];
    }

    public function cohortDefinition(): BelongsTo
    {
        return $this->belongsTo(CohortDefinition::class);
    }

    public function validation(): BelongsTo
    {
        return $this->belongsTo(CohortPhenotypeValidation::class, 'phenotype_validation_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }
}
