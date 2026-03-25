<?php

namespace App\Services\Ares;

use App\Models\App\ChartAnnotation;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;

class AnnotationService
{
    /**
     * Create a chart annotation attributed to the given user.
     */
    public function create(User $user, array $data): ChartAnnotation
    {
        return ChartAnnotation::create([
            ...$data,
            'created_by' => $user->id,
        ]);
    }

    /**
     * Get annotations for a specific chart type and optional source.
     * Eager-loads the creator and orders by x_value.
     *
     * @return Collection<int, ChartAnnotation>
     */
    public function forChart(string $chartType, ?int $sourceId = null): Collection
    {
        return ChartAnnotation::query()
            ->with('creator')
            ->where('chart_type', $chartType)
            ->when($sourceId !== null, fn ($q) => $q->where('source_id', $sourceId))
            ->orderBy('x_value')
            ->get();
    }

    /**
     * Update an annotation. Only the creator may edit.
     *
     * @throws AuthorizationException
     */
    public function update(User $user, ChartAnnotation $annotation, array $data): ChartAnnotation
    {
        if ($user->id !== $annotation->created_by) {
            throw new AuthorizationException('Only the annotation creator can edit it.');
        }

        $annotation->update($data);

        return $annotation->fresh() ?? $annotation;
    }

    /**
     * Delete an annotation. Creator or admin/super-admin may delete.
     *
     * @throws AuthorizationException
     */
    public function delete(User $user, ChartAnnotation $annotation): void
    {
        $isCreator = $user->id === $annotation->created_by;
        $isAdmin = $user->hasRole(['admin', 'super-admin']);

        if (! $isCreator && ! $isAdmin) {
            throw new AuthorizationException('You do not have permission to delete this annotation.');
        }

        $annotation->delete();
    }

    /**
     * Get all annotations for a specific source, eager-loading creator.
     *
     * @return Collection<int, ChartAnnotation>
     */
    public function allForSource(int $sourceId, ?string $tag = null, ?string $search = null): Collection
    {
        return ChartAnnotation::query()
            ->with('creator')
            ->where('source_id', $sourceId)
            ->when($tag, fn ($q) => $q->where('tag', $tag))
            ->when($search, fn ($q) => $q->where('annotation_text', 'ilike', '%'.$search.'%'))
            ->orderBy('x_value')
            ->get();
    }

    /**
     * Get all annotations across the network, eager-loading creator and source.
     *
     * @return Collection<int, ChartAnnotation>
     */
    public function allForNetwork(?string $tag = null, ?string $search = null): Collection
    {
        return ChartAnnotation::query()
            ->with(['creator', 'source'])
            ->when($tag, fn ($q) => $q->where('tag', $tag))
            ->when($search, fn ($q) => $q->where('annotation_text', 'ilike', '%'.$search.'%'))
            ->orderBy('x_value')
            ->get();
    }
}
