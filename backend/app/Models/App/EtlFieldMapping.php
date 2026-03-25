<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EtlFieldMapping extends Model
{
    protected $fillable = [
        'etl_table_mapping_id',
        'source_column',
        'target_column',
        'mapping_type',
        'logic',
        'is_required',
        'confidence',
        'is_ai_suggested',
        'is_reviewed',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'confidence' => 'float',
            'is_ai_suggested' => 'boolean',
            'is_reviewed' => 'boolean',
        ];
    }

    /** @return BelongsTo<EtlTableMapping, $this> */
    public function tableMapping(): BelongsTo
    {
        return $this->belongsTo(EtlTableMapping::class, 'etl_table_mapping_id');
    }
}
