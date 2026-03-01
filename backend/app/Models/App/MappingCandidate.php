<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MappingCandidate extends Model
{
    protected $fillable = [
        'concept_mapping_id',
        'target_concept_id',
        'concept_name',
        'domain_id',
        'vocabulary_id',
        'standard_concept',
        'score',
        'strategy',
        'strategy_scores',
        'rank',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'score' => 'decimal:4',
            'strategy_scores' => 'array',
        ];
    }

    /**
     * @return BelongsTo<ConceptMapping, $this>
     */
    public function conceptMapping(): BelongsTo
    {
        return $this->belongsTo(ConceptMapping::class);
    }
}
