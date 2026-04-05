<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClinicalGrouping extends Model
{
    protected $connection = 'pgsql';

    protected $table = 'clinical_groupings';

    protected $fillable = [
        'name',
        'description',
        'domain_id',
        'anchor_concept_ids',
        'sort_order',
        'icon',
        'color',
        'parent_grouping_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'anchor_concept_ids' => 'array',
            'sort_order' => 'integer',
        ];
    }

    /**
     * @return HasMany<self, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_grouping_id');
    }

    /**
     * @return BelongsTo<self, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_grouping_id');
    }
}
