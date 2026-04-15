<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Models\App\FinnGen\Run;
use App\Services\FinnGen\FinnGenArtifactService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ArtifactController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly FinnGenArtifactService $svc,
    ) {}

    public function show(Request $request, Run $run, string $key): Response
    {
        $this->authorize('view', $run);

        $path = $this->svc->resolvePath($run, $key);
        $filename = basename($path);

        return $this->svc->respond($path, $filename);
    }
}
