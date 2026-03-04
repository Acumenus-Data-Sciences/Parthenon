<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('studies', function (Blueprint $table) {
            // Rename name → title for clarity (keep name as alias in model)
            $table->renameColumn('name', 'title');
        });

        Schema::table('studies', function (Blueprint $table) {
            // Core identity fields
            $table->string('short_title', 100)->nullable()->after('title');
            $table->string('slug', 120)->unique()->nullable()->after('short_title');

            // Classification
            $table->string('study_design', 50)->nullable()->after('study_type');
            $table->string('phase', 20)->default('pre_study')->after('study_design');
            $table->string('priority', 20)->default('medium')->after('phase');

            // Leadership (separate from author_id which is creator)
            $table->foreignId('principal_investigator_id')
                ->nullable()
                ->after('priority')
                ->constrained('users')
                ->nullOnDelete();
            $table->foreignId('lead_data_scientist_id')
                ->nullable()
                ->after('principal_investigator_id')
                ->constrained('users')
                ->nullOnDelete();
            $table->foreignId('lead_statistician_id')
                ->nullable()
                ->after('lead_data_scientist_id')
                ->constrained('users')
                ->nullOnDelete();

            // Scientific design
            $table->text('scientific_rationale')->nullable()->after('description');
            $table->text('hypothesis')->nullable()->after('scientific_rationale');
            $table->text('primary_objective')->nullable()->after('hypothesis');
            $table->jsonb('secondary_objectives')->nullable()->after('primary_objective');

            // Timeline
            $table->date('study_start_date')->nullable()->after('secondary_objectives');
            $table->date('study_end_date')->nullable()->after('study_start_date');

            // Enrollment
            $table->integer('target_enrollment_sites')->nullable()->after('study_end_date');
            $table->integer('actual_enrollment_sites')->default(0)->after('target_enrollment_sites');

            // Protocol
            $table->string('protocol_version', 20)->nullable()->after('actual_enrollment_sites');
            $table->timestamp('protocol_finalized_at')->nullable()->after('protocol_version');

            // External references
            $table->text('funding_source')->nullable()->after('protocol_finalized_at');
            $table->string('clinicaltrials_gov_id', 20)->nullable()->after('funding_source');

            // Flexible data
            $table->jsonb('tags')->nullable()->after('metadata');
            $table->jsonb('settings')->nullable()->after('tags');

            // Rename author_id to created_by for semantic clarity
            $table->renameColumn('author_id', 'created_by');
        });
    }

    public function down(): void
    {
        Schema::table('studies', function (Blueprint $table) {
            $table->renameColumn('created_by', 'author_id');

            $table->dropForeign(['principal_investigator_id']);
            $table->dropForeign(['lead_data_scientist_id']);
            $table->dropForeign(['lead_statistician_id']);

            $table->dropColumn([
                'short_title', 'slug', 'study_design', 'phase', 'priority',
                'principal_investigator_id', 'lead_data_scientist_id', 'lead_statistician_id',
                'scientific_rationale', 'hypothesis', 'primary_objective', 'secondary_objectives',
                'study_start_date', 'study_end_date',
                'target_enrollment_sites', 'actual_enrollment_sites',
                'protocol_version', 'protocol_finalized_at',
                'funding_source', 'clinicaltrials_gov_id',
                'tags', 'settings',
            ]);
        });

        Schema::table('studies', function (Blueprint $table) {
            $table->renameColumn('title', 'name');
        });
    }
};
