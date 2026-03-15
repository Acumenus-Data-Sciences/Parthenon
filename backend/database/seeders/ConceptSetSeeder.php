<?php

namespace Database\Seeders;

use App\Models\App\ConceptSet;
use App\Models\User;
use Illuminate\Database\Seeder;

class ConceptSetSeeder extends Seeder
{
    /**
     * Seed 12 sample concept sets matching the 5 sample cohort definitions.
     * Concept IDs sourced from CohortDefinitionSeeder.
     */
    public function run(): void
    {
        $adminId = User::where('email', 'admin@acumenus.net')->value('id');
        if (! $adminId) {
            $this->command->warn('Admin user not found — skipping concept set seeding.');

            return;
        }

        foreach ($this->getConceptSets($adminId) as $def) {
            $items = $def['_items'];
            unset($def['_items']);

            $cs = ConceptSet::firstOrCreate(
                ['name' => $def['name']],
                $def,
            );

            // Seed items only if the set was just created (no items yet)
            if ($cs->items()->count() === 0) {
                foreach ($items as $conceptId) {
                    $cs->items()->create([
                        'concept_id' => $conceptId,
                        'is_excluded' => false,
                        'include_descendants' => true,
                        'include_mapped' => false,
                    ]);
                }
            }
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function getConceptSets(int $adminId): array
    {
        return [
            // ── Diabetes ────────────────────────────────────────────────────
            [
                'name' => 'Type 2 Diabetes Conditions',
                'description' => 'Condition concepts for Type 2 Diabetes Mellitus including uncontrolled and uncomplicated variants.',
                'author_id' => $adminId,
                'is_public' => true,
                'tags' => ['diabetes', 'endocrine', 'conditions'],
                '_items' => [201826, 443238, 4193704],
            ],
            [
                'name' => 'HbA1c Lab Tests',
                'description' => 'Hemoglobin A1c measurement concepts for diabetes monitoring.',
                'author_id' => $adminId,
                'is_public' => true,
                'tags' => ['diabetes', 'endocrine', 'measurements'],
                '_items' => [3004410, 3034639, 40758583],
            ],

            // ── Hypertension ────────────────────────────────────────────────
            [
                'name' => 'Hypertension Conditions',
                'description' => 'Condition concepts for hypertensive disorder and essential hypertension.',
                'author_id' => $adminId,
                'is_public' => true,
                'tags' => ['hypertension', 'cardiovascular', 'conditions'],
                '_items' => [316866, 4028741],
            ],
            [
                'name' => 'Antihypertensive Medications',
                'description' => 'Common antihypertensive drug ingredients: ACE inhibitors, ARBs, beta-blockers, CCBs, thiazides.',
                'author_id' => $adminId,
                'is_public' => true,
                'tags' => ['hypertension', 'cardiovascular', 'drugs'],
                '_items' => [1308216, 1310756, 1313200, 1314002, 1317640, 1341927, 1353776],
            ],

            // ── CAD ─────────────────────────────────────────────────────────
            [
                'name' => 'CAD Conditions',
                'description' => 'Condition concepts for coronary artery disease: heart failure, angina pectoris, myocardial infarction.',
                'author_id' => $adminId,
                'is_public' => true,
                'tags' => ['cad', 'cardiovascular', 'conditions'],
                '_items' => [316139, 321318, 4329847],
            ],
            [
                'name' => 'Statin Medications',
                'description' => 'Statin drug ingredients for lipid-lowering therapy in cardiovascular disease.',
                'author_id' => $adminId,
                'is_public' => true,
                'tags' => ['cad', 'cardiovascular', 'drugs'],
                '_items' => [1510813, 1549686, 1551860, 1545958],
            ],

            // ── Heart Failure ───────────────────────────────────────────────
            [
                'name' => 'Heart Failure Conditions',
                'description' => 'Condition concepts for heart failure and congestive heart failure.',
                'author_id' => $adminId,
                'is_public' => true,
                'tags' => ['heart-failure', 'cardiovascular', 'conditions'],
                '_items' => [316139, 4229440],
            ],
            [
                'name' => 'BNP/NT-proBNP Lab Tests',
                'description' => 'BNP and NT-proBNP biomarker measurement concepts for heart failure monitoring.',
                'author_id' => $adminId,
                'is_public' => true,
                'tags' => ['heart-failure', 'cardiovascular', 'measurements'],
                '_items' => [3035452, 3029435],
            ],
            [
                'name' => 'Heart Failure Medications',
                'description' => 'Heart failure drug ingredients: ACE-I, ARBs, CCBs, beta-blockers, diuretics.',
                'author_id' => $adminId,
                'is_public' => true,
                'tags' => ['heart-failure', 'cardiovascular', 'drugs'],
                '_items' => [1308216, 1310756, 1314002, 1338005, 932745],
            ],

            // ── CKD ─────────────────────────────────────────────────────────
            [
                'name' => 'CKD Conditions',
                'description' => 'Condition concepts for chronic kidney disease and CKD stage 3.',
                'author_id' => $adminId,
                'is_public' => true,
                'tags' => ['ckd', 'renal', 'conditions'],
                '_items' => [46271022, 443611],
            ],
            [
                'name' => 'eGFR Lab Tests',
                'description' => 'Glomerular filtration rate measurement concepts for renal function monitoring.',
                'author_id' => $adminId,
                'is_public' => true,
                'tags' => ['ckd', 'renal', 'measurements'],
                '_items' => [3049187, 3053283],
            ],
            [
                'name' => 'Urine Protein Tests',
                'description' => 'Urine albumin and albumin/creatinine ratio measurement concepts for proteinuria screening.',
                'author_id' => $adminId,
                'is_public' => true,
                'tags' => ['ckd', 'renal', 'measurements'],
                '_items' => [3006923, 3013682],
            ],
        ];
    }
}
