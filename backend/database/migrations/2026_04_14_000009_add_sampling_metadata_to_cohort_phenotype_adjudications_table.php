<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cohort_phenotype_adjudications', function (Blueprint $table) {
            $table->jsonb('sampling_json')->nullable()->after('demographics_json');
            $table->timestamp('sampled_at')->nullable()->after('sampling_json');
        });
    }

    public function down(): void
    {
        Schema::table('cohort_phenotype_adjudications', function (Blueprint $table) {
            $table->dropColumn(['sampling_json', 'sampled_at']);
        });
    }
};
