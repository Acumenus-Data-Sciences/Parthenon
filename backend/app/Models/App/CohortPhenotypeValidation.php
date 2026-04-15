<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CohortPhenotypeValidation extends Model
{
    protected $fillable = [
        'cohort_definition_id',
        'source_id',
        'mode',
        'status',
        'review_state',
        'counts_json',
        'metrics_json',
        'notes',
        'created_by',
        'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'counts_json' => 'array',
            'metrics_json' => 'array',
            'computed_at' => 'datetime',
        ];
    }

    public function cohortDefinition(): BelongsTo
    {
        return $this->belongsTo(CohortDefinition::class);
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function adjudications(): HasMany
    {
        return $this->hasMany(CohortPhenotypeAdjudication::class, 'validation_id');
    }
}
