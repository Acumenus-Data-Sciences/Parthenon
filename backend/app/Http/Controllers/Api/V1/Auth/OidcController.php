<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\Oidc\Exceptions\OidcAccessDeniedException;
use App\Services\Auth\Oidc\Exceptions\OidcException;
use App\Services\Auth\Oidc\Exceptions\OidcTokenInvalidException;
use App\Services\Auth\Oidc\OidcDiscoveryService;
use App\Services\Auth\Oidc\OidcHandshakeStore;
use App\Services\Auth\Oidc\OidcReconciliationService;
use App\Services\Auth\Oidc\OidcTokenValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authentik OIDC auth controller: redirect → callback → exchange.
 *
 * All three routes 404 when `services.oidc.enabled` is false.
 * Sanctum tokens never appear in a URL: the callback stores a fresh
 * token under a one-time code, redirects the SPA to /auth/callback?code=X,
 * and the SPA POSTs the code to /auth/oidc/exchange to retrieve it.
 */
class OidcController extends Controller
{
    public function redirect(
        Request $request,
        OidcHandshakeStore $store,
        OidcDiscoveryService $discovery,
    ): Response {
        $this->ensureEnabled();

        try {
            $authorize = $discovery->authorizationEndpoint();
        } catch (OidcException $e) {
            return $this->oidcError('discovery_failed', $e, 503);
        }

        $nonce = Str::random(32);
        $codeVerifier = $this->generateCodeVerifier();
        $state = $store->putState([
            'nonce' => $nonce,
            'code_verifier' => $codeVerifier,
        ]);

        $params = [
            'response_type' => 'code',
            'client_id' => (string) config('services.oidc.client_id'),
            'redirect_uri' => (string) config('services.oidc.redirect_uri'),
            'scope' => implode(' ', (array) config('services.oidc.scopes', ['openid', 'profile', 'email'])),
            'state' => $state,
            'nonce' => $nonce,
            'code_challenge' => $this->deriveCodeChallenge($codeVerifier),
            'code_challenge_method' => 'S256',
        ];

        return redirect()->away($authorize.'?'.http_build_query($params));
    }

    public function callback(
        Request $request,
        OidcHandshakeStore $store,
        OidcDiscoveryService $discovery,
        OidcTokenValidator $validator,
        OidcReconciliationService $reconciler,
    ): RedirectResponse|JsonResponse {
        $this->ensureEnabled();

        $state = (string) $request->query('state', '');
        $authCode = (string) $request->query('code', '');

        if ($state === '' || $authCode === '') {
            return $this->oidcError('missing_parameters', null, 400);
        }

        $meta = $store->consumeState($state);
        if ($meta === null) {
            return $this->oidcError('unknown_state', null, 400);
        }

        try {
            $tokenResponse = Http::asForm()->post($discovery->tokenEndpoint(), [
                'grant_type' => 'authorization_code',
                'code' => $authCode,
                'redirect_uri' => (string) config('services.oidc.redirect_uri'),
                'client_id' => (string) config('services.oidc.client_id'),
                'client_secret' => (string) config('services.oidc.client_secret'),
                'code_verifier' => $meta['code_verifier'],
            ]);
        } catch (\Throwable $e) {
            return $this->oidcError('token_exchange_failed', $e, 502);
        }

        if ($tokenResponse->failed()) {
            return $this->oidcError('token_exchange_failed', null, 502);
        }

        $idToken = (string) ($tokenResponse->json('id_token') ?? '');
        if ($idToken === '') {
            return $this->oidcError('missing_id_token', null, 502);
        }

        try {
            $claims = $validator->validate($idToken, $meta['nonce']);
        } catch (OidcTokenInvalidException $e) {
            return $this->oidcError($e->reason, $e, 401);
        }

        try {
            $result = $reconciler->reconcile($claims);
        } catch (OidcAccessDeniedException $e) {
            return $this->oidcError($e->reason, $e, 403);
        }

        $user = $result['user'];

        // Match the local login behavior: replace any existing auth-token.
        $user->tokens()->where('name', 'auth-token')->delete();
        $token = $user->createToken('auth-token')->plainTextToken;
        $user->forceFill(['last_login_at' => now()])->save();

        // Store the Sanctum token behind a one-time code; SPA exchanges.
        $code = $store->putCode($user->id, $token);

        $frontend = rtrim((string) config('app.url'), '/');

        return redirect()->away($frontend.'/auth/callback?code='.urlencode($code));
    }

    public function exchange(Request $request, OidcHandshakeStore $store): JsonResponse
    {
        $this->ensureEnabled();

        $code = (string) $request->input('code', '');
        if ($code === '') {
            return response()->json(['error' => 'oidc_failed', 'reason' => 'missing_code'], 400);
        }

        $payload = $store->consumeCode($code);
        if ($payload === null) {
            return response()->json(['error' => 'oidc_failed', 'reason' => 'unknown_code'], 400);
        }

        $user = User::query()->find($payload['user_id']);
        if ($user === null) {
            return response()->json(['error' => 'oidc_failed', 'reason' => 'user_missing'], 400);
        }

        return response()->json([
            'token' => $payload['token'],
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => $user->roles->pluck('name'),
                'must_change_password' => (bool) $user->must_change_password,
            ],
        ]);
    }

    private function ensureEnabled(): void
    {
        if (! (bool) config('services.oidc.enabled', false)) {
            abort(404);
        }
    }

    private function oidcError(string $reason, ?\Throwable $e, int $status): JsonResponse
    {
        if ($e !== null) {
            Log::warning('OIDC failure', [
                'reason' => $reason,
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);
        }

        return response()->json(['error' => 'oidc_failed', 'reason' => $reason], $status);
    }

    private function generateCodeVerifier(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    }

    private function deriveCodeChallenge(string $verifier): string
    {
        return rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
    }
}
