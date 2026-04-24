<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * CMS eCQM / dQM measure metadata (e.g., CMS2v15).
 *
 * @property string $cms_id
 * @property string|null $cbe_number
 * @property string|null $program_candidate
 * @property string|null $title
 * @property string|null $expansion_version
 * @property Carbon $ingested_at
 */
class VsacMeasure extends Model
{
    protected $primaryKey = 'cms_id';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = [
        'cms_id', 'cbe_number', 'program_candidate', 'title',
        'expansion_version', 'ingested_at',
    ];

    protected $casts = [
        'ingested_at' => 'datetime',
    ];

    public function valueSets(): BelongsToMany
    {
        return $this->belongsToMany(
            VsacValueSet::class,
            'vsac_measure_value_sets',
            'cms_id',
            'value_set_oid',
        );
    }
}
