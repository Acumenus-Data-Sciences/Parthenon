<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class MappingCache extends Model
{
    protected $table = 'mapping_cache';

    protected $fillable = [
        'source_code',
        'source_description',
        'source_vocabulary_id',
        'target_concept_id',
        'confidence',
        'strategy',
        'times_confirmed',
        'last_confirmed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'confidence' => 'decimal:4',
            'last_confirmed_at' => 'datetime',
        ];
    }
}
