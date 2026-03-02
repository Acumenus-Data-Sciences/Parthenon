<?php

namespace App\Models\Vocabulary;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Domain extends VocabularyModel
{
    protected $table = 'domain';

    protected $primaryKey = 'domain_id';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @return HasMany<Concept, $this>
     */
    public function concepts(): HasMany
    {
        return $this->hasMany(Concept::class, 'domain_id', 'domain_id');
    }
}
