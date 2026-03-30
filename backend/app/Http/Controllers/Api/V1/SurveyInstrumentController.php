<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\Api\StoreSurveyInstrumentRequest;
use App\Http\Requests\Api\StoreSurveyItemRequest;
use App\Models\Survey\SurveyAnswerOption;
use App\Models\Survey\SurveyInstrument;
use App\Models\Survey\SurveyItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

/**
 * @group Survey Instruments
 *
 * CRUD and browsing for the Standard PROs+ instrument library.
 */
class SurveyInstrumentController extends Controller
{
    /**
     * GET /v1/survey-instruments
     *
     * List all instruments with filtering and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = SurveyInstrument::query()->active();

        if ($request->filled('domain')) {
            $query->byDomain($request->input('domain'));
        }

        if ($request->filled('omop_coverage')) {
            $query->where('omop_coverage', $request->input('omop_coverage'));
        }

        if ($request->filled('license_type')) {
            $query->where('license_type', $request->input('license_type'));
        }

        if ($request->boolean('has_loinc')) {
            $query->withLoinc();
        }

        if ($request->filled('search')) {
            $term = $request->input('search');
            $query->where(function ($q) use ($term) {
                $q->where('name', 'ilike', "%{$term}%")
                    ->orWhere('abbreviation', 'ilike', "%{$term}%")
                    ->orWhere('domain', 'ilike', "%{$term}%");
            });
        }

        $sortField = $request->input('sort', 'domain');
        $sortDir = $request->input('dir', 'asc');
        $allowedSorts = ['name', 'abbreviation', 'domain', 'item_count', 'omop_coverage', 'license_type', 'created_at'];
        if (in_array($sortField, $allowedSorts, true)) {
            $query->orderBy($sortField, $sortDir === 'desc' ? 'desc' : 'asc');
        }

        $perPage = min($request->integer('per_page', 100), 200);

        $instruments = $query->withCount('items')->paginate($perPage);

        return response()->json($instruments);
    }

    /**
     * GET /v1/survey-instruments/domains
     *
     * List all domains with instrument counts.
     */
    public function domains(): JsonResponse
    {
        $domains = SurveyInstrument::query()
            ->active()
            ->selectRaw('domain, count(*) as instrument_count')
            ->groupBy('domain')
            ->orderBy('instrument_count', 'desc')
            ->get();

        return response()->json(['domains' => $domains]);
    }

    /**
     * GET /v1/survey-instruments/stats
     *
     * Summary statistics for the instrument library.
     */
    public function stats(): JsonResponse
    {
        $instruments = SurveyInstrument::query()->active();

        $total = (clone $instruments)->count();
        $domains = (clone $instruments)->distinct('domain')->count('domain');
        $withLoinc = (clone $instruments)->whereNotNull('loinc_panel_code')->count();
        $withSnomed = (clone $instruments)->where('has_snomed', true)->count();
        $fullOmop = (clone $instruments)->where('omop_coverage', 'yes')->count();
        $partialOmop = (clone $instruments)->where('omop_coverage', 'partial')->count();
        $noOmop = (clone $instruments)->where('omop_coverage', 'no')->count();
        $publicDomain = (clone $instruments)->where('is_public_domain', true)->count();
        $withItems = SurveyItem::distinct('survey_instrument_id')->count('survey_instrument_id');
        $totalItems = SurveyItem::count();
        $totalAnswerOptions = SurveyAnswerOption::count();
        $itemsWithSnomed = SurveyItem::whereNotNull('snomed_code')->count();
        $answersWithSnomed = SurveyAnswerOption::whereNotNull('snomed_code')->count();
        $itemsWithLoinc = SurveyItem::whereNotNull('loinc_code')->count();
        $answersWithLoinc = SurveyAnswerOption::whereNotNull('loinc_la_code')->count();

        return response()->json([
            'total_instruments' => $total,
            'domains' => $domains,
            'with_loinc' => $withLoinc,
            'with_snomed' => $withSnomed,
            'full_omop' => $fullOmop,
            'partial_omop' => $partialOmop,
            'no_omop' => $noOmop,
            'public_domain' => $publicDomain,
            'instruments_with_items' => $withItems,
            'total_items' => $totalItems,
            'total_answer_options' => $totalAnswerOptions,
            'items_with_loinc' => $itemsWithLoinc,
            'items_with_snomed' => $itemsWithSnomed,
            'answers_with_loinc' => $answersWithLoinc,
            'answers_with_snomed' => $answersWithSnomed,
        ]);
    }

    /**
     * GET /v1/survey-instruments/{instrument}
     *
     * Show a single instrument with all items and answer options.
     */
    public function show(SurveyInstrument $instrument): JsonResponse
    {
        $instrument->load([
            'items.answerOptions',
            'creator:id,name',
        ]);

        $instrument->loadCount('conductRecords');

        return response()->json($instrument);
    }

    /**
     * POST /v1/survey-instruments
     *
     * Create a new instrument.
     */
    public function store(StoreSurveyInstrumentRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['created_by'] = $request->user()?->id;

        $instrument = SurveyInstrument::create($data);

        return response()->json($instrument, 201);
    }

    /**
     * PUT /v1/survey-instruments/{instrument}
     *
     * Update an instrument.
     */
    public function update(StoreSurveyInstrumentRequest $request, SurveyInstrument $instrument): JsonResponse
    {
        $instrument->update($request->validated());

        return response()->json($instrument);
    }

    /**
     * DELETE /v1/survey-instruments/{instrument}
     *
     * Soft-delete an instrument.
     */
    public function destroy(SurveyInstrument $instrument): JsonResponse
    {
        $instrument->delete();

        return response()->json(null, 204);
    }

    /**
     * POST /v1/survey-instruments/{instrument}/clone
     *
     * Clone an instrument with all items and answer options.
     */
    public function clone(Request $request, SurveyInstrument $instrument): JsonResponse
    {
        $instrument->load('items.answerOptions');

        $clone = SurveyInstrument::create([
            'name' => $request->string('name')->toString() ?: "{$instrument->name} Copy",
            'abbreviation' => $request->string('abbreviation')->toString() ?: "{$instrument->abbreviation}_COPY_".now()->format('His'),
            'version' => $instrument->version,
            'description' => $instrument->description,
            'domain' => $instrument->domain,
            'item_count' => $instrument->item_count,
            'scoring_method' => $instrument->scoring_method,
            'loinc_panel_code' => $instrument->loinc_panel_code,
            'snomed_code' => $instrument->snomed_code,
            'omop_concept_id' => $instrument->omop_concept_id,
            'license_type' => $instrument->license_type,
            'license_detail' => $instrument->license_detail,
            'is_public_domain' => $instrument->is_public_domain,
            'is_active' => true,
            'omop_coverage' => $instrument->omop_coverage,
            'has_snomed' => $instrument->has_snomed,
            'created_by' => $request->user()?->id,
        ]);

        foreach ($instrument->items as $item) {
            $clonedItem = $clone->items()->create([
                'item_number' => $item->item_number,
                'item_text' => $item->item_text,
                'response_type' => $item->response_type,
                'omop_concept_id' => $item->omop_concept_id,
                'loinc_code' => $item->loinc_code,
                'snomed_code' => $item->snomed_code,
                'subscale_name' => $item->subscale_name,
                'is_reverse_coded' => $item->is_reverse_coded,
                'min_value' => $item->min_value,
                'max_value' => $item->max_value,
                'display_order' => $item->display_order,
            ]);

            foreach ($item->answerOptions as $option) {
                $clonedItem->answerOptions()->create([
                    'option_text' => $option->option_text,
                    'option_value' => $option->option_value,
                    'omop_concept_id' => $option->omop_concept_id,
                    'loinc_la_code' => $option->loinc_la_code,
                    'snomed_code' => $option->snomed_code,
                    'display_order' => $option->display_order,
                ]);
            }
        }

        return response()->json($clone->load('items.answerOptions'), 201);
    }

    // ── Item management ──────────────────────────────────────────────────

    /**
     * GET /v1/survey-instruments/{instrument}/items
     *
     * List all items for an instrument with answer options.
     */
    public function itemIndex(SurveyInstrument $instrument): JsonResponse
    {
        $items = $instrument->items()->with('answerOptions')->get();

        return response()->json(['items' => $items]);
    }

    /**
     * POST /v1/survey-instruments/{instrument}/items
     *
     * Add an item to an instrument.
     */
    public function itemStore(StoreSurveyItemRequest $request, SurveyInstrument $instrument): JsonResponse
    {
        $data = $request->validated();
        $answerOptions = $data['answer_options'] ?? [];
        unset($data['answer_options']);

        $item = $instrument->items()->create($data);

        foreach ($answerOptions as $option) {
            $item->answerOptions()->create($option);
        }

        $instrument->update(['item_count' => $instrument->items()->count()]);

        $item->load('answerOptions');

        return response()->json($item, 201);
    }

    /**
     * PUT /v1/survey-instruments/{instrument}/items/{item}
     *
     * Update an item.
     */
    public function itemUpdate(StoreSurveyItemRequest $request, SurveyInstrument $instrument, SurveyItem $item): JsonResponse
    {
        $data = $request->validated();
        $answerOptions = $data['answer_options'] ?? null;
        unset($data['answer_options']);

        $item->update($data);

        if ($answerOptions !== null) {
            $item->answerOptions()->delete();
            foreach ($answerOptions as $option) {
                $item->answerOptions()->create($option);
            }
        }

        $item->load('answerOptions');

        return response()->json($item);
    }

    /**
     * DELETE /v1/survey-instruments/{instrument}/items/{item}
     *
     * Delete an item (cascades answer options).
     */
    public function itemDestroy(SurveyInstrument $instrument, SurveyItem $item): JsonResponse
    {
        $item->delete();
        $instrument->update(['item_count' => $instrument->items()->count()]);

        return response()->json(null, 204);
    }
}
