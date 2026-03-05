<?php

namespace App\Notifications;

use App\Models\App\CohortGeneration;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CohortGeneratedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly CohortGeneration $generation,
    ) {
        $this->queue = 'notifications';
        $this->generation->loadMissing('cohortDefinition');
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
        $cohort = $this->generation->cohortDefinition;
        $name = $cohort->name ?? 'Unknown';
        $personCount = $this->generation->person_count ?? 0;

        return (new MailMessage)
            ->subject("Cohort Generated: {$name}")
            ->line("Your cohort '{$name}' has been generated successfully.")
            ->line("Person count: {$personCount}")
            ->action(
                'View Cohort',
                config('app.url')."/cohort-definitions/{$cohort->id}"
            )
            ->line('-- Parthenon Research Platform');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $cohort = $this->generation->cohortDefinition;

        return [
            'generation_id' => $this->generation->id,
            'cohort_definition_id' => $cohort?->id,
            'cohort_name' => $cohort?->name ?? 'Unknown',
            'status' => 'completed',
            'person_count' => $this->generation->person_count,
            'completed_at' => $this->generation->completed_at?->toIso8601String(),
        ];
    }
}
