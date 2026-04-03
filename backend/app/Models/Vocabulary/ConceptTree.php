<?php

namespace App\Models\Vocabulary;

class ConceptTree extends VocabularyModel
{
    protected $table = 'concept_tree';

    protected $primaryKey = null;

    public $incrementing = false;

    protected $fillable = [
        'parent_concept_id',
        'child_concept_id',
        'domain_id',
        'child_depth',
        'vocabulary_id',
        'concept_class_id',
        'child_name',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'parent_concept_id' => 'integer',
            'child_concept_id' => 'integer',
            'child_depth' => 'integer',
        ];
    }
}
