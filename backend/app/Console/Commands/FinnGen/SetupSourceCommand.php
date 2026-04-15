<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Models\App\FinnGen\Run;
use App\Models\User;
use App\Services\FinnGen\FinnGenRunService;
use Illuminate\Console\Command;

/**
 * Admin-facing source setup. Wraps a romopapi.setup async run and
 * polls until terminal, printing progress messages.
 *
 * Usage:
 *   php artisan finngen:setup-source EUNOMIA
 *   php artisan finngen:setup-source SYNPUF --no-wait
 *
 * Spec §7.2 post-deploy step.
 */
class SetupSourceCommand extends Command
{
    protected $signature = 'finngen:setup-source
                            {source_key : The source key, e.g. EUNOMIA}
                            {--no-wait : Dispatch + exit, do not block for completion}';

    protected $description = 'Initialize a CDM source for FinnGen (materializes stratified_code_counts table)';

    public function handle(FinnGenRunService $runs): int
    {
        $sourceKey = strtoupper((string) $this->argument('source_key'));
        $noWait = (bool) $this->option('no-wait');

        $systemUser = User::query()->orderBy('id')->first();
        if (! $systemUser) {
            $this->error('No users exist to own the setup run. Seed at least one user first.');

            return self::FAILURE;
        }

        $this->info("Dispatching romopapi.setup for source '{$sourceKey}'...");
        $run = $runs->create(
            userId: $systemUser->id,
            sourceKey: $sourceKey,
            analysisType: 'romopapi.setup',
            params: [],
        );
        $this->info("  run_id: {$run->id}");

        if ($noWait) {
            $this->comment('Dispatched. Poll with: php artisan tinker → App\\Models\\App\\FinnGen\\Run::find(\''.$run->id.'\')');

            return self::SUCCESS;
        }

        $this->comment('Polling run status (press Ctrl+C to detach; run continues in background)...');
        $lastStep = null;

        while (true) {
            sleep(3);
            $run = $run->fresh();
            if (! $run) {
                $this->error('Run disappeared — check logs.');

                return self::FAILURE;
            }

            $progress = $run->progress ?? [];
            $step = $progress['step'] ?? $run->status;
            $pct = $progress['pct'] ?? 0;
            $message = $progress['message'] ?? '';

            $stepLine = sprintf('  [%3d%%] %-20s %s', $pct, $step, $message);
            if ($stepLine !== $lastStep) {
                $this->line($stepLine);
                $lastStep = $stepLine;
            }

            if ($run->isTerminal()) {
                break;
            }
        }

        if ($run->status === Run::STATUS_SUCCEEDED) {
            $rowCount = $run->summary['stratified_row_count'] ?? '?';
            $this->info("✓ Setup succeeded for '{$sourceKey}' — {$rowCount} rows in stratified_code_counts");

            return self::SUCCESS;
        }

        $this->error("✗ Setup {$run->status} for '{$sourceKey}'");
        if (! empty($run->error)) {
            $this->line('  error.code:     '.($run->error['code'] ?? '?'));
            $this->line('  error.category: '.($run->error['category'] ?? '?'));
            $this->line('  error.message:  '.($run->error['message'] ?? '?'));
        }

        return self::FAILURE;
    }
}
