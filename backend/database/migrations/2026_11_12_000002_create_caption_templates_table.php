<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Caption templates: reusable bundles of caption style, font, position, animation,
 * colours, background and text effects.
 *
 * - System templates (user_id NULL, is_system = true) are seeded from
 *   resources/captions/presets.json and identified by `slug`.
 * - User templates belong to one account and can be applied to any of their projects.
 *
 * `style` holds the full editor style object (same shape as project settings.editor.style),
 * so new style properties never require a migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('caption_templates', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('slug', 80)->nullable();
            $table->string('name', 120);
            $table->string('description', 255)->nullable();
            $table->string('category', 30)->default('custom');
            $table->boolean('is_system')->default(false);
            $table->json('style');
            $table->string('preview_text', 160)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'created_at']);
            $table->index(['is_system', 'sort_order']);
            $table->unique(['slug', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('caption_templates');
    }
};
