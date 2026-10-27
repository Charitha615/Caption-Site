<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('usage_records', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 50)->index(); // caption_generation, video_render, export_subtitle, storage
            $table->decimal('quantity', 12, 2);
            $table->string('unit', 30)->default('seconds'); // seconds, credits, bytes, count
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'action']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usage_records');
    }
};
