<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Services\FinnGen\Exceptions\FinnGenSourceDisabledException;
use App\Services\FinnGen\Exceptions\FinnGenSourceNotFoundException;
use Illuminate\Support\Collection;

/**
 * Resolves a Parthenon source_key (e.g. "EUNOMIA") to the full source envelope
 * payload consumed by Darkstar's FinnGen Plumber routes (spec §4.2.1).
 *
 * Read-role vs write-role is dispatched per endpoint type:
 *   - ROLE_RO: ROMOPAPI + HadesExtras sync reads
 *   - ROLE_RW: CO2 analyses + cohort generation (writes to *_results)
 */
class FinnGenSourceContextBuilder
{
    public const ROLE_RO = 'ro';

    public const ROLE_RW = 'rw';

    private const DEFAULT_VOCAB_SCHEMA = 'vocab';

    /**
     * @return array{
     *     source_key: string,
     *     label: string,
     *     dbms: string,
     *     connection: array{server: string, port: int, user: string, password: string},
     *     schemas: array{cdm: string, vocab: string, results: string, cohort: string}
     * }
     *
     * @throws FinnGenSourceNotFoundException
     * @throws FinnGenSourceDisabledException
     */
    public function build(string $sourceKey, string $role): array
    {
        // Source model default-scopes soft-deleted records out. withTrashed()
        // lets us distinguish "missing" from "disabled" with a clearer error.
        /** @var Source|null $source */
        $source = Source::withTrashed()->where('source_key', $sourceKey)->first();
        if ($source === null) {
            throw new FinnGenSourceNotFoundException("Source '{$sourceKey}' not found");
        }
        if ($source->trashed()) {
            throw new FinnGenSourceDisabledException("Source '{$sourceKey}' is disabled (soft-deleted)");
        }

        /** @var Collection<int, SourceDaimon> $daimonsRaw */
        $daimonsRaw = SourceDaimon::where('source_id', $source->id)->get();
        /** @var Collection<string, SourceDaimon> $daimons */
        $daimons = $daimonsRaw->keyBy(fn (SourceDaimon $d): string => $this->daimonTypeValue($d));

        $keyLower = strtolower($sourceKey);
        $cdmSchema = $this->daimonSchema($daimons, DaimonType::CDM, $keyLower);
        $vocabSchema = $this->daimonSchema($daimons, DaimonType::Vocabulary, self::DEFAULT_VOCAB_SCHEMA);
        $resultsSchema = $this->daimonSchema($daimons, DaimonType::Results, $keyLower.'_results');
        $cohortSchema = $resultsSchema;  // Convention: cohort table lives under results schema

        [$user, $password] = $this->credentialsFor($role);

        $host = (string) config('database.connections.pgsql.host');
        $database = (string) config('database.connections.pgsql.database');
        $server = $host.'/'.$database;

        return [
            'source_key' => (string) $source->source_key,
            'label' => (string) $source->source_name,
            'dbms' => (string) ($source->source_dialect ?? 'postgresql'),
            'connection' => [
                'server' => $server,
                'port' => (int) config('database.connections.pgsql.port'),
                'user' => $user,
                'password' => $password,
            ],
            'schemas' => [
                'cdm' => $cdmSchema,
                'vocab' => $vocabSchema,
                'results' => $resultsSchema,
                'cohort' => $cohortSchema,
            ],
        ];
    }

    /**
     * @param  Collection<string, SourceDaimon>  $daimons
     */
    private function daimonSchema(Collection $daimons, DaimonType $type, string $default): string
    {
        $daimon = $daimons->get($type->value);
        $qualifier = $daimon?->table_qualifier;

        return is_string($qualifier) && $qualifier !== '' ? $qualifier : $default;
    }

    /**
     * SourceDaimon casts daimon_type to a DaimonType enum, so extract the
     * string value for keying. Falls back to raw attribute for safety.
     */
    private function daimonTypeValue(SourceDaimon $daimon): string
    {
        $type = $daimon->daimon_type;
        if ($type instanceof DaimonType) {
            return $type->value;
        }

        return (string) $type;
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function credentialsFor(string $role): array
    {
        return match ($role) {
            self::ROLE_RW => ['parthenon_finngen_rw', (string) config('finngen.pg_rw_password')],
            default => ['parthenon_finngen_ro', (string) config('finngen.pg_ro_password')],
        };
    }
}
