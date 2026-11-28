<?php

namespace Database\Seeders;

use App\Models\CaptionTemplate;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seeds the system caption templates and the admin account (ADMIN_EMAIL).
     * Outside production it also adds the demo account shown on the login page.
     */
    public function run(): void
    {
        CaptionTemplate::syncSystemTemplates();

        $this->call(AdminUserSeeder::class);

        if (! app()->isProduction()) {
            $this->seedDemoAccount();
        }
    }

    private function seedDemoAccount(): void
    {
        $user = User::firstOrCreate(
            ['email' => 'demo@samplecap.com'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Charitha Wickramarathne',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]
        );
        // role/plan are not mass-assignable; set them explicitly for the demo account.
        $user->forceFill(['role' => 'admin', 'plan' => 'unlimited'])->save();
    }
}
