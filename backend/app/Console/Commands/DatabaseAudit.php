<?php

namespace App\Console\Commands;

use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DatabaseAudit extends Command
{
    protected $signature = 'db:audit
        {--json : Output as JSON for CI/scripting}
        {--connection= : Audit a single connection only}';

    protected $description = 'Audit all database connections and Solr cores — shows schemas, table counts, row counts, and discrepancies';

    /** Connections to audit and the schemas we expect to find data in. */
    private const PG_CONNECTIONS = [
        'pgsql' => ['label' => 'App (pgsql)',     'expect_data' => true],
        'cdm' => ['label' => 'CDM',             'expect_data' => true],
        'vocab' => ['label' => 'Vocabulary',       'expect_data' => true],
        'results' => ['label' => 'Results',          'expect_data' => true],
        'gis' => ['label' => 'GIS',              'expect_data' => false],
        'eunomia' => ['label' => 'Eunomia',          'expect_data' => false],
        'docker_pg' => ['label' => 'Docker PG',        'expect_data' => true],
    ];

    public function handle(): int
    {
        $filter = $this->option('connection');
        $asJson = $this->option('json');

        $report = [];

        // --- PostgreSQL connections ---
        foreach (self::PG_CONNECTIONS as $name => $meta) {
            if ($filter && $filter !== $name) {
                continue;
            }

            $report[] = $this->auditPgConnection($name, $meta);
        }

        // --- Solr cores ---
        if (! $filter || $filter === 'solr') {
            $solrRows = $this->auditSolr();
            $report = array_merge($report, $solrRows);
        }

        if ($asJson) {
            $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            return self::SUCCESS;
        }

        $this->renderTable($report);

        return self::SUCCESS;
    }

    /**
     * @param  array{label: string, expect_data: bool}  $meta
     * @return array{connection: string, schema: string, tables: int|string, rows: int|string, status: string}
     */
    private function auditPgConnection(string $name, array $meta): array
    {
        try {
            DB::connection($name)->getPdo();
        } catch (\Throwable $e) {
            return [
                'connection' => $name,
                'schema' => '—',
                'tables' => '—',
                'rows' => '—',
                'status' => 'FAIL: '.$this->truncate($e->getMessage(), 60),
            ];
        }

        // Get the first schema from search_path for display
        $searchPath = config("database.connections.{$name}.search_path", 'public');
        $schema = explode(',', $searchPath)[0];

        // Count tables in that schema
        $tables = DB::connection($name)
            ->table('pg_tables')
            ->where('schemaname', $schema)
            ->count();

        // Approximate row count via pg_stat_user_tables
        $rowCount = DB::connection($name)
            ->table('pg_stat_user_tables')
            ->where('schemaname', $schema)
            ->sum('n_live_tup');

        $status = 'OK';
        if ($tables === 0 && $meta['expect_data']) {
            $status = 'WARN: empty schema';
        }

        return [
            'connection' => $name,
            'schema' => $schema,
            'tables' => $tables,
            'rows' => $rowCount,
            'status' => $status,
        ];
    }

    /**
     * @return list<array{connection: string, schema: string, tables: int|string, rows: int|string, status: string}>
     */
    private function auditSolr(): array
    {
        $rows = [];

        if (! config('solr.enabled', false)) {
            $rows[] = [
                'connection' => 'Solr',
                'schema' => '—',
                'tables' => '—',
                'rows' => '—',
                'status' => 'DISABLED (SOLR_ENABLED=false)',
            ];

            return $rows;
        }

        /** @var SolrClientWrapper $solr */
        $solr = app(SolrClientWrapper::class);
        $cores = config('solr.cores', []);

        foreach ($cores as $key => $coreName) {
            $ping = $solr->ping($coreName);

            if (! $ping) {
                $rows[] = [
                    'connection' => 'Solr',
                    'schema' => $coreName,
                    'tables' => '1 core',
                    'rows' => '—',
                    'status' => 'FAIL: unreachable',
                ];

                continue;
            }

            $count = $solr->documentCount($coreName);
            $status = 'OK';
            if ($count === 0 || $count === null) {
                $status = 'WARN: 0 documents';
            }

            $rows[] = [
                'connection' => 'Solr',
                'schema' => $coreName,
                'tables' => '1 core',
                'rows' => $count ?? 0,
                'status' => $status,
            ];
        }

        return $rows;
    }

    /**
     * @param  list<array{connection: string, schema: string, tables: int|string, rows: int|string, status: string}>  $report
     */
    private function renderTable(array $report): void
    {
        $this->newLine();
        $this->info('Parthenon Database Audit');
        $this->info(str_repeat('─', 40));
        $this->newLine();

        $headers = ['Connection', 'Schema', 'Tables', 'Total Rows', 'Status'];
        $tableRows = [];

        foreach ($report as $row) {
            $rows = is_numeric($row['rows']) ? number_format((int) $row['rows']) : $row['rows'];
            $status = $row['status'];

            // Colorize status
            if (str_starts_with($status, 'FAIL')) {
                $status = "<fg=red>{$status}</>";
            } elseif (str_starts_with($status, 'WARN')) {
                $status = "<fg=yellow>{$status}</>";
            } elseif (str_starts_with($status, 'DISABLED')) {
                $status = "<fg=gray>{$status}</>";
            } else {
                $status = "<fg=green>{$status}</>";
            }

            $tableRows[] = [$row['connection'], $row['schema'], $row['tables'], $rows, $status];
        }

        $this->table($headers, $tableRows);
    }

    private function truncate(string $text, int $length): string
    {
        return strlen($text) > $length ? substr($text, 0, $length).'…' : $text;
    }
}
