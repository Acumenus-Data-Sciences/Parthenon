<?php

namespace App\Models\Vocabulary;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SourceToConceptMap extends VocabularyModel
{
    protected $table = 'source_to_concept_maps';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'valid_start_date' => 'date',
            'valid_end_date' => 'date',
        ];
    }

    /**
     * @return BelongsTo<Concept, $this>
     */
    public function sourceConcept(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'source_concept_id', 'concept_id');
    }

    /**
     * @return BelongsTo<Concept, $this>
     */
    public function targetConcept(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'target_concept_id', 'concept_id');
    }
}
