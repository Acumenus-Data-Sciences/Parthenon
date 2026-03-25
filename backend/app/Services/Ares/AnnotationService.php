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
            ->with(['creator', 'replies.creator'])
            ->whereNull('parent_id')
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
            ->with(['creator', 'replies.creator'])
            ->whereNull('parent_id')
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
            ->with(['creator', 'source', 'replies.creator'])
            ->whereNull('parent_id')
            ->when($tag, fn ($q) => $q->where('tag', $tag))
            ->when($search, fn ($q) => $q->where('annotation_text', 'ilike', '%'.$search.'%'))
            ->orderBy('x_value')
            ->get();
    }

    /**
     * Get annotations in chronological timeline format for a specific source.
     *
     * @return array<int, array{id: int, date: string, text: string, tag: string|null, source_name: string, chart_type: string, creator_name: string}>
     */
    public function timeline(int $sourceId): array
    {
        $annotations = ChartAnnotation::query()
            ->with(['creator', 'source', 'replies.creator'])
            ->where('source_id', $sourceId)
            ->whereNull('parent_id')
            ->orderByDesc('created_at')
            ->get();

        return $annotations->map(fn (ChartAnnotation $ann) => [
            'id' => $ann->id,
            'date' => $ann->created_at->toIso8601String(),
            'text' => $ann->annotation_text,
            'tag' => $ann->tag,
            'source_name' => $ann->source?->source_name ?? 'Unknown',
            'chart_type' => $ann->chart_type,
            'creator_name' => $ann->creator?->name ?? 'System',
            'replies' => $ann->replies->map(fn (ChartAnnotation $reply) => [
                'id' => $reply->id,
                'text' => $reply->annotation_text,
                'creator_name' => $reply->creator?->name ?? 'System',
                'date' => $reply->created_at->toIso8601String(),
            ])->toArray(),
        ])->toArray();
    }

    /**
     * Search annotations across sources with optional filters.
     *
     * @return Collection<int, ChartAnnotation>
     */
    public function searchAnnotations(string $query, ?int $sourceId = null, ?string $tag = null): Collection
    {
        return ChartAnnotation::query()
            ->with(['creator', 'source'])
            ->where('annotation_text', 'ilike', '%'.$query.'%')
            ->when($sourceId, fn ($q) => $q->where('source_id', $sourceId))
            ->when($tag, fn ($q) => $q->where('tag', $tag))
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();
    }
}
