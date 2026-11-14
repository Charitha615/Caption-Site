<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Bring-your-own Google AI (Gemini) key. The key is stored encrypted with APP_KEY
     * (Eloquent `encrypted` cast); only the last 4 characters are ever shown back.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('gemini_api_key')->nullable()->after('plan');
            $table->string('gemini_key_hint', 8)->nullable()->after('gemini_api_key');
            $table->string('gemini_key_status', 20)->nullable()->after('gemini_key_hint'); // unverified | valid | invalid
            $table->timestamp('gemini_key_checked_at')->nullable()->after('gemini_key_status');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['gemini_api_key', 'gemini_key_hint', 'gemini_key_status', 'gemini_key_checked_at']);
        });
    }
};
