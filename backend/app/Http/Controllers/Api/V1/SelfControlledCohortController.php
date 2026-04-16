<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Http\Controllers\Controller;
use App\Models\App\AnalysisExecution;
use App\Models\App\SelfControlledCohortAnalysis;
use App\Models\App\Source;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Self-Controlled Cohort
 */
class SelfControlledCohortController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SelfControlledCohortAnalysis::with('author:id,name,email')
            ->orderByDesc('updated_at');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('description', 'ilike', "%{$search}%");
            });
        }

        $analyses = $query->paginate($request->integer('per_page', 20));
        $analyses->getCollection()->transform(function (SelfControlledCohortAnalysis $analysis) {
            $analysis->setAttribute('latest_execution', $analysis->executions()
                ->orderByDesc('created_at')
                ->first(['id', 'status', 'source_id', 'started_at', 'completed_at', 'result_json']));

            return $analysis;
        });

        return response()->json($analyses);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'design_json' => ['required', 'array'],
            'design_json.exposureCohortId' => ['required', 'integer'],
            'design_json.outcomeCohortId' => ['required', 'integer'],
        ]);

        $analysis = SelfControlledCohortAnalysis::create([
            'name' => $request->input('name'),
            'description' => $request->input('description'),
            'design_json' => $request->input('design_json'),
            'author_id' => $request->user()->id,
        ]);

        return response()->json([
            'data' => $analysis->load('author:id,name,email'),
            'message' => 'Self-Controlled Cohort analysis created.',
        ], 201);
    }

    public function show(SelfControlledCohortAnalysis $selfControlledCohort): JsonResponse
    {
        return response()->json([
            'data' => $selfControlledCohort->load([
                'author:id,name,email',
                'executions' => fn ($query) => $query->orderByDesc('created_at')->limit(10),
                'executions.source:id,source_name,source_key',
            ]),
        ]);
    }

    public function update(Request $request, SelfControlledCohortAnalysis $selfControlledCohort): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'design_json' => ['sometimes', 'required', 'array'],
        ]);

        $selfControlledCohort->update($validated);

        return response()->json([
            'data' => $selfControlledCohort->fresh('author:id,name,email'),
            'message' => 'Self-controlled cohort analysis updated.',
        ]);
    }

    public function destroy(SelfControlledCohortAnalysis $selfControlledCohort): JsonResponse
    {
        $selfControlledCohort->delete();

        return response()->json(['message' => 'Self-controlled cohort analysis deleted.']);
    }

    public function execute(Request $request, SelfControlledCohortAnalysis $selfControlledCohort): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => ['required', 'integer', 'exists:sources,id'],
        ]);

        $source = Source::findOrFail($validated['source_id']);
        $execution = AnalysisExecution::create([
            'analysis_type' => SelfControlledCohortAnalysis::class,
            'analysis_id' => $selfControlledCohort->id,
            'source_id' => $source->id,
            'status' => ExecutionStatus::Queued,
            'started_at' => now(),
            'result_json' => [
                'engine' => 'SelfControlledCohort',
                'status' => 'queued',
                'message' => 'Execution queued for Darkstar/HADES worker.',
            ],
        ]);

        return response()->json([
            'data' => $execution,
            'message' => 'Self-Controlled Cohort execution queued.',
        ], 202);
    }

    public function executions(SelfControlledCohortAnalysis $selfControlledCohort): JsonResponse
    {
        return response()->json($selfControlledCohort->executions()
            ->with('source:id,source_name,source_key')
            ->orderByDesc('created_at')
            ->paginate(20));
    }

    public function showExecution(
        SelfControlledCohortAnalysis $selfControlledCohort,
        AnalysisExecution $execution,
    ): JsonResponse {
        if ((int) $execution->analysis_id !== (int) $selfControlledCohort->id
            || $execution->analysis_type !== SelfControlledCohortAnalysis::class) {
            return response()->json(['message' => 'Execution does not belong to this self-controlled cohort analysis.'], 404);
        }

        return response()->json([
            'data' => $execution->load([
                'source:id,source_name,source_key',
                'logs' => fn ($query) => $query->orderBy('created_at'),
            ]),
        ]);
    }
}
