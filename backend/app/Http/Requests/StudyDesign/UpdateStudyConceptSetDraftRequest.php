<?php

namespace App\Http\Requests\StudyDesign;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStudyConceptSetDraftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $roles = ['population', 'exposure', 'intervention', 'comparator', 'outcome', 'exclusion', 'subgroup'];

        return [
            'title' => ['required', 'string', 'max:255'],
            'role' => ['nullable', 'string', Rule::in($roles)],
            'domain' => ['nullable', 'string', 'max:64'],
            'clinical_rationale' => ['nullable', 'string', 'max:5000'],
            'search_terms' => ['nullable', 'array'],
            'search_terms.*' => ['string', 'max:255'],
            'source_concept_set_references' => ['nullable', 'array'],
            'concepts' => ['required', 'array'],
            'concepts.*.concept_id' => ['required', 'integer'],
            'concepts.*.is_excluded' => ['nullable', 'boolean'],
            'concepts.*.include_descendants' => ['nullable', 'boolean'],
            'concepts.*.include_mapped' => ['nullable', 'boolean'],
            'concepts.*.rationale' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
