<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreSurveyCampaignRequest extends FormRequest
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
        return [
            'name' => 'required|string|max:255',
            'survey_instrument_id' => 'required|exists:survey_instruments,id',
            'cohort_generation_id' => 'nullable|integer|exists:cohort_generations,id',
            'description' => 'nullable|string',
        ];
    }
}
