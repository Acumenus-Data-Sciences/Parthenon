<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

/**
 * Writes a deterministic JSON snapshot of all /api/v1/finngen/* routes and
 * their middleware. A downstream CI test compares against the committed
 * fixture to catch accidental contract drift.
 */
class SnapshotOpenapiCommand extends Command
{
    protected $signature = 'finngen:snapshot-openapi {--output=tests/Fixtures/finngen-routes.json}';

    protected $description = 'Write a JSON snapshot of FinnGen route manifest for drift detection';

    public function handle(): int
    {
        $manifest = [];
        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();
            if (! Str::startsWith($uri, 'api/v1/finngen')) {
                continue;
            }
            foreach ($route->methods() as $method) {
                if ($method === 'HEAD') {
                    continue;
                }
                $manifest[] = [
                    'method' => $method,
                    'path' => '/'.$uri,
                    'name' => $route->getName(),
                    'middleware' => array_values($route->gatherMiddleware()),
                    'action' => $route->getActionName(),
                ];
            }
        }

        usort($manifest, fn ($a, $b) => ($a['path'].$a['method']) <=> ($b['path'].$b['method']));

        $output = (string) $this->option('output');
        $path = base_path($output);
        @mkdir(dirname($path), 0755, true);
        file_put_contents($path, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");

        $this->info('Wrote '.count($manifest).' route entries to '.$output);

        return self::SUCCESS;
    }
}
