<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Grant REFERENCES on sources and users to parthenon_owner
        // so FK constraints can be added when running as that role.
        \Illuminate\Support\Facades\DB::unprepared('SAVEPOINT grant_refs_1');
        try {
            \Illuminate\Support\Facades\DB::statement('GRANT REFERENCES ON TABLE app.sources TO parthenon_owner');
            \Illuminate\Support\Facades\DB::unprepared('RELEASE SAVEPOINT grant_refs_1');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::unprepared('ROLLBACK TO SAVEPOINT grant_refs_1');
        }

        \Illuminate\Support\Facades\DB::unprepared('SAVEPOINT grant_refs_2');
        try {
            \Illuminate\Support\Facades\DB::statement('GRANT REFERENCES ON TABLE app.users TO parthenon_owner');
            \Illuminate\Support\Facades\DB::unprepared('RELEASE SAVEPOINT grant_refs_2');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::unprepared('ROLLBACK TO SAVEPOINT grant_refs_2');
        }

        \Illuminate\Support\Facades\DB::statement("
            DO \$\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_owner') THEN
                    SET ROLE parthenon_owner;
                END IF;
            END
            \$\$
        ");

        Schema::create('chart_annotations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->string('chart_type', 50);
            $table->jsonb('chart_context')->default('{}');
            $table->string('x_value', 100);
            $table->float('y_value')->nullable();
            $table->text('annotation_text');
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->index(['chart_type', 'source_id']);
        });

        \Illuminate\Support\Facades\DB::statement('RESET ROLE');
    }

    public function down(): void
    {
        Schema::dropIfExists('chart_annotations');
    }
};
