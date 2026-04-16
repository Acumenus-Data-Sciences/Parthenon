<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Models\App\FinnGen\AnalysisModule;
use App\Services\FinnGen\Exceptions\FinnGenUnknownAnalysisTypeException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator;

/**
 * Cached registry of enabled FinnGen analysis modules. Keyed by module key
 * (e.g. "co2.codewas"). Used by RunService/Job/Controller to look up the
 * Darkstar endpoint + min_role + settings_schema for a given analysis_type.
 *
 * SP3: validateParams() now performs JSON Schema validation against the
 * module's settings_schema using opis/json-schema. Returns structured
 * validation errors on failure.
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
     * Validate params against the module's settings_schema using JSON Schema.
     * Throws FinnGenUnknownAnalysisTypeException if the module key is invalid.
     *
     * @param  array<string, mixed>  $params
     * @return array{valid: bool, errors: list<string>}
     */
    public function validateParams(string $key, array $params): array
    {
        $module = $this->assertEnabled($key);

        $schema = $module->settings_schema;
        if (empty($schema)) {
            // No schema defined — accept anything (backward compat with SP1 modules).
            return ['valid' => true, 'errors' => []];
        }

        $validator = new Validator;
        $schemaObject = json_decode((string) json_encode($schema));
        $dataObject = json_decode((string) json_encode($params));

        $result = $validator->validate($dataObject, $schemaObject);

        if ($result->isValid()) {
            return ['valid' => true, 'errors' => []];
        }

        $formatter = new ErrorFormatter;
        $rawErrors = $formatter->format($result->error(), false);

        $flat = [];
        foreach ($rawErrors as $path => $messages) {
            foreach ($messages as $msg) {
                $flat[] = ($path !== '' ? "{$path}: " : '').$msg;
            }
        }

        return ['valid' => false, 'errors' => $flat];
    }

    public function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
