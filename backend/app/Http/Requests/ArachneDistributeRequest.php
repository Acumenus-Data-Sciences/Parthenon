<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ArachneDistributeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Authorization handled by route middleware (permission:studies.execute)
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'study_slug' => ['required', 'string', 'exists:studies,slug'],
            'node_ids' => ['required', 'array', 'min:1'],
            'node_ids.*' => ['required', 'integer'],
            'analysis_spec' => ['nullable', 'array'],
        ];
    }
}
