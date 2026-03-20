<?php

namespace App\Http\Requests\Investigation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class QueryGwasCatalogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'query_type' => ['required', Rule::in(['trait', 'gene'])],
            'term' => ['required', 'string', 'min:2', 'max:200'],
            'size' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
