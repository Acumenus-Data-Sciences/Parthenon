<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\FinnGen\GencodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Phase 16-02 (GENOMICS-04) — GENCODE v46 gene-track endpoint for the regional
 * Manhattan view.
 *
 *   GET /api/v1/gencode/genes?chrom=X&start=Y&end=Z[&include_pseudogenes=1]
 *
 * Permission gate is `cohorts.view` (D-16) — GENCODE is generic reference
 * data, available to anyone who can view cohorts (incl. the viewer role).
 *
 * Cached 7 days under `finngen:gencode:genes:{chrom}:{start}:{end}:{include}`
 * (D-20). Cache is safe because:
 *   - The TSV is static for the lifetime of the deploy (LoadGencodeGtfCommand
 *     repopulates it idempotently).
 *   - The key is built from server-validated integers + a tight regex —
 *     no user-controlled fragment can poison the Redis namespace (T-16-S2).
 *
 * Window guard: ≤ 5 Mb (generous for the gene track; larger windows pull too
 * many rows for a single API response and rarely correspond to a meaningful
 * regional view).
 */
final class GencodeController extends Controller
{
    public function __construct(
        private readonly GencodeService $gencode,
    ) {}

    public function index(Request $request): JsonResponse
    {
        /** @var array{chrom:string,start:int,end:int,include_pseudogenes?:bool} $validated */
        $validated = $request->validate([
            'chrom' => ['required', 'string', 'regex:/^([1-9]|1\d|2[0-2]|X|Y|MT)$/'],
            'start' => ['required', 'integer', 'min:1', 'max:300000000'],
            'end' => ['required', 'integer', 'min:1', 'max:300000000', 'gt:start'],
            'include_pseudogenes' => ['sometimes', 'boolean'],
        ], [
            'chrom.regex' => 'chrom must be 1-22, X, Y, or MT',
        ]);

        $chrom = $validated['chrom'];
        $start = (int) $validated['start'];
        $end = (int) $validated['end'];
        $include = (bool) ($validated['include_pseudogenes'] ?? false);

        if (($end - $start) > 5_000_000) {
            abort(422, 'Gene-track window cannot exceed 5,000,000 bp');
        }

        $cacheKey = sprintf(
            'finngen:gencode:genes:%s:%d:%d:%d',
            $chrom,
            $start,
            $end,
            (int) $include,
        );

        $genes = Cache::remember(
            $cacheKey,
            now()->addDays(7),
            fn (): array => $this->gencode->findGenesInRange($chrom, $start, $end, $include),
        );

        return response()->json([
            'genes' => $genes,
            'chrom' => $chrom,
            'start' => $start,
            'end' => $end,
        ]);
    }
}
