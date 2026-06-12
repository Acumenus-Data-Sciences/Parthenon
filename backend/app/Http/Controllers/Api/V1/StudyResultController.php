<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use App\Models\App\StudyResult;
use App\Models\User;
use App\Services\Shiny\ManagedShinyAppRegistry;
use App\Services\Shiny\ManagedShinyLaunchService;
use App\Services\Studies\StudyResultProjector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * @group Studies
 */
class StudyResultController extends Controller
{
    public function __construct(
        private readonly ManagedShinyAppRegistry $shinyAppRegistry,
        private readonly ManagedShinyLaunchService $shinyLaunches,
    ) {}

    /**
     * GET /v1/studies/{study}/results
     */
    public function index(Request $request, Study $study): JsonResponse
    {
        $query = $study->results()
            ->with(['execution', 'site.source:id,source_name', 'reviewedByUser:id,name,email'])
            ->orderByDesc('created_at');

        if ($request->filled('result_type')) {
            $query->where('result_type', $request->input('result_type'));
        }

        if ($request->filled('site_id')) {
            $query->where('site_id', $request->input('site_id'));
        }

        if ($request->boolean('publishable_only')) {
            $query->where('is_publishable', true);
        }

        $results = $query->paginate($request->integer('per_page', 50));
        $results->getCollection()->transform(fn (StudyResult $result): array => $this->presentResult($result));

        return response()->json($results);
    }

    /**
     * GET /v1/studies/{study}/results/{result}
     */
    public function show(Study $study, StudyResult $result): JsonResponse
    {
        if ((int) $result->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Result does not belong to this study.'], 404);
        }

        $result->load(['execution', 'site.source:id,source_name', 'reviewedByUser:id,name,email']);

        return response()->json(['data' => $this->presentResult($result)]);
    }

    /**
     * PUT /v1/studies/{study}/results/{result}
     *
     * Update review status and publishability flags.
     */
    public function update(Request $request, Study $study, StudyResult $result): JsonResponse
    {
        if ((int) $result->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Result does not belong to this study.'], 404);
        }

        $validated = $request->validate([
            'is_primary' => 'sometimes|boolean',
            'is_publishable' => 'sometimes|boolean',
        ]);

        if ($request->boolean('is_publishable') && ! $result->reviewed_by) {
            $validated['reviewed_by'] = $request->user()?->id;
            $validated['reviewed_at'] = now();
        }

        $result->update($validated);

        $fresh = $result->fresh(['execution', 'site.source:id,source_name', 'reviewedByUser:id,name,email']);

        return response()->json([
            'data' => $fresh instanceof StudyResult ? $this->presentResult($fresh) : $result->fresh(),
            'message' => 'Result updated.',
        ]);
    }

    /**
     * POST /v1/studies/{study}/results/{result}/shiny-launch
     *
     * Create a launch envelope for a managed OHDSI Shiny viewer from a native
     * Parthenon result page.
     */
    public function launchShiny(Request $request, Study $study, StudyResult $result): JsonResponse
    {
        if ((int) $result->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Result does not belong to this study.'], 404);
        }

        $validated = $request->validate([
            'app_key' => ['nullable', 'string', 'max:120'],
            'mode' => ['nullable', 'string', Rule::in(['embedded', 'full_page'])],
        ]);

        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'data' => $this->shinyLaunches->createForResult(
                $study,
                $result,
                $user,
                $validated['app_key'] ?? null,
                $validated['mode'] ?? 'embedded',
            ),
        ]);
    }

    /**
     * POST /v1/studies/{study}/results/reproject
     *
     * Re-project the study's curated `study_results` from the latest completed
     * analysis executions and the current gate ledger. Idempotent and
     * non-destructive: reviewer curation (is_primary) is preserved and only the
     * publishability of comparative effect estimates moves with the gate state.
     * Exposed so the Abby copilot can refresh results after a gate evaluation
     * (an approval-gated action) — and a reviewer can force a manual refresh.
     */
    public function reproject(Study $study, StudyResultProjector $projector): JsonResponse
    {
        $count = $projector->projectStudy($study);

        return response()->json([
            'data' => ['reprojected' => $count],
            'message' => "Re-projected {$count} result row(s) from the latest completed executions.",
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function presentResult(StudyResult $result): array
    {
        $payload = $result->toArray();
        $payload['managed_shiny_apps'] = $this->shinyAppRegistry->appsForResult($result);

        return $payload;
    }
}
