<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('genomic_variants', function (Blueprint $table) {
            $table->text('clinvar_disease')->nullable()->after('clinvar_significance');
            $table->string('clinvar_review_status', 200)->nullable()->after('clinvar_disease');
        });
    }

    public function down(): void
    {
        Schema::table('genomic_variants', function (Blueprint $table) {
            $table->dropColumn(['clinvar_disease', 'clinvar_review_status']);
        });
    }
};
