<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** @property-read Source|null $source */
class AqueductSession extends Model
{
    use SoftDeletes;

    protected $table = 'aqueduct_sessions';

    protected $fillable = [
        'user_id',
        'source_id',
        'name',
        'cdm_version',
        'scan_report_name',
        'scan_report_path',
        'source_schema',
        'mapping_config',
        'status',
    ];

    protected $casts = [
        'source_schema' => 'array',
        'mapping_config' => 'array',
    ];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /** @return HasMany<AqueductRun, $this> */
    public function runs(): HasMany
    {
        return $this->hasMany(AqueductRun::class, 'session_id');
    }
}
