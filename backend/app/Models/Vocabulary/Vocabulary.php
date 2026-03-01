<?php

namespace App\Models\Vocabulary;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Vocabulary extends VocabularyModel
{
    protected $table = 'vocabularies';

    protected $primaryKey = 'vocabulary_id';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @return HasMany<Concept, $this>
     */
    public function concepts(): HasMany
    {
        return $this->hasMany(Concept::class, 'vocabulary_id', 'vocabulary_id');
    }
}
