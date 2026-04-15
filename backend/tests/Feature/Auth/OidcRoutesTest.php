<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Services\Auth\Oidc\OidcHandshakeStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class OidcRoutesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['admin', 'super-admin', 'researcher', 'viewer'] as $name) {
            Role::findOrCreate($name, 'web');
        }
    }

    public function test_redirect_returns_404_when_disabled(): void
    {
        config(['services.oidc.enabled' => false]);
        $this->get('/api/v1/auth/oidc/redirect')->assertStatus(404);
    }

    public function test_callback_returns_404_when_disabled(): void
    {
        config(['services.oidc.enabled' => false]);
        $this->get('/api/v1/auth/oidc/callback?state=x&code=y')->assertStatus(404);
    }

    public function test_exchange_returns_404_when_disabled(): void
    {
        config(['services.oidc.enabled' => false]);
        $this->postJson('/api/v1/auth/oidc/exchange', ['code' => 'x'])->assertStatus(404);
    }

    public function test_redirect_issues_302_with_pkce_when_enabled(): void
    {
        $this->enableOidc();
        $this->fakeDiscovery();

        $response = $this->get('/api/v1/auth/oidc/redirect');

        $response->assertStatus(302);
        $location = $response->headers->get('Location');
        $this->assertIsString($location);
        $this->assertStringContainsString('auth.example.com/application/o/authorize/', $location);
        $this->assertStringContainsString('state=', $location);
        $this->assertStringContainsString('nonce=', $location);
        $this->assertStringContainsString('code_challenge=', $location);
        $this->assertStringContainsString('code_challenge_method=S256', $location);
    }

    public function test_callback_rejects_missing_state(): void
    {
        $this->enableOidc();
        $response = $this->get('/api/v1/auth/oidc/callback?code=abc');
        $response->assertStatus(400)->assertJson(['error' => 'oidc_failed', 'reason' => 'missing_parameters']);
    }

    public function test_callback_rejects_unknown_state(): void
    {
        $this->enableOidc();
        $response = $this->get('/api/v1/auth/oidc/callback?state=never-issued&code=abc');
        $response->assertStatus(400)->assertJson(['error' => 'oidc_failed', 'reason' => 'unknown_state']);
    }

    public function test_exchange_rejects_missing_code(): void
    {
        $this->enableOidc();
        $this->postJson('/api/v1/auth/oidc/exchange', [])
            ->assertStatus(400)->assertJson(['error' => 'oidc_failed', 'reason' => 'missing_code']);
    }

    public function test_exchange_rejects_unknown_code(): void
    {
        $this->enableOidc();
        $this->postJson('/api/v1/auth/oidc/exchange', ['code' => 'never-issued'])
            ->assertStatus(400)->assertJson(['error' => 'oidc_failed', 'reason' => 'unknown_code']);
    }

    public function test_exchange_happy_path_returns_token_and_user(): void
    {
        $this->enableOidc();

        $user = User::factory()->create();
        $user->assignRole('admin');
        $token = $user->createToken('auth-token')->plainTextToken;

        /** @var OidcHandshakeStore $store */
        $store = app(OidcHandshakeStore::class);
        $code = $store->putCode($user->id, $token);

        $this->postJson('/api/v1/auth/oidc/exchange', ['code' => $code])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'roles', 'must_change_password']])
            ->assertJson(['token' => $token, 'user' => ['id' => $user->id, 'email' => $user->email]]);
    }

    public function test_exchange_code_is_single_use(): void
    {
        $this->enableOidc();

        $user = User::factory()->create();
        $token = $user->createToken('auth-token')->plainTextToken;

        /** @var OidcHandshakeStore $store */
        $store = app(OidcHandshakeStore::class);
        $code = $store->putCode($user->id, $token);

        $this->postJson('/api/v1/auth/oidc/exchange', ['code' => $code])->assertOk();
        $this->postJson('/api/v1/auth/oidc/exchange', ['code' => $code])
            ->assertStatus(400)->assertJson(['reason' => 'unknown_code']);
    }

    private function enableOidc(): void
    {
        config([
            'services.oidc.enabled' => true,
            'services.oidc.client_id' => 'test-client',
            'services.oidc.client_secret' => 'test-secret',
            'services.oidc.redirect_uri' => 'http://localhost/api/v1/auth/oidc/callback',
            'services.oidc.discovery_url' => 'https://auth.example.com/application/o/parthenon-oidc/.well-known/openid-configuration',
        ]);
    }

    private function fakeDiscovery(): void
    {
        Http::fake([
            'auth.example.com/application/o/parthenon-oidc/.well-known/openid-configuration' => Http::response([
                'issuer' => 'https://auth.example.com/application/o/parthenon-oidc/',
                'authorization_endpoint' => 'https://auth.example.com/application/o/authorize/',
                'token_endpoint' => 'https://auth.example.com/application/o/token/',
                'jwks_uri' => 'https://auth.example.com/application/o/parthenon-oidc/jwks/',
            ]),
            'auth.example.com/application/o/parthenon-oidc/jwks/' => Http::response([
                'keys' => [],
            ]),
        ]);
    }
}
