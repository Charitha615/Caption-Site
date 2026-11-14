<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('plan', 30)->default('free')->after('role')->index();
        });

        Schema::table('projects', function (Blueprint $table) {
            // User-safe reason shown when processing fails (technical detail stays in logs).
            $table->string('processing_error', 500)->nullable()->after('status');
        });

        Schema::table('exports', function (Blueprint $table) {
            $table->index(['user_id', 'type', 'status']);
        });

        Schema::table('usage_records', function (Blueprint $table) {
            $table->index(['user_id', 'action', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('usage_records', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'action', 'created_at']);
        });
        Schema::table('exports', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'type', 'status']);
        });
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('processing_error');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['plan']);
            $table->dropColumn('plan');
        });
    }
};
