<?php

declare(strict_types=1);

namespace App\Models\App\FinnGen;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * FinnGen analysis module registry entry. SP1 seeds the registry with 4
 * entries (co2.codewas, co2.time_codewas, co2.overlaps, co2.demographics).
 * SP3 Analysis Module Gallery fills out settings_schema + default_settings
 * + result_schema + result_component.
 *
 * @property string $key
 * @property string $label
 * @property string $description
 * @property string $darkstar_endpoint
 * @property bool $enabled
 * @property string $min_role
 * @property array<string, mixed>|null $settings_schema
 * @property array<string, mixed>|null $default_settings
 * @property array<string, mixed>|null $result_schema
 * @property string|null $result_component
 */
class AnalysisModule extends Model
{
    protected $table = 'app.finngen_analysis_modules';

    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'key', 'label', 'description', 'darkstar_endpoint',
        'enabled', 'min_role',
        'settings_schema', 'default_settings', 'result_schema', 'result_component',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'enabled' => 'boolean',
        'settings_schema' => 'array',
        'default_settings' => 'array',
        'result_schema' => 'array',
    ];

    /**
     * Scope: only enabled modules.
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeEnabled(Builder $query): Builder
    {
        return $query->where('enabled', true);
    }
}
