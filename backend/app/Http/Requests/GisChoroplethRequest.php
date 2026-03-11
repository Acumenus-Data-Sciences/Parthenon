<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class GisChoroplethRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'level' => ['sometimes', 'string'],
            'metric' => ['sometimes', 'string'],
            'country_code' => ['sometimes', 'string', 'size:3'],
            'concept_id' => ['sometimes', 'integer'],
            'date_from' => ['sometimes', 'date'],
            'date_to' => ['sometimes', 'date'],
        ];
    }
}
