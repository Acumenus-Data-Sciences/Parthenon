<?php

namespace App\Models\App;

use App\Enums\DaimonType;
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
    ];

    protected $hidden = [
        'username',
        'password',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_cache_enabled' => 'boolean',
            'password' => 'encrypted',
        ];
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
