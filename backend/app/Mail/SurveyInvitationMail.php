<?php

namespace App\Mail;

use App\Models\Survey\SurveyCampaign;
use App\Models\Survey\SurveyHonestBrokerInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SurveyInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly SurveyCampaign $campaign,
        public readonly SurveyHonestBrokerInvitation $invitation,
        public readonly string $surveyUrl,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->campaign->name.' survey invitation',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.survey-invitation',
            with: [
                'campaign' => $this->campaign,
                'invitation' => $this->invitation,
                'surveyUrl' => $this->surveyUrl,
            ],
        );
    }
}
