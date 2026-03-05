<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudyCohort extends Model
{
    protected $fillable = [
        'study_id',
        'cohort_definition_id',
        'role',
        'label',
        'description',
        'sql_definition',
        'json_definition',
        'concept_set_ids',
        'sort_order',
    ];

    protected $casts = [
        'json_definition' => 'array',
        'concept_set_ids' => 'array',
    ];

    /**
     * @return BelongsTo<Study, $this>
     */
    public function study(): BelongsTo
    {
        return $this->belongsTo(Study::class);
    }

    /**
     * @return BelongsTo<CohortDefinition, $this>
     */
    public function cohortDefinition(): BelongsTo
    {
        return $this->belongsTo(CohortDefinition::class);
    }
}
