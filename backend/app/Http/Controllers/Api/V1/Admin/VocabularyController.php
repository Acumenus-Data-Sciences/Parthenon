<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\DaimonType;
use App\Http\Controllers\Controller;
use App\Jobs\Vocabulary\VocabularyImportJob;
use App\Models\App\Source;
use App\Models\App\VocabularyImport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * @group Administration
 */
class VocabularyController extends Controller
{
    /**
     * List recent vocabulary import jobs (latest 20).
     */
    public function index(): JsonResponse
    {
        $imports = VocabularyImport::with(['user:id,name,email', 'source:id,source_name,source_key'])
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        return response()->json(['data' => $imports]);
    }

    /**
     * Get a single vocabulary import record.
     */
    public function show(VocabularyImport $vocabularyImport): JsonResponse
    {
        $vocabularyImport->load(['user:id,name,email', 'source:id,source_name,source_key']);

        return response()->json(['data' => $vocabularyImport]);
    }

    /**
     * Upload an Athena vocabulary ZIP and queue an import job.
     *
     * The ZIP must be a standard Athena download containing CONCEPT.csv,
     * CONCEPT_RELATIONSHIP.csv, etc.  The import runs asynchronously.
     * Poll GET /admin/vocabulary/imports/{id} for progress.
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:zip', 'max:5120000'], // 5 GB max
            'source_id' => ['nullable', 'integer', 'exists:sources,id'],
        ]);

        $file = $request->file('file');
        $sourceId = $request->integer('source_id') ?: null;

        // Resolve the target vocab schema from the source's vocabulary daimon
        $targetSchema = null;
        if ($sourceId) {
            /** @var Source|null $source */
            $source = Source::with('daimons')->find($sourceId);
            $targetSchema = $source?->getTableQualifier(DaimonType::Vocabulary);
        }

        // Fallback: use the vocab connection's default search_path first segment
        if (! $targetSchema) {
            $searchPath = config('database.connections.vocab.search_path', 'vocab,public');
            $targetSchema = explode(',', $searchPath)[0];
        }

        // Store the ZIP under vocabulary-imports/
        $path = $file->store('vocabulary-imports', 'local');

        /** @var VocabularyImport $import */
        $import = VocabularyImport::create([
            'user_id' => $request->user()->id,
            'source_id' => $sourceId,
            'status' => 'pending',
            'progress_percentage' => 0,
            'file_name' => $file->getClientOriginalName(),
            'storage_path' => $path,
            'file_size' => $file->getSize(),
            'target_schema' => $targetSchema,
        ]);

        VocabularyImportJob::dispatch($import);

        return response()->json(['data' => $import->load('source:id,source_name,source_key')], 201);
    }

    /**
     * Cancel (delete record + stored file) for a pending import.
     */
    public function destroy(VocabularyImport $vocabularyImport): JsonResponse
    {
        if ($vocabularyImport->status === 'running') {
            return response()->json(['message' => 'Cannot cancel a running import.'], 409);
        }

        Storage::delete($vocabularyImport->storage_path);
        $vocabularyImport->delete();

        return response()->json(['message' => 'Import record deleted.']);
    }
}
