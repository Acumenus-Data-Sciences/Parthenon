<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        \Illuminate\Support\Facades\DB::unprepared('SAVEPOINT grant_refs_1');
        try {
            \Illuminate\Support\Facades\DB::statement('GRANT REFERENCES ON TABLE app.chart_annotations TO parthenon_owner');
            \Illuminate\Support\Facades\DB::unprepared('RELEASE SAVEPOINT grant_refs_1');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::unprepared('ROLLBACK TO SAVEPOINT grant_refs_1');
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

        Schema::table('chart_annotations', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->after('tag')
                ->constrained('app.chart_annotations')->nullOnDelete();
        });

        \Illuminate\Support\Facades\DB::statement('RESET ROLE');
    }

    public function down(): void
    {
        \Illuminate\Support\Facades\DB::statement("
            DO \$\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_owner') THEN
                    SET ROLE parthenon_owner;
                END IF;
            END
            \$\$
        ");

        Schema::table('chart_annotations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_id');
        });

        \Illuminate\Support\Facades\DB::statement('RESET ROLE');
    }
};
