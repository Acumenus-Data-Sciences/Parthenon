<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\AuthProviderSetting;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Administration', weight: 220)]
class AuthProviderController extends Controller
{
    private const TYPES = ['ldap', 'oauth2', 'saml2', 'oidc'];

    public function index(): JsonResponse
    {
        return response()->json(
            AuthProviderSetting::orderBy('priority')->get()
        );
    }

    public function show(string $providerType): JsonResponse
    {
        $provider = AuthProviderSetting::where('provider_type', $providerType)->firstOrFail();

        return response()->json($provider);
    }

    public function update(Request $request, string $providerType): JsonResponse
    {
        $validated = $request->validate([
            'display_name' => 'sometimes|string|max:100',
            'is_enabled' => 'sometimes|boolean',
            'priority' => 'sometimes|integer|min:0',
            'settings' => 'sometimes|array',
        ]);

        $provider = AuthProviderSetting::where('provider_type', $providerType)->firstOrFail();

        if (isset($validated['settings'])) {
            // Merge with existing settings so partial updates don't wipe fields.
            $validated['settings'] = array_merge(
                $provider->settings ?? [],
                $validated['settings'],
            );
        }

        $provider->fill(array_merge($validated, ['updated_by' => $request->user()->id]));
        $provider->save();

        return response()->json($provider->fresh());
    }

    public function enable(Request $request, string $providerType): JsonResponse
    {
        $provider = AuthProviderSetting::where('provider_type', $providerType)->firstOrFail();
        $provider->update(['is_enabled' => true, 'updated_by' => $request->user()->id]);

        return response()->json($provider);
    }

    public function disable(Request $request, string $providerType): JsonResponse
    {
        $provider = AuthProviderSetting::where('provider_type', $providerType)->firstOrFail();
        $provider->update(['is_enabled' => false, 'updated_by' => $request->user()->id]);

        return response()->json($provider);
    }

    /**
     * Test connectivity for a provider without persisting settings.
     * Returns { success: bool, message: string, details?: object }.
     */
    public function test(Request $request, string $providerType): JsonResponse
    {
        $provider = AuthProviderSetting::where('provider_type', $providerType)->firstOrFail();

        $result = match ($providerType) {
            'ldap' => $this->testLdap($provider->settings ?? []),
            'oidc' => $this->testOidc($provider->settings ?? []),
            default => ['success' => false, 'message' => "Connection test not available for {$providerType}."],
        };

        return response()->json($result);
    }

    /** ── Private helpers ───────────────────────────────────────────────── */

    /** @param array<string, mixed> $cfg */
    private function testLdap(array $cfg): array
    {
        if (empty($cfg['host'])) {
            return ['success' => false, 'message' => 'LDAP host is not configured.'];
        }

        $host = $cfg['host'];
        $port = (int) ($cfg['port'] ?? 389);
        $timeout = (int) ($cfg['timeout'] ?? 5);

        $conn = @ldap_connect("ldap://{$host}:{$port}");

        if (! $conn) {
            return ['success' => false, 'message' => 'Could not create LDAP connection handle.'];
        }

        ldap_set_option($conn, LDAP_OPT_NETWORK_TIMEOUT, $timeout);
        ldap_set_option($conn, LDAP_OPT_PROTOCOL_VERSION, 3);

        $bound = @ldap_bind($conn, $cfg['bind_dn'] ?? null, $cfg['bind_password'] ?? null);

        if (! $bound) {
            return ['success' => false, 'message' => 'LDAP bind failed: '.ldap_error($conn)];
        }

        ldap_unbind($conn);

        return ['success' => true, 'message' => "Connected and bound to {$host}:{$port} successfully."];
    }

    /** @param array<string, mixed> $cfg */
    private function testOidc(array $cfg): array
    {
        if (empty($cfg['discovery_url'])) {
            return ['success' => false, 'message' => 'Discovery URL is not configured.'];
        }

        try {
            $response = \Illuminate\Support\Facades\Http::timeout(10)->get($cfg['discovery_url']);

            if ($response->failed()) {
                return ['success' => false, 'message' => "Discovery URL returned HTTP {$response->status()}."];
            }

            $doc = $response->json();

            return [
                'success' => true,
                'message' => 'OIDC discovery document fetched successfully.',
                'details' => [
                    'issuer' => $doc['issuer'] ?? null,
                    'authorization_endpoint' => $doc['authorization_endpoint'] ?? null,
                    'token_endpoint' => $doc['token_endpoint'] ?? null,
                ],
            ];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
