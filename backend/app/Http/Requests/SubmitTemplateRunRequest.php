<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SubmitTemplateRunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string,array<int,string>|string>
     */
    public function rules(): array
    {
        return [
            'version' => ['required', 'string', 'regex:/^\d+\.\d+\.\d+(?:[-+].+)?$/'],
            'parameters' => ['sometimes', 'array'],
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function validatedParameters(): array
    {
        $params = $this->validated()['parameters'] ?? [];

        return is_array($params) ? $params : [];
    }

    public function validatedVersion(): string
    {
        return (string) $this->validated()['version'];
    }
}
