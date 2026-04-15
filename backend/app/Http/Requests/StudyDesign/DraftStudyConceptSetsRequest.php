<?php

namespace App\Http\Requests\StudyDesign;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DraftStudyConceptSetsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $roles = ['population', 'exposure', 'intervention', 'comparator', 'outcome', 'exclusion', 'subgroup'];

        return [
            'asset_ids' => ['nullable', 'array'],
            'asset_ids.*' => ['integer'],
            'role' => ['nullable', 'string', Rule::in($roles)],
            'drafts' => ['nullable', 'array'],
            'drafts.*.title' => ['required_with:drafts', 'string', 'max:255'],
            'drafts.*.role' => ['nullable', 'string', Rule::in($roles)],
            'drafts.*.domain' => ['nullable', 'string', 'max:64'],
            'drafts.*.clinical_rationale' => ['nullable', 'string', 'max:5000'],
            'drafts.*.search_terms' => ['nullable', 'array'],
            'drafts.*.search_terms.*' => ['string', 'max:255'],
            'drafts.*.concepts' => ['required_with:drafts', 'array', 'min:1'],
            'drafts.*.concepts.*.concept_id' => ['required', 'integer'],
            'drafts.*.concepts.*.is_excluded' => ['nullable', 'boolean'],
            'drafts.*.concepts.*.include_descendants' => ['nullable', 'boolean'],
            'drafts.*.concepts.*.include_mapped' => ['nullable', 'boolean'],
            'drafts.*.concepts.*.rationale' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
