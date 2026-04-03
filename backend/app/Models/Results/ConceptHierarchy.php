<?php

namespace App\Models\Results;

use Illuminate\Database\Eloquent\Builder;

class ConceptHierarchy extends ResultsModel
{
    protected $table = 'concept_hierarchy';

    protected $primaryKey = null;

    public $incrementing = false;

    protected $fillable = [
        'concept_id',
        'concept_name',
        'treemap',
        'concept_hierarchy_type',
        'level1_concept_id',
        'level1_concept_name',
        'level2_concept_id',
        'level2_concept_name',
        'level3_concept_id',
        'level3_concept_name',
        'level4_concept_id',
        'level4_concept_name',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'concept_id' => 'integer',
            'level1_concept_id' => 'integer',
            'level2_concept_id' => 'integer',
            'level3_concept_id' => 'integer',
            'level4_concept_id' => 'integer',
        ];
    }

    /**
     * Scope to filter by treemap domain (e.g., 'Condition', 'Drug').
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeForDomain(Builder $query, string $domain): Builder
    {
        return $query->where('treemap', $domain);
    }
}
