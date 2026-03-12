<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\CohortDefinition;
use App\Models\App\PhenotypeLibraryEntry;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Phenotype Library', weight: 217)]
class PhenotypeLibraryController extends Controller
{
    /**
     * List phenotypes with search and filtering.
     */
    public function index(Request $request): JsonResponse
    {
        $query = PhenotypeLibraryEntry::query();

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('cohort_name', 'ilike', "%{$search}%")
                    ->orWhere('description', 'ilike', "%{$search}%");
            });
        }

        if ($domain = $request->input('domain')) {
            $query->where('domain', $domain);
        }

        if ($request->boolean('has_expression')) {
            $query->whereNotNull('expression_json');
        }

        $phenotypes = $query->orderBy('cohort_name')
            ->paginate($request->input('per_page', 25));

        return response()->json($phenotypes);
    }

    /**
     * Get a single phenotype by OHDSI cohort ID.
     */
    public function show(int $cohortId): JsonResponse
    {
        $entry = PhenotypeLibraryEntry::where('cohort_id', $cohortId)->firstOrFail();

        return response()->json(['data' => $entry]);
    }

    /**
     * Import a phenotype as a local cohort definition.
     */
    public function import(Request $request, int $cohortId): JsonResponse
    {
        $entry = PhenotypeLibraryEntry::where('cohort_id', $cohortId)->firstOrFail();

        if (! $entry->expression_json) {
            return response()->json([
                'error' => 'No cohort expression available for this phenotype',
            ], 422);
        }

        $cohort = CohortDefinition::create([
            'name' => $entry->cohort_name,
            'description' => "Imported from OHDSI PhenotypeLibrary (ID: {$entry->cohort_id}). ".($entry->description ?? ''),
            'expression_json' => $entry->expression_json,
            'created_by' => $request->user()?->id,
        ]);

        $entry->update([
            'is_imported' => true,
            'imported_cohort_id' => $cohort->id,
        ]);

        return response()->json([
            'data' => $cohort,
            'message' => "Phenotype '{$entry->cohort_name}' imported as cohort definition #{$cohort->id}",
        ], 201);
    }

    /**
     * Get available domains for filtering.
     */
    public function domains(): JsonResponse
    {
        $domains = PhenotypeLibraryEntry::whereNotNull('domain')
            ->distinct()
            ->pluck('domain')
            ->sort()
            ->values();

        return response()->json(['data' => $domains]);
    }

    /**
     * Get library statistics.
     */
    public function stats(): JsonResponse
    {
        return response()->json([
            'data' => [
                'total' => PhenotypeLibraryEntry::count(),
                'with_expression' => PhenotypeLibraryEntry::whereNotNull('expression_json')->count(),
                'imported' => PhenotypeLibraryEntry::where('is_imported', true)->count(),
                'domains' => PhenotypeLibraryEntry::whereNotNull('domain')->distinct()->count('domain'),
            ],
        ]);
    }
}
