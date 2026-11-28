<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Creates (or promotes) the admin account from ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD.
 * Safe to run again: an existing account keeps its password unless ADMIN_PASSWORD is set.
 */
class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $email = Str::lower(trim((string) config('auth.admin.email')));
        if ($email === '') {
            $this->command?->warn('ADMIN_EMAIL is not set: no admin account created.');

            return;
        }

        $password = (string) config('auth.admin.password');
        $user = User::firstOrNew(['email' => $email]);

        if (! $user->exists) {
            $user->uuid = (string) Str::uuid();
            $user->name = (string) config('auth.admin.name');
            // No password given: an unguessable one. Sign in with Google or "Forgot password".
            $user->password = Hash::make($password !== '' ? $password : Str::random(64));
        } elseif ($password !== '') {
            $user->password = Hash::make($password);
        }

        // role/plan are not mass-assignable.
        $user->forceFill([
            'role' => 'admin',
            'plan' => 'unlimited',
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        $this->command?->info("Admin account ready: {$email}");
    }
}
