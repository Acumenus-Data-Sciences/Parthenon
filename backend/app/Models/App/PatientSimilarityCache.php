<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class PatientSimilarityCache extends Model
{
    public $timestamps = false;

    protected $table = 'patient_similarity_cache';

    protected $fillable = [
        'source_id',
        'seed_person_id',
        'mode',
        'weights_hash',
        'results',
        'computed_at',
        'expires_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'results' => 'array',
            'computed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<PatientSimilarityCache>  $query
     */
    public function scopeValid(Builder $query): void
    {
        $query->where('expires_at', '>', now());
    }

    /**
     * @param  array<string, float>  $weights
     */
    public static function hashWeights(array $weights): string
    {
        ksort($weights);

        return hash('sha256', json_encode($weights));
    }
}
