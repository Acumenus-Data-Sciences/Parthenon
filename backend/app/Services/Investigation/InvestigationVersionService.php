<?php

namespace App\Services\Investigation;

use App\Models\App\Investigation;
use App\Models\App\InvestigationVersion;
use Illuminate\Database\Eloquent\Collection;

class InvestigationVersionService
{
    public function createSnapshot(Investigation $investigation, int $userId): InvestigationVersion
    {
        $maxVersion = InvestigationVersion::where('investigation_id', $investigation->id)
            ->max('version_number') ?? 0;

        $investigation->load(['pins', 'owner:id,name']);

        return InvestigationVersion::create([
            'investigation_id' => $investigation->id,
            'version_number' => $maxVersion + 1,
            'snapshot' => [
                'title' => $investigation->title,
                'research_question' => $investigation->research_question,
                'status' => $investigation->status,
                'phenotype_state' => $investigation->phenotype_state,
                'clinical_state' => $investigation->clinical_state,
                'genomic_state' => $investigation->genomic_state,
                'synthesis_state' => $investigation->synthesis_state,
                'pins' => $investigation->pins->toArray(),
                'snapshotted_at' => now()->toISOString(),
            ],
            'created_by' => $userId,
        ]);
    }

    /** @return Collection<int, InvestigationVersion> */
    public function listVersions(int $investigationId): Collection
    {
        return InvestigationVersion::where('investigation_id', $investigationId)
            ->with('creator:id,name')
            ->orderByDesc('version_number')
            ->get();
    }

    public function getVersion(int $investigationId, int $versionNumber): ?InvestigationVersion
    {
        return InvestigationVersion::where('investigation_id', $investigationId)
            ->where('version_number', $versionNumber)
            ->with('creator:id,name')
            ->first();
    }
}
