<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\GenomicCohortCriterion;
use App\Models\App\GenomicUpload;
use App\Models\App\GenomicVariant;
use App\Models\App\Source;
use App\Services\Genomics\OmopMeasurementWriterService;
use App\Services\Genomics\PersonMatcherService;
use App\Services\Genomics\VcfParserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class GenomicsController extends Controller
{
    public function __construct(
        private readonly VcfParserService $parser,
        private readonly PersonMatcherService $matcher,
        private readonly OmopMeasurementWriterService $writer,
    ) {}

    // ──────────────────────────────────────────────────────────────────────────
    // Stats
    // ──────────────────────────────────────────────────────────────────────────

    public function stats(): JsonResponse
    {
        $stats = [
            'total_uploads' => GenomicUpload::count(),
            'total_variants' => GenomicVariant::count(),
            'mapped_variants' => GenomicVariant::where('mapping_status', 'mapped')->count(),
            'review_required' => GenomicVariant::where('mapping_status', 'review')->count(),
            'uploads_by_status' => GenomicUpload::selectRaw('status, count(*) as count')
                ->groupBy('status')
                ->pluck('count', 'status'),
            'top_genes' => GenomicVariant::selectRaw('gene_symbol, count(*) as count')
                ->whereNotNull('gene_symbol')
                ->groupBy('gene_symbol')
                ->orderByDesc('count')
                ->limit(10)
                ->pluck('count', 'gene_symbol'),
        ];

        return response()->json(['data' => $stats]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Uploads
    // ──────────────────────────────────────────────────────────────────────────

    public function indexUploads(Request $request): JsonResponse
    {
        $query = GenomicUpload::with(['creator:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('source_id')) {
            $query->where('source_id', $request->integer('source_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        $uploads = $query->paginate($request->integer('per_page', 20));

        return response()->json($uploads);
    }

    public function uploadFile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
            'file' => 'required|file|max:204800', // 200 MB
            'file_format' => 'required|string|in:vcf,maf,cbio_maf,fhir_genomics',
            'genome_build' => 'nullable|string|in:GRCh38,GRCh37,hg38,hg19',
            'sample_id' => 'nullable|string|max:200',
        ]);

        $file = $request->file('file');
        $path = $file->store('genomics/uploads', 'local');

        $upload = GenomicUpload::create([
            'source_id' => $validated['source_id'],
            'created_by' => Auth::id(),
            'filename' => $file->getClientOriginalName(),
            'file_format' => $validated['file_format'],
            'file_size_bytes' => $file->getSize(),
            'status' => 'parsing',
            'genome_build' => $validated['genome_build'] ?? null,
            'sample_id' => $validated['sample_id'] ?? null,
            'storage_path' => $path,
        ]);

        // Parse synchronously for files under 10 MB; otherwise dispatch job
        $absolutePath = Storage::disk('local')->path($path);
        if ($file->getSize() < 10 * 1024 * 1024) {
            try {
                $result = $this->parser->parse($upload, $absolutePath);
                $upload->update([
                    'status' => 'mapped',
                    'total_variants' => $result['total'],
                    'mapped_variants' => 0, // OMOP mapping runs separately
                    'review_required' => 0,
                    'parsed_at' => now(),
                ]);
            } catch (\Throwable $e) {
                $upload->update([
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                ]);
            }
        }

        $upload->load('creator:id,name');

        return response()->json(['data' => $upload], 201);
    }

    public function showUpload(GenomicUpload $upload): JsonResponse
    {
        $upload->load('creator:id,name');

        return response()->json(['data' => $upload]);
    }

    public function destroyUpload(GenomicUpload $upload): JsonResponse
    {
        if ($upload->storage_path) {
            Storage::disk('local')->delete($upload->storage_path);
        }
        $upload->variants()->delete();
        $upload->delete();

        return response()->json(null, 204);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Variants
    // ──────────────────────────────────────────────────────────────────────────

    public function indexVariants(Request $request): JsonResponse
    {
        $query = GenomicVariant::orderByDesc('created_at');

        if ($request->filled('upload_id')) {
            $query->where('upload_id', $request->integer('upload_id'));
        }
        if ($request->filled('source_id')) {
            $query->where('source_id', $request->integer('source_id'));
        }
        if ($request->filled('gene')) {
            $query->where('gene_symbol', $request->string('gene'));
        }
        if ($request->filled('clinvar_significance')) {
            $query->where('clinvar_significance', 'ilike', '%' . $request->string('clinvar_significance') . '%');
        }
        if ($request->filled('mapping_status')) {
            $query->where('mapping_status', $request->string('mapping_status'));
        }

        $variants = $query->paginate($request->integer('per_page', 50));

        return response()->json($variants);
    }

    public function showVariant(GenomicVariant $variant): JsonResponse
    {
        return response()->json(['data' => $variant]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Import pipeline actions
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Step 1: Match upload variants to OMOP person records.
     * Call after upload completes (status=mapped) before import.
     */
    public function matchPersons(GenomicUpload $upload): JsonResponse
    {
        $source = $upload->source;
        $connectionName = 'cdm'; // resolved from source daimon in full implementation
        $schema = 'omop';

        $result = $this->matcher->matchUpload($upload, $connectionName, $schema);

        return response()->json(['data' => $result]);
    }

    /**
     * Step 2: Write matched variants to OMOP MEASUREMENT table.
     * Requires at least some variants to have person_id set (via matchPersons).
     */
    public function importToOmop(GenomicUpload $upload): JsonResponse
    {
        if (!in_array($upload->status, ['mapped', 'review'], true)) {
            return response()->json(['message' => 'Upload must be in mapped or review status to import'], 422);
        }

        $result = $this->writer->writeUploadToOmop($upload);

        $upload->refresh();

        return response()->json([
            'data' => [
                'upload' => $upload,
                'result' => $result,
            ],
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Genomic cohort criteria
    // ──────────────────────────────────────────────────────────────────────────

    public function indexCriteria(Request $request): JsonResponse
    {
        $userId = Auth::id();
        $criteria = GenomicCohortCriterion::where(function ($q) use ($userId) {
            $q->where('created_by', $userId)->orWhere('is_shared', true);
        })
            ->when($request->filled('type'), fn ($q) => $q->where('criteria_type', $request->string('type')))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $criteria]);
    }

    public function storeCriterion(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:200',
            'criteria_type' => 'required|string|in:gene_mutation,tmb,msi,fusion,pathogenicity,treatment_episode',
            'criteria_definition' => 'required|array',
            'description' => 'nullable|string',
            'is_shared' => 'boolean',
        ]);

        $criterion = GenomicCohortCriterion::create([
            ...$validated,
            'created_by' => Auth::id(),
        ]);

        return response()->json(['data' => $criterion], 201);
    }

    public function updateCriterion(Request $request, GenomicCohortCriterion $criterion): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:200',
            'criteria_type' => 'sometimes|string|in:gene_mutation,tmb,msi,fusion,pathogenicity,treatment_episode',
            'criteria_definition' => 'sometimes|array',
            'description' => 'nullable|string',
            'is_shared' => 'sometimes|boolean',
        ]);

        $criterion->update($validated);

        return response()->json(['data' => $criterion]);
    }

    public function destroyCriterion(GenomicCohortCriterion $criterion): JsonResponse
    {
        $criterion->delete();

        return response()->json(null, 204);
    }
}
