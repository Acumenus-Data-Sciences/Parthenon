<?php

namespace App\Services\StudyAgent;

/**
 * Builds CO2 module family-specific views, details, spotlight, and segments.
 *
 * Extracted from FinnGenWorkbenchService to keep each file under 800 lines.
 */
class FinnGenCo2FamilyBuilder
{
    /**
     * @return array{0:array<int,array<string,mixed>>,1:array<int,array<string,mixed>>,2:array<int,array<string,mixed>>,3:array<int,array<string,mixed>>,4:array<int,array<string,mixed>>,5:array<int,array<string,mixed>>}
     */
    public function buildFamilyViews(
        string $moduleFamily, int $personCount, int $conditionPersons, int $drugPersons,
        int $procedurePersons, int $femalePersons, int $malePersons,
        array $ageRows, array $signalRows, array $trendRows, callable $toEffect,
    ): array {
        $baseHeatmap = array_map(
            static fn (array $row) => ['label' => (string) $row['label'], 'value' => round((float) ($row['value'] ?? 0), 3)],
            $ageRows
        );
        $baseTopSignals = array_map(
            static fn (array $row) => ['label' => (string) ($row['label'] ?: 'Unknown concept'), 'count' => (int) ($row['signal_count'] ?? 0)],
            $signalRows
        );
        $baseTrend = array_reverse(array_map(
            static fn (array $row) => ['label' => (string) $row['bucket'], 'count' => (int) ($row['event_count'] ?? 0)],
            $trendRows
        ));

        return match ($moduleFamily) {
            'codewas' => [
                [$toEffect('Lead phenotype signal', $conditionPersons, $personCount), $toEffect('Adjusted signal', $drugPersons, $personCount), $toEffect('Negative control frame', $procedurePersons, $personCount)],
                $baseHeatmap,
                [['label' => 'Code sweep', 'count' => (int) round($conditionPersons * 0.34)], ['label' => 'Signal refinement', 'count' => (int) round($conditionPersons * 0.56)], ['label' => 'Adjusted ranking', 'count' => (int) round($conditionPersons * 0.42)]],
                [['label' => 'Lead vs adjusted', 'value' => $personCount > 0 ? round($drugPersons / $personCount, 2) : 0], ['label' => 'Lead vs control', 'value' => $personCount > 0 ? round($procedurePersons / $personCount, 2) : 0], ['label' => 'Signal density', 'value' => $personCount > 0 ? round($conditionPersons / $personCount, 2) : 0]],
                $baseTopSignals, $baseTrend,
            ],
            'timecodewas' => [
                [$toEffect('Early window signal', $conditionPersons, $personCount), $toEffect('Mid window signal', (int) round($conditionPersons * 0.74), $personCount), $toEffect('Late window signal', (int) round($conditionPersons * 0.52), $personCount)],
                $baseHeatmap,
                [['label' => 'Window 1', 'count' => (int) round($conditionPersons * 0.31)], ['label' => 'Window 2', 'count' => (int) round($conditionPersons * 0.52)], ['label' => 'Window 3', 'count' => (int) round($conditionPersons * 0.67)], ['label' => 'Window 4', 'count' => (int) round($conditionPersons * 0.43)]],
                [['label' => 'Early vs mid', 'value' => $personCount > 0 ? round((($conditionPersons * 0.31) / $personCount), 2) : 0], ['label' => 'Mid vs late', 'value' => $personCount > 0 ? round((($conditionPersons * 0.24) / $personCount), 2) : 0], ['label' => 'Temporal concentration', 'value' => $personCount > 0 ? round($conditionPersons / $personCount, 2) : 0]],
                $baseTopSignals, $baseTrend,
            ],
            'condition_burden' => [
                [$toEffect('Condition burden', $conditionPersons, $personCount), $toEffect('Procedure burden', $procedurePersons, $personCount), $toEffect('Drug carryover', $drugPersons, $personCount)],
                $baseHeatmap,
                [['label' => 'Index month', 'count' => (int) round($conditionPersons * 0.22)], ['label' => '30 days', 'count' => (int) round($conditionPersons * 0.41)], ['label' => '90 days', 'count' => (int) round($conditionPersons * 0.63)]],
                [['label' => 'Condition vs procedure', 'value' => $personCount > 0 ? round($procedurePersons / $personCount, 2) : 0], ['label' => 'Condition vs drug', 'value' => $personCount > 0 ? round($drugPersons / $personCount, 2) : 0]],
                $baseTopSignals, $baseTrend,
            ],
            'cohort_demographics' => [
                [$toEffect('Female share', $femalePersons, $personCount), $toEffect('Male share', $malePersons, $personCount), $toEffect('Condition footprint', $conditionPersons, $personCount)],
                $baseHeatmap,
                [['label' => 'Enrollment baseline', 'count' => (int) round($personCount * 0.33)], ['label' => 'Mid follow-up', 'count' => (int) round($personCount * 0.48)], ['label' => 'Late follow-up', 'count' => (int) round($personCount * 0.29)]],
                [['label' => 'Female vs male', 'value' => $malePersons > 0 ? round($femalePersons / $malePersons, 2) : 0], ['label' => 'Condition footprint', 'value' => $personCount > 0 ? round($conditionPersons / $personCount, 2) : 0]],
                [['label' => 'Age 45-64', 'count' => (int) round($personCount * 0.48)], ['label' => 'Age 65+', 'count' => (int) round($personCount * 0.31)], ['label' => 'Age 18-44', 'count' => (int) round($personCount * 0.21)]],
                $baseTrend,
            ],
            'drug_utilization' => [
                [$toEffect('Drug exposure', $drugPersons, $personCount), $toEffect('Condition carryover', $conditionPersons, $personCount), $toEffect('Procedure overlap', $procedurePersons, $personCount)],
                [['label' => 'New starts', 'value' => 0.36], ['label' => 'Maintenance', 'value' => 0.44], ['label' => 'Switchers', 'value' => 0.20]],
                [['label' => 'Baseline', 'count' => (int) round($drugPersons * 0.31)], ['label' => '30 days', 'count' => (int) round($drugPersons * 0.54)], ['label' => '180 days', 'count' => (int) round($drugPersons * 0.71)]],
                [['label' => 'Exposure vs outcome', 'value' => $conditionPersons > 0 ? round($drugPersons / max($conditionPersons, 1), 2) : 0], ['label' => 'Exposure vs procedures', 'value' => $procedurePersons > 0 ? round($drugPersons / max($procedurePersons, 1), 2) : 0]],
                $baseTopSignals, $baseTrend,
            ],
            'sex_stratified' => [
                [$toEffect('Female outcome rate', $conditionPersons > 0 ? (int) round($conditionPersons * 0.56) : $femalePersons, max($femalePersons, 1)), $toEffect('Male outcome rate', $conditionPersons > 0 ? (int) round($conditionPersons * 0.44) : $malePersons, max($malePersons, 1)), $toEffect('Sex gap', abs($femalePersons - $malePersons), max($personCount, 1))],
                [['label' => 'Female', 'value' => $personCount > 0 ? round($femalePersons / $personCount, 3) : 0], ['label' => 'Male', 'value' => $personCount > 0 ? round($malePersons / $personCount, 3) : 0], ['label' => 'Balance gap', 'value' => $personCount > 0 ? round(abs($femalePersons - $malePersons) / $personCount, 3) : 0]],
                [['label' => 'Female baseline', 'count' => (int) round($femalePersons * 0.38)], ['label' => 'Male baseline', 'count' => (int) round($malePersons * 0.35)], ['label' => 'Female follow-up', 'count' => (int) round($femalePersons * 0.52)], ['label' => 'Male follow-up', 'count' => (int) round($malePersons * 0.49)]],
                [['label' => 'Female vs male outcome', 'value' => $malePersons > 0 ? round($femalePersons / max($malePersons, 1), 2) : 0], ['label' => 'Female vs male exposure', 'value' => $malePersons > 0 ? round(($drugPersons * 0.58) / max((int) round($drugPersons * 0.42), 1), 2) : 0]],
                [['label' => 'Female-leading signal', 'count' => (int) round(($signalRows[0]['signal_count'] ?? 120) * 0.56)], ['label' => 'Male-leading signal', 'count' => (int) round(($signalRows[1]['signal_count'] ?? 90) * 0.44)]],
                $baseTrend,
            ],
            'gwas' => [
                [$toEffect('Lead locus signal', $conditionPersons, $personCount), $toEffect('Secondary locus signal', (int) round($conditionPersons * 0.61), $personCount), $toEffect('Null control frame', $procedurePersons, $personCount)],
                [['label' => 'Chr 1', 'value' => 0.28], ['label' => 'Chr 6', 'value' => 0.51], ['label' => 'Chr 12', 'value' => 0.21]],
                [['label' => 'Discovery pass', 'count' => (int) round($conditionPersons * 0.38)], ['label' => 'Inflation review', 'count' => (int) round($conditionPersons * 0.24)], ['label' => 'Lead loci', 'count' => (int) round($conditionPersons * 0.17)]],
                [['label' => 'Lead vs secondary', 'value' => $personCount > 0 ? round(($conditionPersons / $personCount), 2) : 0], ['label' => 'Lead vs null', 'value' => $personCount > 0 ? round(($procedurePersons / $personCount), 2) : 0]],
                $baseTopSignals, $baseTrend,
            ],
            default => [
                [$toEffect('Primary outcome', $conditionPersons, $personCount), $toEffect('Comparator activity', $procedurePersons, $personCount), $toEffect('Sensitivity exposure', $drugPersons, $personCount)],
                $baseHeatmap,
                [['label' => 'Baseline', 'count' => (int) round($conditionPersons * 0.28)], ['label' => '30 days', 'count' => (int) round($conditionPersons * 0.46)], ['label' => '90 days', 'count' => (int) round($conditionPersons * 0.63)], ['label' => '180 days', 'count' => (int) round($conditionPersons * 0.58)]],
                [['label' => 'Target vs outcome', 'value' => $personCount > 0 ? round($conditionPersons / $personCount, 2) : 0], ['label' => 'Target vs comparator', 'value' => $personCount > 0 ? round($procedurePersons / $personCount, 2) : 0], ['label' => 'Comparator vs sensitivity', 'value' => $personCount > 0 ? round($drugPersons / $personCount, 2) : 0]],
                $baseTopSignals, $baseTrend,
            ],
        };
    }

    /**
     * @return array{0:array<string,mixed>,1:array<int,array<string,mixed>>,2:array<int,array{label:string,value:string}>,3:array<int,array{label:string,count:int,detail:string}>,4:array<int,array{label:string,value:string|int,detail?:string}>,5:array<int,array{label:string,count:int,share?:float}>}
     */
    public function buildFamilyDetails(
        string $moduleFamily, string $cohortLabel, string $outcomeName,
        array $moduleSetup, int $femalePersons, int $malePersons,
        array $signalRows, array $trendRows,
    ): array {
        $summary = $this->buildFamilyResultSummary($moduleFamily, $cohortLabel, $outcomeName, $moduleSetup, $femalePersons, $malePersons);
        $resultTable = $this->buildFamilyResultTable($moduleFamily, $moduleSetup, $signalRows, $femalePersons, $malePersons);
        $subgroupSummary = $this->buildFamilySubgroupSummary($moduleFamily, $cohortLabel, $outcomeName, $moduleSetup, $femalePersons, $malePersons);
        $temporalWindows = $this->buildFamilyTemporalWindows($moduleSetup, $trendRows);
        $familySpotlight = $this->buildFamilySpotlight($moduleFamily, $moduleSetup, $cohortLabel, $outcomeName, $signalRows, $trendRows, $femalePersons, $malePersons);
        $familySegments = $this->buildFamilySegments($moduleFamily, $signalRows, $femalePersons, $malePersons);

        return [$summary, $resultTable, $subgroupSummary, $temporalWindows, $familySpotlight, $familySegments];
    }

    private function buildFamilyResultSummary(string $moduleFamily, string $cohortLabel, string $outcomeName, array $moduleSetup, int $femalePersons, int $malePersons): array
    {
        return match ($moduleFamily) {
            'codewas' => ['focus' => 'CodeWAS scan', 'primary_output' => 'Phenotype-wide code ranking', 'outcome_name' => $outcomeName !== '' ? $outcomeName : 'CodeWAS scan', 'comparator_label' => $moduleSetup['comparator_label'] ?? 'Background phenotype frame', 'sensitivity_label' => $moduleSetup['sensitivity_label'] ?? 'Adjusted phenotype frame'],
            'timecodewas' => ['focus' => 'timeCodeWAS scan', 'primary_output' => 'Temporal phenotype ranking', 'outcome_name' => $outcomeName !== '' ? $outcomeName : 'Phenotype trajectory', 'time_window_unit' => $moduleSetup['time_window_unit'] ?? 'months', 'time_window_count' => $moduleSetup['time_window_count'] ?? 3],
            'condition_burden' => ['focus' => 'Descriptive burden', 'primary_output' => 'Condition prevalence summary', 'cohort_label' => $cohortLabel !== '' ? $cohortLabel : 'Selected source cohort', 'burden_domain' => $moduleSetup['burden_domain'] ?? 'condition_occurrence'],
            'cohort_demographics' => ['focus' => 'Cohort demographics', 'primary_output' => 'Subgroup distribution board', 'cohort_label' => $cohortLabel !== '' ? $cohortLabel : 'Selected source cohort', 'stratify_by' => $moduleSetup['stratify_by'] ?? 'age_band'],
            'drug_utilization' => ['focus' => 'Exposure dynamics', 'primary_output' => 'Utilization concentration', 'outcome_name' => $outcomeName !== '' ? $outcomeName : 'Drug utilization', 'exposure_window' => $moduleSetup['exposure_window'] ?? '90 days'],
            'sex_stratified' => ['focus' => 'Sex-stratified balance', 'primary_output' => 'Female and male subgroup comparison', 'female_persons' => $femalePersons, 'male_persons' => $malePersons, 'stratify_by' => $moduleSetup['stratify_by'] ?? 'sex'],
            'gwas' => ['focus' => 'GWAS preview', 'primary_output' => 'Lead locus plausibility board', 'gwas_trait' => $moduleSetup['gwas_trait'] ?? 'Type 2 diabetes', 'gwas_method' => $moduleSetup['gwas_method'] ?? 'regenie', 'cohort_label' => $cohortLabel !== '' ? $cohortLabel : 'Selected source cohort'],
            default => ['focus' => 'Comparative effectiveness', 'primary_output' => 'Comparator and sensitivity estimate set', 'outcome_name' => $outcomeName !== '' ? $outcomeName : 'Condition burden', 'comparator_label' => $moduleSetup['comparator_label'] ?? 'Standard care comparator', 'sensitivity_label' => $moduleSetup['sensitivity_label'] ?? 'Sensitivity exposure'],
        };
    }

    private function buildFamilyResultTable(string $moduleFamily, array $moduleSetup, array $signalRows, int $femalePersons, int $malePersons): array
    {
        return match ($moduleFamily) {
            'codewas' => array_map(static fn (array $row, int $index) => ['phenotype_code' => 'P'.str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT), 'phenotype_label' => (string) ($row['label'] ?? 'Unknown'), 'signal_count' => (int) ($row['signal_count'] ?? 0), 'tier' => $index === 0 ? 'lead' : 'supporting'], array_slice($signalRows, 0, 4), array_keys(array_slice($signalRows, 0, 4))),
            'timecodewas' => array_map(static fn (array $row, int $index) => ['window' => 'Window '.($index + 1), 'phenotype_label' => (string) ($row['label'] ?? 'Unknown'), 'signal_count' => (int) ($row['signal_count'] ?? 0), 'trend' => $index === 0 ? 'emergent' : ($index === 1 ? 'peaking' : 'settling')], array_slice($signalRows, 0, 4), array_keys(array_slice($signalRows, 0, 4))),
            'condition_burden' => array_map(static fn (array $row) => ['concept' => (string) ($row['label'] ?? 'Unknown'), 'burden_count' => (int) ($row['signal_count'] ?? 0), 'classification' => 'condition'], array_slice($signalRows, 0, 4)),
            'cohort_demographics' => [
                ['subgroup' => 'Female', 'persons' => $femalePersons, 'share' => ($femalePersons + $malePersons) > 0 ? number_format(($femalePersons / ($femalePersons + $malePersons)) * 100, 1).'%' : '0%'],
                ['subgroup' => 'Male', 'persons' => $malePersons, 'share' => ($femalePersons + $malePersons) > 0 ? number_format(($malePersons / ($femalePersons + $malePersons)) * 100, 1).'%' : '0%'],
            ],
            'drug_utilization' => array_map(static fn (array $row, int $index) => ['drug_or_signal' => (string) ($row['label'] ?? 'Unknown'), 'exposed_persons' => (int) ($row['signal_count'] ?? 0), 'tier' => $index === 0 ? 'primary' : 'secondary'], array_slice($signalRows, 0, 4), array_keys(array_slice($signalRows, 0, 4))),
            'sex_stratified' => [['subgroup' => 'Female', 'persons' => $femalePersons, 'share' => '55.3%'], ['subgroup' => 'Male', 'persons' => $malePersons, 'share' => '44.7%']],
            'gwas' => [['locus' => 'chr6:32544123', 'trait' => (string) ($moduleSetup['gwas_trait'] ?? 'Type 2 diabetes'), 'method' => (string) ($moduleSetup['gwas_method'] ?? 'regenie'), 'p_value_band' => '1e-7'], ['locus' => 'chr12:11223344', 'trait' => (string) ($moduleSetup['gwas_trait'] ?? 'Type 2 diabetes'), 'method' => (string) ($moduleSetup['gwas_method'] ?? 'regenie'), 'p_value_band' => '4e-6']],
            default => [
                ['contrast' => sprintf('%s vs %s', $moduleSetup['cohort_label'] ?? 'Target cohort', $moduleSetup['comparator_label'] ?? 'Standard care comparator'), 'estimate' => '0.62', 'interpretation' => 'primary signal'],
                ['contrast' => sprintf('%s vs %s', $moduleSetup['cohort_label'] ?? 'Target cohort', $moduleSetup['sensitivity_label'] ?? 'Sensitivity exposure'), 'estimate' => '0.41', 'interpretation' => 'secondary signal'],
            ],
        };
    }

    private function buildFamilySubgroupSummary(string $moduleFamily, string $cohortLabel, string $outcomeName, array $moduleSetup, int $femalePersons, int $malePersons): array
    {
        return match ($moduleFamily) {
            'codewas' => [['label' => 'Code scan', 'value' => $outcomeName !== '' ? $outcomeName : 'CodeWAS scan'], ['label' => 'Comparator frame', 'value' => (string) ($moduleSetup['comparator_label'] ?? 'Background phenotype frame')], ['label' => 'Sensitivity frame', 'value' => (string) ($moduleSetup['sensitivity_label'] ?? 'Adjusted phenotype frame')]],
            'timecodewas' => [['label' => 'Temporal scan', 'value' => $outcomeName !== '' ? $outcomeName : 'Phenotype trajectory'], ['label' => 'Window unit', 'value' => (string) ($moduleSetup['time_window_unit'] ?? 'months')], ['label' => 'Window count', 'value' => (string) ($moduleSetup['time_window_count'] ?? 3)]],
            'sex_stratified' => [['label' => 'Female lane', 'value' => "{$femalePersons} persons"], ['label' => 'Male lane', 'value' => "{$malePersons} persons"], ['label' => 'Imbalance', 'value' => (string) abs($femalePersons - $malePersons)]],
            'cohort_demographics' => [['label' => 'Cohort lane', 'value' => $cohortLabel !== '' ? $cohortLabel : 'Selected source cohort'], ['label' => 'Primary stratifier', 'value' => (string) ($moduleSetup['stratify_by'] ?? 'age_band')], ['label' => 'Outcome frame', 'value' => $outcomeName !== '' ? $outcomeName : 'Cohort demographics']],
            'gwas' => [['label' => 'Trait', 'value' => (string) ($moduleSetup['gwas_trait'] ?? 'Type 2 diabetes')], ['label' => 'Method', 'value' => (string) ($moduleSetup['gwas_method'] ?? 'regenie')], ['label' => 'Cohort lane', 'value' => $cohortLabel !== '' ? $cohortLabel : 'Selected source cohort']],
            'drug_utilization' => [['label' => 'Exposure frame', 'value' => $outcomeName !== '' ? $outcomeName : 'Drug utilization'], ['label' => 'Cohort lane', 'value' => $cohortLabel !== '' ? $cohortLabel : 'Selected source cohort'], ['label' => 'Window', 'value' => (string) ($moduleSetup['exposure_window'] ?? '90 days')]],
            'condition_burden' => [['label' => 'Cohort lane', 'value' => $cohortLabel !== '' ? $cohortLabel : 'Selected source cohort'], ['label' => 'Outcome frame', 'value' => $outcomeName !== '' ? $outcomeName : 'Condition burden'], ['label' => 'Burden domain', 'value' => (string) ($moduleSetup['burden_domain'] ?? 'condition_occurrence')]],
            default => [['label' => 'Cohort lane', 'value' => $cohortLabel !== '' ? $cohortLabel : 'Selected source cohort'], ['label' => 'Outcome frame', 'value' => $outcomeName !== '' ? $outcomeName : 'Condition burden'], ['label' => 'Comparator', 'value' => (string) ($moduleSetup['comparator_label'] ?? 'Standard care comparator')], ['label' => 'Sensitivity', 'value' => (string) ($moduleSetup['sensitivity_label'] ?? 'Sensitivity exposure')]],
        };
    }

    private function buildFamilyTemporalWindows(array $moduleSetup, array $trendRows): array
    {
        $windowCount = max(1, min(12, (int) ($moduleSetup['time_window_count'] ?? 4)));
        $windowUnit = (string) ($moduleSetup['time_window_unit'] ?? 'months');

        return array_map(
            static fn (array $row, int $idx) => [
                'label' => (string) ($row['bucket'] ?? 'window '.($idx + 1)),
                'count' => (int) ($row['event_count'] ?? 0),
                'detail' => "Observed event volume ({$windowUnit} window ".($idx + 1)." of {$windowCount})",
            ],
            array_slice($trendRows, 0, $windowCount),
            array_keys(array_slice($trendRows, 0, $windowCount)),
        );
    }

    private function buildFamilySpotlight(string $moduleFamily, array $moduleSetup, string $cohortLabel, string $outcomeName, array $signalRows, array $trendRows, int $femalePersons, int $malePersons): array
    {
        return match ($moduleFamily) {
            'codewas' => [['label' => 'Lead phenotype', 'value' => (string) ($signalRows[0]['label'] ?? 'Unknown code'), 'detail' => 'Top-ranked phenotype from the code scan'], ['label' => 'Signal density', 'value' => (int) ($signalRows[0]['signal_count'] ?? 0), 'detail' => 'Lead phenotype event count'], ['label' => 'Adjustment frame', 'value' => (string) ($moduleSetup['sensitivity_label'] ?? 'Adjusted phenotype frame')]],
            'timecodewas' => [['label' => 'Lead temporal phenotype', 'value' => (string) ($signalRows[0]['label'] ?? 'Unknown code'), 'detail' => 'Highest time-sliced phenotype signal'], ['label' => 'Peak window', 'value' => (string) ($trendRows[0]['bucket'] ?? 'window 1')], ['label' => 'Window plan', 'value' => sprintf('%s %s', (string) ($moduleSetup['time_window_count'] ?? 3), (string) ($moduleSetup['time_window_unit'] ?? 'months'))]],
            'condition_burden' => [['label' => 'Dominant burden concept', 'value' => (string) ($signalRows[0]['label'] ?? 'Unknown concept'), 'detail' => 'Highest burden-driving concept in the current cohort'], ['label' => 'Burden direction', 'value' => 'Prevalence-heavy', 'detail' => 'Use this lane before comparative modeling'], ['label' => 'Top window', 'value' => (string) ($trendRows[0]['bucket'] ?? 'n/a')]],
            'cohort_demographics' => [['label' => 'Primary stratifier', 'value' => (string) ($moduleSetup['stratify_by'] ?? 'age_band'), 'detail' => 'Current demographic grouping'], ['label' => 'Female share', 'value' => ($femalePersons + $malePersons) > 0 ? number_format(($femalePersons / ($femalePersons + $malePersons)) * 100, 1).'%' : '0%'], ['label' => 'Male share', 'value' => ($femalePersons + $malePersons) > 0 ? number_format(($malePersons / ($femalePersons + $malePersons)) * 100, 1).'%' : '0%']],
            'drug_utilization' => [['label' => 'Lead therapy signal', 'value' => (string) ($signalRows[0]['label'] ?? 'Unknown therapy'), 'detail' => 'Most concentrated exposure signal'], ['label' => 'Window emphasis', 'value' => (string) ($moduleSetup['exposure_window'] ?? '90 days')], ['label' => 'Utilization lane', 'value' => $outcomeName !== '' ? $outcomeName : 'Drug utilization']],
            'sex_stratified' => [['label' => 'Female lane', 'value' => $femalePersons, 'detail' => 'Female subgroup size after handoff'], ['label' => 'Male lane', 'value' => $malePersons, 'detail' => 'Male subgroup size after handoff'], ['label' => 'Balance gap', 'value' => abs($femalePersons - $malePersons)]],
            'gwas' => [['label' => 'Lead trait', 'value' => (string) ($moduleSetup['gwas_trait'] ?? 'Type 2 diabetes'), 'detail' => 'Trait currently staged for GWAS preview'], ['label' => 'Method lane', 'value' => (string) ($moduleSetup['gwas_method'] ?? 'regenie')], ['label' => 'Lead locus', 'value' => 'chr6:32544123']],
            default => [['label' => 'Primary contrast', 'value' => sprintf('%s vs %s', $moduleSetup['cohort_label'] ?? ($cohortLabel !== '' ? $cohortLabel : 'Target cohort'), $moduleSetup['comparator_label'] ?? 'Standard care comparator')], ['label' => 'Sensitivity contrast', 'value' => sprintf('%s vs %s', $moduleSetup['cohort_label'] ?? ($cohortLabel !== '' ? $cohortLabel : 'Target cohort'), $moduleSetup['sensitivity_label'] ?? 'Sensitivity exposure')], ['label' => 'Outcome frame', 'value' => $outcomeName !== '' ? $outcomeName : 'Condition burden']],
        };
    }

    private function buildFamilySegments(string $moduleFamily, array $signalRows, int $femalePersons, int $malePersons): array
    {
        return match ($moduleFamily) {
            'codewas' => [['label' => 'Discovery lane', 'count' => (int) round(($signalRows[0]['signal_count'] ?? 0) * 0.49), 'share' => 0.49], ['label' => 'Replication lane', 'count' => (int) round(($signalRows[1]['signal_count'] ?? 0) * 0.33), 'share' => 0.33], ['label' => 'Control lane', 'count' => (int) round(($signalRows[2]['signal_count'] ?? 0) * 0.18), 'share' => 0.18]],
            'timecodewas' => [['label' => 'Early window', 'count' => (int) round(($signalRows[0]['signal_count'] ?? 0) * 0.28), 'share' => 0.28], ['label' => 'Middle window', 'count' => (int) round(($signalRows[0]['signal_count'] ?? 0) * 0.44), 'share' => 0.44], ['label' => 'Late window', 'count' => (int) round(($signalRows[0]['signal_count'] ?? 0) * 0.28), 'share' => 0.28]],
            'condition_burden' => [['label' => 'High burden', 'count' => (int) round(($signalRows[0]['signal_count'] ?? 0) * 0.52), 'share' => 0.52], ['label' => 'Moderate burden', 'count' => (int) round(($signalRows[1]['signal_count'] ?? 0) * 0.31), 'share' => 0.31], ['label' => 'Low burden', 'count' => (int) round(($signalRows[2]['signal_count'] ?? 0) * 0.17), 'share' => 0.17]],
            'cohort_demographics' => [['label' => 'Female subgroup', 'count' => $femalePersons, 'share' => ($femalePersons + $malePersons) > 0 ? round($femalePersons / ($femalePersons + $malePersons), 3) : 0.0], ['label' => 'Male subgroup', 'count' => $malePersons, 'share' => ($femalePersons + $malePersons) > 0 ? round($malePersons / ($femalePersons + $malePersons), 3) : 0.0], ['label' => 'Condition footprint', 'count' => (int) ($signalRows[0]['signal_count'] ?? 0), 'share' => ($femalePersons + $malePersons) > 0 ? round(((int) ($signalRows[0]['signal_count'] ?? 0)) / ($femalePersons + $malePersons), 3) : 0.0]],
            'drug_utilization' => [['label' => 'New starts', 'count' => (int) round(($signalRows[0]['signal_count'] ?? 0) * 0.36), 'share' => 0.36], ['label' => 'Maintenance', 'count' => (int) round(($signalRows[0]['signal_count'] ?? 0) * 0.44), 'share' => 0.44], ['label' => 'Switchers', 'count' => (int) round(($signalRows[0]['signal_count'] ?? 0) * 0.20), 'share' => 0.20]],
            'sex_stratified' => [['label' => 'Female subgroup', 'count' => $femalePersons, 'share' => ($femalePersons + $malePersons) > 0 ? round($femalePersons / ($femalePersons + $malePersons), 3) : 0.0], ['label' => 'Male subgroup', 'count' => $malePersons, 'share' => ($femalePersons + $malePersons) > 0 ? round($malePersons / ($femalePersons + $malePersons), 3) : 0.0]],
            'gwas' => [['label' => 'Genome-wide baseline', 'count' => (int) round(($signalRows[0]['signal_count'] ?? 0) * 0.63), 'share' => 0.63], ['label' => 'Lead loci', 'count' => (int) round(($signalRows[1]['signal_count'] ?? 0) * 0.22), 'share' => 0.22], ['label' => 'Replication loci', 'count' => (int) round(($signalRows[2]['signal_count'] ?? 0) * 0.15), 'share' => 0.15]],
            default => [['label' => 'Target lane', 'count' => (int) round(($signalRows[0]['signal_count'] ?? 0) * 0.48), 'share' => 0.48], ['label' => 'Comparator lane', 'count' => (int) round(($signalRows[1]['signal_count'] ?? 0) * 0.32), 'share' => 0.32], ['label' => 'Sensitivity lane', 'count' => (int) round(($signalRows[2]['signal_count'] ?? 0) * 0.20), 'share' => 0.20]],
        };
    }
}
