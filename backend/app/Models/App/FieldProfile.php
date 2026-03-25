<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FieldProfile extends Model
{
    protected $fillable = [
        'source_profile_id',
        'table_name',
        'column_name',
        'column_index',
        'inferred_type',
        'non_null_count',
        'null_count',
        'null_percentage',
        'distinct_count',
        'distinct_percentage',
        'top_values',
        'sample_values',
        'statistics',
        'is_potential_pii',
        'pii_type',
        'row_count',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'null_percentage' => 'decimal:2',
            'distinct_percentage' => 'decimal:2',
            'top_values' => 'array',
            'sample_values' => 'array',
            'statistics' => 'array',
            'is_potential_pii' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<SourceProfile, $this>
     */
    public function sourceProfile(): BelongsTo
    {
        return $this->belongsTo(SourceProfile::class);
    }
}
