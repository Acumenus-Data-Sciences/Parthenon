<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PatientSimilarityExportCohortRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'cache_id' => ['required', 'integer', 'exists:patient_similarity_cache,id'],
            'min_score' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'cohort_name' => ['required', 'string', 'max:255'],
            'cohort_description' => ['nullable', 'string'],
        ];
    }
}
