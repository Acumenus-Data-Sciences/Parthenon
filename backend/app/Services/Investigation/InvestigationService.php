<?php

namespace App\Services\Investigation;

use App\Models\App\Investigation;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class InvestigationService
{
    /** @return LengthAwarePaginator<int, Investigation> */
    public function listForUser(int $userId, ?string $status = null, int $perPage = 20): LengthAwarePaginator
    {
        $query = Investigation::where('owner_id', $userId)
            ->orderByDesc('updated_at');

        if ($status !== null) {
            $query->where('status', $status);
        }

        return $query->paginate($perPage);
    }

    /** @param array<string, mixed> $data */
    public function create(int $userId, array $data): Investigation
    {
        return Investigation::create([
            'title' => $data['title'],
            'research_question' => $data['research_question'] ?? null,
            'status' => 'draft',
            'owner_id' => $userId,
            'phenotype_state' => [],
            'clinical_state' => [],
            'genomic_state' => [],
            'synthesis_state' => [],
        ]);
    }

    /** @param array<string, mixed> $data */
    public function update(Investigation $investigation, array $data, int $userId): Investigation
    {
        $updateData = array_filter($data, fn ($v) => $v !== null);
        $updateData['last_modified_by'] = $userId;

        if (isset($updateData['status']) && $updateData['status'] === 'complete') {
            $updateData['completed_at'] = now();
        }

        $investigation->update($updateData);

        return $investigation->fresh() ?? $investigation;
    }

    /** @param array<string, mixed> $state */
    public function saveDomainState(Investigation $investigation, string $domain, array $state, int $userId): Investigation
    {
        $column = $domain.'_state';

        $investigation->update([
            $column => $state,
            'last_modified_by' => $userId,
        ]);

        if ($investigation->status === 'draft') {
            $investigation->update(['status' => 'active']);
        }

        return $investigation->fresh() ?? $investigation;
    }

    public function delete(Investigation $investigation): void
    {
        $investigation->update(['status' => 'archived']);
    }
}
