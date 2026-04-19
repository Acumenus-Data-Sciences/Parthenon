<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Phase 18 GENOMICS-09/10/11 — validation for POST /api/v1/finngen/endpoints/{name}/profile.
 *
 * T-18-03 mitigation: source_key regex allow-list applied BEFORE the controller
 * interpolates it into any schema name. The regex matches the existing FinnGen
 * uppercase convention (same pattern as ComputePrsRequest and
 * DispatchEndpointGwasRequest); EndpointProfileDispatchService re-validates the
 * lowercase derived schema name via /^[a-z][a-z0-9_]*$/ as defense-in-depth.
 *
 * Authorization is handled by the route middleware
 * `permission:finngen.endpoint_profile.compute`; authorize() returns true here
 * per the existing Parthenon convention (no duplication with route middleware).
 */
final class ComputeEndpointProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'source_key' => ['required', 'string', 'max:64', 'regex:/^[A-Z][A-Z0-9_]*$/'],
            'min_subjects' => ['sometimes', 'integer', 'min:1', 'max:1000'],
        ];
    }
}
