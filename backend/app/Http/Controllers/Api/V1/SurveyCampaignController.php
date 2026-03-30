<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\Api\StoreSurveyCampaignRequest;
use App\Models\Survey\SurveyCampaign;
use App\Services\Survey\CampaignSeedService;
use App\Services\Survey\SurveyImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;

class SurveyCampaignController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SurveyCampaign::query()
            ->with(['instrument:id,name,abbreviation', 'creator:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        $page = $query->paginate(min($request->integer('per_page', 25), 100));

        $page->setCollection(
            $page->getCollection()->map(function (SurveyCampaign $campaign): array {
                return [
                    ...$campaign->toArray(),
                    'stats' => $this->buildStats($campaign),
                ];
            })
        );

        return response()->json($page);
    }

    public function store(
        StoreSurveyCampaignRequest $request,
        CampaignSeedService $campaignSeedService,
    ): JsonResponse {
        $campaign = SurveyCampaign::create([
            ...$request->validated(),
            'created_by' => $request->user()?->id,
        ]);

        $seeded = $campaignSeedService->seed($campaign);

        return response()->json($campaign->fresh(['instrument:id,name,abbreviation', 'creator:id,name']), 201);
    }

    public function show(SurveyCampaign $campaign): JsonResponse
    {
        $campaign->load(['instrument', 'creator:id,name']);

        return response()->json([
            ...$campaign->toArray(),
            'stats' => $this->buildStats($campaign),
        ]);
    }

    public function update(StoreSurveyCampaignRequest $request, SurveyCampaign $campaign): JsonResponse
    {
        if ($campaign->status !== 'draft') {
            return response()->json([
                'message' => 'Only draft campaigns can be updated.',
            ], 422);
        }

        $campaign->update($request->validated());

        return response()->json($campaign->fresh(['instrument:id,name,abbreviation', 'creator:id,name']));
    }

    public function destroy(SurveyCampaign $campaign): JsonResponse
    {
        $campaign->delete();

        return response()->json(null, 204);
    }

    public function activate(SurveyCampaign $campaign): JsonResponse
    {
        if ($campaign->status !== 'draft') {
            return response()->json([
                'message' => 'Only draft campaigns can be activated.',
            ], 422);
        }

        $campaign->update([
            'status' => 'active',
            'publish_token' => $campaign->publish_token ?: Str::random(64),
        ]);

        return response()->json($campaign->fresh());
    }

    public function close(SurveyCampaign $campaign): JsonResponse
    {
        if ($campaign->status !== 'active') {
            return response()->json([
                'message' => 'Only active campaigns can be closed.',
            ], 422);
        }

        $campaign->update([
            'status' => 'closed',
            'closed_at' => now(),
        ]);

        return response()->json($campaign->fresh());
    }

    public function stats(SurveyCampaign $campaign): JsonResponse
    {
        return response()->json($this->buildStats($campaign));
    }

    public function import(
        Request $request,
        SurveyCampaign $campaign,
        SurveyImportService $surveyImportService,
    ): JsonResponse {
        $validated = $request->validate([
            'csv_content' => 'required|string',
        ]);

        $result = $surveyImportService->importCsv(
            $campaign->loadMissing('instrument.items.answerOptions'),
            $validated['csv_content'],
        );

        return response()->json([
            'data' => $result,
        ]);
    }

    /**
     * @return array<string, int|float>
     */
    private function buildStats(SurveyCampaign $campaign): array
    {
        $base = $campaign->conductRecords();
        $seededTotal = (clone $base)->whereNotNull('person_id')->count();
        $complete = (clone $base)->whereNotNull('person_id')->where('completion_status', 'complete')->count();
        $pending = (clone $base)->whereNotNull('person_id')->where('completion_status', 'pending')->count();
        $anonymous = (clone $base)->whereNull('person_id')->count();

        return [
            'seeded_total' => $seededTotal,
            'complete' => $complete,
            'pending' => $pending,
            'anonymous' => $anonymous,
            'completion_rate' => $seededTotal > 0 ? round(($complete / $seededTotal) * 100, 2) : 0.0,
        ];
    }
}
