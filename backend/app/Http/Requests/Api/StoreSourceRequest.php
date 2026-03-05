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

        $allDialects = implode(',', [
            'postgresql', 'redshift', 'oracle', 'sqlserver', 'synapse',
            'snowflake', 'databricks', 'bigquery', 'duckdb', 'mysql',
        ]);

        return [
            'source_name' => 'required|string|max:255',
            'source_key' => ['required', 'string', 'max:255', $uniqueKey],
            'source_dialect' => "required|string|in:{$allDialects}",
            // source_connection is optional when db_host is provided
            'source_connection' => 'nullable|string',
            'is_cache_enabled' => 'boolean',
            'restricted_to_roles' => 'nullable|array',
            'restricted_to_roles.*' => 'string',
            // Dynamic connection fields
            'db_host' => 'nullable|string|max:512',
            'db_port' => 'nullable|integer|min:1|max:65535',
            'db_database' => 'nullable|string|max:255',
            'username' => 'nullable|string|max:255',
            'password' => 'nullable|string|max:1024',
            'db_options' => 'nullable|array',
            // Daimons
            'daimons' => 'sometimes|array',
            'daimons.*.daimon_type' => 'required_with:daimons|string|in:cdm,vocabulary,results,temp',
            'daimons.*.table_qualifier' => 'required_with:daimons|string',
            'daimons.*.priority' => 'integer|min:0',
        ];
    }
}
