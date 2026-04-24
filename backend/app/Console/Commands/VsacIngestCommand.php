<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

class VsacIngestCommand extends Command
{
    protected $signature = 'vsac:ingest
                            {file? : Path to .xlsx file, relative to repo root}
                            {--both : Ingest both default files (dqm_vs_*.xlsx and ec_hospip_hospop_cms_*.xlsx)}
                            {--refresh : Refresh the OMOP crosswalk materialized view after ingest}';

    protected $description = 'Ingest VSAC value-set expansions into app.vsac_* tables via the Python importer.';

    public function handle(): int
    {
        $repoRoot = realpath(base_path('..'));
        if ($repoRoot === false) {
            $this->error('Could not resolve repo root.');

            return self::FAILURE;
        }

        $script = $repoRoot.'/scripts/importers/ingest_vsac.py';
        if (! is_file($script)) {
            $this->error("Importer script missing: {$script}");

            return self::FAILURE;
        }

        $args = ['python3', $script];
        if ($this->option('both')) {
            $args[] = '--both';
        } elseif ($file = $this->argument('file')) {
            $args[] = (string) $file;
        } else {
            $this->error('Specify a file argument or pass --both.');

            return self::FAILURE;
        }

        $this->info('Running: '.implode(' ', $args));
        $process = new Process($args, $repoRoot, null, null, 1800);
        $process->run(function ($_, string $buffer): void {
            $this->getOutput()->write($buffer);
        });

        if (! $process->isSuccessful()) {
            $this->error('Importer failed.');

            return self::FAILURE;
        }

        if ($this->option('refresh')) {
            $this->info('Refreshing OMOP crosswalk materialized view...');
            DB::statement('REFRESH MATERIALIZED VIEW CONCURRENTLY app.vsac_value_set_omop_concepts');
            $this->info('Crosswalk refreshed.');
        }

        return self::SUCCESS;
    }
}
