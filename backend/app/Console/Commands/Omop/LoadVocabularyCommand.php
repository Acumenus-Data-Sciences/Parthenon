<?php

declare(strict_types=1);

namespace App\Console\Commands\Omop;

use App\Context\SourceContext;
use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Models\App\VocabularyImport;
use App\Models\User;
use App\Services\Vocabulary\VocabularyImportService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class LoadVocabularyCommand extends Command
{
    protected $signature = 'omop:load-vocabulary
        {--source-key= : Registered source key}
        {--path= : Athena vocabulary directory or ZIP archive}
        {--zip= : Deprecated alias for --path}
        {--user-id= : Operator user ID required for a real import audit row}
        {--preflight-only : Validate files and target without changing the database}
        {--backup-path= : Verified pre-import pg_dump directory containing toc.dat}
        {--manifest= : Write the preflight/import report and SHA-256 sidecar to this path}
        {--remove-omitted : Remove vocabularies omitted from the package instead of preserving them}
        {--confirm-remove-omitted= : Must equal REMOVE_OMITTED_VOCABULARIES when --remove-omitted is used}';

    protected $description = 'Safely stage, validate, and import an Athena OMOP vocabulary package';

    public function handle(VocabularyImportService $service): int
    {
        $key = (string) $this->option('source-key');
        $path = (string) ($this->option('path') ?: $this->option('zip'));
        if ($key === '' || $path === '') {
            $this->error('--source-key and --path are required.');

            return self::FAILURE;
        }
        $source = Source::where('source_key', $key)->first();
        if (! $source) {
            $this->error("Source '{$key}' not found.");

            return self::FAILURE;
        }
        if (! file_exists($path)) {
            $this->error("Vocabulary input not found: {$path}");

            return self::FAILURE;
        }

        $removeOmitted = (bool) $this->option('remove-omitted');
        if ($removeOmitted && $this->option('confirm-remove-omitted') !== 'REMOVE_OMITTED_VOCABULARIES') {
            $this->error('--remove-omitted requires --confirm-remove-omitted=REMOVE_OMITTED_VOCABULARIES.');

            return self::FAILURE;
        }
        $preflightOnly = (bool) $this->option('preflight-only');
        $userId = $this->option('user-id');
        if (! $preflightOnly && (! $userId || ! User::query()->whereKey($userId)->exists())) {
            $this->error('A valid --user-id is required for a real import audit row.');

            return self::FAILURE;
        }

        $vocabSchema = SourceDaimon::where('source_id', $source->id)
            ->where('daimon_type', DaimonType::Vocabulary->value)
            ->value('table_qualifier') ?: 'vocab';
        SourceContext::forSource($source);
        $connection = DB::connection('ctx_vocab');

        $targetLabel = $source->db_host
            ? "{$source->db_host}/{$source->db_database}.{$vocabSchema}"
            : "local connection {$source->source_connection}.{$vocabSchema}";
        $this->info("Source '{$key}' target: {$targetLabel}");
        $audit = null;
        if (! $preflightOnly) {
            $audit = VocabularyImport::create([
                'user_id' => (int) $userId,
                'source_id' => $source->id,
                'status' => 'running',
                'progress_percentage' => 1,
                'file_name' => basename($path),
                'storage_path' => $path,
                'file_size' => is_file($path) ? filesize($path) : null,
                'target_schema' => $vocabSchema,
                'remove_omitted' => $removeOmitted,
                'backup_path' => $this->option('backup-path'),
                'started_at' => now(),
            ]);
        }

        try {
            $report = $service->import(
                connection: $connection,
                inputPath: $path,
                targetSchema: $vocabSchema,
                removeOmitted: $removeOmitted,
                logger: fn (string $line) => $this->line($line),
                preflightOnly: $preflightOnly,
                backupPath: $this->option('backup-path') ? (string) $this->option('backup-path') : null,
            );
            if ($audit !== null) {
                $audit->update([
                    'status' => 'awaiting_downstreams',
                    'progress_percentage' => 85,
                    'rows_loaded' => array_sum($report['after_counts'] ?? []),
                    'manifest' => $report,
                    'downstream_status' => array_fill_keys($report['downstream_required'] ?? [], 'pending'),
                    'completed_at' => now(),
                ]);
            }
            if ($this->option('manifest')) {
                $manifestPath = (string) $this->option('manifest');
                $manifestDirectory = dirname($manifestPath);
                if (! is_dir($manifestDirectory) && ! mkdir($manifestDirectory, 0700, true) && ! is_dir($manifestDirectory)) {
                    throw new \RuntimeException("Could not create manifest directory: {$manifestDirectory}");
                }
                $encoded = json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)."\n";
                file_put_contents($manifestPath, $encoded, LOCK_EX);
                file_put_contents($manifestPath.'.sha256', hash('sha256', $encoded).'  '.basename($manifestPath)."\n", LOCK_EX);
                $this->info("Manifest: {$manifestPath}");
            }
            $this->info($preflightOnly
                ? 'Vocabulary preflight passed; no database rows were changed.'
                : 'Database cutover passed; the audit record is awaiting versioned downstream rebuilds.');

            return self::SUCCESS;
        } catch (Throwable $error) {
            $audit?->update([
                'status' => 'failed',
                'error_message' => $error->getMessage(),
                'completed_at' => now(),
            ]);
            $this->error($error->getMessage());

            return self::FAILURE;
        }
    }
}
