<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GenomicCohortCriterion extends Model
{
    protected $table = 'genomic_cohort_criteria';

    protected $fillable = [
        'created_by',
        'name',
        'criteria_type',
        'criteria_definition',
        'description',
        'is_shared',
    ];

    protected function casts(): array
    {
        return [
            'criteria_definition' => 'array',
            'is_shared' => 'boolean',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
