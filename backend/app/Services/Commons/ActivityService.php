<?php

namespace App\Services\Commons;

use App\Models\Commons\Activity;

class ActivityService
{
    public function log(
        string $eventType,
        string $title,
        ?int $channelId = null,
        ?int $userId = null,
        ?string $description = null,
        ?string $referenceableType = null,
        ?int $referenceableId = null,
        ?array $metadata = null,
    ): Activity {
        return Activity::create([
            'channel_id' => $channelId,
            'user_id' => $userId,
            'event_type' => $eventType,
            'title' => $title,
            'description' => $description,
            'referenceable_type' => $referenceableType,
            'referenceable_id' => $referenceableId,
            'metadata' => $metadata,
        ]);
    }
}
