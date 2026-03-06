<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AtlasIdMapping extends Model
{
    protected $table = 'atlas_id_mappings';

    protected $fillable = [
        'migration_id',
        'entity_type',
        'atlas_id',
        'parthenon_id',
        'atlas_name',
        'status',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'atlas_id' => 'integer',
            'parthenon_id' => 'integer',
        ];
    }

    /** @return BelongsTo<AtlasMigration, $this> */
    public function migration(): BelongsTo
    {
        return $this->belongsTo(AtlasMigration::class, 'migration_id');
    }
}
