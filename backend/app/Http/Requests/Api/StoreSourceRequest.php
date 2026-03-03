<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSourceRequest extends FormRequest
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
        $sourceId = $this->route('source')?->id;

        $uniqueKey = Rule::unique('sources', 'source_key');
        if ($sourceId) {
            $uniqueKey = $uniqueKey->ignore($sourceId);
        }

        return [
            'source_name' => 'required|string|max:255',
            'source_key' => ['required', 'string', 'max:255', $uniqueKey],
            'source_dialect' => 'required|string|in:postgresql,bigquery,oracle,spanner',
            'source_connection' => 'required|string',
            'is_cache_enabled' => 'boolean',
            'restricted_to_roles' => 'nullable|array',
            'restricted_to_roles.*' => 'string',
            'daimons' => 'sometimes|array',
            'daimons.*.daimon_type' => 'required_with:daimons|string|in:cdm,vocabulary,results,temp',
            'daimons.*.table_qualifier' => 'required_with:daimons|string',
            'daimons.*.priority' => 'integer|min:0',
        ];
    }
}
