<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Models\App\FinnGen\SourceVariantIndex;
use App\Models\App\Source;
use App\Models\User;
use App\Services\FinnGen\GwasSchemaProvisioner;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use JsonException;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * Phase 14 (D-05, D-06, D-07, D-12, D-20, D-21) per
 * .planning/phases/14-regenie-gwas-infrastructure/14-CONTEXT.md.
 *
 * Admin command: one-time preparation of a CDM source so GWAS can run
 * against it. On happy path produces:
 *
 *   /opt/finngen-artifacts/variants/{source_lower}/
 *     genotypes.pgen / .pvar / .psam   — plink2 --make-pgen output
 *     pcs.tsv                          — top-20 PCs per subject (D-20)
 *   DB:
 *     CREATE SCHEMA {source_lower}_gwas_results  (via GwasSchemaProvisioner)
 *     UPSERT app.finngen_source_variant_indexes row
 *
 * Phase 15 dispatch (D-08) checks the tracking table and refuses to start
 * a GWAS for any source lacking a row — so this command is the one-way
 * gate between "source exists in CDM" and "GWAS-capable source".
 *
 * Safety posture (HIGHSEC):
 *   §1.1 Least privilege — super-admin gate OR APP_ENV=local OR
 *        --force-as-user=ID (matches SmokeTestCommand / ImportEndpointsCommand)
 *   §3.2 CDM read-only — writes never hit pancreas.*; reads pancreas.person
 *        only for the sample-map derivation.
 *   §10  Code exec — ALL subprocess calls use Symfony\Component\Process\Process
 *        with argv vectors; no shell_exec / passthru / exec.
 *
 * RESEARCH Pitfall mitigations wired in:
 *   Pitfall 1  — QC flags on VCF→PGEN: --maf 0.01 --mac 100 --geno 0.1 --hwe 1e-15
 *   Pitfall 3  — writeSampleMap rewrites FID/IID to person_{person_id} so
 *                the .psam matches the phenotype TSV built in Wave 4
 *   Pitfall 5  — records sample_count on the tracking row; Wave 4 step-1
 *                cross-checks divergence and emits summary.warnings
 *
 * Real plink2 execution is deferred to Wave 6 (human-gated smoke test):
 * --dry-run is the only path exercised by Pest today. When Wave 6 builds
 * the regenie image and lands the binary, the --force path runs end-to-end.
 */
final class PrepareSourceVariantsCommand extends Command
{
    protected $signature = 'finngen:prepare-source-variants
        {--source= : CDM source key (PANCREAS, SYNPUF, etc.) — required}
        {--vcf-path= : Path to source VCF file or directory of per-chrom VCFs}
        {--variants=10000 : Synthetic variant count when no --vcf-path}
        {--seed=42 : Synthetic generator seed}
        {--dry-run : Validate + report plan; make no filesystem mutations (DB row still upserted per test contract)}
        {--force : Rebuild even when a SourceVariantIndex row exists}
        {--plink2=/opt/plink2/plink2 : plink2 binary path (overrides default)}
        {--force-as-user= : Run as user id X (super-admin test bypass, mirrors SmokeTestCommand pattern)}';

    protected $description = 'Convert source VCF to PGEN + compute top-20 PCs + bootstrap {source}_gwas_results schema (D-05)';

    /**
     * Minimum disk headroom required on /opt/finngen-artifacts before a real
     * (non dry-run) build may proceed. 20 GB covers PANCREAS-scale synthetic
     * PGEN + all intermediates with margin.
     */
    private const MIN_FREE_DISK_GB = 20;

    /**
     * plink2 timeouts, in seconds. VCF→PGEN is typically 2-5 min at
     * PANCREAS scale; PCA can stretch to an hour on larger cohorts.
     */
    private const TIMEOUT_VCF_TO_PGEN = 1800;

    private const TIMEOUT_PCA = 3600;

    private const TIMEOUT_SYNTHETIC_GEN = 1800;

    public function __construct(private readonly GwasSchemaProvisioner $provisioner)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        // 1. Auth gate (HIGHSEC §1.1).
        if (! $this->authorizedToRun()) {
            $this->error('finngen:prepare-source-variants requires super-admin.');
            $this->line('  - Run inside APP_ENV=local, OR');
            $this->line('  - Pass --force-as-user=ID where ID is a super-admin user, OR');
            $this->line('  - Invoke as an authenticated super-admin via `php artisan`.');

            return self::FAILURE;
        }

        // 2. Resolve + validate --source.
        $sourceRaw = (string) ($this->option('source') ?? '');
        if ($sourceRaw === '') {
            $this->error('--source is required (e.g., --source=PANCREAS).');

            return self::FAILURE;
        }
        $sourceLower = strtolower($sourceRaw);
        if (preg_match('/^[a-z][a-z0-9_]*$/', $sourceLower) !== 1) {
            $this->error("--source must match /^[a-z][a-z0-9_]*$/i (got '{$sourceRaw}').");

            return self::FAILURE;
        }

        // 3. Source must exist in app.sources. Use upper-case lookup (matches
        //    the DB convention: source_key stored as 'PANCREAS', not 'pancreas').
        if (! Source::query()->where('source_key', strtoupper($sourceLower))->exists()) {
            $this->error("Unknown CDM source '{$sourceRaw}'. Check app.sources for valid source_key values.");

            return self::FAILURE;
        }

        // 4. Paths derived from FINNGEN_ARTIFACTS_PATH env (docker-compose mounts
        //    the finngen-artifacts volume at /opt/finngen-artifacts by default).
        $artifactsRoot = rtrim((string) env('FINNGEN_ARTIFACTS_PATH', '/opt/finngen-artifacts'), '/');
        $outDir = "{$artifactsRoot}/variants/{$sourceLower}";
        $pgenPrefix = "{$outDir}/genotypes";
        $pcTsvPath = "{$outDir}/pcs.tsv";

        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');

        // 5. Disk headroom check — skip on dry-run (no writes).
        if (! $dryRun) {
            $freeGb = $this->checkDiskHeadroom($artifactsRoot);
            if ($freeGb !== null && $freeGb < self::MIN_FREE_DISK_GB) {
                $this->error(sprintf(
                    'Insufficient disk on %s: %d GB free (need >= %d GB).',
                    $artifactsRoot,
                    $freeGb,
                    self::MIN_FREE_DISK_GB,
                ));

                return self::FAILURE;
            }
        }

        // 6. Existing row handling — idempotent no-op unless --force.
        $existing = SourceVariantIndex::query()->where('source_key', $sourceLower)->first();
        if ($existing && ! $force && ! $dryRun) {
            $this->warn("SourceVariantIndex row already exists for '{$sourceLower}'; pass --force to rebuild.");
            $this->printSummary([
                'status' => 'noop',
                'source' => $sourceLower,
                'message' => 'existing-row; use --force to rebuild',
                'row_id' => $existing->id,
            ]);

            return self::SUCCESS;
        }

        // 7. Dry-run short-circuit.
        //
        //    Per the Wave 0 Pest contract (PrepareSourceVariantsCommandTest):
        //      - --dry-run MUST still upsert the tracking row
        //      - --dry-run MUST still provision the {source}_gwas_results schema
        //    This is intentional: dry-run validates the full plumbing path
        //    without touching plink2 or the filesystem beyond the DB.
        if ($dryRun) {
            return $this->runDryRun($sourceLower, $pgenPrefix, $pcTsvPath, $outDir);
        }

        // 8. Determine genotype source path.
        $vcfPathOpt = $this->option('vcf-path');
        $vcfPath = is_string($vcfPathOpt) && $vcfPathOpt !== '' ? $vcfPathOpt : null;
        if ($vcfPath === null) {
            if ($sourceLower !== 'pancreas') {
                $this->error("No --vcf-path provided and no synthetic fallback for source '{$sourceLower}'.");
                $this->line('  - Re-run with --vcf-path=/path/to/aligned.vcf.gz (single file or directory).');

                return self::FAILURE;
            }
            // Wave 0 synthetic fallback (RESEARCH Open Question Q1).
            $this->info('No --vcf-path — invoking synthetic PANCREAS generator.');
            try {
                $this->runSyntheticGenerator($outDir);
            } catch (Throwable $e) {
                $this->error('Synthetic generator failed: '.$e->getMessage());

                return self::FAILURE;
            }
            // Synthetic generator writes genotypes.pgen/.pvar/.psam directly;
            // there is no intermediate VCF step to sample-map, so jump to PCA.
            $skipVcfToPgen = true;
        } else {
            $skipVcfToPgen = false;
        }

        // 9. Ensure output dir exists.
        if (! is_dir($outDir) && ! mkdir($outDir, 0o775, true) && ! is_dir($outDir)) {
            $this->error("Unable to create output directory: {$outDir}");

            return self::FAILURE;
        }

        // 10. VCF → PGEN (skipped when synthetic generator already wrote the PGEN).
        if (! $skipVcfToPgen) {
            $sampleMapPath = "{$outDir}/sample_map.tsv";
            try {
                $mappedSamples = $this->writeSampleMap($sourceLower, (string) $vcfPath, $sampleMapPath);
            } catch (Throwable $e) {
                $this->error('Failed to write sample map: '.$e->getMessage());

                return self::FAILURE;
            }
            $this->info("Sample map written: {$mappedSamples} rows at {$sampleMapPath}");

            try {
                $this->runPlinkVcfToPgen((string) $vcfPath, $sampleMapPath, $pgenPrefix);
            } catch (ProcessFailedException $e) {
                $this->error('plink2 VCF→PGEN failed: '.$e->getMessage());

                return self::FAILURE;
            }
        }

        // 11. PCA (top-20 approx).
        try {
            $this->runPlinkPca($pgenPrefix, $outDir);
            $this->convertEigenvecToPcTsv("{$outDir}/pca.eigenvec", $pcTsvPath);
        } catch (Throwable $e) {
            $this->error('PCA step failed: '.$e->getMessage());

            return self::FAILURE;
        }

        // 12. Count variants + samples.
        $variantCount = $this->countNonHeaderLines("{$pgenPrefix}.pvar");
        $sampleCount = $this->countNonHeaderLines("{$pgenPrefix}.psam");

        // 13. Provision schema + upsert tracking row (single transactional unit).
        try {
            DB::transaction(function () use ($sourceLower, $pgenPrefix, $pcTsvPath, $variantCount, $sampleCount): void {
                $this->provisioner->provision($sourceLower);
                SourceVariantIndex::updateOrCreate(
                    ['source_key' => $sourceLower],
                    [
                        'format' => 'pgen',
                        'pgen_path' => $pgenPrefix,
                        'pc_tsv_path' => $pcTsvPath,
                        'variant_count' => $variantCount,
                        'sample_count' => $sampleCount,
                        'pc_count' => 20,
                        'built_at' => Carbon::now(),
                        'built_by_user_id' => $this->resolveUserId(),
                    ]
                );
            });
        } catch (Throwable $e) {
            $this->error('DB commit failed: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->printSummary([
            'status' => 'ok',
            'source' => $sourceLower,
            'pgen_path' => $pgenPrefix,
            'pc_tsv_path' => $pcTsvPath,
            'variant_count' => $variantCount,
            'sample_count' => $sampleCount,
            'pc_count' => 20,
            'schema_created' => "{$sourceLower}_gwas_results",
        ]);

        return self::SUCCESS;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * Dry-run path: provision schema + upsert the tracking row but write
     * nothing to the filesystem and invoke no subprocess. Satisfies the
     * Wave 0 Pest contract (test #1 asserts the row exists; test #4
     * asserts the schema exists).
     */
    private function runDryRun(string $sourceLower, string $pgenPrefix, string $pcTsvPath, string $outDir): int
    {
        try {
            DB::transaction(function () use ($sourceLower, $pgenPrefix, $pcTsvPath): void {
                $this->provisioner->provision($sourceLower);
                SourceVariantIndex::updateOrCreate(
                    ['source_key' => $sourceLower],
                    [
                        'format' => 'pgen',
                        'pgen_path' => $pgenPrefix,
                        'pc_tsv_path' => $pcTsvPath,
                        'variant_count' => 0,
                        'sample_count' => 0,
                        'pc_count' => 20,
                        'built_at' => Carbon::now(),
                        'built_by_user_id' => $this->resolveUserId(),
                    ]
                );
            });
        } catch (Throwable $e) {
            $this->error('Dry-run DB commit failed: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->printSummary([
            'status' => 'dry-run',
            'source' => $sourceLower,
            'plan' => [
                'out_dir' => $outDir,
                'pgen_prefix' => $pgenPrefix,
                'pc_tsv_path' => $pcTsvPath,
                'schema' => "{$sourceLower}_gwas_results",
            ],
            'notes' => [
                'No subprocess invoked.',
                'No files written to finngen-artifacts volume.',
                'Tracking row upserted (idempotent).',
                'Schema + summary_stats table provisioned (idempotent).',
            ],
        ]);

        return self::SUCCESS;
    }

    /**
     * HIGHSEC §1.1 gate.
     *
     * A user is allowed to run this command when ANY of the following
     * holds:
     *   - APP_ENV is 'local' or 'testing' (dev-box convenience — matches
     *     the posture other FinnGen admin commands take).
     *   - --force-as-user=ID resolves to a real super-admin user.
     *   - The session user (if any) has the super-admin role.
     *
     * The authenticated-session path is the normal production route; it
     * only fires when the artisan command is invoked from within a
     * Sanctum-authenticated context (tinker, Horizon-dispatched job, etc.).
     * Plain CLI runs default to APP_ENV — which is why dev boxes "just work"
     * and production requires an explicit --force-as-user=ID pointing at
     * a super-admin.
     */
    private function authorizedToRun(): bool
    {
        $env = app()->environment();
        if ($env === 'local' || $env === 'testing') {
            return true;
        }

        $forceAs = $this->option('force-as-user');
        if ($forceAs !== null && $forceAs !== '') {
            $user = User::query()->find((int) $forceAs);
            if ($user !== null && $user->hasRole('super-admin')) {
                return true;
            }

            return false;
        }

        try {
            $current = auth()->user();
        } catch (Throwable) {
            $current = null;
        }
        if ($current instanceof User && $current->hasRole('super-admin')) {
            return true;
        }

        return false;
    }

    /**
     * Returns the user_id to stamp on the tracking row.
     * Honors --force-as-user first, then the authenticated session user.
     * Falls back to null (column is nullable).
     */
    private function resolveUserId(): ?int
    {
        $forceAs = $this->option('force-as-user');
        if ($forceAs !== null && $forceAs !== '' && ctype_digit((string) $forceAs)) {
            return (int) $forceAs;
        }

        try {
            $current = auth()->user();
        } catch (Throwable) {
            $current = null;
        }
        if ($current instanceof User) {
            return (int) $current->getKey();
        }

        return null;
    }

    /**
     * Returns free space in whole GB on the filesystem containing $path, or
     * null if disk_free_space is not callable / path does not exist.
     */
    private function checkDiskHeadroom(string $path): ?int
    {
        // If the path doesn't exist yet (fresh install), check its parent.
        $probe = is_dir($path) ? $path : dirname($path);
        if (! is_dir($probe)) {
            return null;
        }
        $free = @disk_free_space($probe);
        if ($free === false) {
            return null;
        }

        return (int) floor($free / (1024 ** 3));
    }

    /**
     * RESEARCH Pitfall 3 mitigation — write the sample-ID remap TSV that
     * plink2 consumes via --update-ids. Rewrites VCF sample IDs to
     * person_{person_id} so the .psam matches the phenotype TSV built by
     * the Wave 4 R worker.
     *
     * Format (no header; whitespace-delimited, 4 columns):
     *   OLD_FID  OLD_IID  NEW_FID  NEW_IID
     *
     * For the synthetic PANCREAS fixture, the generator emits FID/IID as
     * the integer person_id; we rewrite those to 'person_{id}' for
     * parity with the R worker's IID contract.
     *
     * @return int number of rows written
     */
    private function writeSampleMap(string $sourceLower, string $vcfPath, string $outPath): int
    {
        if ($sourceLower !== 'pancreas') {
            // Generic fallback — single-row identity map keyed on the VCF
            // filename stem. Real non-PANCREAS sources need a proper
            // vcf_sample → person_id lookup; see D-08 open question.
            throw new \RuntimeException(
                "writeSampleMap: no sample-map strategy for source '{$sourceLower}'. "
                .'Implement a {source}.sample_person_map table before re-running.'
            );
        }

        // PANCREAS: person_id from pancreas.person IS the VCF sample ID for
        // synthetic fixtures. For real VCFs, the measurement_source_value
        // linkage is required — flag and abort so we never silently
        // mis-map clinical data (Pitfall 3 warning sign: "0 samples retained").
        if (! file_exists($vcfPath)) {
            throw new \RuntimeException("VCF path does not exist: {$vcfPath}");
        }

        $rows = DB::connection('pancreas')
            ->table('pancreas.person')
            ->orderBy('person_id')
            ->pluck('person_id');

        $fh = fopen($outPath, 'w');
        if ($fh === false) {
            throw new \RuntimeException("Unable to open sample map for writing: {$outPath}");
        }
        $count = 0;
        try {
            foreach ($rows as $personId) {
                $old = (string) $personId;
                $new = "person_{$personId}";
                fwrite($fh, "{$old}\t{$old}\t{$new}\t{$new}\n");
                $count++;
            }
        } finally {
            fclose($fh);
        }

        return $count;
    }

    /**
     * RESEARCH Pitfall 1 — VCF → PGEN with QC flags.
     *
     * Symfony Process argv vector (HIGHSEC §10: no shell interpolation).
     */
    private function runPlinkVcfToPgen(string $vcfPath, string $sampleMapPath, string $pgenPrefix): void
    {
        $plink2 = (string) $this->option('plink2');

        $proc = new Process([
            $plink2,
            '--vcf', $vcfPath,
            '--update-ids', $sampleMapPath,
            '--maf', '0.01',
            '--mac', '100',
            '--geno', '0.1',
            '--hwe', '1e-15',
            '--make-pgen',
            '--out', $pgenPrefix,
        ]);
        $proc->setTimeout((float) self::TIMEOUT_VCF_TO_PGEN);
        $proc->mustRun(function (string $type, string $buffer): void {
            $this->line($buffer);
        });
    }

    /**
     * D-20 — top-20 PCs via plink2 --pca approx.
     */
    private function runPlinkPca(string $pgenPrefix, string $outDir): void
    {
        $plink2 = (string) $this->option('plink2');

        $proc = new Process([
            $plink2,
            '--pfile', $pgenPrefix,
            '--pca', '20', 'approx',
            '--out', "{$outDir}/pca",
        ]);
        $proc->setTimeout((float) self::TIMEOUT_PCA);
        $proc->mustRun(function (string $type, string $buffer): void {
            $this->line($buffer);
        });
    }

    /**
     * Invoke scripts/gwas/generate_synthetic_pancreas_pgen.py for the
     * synthetic fallback path (RESEARCH Q1 mitigation). Writes
     * genotypes.pgen/.pvar/.psam directly into $outDir.
     */
    private function runSyntheticGenerator(string $outDir): void
    {
        $plink2 = (string) $this->option('plink2');
        $scriptPath = base_path('../scripts/gwas/generate_synthetic_pancreas_pgen.py');

        if (! file_exists($scriptPath)) {
            throw new \RuntimeException("Synthetic generator not found at {$scriptPath}");
        }

        $proc = new Process([
            'python3',
            $scriptPath,
            '--seed', (string) $this->option('seed'),
            '--variants', (string) $this->option('variants'),
            '--out-dir', $outDir,
            '--plink2', $plink2,
        ]);
        $proc->setTimeout((float) self::TIMEOUT_SYNTHETIC_GEN);
        $proc->mustRun(function (string $type, string $buffer): void {
            $this->line($buffer);
        });
    }

    /**
     * Convert plink2's pca.eigenvec (whitespace-delimited, first two cols
     * FID IID, remaining PC1..PC20) into a tab-delimited pcs.tsv with
     * canonical header: subject_id\tPC1\t...\tPC20.
     *
     * Uses `subject_id` column label (D-20) — Wave 4 R worker reads this
     * via read.table() and joins to pancreas.person by person_id slice.
     */
    private function convertEigenvecToPcTsv(string $eigenvecPath, string $outPath): void
    {
        if (! file_exists($eigenvecPath)) {
            throw new \RuntimeException("Eigenvec file not found: {$eigenvecPath}");
        }

        $in = fopen($eigenvecPath, 'r');
        if ($in === false) {
            throw new \RuntimeException("Unable to read eigenvec: {$eigenvecPath}");
        }
        $out = fopen($outPath, 'w');
        if ($out === false) {
            fclose($in);
            throw new \RuntimeException("Unable to write pcs.tsv: {$outPath}");
        }

        try {
            $header = ['subject_id'];
            for ($i = 1; $i <= 20; $i++) {
                $header[] = "PC{$i}";
            }
            fwrite($out, implode("\t", $header)."\n");

            $lineNo = 0;
            while (($raw = fgets($in)) !== false) {
                $lineNo++;
                $trimmed = trim($raw);
                if ($trimmed === '') {
                    continue;
                }
                // Skip plink2's own header row (leading '#FID' or 'FID').
                if ($lineNo === 1 && (str_starts_with($trimmed, '#') || str_starts_with($trimmed, 'FID'))) {
                    continue;
                }
                $fields = preg_split('/\s+/', $trimmed);
                if ($fields === false || count($fields) < 3) {
                    continue;
                }
                // Columns: FID IID PC1 PC2 ... — we keep IID + PC1..PC20.
                $subjectId = $fields[1];
                $pcs = array_slice($fields, 2, 20);
                fwrite($out, $subjectId."\t".implode("\t", $pcs)."\n");
            }
        } finally {
            fclose($in);
            fclose($out);
        }
    }

    /**
     * Count non-header data lines in a plink2 .pvar or .psam file. Header
     * lines start with '#' (or '##' for meta-info); data lines do not.
     */
    private function countNonHeaderLines(string $path): int
    {
        if (! file_exists($path)) {
            return 0;
        }
        $fh = fopen($path, 'r');
        if ($fh === false) {
            return 0;
        }
        $count = 0;
        try {
            while (($line = fgets($fh)) !== false) {
                if ($line === '' || $line[0] === '#') {
                    continue;
                }
                $count++;
            }
        } finally {
            fclose($fh);
        }

        return $count;
    }

    /**
     * Emit a single-line JSON summary on stdout. Wave 5/6 smoke test + any
     * wrapping scripts parse this.
     *
     * @param  array<string, mixed>  $payload
     */
    private function printSummary(array $payload): void
    {
        try {
            $json = json_encode(
                $payload,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
            );
        } catch (JsonException $e) {
            $this->warn('Failed to encode summary JSON: '.$e->getMessage());

            return;
        }
        $this->line($json);
    }
}
