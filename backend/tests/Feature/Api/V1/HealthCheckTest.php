<?php

// Both the canonical /api/health and its backward-compatible /api/v1/health alias
// must return 200 with the same shape. If the alias route is ever dropped or the
// health route regresses, this fails — and the reference guard
// (scripts/checks/check_health_urls.py) then flags any consumer still on the
// dropped path. Add a path here whenever a new health route is added in api.php.
dataset('health_paths', ['/api/health', '/api/v1/health']);

test('health endpoint returns ok', function (string $path) {
    $response = $this->getJson($path);

    $response->assertStatus(200)
        ->assertJsonPath('status', 'ok')
        ->assertJsonPath('service', 'parthenon-api')
        ->assertJsonStructure([
            'status',
            'service',
            'version',
            'timestamp',
            'services' => [
                'database',
                'redis',
                'ai',
                'darkstar',
            ],
        ]);
})->with('health_paths');
