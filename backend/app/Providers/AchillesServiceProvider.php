<?php

namespace App\Providers;

use App\Services\Achilles\AchillesAnalysisRegistry;
use App\Services\Achilles\Heel\AchillesHeelRuleRegistry;

// ── Observation Period ─────────────────────────────────────────────────────────
use App\Services\Achilles\Analyses\ObservationPeriod\Analysis101;
use App\Services\Achilles\Analyses\ObservationPeriod\Analysis102;
use App\Services\Achilles\Analyses\ObservationPeriod\Analysis103;
use App\Services\Achilles\Analyses\ObservationPeriod\Analysis104;
use App\Services\Achilles\Analyses\ObservationPeriod\Analysis105;
use App\Services\Achilles\Analyses\ObservationPeriod\Analysis106;
use App\Services\Achilles\Analyses\ObservationPeriod\Analysis107;
use App\Services\Achilles\Analyses\ObservationPeriod\Analysis108;
use App\Services\Achilles\Analyses\ObservationPeriod\Analysis109;
use App\Services\Achilles\Analyses\ObservationPeriod\Analysis110;
use App\Services\Achilles\Analyses\ObservationPeriod\Analysis111;
use App\Services\Achilles\Analyses\ObservationPeriod\Analysis113;

// ── Person ─────────────────────────────────────────────────────────────────────
use App\Services\Achilles\Analyses\Person\Analysis0;
use App\Services\Achilles\Analyses\Person\Analysis2;
use App\Services\Achilles\Analyses\Person\Analysis3;
use App\Services\Achilles\Analyses\Person\Analysis4;
use App\Services\Achilles\Analyses\Person\Analysis5;

// ── Visit ──────────────────────────────────────────────────────────────────────
use App\Services\Achilles\Analyses\Visit\Analysis200;
use App\Services\Achilles\Analyses\Visit\Analysis201;
use App\Services\Achilles\Analyses\Visit\Analysis202;
use App\Services\Achilles\Analyses\Visit\Analysis203;
use App\Services\Achilles\Analyses\Visit\Analysis204;
use App\Services\Achilles\Analyses\Visit\Analysis206;
use App\Services\Achilles\Analyses\Visit\Analysis207;
use App\Services\Achilles\Analyses\Visit\Analysis209;
use App\Services\Achilles\Analyses\Visit\Analysis210;
use App\Services\Achilles\Analyses\Visit\Analysis211;
use App\Services\Achilles\Analyses\Visit\Analysis220;

// ── Condition ──────────────────────────────────────────────────────────────────
use App\Services\Achilles\Analyses\Condition\Analysis400;
use App\Services\Achilles\Analyses\Condition\Analysis401;
use App\Services\Achilles\Analyses\Condition\Analysis402;
use App\Services\Achilles\Analyses\Condition\Analysis403;
use App\Services\Achilles\Analyses\Condition\Analysis404;
use App\Services\Achilles\Analyses\Condition\Analysis405;
use App\Services\Achilles\Analyses\Condition\Analysis406;
use App\Services\Achilles\Analyses\Condition\Analysis409;
use App\Services\Achilles\Analyses\Condition\Analysis410;
use App\Services\Achilles\Analyses\Condition\Analysis411;
use App\Services\Achilles\Analyses\Condition\Analysis420;

// ── Death ──────────────────────────────────────────────────────────────────────
use App\Services\Achilles\Analyses\Death\Analysis500;
use App\Services\Achilles\Analyses\Death\Analysis501;
use App\Services\Achilles\Analyses\Death\Analysis502;
use App\Services\Achilles\Analyses\Death\Analysis503;
use App\Services\Achilles\Analyses\Death\Analysis504;
use App\Services\Achilles\Analyses\Death\Analysis505;
use App\Services\Achilles\Analyses\Death\Analysis506;
use App\Services\Achilles\Analyses\Death\Analysis507;

// ── Procedure ──────────────────────────────────────────────────────────────────
use App\Services\Achilles\Analyses\Procedure\Analysis600;
use App\Services\Achilles\Analyses\Procedure\Analysis601;
use App\Services\Achilles\Analyses\Procedure\Analysis602;
use App\Services\Achilles\Analyses\Procedure\Analysis603;
use App\Services\Achilles\Analyses\Procedure\Analysis605;
use App\Services\Achilles\Analyses\Procedure\Analysis606;
use App\Services\Achilles\Analyses\Procedure\Analysis609;
use App\Services\Achilles\Analyses\Procedure\Analysis610;
use App\Services\Achilles\Analyses\Procedure\Analysis611;

// ── Drug ───────────────────────────────────────────────────────────────────────
use App\Services\Achilles\Analyses\Drug\Analysis700;
use App\Services\Achilles\Analyses\Drug\Analysis701;
use App\Services\Achilles\Analyses\Drug\Analysis702;
use App\Services\Achilles\Analyses\Drug\Analysis703;
use App\Services\Achilles\Analyses\Drug\Analysis704;
use App\Services\Achilles\Analyses\Drug\Analysis705;
use App\Services\Achilles\Analyses\Drug\Analysis706;
use App\Services\Achilles\Analyses\Drug\Analysis709;
use App\Services\Achilles\Analyses\Drug\Analysis710;
use App\Services\Achilles\Analyses\Drug\Analysis711;
use App\Services\Achilles\Analyses\Drug\Analysis715;
use App\Services\Achilles\Analyses\Drug\Analysis716;

// ── Observation ────────────────────────────────────────────────────────────────
use App\Services\Achilles\Analyses\Observation\Analysis800;
use App\Services\Achilles\Analyses\Observation\Analysis801;
use App\Services\Achilles\Analyses\Observation\Analysis802;
use App\Services\Achilles\Analyses\Observation\Analysis805;
use App\Services\Achilles\Analyses\Observation\Analysis806;
use App\Services\Achilles\Analyses\Observation\Analysis809;
use App\Services\Achilles\Analyses\Observation\Analysis810;
use App\Services\Achilles\Analyses\Observation\Analysis811;

// ── Drug Era ───────────────────────────────────────────────────────────────────
use App\Services\Achilles\Analyses\DrugEra\Analysis900;
use App\Services\Achilles\Analyses\DrugEra\Analysis901;
use App\Services\Achilles\Analyses\DrugEra\Analysis902;
use App\Services\Achilles\Analyses\DrugEra\Analysis903;

// ── Condition Era ──────────────────────────────────────────────────────────────
use App\Services\Achilles\Analyses\ConditionEra\Analysis1000;
use App\Services\Achilles\Analyses\ConditionEra\Analysis1001;
use App\Services\Achilles\Analyses\ConditionEra\Analysis1002;
use App\Services\Achilles\Analyses\ConditionEra\Analysis1003;

// ── Measurement ────────────────────────────────────────────────────────────────
use App\Services\Achilles\Analyses\Measurement\Analysis1800;
use App\Services\Achilles\Analyses\Measurement\Analysis1801;
use App\Services\Achilles\Analyses\Measurement\Analysis1802;
use App\Services\Achilles\Analyses\Measurement\Analysis1803;
use App\Services\Achilles\Analyses\Measurement\Analysis1804;
use App\Services\Achilles\Analyses\Measurement\Analysis1805;
use App\Services\Achilles\Analyses\Measurement\Analysis1806;
use App\Services\Achilles\Analyses\Measurement\Analysis1809;
use App\Services\Achilles\Analyses\Measurement\Analysis1810;
use App\Services\Achilles\Analyses\Measurement\Analysis1811;
use App\Services\Achilles\Analyses\Measurement\Analysis1814;
use App\Services\Achilles\Analyses\Measurement\Analysis1815;

// ── Payer Plan ─────────────────────────────────────────────────────────────────
use App\Services\Achilles\Analyses\PayerPlan\Analysis1700;
use App\Services\Achilles\Analyses\PayerPlan\Analysis1701;
use App\Services\Achilles\Analyses\PayerPlan\Analysis1702;
use App\Services\Achilles\Analyses\PayerPlan\Analysis1703;

// ── Data Density ───────────────────────────────────────────────────────────────
use App\Services\Achilles\Analyses\DataDensity\Analysis117;
use App\Services\Achilles\Analyses\DataDensity\Analysis2000;
use App\Services\Achilles\Analyses\DataDensity\Analysis2001;
use App\Services\Achilles\Analyses\DataDensity\Analysis2002;
use App\Services\Achilles\Analyses\DataDensity\Analysis2003;

// ── Achilles Heel Rules ────────────────────────────────────────────────────────
use App\Services\Achilles\Heel\Rules\Rule1;
use App\Services\Achilles\Heel\Rules\Rule2;
use App\Services\Achilles\Heel\Rules\Rule3;
use App\Services\Achilles\Heel\Rules\Rule4;
use App\Services\Achilles\Heel\Rules\Rule5;
use App\Services\Achilles\Heel\Rules\Rule6;
use App\Services\Achilles\Heel\Rules\Rule7;
use App\Services\Achilles\Heel\Rules\Rule8;
use App\Services\Achilles\Heel\Rules\Rule9;
use App\Services\Achilles\Heel\Rules\Rule10;
use App\Services\Achilles\Heel\Rules\Rule11;
use App\Services\Achilles\Heel\Rules\Rule12;
use App\Services\Achilles\Heel\Rules\Rule13;
use App\Services\Achilles\Heel\Rules\Rule14;
use App\Services\Achilles\Heel\Rules\Rule15;
use Illuminate\Support\ServiceProvider;

class AchillesServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AchillesAnalysisRegistry::class, function () {
            $registry = new AchillesAnalysisRegistry;

            // Person (5 analyses)
            foreach ([new Analysis0, new Analysis2, new Analysis3, new Analysis4, new Analysis5] as $a) {
                $registry->register($a);
            }

            // Observation Period (11 analyses)
            foreach ([
                new Analysis101, new Analysis102, new Analysis103, new Analysis104,
                new Analysis105, new Analysis106, new Analysis107, new Analysis108,
                new Analysis109, new Analysis110, new Analysis111, new Analysis113,
            ] as $a) {
                $registry->register($a);
            }

            // Visit (8 analyses)
            foreach ([
                new Analysis200, new Analysis201, new Analysis202, new Analysis203,
                new Analysis204, new Analysis206, new Analysis207, new Analysis209,
                new Analysis210, new Analysis211, new Analysis220,
            ] as $a) {
                $registry->register($a);
            }

            // Condition (10 analyses)
            foreach ([
                new Analysis400, new Analysis401, new Analysis402, new Analysis403,
                new Analysis404, new Analysis405, new Analysis406, new Analysis409,
                new Analysis410, new Analysis411, new Analysis420,
            ] as $a) {
                $registry->register($a);
            }

            // Death (7 analyses)
            foreach ([
                new Analysis500, new Analysis501, new Analysis502, new Analysis503,
                new Analysis504, new Analysis505, new Analysis506, new Analysis507,
            ] as $a) {
                $registry->register($a);
            }

            // Procedure (8 analyses)
            foreach ([
                new Analysis600, new Analysis601, new Analysis602, new Analysis603,
                new Analysis605, new Analysis606, new Analysis609, new Analysis610,
                new Analysis611,
            ] as $a) {
                $registry->register($a);
            }

            // Drug (11 analyses)
            foreach ([
                new Analysis700, new Analysis701, new Analysis702, new Analysis703,
                new Analysis704, new Analysis705, new Analysis706, new Analysis709,
                new Analysis710, new Analysis711, new Analysis715, new Analysis716,
            ] as $a) {
                $registry->register($a);
            }

            // Observation (7 analyses)
            foreach ([
                new Analysis800, new Analysis801, new Analysis802, new Analysis805,
                new Analysis806, new Analysis809, new Analysis810, new Analysis811,
            ] as $a) {
                $registry->register($a);
            }

            // Drug Era (4 analyses)
            foreach ([new Analysis900, new Analysis901, new Analysis902, new Analysis903] as $a) {
                $registry->register($a);
            }

            // Condition Era (4 analyses)
            foreach ([new Analysis1000, new Analysis1001, new Analysis1002, new Analysis1003] as $a) {
                $registry->register($a);
            }

            // Measurement (11 analyses)
            foreach ([
                new Analysis1800, new Analysis1801, new Analysis1802, new Analysis1803,
                new Analysis1804, new Analysis1805, new Analysis1806, new Analysis1809,
                new Analysis1810, new Analysis1811, new Analysis1814, new Analysis1815,
            ] as $a) {
                $registry->register($a);
            }

            // Payer Plan (4 analyses)
            foreach ([new Analysis1700, new Analysis1701, new Analysis1702, new Analysis1703] as $a) {
                $registry->register($a);
            }

            // Data Density (5 analyses)
            foreach ([new Analysis117, new Analysis2000, new Analysis2001, new Analysis2002, new Analysis2003] as $a) {
                $registry->register($a);
            }

            return $registry;
        });

        $this->app->singleton(AchillesHeelRuleRegistry::class, function () {
            $registry = new AchillesHeelRuleRegistry;

            foreach ([
                new Rule1, new Rule2, new Rule3, new Rule4, new Rule5,
                new Rule6, new Rule7, new Rule8, new Rule9, new Rule10,
                new Rule11, new Rule12, new Rule13, new Rule14, new Rule15,
            ] as $rule) {
                $registry->register($rule);
            }

            return $registry;
        });
    }

    public function boot(): void {}
}
