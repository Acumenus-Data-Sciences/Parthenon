<?php

namespace App\Models\Vocabulary;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Pgvector\Laravel\HasNeighbors;
use Pgvector\Laravel\Vector;

class ConceptEmbedding extends VocabularyModel
{
    use HasNeighbors;

    protected $table = 'concept_embeddings';

    protected $primaryKey = 'concept_id';

    public $incrementing = false;

    protected $fillable = [
        'concept_id',
        'concept_name',
        'embedding',
    ];

    protected $guarded = [];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'embedding' => Vector::class,
        ];
    }

    /**
     * @return BelongsTo<Concept, $this>
     */
    public function concept(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'concept_id', 'concept_id');
    }
}
