<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * Deterministic protocol-to-publication orchestration (ADR-0020 Phase 5).
 *
 * Distinct from AbbyAgentController (the conversational Claude Agent SDK
 * session): this drives the deterministic S1->S7 finite state machine in
 * python-ai (app/orchestrator), which walks the server-authoritative gate
 * ledger and halts at the first blocking gate. It mints a study-scoped Sanctum
 * token (ADR C3) and relays to python-ai. The default is a dry ledger walk;
 * the live staged execution requires an explicit `execute=true` and a source.
 */
class StudyOrchestratorController extends Controller
{
    /** @var list<string> */
    private const ORCHESTRATOR_ABILITIES = ['studies.view', 'studies.execute'];

    private function aiBaseUrl(): string
    {
        return rtrim((string) config('services.ai.url', 'http://python-ai:8000'), '/');
    }

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

    /**
     * POST /api/v1/studies/{study}/orchestrate
     */
    public function orchestrate(Request $request, Study $study): JsonResponse
    {
        $this->authorizeAccess($request, $study);

        $validated = $request->validate([
            'execute' => ['sometimes', 'boolean'],
            'source_id' => ['required_if:execute,true', 'nullable', 'integer', 'exists:sources,id'],
        ]);

        /** @var User $user */
        $user = $request->user();

        // Scoped token (ADR C3) — never exceeds the acting user's permissions.
        $newToken = $user->createToken('study-orchestrator', self::ORCHESTRATOR_ABILITIES);

        try {
            $resp = Http::acceptJson()->timeout(180)->post($this->aiBaseUrl().'/orchestrate/run', [
                'study_ref' => $study->slug,
                'scoped_token' => $newToken->plainTextToken,
                'source_id' => $validated['source_id'] ?? null,
                'execute' => (bool) ($validated['execute'] ?? false),
                'channel' => "private-abby.study.{$study->id}",
            ]);
        } finally {
            // The deterministic run is synchronous; the token is single-use.
            $newToken->accessToken->delete();
        }

        if ($resp->failed()) {
            return response()->json(['message' => 'Orchestrator service unavailable'], 503);
        }

        return response()->json(['data' => $resp->json()]);
    }
}
