<?php
// build_composite_cohorts_v3.php — v3 builder for the 4 composite cohorts.
//
// Improvements over v2 builder:
//   1. EndStrategy.DateOffset = 1825 days from cohort_start_date (5-year era).
//   2. Inclusion rule: Age >= 18 at index (DemographicCriteriaList).
//   3. eGFR < 60 value-based exclusion (ValueAsNumber filter on Measurement).
//   4. O1 MACE: HF restricted to inpatient visits (VisitType=[9201, 262]).
//   5. O1 MACE: Death event added as a 4th primary-criteria entry.
//   6. C: always-normotensive enforcement (no elevated BP measurements ever).
//
// Run via: docker compose exec -T php php artisan tinker --execute="require '/tmp/build_composite_cohorts_v3.php';"
//
// Outputs: /tmp/htn-v3-cohort-{T,C,O1,O2}-v3.json

use App\Models\App\ConceptSet;
use App\Models\App\StudyDesignAsset;

// Map concept_set.id -> study_design_asset.id (the concept_set_draft layer on v2; v3 can reuse).
// Note: concept sets are version-independent canonical records; only the *draft asset*
// is version-scoped. We re-use the v2 concept_set_draft assets as the source linkage.
$asset_map = StudyDesignAsset::where('session_id', 10)
    ->where('asset_type', 'concept_set_draft')
    ->where('status', 'materialized')
    ->get(['id', 'materialized_id'])
    ->keyBy('materialized_id')
    ->map(fn ($a) => $a->id)
    ->all();

function asset_ids_for(array $cs_ids, array $map): array
{
    $out = [];
    foreach ($cs_ids as $csid) {
        if (isset($map[$csid])) {
            $out[] = $map[$csid];
        }
    }
    return $out;
}

function build_concept_sets_payload(array $cs_ids): array
{
    $sets = ConceptSet::with('items')->whereIn('id', $cs_ids)->get()->keyBy('id');
    $out = [];
    foreach ($cs_ids as $idx => $cs_id) {
        $cs = $sets[$cs_id] ?? null;
        if (!$cs) continue;
        $items = $cs->items->map(fn ($i) => [
            'concept' => [
                'CONCEPT_ID' => $i->concept_id,
                'CONCEPT_NAME' => '',
                'STANDARD_CONCEPT' => 'S',
                'INVALID_REASON' => null,
            ],
            'isExcluded' => (bool) $i->is_excluded,
            'includeMapped' => false,
            'includeDescendants' => (bool) ($i->include_descendants ?? true),
        ])->all();
        $out[] = [
            'id' => $idx,
            'name' => $cs->name,
            'expression' => ['items' => $items],
        ];
    }
    return $out;
}

// ---------- Circe helpers ----------

function condition_primary(int $codeset_id, int $prior_obs_days = 365): array
{
    return [
        'CriteriaList' => [
            ['ConditionOccurrence' => ['CodesetId' => $codeset_id, 'First' => true]],
        ],
        'ObservationWindow' => ['PostDays' => 0, 'PriorDays' => $prior_obs_days],
        'PrimaryCriteriaLimit' => ['Type' => 'First'],
    ];
}

function measurement_primary(int $codeset_id, int $prior_obs_days = 365): array
{
    return [
        'CriteriaList' => [
            ['Measurement' => ['CodesetId' => $codeset_id, 'First' => true]],
        ],
        'ObservationWindow' => ['PostDays' => 0, 'PriorDays' => $prior_obs_days],
        'PrimaryCriteriaLimit' => ['Type' => 'First'],
    ];
}

/**
 * Negation/exclusion rule: zero occurrences of the criterion in all-time prior to index.
 */
function exclusion_rule(string $name, int $codeset_id, string $domain = 'ConditionOccurrence'): array
{
    return [
        'name' => $name,
        'expression' => [
            'Type' => 'ALL',
            'Count' => 0,
            'CriteriaList' => [[
                'Criteria' => [
                    $domain => ['CodesetId' => $codeset_id],
                ],
                'StartWindow' => [
                    'Start' => ['Days' => null, 'Coeff' => -1],
                    'End'   => ['Days' => 0,    'Coeff' => -1],
                    'UseEventEnd' => false,
                ],
                'Occurrence' => ['Type' => 0, 'Count' => 0],
                'IgnoreObservationPeriod' => true,
            ]],
            'DemographicCriteriaList' => [],
            'Groups' => [],
        ],
    ];
}

/**
 * Negation rule for Measurement events with a numeric value threshold.
 * Example: "no prior eGFR < 60" => measurement_value_exclusion_rule('No prior eGFR<60', $codeset, 'lt', 60).
 */
function measurement_value_exclusion_rule(string $name, int $codeset_id, string $op, float $value): array
{
    return [
        'name' => $name,
        'expression' => [
            'Type' => 'ALL',
            'Count' => 0,
            'CriteriaList' => [[
                'Criteria' => [
                    'Measurement' => [
                        'CodesetId' => $codeset_id,
                        'ValueAsNumber' => ['Value' => $value, 'Op' => $op],
                    ],
                ],
                'StartWindow' => [
                    'Start' => ['Days' => null, 'Coeff' => -1],
                    'End'   => ['Days' => 0,    'Coeff' => -1],
                    'UseEventEnd' => false,
                ],
                'Occurrence' => ['Type' => 0, 'Count' => 0],
                'IgnoreObservationPeriod' => true,
            ]],
            'DemographicCriteriaList' => [],
            'Groups' => [],
        ],
    ];
}

/**
 * Positive inclusion rule for demographic age >= minAge at index event date.
 */
function age_min_inclusion_rule(int $min_age): array
{
    return [
        'name' => "Age >= {$min_age} at index",
        'expression' => [
            'Type' => 'ALL',
            'Count' => 1,
            'CriteriaList' => [],
            'DemographicCriteriaList' => [[
                'Age' => ['Value' => $min_age, 'Op' => 'gte'],
            ]],
            'Groups' => [],
        ],
    ];
}

/**
 * Default cohort-config block.
 */
function default_settings(): array
{
    return [
        'QualifiedLimit'    => ['Type' => 'First'],
        'ExpressionLimit'   => ['Type' => 'First'],
        'CollapseSettings'  => ['CollapseType' => 'ERA', 'EraPad' => 0],
        'CensoringCriteria' => [],
    ];
}

/**
 * EndStrategy: extend cohort_end_date by N days from cohort_start_date.
 * 1825 days = 5-year follow-up window (matches Dr. Bock Q12: 5y censoring).
 */
function end_strategy_5y(): array
{
    return [
        'EndStrategy' => [
            'DateOffset' => [
                'Offset' => 1825,
                'DateField' => 'StartDate',
            ],
        ],
    ];
}

/**
 * Inpatient visit_type filter (concepts 9201 Inpatient + 262 ER+Inpatient combined).
 * For use inside a ConditionOccurrence criteria to require the event to occur during
 * an inpatient encounter (MACE HF qualifier per Dr. Bock Q8).
 */
function inpatient_visit_type_filter(): array
{
    return [
        ['CONCEPT_ID' => 9201, 'CONCEPT_NAME' => 'Inpatient Visit', 'STANDARD_CONCEPT' => 'S', 'INVALID_REASON' => null, 'CONCEPT_CODE' => 'IP', 'DOMAIN_ID' => 'Visit', 'VOCABULARY_ID' => 'Visit', 'CONCEPT_CLASS_ID' => 'Visit'],
        ['CONCEPT_ID' => 262, 'CONCEPT_NAME' => 'Emergency Room and Inpatient Visit', 'STANDARD_CONCEPT' => 'S', 'INVALID_REASON' => null, 'CONCEPT_CODE' => 'ERIP', 'DOMAIN_ID' => 'Visit', 'VOCABULARY_ID' => 'Visit', 'CONCEPT_CLASS_ID' => 'Visit'],
    ];
}

// =================================================================
// Cohort definitions
// =================================================================

// ---------- T_v3 (target) ----------
// Improvements:
//   - Age >= 18 InclusionRule
//   - eGFR < 60 numeric exclusion (uses concept_set 193 lab_egfr)
//   - EndStrategy.DateOffset = 1825 days
$T = [
    'role' => 'target',
    'title' => 'T_v3 - Incident essential hypertension, treatment-naive',
    'description' => 'Incident essential HTN diagnosis in adults >=18 with: no prior cardiovascular disease, thyroid disease, secondary hypertension, antihypertensive exposure, diagnosed abnormal kidney function, or any prior eGFR < 60 measurement. 5-year follow-up era. v3 corrections over v2: adds age >= 18 demographic criterion; adds eGFR < 60 numeric exclusion (was dx-only); EndStrategy enforces 5-year era.',
    'role_link' => ['role' => 'target', 'can_link_after_materialization' => true],
    'entry_event' => ['description' => 'First Essential HTN diagnosis', 'codeset_id' => 0, 'domain_criteria' => 'ConditionOccurrence'],
    'exit_strategy' => 'End at the earliest of cohort_start + 5 years, observation_period_end, or death.',
    'concept_set_ids' => [169, 177, 185, 179, 189, 186, 193],
    'concept_set_asset_ids' => asset_ids_for([169, 177, 185, 179, 189, 186, 193], $asset_map),
    'expression_json' => array_merge([
        'ConceptSets' => build_concept_sets_payload([169, 177, 185, 179, 189, 186, 193]),
        'PrimaryCriteria' => condition_primary(0, 365),
        'InclusionRules' => [
            age_min_inclusion_rule(18),
            exclusion_rule('No prior cardiovascular disease', 1),
            exclusion_rule('No prior thyroid disease', 2),
            exclusion_rule('No prior secondary hypertension', 3),
            exclusion_rule('No prior antihypertensive drug exposure', 4, 'DrugExposure'),
            exclusion_rule('No prior abnormal kidney function diagnosis', 5),
            measurement_value_exclusion_rule('No prior eGFR < 60', 6, 'lt', 60),
        ],
    ], default_settings(), end_strategy_5y()),
];

// ---------- C_v3 (always-normotensive comparator pool) ----------
// Improvements:
//   - Age >= 18 InclusionRule
//   - Always-normotensive: no prior SBP >= 130 AND no prior DBP >= 80
//   - eGFR < 60 numeric exclusion
//   - EndStrategy.DateOffset = 1825 days
$C = [
    'role' => 'comparator',
    'title' => 'C_v3 - Always-normotensive comparator pool (pre-PSM)',
    'description' => 'Adults >=18 with documented BP measurements but: no Essential HTN diagnosis ever; no SBP >= 130 ever; no DBP >= 80 ever; no prior CVD, thyroid, secondary HTN, antihypertensives, abnormal kidney function, or eGFR < 60. 5-year follow-up era. Designed for downstream 1:1 PSM against T_v3 in R MatchIt. v3 corrections over v2: now enforces always-normotensive in Circe (was deferred); adds age, eGFR; EndStrategy.',
    'role_link' => ['role' => 'comparator', 'can_link_after_materialization' => true],
    'entry_event' => ['description' => 'First SBP measurement', 'codeset_id' => 0, 'domain_criteria' => 'Measurement'],
    'exit_strategy' => 'End at the earliest of cohort_start + 5 years, observation_period_end, or death.',
    'concept_set_ids' => [172, 171, 169, 177, 185, 179, 189, 186, 193],
    'concept_set_asset_ids' => asset_ids_for([172, 171, 169, 177, 185, 179, 189, 186, 193], $asset_map),
    'expression_json' => array_merge([
        'ConceptSets' => build_concept_sets_payload([172, 171, 169, 177, 185, 179, 189, 186, 193]),
        'PrimaryCriteria' => measurement_primary(0, 365),
        'InclusionRules' => [
            age_min_inclusion_rule(18),
            measurement_value_exclusion_rule('No prior SBP >= 130', 0, 'gte', 130),
            measurement_value_exclusion_rule('No prior DBP >= 80', 1, 'gte', 80),
            exclusion_rule('No Essential HTN diagnosis ever', 2),
            exclusion_rule('No prior cardiovascular disease', 3),
            exclusion_rule('No prior thyroid disease', 4),
            exclusion_rule('No prior secondary hypertension', 5),
            exclusion_rule('No prior antihypertensive drug exposure', 6, 'DrugExposure'),
            exclusion_rule('No prior abnormal kidney function diagnosis', 7),
            measurement_value_exclusion_rule('No prior eGFR < 60', 8, 'lt', 60),
        ],
    ], default_settings(), end_strategy_5y()),
];

// ---------- O1_v3 (MACE composite — HF inpatient, includes death) ----------
// Improvements over v2:
//   - HF events restricted to inpatient visit_type (9201, 262) per Q8
//   - All-cause death added as a 4th primary-criteria entry
$O1 = [
    'role' => 'outcome',
    'title' => 'O1_v3 - MACE composite (MI + stroke + inpatient HF + death)',
    'description' => 'First occurrence of: MI, stroke (ischemic or hemorrhagic), heart failure during an inpatient or ER+inpatient encounter (visit_type 9201, 262), or all-cause death. v3 corrections over v2: HF now visit-qualified (was unrestricted); Death event added as 4th component.',
    'role_link' => ['role' => 'outcome', 'can_link_after_materialization' => true],
    'entry_event' => ['description' => 'First of MI, stroke, inpatient HF, or death', 'codeset_id' => 0, 'domain_criteria' => 'ConditionOccurrence'],
    'exit_strategy' => 'Event date.',
    'concept_set_ids' => [170, 180, 176],
    'concept_set_asset_ids' => asset_ids_for([170, 180, 176], $asset_map),
    'expression_json' => array_merge([
        'ConceptSets' => build_concept_sets_payload([170, 180, 176]),
        'PrimaryCriteria' => [
            'CriteriaList' => [
                ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
                ['ConditionOccurrence' => ['CodesetId' => 1, 'First' => true]],
                ['ConditionOccurrence' => ['CodesetId' => 2, 'First' => true, 'VisitType' => inpatient_visit_type_filter()]],
                ['Death' => ['First' => true]],
            ],
            'ObservationWindow' => ['PostDays' => 0, 'PriorDays' => 0],
            'PrimaryCriteriaLimit' => ['Type' => 'First'],
        ],
        'InclusionRules' => [],
    ], default_settings()),
];

// ---------- O2_v3 (incident CKD) ----------
// No changes from v2 — design was already correct.
$O2 = [
    'role' => 'outcome',
    'title' => 'O2_v3 - Incident CKD',
    'description' => 'First occurrence of chronic kidney disease after index. Baseline CKD excluded at T_v3 level via both diagnosis-set exclusion (concept_set 186) and eGFR < 60 numeric exclusion (concept_set 193, value < 60). Unchanged from v2.',
    'role_link' => ['role' => 'outcome', 'can_link_after_materialization' => true],
    'entry_event' => ['description' => 'First CKD diagnosis', 'codeset_id' => 0, 'domain_criteria' => 'ConditionOccurrence'],
    'exit_strategy' => 'Event date.',
    'concept_set_ids' => [168],
    'concept_set_asset_ids' => asset_ids_for([168], $asset_map),
    'expression_json' => array_merge([
        'ConceptSets' => build_concept_sets_payload([168]),
        'PrimaryCriteria' => condition_primary(0, 0),
        'InclusionRules' => [],
    ], default_settings()),
];

file_put_contents('/tmp/htn-v3-cohort-T-v3.json',  json_encode($T,  JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
file_put_contents('/tmp/htn-v3-cohort-C-v3.json',  json_encode($C,  JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
file_put_contents('/tmp/htn-v3-cohort-O1-v3.json', json_encode($O1, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
file_put_contents('/tmp/htn-v3-cohort-O2-v3.json', json_encode($O2, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));

echo "BUILT v3" . PHP_EOL;
foreach (['T','C','O1','O2'] as $k) {
    $sz = filesize("/tmp/htn-v3-cohort-{$k}-v3.json");
    echo "  {$k}_v3: " . number_format($sz) . " bytes" . PHP_EOL;
}
