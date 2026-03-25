<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Data quality SLA target per source and category.
 *
 * @property int $id
 * @property int $source_id
 * @property string $category
 * @property float $min_pass_rate
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class DqSlaTarget extends Model
{
    protected $table = 'dq_sla_targets';

    protected $fillable = [
        'source_id',
        'category',
        'min_pass_rate',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'min_pass_rate' => 'float',
        ];
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
