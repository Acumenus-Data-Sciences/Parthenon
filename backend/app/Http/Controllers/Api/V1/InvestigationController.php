<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Investigation\SaveDomainStateRequest;
use App\Http\Requests\Investigation\StoreInvestigationRequest;
use App\Http\Requests\Investigation\UpdateInvestigationRequest;
use App\Models\App\Investigation;
use App\Models\User;
use App\Services\Investigation\InvestigationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Studies
 */
class InvestigationController extends Controller
{
    public function __construct(
        private readonly InvestigationService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $status = $request->query('status');

        $paginated = $this->service->listForUser(
            $user->id,
            is_string($status) ? $status : null,
        );

        return response()->json([
            'data' => $paginated->items(),
            'total' => $paginated->total(),
            'current_page' => $paginated->currentPage(),
            'per_page' => $paginated->perPage(),
            'last_page' => $paginated->lastPage(),
        ]);
    }

    public function store(StoreInvestigationRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $investigation = $this->service->create($user->id, $request->validated());

        return response()->json($investigation, 201);
    }

    public function show(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $investigation->load(['pins', 'owner:id,name']);

        return response()->json(['data' => $investigation]);
    }

    public function update(UpdateInvestigationRequest $request, Investigation $investigation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $updated = $this->service->update($investigation, $request->validated(), $user->id);

        return response()->json(['data' => $updated]);
    }

    public function destroy(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $this->service->delete($investigation);

        return response()->json(null, 204);
    }

    public function saveDomainState(SaveDomainStateRequest $request, Investigation $investigation, string $domain): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $validDomains = ['phenotype', 'clinical', 'genomic', 'synthesis'];
        if (! in_array($domain, $validDomains, true)) {
            return response()->json(['error' => 'Invalid domain: '.$domain], 422);
        }

        $updated = $this->service->saveDomainState(
            $investigation,
            $domain,
            $request->validated()['state'],
            $user->id,
        );

        return response()->json([
            'data' => [
                'saved_at' => $updated->updated_at,
                'domain' => $domain,
            ],
        ]);
    }
}
