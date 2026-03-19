<?php

namespace App\Jobs;

use App\Models\App\GenomicUpload;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Dispatches VCF/MAF parsing to the Python AI service which uses cyvcf2 (C-backed).
 *
 * PHP Eloquent: ~500 variants/sec (individual INSERTs)
 * Python cyvcf2: ~100K variants/sec (batch INSERTs of 5000)
 */
class ParseGenomicUploadJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 7200; // 2 hours for large files

    public int $tries = 1;

    public function __construct(
        public GenomicUpload $upload,
    ) {
        $this->onQueue('genomics');
    }

    public function handle(): void
    {
        $absolutePath = Storage::disk('local')->path($this->upload->storage_path);

        Log::info('ParseGenomicUploadJob: Dispatching to Python parser', [
            'upload_id' => $this->upload->id,
            'filename' => $this->upload->filename,
            'size_mb' => round($this->upload->file_size_bytes / 1024 / 1024, 1),
            'path' => $absolutePath,
        ]);

        $aiServiceUrl = config('services.ai.url', 'http://python-ai:8000');

        try {
            $response = Http::timeout(7200)
                ->post("{$aiServiceUrl}/genomics/parse", [
                    'upload_id' => $this->upload->id,
                    'file_path' => $absolutePath,
                    'file_format' => $this->upload->file_format,
                    'genome_build' => $this->upload->genome_build,
                    'source_id' => $this->upload->source_id,
                    'sample_id' => $this->upload->sample_id,
                ]);

            if ($response->failed()) {
                throw new \RuntimeException(
                    "Python parser returned {$response->status()}: ".$response->body()
                );
            }

            Log::info('ParseGenomicUploadJob: Dispatched to Python parser successfully', [
                'upload_id' => $this->upload->id,
            ]);
        } catch (\Throwable $e) {
            Log::error('ParseGenomicUploadJob: Failed', [
                'upload_id' => $this->upload->id,
                'error' => $e->getMessage(),
            ]);

            $this->upload->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);
        }
    }
}
