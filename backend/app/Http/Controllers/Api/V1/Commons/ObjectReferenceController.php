<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\Commons\ObjectReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Commons
 */
class ObjectReferenceController extends Controller
{
    /**
     * Search platform objects for the reference picker.
     * Returns matching objects across cohort_definition, concept_set, study, source.
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|min:2|max:100',
            'type' => 'sometimes|string|in:cohort_definition,concept_set,study,source',
        ]);

        $q = $request->input('q');
        $type = $request->input('type');
        $results = [];

        if (! $type || $type === 'cohort_definition') {
            $cohorts = CohortDefinition::where('name', 'ilike', "%{$q}%")
                ->limit(5)
                ->get(['id', 'name', 'description', 'created_at']);

            foreach ($cohorts as $c) {
                $results[] = [
                    'type' => 'cohort_definition',
                    'id' => $c->id,
                    'name' => $c->name,
                    'description' => $c->description,
                    'url' => "/cohort-definitions/{$c->id}",
                ];
            }
        }

        if (! $type || $type === 'concept_set') {
            $conceptSets = ConceptSet::where('name', 'ilike', "%{$q}%")
                ->limit(5)
                ->get(['id', 'name', 'description', 'created_at']);

            foreach ($conceptSets as $cs) {
                $results[] = [
                    'type' => 'concept_set',
                    'id' => $cs->id,
                    'name' => $cs->name,
                    'description' => $cs->description,
                    'url' => "/concept-sets/{$cs->id}",
                ];
            }
        }

        if (! $type || $type === 'study') {
            $studies = Study::where('title', 'ilike', "%{$q}%")
                ->limit(5)
                ->get(['id', 'title', 'description', 'status', 'created_at']);

            foreach ($studies as $s) {
                $results[] = [
                    'type' => 'study',
                    'id' => $s->id,
                    'name' => $s->title,
                    'description' => $s->description,
                    'status' => $s->status,
                    'url' => "/studies/{$s->id}",
                ];
            }
        }

        if (! $type || $type === 'source') {
            $sources = Source::where('source_name', 'ilike', "%{$q}%")
                ->limit(5)
                ->get(['source_id', 'source_name', 'source_key']);

            foreach ($sources as $src) {
                $results[] = [
                    'type' => 'source',
                    'id' => $src->source_id,
                    'name' => $src->source_name,
                    'description' => "Key: {$src->source_key}",
                    'url' => "/data-sources/{$src->source_id}",
                ];
            }
        }

        return response()->json(['data' => $results]);
    }

    /**
     * Get all messages that reference a specific object.
     */
    public function discussions(string $type, int $id): JsonResponse
    {
        $refs = ObjectReference::where('referenceable_type', $type)
            ->where('referenceable_id', $id)
            ->with(['message.user:id,name', 'message.channel:id,slug'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        $messages = $refs->map(fn (ObjectReference $ref) => [
            'id' => $ref->message->id,
            'body' => $ref->message->body,
            'user' => $ref->message->user,
            'channel' => $ref->message->channel,
            'created_at' => $ref->message->created_at,
        ]);

        return response()->json(['data' => $messages]);
    }
}
