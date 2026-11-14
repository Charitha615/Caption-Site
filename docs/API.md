# API reference

Base URL: `{APP_URL}/api` (local: `http://localhost:8000/api`). All bodies are JSON (UTF-8) unless noted.

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

**Rate limits** (per user unless noted): API 240/min · login 5/min per email+IP · register 10/h per IP · uploads 60/h · chunks 600/min · AI generation 20/h · exports 20/min · autosave 120/min · status polling 120/min.

---

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `/brand` | Product name, tagline, colours, supported languages |
| POST | `/auth/register` | `{name, email, password}` → `201 {user, token}`. Password: ≥ 8 chars, letters + numbers |
| POST | `/auth/login` | `{email, password, device_name?}` → `{user, token}` |

Signed (no token — the URL itself is the credential, issued only to the owner):

| Method | Path | Notes |
|---|---|---|
| GET | `/media/{media}/stream?expires&signature` | Source video; supports `Range` (206) |
| GET | `/projects/{project}/thumbnail?expires&signature` | JPEG |
| GET | `/exports/{export}/download?expires&signature` | Attachment; `Content-Disposition` with UTF-8 filename |

## Account

| Method | Path | Body / notes |
|---|---|---|
| GET | `/me` | `{user}` — `uuid, name, email, role, plan, created_at` |
| PATCH | `/me` | `{name?, email?}` |
| PUT | `/me/password` | `{current_password, password, password_confirmation}` — revokes other tokens |
| POST | `/auth/logout` | Revokes the current token |
| GET | `/settings` | `{settings: {default_language, default_export_resolution, default_export_quality}}` |
| PUT | `/settings` | Any subset of the above |
| GET | `/usage` | See below |
| GET | `/me/ai-key` | `{ai_key: {configured, hint (last 4), status: valid\|unverified\|invalid, checked_at, required, can_caption, help_url}}` — the key itself is never returned |
| PUT | `/me/ai-key` | `{api_key}` → checked with Google, then stored encrypted. `422` on `api_key` if Google rejects it. Saved as `unverified` if Google is unreachable. 10/min |
| POST | `/me/ai-key/verify` | Re-checks the saved key → `{ai_key, verification: {result: valid\|invalid\|unreachable, message}}`. 10/min |
| DELETE | `/me/ai-key` | Removes the key |
| GET | `/dashboard` | `{summary, usage, recent_projects}` |

`GET /usage`:

```json
{ "usage": {
  "plan": { "key": "free", "label": "Free" },
  "period": { "start": "2026-11-01", "end": "2026-11-30" },
  "caption_minutes": { "used": 12.5, "limit": 120 },
  "ai_requests_today": { "used": 3, "limit": 30 },
  "exports": { "used": 8, "limit": 300 },
  "renders": { "used": 1, "limit": 30 },
  "storage_mb": { "used": 412.3, "limit": 5120 },
  "max_upload_mb": 500, "max_video_minutes": 30 } }
```

`limit: null` means unlimited.

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
| POST | `/projects/{project}/exports` | `{type: srt\|vtt\|txt\|json\|mp4, resolution?: 720\|1080\|2160\|source, quality?: high\|standard\|small, template?: uuid}` |
| GET | `/exports/{export}` | Status/progress; `download_url` (signed, 30 min) when completed |
| DELETE | `/exports/{export}` | Deletes file; cancels a running render |

Text formats complete in the request (`status: completed`). MP4 returns `status: queued`; poll `GET /exports/{export}` (`processing`, `progress` 0–100) until `completed` or `failed` (`error_message` is user-safe).

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
