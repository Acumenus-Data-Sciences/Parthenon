<?php

namespace App\Models\App;

use Database\Factories\DqdResultFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DqdResult extends Model
{
    use HasFactory;

    protected static function newFactory(): DqdResultFactory
    {
        return DqdResultFactory::new();
    }

    protected $fillable = [
        'source_id',
        'run_id',
        'check_id',
        'category',
        'subcategory',
        'cdm_table',
        'cdm_column',
        'severity',
        'threshold',
        'passed',
        'violated_rows',
        'total_rows',
        'violation_percentage',
        'description',
        'details',
        'execution_time_ms',
        'release_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'passed' => 'boolean',
            'violated_rows' => 'integer',
            'total_rows' => 'integer',
            'violation_percentage' => 'float',
            'threshold' => 'float',
            'execution_time_ms' => 'integer',
            'details' => 'array',
            'release_id' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /**
     * @return BelongsTo<SourceRelease, $this>
     */
    public function release(): BelongsTo
    {
        return $this->belongsTo(SourceRelease::class, 'release_id');
    }
}
