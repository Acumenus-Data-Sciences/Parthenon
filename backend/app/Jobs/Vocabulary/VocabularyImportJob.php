<?php

declare(strict_types=1);

namespace App\Jobs\Vocabulary;

use App\Context\SourceContext;
use App\Models\App\Source;
use App\Models\App\VocabularyImport;
use App\Services\Vocabulary\VocabularyImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class VocabularyImportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 21600;

    public int $tries = 1;

    public function __construct(public readonly VocabularyImport $import)
    {
        $this->queue = 'default';
    }

    public function handle(VocabularyImportService $service): void
    {
        $import = $this->import->fresh(['source']);
        if (! $import) {
            throw new \RuntimeException('Vocabulary import audit record no longer exists.');
        }

        $import->update([
            'status' => 'running',
            'started_at' => now(),
            'progress_percentage' => 1,
            'error_message' => null,
        ]);

        try {
            $path = Storage::path($import->storage_path);
            if (! is_file($path)) {
                throw new \RuntimeException('Uploaded vocabulary archive is missing.');
            }

            $connectionName = 'vocab';
            if ($import->source instanceof Source) {
                SourceContext::forSource($import->source);
                $connectionName = 'ctx_vocab';
            }
            $connection = DB::connection($connectionName);
            $report = $service->import(
                connection: $connection,
                inputPath: $path,
                targetSchema: (string) ($import->target_schema ?: 'vocab'),
                removeOmitted: (bool) $import->remove_omitted,
                logger: function (string $line) use ($import): void {
                    $import->appendLog($line);
                },
                backupPath: $import->backup_path,
            );

            $rows = array_sum($report['after_counts'] ?? []);
            $import->update([
                'status' => 'awaiting_downstreams',
                'progress_percentage' => 85,
                'rows_loaded' => $rows,
                'manifest' => $report,
                'downstream_status' => array_fill_keys($report['downstream_required'] ?? [], 'pending'),
                'completed_at' => now(),
            ]);
            $import->appendLog('Database cutover passed. Versioned downstream indexes remain explicitly pending.');
            Storage::delete($import->storage_path);

            Log::info('VocabularyImportJob database cutover completed', [
                'import_id' => $import->id,
                'rows' => $rows,
                'target_schema' => $import->target_schema,
                'preserved_vocabularies' => $report['preserved_vocabularies'] ?? [],
            ]);
        } catch (Throwable $error) {
            $import->update([
                'status' => 'failed',
                'error_message' => $error->getMessage(),
                'completed_at' => now(),
            ]);
            $import->appendLog('ERROR: '.$error->getMessage());
            Log::error('VocabularyImportJob failed', [
                'import_id' => $import->id,
                'error' => $error->getMessage(),
            ]);
            throw $error;
        }
    }
}
