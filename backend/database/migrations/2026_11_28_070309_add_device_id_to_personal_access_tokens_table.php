<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A random id the browser keeps for itself, sent when signing in: signing in again on the same
 * browser replaces its old session instead of adding another row to "Signed-in devices".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->string('device_id', 64)->nullable()->after('sign_in_method');
            $table->index(['tokenable_id', 'device_id']);
        });
    }

    public function down(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->dropIndex(['tokenable_id', 'device_id']);
            $table->dropColumn('device_id');
        });
    }
};
