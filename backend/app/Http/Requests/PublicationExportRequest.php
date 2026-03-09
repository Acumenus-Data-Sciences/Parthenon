<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PublicationExportRequest extends FormRequest
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
            'template' => 'required|string|in:generic-ohdsi',
            'format' => 'required|string|in:docx,pdf,figures-zip',
            'title' => 'required|string|max:500',
            'authors' => 'required|array|min:1',
            'authors.*' => 'string|max:200',
            'sections' => 'required|array|min:1',
            'sections.*.type' => 'required|string|in:title,methods,results,diagram,discussion',
            'sections.*.content' => 'nullable|string',
            'sections.*.included' => 'required|boolean',
            'sections.*.svg' => 'nullable|string',
            'sections.*.caption' => 'nullable|string',
            'sections.*.diagram_type' => 'nullable|string|in:consort,forest_plot,kaplan_meier,attrition',
        ];
    }
}
