<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\VsacMeasure;
use App\Models\App\VsacValueSet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * @group VSAC Reference Library
 *
 * Read-only API over the CMS VSAC value-set library ingested by
 * `php artisan vsac:ingest`. Backs concept-set / care-bundle flows that
 * want to import authoritative measure value sets and their OMOP concept
 * mappings (via the vsac_value_set_omop_concepts materialized view).
 */
class VsacController extends Controller
{
    /**
     * GET /v1/vsac/value-sets
     *
     * Paginated, searchable list of VSAC value sets. Supports filtering by
     * name (q), code system, and CMS measure.
     */
    public function valueSets(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:200'],
            'code_system' => ['nullable', 'string', 'max:80'],
            'cms_id' => ['nullable', 'string', 'max:50'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 50);

        $query = VsacValueSet::query()
            ->select([
                'vsac_value_sets.value_set_oid',
                'vsac_value_sets.name',
                'vsac_value_sets.definition_version',
                'vsac_value_sets.expansion_version',
                'vsac_value_sets.qdm_category',
                DB::raw('(SELECT COUNT(*) FROM vsac_value_set_codes
                          WHERE vsac_value_set_codes.value_set_oid = vsac_value_sets.value_set_oid) AS code_count'),
                DB::raw('(SELECT COUNT(*) FROM vsac_value_set_omop_concepts
                          WHERE vsac_value_set_omop_concepts.value_set_oid = vsac_value_sets.value_set_oid) AS omop_concept_count'),
            ]);

        if ($q = $validated['q'] ?? null) {
            $query->where(function ($w) use ($q) {
                $w->where('name', 'ilike', "%{$q}%")
                    ->orWhere('value_set_oid', $q);
            });
        }

        if ($cs = $validated['code_system'] ?? null) {
            $query->whereExists(function ($sub) use ($cs) {
                $sub->select(DB::raw(1))
                    ->from('vsac_value_set_codes')
                    ->whereColumn('vsac_value_set_codes.value_set_oid', 'vsac_value_sets.value_set_oid')
                    ->where('vsac_value_set_codes.code_system', $cs);
            });
        }

        if ($cmsId = $validated['cms_id'] ?? null) {
            $query->whereExists(function ($sub) use ($cmsId) {
                $sub->select(DB::raw(1))
                    ->from('vsac_measure_value_sets')
                    ->whereColumn('vsac_measure_value_sets.value_set_oid', 'vsac_value_sets.value_set_oid')
                    ->where('vsac_measure_value_sets.cms_id', $cmsId);
            });
        }

        $page = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'data' => $page->items(),
            'meta' => [
                'total' => $page->total(),
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    /**
     * GET /v1/vsac/value-sets/{oid}
     */
    public function valueSet(string $oid): JsonResponse
    {
        $vs = VsacValueSet::findOrFail($oid);
        $codeCount = DB::table('vsac_value_set_codes')
            ->where('value_set_oid', $oid)->count();
        $omopCount = DB::table('vsac_value_set_omop_concepts')
            ->where('value_set_oid', $oid)->count();

        $codeSystems = DB::table('vsac_value_set_codes')
            ->select('code_system', DB::raw('COUNT(*) AS count'))
            ->where('value_set_oid', $oid)
            ->groupBy('code_system')
            ->orderByDesc('count')
            ->get();

        $measures = DB::table('vsac_measure_value_sets as mvs')
            ->join('vsac_measures as m', 'm.cms_id', '=', 'mvs.cms_id')
            ->where('mvs.value_set_oid', $oid)
            ->select('m.cms_id', 'm.cbe_number', 'm.title')
            ->get();

        return response()->json([
            'data' => [
                'value_set' => $vs,
                'code_count' => $codeCount,
                'omop_concept_count' => $omopCount,
                'code_systems' => $codeSystems,
                'linked_measures' => $measures,
            ],
        ]);
    }

    /**
     * GET /v1/vsac/value-sets/{oid}/codes
     *
     * Paginated list of VSAC codes within this value set.
     */
    public function codes(Request $request, string $oid): JsonResponse
    {
        $validated = $request->validate([
            'code_system' => ['nullable', 'string', 'max:80'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        // Validate OID exists
        VsacValueSet::findOrFail($oid);

        $perPage = (int) ($validated['per_page'] ?? 100);

        $query = DB::table('vsac_value_set_codes')
            ->where('value_set_oid', $oid);

        if ($cs = $validated['code_system'] ?? null) {
            $query->where('code_system', $cs);
        }

        $page = $query->orderBy('code_system')->orderBy('code')->paginate($perPage);

        return response()->json([
            'data' => $page->items(),
            'meta' => [
                'total' => $page->total(),
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
            ],
        ]);
    }

    /**
     * GET /v1/vsac/value-sets/{oid}/omop-concepts
     *
     * Returns VSAC codes that successfully cross-walked to OMOP concept_ids.
     * Primary path for importing a VSAC value set into a care bundle or
     * concept set: the returned concept_ids plug straight into the bundle's
     * omop_concept_ids array.
     */
    public function omopConcepts(Request $request, string $oid): JsonResponse
    {
        $validated = $request->validate([
            'vocabulary_id' => ['nullable', 'string', 'max:50'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        VsacValueSet::findOrFail($oid);

        $perPage = (int) ($validated['per_page'] ?? 500);

        $query = DB::table('vsac_value_set_omop_concepts')
            ->where('value_set_oid', $oid)
            ->select([
                'concept_id', 'concept_name', 'vocabulary_id',
                'code', 'code_system',
            ]);

        if ($vocab = $validated['vocabulary_id'] ?? null) {
            $query->where('vocabulary_id', $vocab);
        }

        $page = $query->orderBy('vocabulary_id')->orderBy('concept_name')->paginate($perPage);

        return response()->json([
            'data' => $page->items(),
            'meta' => [
                'total' => $page->total(),
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
            ],
        ]);
    }

    /**
     * Curated topic → case-insensitive POSIX regex pattern over title.
     * Matched server-side via `title ~* ?` so the chip set in the UI
     * stays in sync with what the SQL actually filters.
     *
     * @var array<string, string>
     */
    private const MEASURE_TOPICS = [
        'diabetes' => 'diabet|glycemic|hba1c',
        'cancer_screening' => 'cancer screening|colorectal cancer screening|breast cancer|cervical cancer',
        'heart_failure' => 'heart failure|hf:|\\bhf\\b|left ventricular',
        'cardiovascular' => 'coronary|\\bcad\\b|antithrombotic|stemi|atrial fibrillation|hypertension|blood pressure',
        'preventive_care' => 'preventive care|screening for|tobacco|bmi|body mass index',
        'mental_health' => 'depression|adhd|dementia|substance use|suicide|opioid',
        'obstetric' => 'obstetric|cesarean|maternal|birth',
        'pediatric' => 'children|adolescent|child ',
        'imaging_quality' => 'radiation|imaging|optic nerve|retinopathy',
        'hospital_harm' => 'hospital harm|harm[ -]',
        'hybrid_hospital' => 'hybrid hospital',
        'oncology' => 'oncology|prostate|bladder|bone density',
        'medication_safety' => 'medication|polypharmacy|high-risk medication',
        'kidney' => 'kidney',
    ];

    /**
     * GET /v1/vsac/measures
     *
     * @queryParam q string Search across cms_id / title / cbe_number.
     * @queryParam sort string One of: cms_id, title, cbe_number, program_candidate, value_set_count. Default cms_id.
     * @queryParam direction string asc|desc. Default asc.
     * @queryParam program string Filter by program_candidate: yes|no.
     * @queryParam cbe string Filter by CBE assignment: assigned|unassigned.
     * @queryParam min_value_sets integer Only return measures with at least N value sets.
     * @queryParam topic string Filter to a curated topic (see /vsac/measures/topics for the list).
     * @queryParam per_page integer Default 100, max 200.
     */
    public function measures(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:200'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'sort' => ['nullable', 'string', Rule::in(['cms_id', 'title', 'cbe_number', 'program_candidate', 'value_set_count'])],
            'direction' => ['nullable', 'string', Rule::in(['asc', 'desc'])],
            'program' => ['nullable', 'string', Rule::in(['yes', 'no'])],
            'cbe' => ['nullable', 'string', Rule::in(['assigned', 'unassigned'])],
            'min_value_sets' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'topic' => ['nullable', 'string', Rule::in(array_keys(self::MEASURE_TOPICS))],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 100);
        $sort = $validated['sort'] ?? 'cms_id';
        $direction = $validated['direction'] ?? 'asc';

        $valueSetCountSql = '(SELECT COUNT(*) FROM vsac_measure_value_sets
                              WHERE vsac_measure_value_sets.cms_id = vsac_measures.cms_id)';

        $query = VsacMeasure::query()
            ->select([
                'vsac_measures.cms_id',
                'vsac_measures.cbe_number',
                'vsac_measures.program_candidate',
                'vsac_measures.title',
                'vsac_measures.expansion_version',
                DB::raw($valueSetCountSql.' AS value_set_count'),
            ]);

        if ($q = $validated['q'] ?? null) {
            $query->where(function ($w) use ($q) {
                $w->where('cms_id', 'ilike', "%{$q}%")
                    ->orWhere('title', 'ilike', "%{$q}%")
                    ->orWhere('cbe_number', $q);
            });
        }

        if ($topic = $validated['topic'] ?? null) {
            $query->whereRaw('title ~* ?', [self::MEASURE_TOPICS[$topic]]);
        }

        if (($program = $validated['program'] ?? null) === 'yes') {
            $query->where('program_candidate', 'Yes');
        } elseif ($program === 'no') {
            $query->where(function ($w) {
                $w->where('program_candidate', '!=', 'Yes')->orWhereNull('program_candidate');
            });
        }

        if (($cbe = $validated['cbe'] ?? null) === 'assigned') {
            $query->whereNotNull('cbe_number')
                ->where('cbe_number', '!=', '')
                ->where('cbe_number', '!=', 'Not Applicable');
        } elseif ($cbe === 'unassigned') {
            $query->where(function ($w) {
                $w->whereNull('cbe_number')
                    ->orWhere('cbe_number', '')
                    ->orWhere('cbe_number', 'Not Applicable');
            });
        }

        if (($minVs = $validated['min_value_sets'] ?? null) !== null) {
            $query->whereRaw($valueSetCountSql.' >= ?', [(int) $minVs]);
        }

        // value_set_count is a derived alias — order by the subquery directly
        // for portability across pagination wrappers.
        if ($sort === 'value_set_count') {
            $query->orderByRaw($valueSetCountSql.' '.$direction);
            // tie-break for stable ordering
            $query->orderBy('cms_id');
        } else {
            $query->orderBy($sort, $direction);
            if ($sort !== 'cms_id') {
                $query->orderBy('cms_id');
            }
        }

        $page = $query->paginate($perPage);

        return response()->json([
            'data' => $page->items(),
            'meta' => [
                'total' => $page->total(),
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'last_page' => $page->lastPage(),
                'sort' => $sort,
                'direction' => $direction,
            ],
        ]);
    }

    /**
     * GET /v1/vsac/measures/topics
     *
     * Returns the curated topic chip set with live row counts so the UI
     * can hide chips that match zero measures.
     */
    public function measureTopics(): JsonResponse
    {
        $topics = [];
        foreach (self::MEASURE_TOPICS as $key => $pattern) {
            $count = (int) DB::table('vsac_measures')
                ->whereRaw('title ~* ?', [$pattern])
                ->count();
            if ($count > 0) {
                $topics[] = [
                    'key' => $key,
                    'label' => str_replace('_', ' ', ucfirst($key)),
                    'count' => $count,
                ];
            }
        }

        return response()->json(['data' => $topics]);
    }

    /**
     * GET /v1/vsac/measures/{cms_id}
     */
    public function measure(string $cmsId): JsonResponse
    {
        $measure = VsacMeasure::findOrFail($cmsId);

        $valueSets = DB::table('vsac_measure_value_sets as mvs')
            ->join('vsac_value_sets as vs', 'vs.value_set_oid', '=', 'mvs.value_set_oid')
            ->where('mvs.cms_id', $cmsId)
            ->select([
                'vs.value_set_oid',
                'vs.name',
                'vs.qdm_category',
                DB::raw('(SELECT COUNT(*) FROM vsac_value_set_codes
                          WHERE vsac_value_set_codes.value_set_oid = vs.value_set_oid) AS code_count'),
                DB::raw('(SELECT COUNT(*) FROM vsac_value_set_omop_concepts
                          WHERE vsac_value_set_omop_concepts.value_set_oid = vs.value_set_oid) AS omop_concept_count'),
            ])
            ->orderBy('vs.name')
            ->get();

        return response()->json([
            'data' => [
                'measure' => $measure,
                'value_sets' => $valueSets,
            ],
        ]);
    }
}
