<?php

namespace App\Http\Requests\Investigation;

use Illuminate\Foundation\Http\FormRequest;

class UploadGwasRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:512000', 'mimes:csv,tsv,txt,gz'],
            'column_mapping' => ['sometimes', 'array'],
        ];
    }
}
