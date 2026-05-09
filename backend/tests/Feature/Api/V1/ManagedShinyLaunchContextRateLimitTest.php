<?php

declare(strict_types=1);

it('rate limits the public managed Shiny launch-context resolver by client ip', function () {
    config()->set('services.shiny_proxy.launch_context_rate_limit_per_minute', 2);

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.44'])
        ->postJson('/api/v1/shiny/launch-context', [
            'launch_token' => 'not-a-valid-token',
        ])
        ->assertUnauthorized();

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.44'])
        ->postJson('/api/v1/shiny/launch-context', [
            'launch_token' => 'not-a-valid-token',
        ])
        ->assertUnauthorized();

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.44'])
        ->postJson('/api/v1/shiny/launch-context', [
            'launch_token' => 'not-a-valid-token',
        ])
        ->assertTooManyRequests();
});
