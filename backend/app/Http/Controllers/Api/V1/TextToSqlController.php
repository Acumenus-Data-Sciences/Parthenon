<?php

namespace App\Http\Controllers\Api\V1;

use App\Concerns\SourceAware;
use App\Http\Controllers\Controller;
use App\Models\App\QueryLibraryEntry;
use App\Models\User;
use App\Services\QueryLibrary\QueryLibrarySearchService;
use App\Services\Solr\VocabularySearchService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

#[Group('Text-to-SQL', weight: 227)]
class TextToSqlController extends Controller
{
    use SourceAware;

    private string $aiUrl;

    public function __construct(
        private readonly VocabularySearchService $solrVocabularySearch,
        private readonly QueryLibrarySearchService $queryLibrarySearch,
    ) {
        $this->aiUrl = rtrim(config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * POST /api/v1/text-to-sql/generate
     *
     * Translate a natural-language question into a SQL query against the OMOP CDM.
     * Proxies to the Python AI service at POST /text-to-sql/generate.
     *
     * Accepts any JSON body; the AI service defines the schema.
     */
    public function generate(Request $request): JsonResponse
    {
        try {
            $payload = $request->json()->all();

            if (! array_key_exists('concept_hints', $payload)) {
                $payload['concept_hints'] = $this->resolveConceptHints(
                    (string) $request->input('question', '')
                );
            }

            if (! array_key_exists('library_hints', $payload)) {
                $payload['library_hints'] = $this->resolveLibraryHints(
                    (string) $request->input('question', '')
                );
            }

            $response = Http::timeout(60)
                ->post("{$this->aiUrl}/text-to-sql/generate", $payload);

            if ($response->failed()) {
                Log::warning('TextToSql generate failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'SQL generation failed',
                    'detail' => $response->json('detail') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('TextToSqlController::generate exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Text-to-SQL service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * POST /api/v1/text-to-sql/validate
     *
     * Validate a generated SQL query for safety and correctness before execution.
     * Proxies to the Python AI service at POST /text-to-sql/validate.
     *
     * Accepts any JSON body; the AI service defines the schema.
     */
    public function validate(Request $request): JsonResponse
    {
        try {
            $response = Http::timeout(15)
                ->withBody($request->getContent(), 'application/json')
                ->post("{$this->aiUrl}/text-to-sql/validate");

            if ($response->failed()) {
                Log::warning('TextToSql validate failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'SQL validation failed',
                    'detail' => $response->json('detail') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('TextToSqlController::validate exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Text-to-SQL service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * GET /api/v1/text-to-sql/schema
     *
     * Retrieve the CDM schema context used by the text-to-SQL model
     * (tables, columns, descriptions).
     * Proxies to the Python AI service at GET /text-to-sql/schema.
     */
    public function schema(): JsonResponse
    {
        try {
            $response = Http::timeout(10)->get(
                "{$this->aiUrl}/text-to-sql/schema"
            );

            if ($response->failed()) {
                return response()->json([
                    'error' => 'Failed to retrieve SQL schema context',
                    'detail' => $response->json('detail') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('TextToSqlController::schema exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Text-to-SQL service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * POST /api/v1/text-to-sql/execute
     *
     * Execute a read-only SQL query against the CDM connection.
     * Safe queries are available to all authenticated users.
     * Unsafe/unknown queries require super-admin role.
     */
    public function execute(Request $request): JsonResponse
    {
        $request->validate(['sql' => 'required|string|max:10000']);

        $sql = trim($request->input('sql'));
        $sql = rtrim($sql, "; \t\n\r\0\x0B");
        $safety = $request->input('safety', 'unknown');

        // Reject if the content is clearly not SQL (e.g., AI returned prose)
        if (! preg_match('/^\s*(SELECT|WITH)\b/i', $sql)) {
            return response()->json([
                'error' => 'Query must begin with SELECT or WITH.',
            ], 422);
        }

        // Read-only enforcement
        $normalized = preg_replace('/\s+/', ' ', Str::upper($sql)) ?? '';
        $normalized = preg_replace('/--.*$/m', '', $normalized) ?? $normalized;
        $normalized = preg_replace('/\/\*.*?\*\//s', '', $normalized) ?? $normalized;

        $forbidden = ['INSERT ', 'UPDATE ', 'DELETE ', 'DROP ', 'ALTER ', 'TRUNCATE ', 'CREATE ', 'GRANT ', 'REVOKE '];
        foreach ($forbidden as $keyword) {
            if (str_contains($normalized, $keyword)) {
                return response()->json([
                    'error' => 'Only read-only SELECT queries are allowed.',
                ], 422);
            }
        }

        // Reject backtick-quoted identifiers (MySQL syntax, not PostgreSQL)
        if (str_contains($sql, '`')) {
            return response()->json([
                'error' => 'Backtick-quoted identifiers are not supported in PostgreSQL. Use double quotes for identifiers.',
            ], 422);
        }

        // Role gate for non-safe queries
        if ($safety !== 'safe') {
            /** @var User $user */
            $user = $request->user();
            if (! $user->hasRole('super-admin')) {
                return response()->json([
                    'error' => 'Only administrators can execute queries not marked as safe.',
                ], 403);
            }
        }

        $executionId = (string) Str::uuid();
        $maxRows = 10_000;

        try {
            $connection = $this->cdm();

            // Get backend PID and cache it for status polling
            $pidResult = $connection->selectOne('SELECT pg_backend_pid() AS pid');
            $pid = $pidResult->pid ?? null;

            if ($pid !== null) {
                Cache::put("sql-exec:{$executionId}:pid", $pid, 300);
            }

            // Set statement timeout
            $connection->statement("SET statement_timeout = '120s'");

            $startTime = microtime(true);
            $wrappedSql = "SELECT * FROM ({$sql}) AS _q LIMIT ".($maxRows + 1);
            $rows = $connection->select($wrappedSql);
            $elapsedMs = round((microtime(true) - $startTime) * 1000);

            // Reset timeout
            $connection->statement("SET statement_timeout = '0'");

            $truncated = count($rows) > $maxRows;
            if ($truncated) {
                $rows = array_slice($rows, 0, $maxRows);
            }

            $columns = $rows !== [] ? array_keys((array) $rows[0]) : [];
            $rowArrays = array_map(fn (object $row) => array_values((array) $row), $rows);

            // Cache results for CSV download (5 min)
            Cache::put("sql-exec:{$executionId}:result", [
                'columns' => $columns,
                'rows' => $rowArrays,
            ], 300);

            // Clear PID cache
            Cache::forget("sql-exec:{$executionId}:pid");

            return response()->json(['data' => [
                'execution_id' => $executionId,
                'columns' => $columns,
                'rows' => $rowArrays,
                'row_count' => count($rowArrays),
                'elapsed_ms' => $elapsedMs,
                'truncated' => $truncated,
            ]]);
        } catch (\Throwable $e) {
            Cache::forget("sql-exec:{$executionId}:pid");
            Log::warning('TextToSql execute failed', ['message' => $e->getMessage()]);

            // Reset timeout on error
            try {
                $this->cdm()->statement("SET statement_timeout = '0'");
            } catch (\Throwable) {
                // Connection may be broken
            }

            $message = $e->getMessage();
            $status = str_contains($message, 'statement timeout') ? 504 : 422;

            return response()->json([
                'error' => 'Query execution failed',
                'message' => $message,
            ], $status);
        }
    }

    /**
     * GET /api/v1/text-to-sql/execute/{executionId}/status
     *
     * Poll pg_stat_activity for a running query's status.
     */
    public function executionStatus(string $executionId): JsonResponse
    {
        $pid = Cache::get("sql-exec:{$executionId}:pid");

        if ($pid === null) {
            return response()->json(['data' => [
                'active' => false,
                'state' => 'completed',
                'wait_event' => null,
                'elapsed_ms' => 0,
            ]]);
        }

        try {
            $stat = $this->cdm()->selectOne(
                'SELECT state, wait_event_type, wait_event,
                        EXTRACT(EPOCH FROM (now() - query_start)) * 1000 AS elapsed_ms
                 FROM pg_stat_activity
                 WHERE pid = ?',
                [$pid]
            );

            if ($stat === null) {
                return response()->json(['data' => [
                    'active' => false,
                    'state' => 'completed',
                    'wait_event' => null,
                    'elapsed_ms' => 0,
                ]]);
            }

            $waitEvent = $stat->wait_event_type
                ? "{$stat->wait_event_type}: {$stat->wait_event}"
                : null;

            return response()->json(['data' => [
                'active' => $stat->state === 'active',
                'state' => $stat->state ?? 'unknown',
                'wait_event' => $waitEvent,
                'elapsed_ms' => round((float) $stat->elapsed_ms),
            ]]);
        } catch (\Throwable $e) {
            Log::warning('TextToSql status check failed', ['message' => $e->getMessage()]);

            return response()->json(['data' => [
                'active' => false,
                'state' => 'error',
                'wait_event' => null,
                'elapsed_ms' => 0,
            ]]);
        }
    }

    /**
     * GET /api/v1/text-to-sql/execute/{executionId}/download
     *
     * Download cached query results as CSV.
     */
    public function executionDownload(string $executionId): StreamedResponse|JsonResponse
    {
        /** @var array{columns: string[], rows: list<list<mixed>>}|null $cached */
        $cached = Cache::get("sql-exec:{$executionId}:result");

        if ($cached === null) {
            return response()->json([
                'error' => 'Results expired or not found. Please re-run the query.',
            ], 404);
        }

        $filename = "query-results-{$executionId}.csv";

        return new StreamedResponse(
            function () use ($cached): void {
                $handle = fopen('php://output', 'w');
                if ($handle === false) {
                    return;
                }

                fputcsv($handle, $cached['columns']);

                foreach ($cached['rows'] as $row) {
                    fputcsv($handle, $row);
                }

                fclose($handle);
            },
            200,
            [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => "attachment; filename=\"{$filename}\"",
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
            ],
        );
    }

    /**
     * Resolve likely OMOP concepts from the question using the Solr vocabulary core.
     *
     * @return array<int, array<string, mixed>>
     */
    private function resolveConceptHints(string $question): array
    {
        $question = trim(preg_replace('/\s+/', ' ', $question) ?? '');
        if ($question === '' || ! $this->solrVocabularySearch->isAvailable()) {
            return [];
        }

        $candidates = $this->candidateConceptQueries($question);
        $concepts = collect();

        foreach ($candidates as $candidate) {
            $solrResult = $this->solrVocabularySearch->search($candidate, [
                'standard' => true,
                'exclude_invalid' => true,
            ], 5, 0);

            if ($solrResult === null) {
                continue;
            }

            $concepts = $concepts->merge($solrResult['items'] ?? []);

            if ($concepts->count() >= 5) {
                break;
            }
        }

        $resolved = $concepts
            ->map(fn (array $concept) => [
                'concept_id' => $concept['concept_id'] ?? null,
                'concept_name' => $concept['concept_name'] ?? null,
                'domain_id' => $concept['domain_id'] ?? null,
                'vocabulary_id' => $concept['vocabulary_id'] ?? null,
                'concept_code' => $concept['concept_code'] ?? null,
            ])
            ->filter(fn (array $concept) => ! empty($concept['concept_id']) && ! empty($concept['concept_name']))
            ->unique(fn (array $concept) => (string) $concept['concept_id'])
            ->take(5)
            ->values()
            ->all();

        if ($resolved !== []) {
            return $resolved;
        }

        return $this->fallbackConceptHints($question);
    }

    /**
     * Resolve relevant OHDSI query library templates for the question.
     *
     * @return array<int, array<string, mixed>>
     */
    private function resolveLibraryHints(string $question): array
    {
        $question = trim(preg_replace('/\s+/', ' ', $question) ?? '');
        if ($question === '') {
            return [];
        }

        $searchResult = $this->queryLibrarySearch->search($question, null, 3);
        $ids = collect($searchResult['items'] ?? [])
            ->pluck('id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->all();

        if ($ids === []) {
            return [];
        }

        return QueryLibraryEntry::query()
            ->whereIn('id', $ids)
            ->get()
            ->map(fn (QueryLibraryEntry $entry) => [
                'name' => $entry->name,
                'domain' => $entry->domain,
                'summary' => $entry->summary,
                'sql_template' => $entry->sql_template,
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<string>
     */
    private function candidateConceptQueries(string $question): array
    {
        $normalized = Str::lower($question);
        $normalized = preg_replace('/[^a-z0-9\s-]/', ' ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\s+/', ' ', trim($normalized)) ?? $normalized;

        $stopwords = [
            'how', 'many', 'what', 'which', 'show', 'find', 'list', 'get',
            'patients', 'patient', 'people', 'person', 'with', 'who', 'have',
            'has', 'had', 'were', 'was', 'the', 'a', 'an', 'in', 'for', 'of',
            'to', 'from', 'on', 'at', 'by', 'during', 'between', 'and', 'or',
            'count', 'counts', 'number', 'average', 'mean', 'top', 'recent',
        ];

        $tokens = array_values(array_filter(
            explode(' ', $normalized),
            fn (string $token) => $token !== '' && ! in_array($token, $stopwords, true)
        ));

        $candidates = [$question];

        $tokenCount = count($tokens);
        for ($size = min(4, $tokenCount); $size >= 1; $size--) {
            for ($i = 0; $i <= $tokenCount - $size; $i++) {
                $phrase = implode(' ', array_slice($tokens, $i, $size));
                if (mb_strlen($phrase) >= 4) {
                    $candidates[] = $phrase;
                }
            }
        }

        return array_values(array_unique(array_filter($candidates)));
    }

    /**
     * @return list<array<string, int|string|null>>
     */
    private function fallbackConceptHints(string $question): array
    {
        $normalized = Str::lower($question);

        $aliases = [
            [
                'concept_id' => 201826,
                'concept_name' => 'Type 2 diabetes mellitus',
                'domain_id' => 'Condition',
                'vocabulary_id' => 'SNOMED',
                'concept_code' => '44054006',
                'aliases' => ['diabetes', 'type 2 diabetes', 't2dm'],
            ],
            [
                'concept_id' => 313217,
                'concept_name' => 'Atrial fibrillation',
                'domain_id' => 'Condition',
                'vocabulary_id' => 'SNOMED',
                'concept_code' => '49436004',
                'aliases' => ['atrial fibrillation', 'afib', 'a-fib'],
            ],
            [
                'concept_id' => 319835,
                'concept_name' => 'Congestive heart failure',
                'domain_id' => 'Condition',
                'vocabulary_id' => 'SNOMED',
                'concept_code' => '42343007',
                'aliases' => ['heart failure', 'congestive heart failure', 'chf'],
            ],
            [
                'concept_id' => 255573,
                'concept_name' => 'Chronic obstructive lung disease',
                'domain_id' => 'Condition',
                'vocabulary_id' => 'SNOMED',
                'concept_code' => '13645005',
                'aliases' => ['copd', 'chronic obstructive pulmonary disease'],
            ],
            [
                'concept_id' => 4329847,
                'concept_name' => 'Myocardial infarction',
                'domain_id' => 'Condition',
                'vocabulary_id' => 'SNOMED',
                'concept_code' => '22298006',
                'aliases' => ['myocardial infarction', 'heart attack', 'mi'],
            ],
            [
                'concept_id' => 1503297,
                'concept_name' => 'Metformin',
                'domain_id' => 'Drug',
                'vocabulary_id' => 'RxNorm',
                'concept_code' => '6809',
                'aliases' => ['metformin'],
            ],
            [
                'concept_id' => 1539403,
                'concept_name' => 'Lisinopril',
                'domain_id' => 'Drug',
                'vocabulary_id' => 'RxNorm',
                'concept_code' => '29046',
                'aliases' => ['lisinopril'],
            ],
            [
                'concept_id' => 1307046,
                'concept_name' => 'Warfarin',
                'domain_id' => 'Drug',
                'vocabulary_id' => 'RxNorm',
                'concept_code' => '11289',
                'aliases' => ['warfarin'],
            ],
            [
                'concept_id' => 3013682,
                'concept_name' => 'Hemoglobin A1c/Hemoglobin.total in Blood',
                'domain_id' => 'Measurement',
                'vocabulary_id' => 'LOINC',
                'concept_code' => '4548-4',
                'aliases' => ['hba1c', 'a1c', 'hemoglobin a1c'],
            ],
            [
                'concept_id' => 3004249,
                'concept_name' => 'Systolic blood pressure',
                'domain_id' => 'Measurement',
                'vocabulary_id' => 'LOINC',
                'concept_code' => '8480-6',
                'aliases' => ['systolic blood pressure', 'sbp'],
            ],
            [
                'concept_id' => 3012888,
                'concept_name' => 'Diastolic blood pressure',
                'domain_id' => 'Measurement',
                'vocabulary_id' => 'LOINC',
                'concept_code' => '8462-4',
                'aliases' => ['diastolic blood pressure', 'dbp'],
            ],
        ];

        foreach ($aliases as $alias) {
            foreach ($alias['aliases'] as $needle) {
                if (str_contains($normalized, $needle)) {
                    unset($alias['aliases']);

                    return [$alias];
                }
            }
        }

        return [];
    }
}
