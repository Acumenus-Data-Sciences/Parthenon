<?php

namespace App\Jobs\Achilles;

use App\Models\App\Source;
use App\Services\Achilles\Heel\AchillesHeelService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunHeelJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 600;

    public int $tries = 1;

    public function __construct(
        public Source $source,
        public string $runId,
    ) {
        $this->onQueue('achilles');
    }

    public function handle(AchillesHeelService $heelService): void
    {
        Log::info("Heel job started: {$this->runId}", ['source_id' => $this->source->id]);

        $result = $heelService->run($this->source, $this->runId);

        Log::info("Heel job completed: {$this->runId}", [
            'completed' => $result['completed'],
            'failed' => $result['failed'],
        ]);
    }
}
