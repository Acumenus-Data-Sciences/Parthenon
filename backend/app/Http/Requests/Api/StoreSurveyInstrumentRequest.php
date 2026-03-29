<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSurveyInstrumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $instrumentId = $this->route('instrument')?->id ?? $this->route('instrument');

        $uniqueAbbrev = Rule::unique('survey_instruments', 'abbreviation');
        if ($instrumentId) {
            $uniqueAbbrev = $uniqueAbbrev->ignore($instrumentId);
        }

        return [
            'name' => 'required|string|max:255',
            'abbreviation' => ['required', 'string', 'max:30', $uniqueAbbrev],
            'version' => 'sometimes|string|max:20',
            'description' => 'nullable|string|max:2000',
            'domain' => 'required|string|max:60',
            'item_count' => 'sometimes|integer|min:0',
            'scoring_method' => 'nullable|array',
            'loinc_panel_code' => 'nullable|string|max:20',
            'omop_concept_id' => 'nullable|integer',
            'license_type' => 'sometimes|string|in:public,proprietary',
            'license_detail' => 'nullable|string|max:255',
            'is_public_domain' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'omop_coverage' => 'sometimes|string|in:yes,partial,no',
        ];
    }
}
