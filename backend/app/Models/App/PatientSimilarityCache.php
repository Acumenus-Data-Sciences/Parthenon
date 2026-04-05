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
        'query_hash',
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

    /**
     * @param  array<string, mixed>  $filters
     */
    public static function hashQuery(array $filters, int $limit, float $minScore): string
    {
        return hash('sha256', json_encode([
            'filters' => self::normalizeForHash($filters),
            'limit' => $limit,
            'min_score' => round($minScore, 4),
        ]));
    }

    /**
     * @param  mixed  $value
     * @return mixed
     */
    private static function normalizeForHash($value)
    {
        if (! is_array($value)) {
            return $value;
        }

        if (array_is_list($value)) {
            return array_map([self::class, 'normalizeForHash'], $value);
        }

        ksort($value);

        foreach ($value as $key => $item) {
            $value[$key] = self::normalizeForHash($item);
        }

        return $value;
    }
}
