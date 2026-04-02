<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class SimilarityDimension extends Model
{
    public $timestamps = false;

    protected $table = 'similarity_dimensions';

    protected $fillable = [
        'key',
        'name',
        'description',
        'default_weight',
        'is_active',
        'config',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'default_weight' => 'float',
            'is_active' => 'boolean',
            'config' => 'array',
        ];
    }

    /**
     * @param  Builder<SimilarityDimension>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }
}
