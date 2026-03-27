<?php

namespace App\Console\Commands;

use App\Models\App\SourceDaimon;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

class AuditSourceSchemas extends Command
{
    protected $signature = 'source:audit-schemas';

    protected $description = 'Detect CDM/Results schema conflicts between registered sources';

    public function handle(): int
    {
        $conflicts = 0;

        foreach (['cdm', 'results'] as $type) {
            $duplicates = SourceDaimon::where('daimon_type', $type)
                ->whereHas('source')
                ->with('source:id,source_name')
                ->get()
                ->groupBy('table_qualifier')
                ->filter(fn (Collection $group) => $group->count() > 1);

            foreach ($duplicates as $schema => $daimons) {
                $conflicts++;
                $sources = $daimons->map(fn ($d) => ($d->source?->source_name ?? 'Unknown')." (ID {$d->source_id})")->join(', ');
                $this->error("CONFLICT: {$type} schema '{$schema}' shared by: {$sources}");
            }
        }

        if ($conflicts === 0) {
            $this->info('No schema conflicts detected. All CDM and Results schemas are unique per source.');

            return self::SUCCESS;
        }

        $this->warn("{$conflicts} conflict(s) found. Each source must have its own CDM and Results schemas.");

        return self::FAILURE;
    }
}
