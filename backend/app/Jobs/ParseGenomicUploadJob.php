<?php

namespace App\Jobs;

use App\Models\App\GenomicUpload;
use App\Services\Genomics\VcfParserService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

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

    public function handle(VcfParserService $parser): void
    {
        Log::info("ParseGenomicUploadJob: Starting parse for upload #{$this->upload->id}", [
            'filename' => $this->upload->filename,
            'size' => $this->upload->file_size_bytes,
        ]);

        $absolutePath = Storage::disk('local')->path($this->upload->storage_path);

        try {
            $result = $parser->parse($this->upload, $absolutePath);
            $this->upload->update([
                'status' => 'mapped',
                'total_variants' => $result['total'],
                'mapped_variants' => 0,
                'review_required' => 0,
                'parsed_at' => now(),
            ]);

            Log::info("ParseGenomicUploadJob: Completed upload #{$this->upload->id}", $result);
        } catch (\Throwable $e) {
            Log::error("ParseGenomicUploadJob: Failed upload #{$this->upload->id}", [
                'error' => $e->getMessage(),
            ]);

            $this->upload->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);
        }
    }
}
