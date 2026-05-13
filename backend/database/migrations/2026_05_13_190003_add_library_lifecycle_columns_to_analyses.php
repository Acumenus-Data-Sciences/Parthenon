<?php

use App\Enums\LibraryStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLES = [
        'incidence_rate_analyses',
        'pathway_analyses',
        'estimation_analyses',
        'prediction_analyses',
        'feature_analyses',
        'sccs_analyses',
        'evidence_synthesis_analyses',
        'self_controlled_cohort_analyses',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->string('status', 16)->default(LibraryStatus::ACTIVE->value)->index();
                $t->timestamp('archived_at')->nullable();
                $t->unsignedBigInteger('archived_by')->nullable();
                $t->timestamp('promoted_at')->nullable();
                $t->foreign('archived_by')->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropForeign(['archived_by']);
                $t->dropColumn(['status', 'archived_at', 'archived_by', 'promoted_at']);
            });
        }
    }
};
