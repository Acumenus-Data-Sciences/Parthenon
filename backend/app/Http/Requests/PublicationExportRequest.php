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
            'authors' => 'present|array',
            'authors.*' => 'string|max:200',
            'sections' => 'required|array|min:1',
            'sections.*.type' => 'required|string|in:title,methods,results,diagram,discussion,diagnostics',
            'sections.*.content' => 'nullable|string',
            'sections.*.included' => 'required|boolean',
            'sections.*.svg' => 'nullable|string',
            'sections.*.caption' => 'nullable|string',
            'sections.*.diagram_type' => 'nullable|string|in:consort,forest_plot,kaplan_meier,attrition',
            'sections.*.title' => 'nullable|string|max:500',
            'sections.*.table_data' => 'nullable|array',
            'sections.*.table_data.caption' => 'nullable|string',
            'sections.*.table_data.headers' => 'nullable|array',
            'sections.*.table_data.headers.*' => 'string',
            'sections.*.table_data.rows' => 'nullable|array',
            'sections.*.table_data.footnotes' => 'nullable|array',
        ];
    }
}
