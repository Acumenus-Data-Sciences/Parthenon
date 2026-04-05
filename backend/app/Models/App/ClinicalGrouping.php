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
            'sort_order' => 'integer',
        ];
    }

    /**
     * Parse PostgreSQL integer array literal (e.g., "{134057,31821}") to PHP array.
     *
     * @return list<int>
     */
    public function getAnchorConceptIdsAttribute(mixed $value): array
    {
        if ($value === null) {
            return [];
        }

        if (is_array($value)) {
            return array_map('intval', $value);
        }

        // PostgreSQL array format: {1,2,3}
        $trimmed = trim((string) $value, '{}');
        if ($trimmed === '') {
            return [];
        }

        return array_map('intval', explode(',', $trimmed));
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
