<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\AgentSession;
use App\Models\App\Study;
use App\Models\User;
use App\Services\Agents\AgentProviderResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * Launches and drives a Abby orchestrator agent session for a study
 * (ADR-0020 Phase 5b). Mirrors the publish/study-design agent controllers:
 * mints a scoped Sanctum token, registers a session with the generic python-ai
 * harness under the `abby` profile, and relays turns / approvals.
 *
 * The scoped token only needs the abilities the abby tool pack uses: reading
 * study + gate state, evaluating gates, and building a study package.
 */
class AbbyAgentController extends Controller
{
    /** @var list<string> */
    private const AGENT_ABILITIES = ['studies.view', 'studies.execute', 'studies.create'];

    private function aiBaseUrl(): string
    {
        return rtrim((string) config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * A study's orchestration is reachable by its collaborators (creator, PI,
     * lead data scientist, lead statistician, team member) or an admin.
     */
    private function authorizeAccess(Request $request, Study $study): void
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $isCollaborator = Study::query()
            ->whereKey($study->id)
            ->accessibleBy($user->id)
            ->exists();

        abort_unless($isCollaborator || $user->hasRole(['admin', 'super-admin']), 404);
    }

    private function assertSessionBelongs(Study $study, AgentSession $agentSession): void
    {
        abort_unless(
            (int) $agentSession->subject_id === (int) $study->id && $agentSession->profile === 'abby',
            404,
        );
    }

    /**
     * POST /api/v1/studies/{study}/agent/sessions
     */
    public function start(Request $request, Study $study): JsonResponse
    {
        $this->authorizeAccess($request, $study);

        /** @var User $user */
        $user = $request->user();

        $agentSession = AgentSession::create([
            'profile' => 'abby',
            'subject_type' => 'study',
            'subject_id' => $study->id,
            'user_id' => $user->id,
            'status' => 'active',
            'context_json' => [
                'study_slug' => $study->slug,
                'study_id' => $study->id,
            ],
            'last_active_at' => now(),
        ]);

        $newToken = $user->createToken('abby-agent', self::AGENT_ABILITIES);
        $agentSession->update(['token_id' => $newToken->accessToken->id]);

        $channel = "private-abby.study.{$study->id}";

        $resp = Http::acceptJson()->post($this->aiBaseUrl().'/agent/sessions', [
            'profile' => 'abby',
            'agent_session_id' => $agentSession->id,
            'subject_id' => $study->id,
            'channel' => $channel,
            'ingest_path' => "/api/v1/studies/{$study->slug}/agent/sessions/{$agentSession->id}/ingest",
            'scoped_token' => $newToken->plainTextToken,
            // Runtime provider override from the super-admin's agents.provider_mode
            // (cloud=Anthropic / local=claude-router proxy). python-ai treats this
            // as authoritative over its AGENT_PROVIDER env default.
            'provider' => (new AgentProviderResolver)->resolveProvider(),
            'context' => [
                'study_slug' => $study->slug,
                'study_id' => $study->id,
            ],
        ]);

        if ($resp->failed()) {
            $newToken->accessToken->delete();
            $agentSession->update(['status' => 'error', 'token_id' => null]);

            return response()->json(['message' => 'Agent service unavailable'], 503);
        }

        return response()->json([
            'data' => [
                'agent_session_id' => $agentSession->id,
                'channel_name' => $channel,
                // Effective provider + whether approval-gated WRITE actions are
                // available, so the dock hides action affordances on a reads-only
                // CE deployment. Defaults preserve EE behavior if absent.
                'provider' => $resp->json('provider', 'anthropic'),
                'actions_enabled' => $resp->json('actions_enabled', true),
            ],
        ], 201);
    }

    /**
     * POST /api/v1/studies/{study}/agent/sessions/{agentSession}/messages
     */
    public function message(Request $request, Study $study, AgentSession $agentSession): JsonResponse
    {
        $this->authorizeAccess($request, $study);
        $this->assertSessionBelongs($study, $agentSession);

        $validated = $request->validate([
            'text' => ['required', 'string', 'max:8000'],
            'idempotency_key' => ['required', 'string', 'max:128'],
        ]);

        $agentSession->update(['last_active_at' => now()]);

        $resp = Http::acceptJson()->post($this->aiBaseUrl()."/agent/sessions/{$agentSession->id}/turn", [
            'text' => $validated['text'],
            'idempotency_key' => $validated['idempotency_key'],
        ]);

        if ($resp->failed()) {
            return response()->json(['message' => 'Agent service unavailable'], 503);
        }

        return response()->json(['data' => ['accepted' => true]], 202);
    }

    /**
     * POST /api/v1/studies/{study}/agent/sessions/{agentSession}/approve
     */
    public function approve(Request $request, Study $study, AgentSession $agentSession): JsonResponse
    {
        $this->authorizeAccess($request, $study);
        $this->assertSessionBelongs($study, $agentSession);

        $validated = $request->validate([
            'tool_use_id' => ['required', 'string', 'max:255'],
            'approved' => ['required', 'boolean'],
        ]);

        $resp = Http::acceptJson()->post($this->aiBaseUrl()."/agent/sessions/{$agentSession->id}/approve", [
            'tool_use_id' => $validated['tool_use_id'],
            'approved' => $validated['approved'],
        ]);

        if ($resp->failed()) {
            return response()->json(['message' => 'Agent service unavailable'], 503);
        }

        return response()->json(['data' => ['resolved' => true]], 200);
    }

    /**
     * GET /api/v1/studies/{study}/agent/sessions/{agentSession}/snapshot
     */
    public function snapshot(Request $request, Study $study, AgentSession $agentSession): JsonResponse
    {
        $this->authorizeAccess($request, $study);
        $this->assertSessionBelongs($study, $agentSession);

        return response()->json(['data' => [
            'agent_session_id' => $agentSession->id,
            'status' => $agentSession->status,
            'cost_usd' => $agentSession->cost_usd,
            'tokens_in' => $agentSession->tokens_in,
            'tokens_out' => $agentSession->tokens_out,
            'channel_name' => "private-abby.study.{$study->id}",
        ]]);
    }

    /**
     * POST /api/v1/studies/{study}/agent/sessions/{agentSession}/ingest
     *
     * Telemetry callback from the python-ai agent (increments running totals).
     */
    public function ingest(Request $request, Study $study, AgentSession $agentSession): JsonResponse
    {
        $this->authorizeAccess($request, $study);
        $this->assertSessionBelongs($study, $agentSession);

        $validated = $request->validate([
            'anthropic_session_id' => ['nullable', 'string', 'max:255'],
            'cost_usd' => ['required', 'numeric', 'min:0'],
            'tokens_in' => ['required', 'integer', 'min:0'],
            'tokens_out' => ['required', 'integer', 'min:0'],
            'status' => ['required', 'string', 'in:active,closed,error'],
        ]);

        $agentSession->update([
            'anthropic_session_id' => $validated['anthropic_session_id'] ?? $agentSession->anthropic_session_id,
            'cost_usd' => (float) $agentSession->cost_usd + (float) $validated['cost_usd'],
            'tokens_in' => (int) $agentSession->tokens_in + (int) $validated['tokens_in'],
            'tokens_out' => (int) $agentSession->tokens_out + (int) $validated['tokens_out'],
            'status' => $validated['status'],
            'last_active_at' => now(),
        ]);

        return response()->json(['data' => ['ok' => true]]);
    }
}
