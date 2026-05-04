<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
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
            $table->string('tag', 30)->nullable()->after('annotation_text');
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
            $table->dropColumn('tag');
        });

        \Illuminate\Support\Facades\DB::statement('RESET ROLE');
    }
};
