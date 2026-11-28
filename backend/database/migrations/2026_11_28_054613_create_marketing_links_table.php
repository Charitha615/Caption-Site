<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Campaign links the admin makes for posts, ads and creators: a name and notes for the
 * marketing, plus the UTM tags its sign-ups are counted by (users.signup_source / _medium / _campaign).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketing_links', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name', 120);
            $table->string('source', 100);
            $table->string('medium', 100)->nullable();
            $table->string('campaign', 100)->nullable();
            $table->string('path', 255)->default('/');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['source', 'medium', 'campaign']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_links');
    }
};
