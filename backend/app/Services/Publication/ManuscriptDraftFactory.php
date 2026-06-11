<?php

namespace App\Services\Publication;

use App\Models\App\PublicationDraft;
use App\Models\App\Study;

/**
 * Seeds a /publish editorial draft from a study's composed manuscript — the
 * data bridge behind "Open in Publisher". The ManuscriptComposer is the
 * canonical, gate-aware first draft (withheld estimates are already blinded in
 * its output); this factory maps that output into the publish DocumentJson and
 * persists it as a study-linked draft so the editorial workspace starts from
 * the curated, gate-respecting text instead of an empty picker.
 *
 * Idempotent: a user's existing composer-seeded draft for the study is reused
 * (never re-seeded over their edits) rather than duplicated.
 */
class ManuscriptDraftFactory
{
    public const SOURCE = 'study_manuscript';

    public function __construct(private readonly ManuscriptComposer $composer) {}

    public function findOrCreate(Study $study, ?int $userId): PublicationDraft
    {
        $existing = PublicationDraft::query()
            ->where('study_id', $study->id)
            ->where('source', self::SOURCE)
            ->when($userId !== null, fn ($q) => $q->where('user_id', $userId))
            ->orderByDesc('updated_at')
            ->first();

        if ($existing !== null) {
            $existing->forceFill(['last_opened_at' => now()])->save();

            return $existing;
        }

        return $this->create($study, $userId);
    }

    public function create(Study $study, ?int $userId): PublicationDraft
    {
        $document = $this->composer->compose($study);

        return PublicationDraft::create([
            'user_id' => $userId,
            'study_id' => $study->id,
            'title' => (string) ($document['title'] ?? $study->title),
            'template' => 'generic-ohdsi',
            'source' => self::SOURCE,
            'document_json' => $this->toDocumentJson($document),
            'status' => 'draft',
            'visibility' => 'study',
            'last_opened_at' => now(),
        ]);
    }

    /**
     * Map a composed ManuscriptDocument into the publish DocumentJson the wizard
     * hydrates from. Composer prose becomes each section's starting narrative;
     * withheld estimates are already absent from that prose (gate-blinded).
     *
     * @param  array<string, mixed>  $document
     * @return array<string, mixed>
     */
    private function toDocumentJson(array $document): array
    {
        $sections = [];
        foreach (is_array($document['sections'] ?? null) ? $document['sections'] : [] as $section) {
            if (! is_array($section) || ($section['included'] ?? true) !== true) {
                continue;
            }

            $key = (string) ($section['key'] ?? '');
            $sections[] = [
                'id' => $key !== '' ? $key : 'section-'.count($sections),
                'type' => $this->mapType($key),
                'title' => (string) ($section['title'] ?? ''),
                'content' => (string) ($section['content'] ?? ''),
                'included' => true,
                'narrativeIncluded' => true,
            ];
        }

        $authors = is_array($document['authors'] ?? null) ? array_values($document['authors']) : [];

        return [
            'version' => 1,
            'title' => (string) ($document['title'] ?? ''),
            'authors' => $authors,
            'template' => 'generic-ohdsi',
            'step' => 2,
            'selectedExecutions' => [],
            'sections' => $sections,
        ];
    }

    /**
     * Map a composer section key to the publish DraftSection type enum
     * (introduction|methods|results|discussion|diagram).
     */
    private function mapType(string $key): string
    {
        return match ($key) {
            'methods' => 'methods',
            'results' => 'results',
            'limitations', 'provenance' => 'discussion',
            default => 'introduction', // abstract, introduction, and any others
        };
    }
}
