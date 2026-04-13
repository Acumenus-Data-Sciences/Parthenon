<?php

declare(strict_types=1);

use App\Http\Middleware\EnforceFinnGenIdempotency;
use App\Models\User;
use App\Services\FinnGen\FinnGenIdempotencyStore;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

function finngenIdemRedisAvailable(): bool
{
    try {
        return Redis::connection()->ping() !== false;
    } catch (Throwable $e) {
        return false;
    }
}

function makeIdemRequest(?int $userId = null, string $content = '{"analysis_type":"co2.codewas"}', ?string $idemKey = 'test-key-1'): Request
{
    $request = Request::create('/api/v1/finngen/runs', 'POST', [], [], [], [], $content);
    if ($idemKey !== null) {
        $request->headers->set('Idempotency-Key', $idemKey);
    }
    if ($userId !== null) {
        $user = User::find($userId);
        $request->setUserResolver(fn () => $user);
    }

    return $request;
}

beforeEach(function () {
    try {
        $keys = Redis::connection()->keys('finngen:idem:*');
        foreach ((array) $keys as $k) {
            Redis::connection()->del($k);
        }
    } catch (Throwable $e) {
        // Redis unavailable — individual tests will skip.
    }

    $this->seed(FinnGenTestingSeeder::class);
    $this->user = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();

    config(['finngen.idempotency_ttl_seconds' => 60]);
    $this->middleware = app(EnforceFinnGenIdempotency::class);
});

it('first request succeeds and caches response', function () {
    $request = makeIdemRequest($this->user->id);

    $response = $this->middleware->handle($request, fn () => new JsonResponse(['id' => 'run_abc'], 201));

    expect($response->getStatusCode())->toBe(201);
    $claim = Redis::connection()->get("finngen:idem:{$this->user->id}:test-key-1");
    expect($claim)->not->toBeNull()->not->toBeFalse();
    $cached = Redis::connection()->get("finngen:idem:{$this->user->id}:test-key-1:response");
    expect($cached)->toContain('run_abc');
})->skip(fn () => ! finngenIdemRedisAvailable(), 'Redis not available');

it('replays the cached response on identical second request', function () {
    $request1 = makeIdemRequest($this->user->id);
    $this->middleware->handle($request1, fn () => new JsonResponse(['id' => 'run_abc'], 201));

    $calledAgain = false;
    $request2 = makeIdemRequest($this->user->id);
    $response2 = $this->middleware->handle($request2, function () use (&$calledAgain) {
        $calledAgain = true;

        return new JsonResponse(['id' => 'DIFFERENT_RUN'], 201);
    });

    expect($calledAgain)->toBeFalse('downstream must NOT be invoked on replay');
    expect($response2->getContent())->toContain('run_abc');
    expect($response2->headers->get('Idempotent-Replay'))->toBe('true');
})->skip(fn () => ! finngenIdemRedisAvailable(), 'Redis not available');

it('returns 409 on conflict (same key, different body)', function () {
    $request1 = makeIdemRequest($this->user->id, '{"analysis_type":"co2.codewas"}');
    $this->middleware->handle($request1, fn () => new JsonResponse(['id' => 'run_abc'], 201));

    $request2 = makeIdemRequest($this->user->id, '{"analysis_type":"co2.overlaps"}');
    $response2 = $this->middleware->handle($request2, fn () => new JsonResponse(['id' => 'run_xyz'], 201));

    expect($response2->getStatusCode())->toBe(409);
    $body = json_decode((string) $response2->getContent(), true);
    expect($body['error']['code'])->toBe('FINNGEN_IDEMPOTENCY_CONFLICT');
})->skip(fn () => ! finngenIdemRedisAvailable(), 'Redis not available');

it('canonicalizes JSON — reordered keys still replay', function () {
    $request1 = makeIdemRequest($this->user->id, '{"analysis_type":"co2.codewas","source_key":"EUNOMIA"}');
    $this->middleware->handle($request1, fn () => new JsonResponse(['id' => 'run_abc'], 201));

    $request2 = makeIdemRequest($this->user->id, '{"source_key":"EUNOMIA","analysis_type":"co2.codewas"}');
    $calledAgain = false;
    $response2 = $this->middleware->handle($request2, function () use (&$calledAgain) {
        $calledAgain = true;

        return new JsonResponse(['id' => 'DIFFERENT'], 201);
    });

    expect($calledAgain)->toBeFalse();
    expect($response2->getContent())->toContain('run_abc');
})->skip(fn () => ! finngenIdemRedisAvailable(), 'Redis not available');

it('missing Idempotency-Key header passes through + logs telemetry', function () {
    Log::shouldReceive('info')
        ->once()
        ->with('finngen.idempotency.missing', Mockery::on(fn ($ctx) => $ctx['user_id'] === $this->user->id));

    $request = makeIdemRequest($this->user->id, idemKey: null);
    $response = $this->middleware->handle($request, fn () => new JsonResponse(['id' => 'run_abc'], 201));

    expect($response->getStatusCode())->toBe(201);
});

it('unauthenticated request passes through', function () {
    $request = makeIdemRequest(null);
    $response = $this->middleware->handle($request, fn () => new JsonResponse(['id' => 'run_abc'], 201));
    expect($response->getStatusCode())->toBe(201);
});

it('does NOT cache non-successful responses', function () {
    $request = makeIdemRequest($this->user->id, idemKey: 'fail-key');
    $this->middleware->handle($request, fn () => new JsonResponse(['error' => 'validation'], 422));

    $cached = Redis::connection()->get("finngen:idem:{$this->user->id}:fail-key:response");
    expect($cached === false || $cached === null)->toBeTrue();
})->skip(fn () => ! finngenIdemRedisAvailable(), 'Redis not available');

it('TTL is configurable via finngen.idempotency_ttl_seconds', function () {
    config(['finngen.idempotency_ttl_seconds' => 999]);
    app()->forgetInstance(FinnGenIdempotencyStore::class);
    app()->singleton(FinnGenIdempotencyStore::class, fn () => new FinnGenIdempotencyStore(999));
    $middleware = app(EnforceFinnGenIdempotency::class);

    $request = makeIdemRequest($this->user->id, idemKey: 'ttl-key');
    $middleware->handle($request, fn () => new JsonResponse(['id' => 'x'], 201));

    $ttl = Redis::connection()->ttl("finngen:idem:{$this->user->id}:ttl-key");
    expect($ttl)->toBeGreaterThan(900)->toBeLessThanOrEqual(999);
})->skip(fn () => ! finngenIdemRedisAvailable(), 'Redis not available');
