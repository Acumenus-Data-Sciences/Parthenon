<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Phase 17 GENOMICS-07 — POST /api/v1/finngen/endpoints/{name}/prs
 *
 * Dispatches a Darkstar finngen.prs.compute run for a (source × PGS score ×
 * cohort) tuple. FormRequest enforces HIGHSEC §2.3 defense-in-depth on the
 * finngen.prs.compute permission gate that the route middleware already
 * applies — belt-and-suspenders.
 *
 * Rule choices:
 *   - source_key regex matches existing FinnGen uppercase convention
 *     (same regex used by DispatchEndpointGwasRequest + eligibleControls).
 *   - score_id regex enforces the PGS Catalog natural key format (PGS\d+)
 *     so R-side sprintf interpolation is safe (T-17-S-SQLi-2 mitigation).
 *   - cohort_definition_id nullable: caller may omit and let the service
 *     derive from the latest FinnGenEndpointGeneration row.
 */
final class ComputePrsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('finngen.prs.compute') ?? false;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'source_key' => ['required', 'string', 'max:64', 'regex:/^[A-Z][A-Z0-9_]*$/'],
            'score_id' => ['required', 'string', 'max:32', 'regex:/^PGS\d+$/'],
            'cohort_definition_id' => ['nullable', 'integer', 'min:1'],
            'overwrite_existing' => ['sometimes', 'boolean'],
        ];
    }
}
