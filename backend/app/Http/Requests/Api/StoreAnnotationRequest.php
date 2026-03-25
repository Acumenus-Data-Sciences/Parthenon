<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreAnnotationRequest extends FormRequest
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
            'chart_type' => 'required|string|max:50',
            'chart_context' => 'required|array',
            'x_value' => 'required|string|max:100',
            'y_value' => 'nullable|numeric',
            'annotation_text' => 'required|string|max:2000',
            'tag' => ['nullable', 'string', 'in:data_event,research_note,action_item,system'],
            'parent_id' => ['nullable', 'integer', 'exists:chart_annotations,id'],
        ];
    }
}
