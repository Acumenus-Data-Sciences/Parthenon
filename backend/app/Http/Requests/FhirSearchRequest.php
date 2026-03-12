<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class FhirSearchRequest extends FormRequest
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
            '_count' => ['sometimes', 'integer', 'min:1', 'max:100'],
            '_offset' => ['sometimes', 'integer', 'min:0'],
            '_id' => ['sometimes', 'integer'],
            'patient' => ['sometimes', 'integer'],
            'code' => ['sometimes', 'string', 'max:255'],
            'date' => ['sometimes', 'date'],
            'onset-date' => ['sometimes', 'date'],
            'category' => ['sometimes', 'string', 'max:100'],
            'clinical-status' => ['sometimes', 'string', 'max:50'],
            'class' => ['sometimes', 'string', 'max:20'],
            'gender' => ['sometimes', 'string', 'in:male,female,other,unknown'],
            'birthdate' => ['sometimes', 'date'],
            'vaccine-code' => ['sometimes', 'string', 'max:255'],
        ];
    }
}
