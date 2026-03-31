<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $campaign->name }} survey invitation</title>
</head>
<body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; background: #f8fafc; padding: 24px;">
    <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #0f766e; margin: 0 0 12px;">
            Parthenon Survey Invitation
        </p>

        <h1 style="font-size: 24px; margin: 0 0 12px;">{{ $campaign->name }}</h1>

        <p style="margin: 0 0 16px;">
            You have been invited to complete a survey. Use the secure link below to open your personal survey session.
        </p>

        @if($campaign->description)
            <p style="margin: 0 0 16px; color: #4b5563;">
                {{ $campaign->description }}
            </p>
        @endif

        <p style="margin: 0 0 24px;">
            <a href="{{ $surveyUrl }}" style="display: inline-block; background: #0f766e; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600;">
                Open Survey
            </a>
        </p>

        <p style="margin: 0 0 8px; color: #4b5563;">
            This secure invitation expires
            <strong>{{ optional($invitation->expires_at)->timezone(config('app.timezone'))->toDayDateTimeString() ?? 'when the campaign closes' }}</strong>.
        </p>

        <p style="margin: 0; color: #6b7280; font-size: 13px;">
            Reference: {{ $invitation->token_last_four }}
        </p>
    </div>
</body>
</html>
