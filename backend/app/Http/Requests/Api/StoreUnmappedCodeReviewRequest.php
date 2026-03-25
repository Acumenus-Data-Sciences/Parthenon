<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreUnmappedCodeReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'source_code' => ['required', 'string', 'max:255'],
            'source_vocabulary_id' => ['required', 'string', 'max:100'],
            'status' => ['required', 'string', 'in:pending,mapped,deferred,excluded'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
