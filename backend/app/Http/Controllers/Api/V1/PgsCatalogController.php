<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Phase 17 GENOMICS-08 D-16 — PGS Catalog score picker.
 *
 * Returns the list of ingested PGS scores for the frontend's ComputePrsModal
 * picker (<select>). Sorted by (trait_reported ASC, score_id ASC) per 17-RESEARCH
 * §Open Questions Q2 resolution.
 *
 * Uses the default connection with a fully-qualified `vocab.pgs_scores` table
 * reference so the query works under both the prod `pgsql` connection
 * (search_path=app,php) and the Pest `pgsql_testing` connection. Avoids routing
 * through `App\Models\App\PgsScore` (bound to `omop`) which would cross DBs
 * under Pest (where `omop` still points at prod parthenon).
 */
final class PgsCatalogController extends Controller
{
    /**
     * GET /api/v1/pgs-catalog/scores
     */
    public function scores(): JsonResponse
    {
        $rows = DB::connection()->select(
            'SELECT score_id, pgs_name, trait_reported, variants_number
               FROM vocab.pgs_scores
              ORDER BY trait_reported ASC NULLS LAST, score_id ASC'
        );

        /** @var list<array{score_id: string, pgs_name: ?string, trait_reported: ?string, variants_number: int}> $out */
        $out = array_map(static fn ($r): array => [
            'score_id' => (string) $r->score_id,
            'pgs_name' => $r->pgs_name !== null ? (string) $r->pgs_name : null,
            'trait_reported' => $r->trait_reported !== null ? (string) $r->trait_reported : null,
            'variants_number' => (int) $r->variants_number,
        ], $rows);

        return response()->json(['scores' => $out]);
    }
}
