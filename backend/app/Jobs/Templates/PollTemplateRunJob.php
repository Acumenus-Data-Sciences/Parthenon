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

class PollTemplateRunJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(public readonly int $templateRunId) {}

    public function handle(TemplateRunService $service): void
    {
        $run = TemplateRun::find($this->templateRunId);
        if ($run === null) {
            return;
        }
        // Polling logic completed in Task 14.
    }

    /**
     * @return array<int,string>
     */
    public function tags(): array
    {
        return ['templates', 'template_run:'.$this->templateRunId];
    }
}
