<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Phase 14 (D-18 per .planning/phases/14-regenie-gwas-infrastructure/14-CONTEXT.md)
 *
 * Seeds the default GWAS covariate set: age + sex + 10 PCs. is_default=true;
 * the partial-unique index on (is_default) where is_default=true guarantees
 * exactly one default exists at a time.
 *
 * The covariate_columns_hash is SHA-256 hex of the canonical JSON of
 * covariate_columns using JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE —
 * the same encoding flags Wave 2's GwasCacheKeyHasher will use. This keeps
 * the seeded hash byte-identical to a freshly recomputed one.
 *
 * Idempotent: updateOrInsert keyed on `name`. Re-run on every `./deploy.sh`
 * via DatabaseSeeder.
 */
class FinnGenGwasCovariateSetSeeder extends Seeder
{
    public function run(): void
    {
        $covariateColumns = [
            ['source' => 'person.year_of_birth → age', 'column_name' => 'age'],
            ['source' => 'person.gender_concept_id → sex', 'column_name' => 'sex'],
            ['source' => 'pc_tsv.PC1', 'column_name' => 'PC1'],
            ['source' => 'pc_tsv.PC2', 'column_name' => 'PC2'],
            ['source' => 'pc_tsv.PC3', 'column_name' => 'PC3'],
            ['source' => 'pc_tsv.PC4', 'column_name' => 'PC4'],
            ['source' => 'pc_tsv.PC5', 'column_name' => 'PC5'],
            ['source' => 'pc_tsv.PC6', 'column_name' => 'PC6'],
            ['source' => 'pc_tsv.PC7', 'column_name' => 'PC7'],
            ['source' => 'pc_tsv.PC8', 'column_name' => 'PC8'],
            ['source' => 'pc_tsv.PC9', 'column_name' => 'PC9'],
            ['source' => 'pc_tsv.PC10', 'column_name' => 'PC10'],
        ];

        $canonical = json_encode(
            $covariateColumns,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );
        $hash = hash('sha256', $canonical);

        $adminId = User::where('email', 'admin@acumenus.net')->value('id');
        if ($adminId === null) {
            Log::warning(
                'FinnGenGwasCovariateSetSeeder: admin@acumenus.net not found; seeding default covariate set with NULL owner_user_id'
            );
        }

        DB::table('app.finngen_gwas_covariate_sets')->updateOrInsert(
            ['name' => 'Default (age + sex + 10 PCs)'],
            [
                'description' => 'Default GWAS covariate set: age (derived from person.year_of_birth), sex (derived from person.gender_concept_id), and the top 10 principal components (PC1..PC10) from plink2 --pca.',
                'owner_user_id' => $adminId,
                'covariate_columns' => $canonical,
                'covariate_columns_hash' => $hash,
                'is_default' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }
}
