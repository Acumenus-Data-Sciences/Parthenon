<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Templates\TemplateRegistryClient;
use Illuminate\Http\JsonResponse;

class TemplatesController extends Controller
{
    public function __construct(private readonly TemplateRegistryClient $registry) {}

    public function index(): JsonResponse
    {
        return response()->json($this->registry->listTemplates());
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->registry->getTemplate($id));
    }
}
