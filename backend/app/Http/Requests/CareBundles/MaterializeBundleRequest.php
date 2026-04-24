<?php

declare(strict_types=1);

namespace App\Http\Requests\CareBundles;

use Illuminate\Foundation\Http\FormRequest;

class MaterializeBundleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('care-bundles.materialize') ?? false;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'source_id' => ['required', 'integer', 'exists:sources,id'],
        ];
    }
}
