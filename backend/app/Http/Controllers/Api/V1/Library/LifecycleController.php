<?php

namespace App\Http\Controllers\Api\V1\Library;

use App\Http\Controllers\Controller;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\FeatureAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use App\Models\App\SelfControlledCohortAnalysis;
use App\Scopes\LibraryDefaultScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LifecycleController extends Controller
{
    use AuthorizesRequests;

    private const ENTITY_MAP = [
        'concept-sets' => ConceptSet::class,
        'cohort-definitions' => CohortDefinition::class,
        'incidence-rate-analyses' => IncidenceRateAnalysis::class,
        'pathway-analyses' => PathwayAnalysis::class,
        'estimation-analyses' => EstimationAnalysis::class,
        'prediction-analyses' => PredictionAnalysis::class,
        'feature-analyses' => FeatureAnalysis::class,
        'sccs-analyses' => SccsAnalysis::class,
        'evidence-synthesis-analyses' => EvidenceSynthesisAnalysis::class,
        'self-controlled-cohort-analyses' => SelfControlledCohortAnalysis::class,
    ];

    public function promote(Request $request, string $entity, int $id): JsonResponse
    {
        $item = $this->resolve($entity, $id);
        $this->authorize('promote', $item);
        $item->promote($request->user()); // @phpstan-ignore-line — trait method

        return response()->json(['id' => $item->id, 'status' => $item->status->value]);
    }

    public function archive(Request $request, string $entity, int $id): JsonResponse
    {
        $item = $this->resolve($entity, $id);
        $this->authorize('archive', $item);
        $item->archive($request->user()); // @phpstan-ignore-line — trait method

        return response()->json(['id' => $item->id, 'status' => $item->status->value]);
    }

    public function restore(Request $request, string $entity, int $id): JsonResponse
    {
        $item = $this->resolve($entity, $id);
        $this->authorize('restoreLifecycle', $item);
        $item->restore_lifecycle($request->user()); // @phpstan-ignore-line — trait method

        return response()->json(['id' => $item->id, 'status' => $item->status->value]);
    }

    private function resolve(string $entity, int $id): Model
    {
        abort_unless(isset(self::ENTITY_MAP[$entity]), 404);

        /** @var class-string<Model> $class */
        $class = self::ENTITY_MAP[$entity];

        return $class::query()->withoutGlobalScope(LibraryDefaultScope::class)->findOrFail($id);
    }
}
