<?php

namespace App\Models\Vocabulary;

class Relationship extends VocabularyModel
{
    protected $table = 'relationships';

    protected $primaryKey = 'relationship_id';

    public $incrementing = false;

    protected $keyType = 'string';
}
