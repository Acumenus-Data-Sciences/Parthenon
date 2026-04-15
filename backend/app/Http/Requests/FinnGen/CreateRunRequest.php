<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

class CreateRunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('analyses.run') ?? false;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'analysis_type' => ['required', 'string', 'max:64'],
            'source_key' => ['required', 'string', 'max:64'],
            'params' => ['required', 'array'],
        ];
    }
}
