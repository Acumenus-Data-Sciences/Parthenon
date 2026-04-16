<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Http\Requests\FinnGen\CreateWorkbenchSessionRequest;
use App\Http\Requests\FinnGen\UpdateWorkbenchSessionRequest;
use App\Services\FinnGen\WorkbenchSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * SP4 Phase A — Cohort Workbench session CRUD.
 *
 * Routes are protected by auth:sanctum + permission:finngen.workbench.use at
 * the route layer; ownership is enforced inside this controller (a researcher
 * can only see and mutate their own sessions). No role escalation possible.
 */
class WorkbenchSessionController extends Controller
{
    public function __construct(
        private readonly WorkbenchSessionService $sessions,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $sourceKey = $request->query('source_key');
        $sourceKey = is_string($sourceKey) ? $sourceKey : null;

        return response()->json([
            'data' => $this->sessions->listForUser($userId, $sourceKey),
        ]);
    }

    public function show(Request $request, string $session): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $found = $this->sessions->findForUser($session, $userId);
        if ($found === null) {
            throw new NotFoundHttpException('Workbench session not found');
        }

        return response()->json(['data' => $found]);
    }

    public function store(CreateWorkbenchSessionRequest $request): JsonResponse
    {
        $data = $request->validated();
        $created = $this->sessions->create(
            userId: (int) $request->user()->id,
            sourceKey: (string) $data['source_key'],
            name: (string) $data['name'],
            description: isset($data['description']) ? (string) $data['description'] : null,
            sessionState: is_array($data['session_state'] ?? null) ? $data['session_state'] : [],
            schemaVersion: (int) ($data['schema_version'] ?? 1),
        );

        return response()->json(['data' => $created], 201);
    }

    public function update(UpdateWorkbenchSessionRequest $request, string $session): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $found = $this->sessions->findForUser($session, $userId);
        if ($found === null) {
            throw new NotFoundHttpException('Workbench session not found');
        }

        $updated = $this->sessions->update($found, $request->validated());

        return response()->json(['data' => $updated]);
    }

    public function destroy(Request $request, string $session): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $found = $this->sessions->findForUser($session, $userId);
        if ($found === null) {
            throw new NotFoundHttpException('Workbench session not found');
        }

        $this->sessions->delete($found);

        return response()->json(['data' => null], 204);
    }
}
