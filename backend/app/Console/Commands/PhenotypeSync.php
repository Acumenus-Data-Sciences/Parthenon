<?php

namespace App\Console\Commands;

use App\Models\App\PhenotypeLibraryEntry;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PhenotypeSync extends Command
{
    protected $signature = 'phenotype:sync {--fresh : Delete existing entries before syncing}';
    protected $description = 'Sync OHDSI PhenotypeLibrary definitions from GitHub';

    private const METADATA_URL = 'https://raw.githubusercontent.com/OHDSI/PhenotypeLibrary/main/inst/cohorts/';
    private const COHORT_LIST_URL = 'https://api.github.com/repos/OHDSI/PhenotypeLibrary/contents/inst/cohorts';
    private const METADATA_CSV_URL = 'https://raw.githubusercontent.com/OHDSI/PhenotypeLibrary/main/inst/Cohorts.csv';

    public function handle(): int
    {
        $this->info('Syncing OHDSI PhenotypeLibrary...');

        if ($this->option('fresh')) {
            PhenotypeLibraryEntry::truncate();
            $this->info('Cleared existing entries.');
        }

        // Step 1: Fetch metadata CSV
        $this->info('Fetching phenotype metadata...');
        $response = Http::timeout(60)->get(self::METADATA_CSV_URL);

        if ($response->failed()) {
            $this->error('Failed to fetch metadata CSV: ' . $response->status());
            return Command::FAILURE;
        }

        $csv = $response->body();
        $lines = explode("\n", $csv);
        $headers = str_getcsv(array_shift($lines));

        $synced = 0;
        $errors = 0;
        $bar = $this->output->createProgressBar(count($lines));

        foreach ($lines as $line) {
            $bar->advance();

            if (empty(trim($line))) continue;

            $row = str_getcsv($line);
            if (count($row) < count($headers)) continue;

            $entry = array_combine($headers, $row);
            $cohortId = (int) ($entry['cohortId'] ?? $entry['id'] ?? 0);
            $cohortName = $entry['cohortName'] ?? $entry['name'] ?? '';

            if (!$cohortId || !$cohortName) continue;

            try {
                // Fetch cohort definition JSON
                $jsonUrl = self::METADATA_URL . $cohortId . '.json';
                $jsonResponse = Http::timeout(30)->get($jsonUrl);

                $expressionJson = null;
                if ($jsonResponse->successful()) {
                    $expressionJson = $jsonResponse->json();
                }

                PhenotypeLibraryEntry::updateOrCreate(
                    ['cohort_id' => $cohortId],
                    [
                        'cohort_name' => $cohortName,
                        'description' => $entry['description'] ?? $entry['shortDescription'] ?? null,
                        'expression_json' => $expressionJson,
                        'logic_description' => $entry['logicDescription'] ?? null,
                        'tags' => isset($entry['tags']) ? explode(';', $entry['tags']) : null,
                        'domain' => $entry['domain'] ?? null,
                        'severity' => $entry['severity'] ?? null,
                    ]
                );
                $synced++;
            } catch (\Throwable $e) {
                $errors++;
                Log::warning("Failed to sync phenotype $cohortId: " . $e->getMessage());
            }
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Synced $synced phenotypes ($errors errors).");
        $this->info('Total in library: ' . PhenotypeLibraryEntry::count());

        return Command::SUCCESS;
    }
}
