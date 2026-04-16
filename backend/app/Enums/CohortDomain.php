<?php

namespace App\Enums;

enum CohortDomain: string
{
    case CARDIOVASCULAR = 'cardiovascular';
    case METABOLIC = 'metabolic';
    case RENAL = 'renal';
    case ONCOLOGY = 'oncology';
    case RARE_DISEASE = 'rare-disease';
    case PAIN_SUBSTANCE_USE = 'pain-substance-use';
    case PEDIATRIC = 'pediatric';
    case GENERAL = 'general';
    case FINNGEN_ENDPOINT = 'finngen-endpoint';

    public function label(): string
    {
        return match ($this) {
            self::CARDIOVASCULAR => 'Cardiovascular',
            self::METABOLIC => 'Metabolic / Endocrine',
            self::RENAL => 'Renal',
            self::ONCOLOGY => 'Oncology',
            self::RARE_DISEASE => 'Rare Disease',
            self::PAIN_SUBSTANCE_USE => 'Pain & Substance Use',
            self::PEDIATRIC => 'Pediatric',
            self::GENERAL => 'General',
            self::FINNGEN_ENDPOINT => 'FinnGen Endpoint Library',
        };
    }

    /**
     * Map ClinicalGrouping names (from app.clinical_groupings) to CohortDomain values.
     * ClinicalGroupings are more granular (39 groupings); this collapses them into 8 domains.
     *
     * @return array<string, self>
     */
    public static function clinicalGroupingMap(): array
    {
        return [
            // Cardiovascular
            'Cardiovascular' => self::CARDIOVASCULAR,
            'Vascular' => self::CARDIOVASCULAR,
            'Cardiac Testing' => self::CARDIOVASCULAR,

            // Metabolic / Endocrine
            'Endocrine & Metabolic' => self::METABOLIC,
            'Nutritional' => self::METABOLIC,
            'Blood Chemistry' => self::METABOLIC,

            // Renal
            'Renal & Urinary' => self::RENAL,
            'Urinalysis' => self::RENAL,

            // Oncology
            'Neoplasm' => self::ONCOLOGY,
            'Imaging Findings' => self::ONCOLOGY,

            // Pain & Substance Use
            'Pain Syndromes' => self::PAIN_SUBSTANCE_USE,
            'Mental & Behavioral' => self::PAIN_SUBSTANCE_USE,

            // Pediatric (no direct clinical groupings — assigned by age criteria)
            'Pregnancy & Perinatal' => self::PEDIATRIC,
            'Congenital & Genetic' => self::PEDIATRIC,

            // General (everything else)
            'Respiratory' => self::GENERAL,
            'Neurological' => self::GENERAL,
            'Gastrointestinal' => self::GENERAL,
            'Hepatobiliary' => self::GENERAL,
            'Musculoskeletal' => self::GENERAL,
            'Reproductive & Breast' => self::GENERAL,
            'Dermatological' => self::GENERAL,
            'Hematologic' => self::GENERAL,
            'Infectious Disease' => self::GENERAL,
            'Eye & Vision' => self::GENERAL,
            'Ear & Hearing' => self::GENERAL,
            'Injury, Poisoning & Procedural' => self::GENERAL,
            'Immune System' => self::GENERAL,
            'General Signs & Symptoms' => self::GENERAL,
            'Body Region Findings' => self::GENERAL,
            'Functional Impairment' => self::GENERAL,
            'Investigations' => self::GENERAL,
            'Vital Signs' => self::GENERAL,
            'Hematology' => self::GENERAL,
            'Microbiology' => self::GENERAL,
            'Pulmonary Function' => self::GENERAL,
            'Social History' => self::GENERAL,
            'Family History' => self::GENERAL,
            'Personal History' => self::GENERAL,
            'Functional Status' => self::GENERAL,
            'Health Behaviors' => self::GENERAL,
            'Administrative' => self::GENERAL,
            'Surgical' => self::GENERAL,
            'Evaluation' => self::GENERAL,
            'Therapeutic' => self::GENERAL,
            'Rehabilitation' => self::GENERAL,
            'Preventive' => self::GENERAL,
        ];
    }
}
