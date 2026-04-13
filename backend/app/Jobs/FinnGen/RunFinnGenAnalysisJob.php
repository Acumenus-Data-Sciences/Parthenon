<?php

declare(strict_types=1);

namespace App\Jobs\FinnGen;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Horizon job that drives a FinnGen run through its lifecycle by polling
 * Darkstar. Full implementation in Task C11. C10 creates this stub so
 * FinnGenRunService::create() can dispatch it.
 *
 * @codeCoverageIgnore SP1 C10 — stub only; handle() body lives in C11.
 */
class RunFinnGenAnalysisJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly string $runId,
        public readonly bool $resumeMode = false,
    ) {}

    public function handle(): void
    {
        // Implemented in Task C11.
    }
}
