<?php

namespace App\Models\App;

use App\Enums\DaimonType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SourceDaimon extends Model
{
    protected $table = 'source_daimons';

    protected $fillable = [
        'source_id',
        'daimon_type',
        'table_qualifier',
        'priority',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'daimon_type' => DaimonType::class,
            'priority' => 'integer',
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
