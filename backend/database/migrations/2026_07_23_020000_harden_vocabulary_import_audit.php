<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vocabulary_imports', function (Blueprint $table): void {
            $table->boolean('remove_omitted')->default(false)->after('target_schema');
            $table->jsonb('manifest')->nullable()->after('remove_omitted');
            $table->jsonb('downstream_status')->nullable()->after('manifest');
            $table->string('backup_path')->nullable()->after('downstream_status');
        });
    }

    public function down(): void
    {
        Schema::table('vocabulary_imports', function (Blueprint $table): void {
            $table->dropColumn(['remove_omitted', 'manifest', 'downstream_status', 'backup_path']);
        });
    }
};
