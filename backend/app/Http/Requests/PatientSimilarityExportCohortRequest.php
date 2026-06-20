<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'cache_id' => ['required_without:person_ids', Rule::prohibitedIf($this->has('person_ids')), 'integer', 'exists:patient_similarity_cache,id'],
            'person_ids' => ['required_without:cache_id', Rule::prohibitedIf($this->has('cache_id')), 'array', 'min:1', 'max:10000'],
            'person_ids.*' => ['integer', 'min:1'],
            'source_id' => ['required_with:person_ids', Rule::prohibitedIf($this->has('cache_id')), 'integer', 'exists:sources,id'],
            'target_cohort_id' => ['sometimes', 'nullable', 'integer', 'exists:cohort_definitions,id'],
            'comparator_cohort_id' => ['sometimes', 'nullable', 'integer', 'exists:cohort_definitions,id'],
            'matched_pair_count' => ['sometimes', 'integer', 'min:0', 'max:10000'],
            'model_metrics' => ['sometimes', 'array'],
            'min_score' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'name' => ['required_without:cohort_name', 'string', 'max:255'],
            'cohort_name' => ['required_without:name', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'cohort_description' => ['nullable', 'string'],
        ];
    }
}
