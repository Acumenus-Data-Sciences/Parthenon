<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;

/**
 * Phase 3 Plan 7 Task 2 (T-024B): approve a Harmonia rerank suggestion.
 *
 * Validates that the chosen concept_id exists in vocab.concept and is a
 * standard concept (standard_concept = 'S', invalid_reason IS NULL). The
 * Plan 6 migration intentionally drops the DB-level FK from
 * app.parthenon_concept_map.omop_concept_id to vocab.concept(concept_id)
 * because vocab.* is reseeded via TRUNCATE; that means the standard-concept
 * check MUST live in the app layer, here.
 */
class HarmoniaApproveMappingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'concept_id' => ['required', 'integer', 'min:1'],
            'confidence_override' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            if ($v->errors()->has('concept_id')) {
                return;
            }
            $conceptId = (int) $this->input('concept_id');
            // Fully-qualified vocab.concept query on the default connection
            // so the lookup shares the test transaction (Pest seeds via the
            // same default connection). Production search_path includes vocab
            // for unqualified table names but the schema-qualified form works
            // on every connection regardless.
            $concept = DB::selectOne(
                'SELECT concept_id FROM vocab.concept
                 WHERE concept_id = ? AND invalid_reason IS NULL AND standard_concept = ?',
                [$conceptId, 'S'],
            );
            if ($concept === null) {
                $v->errors()->add(
                    'concept_id',
                    'The chosen concept_id must reference a non-invalid standard OMOP concept (standard_concept = \'S\').',
                );
            }
        });
    }
}
