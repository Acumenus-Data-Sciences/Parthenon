<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\HeorAnalysis;
use App\Models\App\HeorCostParameter;
use App\Models\App\HeorResult;
use App\Models\App\HeorScenario;
use App\Models\App\HeorValueContract;
use App\Services\Heor\HeorEconomicsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class HeorController extends Controller
{
    public function __construct(
        private readonly HeorEconomicsService $economics,
    ) {}

    // ──────────────────────────────────────────────────────────────────────────
    // Stats
    // ──────────────────────────────────────────────────────────────────────────

    public function stats(): JsonResponse
    {
        $userId = Auth::id();

        return response()->json([
            'data' => [
                'total_analyses' => HeorAnalysis::where('created_by', $userId)->count(),
                'completed_analyses' => HeorAnalysis::where('created_by', $userId)->where('status', 'completed')->count(),
                'total_contracts' => HeorValueContract::where('created_by', $userId)->count(),
                'by_type' => HeorAnalysis::where('created_by', $userId)
                    ->selectRaw('analysis_type, count(*) as n')
                    ->groupBy('analysis_type')
                    ->pluck('n', 'analysis_type'),
            ],
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Analyses CRUD
    // ──────────────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $analyses = HeorAnalysis::where('created_by', Auth::id())
            ->with('scenarios')
            ->orderByDesc('updated_at')
            ->paginate($request->integer('per_page', 20));

        return response()->json($analyses);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'analysis_type' => 'required|string|in:cea,cba,cua,budget_impact,roi',
            'description' => 'nullable|string',
            'perspective' => 'nullable|string|in:payer,societal,provider,patient',
            'time_horizon' => 'nullable|string|in:1_year,5_year,10_year,lifetime',
            'discount_rate' => 'nullable|numeric|min:0|max:0.2',
            'currency' => 'nullable|string|max:10',
            'source_id' => 'nullable|integer|exists:sources,id',
            'target_cohort_id' => 'nullable|integer',
            'comparator_cohort_id' => 'nullable|integer',
        ]);

        $analysis = HeorAnalysis::create([
            ...$validated,
            'created_by' => Auth::id(),
        ]);

        return response()->json(['data' => $analysis->load('scenarios')], 201);
    }

    public function show(HeorAnalysis $analysis): JsonResponse
    {
        $this->authorizeOwner($analysis);

        $analysis->load(['scenarios.result', 'parameters']);

        return response()->json(['data' => $analysis]);
    }

    public function update(Request $request, HeorAnalysis $analysis): JsonResponse
    {
        $this->authorizeOwner($analysis);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'perspective' => 'nullable|string|in:payer,societal,provider,patient',
            'time_horizon' => 'nullable|string|in:1_year,5_year,10_year,lifetime',
            'discount_rate' => 'nullable|numeric|min:0|max:0.2',
            'target_cohort_id' => 'nullable|integer',
            'comparator_cohort_id' => 'nullable|integer',
        ]);

        $analysis->update($validated);

        return response()->json(['data' => $analysis]);
    }

    public function destroy(HeorAnalysis $analysis): JsonResponse
    {
        $this->authorizeOwner($analysis);
        $analysis->delete();

        return response()->json(null, 204);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Scenarios
    // ──────────────────────────────────────────────────────────────────────────

    public function indexScenarios(HeorAnalysis $analysis): JsonResponse
    {
        $this->authorizeOwner($analysis);

        return response()->json(['data' => $analysis->scenarios()->with('result')->get()]);
    }

    public function storeScenario(Request $request, HeorAnalysis $analysis): JsonResponse
    {
        $this->authorizeOwner($analysis);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'scenario_type' => 'nullable|string|in:intervention,comparator,sensitivity',
            'description' => 'nullable|string',
            'parameter_overrides' => 'nullable|array',
            'is_base_case' => 'boolean',
            'sort_order' => 'nullable|integer',
        ]);

        if ($validated['is_base_case'] ?? false) {
            $analysis->scenarios()->update(['is_base_case' => false]);
        }

        $scenario = $analysis->scenarios()->create($validated);

        return response()->json(['data' => $scenario], 201);
    }

    public function updateScenario(Request $request, HeorAnalysis $analysis, HeorScenario $scenario): JsonResponse
    {
        $this->authorizeOwner($analysis);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'parameter_overrides' => 'nullable|array',
            'is_base_case' => 'boolean',
            'sort_order' => 'nullable|integer',
        ]);

        if ($validated['is_base_case'] ?? false) {
            $analysis->scenarios()->where('id', '!=', $scenario->id)->update(['is_base_case' => false]);
        }

        $scenario->update($validated);

        return response()->json(['data' => $scenario]);
    }

    public function destroyScenario(HeorAnalysis $analysis, HeorScenario $scenario): JsonResponse
    {
        $this->authorizeOwner($analysis);
        $scenario->delete();

        return response()->json(null, 204);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Cost Parameters
    // ──────────────────────────────────────────────────────────────────────────

    public function indexParameters(HeorAnalysis $analysis): JsonResponse
    {
        $this->authorizeOwner($analysis);

        return response()->json(['data' => $analysis->parameters()->orderBy('parameter_type')->get()]);
    }

    public function storeParameter(Request $request, HeorAnalysis $analysis): JsonResponse
    {
        $this->authorizeOwner($analysis);

        $validated = $request->validate([
            'parameter_name' => 'required|string|max:200',
            'parameter_type' => 'required|string|in:drug_cost,admin_cost,hospitalization,er_visit,qaly_weight,utility_value,resource_use,avoided_cost,program_cost',
            'value' => 'required|numeric',
            'unit' => 'nullable|string|max:50',
            'lower_bound' => 'nullable|numeric',
            'upper_bound' => 'nullable|numeric',
            'distribution' => 'nullable|string|in:normal,gamma,beta,log_normal,uniform',
            'scenario_id' => 'nullable|integer|exists:heor_scenarios,id',
            'omop_concept_id' => 'nullable|integer',
            'source_reference' => 'nullable|string',
        ]);

        $param = $analysis->parameters()->create($validated);

        return response()->json(['data' => $param], 201);
    }

    public function updateParameter(Request $request, HeorAnalysis $analysis, HeorCostParameter $parameter): JsonResponse
    {
        $this->authorizeOwner($analysis);

        $validated = $request->validate([
            'value' => 'sometimes|numeric',
            'lower_bound' => 'nullable|numeric',
            'upper_bound' => 'nullable|numeric',
            'source_reference' => 'nullable|string',
        ]);

        $parameter->update($validated);

        return response()->json(['data' => $parameter]);
    }

    public function destroyParameter(HeorAnalysis $analysis, HeorCostParameter $parameter): JsonResponse
    {
        $this->authorizeOwner($analysis);
        $parameter->delete();

        return response()->json(null, 204);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Run / Results
    // ──────────────────────────────────────────────────────────────────────────

    public function run(HeorAnalysis $analysis): JsonResponse
    {
        $this->authorizeOwner($analysis);

        if ($analysis->scenarios()->count() === 0) {
            return response()->json(['message' => 'Analysis has no scenarios. Add at least one scenario before running.'], 422);
        }

        $result = $this->economics->runAnalysis($analysis);

        return response()->json(['data' => $result]);
    }

    public function results(HeorAnalysis $analysis): JsonResponse
    {
        $this->authorizeOwner($analysis);

        $results = HeorResult::where('analysis_id', $analysis->id)
            ->with('scenario')
            ->get();

        return response()->json(['data' => $results]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Value-Based Contracts
    // ──────────────────────────────────────────────────────────────────────────

    public function indexContracts(Request $request): JsonResponse
    {
        $contracts = HeorValueContract::where('created_by', Auth::id())
            ->orderByDesc('updated_at')
            ->get();

        return response()->json(['data' => $contracts]);
    }

    public function storeContract(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'analysis_id' => 'required|integer|exists:heor_analyses,id',
            'contract_name' => 'required|string|max:255',
            'drug_name' => 'nullable|string|max:200',
            'contract_type' => 'nullable|string|in:outcomes_based,amortized,warranty',
            'outcome_metric' => 'required|string|max:100',
            'baseline_rate' => 'nullable|numeric|min:0',
            'rebate_tiers' => 'nullable|array',
            'rebate_tiers.*.threshold' => 'required|numeric|min:0|max:1',
            'rebate_tiers.*.rebate_percent' => 'required|numeric|min:0|max:100',
            'list_price' => 'nullable|numeric|min:0',
            'net_price_floor' => 'nullable|numeric|min:0',
            'measurement_period_months' => 'nullable|integer|min:1',
            'effective_date' => 'nullable|date',
        ]);

        $contract = HeorValueContract::create([
            ...$validated,
            'created_by' => Auth::id(),
        ]);

        return response()->json(['data' => $contract], 201);
    }

    public function showContract(HeorValueContract $contract): JsonResponse
    {
        return response()->json(['data' => $contract]);
    }

    public function updateContract(Request $request, HeorValueContract $contract): JsonResponse
    {
        $validated = $request->validate([
            'contract_name' => 'sometimes|string|max:255',
            'rebate_tiers' => 'nullable|array',
            'list_price' => 'nullable|numeric|min:0',
            'status' => 'nullable|string|in:draft,active,expired',
            'effective_date' => 'nullable|date',
        ]);

        $contract->update($validated);

        return response()->json(['data' => $contract]);
    }

    public function destroyContract(HeorValueContract $contract): JsonResponse
    {
        $contract->delete();

        return response()->json(null, 204);
    }

    /**
     * POST /api/v1/heor/contracts/{contract}/simulate-rebate
     * Compute rebate given an observed outcome rate.
     */
    public function simulateRebate(Request $request, HeorValueContract $contract): JsonResponse
    {
        $validated = $request->validate([
            'observed_rate' => 'required|numeric|min:0',
        ]);

        if (! $contract->rebate_tiers || ! $contract->list_price) {
            return response()->json(['message' => 'Contract missing rebate_tiers or list_price'], 422);
        }

        $result = $this->economics->computeContractRebate(
            (float) $contract->list_price,
            (float) $validated['observed_rate'],
            (float) ($contract->baseline_rate ?? 0),
            $contract->rebate_tiers
        );

        return response()->json(['data' => $result]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private function authorizeOwner(HeorAnalysis $analysis): void
    {
        if ($analysis->created_by !== Auth::id()) {
            abort(403, 'Access denied.');
        }
    }
}
