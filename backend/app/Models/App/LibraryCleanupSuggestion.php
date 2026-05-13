<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class LibraryCleanupSuggestion extends Model
{
    protected $table = 'library_cleanup_suggestions';

    public $timestamps = false;

    public $incrementing = false;

    protected $primaryKey = null;

    protected $fillable = [
        'user_id',
        'item_type',
        'item_id',
        'last_activity_at',
        'computed_at',
    ];

    protected $casts = [
        'last_activity_at' => 'datetime',
        'computed_at' => 'datetime',
    ];
}
