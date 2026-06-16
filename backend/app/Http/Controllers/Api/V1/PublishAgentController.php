<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\AgentSession;
use App\Models\App\PublicationDraft;
use App\Models\User;
use App\Policies\PublicationDraftPolicy;
use App\Services\Agents\AgentProviderResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class PublishAgentController extends Controller
{
    // NOTE (C3 — closed in Phase 2): these abilities scope the minted Sanctum
    // token. As of Phase 2, the agent-reachable WRITE routes
    // (PATCH publish/drafts/{draft} and POST publish/drafts/{draft}/snapshots)
    // carry `abilities:publications.update` middleware, so the scoped token IS
    // enforced on writes — C3 is closed for the write path. Regular SPA users
    // are unaffected because their login tokens carry ['*'], which satisfies any
    // `abilities:` check.
    private const AGENT_ABILITIES = ['publications.view', 'publications.update'];

    private function aiBaseUrl(): string
    {
        return rtrim((string) config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * Verify the authenticated user may access the given draft.
     * Aborts with 401 if unauthenticated or 404 if the policy rejects access.
     */
    private function authorizeAccess(Request $request, PublicationDraft $draft): void
    {
        abort_unless($request->user() !== null, 401);
        abort_unless((new PublicationDraftPolicy)->view($request->user(), $draft), 404);
    }

    /**
     * Create a new agent session for a publication draft.
     *
     * POST /api/v1/publish/drafts/{draft}/agent/sessions
     */
    public function start(Request $request, PublicationDraft $draft): JsonResponse
    {
        $this->authorizeAccess($request, $draft);

        /** @var User $user */
        $user = $request->user();

        $agentSession = AgentSession::create([
            'profile' => 'publish',
            'subject_type' => 'publication_draft',
            'subject_id' => $draft->id,
            'user_id' => $user->id,
            'status' => 'active',
            'context_json' => [
                'draft_id' => $draft->id,
                'study_id' => $draft->study_id,
            ],
            'last_active_at' => now(),
        ]);

        $newToken = $user->createToken('publish-agent', self::AGENT_ABILITIES);
        $agentSession->update(['token_id' => $newToken->accessToken->id]);

        $channel = "private-publish.draft.{$draft->id}";

        // Internal call to python-ai (internal-only network, unauthenticated).
        // The scoped token travels in the body so the agent can call back to Laravel.
        $resp = Http::acceptJson()->post($this->aiBaseUrl().'/agent/sessions', [
            'profile' => 'publish',
            'agent_session_id' => $agentSession->id,
            'subject_id' => $draft->id,
            'channel' => $channel,
            'ingest_path' => "/api/v1/publish/drafts/{$draft->id}/agent/sessions/{$agentSession->id}/ingest",
            'scoped_token' => $newToken->plainTextToken,
            // Runtime provider override from agents.provider_mode (cloud/local/auto).
            'provider' => (new AgentProviderResolver)->resolveProvider(),
            'context' => [
                'draft_id' => $draft->id,
                'study_id' => $draft->study_id,
            ],
        ]);

        if ($resp->failed()) {
            // Revoke the just-minted scoped token — no agent process will consume it.
            $newToken->accessToken->delete();
            $agentSession->update(['status' => 'error', 'token_id' => null]);

            return response()->json(['message' => 'Agent service unavailable'], 503);
        }

        return response()->json([
            'data' => [
                'agent_session_id' => $agentSession->id,
                'channel_name' => $channel,
            ],
        ], 201);
    }

    /**
     * Forward a user message to the agent's turn endpoint.
     *
     * POST /api/v1/publish/drafts/{draft}/agent/sessions/{agentSession}/messages
     */
    public function message(Request $request, PublicationDraft $draft, AgentSession $agentSession): JsonResponse
    {
        $this->authorizeAccess($request, $draft);
        abort_unless(
            (int) $agentSession->subject_id === (int) $draft->id && $agentSession->profile === 'publish',
            404,
        );

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
     * Forward a human-approval decision to the agent (tool-use gate).
     *
     * POST /api/v1/publish/drafts/{draft}/agent/sessions/{agentSession}/approve
     */
    public function approve(Request $request, PublicationDraft $draft, AgentSession $agentSession): JsonResponse
    {
        $this->authorizeAccess($request, $draft);
        abort_unless(
            (int) $agentSession->subject_id === (int) $draft->id && $agentSession->profile === 'publish',
            404,
        );

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
     * Return a cost/token snapshot for an agent session.
     *
     * GET /api/v1/publish/drafts/{draft}/agent/sessions/{agentSession}/snapshot
     */
    public function snapshot(Request $request, PublicationDraft $draft, AgentSession $agentSession): JsonResponse
    {
        $this->authorizeAccess($request, $draft);
        abort_unless(
            (int) $agentSession->subject_id === (int) $draft->id && $agentSession->profile === 'publish',
            404,
        );

        return response()->json(['data' => [
            'agent_session_id' => $agentSession->id,
            'status' => $agentSession->status,
            'cost_usd' => $agentSession->cost_usd,
            'tokens_in' => $agentSession->tokens_in,
            'tokens_out' => $agentSession->tokens_out,
            'channel_name' => "private-publish.draft.{$draft->id}",
        ]]);
    }

    /**
     * Ingest cost/token telemetry from the python-ai agent (increments running totals).
     *
     * POST /api/v1/publish/drafts/{draft}/agent/sessions/{agentSession}/ingest
     */
    public function ingest(Request $request, PublicationDraft $draft, AgentSession $agentSession): JsonResponse
    {
        $this->authorizeAccess($request, $draft);
        abort_unless(
            (int) $agentSession->subject_id === (int) $draft->id && $agentSession->profile === 'publish',
            404,
        );

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
