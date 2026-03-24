<?php

namespace App\Models\App;

use App\Enums\DaimonType;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Source extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'sources';

    protected $fillable = [
        'source_name',
        'source_key',
        'source_dialect',
        'source_connection',
        'is_cache_enabled',
        'is_default',
        'restricted_to_roles',
        'imported_from_webapi',
        // Dynamic connection fields (DB-1.1)
        'db_host',
        'db_port',
        'db_database',
        'db_options',
        'username',
        'password',
        'release_mode',
    ];

    protected $hidden = [
        'username',
        'password',
        'db_options',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_cache_enabled' => 'boolean',
            'is_default' => 'boolean',
            'password' => 'encrypted',
            'db_options' => 'encrypted:array',
            'db_port' => 'integer',
            'restricted_to_roles' => 'array',
            'release_mode' => 'string',
        ];
    }

    /**
     * Scope: only sources visible to the given user.
     *
     * If restricted_to_roles is NULL or empty, the source is visible to everyone.
     * Otherwise, the user must hold at least one of the listed roles.
     *
     * @param  Builder<Source>  $query
     */
    public function scopeVisibleToUser(Builder $query, User $user): void
    {
        if ($user->hasRole('super-admin')) {
            return;
        }

        $userRoles = $user->getRoleNames()->toArray();

        $query->where(function (Builder $q) use ($userRoles) {
            $q->whereNull('restricted_to_roles')
                ->orWhereJsonLength('restricted_to_roles', 0);

            foreach ($userRoles as $role) {
                $q->orWhereJsonContains('restricted_to_roles', $role);
            }
        });
    }

    /**
     * @return HasMany<SourceRelease, $this>
     */
    public function releases(): HasMany
    {
        return $this->hasMany(SourceRelease::class);
    }

    /**
     * @return HasMany<SourceDaimon, $this>
     */
    public function daimons(): HasMany
    {
        return $this->hasMany(SourceDaimon::class);
    }

    public function getTableQualifier(DaimonType $type): ?string
    {
        /** @var SourceDaimon|null $daimon */
        $daimon = $this->daimons->firstWhere('daimon_type', $type->value);

        if ($daimon) {
            return $daimon->table_qualifier;
        }

        if ($type === DaimonType::Vocabulary) {
            /** @var SourceDaimon|null $cdm */
            $cdm = $this->daimons->firstWhere('daimon_type', DaimonType::CDM->value);

            return $cdm?->table_qualifier;
        }

        return null;
    }
}
