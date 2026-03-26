<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StageFilesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'files' => ['required', 'array', 'min:1'],
            'files.*' => ['required', 'file', 'max:5242880'], // 5GB in KB
            'table_names' => ['required', 'array', 'min:1'],
            'table_names.*' => ['required', 'string', 'max:63', 'regex:/^[a-z][a-z0-9_]{0,62}$/', 'distinct'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'table_names.*.regex' => 'Table names must start with a letter and contain only lowercase letters, numbers, and underscores.',
            'table_names.*.distinct' => 'Table names must be unique within the upload.',
        ];
    }
}
