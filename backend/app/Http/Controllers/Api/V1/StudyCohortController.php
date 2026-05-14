<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\LibraryStatus;
use App\Exceptions\RequiresPromotionException;
use App\Http\Controllers\Controller;
use App\Models\App\CohortDefinition;
use App\Models\App\Study;
use App\Models\App\StudyCohort;
use App\Scopes\LibraryDefaultScope;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * @group Studies
 */
class StudyCohortController extends Controller
{
    /**
     * GET /v1/studies/{study}/cohorts
     *
     * List cohorts for a study.
     */
    public function index(Request $request, Study $study): JsonResponse
    {
        try {
            $cohorts = $study->cohorts()
                ->with('cohortDefinition')
                ->orderBy('sort_order')
                ->get();

            return response()->json([
                'data' => $cohorts,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve study cohorts', $e);
        }
    }

    /**
     * POST /v1/studies/{study}/cohorts
     *
     * Add a cohort to a study.
     */
    public function store(Request $request, Study $study): JsonResponse
    {
        $validated = $request->validate([
            'cohort_definition_id' => 'required|integer|exists:cohort_definitions,id',
            'role' => 'required|string|max:50',
            'label' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'concept_set_ids' => 'nullable|array',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        try {
            /** @var CohortDefinition $cohortDef */
            $cohortDef = CohortDefinition::query()
                ->withoutGlobalScope(LibraryDefaultScope::class)
                ->findOrFail($validated['cohort_definition_id']);

            if ($cohortDef->status === LibraryStatus::DRAFT) {
                if ((int) $cohortDef->author_id === (int) $request->user()->id) {
                    throw new RequiresPromotionException(
                        itemType: 'cohort_definition',
                        itemId: $cohortDef->id,
                        itemName: (string) $cohortDef->name,
                    );
                }
                abort(403, 'You cannot attach another user\'s draft cohort definition.');
            }

            if ($cohortDef->status === LibraryStatus::ARCHIVED) {
                $message = 'Cannot add an archived cohort to a study.';
                if ($cohortDef->supersededByCohort) {
                    $message .= " Use \"{$cohortDef->supersededByCohort->name}\" (ID: {$cohortDef->superseded_by}) instead.";
                }

                return response()->json(['message' => $message], 422);
            }

            $cohort = StudyCohort::create([
                ...$validated,
                'study_id' => $study->id,
            ]);

            $cohort->load('cohortDefinition');

            return response()->json([
                'data' => $cohort,
                'message' => 'Study cohort added.',
            ], 201);
        } catch (RequiresPromotionException $e) {
            throw $e;
        } catch (AuthorizationException|HttpException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to add study cohort', $e);
        }
    }

    /**
     * PUT /v1/studies/{study}/cohorts/{studyCohort}
     *
     * Update a study cohort.
     */
    public function update(Request $request, Study $study, StudyCohort $studyCohort): JsonResponse
    {
        if ((int) $studyCohort->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Cohort does not belong to this study.'], 404);
        }

        $validated = $request->validate([
            'cohort_definition_id' => 'sometimes|required|integer|exists:cohort_definitions,id',
            'role' => 'sometimes|required|string|max:50',
            'label' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'concept_set_ids' => 'nullable|array',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        try {
            $studyCohort->update($validated);

            return response()->json([
                'data' => $studyCohort->fresh('cohortDefinition'),
                'message' => 'Study cohort updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update study cohort', $e);
        }
    }

    /**
     * DELETE /v1/studies/{study}/cohorts/{studyCohort}
     *
     * Remove a cohort from a study.
     */
    public function destroy(Study $study, StudyCohort $studyCohort): JsonResponse
    {
        if ((int) $studyCohort->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Cohort does not belong to this study.'], 404);
        }

        try {
            $studyCohort->delete();

            return response()->json([
                'message' => 'Study cohort removed.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to remove study cohort', $e);
        }
    }

    /**
     * Build a standardized error response for database/service failures.
     */
    private function errorResponse(string $message, \Throwable $exception): JsonResponse
    {
        $response = [
            'error' => $message,
            'message' => $exception->getMessage(),
        ];

        if (config('app.debug')) {
            $response['trace'] = $exception->getTraceAsString();
        }

        return response()->json($response, 500);
    }
}
