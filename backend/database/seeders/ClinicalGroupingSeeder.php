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

        // Upsert by name + domain_id + COALESCE(parent_grouping_id, 0) for idempotency.
        // Laravel's upsert() can't target expression indexes, so we use raw SQL.
        foreach ($rows as $row) {
            DB::statement('
                INSERT INTO app.clinical_groupings (name, description, domain_id, anchor_concept_ids, sort_order, icon, color, parent_grouping_id)
                VALUES (?, ?, ?, ?::integer[], ?, ?, ?, NULL)
                ON CONFLICT (name, domain_id, COALESCE(parent_grouping_id, 0))
                DO UPDATE SET description = EXCLUDED.description,
                              anchor_concept_ids = EXCLUDED.anchor_concept_ids,
                              sort_order = EXCLUDED.sort_order,
                              icon = EXCLUDED.icon,
                              color = EXCLUDED.color
            ', [
                $row['name'],
                $row['description'],
                $row['domain_id'],
                $row['anchor_concept_ids'],
                $row['sort_order'],
                $row['icon'],
                $row['color'],
            ]);
        }

        $this->command->info('Seeded '.count($rows).' clinical groupings');

        $this->seedHlgtFixtures();
    }

    /**
     * Load HLGT sub-grouping fixture files and insert as child groupings.
     */
    private function seedHlgtFixtures(): void
    {
        $fixturesDir = database_path('fixtures/groupings');

        if (! is_dir($fixturesDir)) {
            $this->command->info('No HLGT fixtures directory found — skipping sub-groupings');

            return;
        }

        $files = glob($fixturesDir.'/*_hlgt.json');
        $totalInserted = 0;

        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);

            if (! $data || empty($data['sub_groupings'])) {
                continue;
            }

            // Look up the parent grouping by name + domain_id
            $parent = DB::table('clinical_groupings')
                ->where('name', $data['parent_grouping'])
                ->where('domain_id', $data['domain_id'])
                ->whereNull('parent_grouping_id')
                ->first();

            if (! $parent) {
                Log::warning("ClinicalGroupingSeeder: parent '{$data['parent_grouping']}' not found — skipping HLGT file ".basename($file));

                continue;
            }

            $childSortOrder = 0;
            $childRows = [];

            foreach ($data['sub_groupings'] as $sg) {
                $childSortOrder++;

                // Verify anchor concept IDs exist
                $validIds = [];
                foreach ($sg['anchor_concept_ids'] ?? [] as $id) {
                    $exists = DB::connection('omop')->selectOne(
                        'SELECT concept_id FROM vocab.concept WHERE concept_id = ?',
                        [$id]
                    );
                    if ($exists) {
                        $validIds[] = $id;
                    }
                }

                if (empty($validIds)) {
                    Log::warning("ClinicalGroupingSeeder: skipping HLGT '{$sg['name']}' under '{$data['parent_grouping']}' — no valid anchors");

                    continue;
                }

                $childRows[] = [
                    'name' => $sg['name'],
                    'description' => $sg['description'] ?? null,
                    'domain_id' => $data['domain_id'],
                    'anchor_concept_ids' => '{'.implode(',', $validIds).'}',
                    'sort_order' => $childSortOrder,
                    'icon' => $sg['icon'] ?? null,
                    'color' => $sg['color'] ?? null,
                    'parent_grouping_id' => $parent->id,
                ];
            }

            if (! empty($childRows)) {
                // Delete existing children for this parent before re-inserting
                DB::table('clinical_groupings')
                    ->where('parent_grouping_id', $parent->id)
                    ->delete();

                DB::table('clinical_groupings')->insert($childRows);
                $totalInserted += count($childRows);
            }
        }

        $this->command->info("Seeded {$totalInserted} HLGT sub-groupings from fixtures");
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
            // Primary: use the hardcoded ID (verified against vocab at development time)
            if ($anchor['id'] > 0) {
                $exists = DB::connection('omop')->selectOne(
                    'SELECT concept_id FROM vocab.concept WHERE concept_id = ?',
                    [$anchor['id']]
                );

                if ($exists) {
                    $resolved[] = $anchor['id'];

                    continue;
                }
            }

            // Fallback: exact case-insensitive name match
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
            } else {
                Log::warning("ClinicalGroupingSeeder: concept not found — name='{$anchor['name']}', id={$anchor['id']}");
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
            // Each grouping has disorder anchors + finding-level siblings for 98.4% coverage.
            // All IDs verified against vocab.concept on 2026-04-05.
            ['name' => 'Cardiovascular', 'description' => 'Heart, blood vessel disorders and findings', 'domain_id' => 'Condition', 'icon' => 'heart', 'color' => '#EF4444',
                'anchors' => [['name' => 'Disorder of cardiovascular system', 'id' => 134057], ['name' => 'Cardiovascular finding', 'id' => 4023995]]],
            ['name' => 'Vascular', 'description' => 'Peripheral, cerebrovascular and venous disorders', 'domain_id' => 'Condition', 'icon' => 'git-branch', 'color' => '#F43F5E',
                'anchors' => [['name' => 'Vascular disorder', 'id' => 443784]]],
            ['name' => 'Respiratory', 'description' => 'Lung, airway disorders, findings and respiratory measurements', 'domain_id' => 'Condition', 'icon' => 'wind', 'color' => '#3B82F6',
                'anchors' => [['name' => 'Disorder of respiratory system', 'id' => 320136], ['name' => 'Respiratory finding', 'id' => 4024567], ['name' => 'Respiratory measurements - finding', 'id' => 4275658]]],
            ['name' => 'Neurological', 'description' => 'Brain, nervous system disorders, coordination and speech findings', 'domain_id' => 'Condition', 'icon' => 'brain', 'color' => '#8B5CF6',
                'anchors' => [['name' => 'Disorder of nervous system', 'id' => 376337], ['name' => 'Neurological finding', 'id' => 4011630], ['name' => 'Central nervous system finding', 'id' => 4086181], ['name' => 'Finding related to coordination / incoordination', 'id' => 4179301], ['name' => 'Speech finding', 'id' => 4021783]]],
            ['name' => 'Gastrointestinal', 'description' => 'Digestive system disorders, stool and elimination findings', 'domain_id' => 'Condition', 'icon' => 'gut', 'color' => '#F59E0B',
                'anchors' => [['name' => 'Disorder of digestive system', 'id' => 4201745], ['name' => 'Digestive system finding', 'id' => 4302537], ['name' => 'Stool finding', 'id' => 4093347], ['name' => 'Elimination pattern', 'id' => 4025202]]],
            ['name' => 'Hepatobiliary', 'description' => 'Liver, gallbladder, biliary tract disorders and jaundice', 'domain_id' => 'Condition', 'icon' => 'flask', 'color' => '#A16207',
                'anchors' => [['name' => 'Disorder of liver and/or biliary tract', 'id' => 1244824], ['name' => 'Disorder of biliary tract', 'id' => 197917], ['name' => 'Jaundice', 'id' => 137977]]],
            ['name' => 'Endocrine & Metabolic', 'description' => 'Endocrine glands, metabolism disorders and findings', 'domain_id' => 'Condition', 'icon' => 'flask', 'color' => '#10B981',
                'anchors' => [['name' => 'Metabolic disease', 'id' => 436670], ['name' => 'Disorder of endocrine system', 'id' => 31821], ['name' => 'Metabolic finding', 'id' => 432455], ['name' => 'Endocrine finding', 'id' => 444107], ['name' => 'Finding of secondary sexual characteristics', 'id' => 4306009]]],
            ['name' => 'Musculoskeletal', 'description' => 'Bone, joint, muscle disorders and findings', 'domain_id' => 'Condition', 'icon' => 'bone', 'color' => '#D97706',
                'anchors' => [['name' => 'Disorder of musculoskeletal system', 'id' => 4244662], ['name' => 'Musculoskeletal finding', 'id' => 135930], ['name' => 'Muscle finding', 'id' => 4024566]]],
            ['name' => 'Renal & Urinary', 'description' => 'Kidney, urinary tract disorders and findings', 'domain_id' => 'Condition', 'icon' => 'droplet', 'color' => '#0EA5E9',
                'anchors' => [['name' => 'Disorder of urinary system', 'id' => 75865], ['name' => 'Urine finding', 'id' => 437382], ['name' => 'Micturition finding', 'id' => 4092659]]],
            ['name' => 'Reproductive & Breast', 'description' => 'Reproductive system and breast disorders', 'domain_id' => 'Condition', 'icon' => 'users', 'color' => '#D946EF',
                'anchors' => [['name' => 'Disorder of female reproductive system', 'id' => 4180154], ['name' => 'Disorder of male genital organ', 'id' => 196738], ['name' => 'Disorder of breast', 'id' => 77030]]],
            ['name' => 'Dermatological', 'description' => 'Skin disorders, soft tissue and integumentary findings', 'domain_id' => 'Condition', 'icon' => 'shield', 'color' => '#EC4899',
                'anchors' => [['name' => 'Disorder of skin', 'id' => 4317258], ['name' => 'Skin AND/OR mucosa finding', 'id' => 4212577], ['name' => 'General finding of soft tissue', 'id' => 4093991], ['name' => 'Color finding', 'id' => 4027304], ['name' => 'Integumentary system finding', 'id' => 444112], ['name' => 'Swelling', 'id' => 4275722]]],
            ['name' => 'Hematologic', 'description' => 'Blood, immune system, lymphatic disorders and findings', 'domain_id' => 'Condition', 'icon' => 'droplets', 'color' => '#DC2626',
                'anchors' => [['name' => 'Disorder of hematopoietic structure', 'id' => 317248], ['name' => 'Disorder of cellular component of blood', 'id' => 443723], ['name' => 'Finding of blood, lymphatics and immune system', 'id' => 4101673]]],
            ['name' => 'Infectious Disease', 'description' => 'Infections caused by bacteria, viruses, fungi, parasites and susceptibility findings', 'domain_id' => 'Condition', 'icon' => 'bug', 'color' => '#84CC16',
                'anchors' => [['name' => 'Infectious disease', 'id' => 432250], ['name' => 'Inactive tuberculosis', 'id' => 4003404], ['name' => 'Susceptibility to infection response - finding', 'id' => 4279232]]],
            ['name' => 'Neoplasm', 'description' => 'Tumors, tumor staging, morphology and oncology findings', 'domain_id' => 'Condition', 'icon' => 'target', 'color' => '#7C3AED',
                'anchors' => [['name' => 'Malignant neoplastic disease', 'id' => 443392], ['name' => 'Benign neoplastic disease', 'id' => 435506], ['name' => 'Neoplastic disease of uncertain behavior', 'id' => 432582], ['name' => 'Finding of lesion', 'id' => 4104314], ['name' => 'Clinical stage finding', 'id' => 4213737]]],
            ['name' => 'Mental & Behavioral', 'description' => 'Psychiatric disorders, psychological findings and delusions', 'domain_id' => 'Condition', 'icon' => 'brain', 'color' => '#6366F1',
                'anchors' => [['name' => 'Mental disorder', 'id' => 432586], ['name' => 'Mental state, behavior and/or psychosocial function finding', 'id' => 4293175], ['name' => 'Delusion', 'id' => 444401]]],
            ['name' => 'Eye & Vision', 'description' => 'Eye disorders, visual findings and corneal findings', 'domain_id' => 'Condition', 'icon' => 'eye', 'color' => '#14B8A6',
                'anchors' => [['name' => 'Disorder of eye region', 'id' => 373499], ['name' => 'Eye / vision finding', 'id' => 4038502], ['name' => 'Corneal thinning', 'id' => 4307537]]],
            ['name' => 'Ear & Hearing', 'description' => 'Ear, hearing and ENT findings', 'domain_id' => 'Condition', 'icon' => 'ear', 'color' => '#F97316',
                'anchors' => [['name' => 'Disorder of ear', 'id' => 378161], ['name' => 'Ear, nose and throat finding', 'id' => 4178545]]],
            ['name' => 'Pregnancy & Perinatal', 'description' => 'Pregnancy, childbirth, neonatal, fetal and developmental findings', 'domain_id' => 'Condition', 'icon' => 'baby', 'color' => '#FB7185',
                'anchors' => [['name' => 'Disorder of pregnancy', 'id' => 439658], ['name' => 'Pregnancy, childbirth and puerperium finding', 'id' => 4088927], ['name' => 'Neonatal disorder', 'id' => 4042220], ['name' => 'Perinatal disorder', 'id' => 4187201], ['name' => 'Fetal disorder', 'id' => 4323285], ['name' => 'Finding of neonate', 'id' => 439156], ['name' => 'Fetal finding', 'id' => 4024705], ['name' => 'Age AND/OR growth finding', 'id' => 4021606], ['name' => 'Finding of general physiological development', 'id' => 4154783]]],
            ['name' => 'Injury, Poisoning & Procedural', 'description' => 'Traumatic injuries, wounds, toxic effects and procedural complications', 'domain_id' => 'Condition', 'icon' => 'alert', 'color' => '#EF4444',
                'anchors' => [['name' => 'Traumatic injury', 'id' => 440921], ['name' => 'Poisoning', 'id' => 442562], ['name' => 'Disorder following clinical procedure', 'id' => 4193161], ['name' => 'Postoperative complication', 'id' => 4300243], ['name' => 'Wound finding', 'id' => 4021667], ['name' => 'Procedure related finding', 'id' => 444194], ['name' => 'Effect of exposure to physical force', 'id' => 4167864], ['name' => 'Device finding', 'id' => 607856]]],
            ['name' => 'Congenital & Genetic', 'description' => 'Birth defects, congenital anomalies, genetic diseases and carrier states', 'domain_id' => 'Condition', 'icon' => 'dna', 'color' => '#A855F7',
                'anchors' => [['name' => 'Congenital disease', 'id' => 440508], ['name' => 'Genetic disease', 'id' => 37204336], ['name' => 'Carrier of disorder', 'id' => 4106092]]],
            ['name' => 'Immune System', 'description' => 'Immune-mediated, autoimmune and hypersensitivity conditions', 'domain_id' => 'Condition', 'icon' => 'shield-check', 'color' => '#22D3EE',
                'anchors' => [['name' => 'Disorder of immune function', 'id' => 440371], ['name' => 'Hypersensitivity condition', 'id' => 43021226], ['name' => 'Propensity to adverse reaction', 'id' => 4172024]]],
            ['name' => 'Nutritional', 'description' => 'Nutritional deficiencies, excesses and feeding findings', 'domain_id' => 'Condition', 'icon' => 'apple', 'color' => '#4ADE80',
                'anchors' => [['name' => 'Nutritional disorder', 'id' => 4090739], ['name' => 'Eating / feeding / drinking finding', 'id' => 4022569]]],
            ['name' => 'Pain Syndromes', 'description' => 'Chronic and acute pain conditions', 'domain_id' => 'Condition', 'icon' => 'zap', 'color' => '#FBBF24',
                'anchors' => [['name' => 'Pain', 'id' => 4329041]]],
            ['name' => 'Functional Impairment', 'description' => 'Impaired cognition, mobility, ADL limitations and functional decline', 'domain_id' => 'Condition', 'icon' => 'activity', 'color' => '#EA580C',
                'anchors' => [['name' => 'Functional finding', 'id' => 4041284]]],
            ['name' => 'Investigations', 'description' => 'Abnormal lab results, imaging, evaluation and specimen findings', 'domain_id' => 'Condition', 'icon' => 'search', 'color' => '#94A3B8',
                'anchors' => [['name' => 'Evaluation finding', 'id' => 40480457], ['name' => 'Finding by method', 'id' => 4041287], ['name' => 'Finding of body product', 'id' => 4146944], ['name' => 'Finding reported by subject or history provider', 'id' => 4303401], ['name' => 'Finding of risk level', 'id' => 37158897]]],
            ['name' => 'General Signs & Symptoms', 'description' => 'Fever, edema, bleeding, masses, vital signs findings and general clinical observations', 'domain_id' => 'Condition', 'icon' => 'thermometer', 'color' => '#78716C',
                'anchors' => [['name' => 'Bleeding', 'id' => 437312], ['name' => 'Mass of body structure', 'id' => 4102111], ['name' => 'Edema', 'id' => 433595], ['name' => 'Finding of movement', 'id' => 4179304], ['name' => 'Fever', 'id' => 437663], ['name' => 'Disease', 'id' => 4274025], ['name' => 'Vital signs finding', 'id' => 4042138], ['name' => 'Temperature-associated finding', 'id' => 4103474], ['name' => 'Sign', 'id' => 4217210], ['name' => 'Distress', 'id' => 4239819], ['name' => 'Finding of general energy', 'id' => 4118121], ['name' => 'Finding of general observation of appearance', 'id' => 4116798], ['name' => 'Illness', 'id' => 4192174], ['name' => 'Collapse', 'id' => 443240], ['name' => 'General health deterioration', 'id' => 4111347], ['name' => 'Patient reaction finding', 'id' => 4009872], ['name' => 'Erythema', 'id' => 137193], ['name' => 'Deformity', 'id' => 4168498], ['name' => 'Dead', 'id' => 434489], ['name' => 'Asymptomatic', 'id' => 4309345], ['name' => 'Body measurement finding', 'id' => 4269698]]],
            ['name' => 'Body Region Findings', 'description' => 'Findings by body location — trunk, limbs, head, back, neck, face', 'domain_id' => 'Condition', 'icon' => 'user', 'color' => '#A8A29E',
                'anchors' => [['name' => 'Finding of trunk structure', 'id' => 4117930], ['name' => 'Finding of limb structure', 'id' => 138239], ['name' => 'Head finding', 'id' => 4247371], ['name' => 'Finding of back', 'id' => 4213101], ['name' => 'Finding of neck region', 'id' => 4184252], ['name' => 'Facial skeletal pattern - finding', 'id' => 4182467], ['name' => 'Finding of position of body and posture', 'id' => 4266926]]],

            // ── Measurement groupings ──
            ['name' => 'Vital Signs', 'description' => 'Blood pressure, heart rate, temperature, respiration', 'domain_id' => 'Measurement', 'icon' => 'activity', 'color' => '#EF4444',
                'anchors' => [['name' => 'Blood pressure', 'id' => 4326744], ['name' => 'Body temperature', 'id' => 4302666], ['name' => 'Heart rate', 'id' => 4239408], ['name' => 'Respiratory rate', 'id' => 4313591]]],
            ['name' => 'Blood Chemistry', 'description' => 'Metabolic panels, electrolytes, enzymes', 'domain_id' => 'Measurement', 'icon' => 'flask', 'color' => '#3B82F6',
                'anchors' => [['name' => 'Laboratory test', 'id' => 4034850]]],
            ['name' => 'Hematology', 'description' => 'Complete blood count, coagulation studies', 'domain_id' => 'Measurement', 'icon' => 'droplets', 'color' => '#DC2626',
                'anchors' => [['name' => 'Hematology test', 'id' => 4090979]]],
            ['name' => 'Urinalysis', 'description' => 'Urine chemistry and microscopy', 'domain_id' => 'Measurement', 'icon' => 'test-tube', 'color' => '#F59E0B',
                'anchors' => [['name' => 'Urine examination', 'id' => 4055811]]],
            ['name' => 'Imaging Findings', 'description' => 'Radiological and imaging measurements', 'domain_id' => 'Measurement', 'icon' => 'scan', 'color' => '#8B5CF6',
                'anchors' => [['name' => 'Imaging', 'id' => 4180938]]],
            ['name' => 'Microbiology', 'description' => 'Culture and sensitivity testing', 'domain_id' => 'Measurement', 'icon' => 'bug', 'color' => '#10B981',
                'anchors' => [['name' => 'Microbiology test', 'id' => 37392842]]],
            ['name' => 'Cardiac Testing', 'description' => 'ECG, echocardiography, stress tests', 'domain_id' => 'Measurement', 'icon' => 'heart-pulse', 'color' => '#EC4899',
                'anchors' => [['name' => 'Cardiac measure', 'id' => 4149475]]],
            ['name' => 'Pulmonary Function', 'description' => 'Spirometry and lung function tests', 'domain_id' => 'Measurement', 'icon' => 'wind', 'color' => '#0EA5E9',
                'anchors' => [['name' => 'Respiratory measure', 'id' => 4090320]]],

            // ── Observation groupings ──
            ['name' => 'Social History', 'description' => 'Tobacco, alcohol, substance use, occupation', 'domain_id' => 'Observation', 'icon' => 'users', 'color' => '#6366F1',
                'anchors' => [['name' => 'Social context finding', 'id' => 4028922]]],
            ['name' => 'Family History', 'description' => 'Hereditary conditions and family medical history', 'domain_id' => 'Observation', 'icon' => 'git-branch', 'color' => '#A855F7',
                'anchors' => [['name' => 'Family history finding', 'id' => 4167217]]],
            ['name' => 'Personal History', 'description' => 'Past medical history and health events', 'domain_id' => 'Observation', 'icon' => 'file-text', 'color' => '#14B8A6',
                'anchors' => [['name' => 'Clinical history/examination observable', 'id' => 4181664]]],
            ['name' => 'Functional Status', 'description' => 'Activities of daily living, mobility, cognition', 'domain_id' => 'Observation', 'icon' => 'trending-up', 'color' => '#F97316',
                'anchors' => [['name' => 'Functional finding', 'id' => 4041284]]],
            ['name' => 'Health Behaviors', 'description' => 'Diet, exercise, sleep, adherence', 'domain_id' => 'Observation', 'icon' => 'heart', 'color' => '#10B981',
                'anchors' => [['name' => 'Health-related behavior finding', 'id' => 4269989]]],
            ['name' => 'Administrative', 'description' => 'Insurance status, consent, enrollment', 'domain_id' => 'Observation', 'icon' => 'clipboard', 'color' => '#64748B',
                'anchors' => [['name' => 'Administrative statuses', 'id' => 4146314]]],

            // ── Procedure groupings ──
            ['name' => 'Surgical', 'description' => 'Operative and surgical interventions', 'domain_id' => 'Procedure', 'icon' => 'scissors', 'color' => '#EF4444',
                'anchors' => [['name' => 'Surgical procedure', 'id' => 4301351]]],
            ['name' => 'Evaluation', 'description' => 'Diagnostic imaging and evaluation procedures', 'domain_id' => 'Procedure', 'icon' => 'search', 'color' => '#3B82F6',
                'anchors' => [['name' => 'Evaluation procedure', 'id' => 4297090]]],
            ['name' => 'Therapeutic', 'description' => 'Non-surgical treatments and therapies', 'domain_id' => 'Procedure', 'icon' => 'pill', 'color' => '#10B981',
                'anchors' => [['name' => 'Therapeutic procedure', 'id' => 4172515]]],
            ['name' => 'Rehabilitation', 'description' => 'Physical therapy, occupational therapy, speech', 'domain_id' => 'Procedure', 'icon' => 'refresh-cw', 'color' => '#F59E0B',
                'anchors' => [['name' => 'Rehabilitation therapy', 'id' => 4180248]]],
            ['name' => 'Preventive', 'description' => 'Vaccinations, screenings, prophylaxis', 'domain_id' => 'Procedure', 'icon' => 'shield', 'color' => '#22D3EE',
                'anchors' => [['name' => 'Preventive procedure', 'id' => 4061660]]],
        ];
    }
}
