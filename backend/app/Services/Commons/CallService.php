<?php

namespace App\Services\Commons;

use App\Events\Commons\CallUpdated;
use App\Models\App\SystemSetting;
use App\Models\Commons\Call;
use App\Models\Commons\Channel;
use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Str;
use RuntimeException;

class CallService
{
    public function getActiveCall(Channel $channel): ?Call
    {
        return Call::active()
            ->where('channel_id', $channel->id)
            ->with('starter:id,name')
            ->latest('started_at')
            ->first();
    }

    public function start(Channel $channel, User $user, string $callType = 'video'): Call
    {
        $existing = $this->getActiveCall($channel);
        if ($existing) {
            return $existing;
        }

        $call = Call::create([
            'channel_id' => $channel->id,
            'room_name' => sprintf('commons-%d-%s', $channel->id, Str::lower(Str::random(10))),
            'call_type' => $callType,
            'status' => 'active',
            'started_by' => $user->id,
            'started_at' => now(),
        ]);

        $call->load('starter:id,name');

        app(ActivityService::class)->log(
            eventType: 'call_started',
            title: "{$user->name} started a {$callType} call",
            channelId: $channel->id,
            userId: $user->id,
            description: "Live call is now active in #{$channel->slug}",
            metadata: ['call_id' => $call->id, 'call_type' => $callType],
        );

        broadcast(new CallUpdated($channel->id, $call, 'started'))->toOthers();

        return $call;
    }

    public function end(Call $call, User $user): Call
    {
        $call->update([
            'status' => 'ended',
            'ended_by' => $user->id,
            'ended_at' => now(),
        ]);

        $call->load('starter:id,name');

        app(ActivityService::class)->log(
            eventType: 'call_ended',
            title: "{$user->name} ended the call",
            channelId: $call->channel_id,
            userId: $user->id,
            description: 'Live call has ended',
            metadata: ['call_id' => $call->id, 'call_type' => $call->call_type],
        );

        broadcast(new CallUpdated($call->channel_id, null, 'ended'))->toOthers();

        return $call;
    }

    /** @return array{token:string, server_url:string} */
    public function issueToken(Call $call, User $user): array
    {
        [$serverUrl, $apiKey, $apiSecret] = $this->resolveLiveKitConfig();

        if ($serverUrl === '' || $apiKey === '' || $apiSecret === '') {
            throw new RuntimeException('LiveKit is not configured');
        }

        $now = time();
        $identity = sprintf('parthenon-user-%d', $user->id);
        $payload = [
            'iss' => $apiKey,
            'sub' => $identity,
            'nbf' => $now,
            'exp' => $now + 3600,
            'video' => [
                'roomJoin' => true,
                'room' => $call->room_name,
                'canPublish' => true,
                'canSubscribe' => true,
                'canPublishData' => true,
            ],
            'metadata' => json_encode([
                'user_id' => $user->id,
                'name' => $user->name,
                'channel_id' => $call->channel_id,
            ], JSON_THROW_ON_ERROR),
            'name' => $user->name,
        ];

        return [
            'token' => JWT::encode($payload, $apiSecret, 'HS256'),
            'server_url' => $serverUrl,
        ];
    }

    /**
     * Resolve LiveKit config: DB settings first, then .env fallback.
     *
     * @return array{0: string, 1: string, 2: string}
     */
    private function resolveLiveKitConfig(): array
    {
        $provider = SystemSetting::getValue('livekit_provider');

        if ($provider !== null && $provider !== 'env') {
            $url = rtrim((string) (SystemSetting::getValue('livekit_url') ?? ''), '/');
            $key = (string) (SystemSetting::getValue('livekit_api_key') ?? '');
            $secret = (string) (SystemSetting::getValue('livekit_api_secret') ?? '');

            if ($url !== '' && $key !== '' && $secret !== '') {
                return [$url, $key, $secret];
            }
        }

        return [
            rtrim((string) Config::get('services.livekit.url', ''), '/'),
            (string) Config::get('services.livekit.api_key', ''),
            (string) Config::get('services.livekit.api_secret', ''),
        ];
    }
}
