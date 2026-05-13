<?php

use App\Enums\LibraryStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('concept_sets', function (Blueprint $table) {
            $table->string('status', 16)->default(LibraryStatus::ACTIVE->value)->index();
            $table->timestamp('archived_at')->nullable();
            $table->unsignedBigInteger('archived_by')->nullable();
            $table->timestamp('promoted_at')->nullable();
            $table->foreign('archived_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('concept_sets', function (Blueprint $table) {
            $table->dropForeign(['archived_by']);
            $table->dropColumn(['status', 'archived_at', 'archived_by', 'promoted_at']);
        });
    }
};
