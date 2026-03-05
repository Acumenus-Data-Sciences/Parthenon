<?php

namespace App\Notifications;

use App\Models\App\AnalysisExecution;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AnalysisCompletedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly AnalysisExecution $execution,
    ) {
        $this->queue = 'notifications';
        $this->execution->loadMissing('analysis');
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        $channels = [];

        if ($notifiable->notification_email) {
            $channels[] = 'mail';
        }

        if ($notifiable->notification_sms && $notifiable->phone_number) {
            $channels[] = 'vonage';
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $analysis = $this->execution->analysis;
        $name = $analysis->name ?? 'Unknown';
        $type = class_basename($analysis);

        $duration = $this->execution->started_at && $this->execution->completed_at
            ? $this->execution->started_at->diffForHumans($this->execution->completed_at, true)
            : 'N/A';

        $message = (new MailMessage)
            ->subject("Analysis Complete: {$name}")
            ->line("Your {$type} analysis '{$name}' has completed successfully.")
            ->line("Duration: {$duration}");

        // Include summary from result_json if available
        $resultJson = $this->execution->result_json;
        if (is_array($resultJson)) {
            if (isset($resultJson['person_count'])) {
                $message->line("Person count: {$resultJson['person_count']}");
            }
            if (isset($resultJson['record_count'])) {
                $message->line("Record count: {$resultJson['record_count']}");
            }
        }

        $typeSlug = strtolower(
            preg_replace('/(?<!^)[A-Z]/', '-$0', $type)
        );

        $message->action(
            'View Results',
            config('app.url')."/analyses/{$typeSlug}/{$analysis->id}"
        );

        $message->line('-- Parthenon Research Platform');

        return $message;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $analysis = $this->execution->analysis;

        return [
            'execution_id' => $this->execution->id,
            'analysis_id' => $analysis?->id,
            'analysis_type' => class_basename($analysis),
            'analysis_name' => $analysis?->name ?? 'Unknown',
            'status' => 'completed',
            'completed_at' => $this->execution->completed_at?->toIso8601String(),
        ];
    }
}
