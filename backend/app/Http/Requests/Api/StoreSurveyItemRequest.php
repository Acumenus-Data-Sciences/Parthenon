<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreSurveyItemRequest extends FormRequest
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
            'item_number' => 'required|integer|min:1',
            'item_text' => 'required|string|max:2000',
            'response_type' => 'sometimes|string|in:likert,yes_no,numeric,free_text,multi_select,date',
            'omop_concept_id' => 'nullable|integer',
            'loinc_code' => 'nullable|string|max:20',
            'subscale_name' => 'nullable|string|max:60',
            'is_reverse_coded' => 'sometimes|boolean',
            'min_value' => 'nullable|numeric',
            'max_value' => 'nullable|numeric',
            'display_order' => 'required|integer|min:1',
            'answer_options' => 'sometimes|array',
            'answer_options.*.option_text' => 'required_with:answer_options|string|max:500',
            'answer_options.*.option_value' => 'nullable|numeric',
            'answer_options.*.omop_concept_id' => 'nullable|integer',
            'answer_options.*.loinc_la_code' => 'nullable|string|max:20',
            'answer_options.*.display_order' => 'required_with:answer_options|integer|min:1',
        ];
    }
}
