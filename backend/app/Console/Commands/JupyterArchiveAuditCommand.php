<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class JupyterArchiveAuditCommand extends Command
{
    protected $signature = 'jupyter:archive-audit {--days=90 : Archive records older than N days}';

    protected $description = 'Move old Jupyter audit log records to the archive table';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $cutoff = now()->subDays($days);

        DB::statement('
            WITH moved AS (
                DELETE FROM app.jupyter_audit_log
                WHERE created_at < ?
                RETURNING *
            )
            INSERT INTO app.jupyter_audit_log_archive
            SELECT * FROM moved
        ', [$cutoff]);

        $this->info("Archived audit records older than {$days} days.");

        return self::SUCCESS;
    }
}
