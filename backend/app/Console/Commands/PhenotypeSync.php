<?php

namespace App\Console\Commands;

use App\Models\App\PhenotypeLibraryEntry;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PhenotypeSync extends Command
{
    protected $signature = 'phenotype:sync {--fresh : Delete existing entries before syncing} {--metadata-only : Skip downloading cohort JSON definitions}';

    protected $description = 'Sync OHDSI PhenotypeLibrary definitions from GitHub';

    private const REPO_ZIP_URL = 'https://github.com/OHDSI/PhenotypeLibrary/archive/refs/heads/main.zip';

    private const METADATA_CSV_URL = 'https://raw.githubusercontent.com/OHDSI/PhenotypeLibrary/main/inst/Cohorts.csv';

    public function handle(): int
    {
        $this->info('Syncing OHDSI PhenotypeLibrary...');

        if ($this->option('fresh')) {
            PhenotypeLibraryEntry::truncate();
            $this->info('Cleared existing entries.');
        }

        // Step 1: Fetch metadata CSV
        $this->info('Fetching phenotype metadata CSV...');
        $response = Http::timeout(60)->get(self::METADATA_CSV_URL);

        if ($response->failed()) {
            $this->error('Failed to fetch metadata CSV: '.$response->status());

            return Command::FAILURE;
        }

        $csv = $response->body();
        $csv = preg_replace('/^\xEF\xBB\xBF/', '', $csv);
        $lines = explode("\n", $csv);
        $headers = str_getcsv(array_shift($lines));
        $headerCount = count($headers);

        // Step 2: Download repo zip for bulk JSON extraction (unless --metadata-only)
        $cohortsDir = null;
        if (! $this->option('metadata-only')) {
            $cohortsDir = $this->downloadAndExtractCohorts();
            if ($cohortsDir === null) {
                $this->warn('Failed to download repo zip — proceeding with metadata only.');
            }
        }

        // Step 3: Process entries
        $synced = 0;
        $errors = 0;
        $validLines = array_filter($lines, fn ($line) => ! empty(trim($line)));
        $bar = $this->output->createProgressBar(count($validLines));

        // Batch upserts for performance
        $batch = [];
        $batchSize = 100;

        foreach ($validLines as $line) {
            $bar->advance();

            $row = str_getcsv($line);
            if (count($row) < $headerCount) {
                $row = array_pad($row, $headerCount, '');
            } elseif (count($row) > $headerCount) {
                $row = array_slice($row, 0, $headerCount);
            }

            $entry = array_combine($headers, $row);
            $cohortId = (int) ($entry['cohortId'] ?? $entry['id'] ?? 0);
            $cohortName = $entry['cohortName'] ?? $entry['name'] ?? '';

            if (! $cohortId || ! $cohortName) {
                continue;
            }

            try {
                // Read JSON from extracted zip (no HTTP call per cohort)
                $expressionJson = null;
                if ($cohortsDir !== null) {
                    $jsonPath = $cohortsDir.'/'.$cohortId.'.json';
                    if (file_exists($jsonPath)) {
                        $expressionJson = json_decode(file_get_contents($jsonPath), true);
                    }
                }

                $hashTag = $entry['hashTag'] ?? '';
                $tags = ! empty($hashTag) ? array_map('trim', explode(',', str_replace('#', '', $hashTag))) : null;

                $batch[] = [
                    'cohort_id' => $cohortId,
                    'cohort_name' => $cohortName,
                    'description' => $entry['description'] ?? $entry['shortDescription'] ?? null,
                    'expression_json' => $expressionJson !== null ? json_encode($expressionJson) : null,
                    'logic_description' => $entry['logicDescription'] ?? null,
                    'tags' => $tags !== null ? json_encode(array_filter($tags)) : null,
                    'domain' => ! empty($entry['domainsInEntryEvents']) ? $this->normalizeDomain($entry['domainsInEntryEvents']) : null,
                    'severity' => $entry['severity'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
                $synced++;

                if (count($batch) >= $batchSize) {
                    $this->upsertBatch($batch);
                    $batch = [];
                }
            } catch (\Throwable $e) {
                $errors++;
                Log::warning("Failed to sync phenotype $cohortId: ".$e->getMessage());
            }
        }

        // Flush remaining batch
        if (! empty($batch)) {
            $this->upsertBatch($batch);
        }

        // Cleanup temp directory
        if ($cohortsDir !== null) {
            $tmpDir = dirname($cohortsDir);
            $this->recursiveDelete($tmpDir);
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Synced $synced phenotypes ($errors errors).");
        $this->info('Total in library: '.PhenotypeLibraryEntry::count());

        return Command::SUCCESS;
    }

    private function downloadAndExtractCohorts(): ?string
    {
        $this->info('Downloading PhenotypeLibrary repo (bulk)...');
        $tmpZip = tempnam(sys_get_temp_dir(), 'phenotype_').'.zip';
        $tmpDir = sys_get_temp_dir().'/phenotype_extract_'.uniqid();

        $response = Http::timeout(120)->withOptions(['sink' => $tmpZip])->get(self::REPO_ZIP_URL);

        if ($response->failed() || ! file_exists($tmpZip) || filesize($tmpZip) < 1000) {
            @unlink($tmpZip);

            return null;
        }

        $this->info('Extracting cohort definitions...');
        $zip = new \ZipArchive;
        if ($zip->open($tmpZip) !== true) {
            @unlink($tmpZip);

            return null;
        }

        $zip->extractTo($tmpDir);
        $zip->close();
        @unlink($tmpZip);

        // Find the cohorts directory inside the extracted archive
        $dirs = glob($tmpDir.'/PhenotypeLibrary-*/inst/cohorts');
        if (empty($dirs)) {
            $this->recursiveDelete($tmpDir);

            return null;
        }

        $this->info('Found '.count(glob($dirs[0].'/*.json')).' cohort JSON files.');

        return $dirs[0];
    }

    private function upsertBatch(array $batch): void
    {
        PhenotypeLibraryEntry::upsert(
            $batch,
            ['cohort_id'],
            ['cohort_name', 'description', 'expression_json', 'logic_description', 'tags', 'domain', 'severity', 'updated_at']
        );
    }

    private function normalizeDomain(string $raw): string
    {
        $domains = array_map('trim', explode(',', $raw));
        $mapped = array_map(function ($d) {
            return match (strtolower(str_replace(' ', '', $d))) {
                'conditionoccurrence' => 'Condition',
                'drugexposure', 'drugera' => 'Drug',
                'measurement' => 'Measurement',
                'procedureoccurrence' => 'Procedure',
                'observation' => 'Observation',
                'visitoccurrence' => 'Visit',
                'deviceexposure' => 'Device',
                'death' => 'Death',
                default => $d,
            };
        }, $domains);

        return implode(', ', array_unique($mapped));
    }

    private function recursiveDelete(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }
        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($items as $item) {
            $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
        rmdir($dir);
    }
}
