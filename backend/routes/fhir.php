<?php

use App\Http\Controllers\Api\V1\FhirR4Controller;
use Illuminate\Support\Facades\Route;

// Public endpoint — no auth required
Route::get('fhir/metadata', [FhirR4Controller::class, 'metadata']);

// FHIR R4 read/search — requires auth
Route::middleware(['auth:sanctum', 'throttle:fhir'])->prefix('fhir')->group(function () {
    $resourceTypes = ['Patient', 'Condition', 'Encounter', 'Observation',
        'MedicationStatement', 'Procedure', 'Immunization', 'AllergyIntolerance'];

    foreach ($resourceTypes as $type) {
        Route::get($type, [FhirR4Controller::class, 'search'])->defaults('type', $type);
        Route::get("{$type}/{id}", [FhirR4Controller::class, 'read'])->defaults('type', $type);
    }
});
