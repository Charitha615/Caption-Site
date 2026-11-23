<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('users:make-admin {email : The account email} {--revoke : Make the account a normal user again}')]
#[Description('Give an account admin rights (e.g. to approve reviews), or take them away.')]
class MakeAdminCommand extends Command
{
    public function handle(): int
    {
        $user = User::where('email', strtolower(trim((string) $this->argument('email'))))->first();
        if (! $user) {
            $this->error('No account with that email.');

            return self::FAILURE;
        }
        $user->forceFill(['role' => $this->option('revoke') ? 'user' : 'admin'])->save();
        $this->info($this->option('revoke') ? "{$user->email} is a normal user now." : "{$user->email} is an admin now.");

        return self::SUCCESS;
    }
}
