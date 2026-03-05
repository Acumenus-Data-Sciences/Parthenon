<?php

namespace App\Events;

use App\Models\App\AnalysisExecution;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast when a study execution's status changes.
 *
 * Frontend can subscribe to the 'study.{studyId}.execution' channel
 * to receive real-time progress updates without polling.
 *
 * To activate broadcasting:
 * 1. Install Laravel Reverb: `composer require laravel/reverb`
 * 2. Publish config: `php artisan reverb:install`
 * 3. Configure BROADCAST_CONNECTION=reverb in .env
 * 4. Install Echo on frontend: `npm install laravel-echo pusher-js`
 */
class StudyExecutionUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int $studyId,
        public readonly int $executionId,
        public readonly string $status,
        public readonly string $analysisType,
        public readonly ?string $errorMessage = null,
    ) {}

    /**
     * @return array<Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel("study.{$this->studyId}.execution"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'execution.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'study_id' => $this->studyId,
            'execution_id' => $this->executionId,
            'status' => $this->status,
            'analysis_type' => $this->analysisType,
            'error_message' => $this->errorMessage,
            'timestamp' => now()->toISOString(),
        ];
    }

    /**
     * Create from an AnalysisExecution model.
     */
    public static function fromExecution(AnalysisExecution $execution, int $studyId): self
    {
        return new self(
            studyId: $studyId,
            executionId: $execution->id,
            status: $execution->status->value,
            analysisType: class_basename($execution->analysis_type),
            errorMessage: $execution->error_message,
        );
    }
}
