<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class EtlProject extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'source_id',
        'cdm_version',
        'name',
        'status',
        'created_by',
        'scan_profile_id',
        'notes',
    ];

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<SourceProfile, $this> */
    public function scanProfile(): BelongsTo
    {
        return $this->belongsTo(SourceProfile::class, 'scan_profile_id');
    }

    /** @return HasMany<EtlTableMapping, $this> */
    public function tableMappings(): HasMany
    {
        return $this->hasMany(EtlTableMapping::class)->orderBy('sort_order');
    }
}
