<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('captions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('transcript_id')->nullable()->constrained('transcripts')->nullOnDelete();
            $table->unsignedInteger('sequence')->default(1)->index();
            $table->decimal('start_time', 10, 3)->index();
            $table->decimal('end_time', 10, 3)->index();
            $table->text('text'); // Full Unicode/Sinhala text support
            $table->json('style_override')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['project_id', 'start_time']);
            $table->index(['project_id', 'sequence']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('captions');
    }
};
