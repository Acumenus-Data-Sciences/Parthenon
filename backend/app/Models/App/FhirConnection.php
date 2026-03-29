<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FhirConnection extends Model
{
    protected $fillable = [
        'site_name',
        'site_key',
        'ehr_vendor',
        'fhir_base_url',
        'token_endpoint',
        'client_id',
        'private_key_pem',
        'jwks_url',
        'scopes',
        'group_id',
        'export_resource_types',
        'target_source_id',
        'sync_config',
        'is_active',
        'incremental_enabled',
        'last_sync_at',
        'last_sync_status',
        'last_sync_records',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'private_key_pem' => 'encrypted',
            'sync_config' => 'array',
            'is_active' => 'boolean',
            'incremental_enabled' => 'boolean',
            'last_sync_at' => 'datetime',
            'last_sync_records' => 'integer',
        ];
    }

    /** Redact the private key from JSON serialization. */
    protected $hidden = ['private_key_pem'];

    /** @return BelongsTo<Source, $this> */
    public function targetSource(): BelongsTo
    {
        return $this->belongsTo(Source::class, 'target_source_id');
    }

    /** @return HasMany<FhirSyncRun, $this> */
    public function syncRuns(): HasMany
    {
        return $this->hasMany(FhirSyncRun::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Whether a private key has been uploaded (exposed as attribute, not the key itself). */
    public function getHasPrivateKeyAttribute(): bool
    {
        return $this->private_key_pem !== null && $this->private_key_pem !== '';
    }

    /** Append this computed attribute to JSON. */
    protected $appends = ['has_private_key'];

    /** Whether this connection uses SMART Backend Services (JWT) auth. */
    public function usesSmartBackendServices(): bool
    {
        return ($this->auth_mode ?? 'smart_backend_services') === 'smart_backend_services';
    }
}
