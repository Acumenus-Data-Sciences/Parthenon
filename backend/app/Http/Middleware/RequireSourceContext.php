<?php

namespace App\Http\Middleware;

use App\Context\SourceContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireSourceContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $ctx = app(SourceContext::class);

        if ($ctx->source === null) {
            return response()->json([
                'message' => 'Source context required. Pass a source route parameter or X-Source-Id header.',
            ], 422);
        }

        return $next($request);
    }
}
