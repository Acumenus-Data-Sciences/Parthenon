<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\System;

use App\FeatureFlags\FeatureFlagResolver;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * @group System
 *
 * Returns the active deployment-level feature flags.
 *
 * Flags reflect installed drivers / license / EE registrations — they do
 * NOT carry per-user RBAC. The endpoint is intentionally unauthenticated
 * (per Plan 02-06) because every CE deployment ships an effectively-empty
 * flag set and the response only describes capability presence, not data.
 */
class FeatureFlagsController extends Controller
{
    /**
     * GET /api/v1/system/feature-flags
     *
     * Response shape:
     *  {
     *    "data": [
     *      { "name": "tenancy.multi", "enabled": false, "source": "ce", "description": "..." }
     *    ]
     *  }
     */
    public function index(FeatureFlagResolver $resolver): JsonResponse
    {
        $flags = array_map(
            static fn ($f) => $f->toArray(),
            $resolver->resolve(),
        );

        return response()->json(['data' => $flags]);
    }
}
