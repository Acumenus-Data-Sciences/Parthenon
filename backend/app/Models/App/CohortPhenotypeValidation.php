<?php

namespace App\Models\App;

use App\Enums\ExecutionStatus;
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
        'settings_json',
        'result_json',
        'counts_json',
        'metrics_json',
        'notes',
        'fail_message',
        'author_id',
        'created_by',
        'started_at',
        'completed_at',
        'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ExecutionStatus::class,
            'settings_json' => 'array',
            'result_json' => 'array',
            'counts_json' => 'array',
            'metrics_json' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
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
        return $this->hasMany(CohortPhenotypeAdjudication::class, 'phenotype_validation_id');
    }
}
