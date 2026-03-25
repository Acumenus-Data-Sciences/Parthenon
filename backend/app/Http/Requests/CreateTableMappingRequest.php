<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateTableMappingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'source_table' => ['required', 'string', 'max:255'],
            'target_table' => ['required', 'string', 'max:255'],
            'logic' => ['nullable', 'string'],
            'is_stem' => ['nullable', 'boolean'],
        ];
    }
}
