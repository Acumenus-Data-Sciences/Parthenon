<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Phase 18 GENOMICS-09/10/11 — validation for GET /api/v1/finngen/endpoints/{name}/profile.
 *
 * Applied per Warning 4 of the Phase 18 checker review: the controller MUST
 * NOT use inline preg_match on query params — the FormRequest enforces input
 * shape before the controller is invoked. Authorization is already gated by
 * route middleware `permission:finngen.endpoint_profile.view`, so authorize()
 * returns true here (no duplication).
 *
 * T-18-03 mitigation: regex allow-list rejects malformed source_key values
 * (e.g. "bad; DROP", lowercase keys, overlong inputs) with a 422 response
 * BEFORE any schema-name interpolation happens in showProfile().
 */
final class ReadEndpointProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'source_key' => ['required', 'string', 'regex:/^[A-Z][A-Z0-9_]{1,30}$/'],
        ];
    }
}
