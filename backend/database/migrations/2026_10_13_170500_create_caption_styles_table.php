<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('caption_styles', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->boolean('is_default')->default(false);
            $table->string('font_family')->default('Inter');
            $table->unsignedSmallInteger('font_size')->default(32);
            $table->string('primary_color', 30)->default('#FFFFFF');
            $table->string('outline_color', 30)->default('#000000');
            $table->string('background_color', 40)->default('rgba(0, 0, 0, 0.6)');
            $table->string('position', 20)->default('bottom'); // top, middle, bottom
            $table->string('alignment', 20)->default('center'); // left, center, right
            $table->string('animation_effect', 30)->default('none'); // none, karaoke, pop, fade, highlight
            $table->json('style_data')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_default']);
            $table->index('project_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('caption_styles');
    }
};
