<?php

namespace App\Models\Vocabulary;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConceptAncestor extends VocabularyModel
{
    protected $table = 'concept_ancestor';

    public $incrementing = false;

    /**
     * @return BelongsTo<Concept, $this>
     */
    public function ancestor(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'ancestor_concept_id', 'concept_id');
    }

    /**
     * @return BelongsTo<Concept, $this>
     */
    public function descendant(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'descendant_concept_id', 'concept_id');
    }
}
