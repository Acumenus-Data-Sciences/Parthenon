<?php

namespace App\Notifications;

use App\Models\App\AnalysisExecution;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AnalysisFailedNotification extends Notification implements ShouldQueue
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
        $failMessage = $this->execution->fail_message ?? 'No error details available.';

        $typeSlug = strtolower(
            preg_replace('/(?<!^)[A-Z]/', '-$0', $type)
        );

        return (new MailMessage)
            ->error()
            ->subject("Analysis Failed: {$name}")
            ->line("Your {$type} analysis '{$name}' has failed.")
            ->line("Error: {$failMessage}")
            ->action(
                'View Details',
                config('app.url')."/analyses/{$typeSlug}/{$analysis->id}"
            )
            ->line('-- Parthenon Research Platform');
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
            'status' => 'failed',
            'fail_message' => $this->execution->fail_message,
            'completed_at' => $this->execution->completed_at?->toIso8601String(),
        ];
    }
}
