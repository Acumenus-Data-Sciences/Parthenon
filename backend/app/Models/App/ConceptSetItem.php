<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConceptSetItem extends Model
{
    protected $fillable = [
        'concept_set_id',
        'concept_id',
        'is_excluded',
        'include_descendants',
        'include_mapped',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_excluded' => 'boolean',
            'include_descendants' => 'boolean',
            'include_mapped' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<ConceptSet, $this>
     */
    public function conceptSet(): BelongsTo
    {
        return $this->belongsTo(ConceptSet::class);
    }
}
