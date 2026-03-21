<?php

namespace App\Services\Investigation;

use App\Models\App\Investigation;
use Illuminate\Support\Facades\View;

class InvestigationExportService
{
    /**
     * Build structured JSON export.
     *
     * @return array<string, mixed>
     */
    public function toJson(Investigation $investigation): array
    {
        $investigation->load(['pins', 'owner:id,name', 'versions']);

        $meta = [
            'id' => $investigation->id,
            'title' => $investigation->title,
            'research_question' => $investigation->research_question,
            'status' => $investigation->status,
            'owner' => $investigation->owner?->name,
            'exported_at' => now()->toISOString(),
            'version' => $investigation->versions->first()?->version_number ?? 0,
        ];

        $keyFindings = $investigation->pins
            ->filter(fn ($pin) => $pin->is_key_finding)
            ->values()
            ->toArray();

        $domainKeys = ['phenotype', 'clinical', 'genomic', 'synthesis'];
        $sections = [];

        foreach ($domainKeys as $domain) {
            $stateKey = $domain.'_state';
            $state = $investigation->$stateKey;
            $domainPins = $investigation->pins
                ->filter(fn ($pin) => $pin->domain === $domain)
                ->values()
                ->toArray();

            $sections[$domain] = [
                'state' => $state,
                'narrative' => null,
                'pins' => $domainPins,
            ];
        }

        return [
            'meta' => $meta,
            'key_findings' => $keyFindings,
            'sections' => $sections,
        ];
    }

    /**
     * Render investigation dossier as HTML (for PDF generation or direct display).
     */
    public function toPdfHtml(Investigation $investigation): string
    {
        $data = $this->toJson($investigation);

        return View::make('exports.investigation-dossier', $data)->render();
    }

    /**
     * Generate PDF binary using DOMPDF if available, otherwise null.
     */
    public function toPdf(Investigation $investigation): ?string
    {
        if (! class_exists(\Dompdf\Dompdf::class)) {
            return null;
        }

        $html = $this->toPdfHtml($investigation);

        $dompdf = new \Dompdf\Dompdf;
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }
}
