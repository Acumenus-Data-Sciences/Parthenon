<?php

test('health endpoint returns ok', function () {
    $response = $this->getJson('/api/health');

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
                'r_runtime',
            ],
        ]);
});
