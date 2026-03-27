<?php

namespace App\Context;

use App\Enums\DaimonType;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SourceContext
{
    public function __construct(
        public readonly ?Source $source = null,
        public readonly ?string $cdmSchema = null,
        public readonly ?string $resultsSchema = null,
        public readonly ?string $vocabSchema = null,
    ) {}

    public function requireSource(): Source
    {
        if ($this->source === null) {
            throw new NoSourceContextException;
        }

        return $this->source;
    }

    public function cdmConnection(): string
    {
        $this->requireSource();

        return 'ctx_cdm';
    }

    public function resultsConnection(): string
    {
        $this->requireSource();

        return 'ctx_results';
    }

    public function vocabConnection(): string
    {
        $this->requireSource();

        return 'ctx_vocab';
    }

    /**
     * Build a SourceContext for a given source and register isolated connections.
     * Used by middleware (HTTP requests) and jobs/commands (non-HTTP).
     */
    public static function forSource(Source $source): self
    {
        $source->loadMissing('daimons');

        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary);

        $ctx = new self(
            source: $source,
            cdmSchema: $cdmSchema,
            resultsSchema: $resultsSchema,
            vocabSchema: $vocabSchema,
        );

        $ctx->registerConnections($source);

        app()->instance(self::class, $ctx);

        Log::withContext([
            'source_id' => $source->id,
            'source_name' => $source->source_name,
        ]);

        return $ctx;
    }

    /**
     * Register isolated database connections for this source's daimons.
     * Instead of SET search_path on shared connections (which leaks in connection pools),
     * we register fresh named connections with the schema baked into config.
     */
    private function registerConnections(Source $source): void
    {
        if (! empty($source->db_host)) {
            $this->registerDynamicConnections($source);
        } else {
            $this->registerLocalConnections($source);
        }
    }

    private function registerDynamicConnections(Source $source): void
    {
        $baseConfig = $this->buildDynamicConfig($source);

        $this->registerConnection('ctx_cdm', $baseConfig, $this->cdmSchema);
        $this->registerConnection('ctx_results', $baseConfig, $this->resultsSchema);
        $this->registerConnection('ctx_vocab', $baseConfig, $this->vocabSchema);
    }

    private function registerLocalConnections(Source $source): void
    {
        $connName = $source->source_connection ?? 'omop';
        $baseConfig = config("database.connections.{$connName}", []);

        $this->registerConnection('ctx_cdm', $baseConfig, $this->cdmSchema);
        $this->registerConnection('ctx_results', $baseConfig, $this->resultsSchema);
        $this->registerConnection('ctx_vocab', $baseConfig, $this->vocabSchema);
    }

    /**
     * @param  array<string, mixed>  $baseConfig
     */
    private function registerConnection(string $name, array $baseConfig, ?string $schema): void
    {
        if ($schema === null) {
            return;
        }

        $config = array_merge($baseConfig, [
            'search_path' => "\"{$schema}\",public",
        ]);

        config(["database.connections.{$name}" => $config]);
        DB::purge($name);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildDynamicConfig(Source $source): array
    {
        /** @var array<string, mixed> $opts */
        $opts = $source->db_options ?? [];

        return match ($source->source_dialect) {
            'postgresql', 'redshift' => [
                'driver' => 'pgsql',
                'host' => $source->db_host,
                'port' => $source->db_port ?? ($source->source_dialect === 'redshift' ? 5439 : 5432),
                'database' => $source->db_database,
                'username' => $source->username,
                'password' => $source->password,
                'charset' => 'utf8',
                'prefix' => '',
                'schema' => 'public',
                'sslmode' => $opts['sslmode'] ?? 'prefer',
            ],
            default => [
                'driver' => 'pgsql',
                'host' => $source->db_host,
                'port' => $source->db_port ?? 5432,
                'database' => $source->db_database,
                'username' => $source->username,
                'password' => $source->password,
                'charset' => 'utf8',
                'prefix' => '',
                'schema' => 'public',
            ],
        };
    }
}
