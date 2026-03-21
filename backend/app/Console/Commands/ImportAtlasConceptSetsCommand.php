<?php

namespace App\Console\Commands;

use App\Models\App\ConceptSet;
use App\Models\User;
use Illuminate\Console\Command;

class ImportAtlasConceptSetsCommand extends Command
{
    protected $signature = 'parthenon:import-atlas-concept-sets
        {path : Directory of Atlas JSON files or path to a single JSON file}
        {--user-id= : Author user ID (defaults to first super-admin)}';

    protected $description = 'Import Atlas-format concept set JSON files into Parthenon';

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
            $superAdmin = User::role('super-admin')->first()
                ?? User::first();

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
                $this->line('  <fg=red>✗ Failed</> '.basename($file).': Invalid JSON');
                $failed++;

                continue;
            }

            // Support both a single concept set object and an array of concept sets
            $items = isset($data['name']) ? [$data] : array_values($data);

            foreach ($items as $item) {
                $name = trim($item['name'] ?? '');
                $expression = $item['expression'] ?? null;
                $atlasItems = $expression['items'] ?? [];

                if (! $name) {
                    $this->line('  <fg=red>✗ Failed</>: Missing name in '.basename($file));
                    $failed++;

                    continue;
                }

                if (ConceptSet::whereRaw('lower(name) = ?', [strtolower($name)])->exists()) {
                    $this->line("  <fg=yellow>↷ Skipped</> {$name} (duplicate)");
                    $skipped++;

                    continue;
                }

                try {
                    $conceptSet = ConceptSet::create([
                        'name' => $name,
                        'description' => $item['description'] ?? null,
                        'author_id' => $userId,
                        'expression_json' => $expression,
                    ]);

                    $itemCount = 0;
                    foreach ($atlasItems as $atlasItem) {
                        $conceptId = $atlasItem['concept']['CONCEPT_ID'] ?? null;
                        if (! $conceptId) {
                            continue;
                        }

                        $conceptSet->items()->create([
                            'concept_id' => (int) $conceptId,
                            'is_excluded' => (bool) ($atlasItem['isExcluded'] ?? false),
                            'include_descendants' => (bool) ($atlasItem['includeDescendants'] ?? false),
                            'include_mapped' => (bool) ($atlasItem['includeMapped'] ?? false),
                        ]);
                        $itemCount++;
                    }

                    $this->line("  <fg=green>✓ Imported</> {$name} ({$itemCount} concepts)");
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
