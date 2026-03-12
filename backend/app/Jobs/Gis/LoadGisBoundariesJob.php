<?php

namespace App\Jobs\Gis;

use App\Models\App\GisDataset;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class LoadGisBoundariesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 1800;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    /**
     * @param  list<string>  $levels
     * @param  list<string>|null  $countryCodes
     */
    public function __construct(
        public GisDataset $dataset,
        public string $source,
        public array $levels,
        public ?array $countryCodes = null,
    ) {
        $this->onQueue('gis');
    }

    public function handle(): void
    {
        $scriptPath = base_path('../scripts/load-gis-boundaries.py');

        if (! file_exists($scriptPath)) {
            $this->dataset->update([
                'status' => 'failed',
                'error_message' => "Loader script not found: {$scriptPath}",
                'completed_at' => now(),
            ]);
            $this->dataset->appendLog("ERROR: Script not found at {$scriptPath}");

            return;
        }

        $this->dataset->update([
            'status' => 'running',
            'started_at' => now(),
        ]);
        $this->dataset->appendLog('Starting GIS boundary load via local script...');
        $this->dataset->appendLog("Source: {$this->source} | Levels: ".implode(', ', $this->levels));

        $command = ['python3', $scriptPath, '--source', $this->source, '--levels', ...$this->levels];

        $process = new Process($command);
        $process->setTimeout($this->timeout);

        $totalFeatures = 0;
        $currentLevel = null;
        $totalLevels = count($this->levels);
        $completedLevels = 0;

        try {
            $process->start();

            // Read stdout line by line for real-time progress
            foreach ($process as $type => $data) {
                if ($type !== Process::OUT) {
                    // stderr — log but don't parse
                    Log::warning('GIS loader stderr', ['output' => $data]);

                    continue;
                }

                // Each line is a JSON event from the script
                foreach (explode("\n", trim($data)) as $line) {
                    $line = trim($line);
                    if ($line === '') {
                        continue;
                    }

                    $event = json_decode($line, true);
                    if (! $event || ! isset($event['event'])) {
                        $this->dataset->appendLog($line);

                        continue;
                    }

                    $this->handleEvent($event, $totalFeatures, $currentLevel, $completedLevels, $totalLevels);
                }
            }

            $exitCode = $process->getExitCode();

            if ($exitCode !== 0) {
                $stderr = $process->getErrorOutput();
                $this->dataset->appendLog("Script exited with code {$exitCode}");
                if ($stderr) {
                    $this->dataset->appendLog('stderr: '.substr($stderr, 0, 2000));
                }
                $this->dataset->update([
                    'status' => 'failed',
                    'error_message' => "Script exited with code {$exitCode}",
                    'completed_at' => now(),
                ]);

                return;
            }

            $this->dataset->update([
                'status' => 'completed',
                'completed_at' => now(),
                'feature_count' => $totalFeatures,
                'progress_percentage' => 100,
            ]);
            $this->dataset->appendLog("Load complete. Total features: {$totalFeatures}");

            Log::info('GIS boundary load completed', [
                'dataset_id' => $this->dataset->id,
                'total_features' => $totalFeatures,
            ]);
        } catch (\Throwable $e) {
            Log::error('GIS boundary load failed', [
                'dataset_id' => $this->dataset->id,
                'error' => $e->getMessage(),
            ]);

            $this->dataset->appendLog('Error: '.$e->getMessage());
            $this->dataset->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'completed_at' => now(),
            ]);
        }
    }

    /**
     * Handle a JSON event line from the loader script.
     */
    private function handleEvent(array $event, int &$totalFeatures, ?string &$currentLevel, int &$completedLevels, int $totalLevels): void
    {
        switch ($event['event']) {
            case 'start':
                $this->dataset->appendLog("Starting {$event['source']} load for levels: ".implode(', ', $event['levels']));
                break;

            case 'reading':
                $currentLevel = $event['level'];
                $this->dataset->appendLog("Reading {$currentLevel} from source file...");
                break;

            case 'read_done':
                $count = $event['count'] ?? 0;
                $seconds = $event['seconds'] ?? '?';
                $this->dataset->appendLog("Read {$count} {$currentLevel} features in {$seconds}s");
                break;

            case 'inserting':
                $total = $event['total'] ?? 0;
                $this->dataset->appendLog("Inserting {$total} {$currentLevel} boundaries into PostGIS...");
                break;

            case 'batch':
                $loaded = $event['loaded'] ?? 0;
                $total = $event['total'] ?? 0;
                // Calculate overall progress: completed levels + fraction of current level
                $levelProgress = $total > 0 ? ($loaded / $total) : 1;
                $overallProgress = (($completedLevels + $levelProgress) / $totalLevels) * 100;
                $this->dataset->update([
                    'progress_percentage' => (int) round($overallProgress),
                ]);
                $this->dataset->appendLog("{$currentLevel}: {$loaded}/{$total} features loaded");
                break;

            case 'level_done':
                $count = $event['count'] ?? 0;
                $totalFeatures += $count;
                $completedLevels++;
                $overallProgress = ($completedLevels / $totalLevels) * 100;
                $this->dataset->update([
                    'progress_percentage' => (int) round($overallProgress),
                    'feature_count' => $totalFeatures,
                ]);
                $this->dataset->appendLog("{$currentLevel} complete: {$count} features loaded");
                break;

            case 'done':
                $totalFeatures = $event['total'] ?? $totalFeatures;
                $this->dataset->appendLog("Script finished. Total: {$totalFeatures} features");
                break;

            case 'error':
                $message = $event['message'] ?? 'Unknown error';
                $this->dataset->appendLog("ERROR: {$message}");
                $this->dataset->update([
                    'status' => 'failed',
                    'error_message' => $message,
                    'completed_at' => now(),
                ]);
                break;
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error('GIS boundary load job failed', [
            'dataset_id' => $this->dataset->id,
            'error' => $e->getMessage(),
        ]);

        $this->dataset->update([
            'status' => 'failed',
            'error_message' => $e->getMessage(),
            'completed_at' => now(),
        ]);
        $this->dataset->appendLog('Job failed: '.$e->getMessage());
    }
}
