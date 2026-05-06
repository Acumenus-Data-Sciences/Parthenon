<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Services\GIS\CohortGeographyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * @group GIS Explorer
 */
class GisCohortGeographyController extends Controller
{
    public function __construct(
        private readonly CohortGeographyService $cohortGeography,
    ) {}

    public function cohorts(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:120'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $source = $this->resolveSource($request, $validated['source_id'] ?? null);

        return response()->json([
            'data' => $this->cohortGeography->generatedCohorts(
                $source,
                $validated['search'] ?? null,
                (int) ($validated['limit'] ?? 25),
            ),
        ]);
    }

    public function conditions(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:120'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $source = $this->resolveSource($request, $validated['source_id'] ?? null);

        return response()->json([
            'data' => $this->cohortGeography->conditions(
                $source,
                $validated['search'] ?? null,
                (int) ($validated['limit'] ?? 25),
            ),
        ]);
    }

    public function coverage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => ['nullable', 'integer'],
            'state_fips' => ['nullable', 'string', 'size:2'],
        ]);

        $source = $this->resolveSource($request, $validated['source_id'] ?? null);

        return response()->json([
            'data' => $this->cohortGeography->coverage(
                $source,
                $validated['state_fips'] ?? '42',
            ),
        ]);
    }

    public function aggregate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => ['nullable', 'integer'],
            'mode' => ['required', Rule::in(['generated', 'condition'])],
            'cohort_definition_id' => ['required_if:mode,generated', 'nullable', 'integer'],
            'concept_id' => ['required_if:mode,condition', 'nullable', 'integer'],
            'level' => ['nullable', Rule::in(['county', 'tract'])],
            'metric' => ['nullable', Rule::in(['members', 'prevalence_per_1000'])],
            'min_cell_count' => ['nullable', 'integer', 'min:0', 'max:100'],
            'state_fips' => ['nullable', 'string', 'size:2'],
        ]);

        $source = $this->resolveSource($request, $validated['source_id'] ?? null);
        $mode = (string) $validated['mode'];
        $targetId = $mode === 'generated'
            ? (int) $validated['cohort_definition_id']
            : (int) $validated['concept_id'];

        return response()->json([
            'data' => $this->cohortGeography->aggregate(
                $source,
                $mode,
                $targetId,
                $validated['level'] ?? 'county',
                $validated['metric'] ?? 'members',
                (int) ($validated['min_cell_count'] ?? 5),
                $validated['state_fips'] ?? '42',
            ),
        ]);
    }

    private function resolveSource(Request $request, int|string|null $sourceId): Source
    {
        $query = Source::with('daimons');

        if ($request->user() !== null) {
            $query->visibleToUser($request->user());
        }

        if ($sourceId !== null) {
            return $query->whereKey((int) $sourceId)->firstOrFail();
        }

        $default = (clone $query)->where('source_key', 'ACUMENUS')->first();
        if ($default instanceof Source) {
            return $default;
        }

        return $query->orderBy('source_name')->firstOrFail();
    }
}
