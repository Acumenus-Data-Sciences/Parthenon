<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $profile_id
 * @property string $display_name
 * @property string $provider_type
 * @property string $transport
 * @property string $entitlement_type
 * @property string $model
 * @property string|null $base_url
 * @property string|null $provider_setting_type
 * @property bool $is_enabled
 * @property array<int, string> $capabilities
 * @property array<string, mixed> $safety
 * @property array<string, mixed> $limits
 * @property array<int, string> $fallback_profile_ids
 * @property array<int, string> $notes
 */
class AbbyProviderProfile extends Model
{
    protected $table = 'abby_provider_profiles';

    protected $fillable = [
        'profile_id',
        'display_name',
        'provider_type',
        'transport',
        'entitlement_type',
        'model',
        'base_url',
        'provider_setting_type',
        'is_enabled',
        'capabilities',
        'safety',
        'limits',
        'fallback_profile_ids',
        'notes',
        'updated_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'capabilities' => 'array',
            'safety' => 'array',
            'limits' => 'array',
            'fallback_profile_ids' => 'array',
            'notes' => 'array',
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
