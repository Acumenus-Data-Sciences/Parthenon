<?php

namespace App\Services\Investigation;

use App\Models\App\EvidencePin;
use App\Models\App\Investigation;
use Illuminate\Database\Eloquent\Collection;

class EvidencePinService
{
    /** @return Collection<int, EvidencePin> */
    public function listForInvestigation(int $investigationId): Collection
    {
        return EvidencePin::where('investigation_id', $investigationId)
            ->orderBy('section')
            ->orderBy('sort_order')
            ->get();
    }

    /** @param array<string, mixed> $data */
    public function create(Investigation $investigation, array $data): EvidencePin
    {
        $maxOrder = EvidencePin::where('investigation_id', $investigation->id)
            ->where('section', $data['section'])
            ->max('sort_order') ?? -1;

        return EvidencePin::create([
            'investigation_id' => $investigation->id,
            'domain' => $data['domain'],
            'section' => $data['section'],
            'finding_type' => $data['finding_type'],
            'finding_payload' => $data['finding_payload'],
            'sort_order' => $maxOrder + 1,
            'is_key_finding' => $data['is_key_finding'] ?? false,
        ]);
    }

    /** @param array<string, mixed> $data */
    public function update(EvidencePin $pin, array $data): EvidencePin
    {
        $pin->update(array_filter($data, fn ($v) => $v !== null));

        return $pin->fresh() ?? $pin;
    }

    public function delete(EvidencePin $pin): void
    {
        $pin->delete();
    }
}
