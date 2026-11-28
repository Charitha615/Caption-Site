<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The free Pro trial (once per email): when an account started it, and a register of trial emails
 * (hashed, normalised) that outlives the account, so a new account with the same email can't start another.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('trial_started_at')->nullable()->after('plan_started_at');
        });

        Schema::create('trial_claims', function (Blueprint $table) {
            $table->id();
            /** sha256 of the normalised email (lower case; Gmail dots and +tags removed). */
            $table->char('email_hash', 64)->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trial_claims');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('trial_started_at');
        });
    }
};
