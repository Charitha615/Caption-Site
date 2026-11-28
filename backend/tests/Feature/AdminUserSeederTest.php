<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminUserSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_the_admin_from_config(): void
    {
        config(['auth.admin' => ['email' => ' Boss@Example.com ', 'name' => 'Boss', 'password' => 'Secret123']]);

        $this->seed(AdminUserSeeder::class);

        $user = User::where('email', 'boss@example.com')->firstOrFail();
        $this->assertTrue($user->isAdmin());
        $this->assertSame('unlimited', $user->plan);
        $this->assertSame('Boss', $user->name);
        $this->assertNotNull($user->uuid);
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue(Hash::check('Secret123', $user->password));
    }

    public function test_without_a_password_the_account_gets_a_random_one(): void
    {
        config(['auth.admin' => ['email' => 'boss@example.com', 'name' => 'Boss', 'password' => null]]);

        $this->seed(AdminUserSeeder::class);

        $user = User::where('email', 'boss@example.com')->firstOrFail();
        $this->assertFalse(Hash::check('', $user->password));
        $this->assertTrue($user->isAdmin());
    }

    public function test_running_again_promotes_an_existing_user_and_keeps_their_password(): void
    {
        $user = User::factory()->create(['email' => 'boss@example.com', 'password' => Hash::make('Mine12345')]);
        config(['auth.admin' => ['email' => 'boss@example.com', 'name' => 'Boss', 'password' => null]]);

        $this->seed(AdminUserSeeder::class);
        $this->seed(AdminUserSeeder::class);

        $user->refresh();
        $this->assertSame(1, User::count());
        $this->assertTrue($user->isAdmin());
        $this->assertTrue(Hash::check('Mine12345', $user->password));
    }

    public function test_nothing_is_created_without_an_email(): void
    {
        config(['auth.admin' => ['email' => null, 'name' => 'Admin', 'password' => null]]);

        $this->seed(AdminUserSeeder::class);

        $this->assertSame(0, User::count());
    }
}
