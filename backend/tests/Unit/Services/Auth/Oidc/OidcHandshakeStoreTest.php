<?php

namespace Tests\Unit\Services\Auth\Oidc;

use App\Services\Auth\Oidc\OidcHandshakeStore;
use Tests\TestCase;

class OidcHandshakeStoreTest extends TestCase
{
    private OidcHandshakeStore $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->store = new OidcHandshakeStore;
    }

    public function test_put_and_consume_state_round_trip(): void
    {
        $state = $this->store->putState(['nonce' => 'n-abc', 'code_verifier' => 'v-xyz']);
        $this->assertNotEmpty($state);

        $meta = $this->store->consumeState($state);
        $this->assertSame(['nonce' => 'n-abc', 'code_verifier' => 'v-xyz'], $meta);
    }

    public function test_state_is_single_use(): void
    {
        $state = $this->store->putState(['nonce' => 'n', 'code_verifier' => 'v']);
        $this->store->consumeState($state);
        $this->assertNull($this->store->consumeState($state));
    }

    public function test_consume_unknown_state_returns_null(): void
    {
        $this->assertNull($this->store->consumeState('never-issued'));
    }

    public function test_put_and_consume_code_round_trip(): void
    {
        $code = $this->store->putCode(42, 'plain-text-sanctum-token');
        $this->assertNotEmpty($code);

        $payload = $this->store->consumeCode($code);
        $this->assertSame(['user_id' => 42, 'token' => 'plain-text-sanctum-token'], $payload);
    }

    public function test_code_is_single_use(): void
    {
        $code = $this->store->putCode(1, 'tok');
        $this->store->consumeCode($code);
        $this->assertNull($this->store->consumeCode($code));
    }

    public function test_consume_unknown_code_returns_null(): void
    {
        $this->assertNull($this->store->consumeCode('never-issued'));
    }
}
