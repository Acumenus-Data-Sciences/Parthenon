<?php

namespace App\Console\Commands;

use App\Models\App\CohortDefinition;
use App\Services\Cohort\Schema\CohortExpressionSchema;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Auth;

class ImportAtlasCohortsCommand extends Command
{
    protected $signature = 'parthenon:import-atlas-cohorts
        {path : Directory of Atlas JSON files or path to a single JSON file}
        {--user-id= : Author user ID (defaults to first super-admin)}';

    protected $description = 'Import Atlas-format cohort definition JSON files into Parthenon';

    public function __construct(private readonly CohortExpressionSchema $schema)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $path = $this->argument('path');

        if (! file_exists($path)) {
            $this->error("Path not found: {$path}");

            return self::FAILURE;
        }

        // Resolve author ID
        $userId = $this->option('user-id');
        if (! $userId) {
            $superAdmin = \App\Models\User::role('super-admin')->first()
                ?? \App\Models\User::first();

            if (! $superAdmin) {
                $this->error('No users found. Pass --user-id=<id>.');

                return self::FAILURE;
            }
            $userId = $superAdmin->id;
        }

        // Collect JSON files
        $files = [];
        if (is_dir($path)) {
            $files = glob(rtrim($path, '/').'/*.json') ?: [];
        } else {
            $files = [$path];
        }

        if (empty($files)) {
            $this->warn('No JSON files found in: '.$path);

            return self::SUCCESS;
        }

        $imported = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($files as $file) {
            $raw = file_get_contents($file);
            $data = json_decode($raw, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->line("  <fg=red>✗ Failed</> {$file}: Invalid JSON");
                $failed++;
                continue;
            }

            // Support both single object and array
            $items = isset($data['name']) ? [$data] : array_values($data);

            foreach ($items as $item) {
                $name = trim($item['name'] ?? '');
                $expression = $item['expression'] ?? $item['expression_json'] ?? null;

                if (! $name || ! $expression) {
                    $this->line("  <fg=red>✗ Failed</>: Missing name or expression in ".basename($file));
                    $failed++;
                    continue;
                }

                if (CohortDefinition::whereRaw('lower(name) = ?', [strtolower($name)])->exists()) {
                    $this->line("  <fg=yellow>↷ Skipped</> {$name} (duplicate)");
                    $skipped++;
                    continue;
                }

                try {
                    $this->schema->validate($expression);

                    CohortDefinition::create([
                        'name' => $name,
                        'description' => $item['description'] ?? null,
                        'expression_json' => $expression,
                        'author_id' => $userId,
                    ]);

                    $this->line("  <fg=green>✓ Imported</> {$name}");
                    $imported++;
                } catch (\Throwable $e) {
                    $this->line("  <fg=red>✗ Failed</> {$name}: {$e->getMessage()}");
                    $failed++;
                }
            }
        }

        $this->newLine();
        $this->line("  <fg=green>✓ Imported {$imported}</>  <fg=yellow>↷ Skipped {$skipped} (duplicate)</>  <fg=red>✗ Failed {$failed}</>");

        return self::SUCCESS;
    }
}
