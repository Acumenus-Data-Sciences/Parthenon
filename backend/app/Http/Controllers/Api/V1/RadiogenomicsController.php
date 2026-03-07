<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\VariantDrugInteraction;
use App\Services\Radiogenomics\RadiogenomicsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RadiogenomicsController extends Controller
{
    public function __construct(
        private readonly RadiogenomicsService $service
    ) {}

    /**
     * GET /api/v1/radiogenomics/patients/{personId}
     *
     * Unified radiogenomics panel: variants + imaging + drugs + correlations + recommendations.
     */
    public function patientPanel(int $personId, Request $request): JsonResponse
    {
        $sourceId = $request->integer('source_id') ?: null;
        $panel = $this->service->getPatientPanel($personId, $sourceId);

        return response()->json(['data' => $panel]);
    }

    /**
     * GET /api/v1/radiogenomics/variant-drug-interactions
     *
     * Look up known variant-drug interactions from the curated database.
     */
    public function variantDrugInteractions(Request $request): JsonResponse
    {
        $query = VariantDrugInteraction::where('is_active', true);

        if ($gene = $request->string('gene')) {
            $query->where('gene_symbol', $gene);
        }
        if ($drug = $request->string('drug')) {
            $query->where('drug_name', 'ilike', "%{$drug}%");
        }
        if ($relationship = $request->string('relationship')) {
            $query->where('relationship', $relationship);
        }

        return response()->json([
            'data' => $query->orderBy('gene_symbol')->orderBy('drug_name')->get(),
        ]);
    }
}
