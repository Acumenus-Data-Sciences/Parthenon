<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Investigation\QueryGwasCatalogRequest;
use App\Http\Requests\Investigation\QueryOpenTargetsRequest;
use App\Http\Requests\Investigation\UploadGwasRequest;
use App\Models\App\Investigation;
use App\Services\Investigation\GenomicProxyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class GenomicEvidenceController extends Controller
{
    public function __construct(
        private readonly GenomicProxyService $proxyService,
    ) {}

    /**
     * Proxy a query to the Open Targets platform GraphQL API.
     */
    public function queryOpenTargets(QueryOpenTargetsRequest $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $validated = $request->validated();
        /** @var string $queryType */
        $queryType = $validated['query_type'];
        /** @var string $term */
        $term = $validated['term'];

        if ($queryType === 'gene') {
            $graphql = <<<'GQL'
                query SearchTargets($queryString: String!) {
                    search(queryString: $queryString, entityNames: ["target"]) {
                        hits {
                            id
                            name
                            entity
                            object {
                                ... on Target {
                                    id
                                    approvedSymbol
                                    approvedName
                                    biotype
                                }
                            }
                        }
                    }
                }
                GQL;
        } else {
            $graphql = <<<'GQL'
                query SearchDiseases($queryString: String!) {
                    search(queryString: $queryString, entityNames: ["disease"]) {
                        hits {
                            id
                            name
                            entity
                            object {
                                ... on Disease {
                                    id
                                    name
                                    description
                                }
                            }
                        }
                    }
                }
                GQL;
        }

        $result = $this->proxyService->queryOpenTargets($graphql, ['queryString' => $term]);

        return response()->json(['data' => $result]);
    }

    /**
     * Proxy a query to the GWAS Catalog REST API.
     */
    public function queryGwasCatalog(QueryGwasCatalogRequest $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $validated = $request->validated();
        /** @var string $queryType */
        $queryType = $validated['query_type'];
        /** @var string $term */
        $term = $validated['term'];
        /** @var int $size */
        $size = (int) ($validated['size'] ?? 20);

        if ($queryType === 'trait') {
            $endpoint = 'efoTraits/search';
            $params = ['query' => $term, 'size' => $size];
        } else {
            $endpoint = 'associations/search';
            $params = ['geneName' => $term, 'size' => $size];
        }

        $result = $this->proxyService->queryGwasCatalog($endpoint, $params);

        return response()->json(['data' => $result]);
    }

    /**
     * Upload a GWAS summary statistics file and return a column preview.
     */
    public function uploadGwas(UploadGwasRequest $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        /** @var \Illuminate\Http\UploadedFile $file */
        $file = $request->file('file');

        $uploadId = (string) Str::uuid();
        $directory = "investigations/{$investigation->id}/uploads";
        $filename = $uploadId . '_' . $file->getClientOriginalName();
        $path = $file->storeAs($directory, $filename, 'local');

        // Parse columns and sample rows from the first 5 data lines
        $columns = [];
        $sampleRows = [];
        $totalRows = 0;

        $rawContents = Storage::disk('local')->get((string) $path);
        if ($rawContents !== null) {
            $lines = explode("\n", str_replace("\r\n", "\n", $rawContents));
            $lineNumber = 0;
            foreach ($lines as $line) {
                $trimmed = rtrim($line, "\r");
                if ($trimmed === '' && $lineNumber > 0) {
                    continue;
                }
                $separator = str_contains($trimmed, "\t") ? "\t" : ',';
                $parts = explode($separator, $trimmed);

                if ($lineNumber === 0) {
                    $columns = $parts;
                } else {
                    $totalRows++;
                    if (count($sampleRows) < 5) {
                        $row = [];
                        foreach ($columns as $i => $col) {
                            $row[$col] = $parts[$i] ?? null;
                        }
                        $sampleRows[] = $row;
                    }
                }
                $lineNumber++;
            }
        }

        return response()->json([
            'data' => [
                'upload_id' => $uploadId,
                'path' => $path,
                'columns' => $columns,
                'sample_rows' => $sampleRows,
                'total_rows' => $totalRows,
            ],
        ]);
    }

    /**
     * Resolve cross-links between evidence pins for an investigation.
     */
    public function crossLinks(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $linkMap = $this->proxyService->resolveCrossLinks($investigation->id);

        return response()->json(['data' => $linkMap]);
    }
}
