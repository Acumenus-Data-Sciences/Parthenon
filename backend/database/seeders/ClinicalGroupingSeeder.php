<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ClinicalGroupingSeeder extends Seeder
{
    public function run(): void
    {
        $groupings = $this->getGroupingDefinitions();

        $rows = [];
        $sortOrder = 0;

        foreach ($groupings as $grouping) {
            $sortOrder++;
            $resolvedIds = $this->resolveAnchorIds($grouping['anchors']);

            if (empty($resolvedIds)) {
                Log::warning("ClinicalGroupingSeeder: skipping '{$grouping['name']}' — no valid anchor concepts found");

                continue;
            }

            $rows[] = [
                'name' => $grouping['name'],
                'description' => $grouping['description'],
                'domain_id' => $grouping['domain_id'],
                'anchor_concept_ids' => '{'.implode(',', $resolvedIds).'}',
                'sort_order' => $sortOrder,
                'icon' => $grouping['icon'] ?? null,
                'color' => $grouping['color'] ?? null,
                'parent_grouping_id' => null,
            ];
        }

        // Upsert by name + domain_id for idempotency
        DB::table('clinical_groupings')->upsert(
            $rows,
            ['name', 'domain_id'],
            ['description', 'anchor_concept_ids', 'sort_order', 'icon', 'color']
        );

        $this->command->info('Seeded '.count($rows).' clinical groupings');
    }

    /**
     * Resolve anchor concept IDs by looking up concept names in vocab.concept.
     * Each anchor is a ['name' => pattern, 'id' => fallback_id] pair.
     *
     * @param  array<int, array{name: string, id: int}>  $anchors
     * @return list<int>
     */
    private function resolveAnchorIds(array $anchors): array
    {
        $resolved = [];

        foreach ($anchors as $anchor) {
            // Try exact name match first, then pattern match
            $concept = DB::connection('omop')->selectOne("
                SELECT concept_id FROM vocab.concept
                WHERE concept_name ILIKE ?
                  AND vocabulary_id = 'SNOMED'
                  AND standard_concept = 'S'
                  AND invalid_reason IS NULL
                ORDER BY concept_id
                LIMIT 1
            ", [$anchor['name']]);

            if ($concept) {
                $resolved[] = $concept->concept_id;
            } elseif ($anchor['id'] > 0) {
                // Fall back to hardcoded ID, validate it exists
                $exists = DB::connection('omop')->selectOne(
                    'SELECT concept_id FROM vocab.concept WHERE concept_id = ?',
                    [$anchor['id']]
                );

                if ($exists) {
                    $resolved[] = $anchor['id'];
                } else {
                    Log::warning("ClinicalGroupingSeeder: concept not found — name='{$anchor['name']}', id={$anchor['id']}");
                }
            }
        }

        return $resolved;
    }

    /**
     * @return list<array{name: string, description: string, domain_id: string, anchors: list<array{name: string, id: int}>, icon?: string, color?: string}>
     */
    private function getGroupingDefinitions(): array
    {
        return [
            // ── Condition groupings ──
            ['name' => 'Cardiovascular', 'description' => 'Heart and blood vessel disorders', 'domain_id' => 'Condition', 'icon' => 'heart', 'color' => '#EF4444',
                'anchors' => [['name' => 'Disorder of cardiovascular system', 'id' => 134057]]],
            ['name' => 'Respiratory', 'description' => 'Lung and airway disorders', 'domain_id' => 'Condition', 'icon' => 'wind', 'color' => '#3B82F6',
                'anchors' => [['name' => 'Disorder of respiratory system', 'id' => 320136]]],
            ['name' => 'Neurological', 'description' => 'Brain and nervous system disorders', 'domain_id' => 'Condition', 'icon' => 'brain', 'color' => '#8B5CF6',
                'anchors' => [['name' => 'Disorder of nervous system', 'id' => 376337]]],
            ['name' => 'Gastrointestinal', 'description' => 'Digestive system disorders', 'domain_id' => 'Condition', 'icon' => 'gut', 'color' => '#F59E0B',
                'anchors' => [['name' => 'Disorder of digestive system', 'id' => 4302537]]],
            ['name' => 'Endocrine & Metabolic', 'description' => 'Endocrine glands and metabolism disorders', 'domain_id' => 'Condition', 'icon' => 'flask', 'color' => '#10B981',
                'anchors' => [['name' => 'Metabolic disease', 'id' => 436670], ['name' => 'Disorder of endocrine system', 'id' => 31821]]],
            ['name' => 'Musculoskeletal', 'description' => 'Bone, joint, and muscle disorders', 'domain_id' => 'Condition', 'icon' => 'bone', 'color' => '#D97706',
                'anchors' => [['name' => 'Disorder of musculoskeletal system', 'id' => 134442]]],
            ['name' => 'Genitourinary', 'description' => 'Kidney, bladder, and reproductive disorders', 'domain_id' => 'Condition', 'icon' => 'droplet', 'color' => '#0EA5E9',
                'anchors' => [['name' => 'Disorder of genitourinary system', 'id' => 195862]]],
            ['name' => 'Dermatological', 'description' => 'Skin and subcutaneous tissue disorders', 'domain_id' => 'Condition', 'icon' => 'shield', 'color' => '#EC4899',
                'anchors' => [['name' => 'Disorder of skin', 'id' => 133834]]],
            ['name' => 'Hematologic', 'description' => 'Blood and blood-forming organ disorders', 'domain_id' => 'Condition', 'icon' => 'droplets', 'color' => '#DC2626',
                'anchors' => [['name' => 'Disorder of hematopoietic structure', 'id' => 440371]]],
            ['name' => 'Infectious Disease', 'description' => 'Infections caused by bacteria, viruses, fungi, and parasites', 'domain_id' => 'Condition', 'icon' => 'bug', 'color' => '#84CC16',
                'anchors' => [['name' => 'Infectious disease', 'id' => 432545]]],
            ['name' => 'Neoplasm', 'description' => 'Benign and malignant tumors', 'domain_id' => 'Condition', 'icon' => 'target', 'color' => '#7C3AED',
                'anchors' => [['name' => 'Malignant neoplastic disease', 'id' => 443392], ['name' => 'Benign neoplasm', 'id' => 4091513]]],
            ['name' => 'Mental & Behavioral', 'description' => 'Psychiatric and behavioral health conditions', 'domain_id' => 'Condition', 'icon' => 'brain', 'color' => '#6366F1',
                'anchors' => [['name' => 'Mental disorder', 'id' => 441542]]],
            ['name' => 'Eye & Vision', 'description' => 'Eye and visual system disorders', 'domain_id' => 'Condition', 'icon' => 'eye', 'color' => '#14B8A6',
                'anchors' => [['name' => 'Disorder of eye', 'id' => 376107]]],
            ['name' => 'Ear & Hearing', 'description' => 'Ear and hearing disorders', 'domain_id' => 'Condition', 'icon' => 'ear', 'color' => '#F97316',
                'anchors' => [['name' => 'Disorder of ear', 'id' => 374919]]],
            ['name' => 'Pregnancy & Childbirth', 'description' => 'Complications of pregnancy and delivery', 'domain_id' => 'Condition', 'icon' => 'baby', 'color' => '#FB7185',
                'anchors' => [['name' => 'Disorder of pregnancy', 'id' => 4126979]]],
            ['name' => 'Injury & Poisoning', 'description' => 'Traumatic injuries and toxic effects', 'domain_id' => 'Condition', 'icon' => 'alert', 'color' => '#EF4444',
                'anchors' => [['name' => 'Traumatic AND/OR non-traumatic injury', 'id' => 440921], ['name' => 'Poisoning', 'id' => 438028]]],
            ['name' => 'Congenital', 'description' => 'Birth defects and congenital anomalies', 'domain_id' => 'Condition', 'icon' => 'dna', 'color' => '#A855F7',
                'anchors' => [['name' => 'Congenital disease', 'id' => 4043731]]],
            ['name' => 'Immune System', 'description' => 'Immune-mediated and autoimmune conditions', 'domain_id' => 'Condition', 'icon' => 'shield-check', 'color' => '#22D3EE',
                'anchors' => [['name' => 'Immune system disorder', 'id' => 432571]]],
            ['name' => 'Nutritional', 'description' => 'Nutritional deficiencies and excesses', 'domain_id' => 'Condition', 'icon' => 'apple', 'color' => '#4ADE80',
                'anchors' => [['name' => 'Nutritional disorder', 'id' => 436096]]],
            ['name' => 'Pain Syndromes', 'description' => 'Chronic and acute pain conditions', 'domain_id' => 'Condition', 'icon' => 'zap', 'color' => '#FBBF24',
                'anchors' => [['name' => 'Pain', 'id' => 4182210]]],

            // ── Measurement groupings ──
            ['name' => 'Vital Signs', 'description' => 'Blood pressure, heart rate, temperature, respiration', 'domain_id' => 'Measurement', 'icon' => 'activity', 'color' => '#EF4444',
                'anchors' => [['name' => 'Vital signs observable', 'id' => 4239408]]],
            ['name' => 'Blood Chemistry', 'description' => 'Metabolic panels, electrolytes, enzymes', 'domain_id' => 'Measurement', 'icon' => 'flask', 'color' => '#3B82F6',
                'anchors' => [['name' => 'Laboratory test', 'id' => 4019381]]],
            ['name' => 'Hematology', 'description' => 'Complete blood count, coagulation studies', 'domain_id' => 'Measurement', 'icon' => 'droplets', 'color' => '#DC2626',
                'anchors' => [['name' => 'Hematology test', 'id' => 4020650]]],
            ['name' => 'Urinalysis', 'description' => 'Urine chemistry and microscopy', 'domain_id' => 'Measurement', 'icon' => 'test-tube', 'color' => '#F59E0B',
                'anchors' => [['name' => 'Urine examination', 'id' => 4044908]]],
            ['name' => 'Imaging Findings', 'description' => 'Radiological and imaging measurements', 'domain_id' => 'Measurement', 'icon' => 'scan', 'color' => '#8B5CF6',
                'anchors' => [['name' => 'Imaging', 'id' => 4180938]]],
            ['name' => 'Microbiology', 'description' => 'Culture and sensitivity testing', 'domain_id' => 'Measurement', 'icon' => 'bug', 'color' => '#10B981',
                'anchors' => [['name' => 'Microbiology test', 'id' => 4019384]]],
            ['name' => 'Cardiac Testing', 'description' => 'ECG, echocardiography, stress tests', 'domain_id' => 'Measurement', 'icon' => 'heart-pulse', 'color' => '#EC4899',
                'anchors' => [['name' => 'Cardiac measure', 'id' => 4173533]]],
            ['name' => 'Pulmonary Function', 'description' => 'Spirometry and lung function tests', 'domain_id' => 'Measurement', 'icon' => 'wind', 'color' => '#0EA5E9',
                'anchors' => [['name' => 'Respiratory measure', 'id' => 4206896]]],

            // ── Observation groupings ──
            ['name' => 'Social History', 'description' => 'Tobacco, alcohol, substance use, occupation', 'domain_id' => 'Observation', 'icon' => 'users', 'color' => '#6366F1',
                'anchors' => [['name' => 'Social history finding', 'id' => 4214956]]],
            ['name' => 'Family History', 'description' => 'Hereditary conditions and family medical history', 'domain_id' => 'Observation', 'icon' => 'git-branch', 'color' => '#A855F7',
                'anchors' => [['name' => 'Family history finding', 'id' => 4167217]]],
            ['name' => 'Personal History', 'description' => 'Past medical history and health events', 'domain_id' => 'Observation', 'icon' => 'file-text', 'color' => '#14B8A6',
                'anchors' => [['name' => 'History finding', 'id' => 4215685]]],
            ['name' => 'Functional Status', 'description' => 'Activities of daily living, mobility, cognition', 'domain_id' => 'Observation', 'icon' => 'trending-up', 'color' => '#F97316',
                'anchors' => [['name' => 'Functional observable', 'id' => 4022069]]],
            ['name' => 'Health Behaviors', 'description' => 'Diet, exercise, sleep, adherence', 'domain_id' => 'Observation', 'icon' => 'heart', 'color' => '#10B981',
                'anchors' => [['name' => 'Health-related behavior finding', 'id' => 4058286]]],
            ['name' => 'Administrative', 'description' => 'Insurance status, consent, enrollment', 'domain_id' => 'Observation', 'icon' => 'clipboard', 'color' => '#64748B',
                'anchors' => [['name' => 'Administrative statuses', 'id' => 4296248]]],

            // ── Procedure groupings ──
            ['name' => 'Surgical', 'description' => 'Operative and surgical interventions', 'domain_id' => 'Procedure', 'icon' => 'scissors', 'color' => '#EF4444',
                'anchors' => [['name' => 'Surgical procedure', 'id' => 4301351]]],
            ['name' => 'Diagnostic', 'description' => 'Diagnostic imaging and procedures', 'domain_id' => 'Procedure', 'icon' => 'search', 'color' => '#3B82F6',
                'anchors' => [['name' => 'Diagnostic procedure', 'id' => 4180793]]],
            ['name' => 'Therapeutic', 'description' => 'Non-surgical treatments and therapies', 'domain_id' => 'Procedure', 'icon' => 'pill', 'color' => '#10B981',
                'anchors' => [['name' => 'Therapeutic procedure', 'id' => 4272240]]],
            ['name' => 'Rehabilitation', 'description' => 'Physical therapy, occupational therapy, speech', 'domain_id' => 'Procedure', 'icon' => 'refresh-cw', 'color' => '#F59E0B',
                'anchors' => [['name' => 'Rehabilitation therapy', 'id' => 4058694]]],
            ['name' => 'Preventive', 'description' => 'Vaccinations, screenings, prophylaxis', 'domain_id' => 'Procedure', 'icon' => 'shield', 'color' => '#22D3EE',
                'anchors' => [['name' => 'Prophylactic procedure', 'id' => 4207539]]],
        ];
    }
}
