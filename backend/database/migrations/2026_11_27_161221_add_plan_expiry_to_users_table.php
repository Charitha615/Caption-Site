<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When a paid plan ends. After this moment the user is on the default (free) plan again.
 * Null = no end (free, or an internal account set by hand).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('plan_expires_at')->nullable()->after('plan')->index();
            // Last time the "Pro is ending soon" reminder went out, so it is sent once per period.
            $table->timestamp('plan_reminded_at')->nullable()->after('plan_expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['plan_expires_at', 'plan_reminded_at']);
        });
    }
};
