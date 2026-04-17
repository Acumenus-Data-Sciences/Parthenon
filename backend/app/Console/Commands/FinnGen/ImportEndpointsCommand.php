<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Models\User;
use App\Services\FinnGen\FinnGenEndpointImporter;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

/**
 * Imports the FinnGen curated endpoint library XLSX into
 * finngen.endpoint_definitions as idempotent, typed rows (natural PK on
 * endpoint name). See quick task 260416-qpg for design details.
 * Phase 13.1 moved these rows out of app.cohort_definitions.
 */
final class ImportEndpointsCommand extends Command
{
    protected $signature = 'finngen:import-endpoints
        {--release=df14 : df12 | df13 | df14}
        {--dry-run : Parse and report coverage but do not write endpoint_definitions rows}
        {--limit= : Only import the first N endpoints (for testing)}
        {--fixture= : Override fixture filename (relative to database/fixtures/finngen/ or absolute)}
        {--no-solr-reindex : Skip the post-import solr:index-cohorts bulk reindex}
        {--overwrite : Re-import endpoints in overwrite mode; snapshots finngen.endpoint_definitions to finngen.endpoint_expressions_pre_phase13 first (Phase 13)}';

    protected $description = 'Import the FinnGen curated endpoint library into finngen.endpoint_definitions';

    public function handle(FinnGenEndpointImporter $importer): int
    {
        $release = $this->normalizeRelease((string) $this->option('release'));
        if ($release === null) {
            return self::INVALID;
        }

        // Per D-03 / HIGHSEC §1.1: author is hard-coded to the super-admin.
        $adminId = User::where('email', 'admin@acumenus.net')->value('id');
        if ($adminId === null) {
            $this->error('admin@acumenus.net not found; run `php artisan admin:seed` first.');

            return self::FAILURE;
        }

        $limit = null;
        if ($this->option('limit') !== null) {
            $limitStr = (string) $this->option('limit');
            if (! ctype_digit($limitStr) || (int) $limitStr < 1) {
                $this->error('--limit must be a positive integer');

                return self::INVALID;
            }
            $limit = (int) $limitStr;
        }

        $dryRun = (bool) $this->option('dry-run');
        $overwrite = (bool) $this->option('overwrite');
        $fixture = $this->option('fixture');
        $fixturePath = is_string($fixture) && $fixture !== '' ? $fixture : null;

        $this->info(sprintf(
            'Starting FinnGen endpoint import — release=%s, dry-run=%s, overwrite=%s, fixture=%s',
            $release,
            $dryRun ? 'yes' : 'no',
            $overwrite ? 'yes' : 'no',
            $fixturePath ?? 'default',
        ));

        if ($overwrite && ! $dryRun) {
            $this->info('Snapshotting current FinnGen endpoint_definitions to finngen.endpoint_expressions_pre_phase13...');
        }

        $report = $importer->import(
            release: $release,
            authorId: (int) $adminId,
            dryRun: $dryRun,
            limit: $limit,
            fixturePath: $fixturePath,
            progress: function (int $n, int $total): void {
                if ($n % 100 === 0 || $n === $total) {
                    $this->output->write(sprintf("\rImporting: %d / %d", $n, $total));
                }
            },
            overwrite: $overwrite,
        );

        $this->newLine(2);
        $this->info(sprintf('Total parsed: %d', $report->total));
        $this->info(sprintf('Imported: %d', $report->imported));
        $this->info(sprintf(
            'Coverage bucket: FULLY=%d PARTIAL=%d SPARSE=%d UNMAPPED=%d CONTROL_ONLY=%d',
            $report->coverage['FULLY_MAPPED'] ?? 0,
            $report->coverage['PARTIAL'] ?? 0,
            $report->coverage['SPARSE'] ?? 0,
            $report->coverage['UNMAPPED'] ?? 0,
            $report->coverage['CONTROL_ONLY'] ?? 0,
        ));
        $this->info(sprintf(
            'Coverage profile: universal=%d partial=%d finland_only=%d',
            $report->coverageProfile['universal'] ?? 0,
            $report->coverageProfile['partial'] ?? 0,
            $report->coverageProfile['finland_only'] ?? 0,
        ));
        if ($report->snapshotRowCount !== null) {
            $this->info(sprintf('Snapshot rows: %d', $report->snapshotRowCount));
        }
        if ($report->invariantViolations > 0) {
            $this->warn(sprintf('D-07 invariant violations: %d (UNMAPPED+universal collisions)', $report->invariantViolations));
        }
        $this->info(sprintf('Report: %s', $report->reportPath));

        if ($report->topUnmappedVocabularies !== []) {
            $this->info('Top unmapped vocabularies:');
            foreach (array_slice($report->topUnmappedVocabularies, 0, 8, true) as $vocab => $cnt) {
                $this->line(sprintf('  %-20s %d', $vocab, $cnt));
            }
        }

        // Single bulk Solr reindex — D-07 / T-qpg-05. Observer was disabled
        // during the loop to avoid flooding Horizon with one job per row.
        if (! $dryRun && ! (bool) $this->option('no-solr-reindex')) {
            $this->info('Running bulk solr:index-cohorts --type=cohort --fresh...');
            $exit = Artisan::call('solr:index-cohorts', [
                '--type' => 'cohort',
                '--fresh' => true,
            ]);
            $this->info(Artisan::output());
            if ($exit !== self::SUCCESS) {
                $this->warn('Solr bulk reindex returned non-zero — cohorts still in DB, reindex manually.');
            }
        }

        return self::SUCCESS;
    }

    /**
     * Normalize release option: accept 'df12'/'df13'/'df14' (and the 'r12'
     * alias since task spec mentions it).
     */
    private function normalizeRelease(string $raw): ?string
    {
        $r = strtolower(trim($raw));
        $aliases = ['r12' => 'df12', 'r13' => 'df13', 'r14' => 'df14'];
        if (isset($aliases[$r])) {
            $this->warn(sprintf('Release alias "%s" accepted — using "%s"', $r, $aliases[$r]));
            $r = $aliases[$r];
        }
        if (! in_array($r, ['df12', 'df13', 'df14'], true)) {
            $this->error(sprintf('Unknown release "%s" (expected df12|df13|df14)', $raw));

            return null;
        }

        return $r;
    }
}
