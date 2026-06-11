<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Track how a publication draft originated. NULL/'manual' = built in the
 * /publish wizard; 'study_manuscript' = seeded from a study's composed
 * ManuscriptComposer output (the "Open in Publisher" bridge), which lets that
 * hand-off be idempotent (find-or-create) and gives the draft provenance.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('publication_drafts', 'source')) {
            Schema::table('publication_drafts', function (Blueprint $table) {
                $table->string('source', 40)->nullable()->after('template');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('publication_drafts', 'source')) {
            Schema::table('publication_drafts', function (Blueprint $table) {
                $table->dropColumn('source');
            });
        }
    }
};
