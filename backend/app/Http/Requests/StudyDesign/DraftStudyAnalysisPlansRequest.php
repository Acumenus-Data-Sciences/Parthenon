<?php

namespace App\Http\Requests\StudyDesign;

use Illuminate\Foundation\Http\FormRequest;

class DraftStudyAnalysisPlansRequest extends FormRequest
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
            'analysis_types' => 'nullable|array',
            'analysis_types.*' => 'string|in:characterization,incidence_rate,pathway,estimation,prediction,sccs,self_controlled_cohort,evidence_synthesis',
        ];
    }
}
