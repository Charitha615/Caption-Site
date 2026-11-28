<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Video editor projects saved to the account: only the layout (tracks, clips, text, effects and
 * the names of the media files). The media files themselves stay on the user's device.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('video_projects', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('aspect', 8)->default('16:9');
            $table->decimal('duration', 10, 2)->default(0);
            $table->unsignedInteger('clip_count')->default(0);
            $table->longText('data');
            /** Small preview picture (JPEG data URL). */
            $table->text('thumb')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('video_projects');
    }
};
