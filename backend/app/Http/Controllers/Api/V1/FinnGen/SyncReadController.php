<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Services\FinnGen\FinnGenClient;
use App\Services\FinnGen\FinnGenSourceContextBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SyncReadController extends Controller
{
    public function __construct(
        private readonly FinnGenClient $client,
        private readonly FinnGenSourceContextBuilder $sourceBuilder,
    ) {}

    public function romopapiCodeCounts(Request $request): JsonResponse
    {
        return $this->proxy($request, '/finngen/romopapi/code-counts', [
            'concept_id' => (int) $request->input('concept_id'),
        ]);
    }

    public function romopapiRelationships(Request $request): JsonResponse
    {
        return $this->proxy($request, '/finngen/romopapi/relationships', [
            'concept_id' => (int) $request->input('concept_id'),
        ]);
    }

    public function romopapiAncestors(Request $request): JsonResponse
    {
        return $this->proxy($request, '/finngen/romopapi/ancestors', [
            'concept_id' => (int) $request->input('concept_id'),
            'direction' => (string) $request->input('direction', 'both'),
            'max_depth' => (int) $request->input('max_depth', 5),
        ]);
    }

    public function hadesOverlap(Request $request): JsonResponse
    {
        return $this->proxy($request, '/finngen/hades/overlap', [
            'cohort_ids' => (string) $request->input('cohort_ids', ''),
        ]);
    }

    public function hadesDemographics(Request $request): JsonResponse
    {
        return $this->proxy($request, '/finngen/hades/demographics', [
            'cohort_id' => (int) $request->input('cohort_id'),
        ]);
    }

    public function hadesCounts(Request $request): JsonResponse
    {
        return $this->proxy($request, '/finngen/hades/counts', [
            'cohort_ids' => (string) $request->input('cohort_ids', ''),
        ]);
    }

    /**
     * @param  array<string, scalar>  $extraQuery
     */
    private function proxy(Request $request, string $darkstarPath, array $extraQuery): JsonResponse
    {
        $sourceKey = (string) $request->input('source', '');
        if ($sourceKey === '') {
            return response()->json([
                'error' => ['code' => 'FINNGEN_INVALID_PARAMS', 'message' => 'source is required'],
            ], 422);
        }

        $refresh = $request->boolean('refresh');
        $cacheKey = 'finngen:sync:'.md5($darkstarPath.'|'.$sourceKey.'|'.(string) json_encode($extraQuery));

        if (! $refresh && ($hit = Cache::get($cacheKey)) !== null) {
            /** @var array<string, mixed> $hit */
            return response()->json($hit);
        }

        $source = $this->sourceBuilder->build($sourceKey, FinnGenSourceContextBuilder::ROLE_RO);

        $result = $this->client->getSync($darkstarPath, array_merge(
            ['source' => (string) json_encode($source)],
            $extraQuery,
        ));

        $ttl = (int) config('finngen.sync_cache_ttl_seconds', 3600);
        Cache::put($cacheKey, $result, $ttl);

        return response()->json($result);
    }
}
