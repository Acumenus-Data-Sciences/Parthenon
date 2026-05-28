<?php

namespace App\Http\Controllers\Api\V1\Library;

use App\Http\Controllers\Controller;
use App\Http\Requests\Library\BulkArchiveRequest;
use App\Models\App\Characterization;
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
        'characterizations' => Characterization::class,
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

    public function bulkArchive(BulkArchiveRequest $request, string $entity): JsonResponse
    {
        return $this->bulk($request, $entity, 'archive', fn ($item, $user) => $item->archive($user));
    }

    public function bulkRestore(BulkArchiveRequest $request, string $entity): JsonResponse
    {
        return $this->bulk($request, $entity, 'restoreLifecycle', fn ($item, $user) => $item->restore_lifecycle($user));
    }

    private function bulk(BulkArchiveRequest $request, string $entity, string $ability, \Closure $action): JsonResponse
    {
        abort_unless(isset(self::ENTITY_MAP[$entity]), 404);

        /** @var class-string<Model> $class */
        $class = self::ENTITY_MAP[$entity];
        /** @var array<int, int> $ids */
        $ids = $request->input('ids');

        $items = $class::query()
            ->withoutGlobalScope(LibraryDefaultScope::class)
            ->whereIn('id', $ids)
            ->get();

        $done = [];
        $skipped = [];

        foreach ($items as $item) {
            if ($request->user()->can($ability, $item)) {
                $action($item, $request->user());
                $done[] = $item->id;
            } else {
                $skipped[] = $item->id;
            }
        }

        $missing = array_values(array_diff($ids, $items->pluck('id')->all()));

        return response()->json([
            'done' => $done,
            'skipped' => $skipped,
            'missing' => $missing,
        ]);
    }

    private function resolve(string $entity, int $id): Model
    {
        abort_unless(isset(self::ENTITY_MAP[$entity]), 404);

        /** @var class-string<Model> $class */
        $class = self::ENTITY_MAP[$entity];

        return $class::query()->withoutGlobalScope(LibraryDefaultScope::class)->findOrFail($id);
    }
}
