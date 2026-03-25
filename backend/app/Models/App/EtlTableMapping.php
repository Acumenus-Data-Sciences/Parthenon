<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EtlTableMapping extends Model
{
    protected $fillable = [
        'etl_project_id',
        'source_table',
        'target_table',
        'logic',
        'is_completed',
        'is_stem',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_completed' => 'boolean',
            'is_stem' => 'boolean',
        ];
    }

    /** @return BelongsTo<EtlProject, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(EtlProject::class, 'etl_project_id');
    }

    /** @return HasMany<EtlFieldMapping, $this> */
    public function fieldMappings(): HasMany
    {
        return $this->hasMany(EtlFieldMapping::class);
    }
}
