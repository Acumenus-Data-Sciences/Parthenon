<?php

namespace App\Services\AI;

use App\Concerns\SourceAware;
use App\Models\App\CohortDefinition;
use App\Models\User;
use App\Services\AiService;
use App\Services\Cohort\Schema\CohortExpressionSchema;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AbbyAiService
{
    use SourceAware;

    // Common study design patterns
    private const PATTERNS = [
        'new_users' => '/\b(new|first[- ]time|incident|newly)\s+(users?|initiators?|diagnosed|exposure)\b/i',
        'with_condition' => '/\b(with|having|diagnosed\s+with|who\s+have)\s+/i',
        'without_condition' => '/\b(without|no\s+prior|excluding|no\s+history\s+of|never\s+had)\s+/i',
        'on_drug' => '/\b(on|taking|receiving|treated\s+with|exposed\s+to|started|starting)\s+/i',
        'age_range' => '/\b(aged?|age)\s*(\d+)\s*[-\x{2013}to]+\s*(\d+)/iu',
        'age_over' => '/\b(aged?|age|older\s+than|over)\s*(\d+)\s*\+?\b/i',
        'age_under' => '/\b(under|younger\s+than|below)\s*(\d+)/i',
        'female' => '/\b(female|women|woman)\b/i',
        'male' => '/\b(male|men|man)\b/i',
        'prior' => '/\b(prior|previous|history\s+of|preceding)\b/i',
        'after' => '/\b(after|following|subsequent|post)\b/i',
        'within_days' => '/\bwithin\s+(\d+)\s*(days?|weeks?|months?|years?)\b/i',
    ];

    // Map common medical terms to OMOP domains
    private const DOMAIN_HINTS = [
        'condition' => ['diabetes', 'hypertension', 'cancer', 'heart failure', 'stroke', 'asthma', 'copd', 'depression', 'anxiety', 'pneumonia', 'fracture', 'obesity', 'infection', 'arthritis', 'alzheimer', 'parkinson', 'epilepsy', 'migraine', 'anemia', 'sepsis'],
        'drug' => ['metformin', 'insulin', 'aspirin', 'statin', 'ace inhibitor', 'lisinopril', 'amlodipine', 'warfarin', 'chemotherapy', 'antibiotic', 'ssri', 'opioid', 'beta blocker', 'diuretic', 'corticosteroid'],
        'procedure' => ['surgery', 'biopsy', 'transplant', 'dialysis', 'endoscopy', 'colonoscopy', 'mri', 'ct scan', 'x-ray', 'hip replacement', 'knee replacement', 'catheterization', 'intubation'],
        'measurement' => ['hba1c', 'blood pressure', 'bmi', 'creatinine', 'cholesterol', 'glucose', 'hemoglobin', 'platelet', 'white blood cell', 'potassium', 'sodium'],
    ];

    public function __construct(
        private readonly CohortExpressionSchema $schema,
        private readonly AiService $aiService,
    ) {}

    /**
     * Build a cohort expression from natural language prompt.
     */
    public function buildCohortFromPrompt(string $prompt, ?int $sourceId = null, string $pageContext = 'cohort-builder'): array
    {
        // ── 1. Try LLM-powered parse first; fall back to regex on failure ──
        $llmSpec = null;
        $llmTerms = [];

        try {
            $llmSpec = $this->aiService->parseCohortPrompt($prompt, $pageContext);

            // Merge LLM-parsed terms with regex analysis as cross-check
            if (! empty($llmSpec['terms']) && ($llmSpec['confidence'] ?? 0) >= 0.4) {
                $llmTerms = $llmSpec['terms'];
            }
        } catch (\Throwable $e) {
            Log::warning('Abby LLM parse failed, using regex fallback', ['error' => $e->getMessage()]);
        }

        // ── 2. Regex-based analysis (always run; merged below) ─────────────
        $analysis = $this->analyzePrompt($prompt);

        // Prefer LLM terms when confident; merge demographics
        if (! empty($llmTerms)) {
            $analysis['terms'] = array_map(fn ($t) => [
                'text' => $t['text'],
                'domain' => $t['domain'] ?? 'condition',
                'role' => $t['role'] ?? 'entry',
            ], $llmTerms);
        }

        // Merge LLM demographics (override regex where LLM found something)
        if ($llmSpec && ! empty($llmSpec['demographics'])) {
            $demo = $llmSpec['demographics'];
            if (! empty($demo['sex'])) {
                $sex = strtolower($demo['sex'][0] ?? '');
                if (in_array($sex, ['female', 'women', 'woman'])) {
                    $analysis['demographics']['gender'] = 'female';
                } elseif (in_array($sex, ['male', 'men', 'man'])) {
                    $analysis['demographics']['gender'] = 'male';
                }
            }
            if (! isset($analysis['demographics']['age']) && ($demo['age_min'] || $demo['age_max'])) {
                $analysis['demographics']['age'] = [
                    'min' => $demo['age_min'] ?? null,
                    'max' => $demo['age_max'] ?? null,
                ];
            }
            if (! empty($demo['location_state'])) {
                $analysis['demographics']['location_state'] = $demo['location_state'];
            }
        }

        // Merge LLM temporal
        if ($llmSpec && ! empty($llmSpec['temporal'])) {
            $temporal = $llmSpec['temporal'];
            if ($temporal['washout_days'] ?? null) {
                $analysis['temporal']['within_days'] = $temporal['washout_days'];
            }
            if ($temporal['within_days'] ?? null) {
                $analysis['temporal']['within_days'] = $temporal['within_days'];
            }
        }

        // Merge LLM study design
        if ($llmSpec && ! empty($llmSpec['study_design'])) {
            $design = $llmSpec['study_design'];
            if ($design === 'new_users' || $design === 'incident') {
                $analysis['design'] = 'new_users';
            }
        }

        $conceptSets = [];
        $warnings = array_merge(
            $llmSpec['warnings'] ?? [],
            [],
        );

        // Warn about location — OMOP location support varies
        if (! empty($analysis['demographics']['location_state'])) {
            $states = implode(', ', $analysis['demographics']['location_state']);
            $warnings[] = "Geographic filter ({$states}) noted — OMOP CDM location data availability varies by site. Location filtering requires a location table join and is noted in the cohort description.";
        }

        // Search vocabulary for each identified term
        foreach ($analysis['terms'] as $i => $term) {
            $concepts = $this->searchConcepts($term['text'], $term['domain']);
            if (empty($concepts)) {
                $warnings[] = "No OMOP concepts found for '{$term['text']}'. You may need to add this concept set manually.";

                continue;
            }
            $conceptSets[] = [
                'id' => $i,
                'name' => $term['text'],
                'expression' => [
                    'items' => array_map(fn ($c) => [
                        'concept' => $c,
                        'isExcluded' => false,
                        'includeDescendants' => true,
                        'includeMapped' => true,
                    ], array_slice($concepts, 0, 10)),
                ],
                'role' => $term['role'],
                'domain' => $term['domain'],
            ];
        }

        // Build expression JSON
        $expression = $this->buildExpression($analysis, $conceptSets);

        // Generate explanation
        $explanation = $this->generateExplanation($analysis, $conceptSets);

        return [
            'cohort_name' => $llmSpec['cohort_name'] ?? null,
            'expression' => $expression,
            'explanation' => $explanation,
            'concept_sets' => array_map(fn ($cs) => [
                'name' => $cs['name'],
                'concepts' => array_map(fn ($item) => $item['concept'], $cs['expression']['items']),
            ], $conceptSets),
            'warnings' => $warnings,
            'llm_confidence' => $llmSpec['confidence'] ?? null,
            'location_states' => $analysis['demographics']['location_state'] ?? [],
        ];
    }

    /**
     * Build a cohort from natural language AND persist it as a CohortDefinition.
     * Returns the saved model + the build result for immediate display.
     */
    public function buildCohortAndSave(string $prompt, User $author, string $pageContext = 'cohort-builder'): array
    {
        $build = $this->buildCohortFromPrompt($prompt, null, $pageContext);

        $name = $build['cohort_name']
            ?? ('Abby: '.Str::limit($prompt, 80));

        // Location states go into the description since OMOP CDM doesn't have
        // a first-class state filter in the expression schema.
        $description = ! empty($build['location_states'])
            ? 'Geographic restriction: '.implode(', ', $build['location_states']).'. '
            : '';
        $description .= $build['explanation'];

        $cohort = CohortDefinition::create([
            'name' => $name,
            'description' => $description,
            'expression_json' => $build['expression'],
            'author_id' => $author->id,
            'is_public' => false,
        ]);

        $cohort->load('author:id,name,email');

        return [
            'cohort_definition' => $cohort,
            'expression' => $build['expression'],
            'explanation' => $build['explanation'],
            'concept_sets' => $build['concept_sets'],
            'warnings' => $build['warnings'],
            'llm_confidence' => $build['llm_confidence'],
        ];
    }

    /**
     * Page-aware conversational chat. Delegates to MedGemma via the AI service.
     *
     * @param  array<array{role: string, content: string}>  $history
     * @param  array<string, mixed>  $userProfile
     * @return array{reply: string, suggestions: string[]}
     */
    public function chat(
        string $message,
        string $pageContext = 'general',
        array $pageData = [],
        array $history = [],
        array $userProfile = [],
        ?int $userId = null,
        ?int $conversationId = null,
    ): array {
        return $this->aiService->abbyChat(
            $message,
            $pageContext,
            $pageData,
            $history,
            $userProfile,
            $userId,
            $conversationId,
        );
    }

    /**
     * Analyze prompt to identify medical terms, demographics, and design pattern.
     */
    private function analyzePrompt(string $prompt): array
    {
        $terms = [];
        $demographics = [];
        $design = 'general';

        // Detect study design
        if (preg_match(self::PATTERNS['new_users'], $prompt)) {
            $design = 'new_users';
        }

        // Detect age filters
        if (preg_match(self::PATTERNS['age_range'], $prompt, $m)) {
            $demographics['age'] = ['min' => (int) $m[2], 'max' => (int) $m[3]];
        } elseif (preg_match(self::PATTERNS['age_over'], $prompt, $m)) {
            $demographics['age'] = ['min' => (int) $m[2], 'max' => null];
        } elseif (preg_match(self::PATTERNS['age_under'], $prompt, $m)) {
            $demographics['age'] = ['min' => null, 'max' => (int) $m[2]];
        }

        // Detect gender
        if (preg_match(self::PATTERNS['female'], $prompt)) {
            $demographics['gender'] = 'female';
        } elseif (preg_match(self::PATTERNS['male'], $prompt)) {
            $demographics['gender'] = 'male';
        }

        // Detect temporal windows
        $temporal = [];
        if (preg_match(self::PATTERNS['within_days'], $prompt, $m)) {
            $days = (int) $m[1];
            $unit = strtolower($m[2]);
            if (str_starts_with($unit, 'week')) {
                $days *= 7;
            } elseif (str_starts_with($unit, 'month')) {
                $days *= 30;
            } elseif (str_starts_with($unit, 'year')) {
                $days *= 365;
            }
            $temporal['within_days'] = $days;
        }

        // Extract medical terms and their roles
        $lowerPrompt = strtolower($prompt);

        foreach (self::DOMAIN_HINTS as $domain => $terms_list) {
            foreach ($terms_list as $hint) {
                if (stripos($lowerPrompt, $hint) !== false) {
                    // Determine role
                    $role = 'entry'; // default
                    $pos = stripos($lowerPrompt, $hint);
                    $before = substr($lowerPrompt, max(0, $pos - 50), min($pos, 50));

                    if (preg_match(self::PATTERNS['without_condition'], $before)) {
                        $role = 'exclusion';
                    } elseif (preg_match(self::PATTERNS['prior'], $before)) {
                        $role = 'exclusion';
                    } elseif (count($terms) > 0 && $domain !== ($terms[0]['domain'] ?? '')) {
                        $role = 'inclusion';
                    }

                    $terms[] = [
                        'text' => $hint,
                        'domain' => $domain,
                        'role' => $role,
                    ];
                }
            }
        }

        // If no terms found via hints, try to extract noun phrases
        if (empty($terms)) {
            // Fallback: extract quoted terms or capitalized phrases
            preg_match_all('/["\']([^"\']+)["\']/', $prompt, $quoted);
            foreach ($quoted[1] as $q) {
                $terms[] = ['text' => $q, 'domain' => 'condition', 'role' => 'entry'];
            }
        }

        return [
            'terms' => $terms,
            'demographics' => $demographics,
            'design' => $design,
            'temporal' => $temporal,
        ];
    }

    /**
     * Search OMOP concepts by text and optional domain filter.
     */
    private function searchConcepts(string $query, ?string $domain = null): array
    {
        $builder = $this->vocab()
            ->table('concept')
            ->where('standard_concept', 'S')
            ->where('invalid_reason', null)
            ->where(function ($q) use ($query) {
                $q->where('concept_name', 'ilike', "%{$query}%")
                    ->orWhere('concept_code', 'ilike', "%{$query}%");
            });

        if ($domain) {
            $domainMap = [
                'condition' => 'Condition',
                'drug' => 'Drug',
                'procedure' => 'Procedure',
                'measurement' => 'Measurement',
                'observation' => 'Observation',
            ];
            if (isset($domainMap[$domain])) {
                $builder->where('domain_id', $domainMap[$domain]);
            }
        }

        return $builder
            ->orderByRaw('CASE WHEN LOWER(concept_name) = ? THEN 0 WHEN LOWER(concept_name) LIKE ? THEN 1 ELSE 2 END', [strtolower($query), strtolower($query).'%'])
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'concept_id' => $row->concept_id,
                'concept_name' => $row->concept_name,
                'domain' => $row->domain_id,
                'vocabulary_id' => $row->vocabulary_id,
                'standard_concept' => $row->standard_concept,
                'concept_code' => $row->concept_code,
            ])
            ->toArray();
    }

    /**
     * Build CohortExpression JSON from analyzed components.
     */
    private function buildExpression(array $analysis, array $conceptSets): array
    {
        $expression = [
            'ConceptSets' => [],
            'PrimaryCriteria' => [
                'CriteriaList' => [],
                'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
            ],
            'AdditionalCriteria' => null,
            'QualifiedLimit' => ['Type' => 'First'],
            'ExpressionLimit' => ['Type' => 'First'],
            'InclusionRules' => [],
            'CensoringCriteria' => [],
            'EndStrategy' => [
                'DateOffset' => [
                    'DateField' => 'StartDate',
                    'Offset' => 0,
                ],
            ],
            'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
            'DemographicCriteria' => [],
        ];

        // Add concept sets
        foreach ($conceptSets as $cs) {
            $expression['ConceptSets'][] = [
                'id' => $cs['id'],
                'name' => $cs['name'],
                'expression' => $cs['expression'],
            ];
        }

        // Determine entry event (first "entry" role concept set)
        $entryCs = collect($conceptSets)->firstWhere('role', 'entry');
        if ($entryCs) {
            $domainCriterion = $this->buildDomainCriterion($entryCs);
            $expression['PrimaryCriteria']['CriteriaList'][] = $domainCriterion;
        }

        // Add new_users observation window
        if ($analysis['design'] === 'new_users') {
            $expression['PrimaryCriteria']['ObservationWindow'] = [
                'PriorDays' => 365,
                'PostDays' => 0,
            ];
            $expression['QualifiedLimit'] = ['Type' => 'First'];
        }

        // Add inclusion criteria
        $inclusions = collect($conceptSets)->where('role', 'inclusion');
        foreach ($inclusions as $cs) {
            $days = $analysis['temporal']['within_days'] ?? 365;
            $expression['InclusionRules'][] = [
                'name' => "Has {$cs['name']}",
                'expression' => [
                    'Type' => 'ALL',
                    'CriteriaList' => [
                        [
                            'Criteria' => $this->buildDomainCriterion($cs),
                            'StartWindow' => [
                                'Start' => ['Days' => $days, 'Coeff' => -1],
                                'End' => ['Days' => $days, 'Coeff' => 1],
                                'UseEventEnd' => false,
                            ],
                            'Occurrence' => ['Type' => 2, 'Count' => 1],
                        ],
                    ],
                    'DemographicCriteriaList' => [],
                    'Groups' => [],
                ],
            ];
        }

        // Add exclusion criteria
        $exclusions = collect($conceptSets)->where('role', 'exclusion');
        foreach ($exclusions as $cs) {
            $expression['InclusionRules'][] = [
                'name' => "No prior {$cs['name']}",
                'expression' => [
                    'Type' => 'ALL',
                    'CriteriaList' => [
                        [
                            'Criteria' => $this->buildDomainCriterion($cs),
                            'StartWindow' => [
                                'Start' => ['Days' => 99999, 'Coeff' => -1],
                                'End' => ['Days' => 0, 'Coeff' => -1],
                                'UseEventEnd' => false,
                            ],
                            'Occurrence' => ['Type' => 1, 'Count' => 0], // at most 0
                        ],
                    ],
                    'DemographicCriteriaList' => [],
                    'Groups' => [],
                ],
            ];
        }

        // Add demographic filters
        if (! empty($analysis['demographics'])) {
            $demo = [];
            if (isset($analysis['demographics']['age'])) {
                $age = $analysis['demographics']['age'];
                if ($age['min'] !== null) {
                    $demo['Age'] = ['Value' => $age['min'], 'Op' => 'gte'];
                }
                if ($age['max'] !== null) {
                    $demo['AgeMax'] = ['Value' => $age['max'], 'Op' => 'lte'];
                }
            }
            if (isset($analysis['demographics']['gender'])) {
                $genderConceptId = $analysis['demographics']['gender'] === 'female' ? 8532 : 8507;
                $demo['Gender'] = [['CONCEPT_ID' => $genderConceptId]];
            }
            if (! empty($demo)) {
                $expression['DemographicCriteria'][] = $demo;
            }
        }

        return $expression;
    }

    /**
     * Build a domain criterion from a concept set.
     */
    private function buildDomainCriterion(array $conceptSet): array
    {
        $domainMap = [
            'condition' => 'ConditionOccurrence',
            'drug' => 'DrugExposure',
            'procedure' => 'ProcedureOccurrence',
            'measurement' => 'Measurement',
            'observation' => 'Observation',
        ];

        $domainKey = $domainMap[$conceptSet['domain']] ?? 'ConditionOccurrence';

        return [
            $domainKey => [
                'CodesetId' => $conceptSet['id'],
            ],
        ];
    }

    /**
     * Generate human-readable explanation.
     */
    private function generateExplanation(array $analysis, array $conceptSets): string
    {
        $parts = [];

        $entryCs = collect($conceptSets)->firstWhere('role', 'entry');
        if ($entryCs) {
            $isNew = $analysis['design'] === 'new_users';
            $parts[] = $isNew
                ? "This cohort identifies patients with their **first** recorded {$entryCs['domain']} event matching **{$entryCs['name']}**."
                : "This cohort identifies patients with a {$entryCs['domain']} event matching **{$entryCs['name']}**.";

            if ($isNew) {
                $parts[] = 'A 365-day washout period is required (no prior occurrence).';
            }
        }

        $inclusions = collect($conceptSets)->where('role', 'inclusion');
        if ($inclusions->isNotEmpty()) {
            $names = $inclusions->pluck('name')->join(', ');
            $days = $analysis['temporal']['within_days'] ?? 365;
            $parts[] = "Patients must also have: **{$names}** within {$days} days of the index event.";
        }

        $exclusions = collect($conceptSets)->where('role', 'exclusion');
        if ($exclusions->isNotEmpty()) {
            $names = $exclusions->pluck('name')->join(', ');
            $parts[] = "Patients with any prior history of **{$names}** are excluded.";
        }

        if (! empty($analysis['demographics'])) {
            $demoParts = [];
            if (isset($analysis['demographics']['age'])) {
                $age = $analysis['demographics']['age'];
                if ($age['min'] !== null && $age['max'] !== null) {
                    $demoParts[] = "aged {$age['min']}\u{2013}{$age['max']}";
                } elseif ($age['min'] !== null) {
                    $demoParts[] = "aged {$age['min']}+";
                } elseif ($age['max'] !== null) {
                    $demoParts[] = "under age {$age['max']}";
                }
            }
            if (isset($analysis['demographics']['gender'])) {
                $demoParts[] = $analysis['demographics']['gender'];
            }
            if (! empty($demoParts)) {
                $parts[] = 'Demographic filter: '.implode(', ', $demoParts).'.';
            }
        }

        if (empty($parts)) {
            return 'No specific criteria could be extracted from the prompt. Please try rephrasing or adding more detail about the target population.';
        }

        return implode("\n\n", $parts);
    }

    /**
     * Suggest concepts for a given domain + description.
     */
    public function suggestCriteria(string $domain, string $description): array
    {
        return $this->searchConcepts($description, $domain);
    }

    /**
     * Generate human-readable explanation from an existing expression.
     */
    public function explainExpression(array $expression): string
    {
        $parts = [];

        // Describe concept sets
        $conceptSets = $expression['ConceptSets'] ?? [];
        if (! empty($conceptSets)) {
            $names = collect($conceptSets)->pluck('name')->join(', ');
            $parts[] = "**Concept Sets defined:** {$names}";
        }

        // Describe primary criteria
        $primary = $expression['PrimaryCriteria'] ?? [];
        $criteriaList = $primary['CriteriaList'] ?? [];
        if (! empty($criteriaList)) {
            $domains = [];
            foreach ($criteriaList as $c) {
                foreach (['ConditionOccurrence', 'DrugExposure', 'ProcedureOccurrence', 'Measurement', 'Observation', 'VisitOccurrence', 'Death'] as $d) {
                    if (isset($c[$d])) {
                        $codesetId = $c[$d]['CodesetId'] ?? '?';
                        $csName = collect($conceptSets)->firstWhere('id', $codesetId)['name'] ?? "Concept Set #{$codesetId}";
                        $domains[] = "{$d} matching **{$csName}**";
                    }
                }
            }
            $parts[] = '**Entry event:** '.implode(' OR ', $domains);
        }

        // Observation window
        $window = $primary['ObservationWindow'] ?? [];
        if (($window['PriorDays'] ?? 0) > 0) {
            $parts[] = "Requires **{$window['PriorDays']} days** of prior observation.";
        }

        // Inclusion rules
        $rules = $expression['InclusionRules'] ?? [];
        if (! empty($rules)) {
            $count = count($rules);
            $ruleNames = collect($rules)->pluck('name')->join(', ');
            $parts[] = "**Inclusion rules ({$count}):** {$ruleNames}";
        }

        // Demographics
        $demographics = $expression['DemographicCriteria'] ?? [];
        if (! empty($demographics)) {
            $parts[] = '**Demographic filters** are applied.';
        }

        // Qualified limit
        $limit = $expression['QualifiedLimit']['Type'] ?? 'All';
        $parts[] = "Selects **{$limit}** qualifying events per person.";

        return empty($parts)
            ? "Empty cohort expression \u{2014} no criteria defined."
            : implode("\n\n", $parts);
    }

    /**
     * Refine an existing expression based on a natural language instruction.
     */
    public function refineCohort(array $expression, string $prompt): array
    {
        // Re-analyze the refinement prompt
        $analysis = $this->analyzePrompt($prompt);
        $warnings = [];

        // Determine current max concept set ID
        $maxId = collect($expression['ConceptSets'] ?? [])->max('id') ?? -1;

        // Add new terms to concept sets
        $newConceptSets = [];
        foreach ($analysis['terms'] as $term) {
            $concepts = $this->searchConcepts($term['text'], $term['domain']);
            if (empty($concepts)) {
                $warnings[] = "No OMOP concepts found for '{$term['text']}'.";

                continue;
            }

            $maxId++;
            $cs = [
                'id' => $maxId,
                'name' => $term['text'],
                'expression' => [
                    'items' => array_map(fn ($c) => [
                        'concept' => $c,
                        'isExcluded' => false,
                        'includeDescendants' => true,
                        'includeMapped' => true,
                    ], array_slice($concepts, 0, 10)),
                ],
                'role' => $term['role'],
                'domain' => $term['domain'],
            ];

            $expression['ConceptSets'][] = [
                'id' => $cs['id'],
                'name' => $cs['name'],
                'expression' => $cs['expression'],
            ];

            $newConceptSets[] = $cs;

            // Add as inclusion or exclusion rule
            if ($term['role'] === 'inclusion') {
                $days = $analysis['temporal']['within_days'] ?? 365;
                $expression['InclusionRules'][] = [
                    'name' => "Has {$cs['name']}",
                    'expression' => [
                        'Type' => 'ALL',
                        'CriteriaList' => [[
                            'Criteria' => $this->buildDomainCriterion($cs),
                            'StartWindow' => [
                                'Start' => ['Days' => $days, 'Coeff' => -1],
                                'End' => ['Days' => $days, 'Coeff' => 1],
                                'UseEventEnd' => false,
                            ],
                            'Occurrence' => ['Type' => 2, 'Count' => 1],
                        ]],
                        'DemographicCriteriaList' => [],
                        'Groups' => [],
                    ],
                ];
            } elseif ($term['role'] === 'exclusion') {
                $expression['InclusionRules'][] = [
                    'name' => "No prior {$cs['name']}",
                    'expression' => [
                        'Type' => 'ALL',
                        'CriteriaList' => [[
                            'Criteria' => $this->buildDomainCriterion($cs),
                            'StartWindow' => [
                                'Start' => ['Days' => 99999, 'Coeff' => -1],
                                'End' => ['Days' => 0, 'Coeff' => -1],
                                'UseEventEnd' => false,
                            ],
                            'Occurrence' => ['Type' => 1, 'Count' => 0],
                        ]],
                        'DemographicCriteriaList' => [],
                        'Groups' => [],
                    ],
                ];
            }
        }

        // Apply demographic changes
        if (! empty($analysis['demographics'])) {
            $demo = [];
            if (isset($analysis['demographics']['age'])) {
                $age = $analysis['demographics']['age'];
                if ($age['min'] !== null) {
                    $demo['Age'] = ['Value' => $age['min'], 'Op' => 'gte'];
                }
                if ($age['max'] !== null) {
                    $demo['AgeMax'] = ['Value' => $age['max'], 'Op' => 'lte'];
                }
            }
            if (isset($analysis['demographics']['gender'])) {
                $genderConceptId = $analysis['demographics']['gender'] === 'female' ? 8532 : 8507;
                $demo['Gender'] = [['CONCEPT_ID' => $genderConceptId]];
            }
            if (! empty($demo)) {
                $expression['DemographicCriteria'] = [$demo];
            }
        }

        $explanation = $this->explainExpression($expression);

        return [
            'expression' => $expression,
            'explanation' => $explanation,
            'concept_sets' => array_map(fn ($cs) => [
                'name' => $cs['name'],
                'concepts' => array_map(fn ($item) => $item['concept'], $cs['expression']['items']),
            ], $newConceptSets),
            'warnings' => $warnings,
        ];
    }

    /**
     * Generate AI-assisted study protocol suggestions.
     *
     * Uses MedGemma to suggest scientific rationale, hypothesis,
     * and design considerations based on the study title and description.
     */
    public function suggestStudyProtocol(
        string $title,
        string $description,
        string $studyType,
    ): array {
        $prompt = <<<PROMPT
You are a clinical research methodologist helping design an OHDSI observational study.

Study Title: {$title}
Study Type: {$studyType}
Description: {$description}

Please provide the following in JSON format with these exact keys:
{
  "scientific_rationale": "A 2-3 sentence scientific rationale explaining why this study is important and what gap in knowledge it addresses.",
  "hypothesis": "A clear, testable hypothesis statement for the study.",
  "primary_objective": "The primary objective of the study in one sentence.",
  "secondary_objectives": ["List 2-3 secondary objectives as separate strings."],
  "design_considerations": "Key methodological considerations for this study design (confounders, time windows, cohort definitions, outcome definitions). 2-3 sentences.",
  "suggested_study_design": "The recommended study design approach (e.g., cohort study, case-control, self-controlled case series, etc.) with brief justification."
}

Respond ONLY with valid JSON. No markdown, no code fences, no explanation outside the JSON.
PROMPT;

        try {
            $result = $this->aiService->abbyChat(
                message: $prompt,
                pageContext: 'studies',
                pageData: ['study_type' => $studyType, 'title' => $title],
            );

            $reply = $result['reply'] ?? '';

            // Try to extract JSON from the reply
            $json = $this->extractJson($reply);
            if ($json) {
                return [
                    'suggestions' => $json,
                    'raw_reply' => $reply,
                    'source' => 'ai',
                ];
            }

            // If JSON extraction fails, return the raw reply as rationale
            return [
                'suggestions' => [
                    'scientific_rationale' => $reply,
                    'hypothesis' => null,
                    'primary_objective' => null,
                    'secondary_objectives' => [],
                    'design_considerations' => null,
                    'suggested_study_design' => null,
                ],
                'raw_reply' => $reply,
                'source' => 'ai_fallback',
            ];
        } catch (\Throwable $e) {
            Log::warning('AI study protocol suggestion failed', [
                'error' => $e->getMessage(),
                'title' => $title,
            ]);

            return [
                'suggestions' => null,
                'error' => 'AI service is currently unavailable. Please fill in the fields manually.',
                'source' => 'error',
            ];
        }
    }

    /**
     * Extract JSON object from a string that may contain markdown or extra text.
     */
    private function extractJson(string $text): ?array
    {
        // Try direct decode first
        $decoded = json_decode($text, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        // Try to find JSON block in markdown code fences
        if (preg_match('/```(?:json)?\s*\n?([\s\S]*?)\n?```/', $text, $m)) {
            $decoded = json_decode(trim($m[1]), true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        // Try to find first { ... } block
        if (preg_match('/\{[\s\S]*\}/', $text, $m)) {
            $decoded = json_decode($m[0], true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }
}
