<?php

namespace App\Console\Commands;

use App\Services\Genomics\ClinVarSyncService;
use Illuminate\Console\Command;

class SyncClinVarCommand extends Command
{
    protected $signature = 'genomics:sync-clinvar
        {--papu-only : Download only Pathogenic/Likely-Pathogenic variants (~69 KB instead of 181 MB)}
        {--build=GRCh38 : Genome build tag to associate with synced variants}';

    protected $description = 'Download and index ClinVar VCF from NCBI FTP into clinvar_variants table';

    public function handle(ClinVarSyncService $service): int
    {
        $papuOnly = (bool) $this->option('papu-only');
        $build    = (string) $this->option('build');

        $subset = $papuOnly ? 'Pathogenic/Likely-Pathogenic subset (clinvar_papu.vcf.gz)' : 'full ClinVar (clinvar.vcf.gz)';
        $this->info("Syncing {$subset} for build {$build}…");
        $this->info('This may take several minutes for the full file.');

        try {
            $result = $service->sync($papuOnly, $build);

            $this->info('✓ Sync complete');
            $this->table(
                ['Inserted', 'Updated', 'Errors', 'Log ID'],
                [[$result['inserted'], $result['updated'], $result['errors'], $result['log_id']]]
            );
        } catch (\Throwable $e) {
            $this->error('Sync failed: ' . $e->getMessage());
            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
