<?php

use App\Services\Analysis\Calibration\CalibrationService;
use Illuminate\Support\Facades\Http;

/**
 * R<->PHP contract test for the empirical-calibration boundary (ADR-0020
 * Phase 2). Fakes the darkstar /analysis/calibrate endpoint and asserts the
 * service posts the agreed payload shape and faithfully surfaces the calibrated
 * result, the insufficient-controls refusal, and the non-JSON error fallback —
 * without inventing a calibrated estimate.
 */
beforeEach(function () {
    config([
        'services.darkstar.url' => 'http://darkstar.test:8787',
        'services.darkstar.timeout' => 30,
    ]);
});

it('posts estimates, controls and min_controls to /analysis/calibrate and returns the calibrated payload', function () {
    Http::fake(['*/analysis/calibrate' => Http::response([
        'status' => 'completed',
        'calibrated_estimates' => [[
            'outcome_id' => 1,
            'calibrated_hr' => 1.32,
            'cal_ci_lower' => 0.91,
            'cal_ci_upper' => 1.93,
            'calibrated_p' => 0.14,
        ]],
        'systematic_error_model' => ['mean' => 0.05, 'sd' => 0.12],
        'ease' => 0.11,
        'informative_negative_controls' => 7,
        'calibration_plot' => [],
    ], 200)]);

    $result = app(CalibrationService::class)->calibrate(
        estimates: [['outcome_id' => 1, 'log_hr' => 0.30, 'se_log_hr' => 0.20]],
        negativeControls: array_map(
            fn (int $i): array => ['log_rr' => 0.0, 'se_log_rr' => 0.10],
            range(1, 7),
        ),
    );

    expect($result['status'])->toBe('completed')
        ->and($result['calibrated_estimates'][0]['calibrated_hr'])->toBe(1.32)
        ->and($result['ease'])->toBe(0.11)
        ->and($result['systematic_error_model']['sd'])->toBe(0.12);

    Http::assertSent(function ($request) {
        return str_ends_with($request->url(), '/analysis/calibrate')
            && $request['min_controls'] === CalibrationService::MIN_CONTROLS
            && count($request['negative_controls']) === 7
            && $request['estimates'][0]['outcome_id'] === 1;
    });
});

it('surfaces insufficient_controls without fabricating a calibrated estimate', function () {
    Http::fake(['*/analysis/calibrate' => Http::response([
        'status' => 'insufficient_controls',
        'informative_negative_controls' => 2,
        'calibrated_estimates' => [],
        'message' => 'Need at least 5 informative negative controls.',
    ], 200)]);

    $result = app(CalibrationService::class)->calibrate(
        estimates: [['outcome_id' => 1, 'log_hr' => 0.30, 'se_log_hr' => 0.20]],
        negativeControls: [
            ['log_rr' => 0.0, 'se_log_rr' => 0.10],
            ['log_rr' => 0.1, 'se_log_rr' => 0.10],
        ],
    );

    expect($result['status'])->toBe('insufficient_controls')
        ->and($result['calibrated_estimates'])->toBe([]);
});

it('returns the RService error fallback on a non-JSON darkstar response', function () {
    Http::fake(['*/analysis/calibrate' => Http::response('502 Bad Gateway', 502)]);

    $result = app(CalibrationService::class)->calibrate(
        estimates: [['outcome_id' => 1, 'log_hr' => 0.30, 'se_log_hr' => 0.20]],
        negativeControls: [],
    );

    expect($result['status'])->toBe('error')
        ->and($result['message'])->toContain('HTTP 502');
});
