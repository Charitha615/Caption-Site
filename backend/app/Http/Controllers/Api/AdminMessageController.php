<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendAdminMessage;
use App\Models\AdminMessage;
use App\Models\User;
use App\Support\AppLog;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Admins: send a message to users (notification bell, email, WhatsApp list), and see what was sent.
 * Audiences: everyone, a plan, Pro by billing period, or one user.
 */
class AdminMessageController extends Controller
{
    use ApiResponseTrait;

    public function index(): JsonResponse
    {
        $messages = AdminMessage::query()->with('targetUser:id,name,email')->latest()->limit(100)->get();

        // How many people each audience reaches on each channel.
        $reach = [];
        foreach (array_diff(AdminMessage::AUDIENCES, ['user']) as $audience) {
            $probe = new AdminMessage(['audience' => $audience]);
            $reach[$audience] = [
                'in_app' => $probe->recipients()->count(),
                'email' => $probe->recipients('email')->count(),
                'whatsapp' => $probe->recipients('whatsapp')->count(),
            ];
        }

        return $this->successResponse([
            'messages' => $messages->map(fn (AdminMessage $m) => $this->present($m)),
            'reach' => $reach,
        ], 'Messages retrieved');
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'body' => ['required', 'string', 'max:2000'],
            'category' => ['nullable', Rule::in(array_keys(AdminMessage::CATEGORIES))],
            'link' => ['nullable', 'string', 'max:255', 'regex:/^(\/[^\s]*|https:\/\/[^\s]+)$/'],
            'button_label' => ['nullable', 'string', 'max:40'],
            'audience' => ['required', Rule::in(AdminMessage::AUDIENCES)],
            'email' => ['required_if:audience,user', 'nullable', 'email'],
            'channels' => ['required', 'array', 'min:1'],
            'channels.*' => [Rule::in(AdminMessage::CHANNELS)],
        ], [
            'link.regex' => 'The link must be a page of the site (like /billing) or a full https:// address.',
            'channels.required' => 'Choose at least one way to send it.',
        ]);

        $target = null;
        if ($data['audience'] === 'user') {
            $target = User::where('email', strtolower(trim((string) $data['email'])))->first();
            if (! $target) {
                throw ValidationException::withMessages(['email' => 'No user has that email address.']);
            }
        }

        $message = new AdminMessage([
            'title' => trim($data['title']),
            'body' => trim($data['body']),
            'category' => $data['category'] ?? 'announcement',
            'link' => ($data['link'] ?? null) ?: null,
            'button_label' => isset($data['button_label']) && trim($data['button_label']) !== '' ? trim($data['button_label']) : null,
            'audience' => $data['audience'],
            'channels' => array_values(array_unique($data['channels'])),
            'target_user_id' => $target?->id,
        ]);
        $message->recipients = $message->sendsOn('in_app') ? $message->recipients()->count() : 0;
        $message->email_recipients = $message->sendsOn('email') ? $message->recipients('email')->count() : 0;
        $message->whatsapp_recipients = $message->sendsOn('whatsapp') ? $message->recipients('whatsapp')->count() : 0;
        if ($message->recipients + $message->email_recipients + $message->whatsapp_recipients === 0) {
            throw ValidationException::withMessages(['channels' => 'Nobody in this audience can be reached that way (for WhatsApp, users must add their number and agree to messages).']);
        }
        $message->sent_by = $request->user()->id;
        $message->save();

        if ($message->sendsOn('in_app') || $message->sendsOn('email')) {
            SendAdminMessage::dispatch($message);
        }
        AppLog::info('admin.message_sent', ['admin' => $request->user()->uuid, 'audience' => $message->audience, 'channels' => $message->channels]);

        return $this->successResponse(['message' => $this->present($message->load('targetUser:id,name,email'))], 'Message sent', 201);
    }

    /** People to message on WhatsApp, each with a link that opens WhatsApp with the message typed in. */
    public function whatsapp(AdminMessage $message): JsonResponse
    {
        if (! $message->sendsOn('whatsapp')) {
            throw ValidationException::withMessages(['channels' => 'This message was not sent on WhatsApp.']);
        }
        $people = $message->recipients('whatsapp')->orderBy('name')->limit(2000)->get(['id', 'name', 'email', 'whatsapp_number']);

        return $this->successResponse([
            'recipients' => $people->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'phone' => '+'.$u->whatsapp_number,
                'link' => 'https://wa.me/'.$u->whatsapp_number.'?text='.rawurlencode($message->whatsAppText(strtok((string) $u->name, ' ') ?: null)),
            ]),
        ], 'WhatsApp list');
    }

    /**
     * @return array{id: int, title: string, body: string, category: string, link: ?string, button_label: ?string, audience: string, channels: array<int, string>, target: ?array{name: string, email: string}, recipients: int, email_recipients: int, whatsapp_recipients: int, created_at: ?string}
     */
    private function present(AdminMessage $m): array
    {
        return [
            'id' => $m->id,
            'title' => $m->title,
            'body' => $m->body,
            'category' => $m->category ?? 'announcement',
            'link' => $m->link,
            'button_label' => $m->button_label,
            'audience' => $m->audience,
            'channels' => $m->channels ?? ['in_app'],
            'target' => $m->targetUser ? ['name' => $m->targetUser->name, 'email' => $m->targetUser->email] : null,
            'recipients' => (int) $m->recipients,
            'email_recipients' => (int) $m->email_recipients,
            'whatsapp_recipients' => (int) $m->whatsapp_recipients,
            'created_at' => $m->created_at?->toISOString(),
        ];
    }
}
