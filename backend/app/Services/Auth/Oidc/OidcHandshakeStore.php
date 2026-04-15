<?php

namespace App\Services\Auth\Oidc;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Redis-backed store for the two transient OIDC handshake artifacts:
 *
 *  1. Outbound `state` (sent on /auth/oidc/redirect) -> {nonce, code_verifier}
 *     used to correlate the Authentik callback with the original request.
 *  2. One-time `code` (issued by /auth/oidc/callback) -> {user_id, token}
 *     used by the SPA to exchange for a Sanctum token without putting the
 *     token in a URL.
 *
 * Both artifacts are single-use: `consume*` reads and deletes atomically.
 */
class OidcHandshakeStore
{
    private const STATE_TTL = 300;   // 5 minutes

    private const CODE_TTL = 60;     // 1 minute

    private const STATE_PREFIX = 'oidc:state:';

    private const CODE_PREFIX = 'oidc:code:';

    /**
     * Create a state token and persist its associated nonce + PKCE verifier.
     * Returns the state string to include in the Authentik authorize URL.
     *
     * @param  array{nonce:string, code_verifier:string}  $meta
     */
    public function putState(array $meta): string
    {
        $state = Str::random(48);
        Cache::put(self::STATE_PREFIX.$state, $meta, self::STATE_TTL);

        return $state;
    }

    /**
     * Consume a previously issued state. Returns the stored metadata or null
     * if the state is unknown / already consumed / expired.
     *
     * @return array{nonce:string, code_verifier:string}|null
     */
    public function consumeState(string $state): ?array
    {
        /** @var array{nonce:string, code_verifier:string}|null $meta */
        $meta = Cache::pull(self::STATE_PREFIX.$state);

        return $meta;
    }

    /**
     * Issue a one-time code that maps to a fresh Sanctum token.
     * The SPA posts this code to /auth/oidc/exchange to retrieve
     * {token, user} without ever exposing the token in a URL.
     */
    public function putCode(int $userId, string $token): string
    {
        $code = Str::random(48);
        Cache::put(self::CODE_PREFIX.$code, [
            'user_id' => $userId,
            'token' => $token,
        ], self::CODE_TTL);

        return $code;
    }

    /**
     * Consume a one-time code. Returns {user_id, token} or null if invalid.
     *
     * @return array{user_id:int, token:string}|null
     */
    public function consumeCode(string $code): ?array
    {
        /** @var array{user_id:int, token:string}|null $payload */
        $payload = Cache::pull(self::CODE_PREFIX.$code);

        return $payload;
    }
}
