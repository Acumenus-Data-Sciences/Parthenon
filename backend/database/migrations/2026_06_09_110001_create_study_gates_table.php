<?php

use App\Enums\GateStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_gates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained()->cascadeOnDelete();
            $table->string('stage', 32)->index();
            $table->string('gate_key', 64);
            $table->string('status', 16)->default(GateStatus::Pending->value)->index();
            $table->jsonb('metrics_json')->nullable();
            $table->jsonb('threshold_json')->nullable();
            $table->string('decision', 16)->default('auto'); // auto | human
            $table->unsignedBigInteger('decided_by')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->text('override_rationale')->nullable();
            $table->timestamps();

            $table->foreign('decided_by')->references('id')->on('users')->nullOnDelete();
            $table->unique(['study_id', 'stage', 'gate_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_gates');
    }
};
