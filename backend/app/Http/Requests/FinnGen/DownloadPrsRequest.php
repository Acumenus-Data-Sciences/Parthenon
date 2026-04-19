<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Phase 17 GENOMICS-08 D-14 — validates the score_id route segment for
 * GET /cohort-definitions/{id}/prs/{scoreId}/download. Route already constrains
 * scoreId via ->where() regex; this FormRequest is the belt-and-suspenders
 * check (HIGHSEC §5.3 defense-in-depth) and the single place downstream
 * controllers can rely on for the authorize gate.
 */
final class DownloadPrsRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && $user->can('profiles.view');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'scoreId' => ['required', 'string', 'regex:/^PGS\d{6,}$/'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['scoreId' => $this->route('scoreId')]);
    }
}
