<?php

declare(strict_types=1);

namespace App\Console\Commands\Templates;

use App\Models\App\NoteNlpAudit;
use Illuminate\Console\Command;

/**
 * Prune raw_input from app.note_nlp_audit rows past their 30-day TTL
 * (Phase 2 Plan 1, decision Q5). The audit metadata (token offsets,
 * concept mappings, model_name, prompt_version) is preserved for replay;
 * only the raw clinical-note text is truncated to NULL after retention.
 *
 * Scheduled daily in routes/console.php or app/Console/Kernel.php.
 */
class PruneNoteNlpAuditCommand extends Command
{
    protected $signature = 'templates:prune-note-nlp-audit';

    protected $description = 'Truncate raw_input on note_nlp_audit rows past their 30-day TTL.';

    public function handle(): int
    {
        $pruned = NoteNlpAudit::query()
            ->where('ttl_at', '<', now())
            ->whereNotNull('raw_input')
            ->update(['raw_input' => null]);

        $this->info("pruned raw_input on {$pruned} rows");

        return self::SUCCESS;
    }
}
