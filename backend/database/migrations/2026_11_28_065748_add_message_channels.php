<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Admin messages by email and WhatsApp too:
 * - users: an optional WhatsApp number with consent, and whether they want update emails;
 * - admin_messages: which channels it went to, its category and button text, and per-channel reach.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('whatsapp_number', 20)->nullable()->after('email');
            $table->boolean('whatsapp_opt_in')->default(false)->after('whatsapp_number');
            $table->boolean('email_updates')->default(true)->after('whatsapp_opt_in');
        });

        Schema::table('admin_messages', function (Blueprint $table) {
            $table->string('category', 20)->default('announcement')->after('body');
            $table->string('button_label', 40)->nullable()->after('link');
            $table->json('channels')->nullable()->after('audience');
            $table->unsignedInteger('email_recipients')->default(0)->after('recipients');
            $table->unsignedInteger('whatsapp_recipients')->default(0)->after('email_recipients');
        });
    }

    public function down(): void
    {
        Schema::table('admin_messages', function (Blueprint $table) {
            $table->dropColumn(['category', 'button_label', 'channels', 'email_recipients', 'whatsapp_recipients']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['whatsapp_number', 'whatsapp_opt_in', 'email_updates']);
        });
    }
};
