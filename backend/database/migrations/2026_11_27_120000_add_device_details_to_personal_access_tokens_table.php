<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Where each sign-in came from, for the "Signed-in devices" list in Settings:
 * the browser's user agent, the IP address at sign-in, and how the person signed in.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->string('ip_address', 45)->nullable()->after('abilities');
            $table->string('user_agent', 512)->nullable()->after('ip_address');
            $table->string('sign_in_method', 20)->nullable()->after('user_agent');
        });
    }

    public function down(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->dropColumn(['ip_address', 'user_agent', 'sign_in_method']);
        });
    }
};
