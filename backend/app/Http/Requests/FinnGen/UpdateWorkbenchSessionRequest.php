<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

class UpdateWorkbenchSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('finngen.workbench.use') ?? false;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            // Every field optional — autosave PATCH typically sends only session_state.
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'session_state' => ['sometimes', 'array'],
            'schema_version' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
