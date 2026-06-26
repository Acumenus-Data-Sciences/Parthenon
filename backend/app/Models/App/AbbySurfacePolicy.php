<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $surface
 * @property string $provider_mode
 * @property string|null $default_profile_id
 * @property array<int, string> $fallback_profile_ids
 * @property bool $never_send_phi_to_cloud
 * @property bool $allow_cloud
 * @property array<int, string> $required_capabilities
 * @property array<string, mixed> $settings
 */
class AbbySurfacePolicy extends Model
{
    protected $table = 'abby_surface_policies';

    protected $fillable = [
        'surface',
        'provider_mode',
        'default_profile_id',
        'fallback_profile_ids',
        'never_send_phi_to_cloud',
        'allow_cloud',
        'required_capabilities',
        'settings',
        'updated_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'fallback_profile_ids' => 'array',
            'never_send_phi_to_cloud' => 'boolean',
            'allow_cloud' => 'boolean',
            'required_capabilities' => 'array',
            'settings' => 'array',
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
