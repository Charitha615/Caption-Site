<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('captions', function (Blueprint $table) {
            if (!Schema::hasColumn('captions', 'language')) {
                $table->string('language', 10)->default('si')->after('text');
            }
            if (!Schema::hasColumn('captions', 'style_id')) {
                $table->foreignId('style_id')->nullable()->after('language')->constrained('caption_styles')->nullOnDelete();
            }
            if (!Schema::hasColumn('captions', 'metadata')) {
                $table->json('metadata')->nullable()->after('style_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('captions', function (Blueprint $table) {
            if (Schema::hasColumn('captions', 'style_id')) {
                $table->dropForeign(['style_id']);
                $table->dropColumn('style_id');
            }
            if (Schema::hasColumn('captions', 'language')) {
                $table->dropColumn('language');
            }
            if (Schema::hasColumn('captions', 'metadata')) {
                $table->dropColumn('metadata');
            }
        });
    }
};
