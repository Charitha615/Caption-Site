<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Support\AppLog;
use App\Support\PhoneNumber;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/** The signed-in user's own profile and credentials. */
class AccountController extends Controller
{
    use ApiResponseTrait;

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'whatsapp_number' => ['sometimes', ...PhoneNumber::rules()],
            'whatsapp_opt_in' => ['sometimes', 'boolean'],
            'email_updates' => ['sometimes', 'boolean'],
        ]);
        if (isset($validated['email'])) {
            $validated['email'] = strtolower(trim($validated['email']));
        }

        $user->update(array_intersect_key($validated, array_flip(['name', 'email'])));
        // Contact preferences for messages from the team (not mass-assignable).
        $contact = [];
        if (array_key_exists('whatsapp_number', $validated)) {
            $contact['whatsapp_number'] = PhoneNumber::normalize($validated['whatsapp_number']);
        }
        foreach (['whatsapp_opt_in', 'email_updates'] as $flag) {
            if (array_key_exists($flag, $validated)) {
                $contact[$flag] = (bool) $validated[$flag];
            }
        }
        if ($contact) {
            $user->forceFill($contact)->save();
        }

        return $this->successResponse(['user' => new UserResource($user->fresh())], 'Profile updated');
    }

    /** Changing the password revokes every other session's token. */
    public function updatePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'confirmed', Password::min(8)->letters()->numbers(), 'different:current_password'],
        ]);

        if (! Hash::check($validated['current_password'], $user->password)) {
            AppLog::warning('auth.password_change_rejected', ['user' => $user->uuid, 'ip' => $request->ip()]);
            throw ValidationException::withMessages(['current_password' => 'Your current password is incorrect.']);
        }

        $user->update(['password' => $validated['password']]);
        $currentId = $user->currentAccessToken()?->id;
        $user->tokens()->when($currentId, fn ($q) => $q->where('id', '!=', $currentId))->delete();
        AppLog::info('auth.password_changed', ['user' => $user->uuid]);

        return $this->successResponse(null, 'Password updated. Other devices have been signed out.');
    }
}
