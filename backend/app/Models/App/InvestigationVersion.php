<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvestigationVersion extends Model
{
    protected $table = 'investigation_versions';

    protected $fillable = [
        'investigation_id',
        'version_number',
        'snapshot',
        'created_by',
    ];

    protected $casts = [
        'snapshot' => 'array',
        'version_number' => 'integer',
    ];

    /** @return BelongsTo<Investigation, $this> */
    public function investigation(): BelongsTo
    {
        return $this->belongsTo(Investigation::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
