<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use App\Models\App\StudyDesignAgentSession;
use App\Models\App\StudyDesignSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class StudyDesignAgentController extends Controller
{
    // NOTE (review C3 — known Phase-1 gap): these abilities scope the minted
    // Sanctum token, but the study-design routes the agent calls are gated by
    // Spatie `permission:` middleware (which checks the USER's permissions), not
    // Sanctum `abilities:` middleware (which checks the TOKEN's abilities). So the
    // agent currently acts with the user's FULL permission set, not this subset —
    // "cannot exceed the user" holds, but "scoped to studies.view+create" does NOT.
    // Phase 2 must add `abilities:studies.view`/`abilities:studies.create` (or
    // `$token->can(...)` checks) to the agent-reachable routes to enforce this.
    private const AGENT_ABILITIES = ['studies.view', 'studies.create'];

    private function aiBaseUrl(): string
    {
        return rtrim((string) config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    private function authorizeAccess(Request $request, Study $study, StudyDesignSession $session): void
    {
        abort_unless((int) $session->study_id === (int) $study->id, 404);
        abort_unless(
            Study::accessibleBy($request->user()->id)->whereKey($study->id)->exists(),
            403,
        );
    }

    public function start(Request $request, Study $study, StudyDesignSession $session): JsonResponse
    {
        $this->authorizeAccess($request, $study, $session);

        $validated = $request->validate(['version_id' => ['nullable', 'integer']]);

        $agentSession = StudyDesignAgentSession::create([
            'study_design_session_id' => $session->id,
            'study_design_version_id' => $validated['version_id'] ?? null,
            'user_id' => $request->user()->id,
            'status' => 'active',
            'last_active_at' => now(),
        ]);

        $newToken = $request->user()->createToken('study-designer-agent', self::AGENT_ABILITIES);
        $agentSession->update(['token_id' => $newToken->accessToken->id]);

        $channel = "private-study-design.session.{$session->id}";

        // Internal call to python-ai (internal-only network, unauthenticated —
        // same pattern as StudyIntentService). The scoped token travels in the body.
        $resp = Http::acceptJson()->post($this->aiBaseUrl().'/study-designer/sessions', [
            'profile' => 'study_design',
            'agent_session_id' => $agentSession->id,
            'study_slug' => $study->slug,
            'design_session_id' => $session->id,
            'version_id' => $validated['version_id'] ?? null,
            'scoped_token' => $newToken->plainTextToken,
            'channel' => $channel,
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

    public function message(Request $request, Study $study, StudyDesignSession $session, StudyDesignAgentSession $agentSession): JsonResponse
    {
        $this->authorizeAccess($request, $study, $session);
        abort_unless((int) $agentSession->study_design_session_id === (int) $session->id, 404);

        $validated = $request->validate([
            'text' => ['required', 'string', 'max:8000'],
            'idempotency_key' => ['required', 'string', 'max:128'],
        ]);

        $agentSession->update(['last_active_at' => now()]);

        $resp = Http::acceptJson()->post($this->aiBaseUrl()."/study-designer/sessions/{$agentSession->id}/turn", [
            'text' => $validated['text'],
            'idempotency_key' => $validated['idempotency_key'],
        ]);

        if ($resp->failed()) {
            return response()->json(['message' => 'Agent service unavailable'], 503);
        }

        return response()->json(['data' => ['accepted' => true]], 202);
    }

    public function snapshot(Request $request, Study $study, StudyDesignSession $session, StudyDesignAgentSession $agentSession): JsonResponse
    {
        $this->authorizeAccess($request, $study, $session);
        abort_unless((int) $agentSession->study_design_session_id === (int) $session->id, 404);

        return response()->json(['data' => [
            'agent_session_id' => $agentSession->id,
            'status' => $agentSession->status,
            'cost_usd' => $agentSession->cost_usd,
            'tokens_in' => $agentSession->tokens_in,
            'tokens_out' => $agentSession->tokens_out,
            'channel_name' => "private-study-design.session.{$session->id}",
        ]]);
    }

    public function ingest(Request $request, Study $study, StudyDesignSession $session, StudyDesignAgentSession $agentSession): JsonResponse
    {
        $this->authorizeAccess($request, $study, $session);
        abort_unless((int) $agentSession->study_design_session_id === (int) $session->id, 404);

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
