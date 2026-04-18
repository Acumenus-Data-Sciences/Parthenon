<?php

use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function studyContractUser(string $locale = 'en-US'): User
{
    $user = User::factory()->create(['locale' => $locale]);
    $user->assignRole('researcher');

    return $user;
}

function studyContractStudy(User $user, string $title = 'Message Contract Study'): Study
{
    return Study::create([
        'title' => $title,
        'description' => 'A study for localized API message contract tests.',
        'study_type' => 'cohort',
        'status' => 'draft',
        'created_by' => $user->id,
    ]);
}

it('adds localized message contract metadata when creating studies', function () {
    $user = studyContractUser('es-ES');

    $this->actingAs($user)
        ->postJson('/api/v1/studies', [
            'title' => 'Contrato de Mensajes',
            'study_type' => 'cohort',
            'description' => 'A localized contract smoke test.',
        ])
        ->assertCreated()
        ->assertJsonPath('message', 'Estudio creado.')
        ->assertJsonPath('message_key', 'study.created')
        ->assertJsonPath('message_meta.requested_locale', 'es-ES')
        ->assertJsonPath('message_meta.message_locale', 'es-ES')
        ->assertJsonPath('message_meta.fallback_used', false)
        ->assertJsonPath('data.title', 'Contrato de Mensajes');
});

it('adds localized message params when transitioning studies', function () {
    $user = studyContractUser('ko-KR');
    $study = studyContractStudy($user);

    $this->actingAs($user)
        ->postJson("/api/v1/studies/{$study->slug}/transition", [
            'status' => 'protocol_development',
        ])
        ->assertOk()
        ->assertJsonPath('message', "연구가 'protocol_development' 상태로 전환되었습니다.")
        ->assertJsonPath('message_key', 'study.transitioned')
        ->assertJsonPath('message_params.status', 'protocol_development')
        ->assertJsonPath('message_meta.requested_locale', 'ko-KR')
        ->assertJsonPath('message_meta.fallback_used', false)
        ->assertJsonPath('data.status', 'protocol_development');
});

it('returns stable localized keys for invalid study transitions', function () {
    $user = studyContractUser('es-ES');
    $study = studyContractStudy($user);

    $this->actingAs($user)
        ->postJson("/api/v1/studies/{$study->slug}/transition", [
            'status' => 'published',
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Transición de estado no válida.')
        ->assertJsonPath('message_key', 'study.errors.invalid_status_transition')
        ->assertJsonPath('message_meta.requested_locale', 'es-ES')
        ->assertJsonPath('message_meta.fallback_used', false)
        ->assertJsonStructure(['detail', 'allowed_transitions']);
});

it('returns stable localized keys when removing an analysis from the wrong study', function () {
    $user = studyContractUser('es-ES');
    $study = studyContractStudy($user, 'Primary Study');
    $otherStudy = studyContractStudy($user, 'Other Study');
    $studyAnalysis = StudyAnalysis::create([
        'study_id' => $otherStudy->id,
        'analysis_type' => 'App\\Models\\App\\Characterization',
        'analysis_id' => 999,
    ]);

    $this->actingAs($user)
        ->deleteJson("/api/v1/studies/{$study->slug}/analyses/{$studyAnalysis->id}")
        ->assertStatus(404)
        ->assertJsonPath('message', 'El análisis no pertenece a este estudio.')
        ->assertJsonPath('message_key', 'study.analysis_not_in_study')
        ->assertJsonPath('message_meta.requested_locale', 'es-ES')
        ->assertJsonPath('message_meta.fallback_used', false);
});
