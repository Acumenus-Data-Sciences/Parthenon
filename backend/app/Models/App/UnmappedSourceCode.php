<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UnmappedSourceCode extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'source_id',
        'release_id',
        'source_code',
        'source_vocabulary_id',
        'cdm_table',
        'cdm_field',
        'record_count',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'record_count' => 'integer',
            'created_at' => 'datetime',
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
