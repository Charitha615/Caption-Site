<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transcripts', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_file_id')->nullable()->constrained('media_files')->nullOnDelete();
            $table->string('language', 10)->default('si');
            $table->longText('raw_text');
            $table->json('words_json')->nullable();
            $table->string('status')->default('pending')->index(); // pending, processing, completed, failed
            $table->decimal('confidence', 5, 2)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['project_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transcripts');
    }
};
