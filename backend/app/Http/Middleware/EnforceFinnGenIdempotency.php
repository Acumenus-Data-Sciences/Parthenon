<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\FinnGen\FinnGenIdempotencyStore;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Spec §5.3 — Idempotency-Key middleware for POST /api/v1/finngen/runs.
 *
 * Outage-tolerance: if Redis is unavailable, degrade OPEN (accept requests
 * without dedupe) rather than blocking the feature. Emit telemetry so ops
 * can investigate.
 */
class EnforceFinnGenIdempotency
{
    public function __construct(
        private readonly FinnGenIdempotencyStore $store,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $userId = $user?->id;
        $idempotencyKey = $request->header('Idempotency-Key');

        // Pass-through paths
        if (! $userId) {
            return $next($request);
        }
        if (! is_string($idempotencyKey) || $idempotencyKey === '') {
            Log::info('finngen.idempotency.missing', [
                'user_id' => $userId,
                'route' => $request->path(),
            ]);

            return $next($request);
        }

        $composite = "{$userId}:{$idempotencyKey}";
        $fingerprint = $this->fingerprint($userId, $idempotencyKey, $request);

        try {
            $status = $this->store->tryClaim($composite, $fingerprint);
        } catch (Throwable $e) {
            Log::warning('finngen.idempotency.redis_down', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);

            return $next($request);
        }

        if ($status === 'conflict') {
            return new JsonResponse([
                'error' => [
                    'code' => 'FINNGEN_IDEMPOTENCY_CONFLICT',
                    'message' => 'A different request was already submitted with this Idempotency-Key.',
                ],
            ], 409);
        }

        if ($status === 'replay') {
            try {
                $cached = $this->store->peekResponse($composite);
            } catch (Throwable $e) {
                Log::warning('finngen.idempotency.redis_down', [
                    'user_id' => $userId,
                    'error' => $e->getMessage(),
                ]);

                return $next($request);
            }
            if ($cached !== null) {
                return new Response($cached, 200, [
                    'Content-Type' => 'application/json',
                    'Idempotent-Replay' => 'true',
                ]);
            }

            // Claim exists but response not yet cached — concurrent in-flight
            // request. Accept and let it proceed (cache will be populated).
            return $next($request);
        }

        /** @var Response $response */
        $response = $next($request);

        if ($response->isSuccessful()) {
            try {
                $this->store->cacheResponse($composite, (string) $response->getContent());
            } catch (Throwable $e) {
                Log::warning('finngen.idempotency.redis_down', [
                    'user_id' => $userId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $response;
    }

    private function fingerprint(int $userId, string $key, Request $request): string
    {
        $payload = $request->getContent();
        // Canonicalize by decoding + re-encoding with sorted keys — so
        // ['b'=>1,'a'=>2] and ['a'=>2,'b'=>1] hash the same.
        $decoded = json_decode($payload, true);
        if (is_array($decoded)) {
            $canonical = $this->canonicalJson($decoded);
        } else {
            $canonical = $payload;
        }

        return hash('sha256', "{$userId}:{$key}:{$canonical}");
    }

    /** @param  array<mixed>  $data */
    private function canonicalJson(array $data): string
    {
        $sort = function (&$v) use (&$sort) {
            if (is_array($v)) {
                // Only sort associative arrays; preserve list ordering
                if ($v !== [] && array_keys($v) !== range(0, count($v) - 1)) {
                    ksort($v);
                }
                foreach ($v as &$item) {
                    $sort($item);
                }
            }
        };
        $sort($data);

        return (string) json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
