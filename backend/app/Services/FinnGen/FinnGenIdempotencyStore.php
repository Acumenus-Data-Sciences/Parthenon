<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use Illuminate\Redis\Connections\Connection;
use Illuminate\Support\Facades\Redis;

/**
 * Thin Redis SETNX wrapper for Idempotency-Key replay / conflict detection.
 * All keys live under namespace finngen:idem:{composite} + :response for the
 * cached response body.
 *
 * Outage-tolerance: callers should try/catch around these methods and degrade
 * open. This class does NOT degrade internally — we want telemetry on outages.
 */
class FinnGenIdempotencyStore
{
    public function __construct(
        private readonly int $ttlSeconds,
    ) {}

    /**
     * Attempt to claim the idempotency key for this user + fingerprint.
     *
     * @return 'fresh'|'replay'|'conflict'
     *                                     - 'fresh': first time seen; caller should proceed and (later) cache the response
     *                                     - 'replay': already seen with same fingerprint; caller should serve cached response
     *                                     - 'conflict': key seen with a DIFFERENT fingerprint; caller should 409
     */
    public function tryClaim(string $composite, string $fingerprint): string
    {
        $redis = $this->redis();
        // Use the underlying client (PhpRedis or Predis) so we can pass the
        // SET key value EX ttl NX form. The Laravel Connection::set() signature
        // only exposes the 3-arg variant.
        /** @var mixed $result */
        $result = $redis->client()->set($this->keyFor($composite), $fingerprint, ['NX', 'EX' => $this->ttlSeconds]);

        // Redis SET ... NX returns (bool) true / false, or (string) 'OK' / null depending on client.
        $claimed = ($result === true || $result === 'OK');
        if ($claimed) {
            return 'fresh';
        }

        $existingFingerprint = $redis->get($this->keyFor($composite));
        if ($existingFingerprint === false || $existingFingerprint === null) {
            // Race: key expired between SETNX and GET — treat as fresh; next caller
            // will set it cleanly. In practice vanishingly rare.
            return 'fresh';
        }

        return $existingFingerprint === $fingerprint ? 'replay' : 'conflict';
    }

    /**
     * Cache the successful response body for the composite key. TTL matches
     * the claim's TTL so the pair evicts together.
     */
    public function cacheResponse(string $composite, string $responseBody): void
    {
        $this->redis()->setex($this->responseKey($composite), $this->ttlSeconds, $responseBody);
    }

    public function peekResponse(string $composite): ?string
    {
        $value = $this->redis()->get($this->responseKey($composite));

        return is_string($value) && $value !== '' ? $value : null;
    }

    private function redis(): Connection
    {
        return Redis::connection();
    }

    private function keyFor(string $composite): string
    {
        return "finngen:idem:{$composite}";
    }

    private function responseKey(string $composite): string
    {
        return "finngen:idem:{$composite}:response";
    }
}
