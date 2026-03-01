<?php

namespace App\Models\Vocabulary;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConceptSynonym extends VocabularyModel
{
    protected $table = 'concept_synonyms';

    /**
     * @return BelongsTo<Concept, $this>
     */
    public function concept(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'concept_id', 'concept_id');
    }
}
