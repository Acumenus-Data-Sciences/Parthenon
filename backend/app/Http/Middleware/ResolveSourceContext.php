<?php

namespace App\Http\Middleware;

use App\Context\SourceContext;
use App\Models\App\Source;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveSourceContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $source = $this->resolveSource($request);

        if ($source !== null) {
            SourceContext::forSource($source);
        }

        return $next($request);
    }

    private function resolveSource(Request $request): ?Source
    {
        // Priority 1: Route parameter {source} (implicit model binding)
        $routeSource = $request->route('source');
        if ($routeSource instanceof Source) {
            return $routeSource;
        }

        // Priority 2: X-Source-Id header
        $headerId = $request->header('X-Source-Id');
        if ($headerId !== null && is_numeric($headerId)) {
            return Source::with('daimons')->find((int) $headerId);
        }

        return null;
    }
}
