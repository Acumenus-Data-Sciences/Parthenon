<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * @deprecated This command relied on the 'docker_pg' connection which has been removed
 *             as part of the single-DB architecture migration. Needs rework to use the
 *             new 'omop' connection or be removed entirely.
 *
 * Sync app tables between local PostgreSQL and Docker PostgreSQL.
 *
 * Default: Local PG (ohdsi/app) → Docker PG (parthenon/app)
 * Reverse: Docker PG → Local PG
 *
 * Uses pure PHP/PDO — no external pg_dump required.
 * Target schema is bootstrapped via Laravel migrations if needed.
 */
class SyncDatabaseCommand extends Command
{
    protected $signature = 'db:sync
        {--reverse : Sync from Docker PG → Local PG (default: Local → Docker)}
        {--tables= : Comma-separated list of specific tables to sync}
        {--dry-run : Show what would be synced without making changes}
        {--force : Skip confirmation prompt}';

    protected $description = 'Sync app tables between local PG and Docker PG';

    /** Tables to skip (transient infrastructure). */
    private const SKIP_TABLES = [
        'migrations',
        'cache',
        'cache_locks',
        'sessions',
        'jobs',
        'job_batches',
        'failed_jobs',
        'personal_access_tokens',
        'password_reset_tokens',
    ];

    public function handle(): int
    {
        $this->error('This command is deprecated. The docker_pg connection has been removed (single-DB architecture).');

        return self::FAILURE;

        // @deprecated — docker_pg connection no longer exists
        $reverse = $this->option('reverse');
        $fromConn = $reverse ? 'docker_pg' : 'pgsql';  // @deprecated docker_pg removed
        $toConn = $reverse ? 'pgsql' : 'docker_pg';    // @deprecated docker_pg removed
        $fromLabel = $reverse ? 'Docker PG' : 'Local PG';
        $toLabel = $reverse ? 'Local PG' : 'Docker PG';
        $dryRun = $this->option('dry-run');

        $this->info("db:sync — {$fromLabel} → {$toLabel}".($dryRun ? ' [DRY RUN]' : ''));
        $this->newLine();

        // Test connections
        foreach ([[$fromConn, $fromLabel], [$toConn, $toLabel]] as [$conn, $label]) {
            try {
                DB::connection($conn)->getPdo();
                $this->info("  {$label}: connected");
            } catch (\Throwable $e) {
                $this->error("  {$label}: FAILED — {$e->getMessage()}");

                return 1;
            }
        }
        $this->newLine();

        // Ensure target has the app schema and tables
        $this->ensureTargetSchema($toConn);

        // Resolve tables
        $tables = $this->resolveTables($fromConn);
        if (empty($tables)) {
            $this->warn('No tables to sync.');

            return 0;
        }

        $this->info('Tables: '.count($tables));

        if ($dryRun) {
            foreach ($tables as $t) {
                $count = DB::connection($fromConn)->table($t)->count();
                $this->line("  {$t}: {$count} rows");
            }

            return 0;
        }

        if (! $this->option('force') && ! $this->confirm("REPLACE all data in {$toLabel}?")) {
            return 0;
        }

        // Disable FK checks on target
        DB::connection($toConn)->statement('SET session_replication_role = replica');

        // Filter to tables that exist on target
        $syncable = array_filter($tables, fn ($t) => $this->targetHasTable($t, $toConn));
        $skipped = count($tables) - count($syncable);

        // Phase 1: Truncate ALL target tables first (prevents CASCADE wiping inserted data)
        $this->info('Truncating target tables...');
        foreach ($syncable as $table) {
            DB::connection($toConn)->statement("TRUNCATE TABLE app.\"{$table}\" CASCADE");
        }

        // Phase 2: Copy data
        $totalRows = 0;
        $synced = 0;
        $errors = [];

        $bar = $this->output->createProgressBar(count($syncable));
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%% %message%');
        $bar->setMessage('');
        $bar->start();

        foreach ($syncable as $table) {
            $bar->setMessage($table);
            try {
                $count = $this->copyData($table, $fromConn, $toConn);
                $totalRows += $count;
                $synced++;
            } catch (\Throwable $e) {
                $errors[$table] = $e->getMessage();
            }
            $bar->advance();
        }

        $bar->setMessage('done');
        $bar->finish();
        $this->newLine(2);

        // Phase 3: Reset sequences
        foreach ($syncable as $table) {
            $this->resetSequence($table, $toConn);
        }

        // Re-enable FK checks
        DB::connection($toConn)->statement('SET session_replication_role = DEFAULT');

        $this->info("Synced: {$synced} tables, {$totalRows} rows".($skipped ? " ({$skipped} skipped — missing on target)" : ''));

        if (! empty($errors)) {
            $this->newLine();
            $this->warn('Errors ('.count($errors).'):');
            foreach ($errors as $table => $msg) {
                $shortMsg = mb_substr($msg, 0, 120);
                $this->error("  {$table}: {$shortMsg}");
            }

            return 1;
        }

        $this->info('Sync complete.');

        return 0;
    }

    /**
     * Create the `app` schema and run migrations on target if needed.
     */
    private function ensureTargetSchema(string $toConn): void
    {
        $target = DB::connection($toConn);

        // Create app schema if it doesn't exist
        $target->statement('CREATE SCHEMA IF NOT EXISTS app');

        // Check if tables exist
        $count = $target->selectOne("
            SELECT COUNT(*) AS c FROM pg_tables WHERE schemaname = 'app'
        ");

        if (($count->c ?? 0) < 5) {
            $this->info('Target needs migrations...');
            // Run migrations with the docker_pg connection
            $this->call('migrate', [
                '--database' => $toConn,
                '--force' => true,
                '--no-interaction' => true,
            ]);
            $this->newLine();
        }
    }

    /**
     * @return list<string>
     */
    private function resolveTables(string $fromConn): array
    {
        if ($specific = $this->option('tables')) {
            return array_map('trim', explode(',', $specific));
        }

        // Discover tables from source's app schema
        $rows = DB::connection($fromConn)->select("
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'app'
            ORDER BY tablename
        ");

        $all = array_map(fn ($r) => $r->tablename, $rows);

        return array_values(array_filter(
            $all,
            fn (string $t) => ! in_array($t, self::SKIP_TABLES, true),
        ));
    }

    private function targetHasTable(string $table, string $toConn): bool
    {
        $result = DB::connection($toConn)->select("
            SELECT 1 FROM pg_tables WHERE schemaname = 'app' AND tablename = ?
        ", [$table]);

        return ! empty($result);
    }

    /**
     * Copy all rows from source table to (already truncated) target table.
     */
    private function copyData(string $table, string $fromConn, string $toConn): int
    {
        $target = DB::connection($toConn);

        // Source row count — skip empty tables early
        $srcCount = DB::connection($fromConn)->table($table)->count();
        if ($srcCount === 0) {
            return 0;
        }

        // Get source columns and intersect with target columns
        $srcCols = $this->getColumns($table, $fromConn);
        $tgtCols = $this->getColumns($table, $toConn);
        $commonCols = array_values(array_intersect($srcCols, $tgtCols));

        if (empty($commonCols)) {
            return 0;
        }

        // Build select with only common columns
        $selectList = implode(', ', array_map(fn ($c) => "\"{$c}\"", $commonCols));

        // Batch copy
        $count = 0;
        $batchSize = 500;
        $pk = $this->getPrimaryKey($table, $fromConn);
        $orderBy = $pk ? "ORDER BY \"{$pk}\"" : '';

        $offset = 0;
        while (true) {
            $rows = DB::connection($fromConn)->select(
                "SELECT {$selectList} FROM app.\"{$table}\" {$orderBy} LIMIT {$batchSize} OFFSET {$offset}"
            );

            if (empty($rows)) {
                break;
            }

            $data = array_map(fn ($row) => (array) $row, $rows);
            $target->table($table)->insert($data);
            $count += count($data);
            $offset += $batchSize;
        }

        return $count;
    }

    /**
     * @return list<string>
     */
    private function getColumns(string $table, string $conn): array
    {
        $rows = DB::connection($conn)->select("
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'app' AND table_name = ?
            ORDER BY ordinal_position
        ", [$table]);

        return array_map(fn ($r) => $r->column_name, $rows);
    }

    private function getPrimaryKey(string $table, string $conn): ?string
    {
        $result = DB::connection($conn)->select("
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            JOIN pg_class c ON c.oid = i.indrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE i.indisprimary AND c.relname = ? AND n.nspname = 'app'
        ", [$table]);

        return ! empty($result) ? $result[0]->attname : null;
    }

    private function resetSequence(string $table, string $conn): void
    {
        $pk = $this->getPrimaryKey($table, $conn);
        if (! $pk) {
            return;
        }

        try {
            $seq = DB::connection($conn)->selectOne(
                "SELECT pg_get_serial_sequence('app.{$table}', ?) AS seq",
                [$pk],
            );

            if ($seq?->seq) {
                $max = DB::connection($conn)->selectOne(
                    "SELECT COALESCE(MAX(\"{$pk}\"), 0) AS v FROM app.\"{$table}\""
                );
                DB::connection($conn)->statement(
                    "SELECT setval('{$seq->seq}', ".(($max->v ?? 0) + 1).', false)'
                );
            }
        } catch (\Throwable) {
            // No sequence — UUID PK or composite key
        }
    }
}
