<?php

declare(strict_types=1);

namespace App\Console\Commands\Shiny;

use App\Models\App\PredictionAnalysis;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyExecution;
use App\Models\App\StudyResult;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SeedManagedShinyGoldenResultCommand extends Command
{
    protected $signature = 'shiny:seed-golden-result
        {--user=admin@acumenus.net : User email to own the smoke study and execution}
        {--database=testing/golden/plp-results.sqlite : Golden SQLite filename, local storage path, or absolute path}
        {--storage-path=testing/golden/plp-results.sqlite : Local storage disk path for the copied result database}
        {--title= : Optional study title}
        {--result-type=prediction_performance : Native Parthenon result_type value}
        {--hades-result-type=PatientLevelPrediction : Canonical OHDSI/HADES result type}
        {--app-key=plp-results : Managed Shiny app key expected to launch this result}
        {--cleanup : Soft-delete prior managed Shiny smoke studies before seeding}
        {--json : Emit a JSON summary for Playwright and smoke scripts}';

    protected $description = 'Seed a launchable Study Result backed by a golden managed OHDSI Shiny SQLite database.';

    public function handle(): int
    {
        if ((bool) $this->option('cleanup')) {
            Study::query()
                ->where('metadata->managed_shiny_smoke', true)
                ->get()
                ->each(fn (Study $study) => $study->delete());
        }

        $userQuery = User::query();
        $tenantScope = 'App\\Tenancy\\Concerns\\TenantScope';
        if (class_exists($tenantScope)) {
            $userQuery->withoutGlobalScope($tenantScope);
        }

        $user = $userQuery->where('email', (string) $this->option('user'))->first();

        if (! $user instanceof User) {
            $this->error(sprintf('No user found for %s.', (string) $this->option('user')));

            return self::FAILURE;
        }

        $sourcePath = $this->resolveSourcePath((string) $this->option('database'));
        if ($sourcePath === null) {
            return self::FAILURE;
        }

        $storagePath = ltrim((string) $this->option('storage-path'), '/');
        if ($storagePath === '' || str_contains($storagePath, '..')) {
            $this->error('Refusing to write the golden database to an unsafe storage path.');

            return self::FAILURE;
        }

        $targetPath = Storage::disk('local')->path($storagePath);
        if (realpath($sourcePath) !== realpath($targetPath)) {
            $stream = fopen($sourcePath, 'rb');
            if ($stream === false) {
                $this->error(sprintf('Could not read golden database: %s', $sourcePath));

                return self::FAILURE;
            }

            Storage::disk('local')->put($storagePath, $stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        $runId = now()->format('YmdHis').'-'.Str::lower(Str::random(6));
        $title = trim((string) ($this->option('title') ?: "Managed Shiny Golden Result {$runId}"));
        $hadesResultType = (string) $this->option('hades-result-type');
        $appKey = (string) $this->option('app-key');

        $study = Study::create([
            'title' => $title,
            'short_title' => 'Shiny Golden',
            'description' => 'Temporary managed OHDSI Shiny smoke study with a launchable native Study Result.',
            'study_type' => 'runtime_validation',
            'study_design' => 'observational',
            'phase' => 'execution',
            'priority' => 'low',
            'primary_objective' => 'Verify managed Shiny viewer discovery and official module rendering.',
            'status' => 'active',
            'created_by' => $user->id,
            'metadata' => [
                'managed_shiny_smoke' => true,
                'run_id' => $runId,
            ],
        ]);

        $analysis = StudyAnalysis::create([
            'study_id' => $study->id,
            'analysis_type' => PredictionAnalysis::class,
            'analysis_id' => 0,
        ]);

        $execution = StudyExecution::create([
            'study_id' => $study->id,
            'study_analysis_id' => $analysis->id,
            'status' => 'completed',
            'submitted_by' => $user->id,
            'submitted_at' => now(),
            'started_at' => now()->subSeconds(10),
            'completed_at' => now(),
            'execution_engine' => 'managed_shiny_smoke',
            'execution_params' => [
                'golden_database' => basename($sourcePath),
                'managed_shiny_app' => $appKey,
            ],
            'result_hash' => hash_file('sha256', $sourcePath) ?: null,
            'result_file_path' => $storagePath,
        ]);

        $result = StudyResult::create([
            'execution_id' => $execution->id,
            'study_id' => $study->id,
            'study_analysis_id' => $analysis->id,
            'result_type' => (string) $this->option('result-type'),
            'summary_data' => [
                'title' => 'Golden PatientLevelPrediction SQLite Results',
                'description' => 'Launchable golden SQLite result database for managed OHDSI Shiny smoke testing.',
                'result_type' => $hadesResultType,
                'managed_shiny_app' => $appKey,
                'managed_shiny' => [
                    'result_type' => $hadesResultType,
                    'managed_shiny_app' => $appKey,
                    'result_file_path' => $storagePath,
                    'mime_type' => 'application/vnd.sqlite3',
                ],
            ],
            'diagnostics' => [
                'managed_shiny' => [
                    'result_types' => [$hadesResultType],
                    'bundle_file_path' => $storagePath,
                ],
            ],
            'is_primary' => true,
            'is_publishable' => false,
        ]);

        $payload = [
            'study_slug' => $study->slug,
            'study_id' => $study->id,
            'result_id' => $result->id,
            'execution_id' => $execution->id,
            'storage_path' => $storagePath,
            'app_key' => $appKey,
            'hades_result_type' => $hadesResultType,
        ];

        if ((bool) $this->option('json')) {
            $this->line((string) json_encode($payload, JSON_UNESCAPED_SLASHES));
        } else {
            $this->info(sprintf(
                'Seeded launchable managed Shiny Study Result: %s result #%d (%s).',
                $study->slug,
                $result->id,
                $storagePath,
            ));
        }

        return self::SUCCESS;
    }

    private function resolveSourcePath(string $database): ?string
    {
        $candidates = [];
        if ($this->isAbsolutePath($database)) {
            $candidates[] = $database;
        } else {
            if (Storage::disk('local')->exists($database)) {
                return Storage::disk('local')->path($database);
            }

            $candidates[] = base_path($database);
            $candidates[] = base_path('docker/shiny-ohdsi/tests/golden/'.$database);
            $candidates[] = dirname(base_path()).'/docker/shiny-ohdsi/tests/golden/'.$database;
        }

        foreach ($candidates as $candidate) {
            if (File::isFile($candidate)) {
                return $candidate;
            }
        }

        $this->error(sprintf(
            'Golden database not found. Tried: %s',
            implode(', ', $candidates),
        ));

        return null;
    }

    private function isAbsolutePath(string $path): bool
    {
        return str_starts_with($path, '/') || preg_match('/^[A-Za-z]:[\\\\\\/]/', $path) === 1;
    }
}
