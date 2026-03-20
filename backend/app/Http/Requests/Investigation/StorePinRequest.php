<?php

namespace App\Http\Requests\Investigation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePinRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'domain' => ['required', Rule::in(['phenotype', 'clinical', 'genomic'])],
            'section' => ['required', Rule::in([
                'phenotype_definition', 'population', 'clinical_evidence',
                'genomic_evidence', 'synthesis', 'limitations', 'methods',
            ])],
            'finding_type' => ['required', Rule::in([
                'cohort_summary', 'hazard_ratio', 'incidence_rate', 'kaplan_meier',
                'codewas_hit', 'gwas_locus', 'colocalization', 'open_targets_association',
                'prediction_model', 'custom',
            ])],
            'finding_payload' => ['required', 'array'],
            'is_key_finding' => ['sometimes', 'boolean'],
        ];
    }
}
