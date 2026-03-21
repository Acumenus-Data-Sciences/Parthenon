<?php

namespace App\Console\Commands;

use App\Models\App\CohortDefinition;
use App\Models\App\Source;
use App\Models\User;
use App\Services\Cohort\CohortGenerationService;
use App\Services\Cohort\Schema\CohortExpressionSchema;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class ValidateAtlasParityCommand extends Command
{
    protected $signature = 'parthenon:validate-atlas-parity
        {--atlas-url= : Base URL of the Atlas WebAPI instance (e.g. https://atlas.example.com/WebAPI)}
        {--atlas-token= : Bearer token for Atlas WebAPI authentication}
        {--source-key= : Parthenon source key to generate cohorts against}
        {--compare-n=10 : Number of random cohorts to compare (0 = all)}
        {--tolerance=0.02 : Acceptable count difference as a fraction (0.02 = 2%)}
        {--no-generate : Skip Parthenon generation; only compare already-generated cohorts}';

    protected $description = 'Validate parity of cohort counts between Atlas WebAPI and Parthenon';

    public function __construct(
        private readonly CohortExpressionSchema $schema,
        private readonly CohortGenerationService $generationService,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $atlasUrl = rtrim($this->option('atlas-url') ?? '', '/');
        $atlasToken = $this->option('atlas-token');
        $sourceKey = $this->option('source-key');
        $compareN = (int) $this->option('compare-n');
        $tolerance = (float) $this->option('tolerance');
        $noGenerate = $this->option('no-generate');

        if (! $atlasUrl) {
            $this->error('--atlas-url is required.');

            return self::FAILURE;
        }

        // Resolve Parthenon source
        $source = null;
        if (! $noGenerate) {
            if (! $sourceKey) {
                $source = Source::first();
                if (! $source) {
                    $this->error('No data sources found in Parthenon. Pass --source-key=<key>.');

                    return self::FAILURE;
                }
                $this->warn("No --source-key provided; using first source: {$source->source_key}");
            } else {
                $source = Source::where('source_key', $sourceKey)->first();
                if (! $source) {
                    $this->error("Source not found: {$sourceKey}");

                    return self::FAILURE;
                }
            }
        }

        $this->info("Atlas URL: {$atlasUrl}");
        if ($source) {
            $this->info("Parthenon source: {$source->source_key}");
        }
        $this->info('Tolerance: '.($tolerance * 100).'%');
        $this->newLine();

        // ── Fetch Atlas cohort definitions ────────────────────────────────────
        $this->line('Fetching cohort definitions from Atlas...');

        $headers = ['Accept' => 'application/json'];
        if ($atlasToken) {
            $headers['Authorization'] = "Bearer {$atlasToken}";
        }

        try {
            $response = Http::withHeaders($headers)
                ->timeout(30)
                ->get("{$atlasUrl}/cohortdefinition/");

            if (! $response->successful()) {
                $this->error("Atlas API returned HTTP {$response->status()}: {$response->body()}");

                return self::FAILURE;
            }

            $atlasCohorts = $response->json();
        } catch (\Throwable $e) {
            $this->error("Failed to connect to Atlas: {$e->getMessage()}");

            return self::FAILURE;
        }

        if (empty($atlasCohorts)) {
            $this->warn('No cohort definitions found in Atlas.');

            return self::SUCCESS;
        }

        $this->info('Found '.count($atlasCohorts).' cohort definitions in Atlas.');

        // ── Select random subset ──────────────────────────────────────────────
        if ($compareN > 0 && $compareN < count($atlasCohorts)) {
            $keys = array_rand($atlasCohorts, $compareN);
            $selected = is_array($keys)
                ? array_map(fn ($k) => $atlasCohorts[$k], $keys)
                : [$atlasCohorts[$keys]];
        } else {
            $selected = $atlasCohorts;
        }

        $this->info('Comparing '.count($selected).' cohorts...');
        $this->newLine();

        // ── Compare each cohort ───────────────────────────────────────────────
        $rows = [];
        $failures = 0;

        foreach ($selected as $atlasCohort) {
            $atlasId = $atlasCohort['id'] ?? null;
            $name = $atlasCohort['name'] ?? "(id:{$atlasId})";

            if (! $atlasId) {
                $rows[] = [$name, 'N/A', 'N/A', '—', '<fg=yellow>SKIP</>'];

                continue;
            }

            // ── Get full Atlas cohort expression ──────────────────────────────
            try {
                $defResponse = Http::withHeaders($headers)
                    ->timeout(30)
                    ->get("{$atlasUrl}/cohortdefinition/{$atlasId}");

                if (! $defResponse->successful()) {
                    $rows[] = [$name, 'ERR', 'N/A', '—', '<fg=red>FAIL</>'];
                    $failures++;

                    continue;
                }

                $atlasDef = $defResponse->json();
                $expression = $atlasDef['expression'] ?? null;

                if (! $expression) {
                    $rows[] = [$name, 'No expr', 'N/A', '—', '<fg=yellow>SKIP</>'];

                    continue;
                }
            } catch (\Throwable $e) {
                $rows[] = [$name, 'HTTP ERR', 'N/A', '—', '<fg=red>FAIL</>'];
                $failures++;

                continue;
            }

            // ── Get Atlas generation count ────────────────────────────────────
            $atlasCount = null;
            try {
                $infoResponse = Http::withHeaders($headers)
                    ->timeout(15)
                    ->get("{$atlasUrl}/cohortdefinition/{$atlasId}/info");

                if ($infoResponse->successful()) {
                    $infos = $infoResponse->json();
                    // Atlas /info returns array of generation records; take first COMPLETE one
                    foreach ((array) $infos as $info) {
                        if (($info['status'] ?? '') === 'COMPLETE') {
                            $atlasCount = $info['personCount'] ?? $info['person_count'] ?? null;
                            break;
                        }
                    }
                }
            } catch (\Throwable) {
                // Atlas count unavailable — we'll note it
            }

            // ── Import to Parthenon if not present ────────────────────────────
            $parthenon = CohortDefinition::whereRaw('lower(name) = ?', [strtolower($name)])->first();
            if (! $parthenon) {
                try {
                    $this->schema->validate($expression);
                    $userId = User::role('super-admin')->value('id')
                        ?? User::value('id');

                    $parthenon = CohortDefinition::create([
                        'name' => $name,
                        'description' => $atlasDef['description'] ?? null,
                        'expression_json' => $expression,
                        'author_id' => $userId,
                    ]);
                } catch (\Throwable $e) {
                    $rows[] = [$name, $atlasCount ?? 'N/A', 'Import ERR', '—', '<fg=red>FAIL</>'];
                    $failures++;

                    continue;
                }
            }

            // ── Generate in Parthenon ─────────────────────────────────────────
            $parthenonCount = null;
            if (! $noGenerate && $source) {
                try {
                    $generation = $this->generationService->generate($parthenon, $source);
                    $parthenonCount = $generation->person_count;
                } catch (\Throwable $e) {
                    $rows[] = [$name, $atlasCount ?? 'N/A', 'Gen ERR', '—', '<fg=red>FAIL</>'];
                    $failures++;

                    continue;
                }
            } else {
                // Use most-recent existing generation
                $existing = $parthenon->generations()
                    ->where('source_id', $source?->id)
                    ->orderByDesc('completed_at')
                    ->value('person_count');
                $parthenonCount = $existing;
            }

            // ── Compare counts ────────────────────────────────────────────────
            if ($atlasCount === null || $parthenonCount === null) {
                $diff = '—';
                $status = '<fg=yellow>N/A</>';
            } else {
                $max = max($atlasCount, $parthenonCount, 1);
                $diffFrac = abs($atlasCount - $parthenonCount) / $max;
                $diff = sprintf('%+d (%.1f%%)', $parthenonCount - $atlasCount, $diffFrac * 100);

                if ($diffFrac <= $tolerance) {
                    $status = '<fg=green>PASS</>';
                } elseif ($diffFrac <= $tolerance * 5) {
                    $status = '<fg=yellow>WARN</>';
                } else {
                    $status = '<fg=red>FAIL</>';
                    $failures++;
                }
            }

            $rows[] = [
                strlen($name) > 50 ? substr($name, 0, 47).'...' : $name,
                $atlasCount ?? 'N/A',
                $parthenonCount ?? 'N/A',
                $diff,
                $status,
            ];

            $this->line("  [{$status}] {$name}");
        }

        // ── Summary table ─────────────────────────────────────────────────────
        $this->newLine();
        $this->table(
            ['Cohort', 'Atlas Count', 'Parthenon Count', 'Difference', 'Result'],
            array_map(function (array $row): array {
                // Strip colour tags for table output
                $row[4] = strip_tags($row[4]);

                return $row;
            }, $rows),
        );

        $this->newLine();
        $pass = count(array_filter($rows, fn ($r) => str_contains($r[4], 'PASS')));
        $warn = count(array_filter($rows, fn ($r) => str_contains($r[4], 'WARN')));
        $skip = count(array_filter($rows, fn ($r) => str_contains($r[4], 'N/A') || str_contains($r[4], 'SKIP')));

        $this->info("Results: {$pass} PASS  |  {$warn} WARN  |  {$failures} FAIL  |  {$skip} N/A");

        if ($failures > 0) {
            $pct = $tolerance * 100;
            $this->error("{$failures} cohort(s) failed parity check (>{$pct}% count difference).");

            return self::FAILURE;
        }

        $this->info('All compared cohorts within tolerance.');

        return self::SUCCESS;
    }
}
