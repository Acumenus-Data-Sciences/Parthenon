<?php

namespace Tests\Unit\Services\Auth\Oidc;

use App\Services\Auth\Oidc\Exceptions\OidcTokenInvalidException;
use App\Services\Auth\Oidc\OidcDiscoveryService;
use App\Services\Auth\Oidc\OidcTokenValidator;
use Firebase\JWT\JWT;
use Mockery;
use Tests\TestCase;

class OidcTokenValidatorTest extends TestCase
{
    private const ISSUER = 'https://auth.example.com/application/o/parthenon-oidc/';

    private const AUDIENCE = 'test-client-id';

    private const KID = 'kid-test-1';

    /** @var resource|\OpenSSLAsymmetricKey|false */
    private $privateKey;

    /** @var array{keys:list<array<string,mixed>>} */
    private array $jwks;

    private OidcDiscoveryService $discovery;

    protected function setUp(): void
    {
        parent::setUp();

        $res = openssl_pkey_new([
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
            'private_key_bits' => 2048,
        ]);
        if ($res === false) {
            $this->fail('openssl_pkey_new failed');
        }
        $this->privateKey = $res;

        $details = openssl_pkey_get_details($res);
        /** @var array{rsa: array{n:string, e:string}} $details */
        $this->jwks = [
            'keys' => [
                [
                    'kty' => 'RSA',
                    'kid' => self::KID,
                    'alg' => 'RS256',
                    'use' => 'sig',
                    'n' => $this->base64url($details['rsa']['n']),
                    'e' => $this->base64url($details['rsa']['e']),
                ],
            ],
        ];

        $this->discovery = Mockery::mock(OidcDiscoveryService::class);
        $this->discovery->shouldReceive('jwks')->andReturn($this->jwks);
        $this->discovery->shouldReceive('issuer')->andReturn(self::ISSUER);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_valid_token_returns_claims(): void
    {
        $token = $this->makeToken([
            'iss' => self::ISSUER,
            'aud' => self::AUDIENCE,
            'sub' => 'sub-123',
            'email' => 'sudoshi@acumenus.io',
            'name' => 'Sanjay Udoshi',
            'groups' => ['Parthenon Admins', 'authentik Admins'],
            'nonce' => 'n-1',
            'exp' => time() + 300,
            'iat' => time(),
        ]);

        $validator = new OidcTokenValidator($this->discovery, self::AUDIENCE);
        $claims = $validator->validate($token, 'n-1');

        $this->assertSame('sub-123', $claims->sub);
        $this->assertSame('sudoshi@acumenus.io', $claims->email);
        $this->assertSame('Sanjay Udoshi', $claims->name);
        $this->assertSame(['Parthenon Admins', 'authentik Admins'], $claims->groups);
    }

    public function test_expired_token_rejected(): void
    {
        $token = $this->makeToken([
            'iss' => self::ISSUER, 'aud' => self::AUDIENCE,
            'sub' => 's', 'email' => 'a@b', 'name' => 'n',
            'exp' => time() - 10, 'iat' => time() - 3600,
        ]);
        $this->expectException(OidcTokenInvalidException::class);
        (new OidcTokenValidator($this->discovery, self::AUDIENCE))->validate($token);
    }

    public function test_wrong_issuer_rejected(): void
    {
        $token = $this->makeToken([
            'iss' => 'https://evil.example.com/', 'aud' => self::AUDIENCE,
            'sub' => 's', 'email' => 'a@b', 'name' => 'n',
            'exp' => time() + 300, 'iat' => time(),
        ]);
        $this->expectException(OidcTokenInvalidException::class);
        (new OidcTokenValidator($this->discovery, self::AUDIENCE))->validate($token);
    }

    public function test_wrong_audience_rejected(): void
    {
        $token = $this->makeToken([
            'iss' => self::ISSUER, 'aud' => 'other-client',
            'sub' => 's', 'email' => 'a@b', 'name' => 'n',
            'exp' => time() + 300, 'iat' => time(),
        ]);
        $this->expectException(OidcTokenInvalidException::class);
        (new OidcTokenValidator($this->discovery, self::AUDIENCE))->validate($token);
    }

    public function test_wrong_nonce_rejected(): void
    {
        $token = $this->makeToken([
            'iss' => self::ISSUER, 'aud' => self::AUDIENCE,
            'sub' => 's', 'email' => 'a@b', 'name' => 'n',
            'nonce' => 'actual', 'exp' => time() + 300, 'iat' => time(),
        ]);
        $this->expectException(OidcTokenInvalidException::class);
        (new OidcTokenValidator($this->discovery, self::AUDIENCE))->validate($token, 'expected-different');
    }

    public function test_missing_required_claim_rejected(): void
    {
        $token = $this->makeToken([
            'iss' => self::ISSUER, 'aud' => self::AUDIENCE,
            'sub' => 's', 'email' => 'a@b',
            // name missing
            'exp' => time() + 300, 'iat' => time(),
        ]);
        $this->expectException(OidcTokenInvalidException::class);
        (new OidcTokenValidator($this->discovery, self::AUDIENCE))->validate($token);
    }

    /**
     * @param  array<string,mixed>  $payload
     */
    private function makeToken(array $payload): string
    {
        return JWT::encode($payload, $this->privateKey, 'RS256', self::KID);
    }

    private function base64url(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }
}
