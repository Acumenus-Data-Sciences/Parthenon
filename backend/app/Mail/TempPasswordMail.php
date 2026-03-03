<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Sends a temporary password to a newly registered user.
 *
 * Mail driver is configured via MAIL_MAILER in .env.
 * For Resend: set MAIL_MAILER=resend and RESEND_API_KEY=your-key
 * For development: MAIL_MAILER=log (password appears in storage/logs/laravel.log)
 */
class TempPasswordMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $userName,
        public readonly string $tempPassword,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your Parthenon access credentials',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.temp-password',
            with: [
                'userName' => $this->userName,
                'tempPassword' => $this->tempPassword,
                'appUrl' => config('app.url'),
            ],
        );
    }
}
