<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Fhir\FhirJwksService;
use Illuminate\Http\JsonResponse;

/**
 * Public JWKS endpoint for SMART Backend Services key discovery.
 *
 * EHRs verifying our client-assertion JWTs fetch this set to find the RSA
 * public key matching the JWT header `kid`. It exposes only public key material
 * (modulus + exponent) — never private keys, never PHI.
 */
class FhirJwksController extends Controller
{
    public function index(FhirJwksService $jwks): JsonResponse
    {
        return response()
            ->json($jwks->jwks())
            ->header('Cache-Control', 'public, max-age=300');
    }
}
