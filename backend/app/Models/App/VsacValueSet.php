<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Casts\AsArrayObject;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * VSAC (Value Set Authority Center) value set metadata.
 *
 * One row per canonical OID from CMS dQM/eCQM packages. Codes live in
 * vsac_value_set_codes; measure linkage in vsac_measure_value_sets.
 *
 * @property string $value_set_oid
 * @property string $name
 * @property string|null $definition_version
 * @property string|null $expansion_version
 * @property string|null $expansion_id
 * @property string|null $qdm_category
 * @property string|null $purpose_clinical_focus
 * @property string|null $purpose_data_scope
 * @property string|null $purpose_inclusion
 * @property string|null $purpose_exclusion
 * @property array|null $source_files
 * @property Carbon $ingested_at
 */
class VsacValueSet extends Model
{
    protected $primaryKey = 'value_set_oid';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = [
        'value_set_oid', 'name', 'definition_version', 'expansion_version',
        'expansion_id', 'qdm_category', 'purpose_clinical_focus',
        'purpose_data_scope', 'purpose_inclusion', 'purpose_exclusion',
        'source_files', 'ingested_at',
    ];

    protected $casts = [
        'source_files' => AsArrayObject::class,
        'ingested_at' => 'datetime',
    ];

    public function codes(): HasMany
    {
        return $this->hasMany(VsacValueSetCode::class, 'value_set_oid', 'value_set_oid');
    }

    public function measures(): BelongsToMany
    {
        return $this->belongsToMany(
            VsacMeasure::class,
            'vsac_measure_value_sets',
            'value_set_oid',
            'cms_id',
        );
    }
}
