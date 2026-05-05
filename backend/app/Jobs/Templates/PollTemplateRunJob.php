<?php

declare(strict_types=1);

namespace App\Jobs\Templates;

use App\Models\App\TemplateRun;
use App\Services\Templates\TemplateRunService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class PollTemplateRunJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Job re-dispatches itself; never relies on Horizon retry. */
    public int $tries = 1;

    public function __construct(
        public readonly int $templateRunId,
        public readonly int $attempt = 0,
    ) {}

    public function handle(TemplateRunService $service): void
    {
        $run = TemplateRun::find($this->templateRunId);
        if ($run === null) {
            return;
        }

        try {
            $service->pollAndUpdate($run);
        } catch (Throwable $e) {
            // Do not crash the worker — re-dispatch with backoff so transient
            // network errors against the Python service don't strand the run.
            $this->redispatch();

            return;
        }

        $run->refresh();
        if ($run->isTerminal()) {
            return;
        }

        $this->redispatch();
    }

    public function delaySeconds(): int
    {
        $sequence = [2, 4, 8, 16, 30];

        return $sequence[min($this->attempt, count($sequence) - 1)];
    }

    private function redispatch(): void
    {
        self::dispatch($this->templateRunId, $this->attempt + 1)
            ->delay(now()->addSeconds($this->delaySeconds()));
    }

    /**
     * @return array<int,string>
     */
    public function tags(): array
    {
        return ['templates', 'template_run:'.$this->templateRunId];
    }
}
