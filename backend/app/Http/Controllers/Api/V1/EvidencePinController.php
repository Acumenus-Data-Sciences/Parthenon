<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Investigation\StorePinRequest;
use App\Http\Requests\Investigation\UpdatePinRequest;
use App\Models\App\EvidencePin;
use App\Models\App\Investigation;
use App\Models\User;
use App\Services\Investigation\EvidencePinService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EvidencePinController extends Controller
{
    public function __construct(
        private readonly EvidencePinService $service,
    ) {}

    public function index(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $pins = $this->service->listForInvestigation($investigation->id);

        return response()->json(['data' => $pins]);
    }

    public function store(StorePinRequest $request, Investigation $investigation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $pin = $this->service->create($investigation, $request->validated());

        return response()->json($pin, 201);
    }

    public function update(UpdatePinRequest $request, Investigation $investigation, EvidencePin $pin): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id || $pin->investigation_id !== $investigation->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $updated = $this->service->update($pin, $request->validated());

        return response()->json(['data' => $updated]);
    }

    public function destroy(Request $request, Investigation $investigation, EvidencePin $pin): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id || $pin->investigation_id !== $investigation->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $this->service->delete($pin);

        return response()->json(null, 204);
    }
}
