<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Models\App\FinnGen\AnalysisModule;
use App\Services\FinnGen\Exceptions\FinnGenUnknownAnalysisTypeException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Cached registry of enabled FinnGen analysis modules. Keyed by module key
 * (e.g. "co2.codewas"). Used by RunService/Job/Controller to look up the
 * Darkstar endpoint + min_role + settings_schema for a given analysis_type.
 *
 * SP1: SELECTs enabled rows from app.finngen_analysis_modules, caches for
 * 5 minutes. validateParams() is a no-op stub — SP3 fills it with JSON
 * Schema validation against $module->settings_schema.
 */
class FinnGenAnalysisModuleRegistry
{
    private const CACHE_KEY = 'finngen:analysis-modules:enabled';

    private const CACHE_TTL = 300;  // seconds

    /** @return array<string, AnalysisModule> */
    public function all(): array
    {
        /** @var array<string, AnalysisModule> $cached */
        $cached = Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            /** @var Collection<int, AnalysisModule> $rows */
            $rows = AnalysisModule::enabled()->get();

            return $rows->keyBy('key')->all();
        });

        return $cached;
    }

    public function find(string $key): ?AnalysisModule
    {
        return $this->all()[$key] ?? null;
    }

    /**
     * @throws FinnGenUnknownAnalysisTypeException
     */
    public function assertEnabled(string $key): AnalysisModule
    {
        $module = $this->find($key);
        if (! $module) {
            throw new FinnGenUnknownAnalysisTypeException(
                "Analysis type '{$key}' is not registered or is disabled"
            );
        }

        return $module;
    }

    /**
     * SP1 stub — accepts any params shape. SP3 implements JSON-Schema
     * validation against $module->settings_schema so controllers don't
     * need to change when SP3 lands.
     *
     * @param  array<string, mixed>  $params
     */
    public function validateParams(string $key, array $params): void
    {
        $this->assertEnabled($key);
        // SP3 will add JSON Schema validation here.
    }

    public function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
