<?php

namespace Tests\Unit\Exceptions;

use App\Exceptions\RequiresPromotionException;
use Tests\TestCase;

class RequiresPromotionExceptionTest extends TestCase
{
    public function test_renders_409_with_contract_body(): void
    {
        $exc = new RequiresPromotionException(itemType: 'cohort_definition', itemId: 42, itemName: 'CHF v3');
        $response = $exc->render(request());

        $this->assertSame(409, $response->status());

        /** @var array<string, mixed> $payload */
        $payload = $response->getData(true);
        $this->assertTrue($payload['requires_promotion']);
        $this->assertSame('cohort_definition', $payload['item_type']);
        $this->assertSame(42, $payload['item_id']);
        $this->assertSame('CHF v3', $payload['item_name']);
        $this->assertArrayHasKey('message', $payload);
    }
}
