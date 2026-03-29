<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Mass email sent by a super-admin to all registered users (BCC).
 */
class AdminBroadcastMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $emailSubject,
        public readonly string $emailBody,
        public readonly string $senderName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->emailSubject,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.admin-broadcast',
            with: [
                'emailBody' => $this->emailBody,
                'senderName' => $this->senderName,
                'appUrl' => config('app.url'),
            ],
        );
    }
}
