<?php

namespace App\Console\Commands;

use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SolrIndexClaims extends Command
{
    protected $signature = 'solr:index-claims
        {--fresh : Delete all documents before indexing}
        {--limit=0 : Maximum claims to index (0=unlimited)}
        {--schema=omop : Schema containing claims tables}';

    protected $description = 'Index claims and claims_transactions into the Solr claims core';

    public function handle(SolrClientWrapper $solr): int
    {
        if (! $solr->isEnabled()) {
            $this->error('Solr is not enabled. Set SOLR_ENABLED=true in .env');

            return self::FAILURE;
        }

        $core = config('solr.cores.claims', 'claims');

        if (! $solr->ping($core)) {
            $this->error("Cannot reach Solr core '{$core}'. Is the Solr container running?");

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->info('Deleting all existing documents...');
            $solr->deleteAll($core);
        }

        $schema = $this->option('schema');
        $maxLimit = (int) $this->option('limit');
        $startTime = microtime(true);

        $this->info("Indexing claims from {$schema}.claims...");

        [$totalIndexed, $totalErrors] = $this->indexClaims($solr, $core, $schema, $maxLimit);

        $this->info('Committing...');
        $solr->commit($core);

        $elapsed = round(microtime(true) - $startTime, 1);
        $docCount = $solr->documentCount($core);

        $this->info("Total indexed: {$totalIndexed} | Errors: {$totalErrors} | Time: {$elapsed}s");
        $this->info("Solr document count: {$docCount}");

        if ($totalErrors > 0) {
            $this->warn("Completed with {$totalErrors} errors.");

            return self::FAILURE;
        }

        $this->info('Claims indexing complete.');

        return self::SUCCESS;
    }

    /**
     * @return array{0: int, 1: int}
     */
    private function indexClaims(SolrClientWrapper $solr, string $core, string $schema, int $maxLimit): array
    {
        $limitClause = $maxLimit > 0 ? "LIMIT {$maxLimit}" : '';

        $sql = "
            SELECT
                c.id AS claim_id,
                c.patientid AS patient_id,
                c.providerid AS provider_id,
                c.servicedate AS service_date,
                c.lastbilleddate1 AS last_billed_date,
                c.diagnosis1, c.diagnosis2, c.diagnosis3, c.diagnosis4,
                c.diagnosis5, c.diagnosis6, c.diagnosis7, c.diagnosis8,
                c.status1, c.status2, c.statusp,
                c.outstanding1, c.outstanding2, c.outstandingp,
                c.departmentid AS department_id,
                c.appointmentid AS appointment_id,
                c.healthcareclaimtypeid1 AS claim_type_id,
                p.year_of_birth,
                p.gender_concept_id
            FROM {$schema}.claims c
            LEFT JOIN {$schema}.person p ON c.patientid::bigint = p.person_id
            ORDER BY c.id
            {$limitClause}
        ";

        $conn = DB::connection('cdm');
        $conn->statement('SET statement_timeout = 600000');

        $indexed = 0;
        $errors = 0;
        $batch = [];
        $batchSize = 500;

        $cursor = $conn->cursor($sql);

        foreach ($cursor as $row) {
            $row = (array) $row;

            $claimId = $row['claim_id'];

            // Collect diagnosis codes (non-null)
            $dxCodes = [];
            for ($i = 1; $i <= 8; $i++) {
                $dx = $row["diagnosis{$i}"] ?? null;
                if ($dx !== null && $dx !== '') {
                    $dxCodes[] = (string) $dx;
                }
            }

            // Resolve diagnosis names from concept table
            $dxNames = [];
            if (! empty($dxCodes)) {
                $dxNames = $this->resolveDiagnosisNames($conn, $schema, $dxCodes);
            }

            // Determine primary claim status
            $claimStatus = $this->determineClaimStatus(
                $row['status1'] ?? null,
                $row['status2'] ?? null,
                $row['statusp'] ?? null,
            );

            // Aggregate transactions for this claim
            $txnData = $this->aggregateTransactions($conn, $schema, $claimId);

            $doc = [
                'claim_id' => (string) $claimId,
                'patient_id' => (int) ($row['patient_id'] ?? 0),
                'provider_id' => (int) ($row['provider_id'] ?? 0),
                'claim_status' => $claimStatus,
                'claim_type' => $this->mapClaimType($row['claim_type_id'] ?? null),
                'diagnosis_codes' => $dxCodes,
                'diagnosis_names' => $dxNames,
                'total_charge' => (float) ($txnData['total_charge'] ?? 0),
                'total_payment' => (float) ($txnData['total_payment'] ?? 0),
                'total_adjustment' => (float) ($txnData['total_adjustment'] ?? 0),
                'outstanding' => (float) ($row['outstanding1'] ?? 0) + (float) ($row['outstanding2'] ?? 0) + (float) ($row['outstandingp'] ?? 0),
                'transaction_count' => (int) ($txnData['transaction_count'] ?? 0),
                'procedure_codes' => $txnData['procedure_codes'] ?? [],
                'place_of_service' => $txnData['place_of_service'] ?? '',
                'line_notes' => $txnData['line_notes'] ?? '',
                'department_id' => (int) ($row['department_id'] ?? 0),
                'appointment_id' => (string) ($row['appointment_id'] ?? ''),
            ];

            if (! empty($row['service_date'])) {
                $doc['service_date'] = date('Y-m-d\TH:i:s\Z', strtotime((string) $row['service_date']));
            }
            if (! empty($row['last_billed_date'])) {
                $doc['last_billed_date'] = date('Y-m-d\TH:i:s\Z', strtotime((string) $row['last_billed_date']));
            }

            $batch[] = $doc;

            if (count($batch) >= $batchSize) {
                if ($solr->addDocuments($core, $batch)) {
                    $indexed += count($batch);
                } else {
                    $errors += count($batch);
                }
                $batch = [];

                if ($indexed % 5000 === 0 && $indexed > 0) {
                    $this->line("  ... {$indexed} claims indexed so far");
                }
            }
        }

        if (! empty($batch)) {
            if ($solr->addDocuments($core, $batch)) {
                $indexed += count($batch);
            } else {
                $errors += count($batch);
            }
        }

        $conn->statement('SET statement_timeout = 0');

        return [$indexed, $errors];
    }

    /**
     * @param  list<string>  $codes
     * @return list<string>
     */
    private function resolveDiagnosisNames(\Illuminate\Database\Connection $conn, string $schema, array $codes): array
    {
        if (empty($codes)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($codes), '?'));
        $rows = $conn->select(
            "SELECT concept_code, concept_name FROM {$schema}.concept WHERE concept_code IN ({$placeholders}) AND domain_id = 'Condition' LIMIT 8",
            $codes,
        );

        $names = [];
        foreach ($rows as $row) {
            $names[] = $row->concept_name;
        }

        return $names;
    }

    /**
     * @return array{total_charge: float, total_payment: float, total_adjustment: float, transaction_count: int, procedure_codes: list<string>, place_of_service: string, line_notes: string}
     */
    private function aggregateTransactions(\Illuminate\Database\Connection $conn, string $schema, string $claimId): array
    {
        $rows = $conn->select(
            "SELECT type, amount, procedurecode, placeofservice, notes, linenote
             FROM {$schema}.claims_transactions
             WHERE claimid = ?
             ORDER BY id",
            [$claimId],
        );

        $totalCharge = 0.0;
        $totalPayment = 0.0;
        $totalAdjustment = 0.0;
        $procedureCodes = [];
        $placeOfService = '';
        $noteFragments = [];

        foreach ($rows as $row) {
            $amount = (float) ($row->amount ?? 0);
            $type = strtoupper($row->type ?? '');

            match ($type) {
                'CHARGE' => $totalCharge += $amount,
                'PAYMENT' => $totalPayment += $amount,
                'ADJUSTMENT' => $totalAdjustment += $amount,
                default => null,
            };

            if (! empty($row->procedurecode) && ! in_array($row->procedurecode, $procedureCodes, true)) {
                $procedureCodes[] = $row->procedurecode;
            }

            if (! empty($row->placeofservice)) {
                $placeOfService = $row->placeofservice;
            }

            if (! empty($row->notes)) {
                $noteFragments[] = $row->notes;
            }
            if (! empty($row->linenote)) {
                $noteFragments[] = $row->linenote;
            }
        }

        return [
            'total_charge' => $totalCharge,
            'total_payment' => $totalPayment,
            'total_adjustment' => $totalAdjustment,
            'transaction_count' => count($rows),
            'procedure_codes' => $procedureCodes,
            'place_of_service' => $placeOfService,
            'line_notes' => implode(' | ', $noteFragments),
        ];
    }

    private function determineClaimStatus(?string $status1, ?string $status2, ?string $statusp): string
    {
        foreach ([$status1, $status2, $statusp] as $status) {
            if ($status !== null && $status !== '') {
                return $status;
            }
        }

        return 'Unknown';
    }

    private function mapClaimType(?int $typeId): string
    {
        return match ($typeId) {
            1 => 'Institutional',
            2 => 'Professional',
            default => 'Other',
        };
    }
}
