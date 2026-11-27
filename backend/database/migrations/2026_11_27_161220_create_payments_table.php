<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pro payments made by bank transfer. The user submits one (with a slip, or says they sent it
 * on WhatsApp); an admin checks the bank and approves or rejects it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('plan', 20);
            $table->string('period', 10); // monthly | yearly
            $table->unsignedInteger('amount');
            $table->string('currency', 3);
            // The user's code for the transfer remarks, e.g. SS-7KQ2PX (the same on every payment they make).
            $table->string('reference', 16)->index();
            $table->string('slip_path')->nullable();
            $table->string('slip_mime', 100)->nullable();
            $table->string('note', 500)->nullable();
            $table->string('status', 10)->default('pending')->index(); // pending | approved | rejected
            $table->string('admin_note', 500)->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            // The Pro time this payment bought (set on approval).
            $table->timestamp('period_start')->nullable();
            $table->timestamp('period_end')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
