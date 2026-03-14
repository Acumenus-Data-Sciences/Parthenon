<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_wiki_articles', function (Blueprint $table) {
            $table->id();
            $table->string('title', 255);
            $table->string('slug', 255)->unique();
            $table->text('body');
            $table->text('body_html')->nullable();
            $table->jsonb('tags')->default('[]');
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('last_edited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Full-text search index
        DB::statement("CREATE INDEX idx_wiki_search ON commons_wiki_articles USING gin(to_tsvector('english', title || ' ' || body))");

        Schema::create('commons_wiki_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_id')->constrained('commons_wiki_articles')->cascadeOnDelete();
            $table->text('body');
            $table->foreignId('edited_by')->constrained('users')->cascadeOnDelete();
            $table->string('edit_summary', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_wiki_revisions');
        DB::statement('DROP INDEX IF EXISTS idx_wiki_search');
        Schema::dropIfExists('commons_wiki_articles');
    }
};
