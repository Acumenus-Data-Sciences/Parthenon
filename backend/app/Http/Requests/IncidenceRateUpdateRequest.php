<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the body of PATCH /api/v1/incidence-rates/{id}.
 *
 * Phase 19 (GIS-03 / D-09 / W-04): mirrors IncidenceRateStoreRequest and
 * authorizes on `analyses.create` to match the existing route middleware
 * group (see routes/api.php). Splitting to `analyses.edit` would require
 * a coordinated route + permission + RBAC migration that is out of scope
 * for this plan.
 */
class IncidenceRateUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('analyses.create') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'sometimes|required|array',
            'design_json.targetCohortId' => 'required_with:design_json|integer',
            'design_json.outcomeCohortIds' => 'required_with:design_json|array|min:1',
            'design_json.outcomeCohortIds.*' => 'integer',
            'design_json.timeAtRisk' => 'nullable|array',
            'design_json.timeAtRisk.start' => 'nullable|array',
            'design_json.timeAtRisk.start.dateField' => 'nullable|string|in:StartDate,EndDate',
            'design_json.timeAtRisk.start.offset' => 'nullable|integer',
            'design_json.timeAtRisk.end' => 'nullable|array',
            'design_json.timeAtRisk.end.dateField' => 'nullable|string|in:StartDate,EndDate',
            'design_json.timeAtRisk.end.offset' => 'nullable|integer',
            'design_json.stratifyByGender' => 'nullable|boolean',
            'design_json.stratifyByAge' => 'nullable|boolean',
            'design_json.stratifyByLocation' => ['nullable', 'string', Rule::in(['none', 'urban_pct', 'rucc'])],
            'design_json.ageGroups' => 'nullable|array',
            'design_json.ageGroups.*' => 'string',
            'design_json.minCellCount' => 'nullable|integer|min:1',
        ];
    }
}
