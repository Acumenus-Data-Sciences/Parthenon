<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Log;

class GisEtlController extends Controller
{
    private const SCRIPTS_DIR = '/home/smudoshi/Github/Parthenon/scripts/gis';

    private const VALID_STEPS = [
        'svi' => 'load_svi.py',
        'rucc' => 'load_rucc.py',
        'air-quality' => 'load_air_quality.py',
        'hospitals' => 'load_hospitals.py',
        'crosswalk' => 'load_crosswalk.py',
        'all' => 'load_all.py',
    ];

    /**
     * Trigger an ETL load step. Runs synchronously (these are admin-triggered, not user-facing).
     */
    public function load(Request $request, string $step): JsonResponse
    {
        if (!isset(self::VALID_STEPS[$step])) {
            return response()->json(['error' => "Invalid ETL step: {$step}"], 422);
        }

        $script = self::SCRIPTS_DIR . '/' . self::VALID_STEPS[$step];

        Log::info("GIS ETL triggered", ['step' => $step, 'script' => $script]);

        $result = Process::timeout(600)->run("python3 {$script}");

        if ($result->failed()) {
            Log::error("GIS ETL failed", ['step' => $step, 'output' => $result->errorOutput()]);
            return response()->json([
                'error' => 'ETL step failed',
                'step' => $step,
                'output' => $result->errorOutput(),
            ], 500);
        }

        return response()->json([
            'data' => [
                'step' => $step,
                'status' => 'completed',
                'output' => $result->output(),
            ],
        ]);
    }

    /**
     * Get ETL status / validation report.
     */
    public function status(): JsonResponse
    {
        $script = self::SCRIPTS_DIR . '/load_all.py';
        $result = Process::timeout(30)->run("python3 {$script} --step 5");

        return response()->json([
            'data' => [
                'status' => $result->successful() ? 'ok' : 'error',
                'output' => $result->output(),
            ],
        ]);
    }
}
