<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Code row inside a VSAC value set.
 *
 * @property int $id
 * @property string $value_set_oid
 * @property string $code
 * @property string|null $description
 * @property string $code_system
 * @property string|null $code_system_oid
 * @property string|null $code_system_version
 */
class VsacValueSetCode extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'value_set_oid', 'code', 'description', 'code_system',
        'code_system_oid', 'code_system_version',
    ];

    public function valueSet(): BelongsTo
    {
        return $this->belongsTo(VsacValueSet::class, 'value_set_oid', 'value_set_oid');
    }
}
