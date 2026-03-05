<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiProviderSetting extends Model
{
    protected $table = 'ai_provider_settings';

    protected $fillable = [
        'provider_type',
        'display_name',
        'is_enabled',
        'is_active',
        'model',
        'settings',
        'updated_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'is_active' => 'boolean',
            'settings' => 'encrypted:array',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
