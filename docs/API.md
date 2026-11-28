# API reference

Base URL: `{APP_URL}/api` (local: `http://localhost:8000/api`; live: `https://captionapi.cloudshift.lk/api`). All bodies are JSON (UTF-8) unless noted.

*Last updated: 28 November 2026.* The behaviour behind these endpoints (plans, scenarios, rules) is specified in [SRS.md](SRS.md).

## Conventions

**Auth.** Send `Authorization: Bearer <token>` (from register/login) and `Accept: application/json`. Tokens expire after `SANCTUM_TOKEN_EXPIRATION` minutes.

**Envelope.**

```json
{ "success": true, "message": "Project retrieved", "data": { … } }
```

Errors:

```json
{ "success": false, "message": "Human-readable, safe to show", "data": {},
  "code": "validation_failed", "errors": { "email": ["…"] }, "request_id": "uuid" }
```

| Status | `code` | Meaning |
|---|---|---|
| 401 | `unauthenticated` | Missing/expired token |
| 402 | `usage_limit_exceeded` | Plan limit reached (message says which) |
| 422 | `ai_key_required` | Add a Google AI key (`PUT /me/ai-key`) before uploading or generating |
| 403 | `forbidden` / `http_403` | Not your resource, or an invalid/expired signed URL |
| 404 | `not_found` | Unknown resource |
| 409 | `http_409` | Conflicting state (e.g. project already processing, chunks missing) |
| 410 | — | Upload session expired or cancelled |
| 422 | `validation_failed` / `video_processing_error` | Invalid input |
| 429 | `rate_limited` | Slow down; see `Retry-After` |
| 502 | `ai_provider_error` | AI provider failed |
| 500 | `server_error` | Unexpected; quote `request_id` to support |

Every response has an `X-Request-Id` header. Identifiers in URLs are UUIDs.

**Rate limits** (per user unless noted): API 240/min · login 5/min per email+IP · register 10/h per IP · uploads 60/h · chunks 600/min · AI generation 20/h · exports 20/min (also subject-mask uploads) · autosave 120/min · status polling 120/min · AI key 10/min · billing payments 20/h · trial 10/h · video projects 60 creates / 120 saves per min · admin messages 20/min.

---

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `/brand` | Product name, tagline, colours, supported languages |
| GET | `/reviews` | Approved user reviews (landing page) |
| POST | `/auth/register` | `{name, email, password, whatsapp_number?, whatsapp_opt_in?, attribution?, device_id?}` → `201 {user, token}`. Password: ≥ 8 chars, letters + numbers. `attribution = {source?, medium?, campaign?, referrer?}` |
| POST | `/auth/login` | `{email, password, device_name?, device_id?}` → `{user, token}` |
| POST | `/auth/google` | `{access_token, attribution?, device_id?}` → `{user, token, created}` — links an existing account with the same email |
| POST | `/auth/forgot-password` | `{email}` → same answer whether or not the account exists |
| POST | `/auth/reset-password` | `{token, email, password, password_confirmation}` |

`device_id` is a random 16–64 character id the browser keeps; signing in again with the same id replaces that device's previous session.

Signed (no token — the URL itself is the credential, issued only to the owner):

| Method | Path | Notes |
|---|---|---|
| GET | `/media/{media}/stream?expires&signature` | Source video; supports `Range` (206) |
| GET | `/projects/{project}/thumbnail?expires&signature` | JPEG |
| GET | `/exports/{export}/download?expires&signature` | Attachment; `Content-Disposition` with UTF-8 filename |

## Account

| Method | Path | Body / notes |
|---|---|---|
| GET | `/me` | `{user}` — `uuid, name, email, role, plan, plan_expires_at, whatsapp_number, whatsapp_opt_in, email_updates, ai_key, created_at` |
| PATCH | `/me` | `{name?, email?, whatsapp_number?, whatsapp_opt_in?, email_updates?}` — numbers are stored as international digits (`077 123 4567` → `94771234567`) |
| PUT | `/me/password` | `{current_password, password, password_confirmation}` — revokes other tokens |
| POST | `/auth/logout` | Revokes the current token |
| GET | `/settings` | `{settings: {default_language, tour_pending}}` |
| PUT | `/settings` | Any subset of the above (`tour_pending: false` after the app tour) |
| GET | `/me/sessions` | Signed-in devices: browser, OS, device type, IP, sign-in method, signed-in and last-active times, `current` |
| DELETE | `/me/sessions/{session}` | Sign out one device |
| DELETE | `/me/sessions` | Sign out every other device |
| GET / PUT / DELETE | `/me/review` | Your review `{rating 1–5, body (10–300 chars), role? (≤ 80)}`; saved reviews wait for admin approval |
| GET | `/usage` | See below |
| GET | `/me/ai-key` | `{ai_key: {configured, hint (last 4), status: valid\|unverified\|invalid, checked_at, required, can_caption, help_url}}` — the key itself is never returned |
| PUT | `/me/ai-key` | `{api_key}` → checked with Google, then stored encrypted. `422` on `api_key` if Google rejects it. Saved as `unverified` if Google is unreachable. 10/min |
| POST | `/me/ai-key/verify` | Re-checks the saved key → `{ai_key, verification: {result: valid\|invalid\|unreachable, message}}`. 10/min |
| DELETE | `/me/ai-key` | Removes the key |
| GET | `/dashboard` | `{summary, usage, recent_projects}` |

`GET /usage`:

```json
{ "usage": {
  "plan": { "key": "free", "label": "Free", "expires_at": null },
  "features": { "max_export_height": 720, "watermark": true, "premium_styles": false, "editor_ai": false, "priority_support": false },
  "period": { "start": "2026-11-10", "end": "2026-12-10", "resets_at": "2026-12-10T09:00:00.000000Z" },
  "caption_minutes": { "used": 12.5, "limit": 15 },
  "ai_requests_today": { "used": 3, "limit": 10 },
  "exports": { "used": 8, "limit": 50 },
  "renders": { "used": 1, "limit": 5 },
  "storage_mb": { "used": 412.3, "limit": 1024 },
  "max_upload_mb": 200, "max_video_minutes": 3,
  "trial": { "days": 7, "eligible": true, "active": false, "used": false, "ends_at": null } } }
```

`limit: null` means unlimited. `period` is the current **30-day usage cycle** (from sign-up or the start of the current plan), not a calendar month.

## Projects

| Method | Path | Notes |
|---|---|---|
| GET | `/projects?status=&search=&page=&per_page=` | `status`: `all, processing, ready, draft, failed`. Returns `{projects, pagination, counts}` |
| POST | `/projects` | `{name, description?, language?: si\|en\|auto, settings?}` → `201` |
| GET | `/projects/{project}` | Includes signed `video_url` and `thumbnail` |
| PATCH | `/projects/{project}` | `{name?, description?, language?, settings?}` (`settings.editor` = editor style/canvas, ≤ 256 KB) |
| DELETE | `/projects/{project}` | Soft-deletes; removes video, audio, thumbnail, exports from storage |
| GET | `/projects/{project}/status` | Poll while processing (below) |

Project shape (abridged): `uuid, name, description, status, processing_error, duration, width, height, fps, language, thumbnail, video_url, settings, captions_count, created_at, updated_at`.

`status` values: `draft → uploaded → processing → extracting_audio → transcribing → generating_captions → ready` (or `failed`).

`GET /projects/{project}/status`:

```json
{ "status": "transcribing", "progress_percentage": 70, "phase": "transcribing",
  "phase_label": "Transcribing speech with AI...", "is_processing": true,
  "is_ready": false, "is_failed": false, "error": null,
  "duration": 12.0, "width": 1080, "height": 1920, "captions_count": 0 }
```

## Uploads

Chunked and resumable (recommended):

| Method | Path | Notes |
|---|---|---|
| POST | `/projects/{project}/uploads` | `{file_name, file_size, language?}` → `201` new or `200` resumed `{upload}` |
| GET | `/uploads/{upload}` | `{upload}` with `received_chunks` |
| PUT | `/uploads/{upload}/chunks/{index}` | Raw body, `Content-Type: application/octet-stream`, exactly `chunk_size` bytes (last chunk: remainder). Idempotent |
| POST | `/uploads/{upload}/complete` | Assembles, checks MIME from content, starts processing → `201 {project, media_file, status}`. `409` with `errors.missing_chunks` if parts are missing |
| DELETE | `/uploads/{upload}` | Cancel and discard |

`upload` shape: `uuid, status, file_name, file_size, chunk_size, total_chunks, received_chunks[], expires_at`.

Single request (small files): `POST /projects/{project}/upload` multipart `video`, `language?` → `201`.

Accepted: MP4, MOV, WEBM, MKV, AVI, M4V (checked by extension **and** file contents). Size/length limits come from the plan.

## Captions

| Method | Path | Notes |
|---|---|---|
| GET | `/projects/{project}/captions` | Ordered by `sequence` |
| POST | `/projects/{project}/captions` | `{start_time, end_time, text, language?, sequence?, style_override?, metadata?}` |
| PATCH | `/projects/{project}/captions/{caption}` | Partial update |
| DELETE | `/projects/{project}/captions/{caption}` | Soft delete |
| PUT | `/projects/{project}/captions/sync` | `{captions: [...]}` — replaces the full list (editor autosave). Items may carry client `uuid`s; missing ones are deleted; re-sent deleted uuids are restored |
| POST | `/projects/{project}/generate-captions` | `{language?}` → `202`. Re-runs AI; replaces captions when done. `409` while processing |

Caption: `uuid, sequence, start_time, end_time, text (≤ 2000), language, style_override, metadata.words[{word,start,end}]`. Times are seconds (3 decimals).

## Exports

| Method | Path | Notes |
|---|---|---|
| GET | `/projects/{project}/exports` | Latest 50 |
| POST | `/projects/{project}/exports` | `{type: srt\|vtt\|txt\|json\|mp4, resolution?: 720\|1080\|1440\|2160\|source, quality?: high\|standard\|small, template?: uuid}`. MP4 checks plan resolution, Pro styles, concurrent renders and (for captions behind the person) that the person outline was uploaded |
| GET | `/exports/{export}` | Status/progress; `download_url` (signed, 30 min) when completed |
| DELETE | `/exports/{export}` | Deletes file; cancels a running render |

Text formats complete in the request (`status: completed`). MP4 returns `status: queued`; poll `GET /exports/{export}` (`processing`, `progress` 0–100) until `completed` or `failed` (`error_message` is user-safe).

## Captions behind the person (Pro)

| Method | Path | Notes |
|---|---|---|
| GET | `/projects/{project}/subject-mask` | `{ready}` — an outline exists for the project's current video |
| PUT | `/projects/{project}/subject-mask` | Raw body (`application/octet-stream`, ≤ 40 MB): `"SSM1"`, width, height (uint16 LE), fps × 100, frame count (uint32 LE), then per frame a uint32 byte length and uint16 run lengths of alternating background/person pixels. `402` on Free, `422` if malformed |

## Caption templates

| Method | Path | Notes |
|---|---|---|
| GET | `/caption-templates` | System presets + your templates |
| POST | `/caption-templates` | `{name, style, description?, preview_text?}` (style is validated/normalised) |
| DELETE | `/caption-templates/{template}` | Only your own |

## Example: upload with curl

```bash
TOKEN=…; P=<project-uuid>; F=video.mp4; SIZE=$(stat -f%z "$F")   # Linux: stat -c%s
U=$(curl -s -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"file_name\":\"$F\",\"file_size\":$SIZE}" $API/projects/$P/uploads | jq -r .data.upload.uuid)
CHUNK=$(curl -s -H "Authorization: Bearer $TOKEN" $API/uploads/$U | jq .data.upload.chunk_size)
split -b $CHUNK "$F" part_ && i=0
for p in part_*; do
  curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/octet-stream' \
    --data-binary @"$p" $API/uploads/$U/chunks/$i >/dev/null; i=$((i+1)); done
curl -s -X POST -H "Authorization: Bearer $TOKEN" $API/uploads/$U/complete
```

---

## Video editor

| Method | Path | Notes |
|---|---|---|
| POST | `/video-editor/ai/transcribe` | Multipart `audio` (WAV part), `language`, `part`, `lead_in` → `{lines}` (auto subtitles; free) |
| POST | `/video-editor/ai/text` | `{task: translate\|script\|titles\|highlights\|singlish, …}` → `{lines}` or `{moments}`. All but `singlish` need Pro (`402`) |
| GET | `/video-editor/ai/voices` | Voice list for voice-over |
| POST | `/video-editor/ai/speech` | `{text, voice, style?}` → audio (Pro) |
| POST | `/video-editor/import-link` | `{url, confirm_rights: true}` → the video file (size limited by plan) |

### Saved video editor projects (layout only)

| Method | Path | Notes |
|---|---|---|
| GET | `/video-projects` | `{projects: [{uuid, name, aspect, duration, clip_count, thumb, created_at, updated_at}], limit}` |
| POST | `/video-projects` | `{name, aspect: 16:9\|9:16\|1:1\|4:5, data: {version: 1, tracks, clips, media, fonts?, zoom?, snap?}, thumb?}` → `201`. `402` when the plan's `video_projects` limit is reached; `data` ≤ 2 MB; `thumb` a `data:image/...;base64,` URL ≤ 80 KB |
| GET | `/video-projects/{uuid}` | Summary + `data` |
| PUT | `/video-projects/{uuid}` | Same body as POST |
| DELETE | `/video-projects/{uuid}` | |

Other users' projects return `404`. Media files are never sent; `.sinsub` project files are made and read entirely in the browser.

## Billing and trial

| Method | Path | Notes |
|---|---|---|
| GET | `/billing` | `{plan, billing: {currency, plan, prices, bank, bank_ready, whatsapp, whatsapp_link, reference}, payments}` |
| POST | `/billing/payments` | Multipart `{period: monthly\|yearly, slip?: jpg/png/webp/heic/pdf ≤ 5 MB, note?}` → `201 {payment}`. One pending payment at a time. Alerts admins (email, and WhatsApp when CallMeBot is set up) |
| POST | `/billing/payments/{payment}/slip` | Multipart `{slip}` — add a slip to your pending payment |
| GET | `/billing/payments/{payment}/slip` | The slip file (owner or admin) |
| POST | `/billing/trial` | Starts the free Pro trial → `201 {ends_at, days}`. `422` (`errors.trial`) if already used, not on Free, paid before, or the email already had a trial |

Payment: `uuid, plan, period, amount, currency, reference (SS-XXXXXX), status (pending|approved|rejected), has_slip, note, admin_note, created_at, reviewed_at, period_start, period_end`.

## Notifications

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications?page=&per_page=` | `{notifications: [{id, kind, title, body, link, category, button_label, read, created_at}], unread, meta}` |
| GET | `/notifications/unread` | `{unread}` — for polling |
| POST | `/notifications/{id}/read` | Mark one read |
| POST | `/notifications/read-all` | Mark all read |
| DELETE | `/notifications/{id}` | Remove one |

`kind`: `welcome`, `payment`, `payment_rejected`, `plan`, `render`, `render_failed`, `admin`. `link` is an app path (`/billing`) or an `https://` address.

## Admin (role `admin`; others get `403`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/payments?status=pending\|approved\|rejected` | Payments with the user, and counts per status |
| POST | `/admin/payments/{payment}/approve` | `{note?}` — turns Pro on (time added after any remaining Pro) |
| POST | `/admin/payments/{payment}/reject` | `{reason}` — emailed to the user |
| GET | `/admin/reviews?status=pending\|approved\|rejected` | Reviews and counts per status |
| PATCH | `/admin/reviews/{review}` | `{status: approved\|rejected}` |
| GET | `/admin/users?search=&plan=&page=` | Users with plan, trial, projects, last active, sign-up source; `plans` list |
| GET | `/admin/users/{uuid}` | One user + usage |
| PUT | `/admin/users/{uuid}/plan` | `{plan: free\|pro\|unlimited, expires_at?}` — no date = no end |
| PUT | `/admin/users/{uuid}/password` | `{password}` — signs the user out everywhere |
| POST | `/admin/users/{uuid}/usage-reset` | Fresh cycle (records kept) |
| POST | `/admin/users/{uuid}/sign-out` | Ends every session |
| DELETE | `/admin/users/{uuid}/projects` | Deletes all their caption projects |
| GET | `/admin/signups?days=7\|30\|90\|0` | Totals and sign-ups by source/medium/campaign (with campaign-link names) |
| GET / POST | `/admin/marketing-links` | Campaign links with sign-ups and Pro conversions / create `{name, source, medium?, campaign?, path?, notes?}` |
| PUT / DELETE | `/admin/marketing-links/{uuid}` | Update / delete |
| GET | `/admin/messages` | Sent messages and `reach[audience][in_app\|email\|whatsapp]` |
| POST | `/admin/messages` | `{title, body, category?: announcement\|update\|offer\|tip\|important, link?, button_label?, audience: everyone\|free\|pro\|pro_monthly\|pro_yearly\|unlimited\|user, email? (for user), channels: [in_app, email, whatsapp]}` → `201` |
| GET | `/admin/messages/{id}/whatsapp` | Click-to-send list `[{name, email, phone, link (wa.me with the message)}]` |

