<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
        'reviewed_by',
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
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
