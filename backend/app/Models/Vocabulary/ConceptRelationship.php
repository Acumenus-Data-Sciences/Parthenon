<?php

namespace App\Models\Vocabulary;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConceptRelationship extends VocabularyModel
{
    protected $table = 'concept_relationships';

    public $incrementing = false;

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
    public function concept1(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'concept_id_1', 'concept_id');
    }

    /**
     * @return BelongsTo<Concept, $this>
     */
    public function concept2(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'concept_id_2', 'concept_id');
    }

    /**
     * @return BelongsTo<Relationship, $this>
     */
    public function relationship(): BelongsTo
    {
        return $this->belongsTo(Relationship::class, 'relationship_id', 'relationship_id');
    }
}
