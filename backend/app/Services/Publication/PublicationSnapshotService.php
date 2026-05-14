<?php

namespace App\Services\Publication;

use App\Models\App\PublicationDraft;
use App\Models\App\PublicationReportBundle;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PublicationSnapshotService
{
    public function create(
        PublicationDraft $draft,
        User $user,
        string $label,
        ?string $comment = null,
        ?string $idempotencyKey = null,
    ): PublicationReportBundle {
        if ($idempotencyKey !== null) {
            $existing = PublicationReportBundle::query()
                ->where('publication_draft_id', $draft->id)
                ->where('direction', 'snapshot')
                ->where('metadata_json->idempotency_key', $idempotencyKey)
                ->where('created_at', '>=', now()->subSeconds(5))
                ->first();
            if ($existing !== null) {
                return $existing;
            }
        }

        /** @var array<string, mixed> $documentJson */
        $documentJson = $draft->document_json ?? [];

        return PublicationReportBundle::create([
            'publication_draft_id' => $draft->id,
            'user_id' => $user->id,
            'direction' => 'snapshot',
            'format' => 'snapshot',
            'bundle_json' => array_merge(
                $documentJson,
                [
                    '_frozen_title' => $draft->title,
                    '_frozen_template' => $draft->template,
                ],
            ),
            'metadata_json' => array_filter([
                'snapshot_label' => $label,
                'comment' => $comment,
                'idempotency_key' => $idempotencyKey,
                'created_by_user_id' => $user->id,
            ], fn ($v) => $v !== null),
        ]);
    }

    public function revert(PublicationDraft $draft, PublicationReportBundle $snapshot, User $user): PublicationDraft
    {
        return DB::transaction(function () use ($draft, $snapshot, $user) {
            // Auto-snapshot current state first
            $this->create($draft, $user, 'Before revert (auto)');

            /** @var array<string, mixed> $bundle */
            $bundle = $snapshot->bundle_json ?? [];
            $documentJson = collect($bundle)
                ->except(['_frozen_title', '_frozen_template'])
                ->all();

            $draft->update([
                'title' => $bundle['_frozen_title'] ?? $draft->title,
                'template' => $bundle['_frozen_template'] ?? $draft->template,
                'document_json' => $documentJson,
                'last_opened_at' => now(),
            ]);

            return $draft->fresh() ?? $draft;
        });
    }
}
