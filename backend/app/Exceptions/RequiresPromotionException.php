<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class RequiresPromotionException extends RuntimeException
{
    public function __construct(
        public readonly string $itemType,
        public readonly int $itemId,
        public readonly string $itemName,
    ) {
        parent::__construct("Draft item {$itemType}#{$itemId} requires promotion before attach.");
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'requires_promotion' => true,
            'item_type' => $this->itemType,
            'item_id' => $this->itemId,
            'item_name' => $this->itemName,
            'message' => 'This draft must be promoted to Active before it can be attached.',
        ], 409);
    }
}
