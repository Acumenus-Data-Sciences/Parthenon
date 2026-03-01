<?php

namespace App\Models\Vocabulary;

use Illuminate\Database\Eloquent\Relations\HasMany;

class ConceptClass extends VocabularyModel
{
    protected $table = 'concept_classes';

    protected $primaryKey = 'concept_class_id';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @return HasMany<Concept, $this>
     */
    public function concepts(): HasMany
    {
        return $this->hasMany(Concept::class, 'concept_class_id', 'concept_class_id');
    }
}
