<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFieldMappingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'fields' => ['required', 'array'],
            'fields.*.target_column' => ['required', 'string', 'max:255'],
            'fields.*.source_column' => ['nullable', 'string', 'max:255'],
            'fields.*.mapping_type' => ['nullable', 'string', 'in:direct,transform,lookup,constant,concat,expression'],
            'fields.*.logic' => ['nullable', 'string'],
            'fields.*.is_reviewed' => ['nullable', 'boolean'],
            'updated_at' => ['required', 'date'], // Optimistic locking
        ];
    }
}
