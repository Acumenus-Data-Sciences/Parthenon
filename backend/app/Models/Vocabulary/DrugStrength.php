<?php

namespace App\Models\Vocabulary;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DrugStrength extends VocabularyModel
{
    protected $table = 'drug_strength';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount_value' => 'decimal:6',
            'numerator_value' => 'decimal:6',
            'denominator_value' => 'decimal:6',
            'valid_start_date' => 'date',
            'valid_end_date' => 'date',
        ];
    }

    /**
     * @return BelongsTo<Concept, $this>
     */
    public function drug(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'drug_concept_id', 'concept_id');
    }

    /**
     * @return BelongsTo<Concept, $this>
     */
    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(Concept::class, 'ingredient_concept_id', 'concept_id');
    }
}
