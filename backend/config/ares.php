<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Reference Population — US Census 2020
    |--------------------------------------------------------------------------
    |
    | Age-sex weights for direct standardization. 10 age deciles x 2 genders
    | = 20 strata. Weights are proportions that sum to 1.0.
    |
    | Source: US Census Bureau, 2020 Decennial Census, Table P12
    | https://data.census.gov/table/DECENNIALPL2020.P2
    |
    | Age groups align with Achilles analysis 10 (year_of_birth x gender)
    | bucketed into decade-wide bands.
    |
    */

    'reference_population' => [
        // age_group => [gender_concept_id => weight]
        // Gender concept IDs: 8507 = Male, 8532 = Female
        '0-9'   => [8507 => 0.0612, 8532 => 0.0586],
        '10-19' => [8507 => 0.0651, 8532 => 0.0621],
        '20-29' => [8507 => 0.0690, 8532 => 0.0665],
        '30-39' => [8507 => 0.0689, 8532 => 0.0680],
        '40-49' => [8507 => 0.0614, 8532 => 0.0621],
        '50-59' => [8507 => 0.0640, 8532 => 0.0667],
        '60-69' => [8507 => 0.0572, 8532 => 0.0623],
        '70-79' => [8507 => 0.0350, 8532 => 0.0418],
        '80-89' => [8507 => 0.0145, 8532 => 0.0209],
        '90+'   => [8507 => 0.0037, 8532 => 0.0073],
    ],

    /*
    |--------------------------------------------------------------------------
    | Domain Weights — Unmapped Code Impact Scoring
    |--------------------------------------------------------------------------
    |
    | Used by UnmappedCodeService to weight the impact of unmapped source codes
    | based on their OMOP CDM domain. Higher weight = more clinical impact.
    |
    */

    'domain_weights' => [
        'Condition'   => 1.0,
        'Drug'        => 0.9,
        'Procedure'   => 0.8,
        'Measurement' => 0.7,
        'Observation' => 0.5,
        'Visit'       => 0.3,
        'Device'      => 0.6,
        'Specimen'    => 0.4,
        'Note'        => 0.2,
    ],

    /*
    |--------------------------------------------------------------------------
    | Benchmarks — CDC Prevalence Rates (per 1,000 population)
    |--------------------------------------------------------------------------
    |
    | Reference prevalence rates for common conditions used in concept
    | comparison context. These are approximate US population rates.
    |
    | Sources:
    | - CDC National Health Statistics Reports
    | - NHANES (National Health and Nutrition Examination Survey)
    | - BRFSS (Behavioral Risk Factor Surveillance System)
    |
    */

    'benchmarks' => [
        // concept_id => rate_per_1000
        201826 => 105.0,   // Type 2 diabetes mellitus (CDC: ~10.5%)
        320128 => 474.0,   // Essential hypertension (CDC: ~47.4%)
        255573 => 80.0,    // Chronic obstructive lung disease (CDC: ~8%)
        4329847 => 72.0,   // Myocardial infarction (CDC: 7.2/1000 annually)
        317009 => 64.0,    // Asthma (CDC: ~6.4%)
        4185932 => 19.0,   // Ischemic stroke (CDC: ~1.9%)
        436665 => 83.0,    // Mood disorder (CDC: ~8.3%)
        192671 => 350.0,   // Hyperlipidemia (CDC: ~35%)
    ],

];
