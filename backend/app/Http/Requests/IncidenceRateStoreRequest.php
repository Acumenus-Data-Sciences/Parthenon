<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the body of POST /api/v1/incidence-rates.
 *
 * Phase 19 (GIS-03 / D-09 / W-04): the existing route group at
 * routes/api.php applies `permission:analyses.create` middleware to BOTH
 * store and update. To keep the FormRequest authorize() in lockstep with
 * the route middleware (and avoid silent 403 noise from a permission
 * mismatch), both the Store and Update FormRequests authorize on
 * `analyses.create`. Splitting to a separate `analyses.edit` permission
 * is deferred to a follow-up RBAC plan.
 */
class IncidenceRateStoreRequest extends FormRequest
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
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'required|array',
            'design_json.targetCohortId' => 'required|integer',
            'design_json.outcomeCohortIds' => 'required|array|min:1',
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
