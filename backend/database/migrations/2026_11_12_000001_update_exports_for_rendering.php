<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Exports become a real job record: type, status (queued|processing|completed|failed),
 * progress and timing. The stored public `download_url` is removed — downloads go
 * through short-lived signed URLs generated on demand.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exports', function (Blueprint $table) {
            $table->renameColumn('format', 'type');
        });

        Schema::table('exports', function (Blueprint $table) {
            $table->unsignedTinyInteger('progress')->default(0)->after('status');
            $table->timestamp('started_at')->nullable()->after('metadata');
            $table->timestamp('completed_at')->nullable()->after('started_at');
            $table->dropColumn('download_url');
        });

        Schema::table('exports', function (Blueprint $table) {
            $table->string('status', 30)->default('queued')->change();
        });

        DB::table('exports')->where('status', 'pending')->update(['status' => 'queued']);
    }

    public function down(): void
    {
        DB::table('exports')->where('status', 'queued')->update(['status' => 'pending']);

        Schema::table('exports', function (Blueprint $table) {
            $table->string('status', 30)->default('pending')->change();
            $table->string('download_url')->nullable();
            $table->dropColumn(['progress', 'started_at', 'completed_at']);
        });

        Schema::table('exports', function (Blueprint $table) {
            $table->renameColumn('type', 'format');
        });
    }
};
