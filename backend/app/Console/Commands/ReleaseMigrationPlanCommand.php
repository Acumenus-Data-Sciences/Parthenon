<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Migrations\Migrator;
use Illuminate\Support\Facades\Artisan;

class ReleaseMigrationPlanCommand extends Command
{
    protected $signature = 'parthenon:migrations:release
        {--path=* : Approved migration path relative to the backend base path}
        {--run : Execute approved pending migration paths after planning}
        {--pretend : Show SQL for approved pending migration paths}
        {--force : Required with --run outside local/testing}
        {--allow-ignored-pending : Permit configured historical pending migrations}
        {--json : Output the migration plan as JSON}';

    protected $description = 'Plan and optionally run explicit release-approved migrations.';

    public function handle(): int
    {
        /** @var Migrator $migrator */
        $migrator = app('migrator');

        $allFiles = $migrator->getMigrationFiles([database_path('migrations')]);
        $ran = array_flip($migrator->getRepository()->getRan());
        $pending = array_diff_key($allFiles, $ran);

        try {
            $approved = $this->approvedMigrations($allFiles);
        } catch (\InvalidArgumentException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $ignored = $this->ignoredPendingMigrations($pending);
        $approvedPending = array_intersect_key($pending, $approved);
        $unexpected = array_diff_key($pending, $approved, $ignored);

        $plan = [
            'pending_count' => count($pending),
            'approved_pending' => $this->describeMigrations($approvedPending, $approved),
            'ignored_pending' => $this->describeIgnored($ignored),
            'unexpected_pending' => $this->describeMigrations($unexpected),
            'approved_already_ran' => $this->describeAlreadyRan($approved, $ran),
        ];

        $this->renderPlan($plan);

        if ($unexpected !== []) {
            $this->error('Unexpected pending migrations found. Add an approved --path or repair the release manifest.');

            return self::FAILURE;
        }

        if ($ignored !== [] && ! $this->option('allow-ignored-pending')) {
            $this->error('Historical pending migrations remain. Run the repair migration or pass --allow-ignored-pending for read-only classification.');

            return self::FAILURE;
        }

        if (! $this->option('run')) {
            return self::SUCCESS;
        }

        if ($approvedPending === []) {
            $this->info('No approved pending migrations to run.');

            return self::SUCCESS;
        }

        if (! $this->option('force') && ! $this->laravel->environment(['local', 'testing'])) {
            $this->error('Refusing to run migrations outside local/testing without --force.');

            return self::FAILURE;
        }

        foreach ($approvedPending as $name => $_path) {
            $relativePath = $approved[$name]['relative_path'];
            $this->line(sprintf('Running approved migration path: %s', $relativePath));

            $exitCode = Artisan::call('migrate', [
                '--path' => $relativePath,
                '--force' => (bool) $this->option('force'),
                '--pretend' => (bool) $this->option('pretend'),
            ], $this->output);

            if ($exitCode !== self::SUCCESS) {
                return $exitCode;
            }
        }

        return self::SUCCESS;
    }

    /**
     * @param  array<string, string>  $allFiles
     * @return array<string, array{relative_path: string, absolute_path: string}>
     */
    private function approvedMigrations(array $allFiles): array
    {
        $paths = array_merge(
            (array) config('release_migrations.approved_paths', []),
            (array) $this->option('path'),
        );

        $approved = [];
        foreach ($paths as $path) {
            if (! is_string($path) || trim($path) === '') {
                continue;
            }

            [$relativePath, $absolutePath] = $this->normaliseMigrationPath($path);
            $name = $this->migrationName($absolutePath);

            if (! array_key_exists($name, $allFiles)) {
                throw new \InvalidArgumentException("Approved migration path is not in database/migrations: {$relativePath}");
            }

            $approved[$name] = [
                'relative_path' => $relativePath,
                'absolute_path' => $absolutePath,
            ];
        }

        return $approved;
    }

    /**
     * @return array{string, string}
     */
    private function normaliseMigrationPath(string $path): array
    {
        $path = str_replace('\\', '/', trim($path));
        $basePath = str_replace('\\', '/', base_path());

        if (str_starts_with($path, $basePath.'/')) {
            $relativePath = substr($path, strlen($basePath) + 1);
        } else {
            $relativePath = ltrim($path, '/');
        }

        if (! str_starts_with($relativePath, 'database/migrations/')) {
            throw new \InvalidArgumentException("Migration path must be under database/migrations: {$path}");
        }

        $absolutePath = base_path($relativePath);
        if (! is_file($absolutePath)) {
            throw new \InvalidArgumentException("Migration path does not exist: {$relativePath}");
        }

        return [$relativePath, $absolutePath];
    }

    private function migrationName(string $path): string
    {
        return basename($path, '.php');
    }

    /**
     * @param  array<string, string>  $pending
     * @return array<string, string>
     */
    private function ignoredPendingMigrations(array $pending): array
    {
        $ignoredConfig = (array) config('release_migrations.ignored_pending', []);

        return array_intersect_key($ignoredConfig, $pending);
    }

    /**
     * @param  array<string, string>  $migrations
     * @param  array<string, array{relative_path: string, absolute_path: string}>  $approved
     * @return list<array{name: string, path: string|null}>
     */
    private function describeMigrations(array $migrations, array $approved = []): array
    {
        return array_values(array_map(
            fn (string $name, string $path): array => [
                'name' => $name,
                'path' => $approved[$name]['relative_path'] ?? $this->relativePath($path),
            ],
            array_keys($migrations),
            array_values($migrations),
        ));
    }

    /**
     * @param  array<string, string>  $ignored
     * @return list<array{name: string, reason: string}>
     */
    private function describeIgnored(array $ignored): array
    {
        return array_values(array_map(
            fn (string $name, string $reason): array => [
                'name' => $name,
                'reason' => $reason,
            ],
            array_keys($ignored),
            array_values($ignored),
        ));
    }

    /**
     * @param  array<string, array{relative_path: string, absolute_path: string}>  $approved
     * @param  array<string, int>  $ran
     * @return list<array{name: string, path: string}>
     */
    private function describeAlreadyRan(array $approved, array $ran): array
    {
        $alreadyRan = array_intersect_key($approved, $ran);

        return array_values(array_map(
            fn (string $name, array $data): array => [
                'name' => $name,
                'path' => $data['relative_path'],
            ],
            array_keys($alreadyRan),
            array_values($alreadyRan),
        ));
    }

    private function relativePath(string $path): string
    {
        $basePath = str_replace('\\', '/', base_path()).'/';
        $path = str_replace('\\', '/', $path);

        if (str_starts_with($path, $basePath)) {
            return substr($path, strlen($basePath));
        }

        return $path;
    }

    /**
     * @param  array{
     *   pending_count: int,
     *   approved_pending: list<array{name: string, path: string|null}>,
     *   ignored_pending: list<array{name: string, reason: string}>,
     *   unexpected_pending: list<array{name: string, path: string|null}>,
     *   approved_already_ran: list<array{name: string, path: string}>
     * }  $plan
     */
    private function renderPlan(array $plan): void
    {
        if ($this->option('json')) {
            $this->line(json_encode($plan, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            return;
        }

        $this->info(sprintf('Pending migrations: %d', $plan['pending_count']));

        $this->renderTableSection('Approved pending', $plan['approved_pending'], ['name', 'path']);
        $this->renderTableSection('Ignored historical pending', $plan['ignored_pending'], ['name', 'reason']);
        $this->renderTableSection('Unexpected pending', $plan['unexpected_pending'], ['name', 'path']);
        $this->renderTableSection('Approved already ran', $plan['approved_already_ran'], ['name', 'path']);
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @param  list<string>  $columns
     */
    private function renderTableSection(string $title, array $rows, array $columns): void
    {
        $this->line('');
        $this->line($title);

        if ($rows === []) {
            $this->line('  none');

            return;
        }

        $this->table($columns, array_map(
            fn (array $row): array => array_map(
                fn (string $column): mixed => $row[$column] ?? null,
                $columns,
            ),
            $rows,
        ));
    }
}
