<?php

declare(strict_types=1);

namespace Tests\Feature\Fhir;

use App\Models\App\FhirConnection;
use App\Models\User;
use App\Services\Fhir\FhirJwksService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FhirJwksEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_jwks_endpoint_is_public_and_returns_keys_array(): void
    {
        // No auth header — must be reachable without a token (like /health).
        $response = $this->getJson('/api/fhir/jwks.json')
            ->assertStatus(200);

        $this->assertIsArray($response->json('keys'));
        $response->assertHeader('Cache-Control');
    }

    public function test_jwks_exposes_active_connection_public_key(): void
    {
        $resource = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        $pem = '';
        openssl_pkey_export($resource, $pem);

        $owner = User::factory()->create();

        $conn = FhirConnection::create([
            'site_name' => 'Test EHR',
            'site_key' => 'test-ehr',
            'ehr_vendor' => 'epic',
            'fhir_base_url' => 'https://ehr.example.org/api/FHIR/R4',
            'token_endpoint' => 'https://ehr.example.org/oauth2/token',
            'client_id' => 'test-client-id',
            'private_key_pem' => $pem, // 'encrypted' cast stores it encrypted at rest.
            'is_active' => true,
            'created_by' => $owner->id,
        ]);

        $service = app(FhirJwksService::class);
        $expectedKid = $service->kidForConnection($conn);

        $this->assertNotNull($expectedKid);

        $response = $this->getJson('/api/fhir/jwks.json')
            ->assertStatus(200);

        $kids = array_column($response->json('keys'), 'kid');
        $this->assertContains($expectedKid, $kids);

        // The published key must be a public-only JWK (no private 'd' member).
        $key = collect($response->json('keys'))->firstWhere('kid', $expectedKid);
        $this->assertSame('RSA', $key['kty']);
        $this->assertSame('sig', $key['use']);
        $this->assertSame('RS384', $key['alg']);
        $this->assertArrayNotHasKey('d', $key);
        $this->assertSame('AQAB', $key['e']);
    }

    public function test_jwks_excludes_inactive_connections(): void
    {
        $resource = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        $pem = '';
        openssl_pkey_export($resource, $pem);

        $owner = User::factory()->create();

        $conn = FhirConnection::create([
            'site_name' => 'Inactive EHR',
            'site_key' => 'inactive-ehr',
            'ehr_vendor' => 'epic',
            'fhir_base_url' => 'https://ehr.example.org/api/FHIR/R4',
            'token_endpoint' => 'https://ehr.example.org/oauth2/token',
            'client_id' => 'inactive-client-id',
            'private_key_pem' => $pem,
            'is_active' => false,
            'created_by' => $owner->id,
        ]);

        $service = app(FhirJwksService::class);
        $kid = $service->kidForConnection($conn);

        $response = $this->getJson('/api/fhir/jwks.json')
            ->assertStatus(200);

        $kids = array_column($response->json('keys'), 'kid');
        $this->assertNotContains($kid, $kids);
    }
}
