<?php

namespace App\Tenancy;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $slug
 * @property string $display_name
 * @property string $billing_status
 * @property array<string, mixed>|null $settings
 */
class Tenant extends Model
{
    use HasFactory;

    protected $connection = 'pgsql';

    protected $table = 'tenants';

    protected $fillable = [
        'slug',
        'display_name',
        'billing_status',
        'settings',
    ];

    protected $casts = [
        'settings' => 'array',
    ];

    /**
     * The well-known default tenant for single-tenant deployments. Always id=1.
     * Throws if missing — DefaultTenantSeeder must run on every install.
     */
    public static function default(): self
    {
        $tenant = self::find(1);
        if ($tenant === null) {
            throw new \RuntimeException(
                'Default tenant (id=1) not seeded. Run db:seed --class=DefaultTenantSeeder.'
            );
        }

        return $tenant;
    }
}
