<?php

namespace App\Services\Ares;

use App\Enums\DaimonType;
use App\Models\App\FeasibilityTemplate;
use App\Models\App\Source;
use App\Models\Results\AchillesResult;
use App\Models\User;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FeasibilityService
{
    /**
     * @var array<string, int>
     */
    private const DOMAIN_COUNT_MAP = [
        'condition' => 400,
        'drug' => 700,
        'procedure' => 600,
        'measurement' => 1800,
        'observation' => 800,
        'visit' => 200,
    ];

    public function __construct(
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

    /**
     * Run a feasibility assessment across all active sources.
     *
     * @param  array{required_domains?: string[], required_concepts?: int[], visit_types?: int[], date_range?: array{start?: string, end?: string}, min_patients?: int}  $criteria
     */
    public function assess(User $user, string $name, array $criteria): object
    {
        $sources = Source::whereHas('daimons')->get();

        $assessment = DB::table('feasibility_assessments')->insertGetId([
            'name' => $name,
            'criteria' => json_encode($criteria),
            'sources_assessed' => $sources->count(),
            'sources_passed' => 0,
            'created_by' => $user->id,
            'created_at' => now(),
        ]);

        $passedCount = 0;

        foreach ($sources as $source) {
            $result = $this->evaluateSource($source, $criteria);

            DB::table('feasibility_assessment_results')->insert([
                'assessment_id' => $assessment,
                'source_id' => $source->id,
                'domain_pass' => $result['domain_pass'],
                'concept_pass' => $result['concept_pass'],
                'visit_pass' => $result['visit_pass'],
                'date_pass' => $result['date_pass'],
                'patient_pass' => $result['patient_pass'],
                'overall_pass' => $result['overall_pass'],
                'domain_score' => $result['domain_score'],
                'concept_score' => $result['concept_score'],
                'visit_score' => $result['visit_score'],
                'date_score' => $result['date_score'],
                'patient_score' => $result['patient_score'],
                'composite_score' => $result['composite_score'],
                'details' => json_encode($result['details']),
            ]);

            if ($result['overall_pass']) {
                $passedCount++;
            }
        }

        DB::table('feasibility_assessments')
            ->where('id', $assessment)
            ->update(['sources_passed' => $passedCount]);

        return DB::table('feasibility_assessments')->find($assessment);
    }

    /**
     * Get a specific assessment with its per-source results.
     */
    public function getAssessment(int $id): ?object
    {
        $assessment = DB::table('feasibility_assessments')->find($id);

        if (! $assessment) {
            return null;
        }

        $assessment->results = DB::table('feasibility_assessment_results as far')
            ->join('sources', 'sources.id', '=', 'far.source_id')
            ->where('far.assessment_id', $id)
            ->select([
                'far.*',
                'sources.source_name',
            ])
            ->get();

        return $assessment;
    }

    /**
     * List all assessments ordered by most recent first.
     *
     * @return Collection<int, object>
     */
    public function listAssessments(): Collection
    {
        return DB::table('feasibility_assessments')
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * Compute criteria impact analysis for an assessment.
     *
     * For each criterion, calculates how many sources pass when that criterion is removed,
     * producing a waterfall showing which criterion eliminates the most sources.
     *
     * @return array<int, array{criterion: string, sources_passing: int, sources_total: int, impact: int}>
     */
    public function getCriteriaImpact(int $assessmentId): array
    {
        $assessment = DB::table('feasibility_assessments')->find($assessmentId);
        if (! $assessment) {
            return [];
        }

        $criteria = json_decode($assessment->criteria, true) ?? [];
        $sources = Source::whereHas('daimons')->get();
        $totalSources = $sources->count();

        // Get baseline pass count (all criteria active)
        $baselinePassed = (int) $assessment->sources_passed;

        $criterionKeys = ['required_domains', 'required_concepts', 'visit_types', 'date_range', 'min_patients'];
        $labels = [
            'required_domains' => 'Required Domains',
            'required_concepts' => 'Required Concepts',
            'visit_types' => 'Visit Types',
            'date_range' => 'Date Range',
            'min_patients' => 'Minimum Patients',
        ];

        $impacts = [];

        foreach ($criterionKeys as $key) {
            if (empty($criteria[$key])) {
                continue;
            }

            // Build criteria with this one removed
            $reducedCriteria = $criteria;
            unset($reducedCriteria[$key]);

            $passedWithout = 0;
            foreach ($sources as $source) {
                $result = $this->evaluateSource($source, $reducedCriteria);
                if ($result['overall_pass']) {
                    $passedWithout++;
                }
            }

            $impacts[] = [
                'criterion' => $labels[$key] ?? $key,
                'sources_passing' => $passedWithout,
                'sources_total' => $totalSources,
                'impact' => $passedWithout - $baselinePassed,
            ];
        }

        // Sort by impact descending (most impactful criterion first)
        usort($impacts, fn (array $a, array $b): int => $b['impact'] <=> $a['impact']);

        return $impacts;
    }

    /**
     * List all public templates plus templates created by the given user.
     *
     * @return Collection<int, FeasibilityTemplate>
     */
    public function getTemplates(?int $userId = null): Collection
    {
        return FeasibilityTemplate::query()
            ->where('is_public', true)
            ->when($userId, fn ($q) => $q->orWhere('created_by', $userId))
            ->orderBy('name')
            ->get();
    }

    /**
     * Create a new feasibility template.
     *
     * @param  array{name: string, description?: string, criteria: array<string, mixed>, is_public?: bool}  $data
     */
    public function createTemplate(int $userId, array $data): FeasibilityTemplate
    {
        return FeasibilityTemplate::create([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'criteria' => $data['criteria'],
            'is_public' => $data['is_public'] ?? false,
            'created_by' => $userId,
        ]);
    }

    /**
     * Evaluate a single source against the feasibility criteria.
     *
     * @param  array<string, mixed>  $criteria
     * @return array{domain_pass: bool, concept_pass: bool, visit_pass: bool, date_pass: bool, patient_pass: bool, overall_pass: bool, domain_score: int, concept_score: int, visit_score: int, date_score: int, patient_score: int, composite_score: int, details: array<string, mixed>}
     */
    private function evaluateSource(Source $source, array $criteria): array
    {
        try {
            $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
            $schema = $daimon?->table_qualifier ?? 'results';

            $connection = 'results';
            if (! empty($source->db_host)) {
                $connection = $this->connectionFactory->connectionForSchema($source, $schema);
            } else {
                DB::connection('results')->statement(
                    "SET search_path TO \"{$schema}\", public"
                );
            }

            // Check person count
            $personResult = AchillesResult::on($connection)->where('analysis_id', 1)->first();
            $personCount = (int) ($personResult?->count_value ?? 0);

            // Domain check
            $domainPass = true;
            $domainDetails = [];
            $requiredDomains = $criteria['required_domains'] ?? [];
            foreach ($requiredDomains as $domain) {
                $analysisId = self::DOMAIN_COUNT_MAP[$domain] ?? null;
                if (! $analysisId) {
                    $domainDetails[$domain] = ['available' => false, 'reason' => 'Unknown domain'];
                    $domainPass = false;

                    continue;
                }
                $count = AchillesResult::on($connection)->where('analysis_id', $analysisId)->sum('count_value');
                $available = ((int) $count) > 0;
                $domainDetails[$domain] = ['available' => $available, 'count' => (int) $count];
                if (! $available) {
                    $domainPass = false;
                }
            }

            // Concept check
            $conceptPass = true;
            $conceptDetails = [];
            $requiredConcepts = $criteria['required_concepts'] ?? [];
            foreach ($requiredConcepts as $conceptId) {
                $found = AchillesResult::on($connection)
                    ->where('stratum_1', (string) $conceptId)
                    ->exists();
                $conceptDetails[$conceptId] = ['present' => $found];
                if (! $found) {
                    $conceptPass = false;
                }
            }

            // Visit type check
            $visitPass = true;
            $visitDetails = [];
            $requiredVisits = $criteria['visit_types'] ?? [];
            foreach ($requiredVisits as $visitConceptId) {
                $found = AchillesResult::on($connection)
                    ->where('analysis_id', 201)
                    ->where('stratum_1', (string) $visitConceptId)
                    ->exists();
                $visitDetails[$visitConceptId] = ['present' => $found];
                if (! $found) {
                    $visitPass = false;
                }
            }

            // Date range check (simplified -- check observation period overlap)
            $datePass = true;
            $dateDetails = [];
            if (! empty($criteria['date_range'])) {
                $datePass = $personCount > 0;
                $dateDetails = ['observation_period_available' => $personCount > 0];
            }

            // Patient count check
            $minPatients = $criteria['min_patients'] ?? 0;
            $patientPass = $personCount >= $minPatients;
            $patientDetails = [
                'required' => $minPatients,
                'actual' => $personCount,
            ];

            $overallPass = $domainPass && $conceptPass && $visitPass && $datePass && $patientPass;

            // Continuous 0-100 scores
            $domainScore = count($requiredDomains) > 0
                ? (int) round((count(array_filter($domainDetails, fn (array $d): bool => $d['available'] ?? false)) / count($requiredDomains)) * 100)
                : 100;

            $conceptScore = count($requiredConcepts) > 0
                ? (int) round((count(array_filter($conceptDetails, fn (array $d): bool => $d['present'] ?? false)) / count($requiredConcepts)) * 100)
                : 100;

            $visitScore = count($requiredVisits) > 0
                ? (int) round((count(array_filter($visitDetails, fn (array $d): bool => $d['present'] ?? false)) / count($requiredVisits)) * 100)
                : 100;

            $dateScore = ! empty($criteria['date_range'])
                ? ($personCount > 0 ? 100 : 0)
                : 100;

            $patientScore = $minPatients > 0
                ? min(100, (int) round(($personCount / $minPatients) * 100))
                : 100;

            // Weighted composite: domain=20%, concept=30%, visit=15%, date=15%, patient=20%
            $compositeScore = (int) round(
                ($domainScore * 0.20) +
                ($conceptScore * 0.30) +
                ($visitScore * 0.15) +
                ($dateScore * 0.15) +
                ($patientScore * 0.20)
            );

            return [
                'domain_pass' => $domainPass,
                'concept_pass' => $conceptPass,
                'visit_pass' => $visitPass,
                'date_pass' => $datePass,
                'patient_pass' => $patientPass,
                'overall_pass' => $overallPass,
                'domain_score' => $domainScore,
                'concept_score' => $conceptScore,
                'visit_score' => $visitScore,
                'date_score' => $dateScore,
                'patient_score' => $patientScore,
                'composite_score' => $compositeScore,
                'details' => [
                    'domains' => $domainDetails,
                    'concepts' => $conceptDetails,
                    'visits' => $visitDetails,
                    'dates' => $dateDetails,
                    'patients' => $patientDetails,
                ],
            ];
        } catch (\Throwable $e) {
            Log::warning("Feasibility: failed to evaluate source {$source->source_name}: {$e->getMessage()}");

            return [
                'domain_pass' => false,
                'concept_pass' => false,
                'visit_pass' => false,
                'date_pass' => false,
                'patient_pass' => false,
                'overall_pass' => false,
                'domain_score' => 0,
                'concept_score' => 0,
                'visit_score' => 0,
                'date_score' => 0,
                'patient_score' => 0,
                'composite_score' => 0,
                'details' => ['error' => $e->getMessage()],
            ];
        }
    }
}
