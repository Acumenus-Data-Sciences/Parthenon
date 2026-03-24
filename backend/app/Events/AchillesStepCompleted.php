<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AchillesStepCompleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $runId,
        public readonly int $sourceId,
        public readonly int $analysisId,
        public readonly string $analysisName,
        public readonly string $category,
        public readonly string $status,
        public readonly float $elapsedSeconds,
        public readonly int $completedAnalyses,
        public readonly int $totalAnalyses,
        public readonly int $failedAnalyses,
        public readonly ?string $errorMessage = null,
    ) {}

    /** @return array<Channel> */
    public function broadcastOn(): array
    {
        return [
            new Channel("achilles.run.{$this->runId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'step.completed';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'run_id' => $this->runId,
            'source_id' => $this->sourceId,
            'analysis_id' => $this->analysisId,
            'analysis_name' => $this->analysisName,
            'category' => $this->category,
            'status' => $this->status,
            'elapsed_seconds' => $this->elapsedSeconds,
            'completed_analyses' => $this->completedAnalyses,
            'total_analyses' => $this->totalAnalyses,
            'failed_analyses' => $this->failedAnalyses,
            'error_message' => $this->errorMessage,
            'timestamp' => now()->toISOString(),
        ];
    }
}
