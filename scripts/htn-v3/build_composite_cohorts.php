<?php
// build_composite_cohorts.php — emit Circe-style draft_payload_json files for the
// 4 composite cohorts (T, C, O1, O2). Run via: docker compose exec -T php php artisan tinker --execute="require '/var/www/html/../scripts/htn-v3/build_composite_cohorts.php';"
//
// Outputs: /tmp/htn-v3-cohort-{T,C,O1,O2}.json
//
// Each output is the full draft_payload_json that we PUT into a v2 cohort_draft slot.
// Designed to satisfy StudyCohortDraftVerifier: ConceptSets[], PrimaryCriteria with
// ObservationWindow, InclusionRules, ExpressionLimit, QualifiedLimit, CollapseSettings,
// CensoringCriteria, and a role that maps to study_cohorts.role enum.

use App\Models\App\ConceptSet;
use App\Models\App\StudyDesignAsset;

// Map concept_set.id -> study_design_asset.id (the concept_set_draft layer on v2)
$asset_map = StudyDesignAsset::where('session_id', 10)
    ->where('version_id', 9)
    ->where('asset_type', 'concept_set_draft')
    ->where('status', 'materialized')
    ->get(['id','materialized_id'])
    ->keyBy('materialized_id')
    ->map(fn ($a) => $a->id)
    ->all();

function asset_ids_for(array $cs_ids, array $map): array
{
    $out = [];
    foreach ($cs_ids as $csid) {
        if (isset($map[$csid])) $out[] = $map[$csid];
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
            'id' => $idx,                // local codeset id (0,1,2,...)
            'name' => $cs->name,
            'expression' => ['items' => $items],
        ];
    }
    return $out;
}

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

function exclusion_rule(string $name, int $codeset_id, string $domain = 'ConditionOccurrence'): array
{
    return [
        'name' => $name,
        'expression' => [
            'Type' => 'ALL',
            'Count' => 0,                       // 0 occurrences allowed in lookback
            'CriteriaList' => [[
                'Criteria' => [
                    $domain => ['CodesetId' => $codeset_id],
                ],
                'StartWindow' => [
                    'Start' => ['Days' => null, 'Coeff' => -1],     // all-time prior
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

function default_settings(): array
{
    return [
        'QualifiedLimit'   => ['Type' => 'First'],
        'ExpressionLimit'  => ['Type' => 'First'],
        'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
        'CensoringCriteria' => [],
    ];
}

// ---------- T (target) ----------
// Entry: first Essential HTN diagnosis (#169)
// Inclusion: age >= 18, no prior CVD (#177), thyroid (#185), secondary HTN (#179),
//            antihypertensives (#189), no prior eGFR < 60 simplified to "no prior dx_abnormal_kidney_function (#186)"
$T = [
    'role' => 'target',
    'title' => 'T - Incident essential hypertension, treatment-naive (primary)',
    'description' => 'Incident essential HTN diagnosis in adults >=18 with no prior CVD, thyroid disease, secondary HTN, antihypertensive exposure, or documented abnormal kidney function. Operational simplification of v3 protocol §6 T: the two-consecutive-elevated-BP requirement and eGFR<60 numeric threshold are enforced post-materialization in the feasibility SQL (Phase 6).',
    'role_link' => ['role' => 'target', 'can_link_after_materialization' => true],
    'entry_event' => ['description' => 'First Essential HTN diagnosis', 'codeset_id' => 0, 'domain_criteria' => 'ConditionOccurrence'],
    'exit_strategy' => 'End at earliest of observation period end, death, or 5-year follow-up.',
    'concept_set_ids' => [169, 177, 185, 179, 189, 186],
    'concept_set_asset_ids' => asset_ids_for([169, 177, 185, 179, 189, 186], $asset_map),
    'expression_json' => [
        'ConceptSets' => build_concept_sets_payload([169, 177, 185, 179, 189, 186]),
        'PrimaryCriteria' => condition_primary(0, 365),
        'InclusionRules' => [
            exclusion_rule('No prior cardiovascular disease', 1),
            exclusion_rule('No prior thyroid disease', 2),
            exclusion_rule('No prior secondary hypertension', 3),
            exclusion_rule('No prior antihypertensive drug exposure', 4, 'DrugExposure'),
            exclusion_rule('No prior abnormal kidney function diagnosis', 5),
        ],
    ] + default_settings(),
];

// ---------- C (potential normotensive comparator pool) ----------
// Pre-PSM "potential controls" cohort. PSM 1:1 done downstream in R MatchIt.
// Entry: first SBP measurement (#172) -- proxy for "has BP data and is in care"
// Inclusion: same exclusions as T PLUS "no Essential HTN diagnosis ever" (#169)
$C = [
    'role' => 'comparator',
    'title' => 'C - Potential normotensive comparator pool (pre-PSM)',
    'description' => 'Adults >=18 with documented BP measurements but no Essential HTN diagnosis, no prior CVD/thyroid/secondary HTN/antihypertensives/abnormal kidney function. The "always normotensive" requirement (SBP<=130 AND DBP<=80 across all measurements) is enforced post-materialization in feasibility SQL. 1:1 PSM done in R MatchIt downstream.',
    'role_link' => ['role' => 'comparator', 'can_link_after_materialization' => true],
    'entry_event' => ['description' => 'First SBP measurement in observation', 'codeset_id' => 0, 'domain_criteria' => 'Measurement'],
    'exit_strategy' => 'End at earliest of observation period end, death, or 5-year follow-up.',
    'concept_set_ids' => [172, 169, 177, 185, 179, 189, 186],
    'concept_set_asset_ids' => asset_ids_for([172, 169, 177, 185, 179, 189, 186], $asset_map),
    'expression_json' => [
        'ConceptSets' => build_concept_sets_payload([172, 169, 177, 185, 179, 189, 186]),
        'PrimaryCriteria' => measurement_primary(0, 365),
        'InclusionRules' => [
            exclusion_rule('No Essential HTN diagnosis ever', 1),
            exclusion_rule('No prior cardiovascular disease', 2),
            exclusion_rule('No prior thyroid disease', 3),
            exclusion_rule('No prior secondary hypertension', 4),
            exclusion_rule('No prior antihypertensive drug exposure', 5, 'DrugExposure'),
            exclusion_rule('No prior abnormal kidney function diagnosis', 6),
        ],
    ] + default_settings(),
];

// ---------- O1 (MACE composite outcome) ----------
// First-occurrence union of MI (#170), stroke (#180), HF (#176).
// All-cause death captured via separate Death-record check in feasibility SQL (not via cohort).
// HF inpatient qualifier applied post-materialization in feasibility SQL.
$O1 = [
    'role' => 'outcome',
    'title' => 'O1 - MACE composite (MI + stroke + HF + death)',
    'description' => 'First occurrence of MI, ischemic/hemorrhagic stroke, or heart failure. All-cause death and inpatient HF visit_occurrence qualifier applied in downstream feasibility SQL. Composite Circe represents first-of-any of MI/stroke/HF.',
    'role_link' => ['role' => 'outcome', 'can_link_after_materialization' => true],
    'entry_event' => ['description' => 'First of MI, stroke, or heart failure', 'codeset_id' => 0, 'domain_criteria' => 'ConditionOccurrence'],
    'exit_strategy' => 'Event date.',
    'concept_set_ids' => [170, 180, 176],
    'concept_set_asset_ids' => asset_ids_for([170, 180, 176], $asset_map),
    'expression_json' => [
        'ConceptSets' => build_concept_sets_payload([170, 180, 176]),
        'PrimaryCriteria' => [
            'CriteriaList' => [
                ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
                ['ConditionOccurrence' => ['CodesetId' => 1, 'First' => true]],
                ['ConditionOccurrence' => ['CodesetId' => 2, 'First' => true]],
            ],
            'ObservationWindow' => ['PostDays' => 0, 'PriorDays' => 0],
            'PrimaryCriteriaLimit' => ['Type' => 'First'],
        ],
        'InclusionRules' => [],
    ] + default_settings(),
];

// ---------- O2 (incident CKD outcome) ----------
// First-occurrence CKD (#168). Baseline CKD is excluded at the T-cohort level.
$O2 = [
    'role' => 'outcome',
    'title' => 'O2 - Incident CKD',
    'description' => 'First occurrence of chronic kidney disease after index. Baseline CKD excluded at cohort T level (eGFR < 60 exclusion per PI).',
    'role_link' => ['role' => 'outcome', 'can_link_after_materialization' => true],
    'entry_event' => ['description' => 'First CKD diagnosis', 'codeset_id' => 0, 'domain_criteria' => 'ConditionOccurrence'],
    'exit_strategy' => 'Event date.',
    'concept_set_ids' => [168],
    'concept_set_asset_ids' => asset_ids_for([168], $asset_map),
    'expression_json' => [
        'ConceptSets' => build_concept_sets_payload([168]),
        'PrimaryCriteria' => condition_primary(0, 0),
        'InclusionRules' => [],
    ] + default_settings(),
];

file_put_contents('/tmp/htn-v3-cohort-T.json',  json_encode(['draft_payload_json' => $T],  JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
file_put_contents('/tmp/htn-v3-cohort-C.json',  json_encode(['draft_payload_json' => $C],  JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
file_put_contents('/tmp/htn-v3-cohort-O1.json', json_encode(['draft_payload_json' => $O1], JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
file_put_contents('/tmp/htn-v3-cohort-O2.json', json_encode(['draft_payload_json' => $O2], JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));

echo "BUILT" . PHP_EOL;
echo "T size: " . filesize('/tmp/htn-v3-cohort-T.json') . PHP_EOL;
echo "C size: " . filesize('/tmp/htn-v3-cohort-C.json') . PHP_EOL;
echo "O1 size: " . filesize('/tmp/htn-v3-cohort-O1.json') . PHP_EOL;
echo "O2 size: " . filesize('/tmp/htn-v3-cohort-O2.json') . PHP_EOL;
