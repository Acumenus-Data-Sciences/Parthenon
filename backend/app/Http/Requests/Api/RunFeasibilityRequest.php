<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class RunFeasibilityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'criteria' => ['required', 'array'],
            'criteria.required_domains' => ['required', 'array', 'min:1'],
            'criteria.required_domains.*' => ['string', 'in:condition,drug,procedure,measurement,observation,visit'],
            'criteria.required_concepts' => ['nullable', 'array'],
            'criteria.required_concepts.*' => ['integer'],
            'criteria.visit_types' => ['nullable', 'array'],
            'criteria.visit_types.*' => ['integer'],
            'criteria.date_range' => ['nullable', 'array'],
            'criteria.date_range.start' => ['date'],
            'criteria.date_range.end' => ['date', 'after:criteria.date_range.start'],
            'criteria.min_patients' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
