# Environment Variables Reference

This guide outlines all environment configuration variables used across the backend and frontend applications.

---

## Backend Configuration (`backend/.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `APP_NAME` | Primary application name | `SampleCap` |
| `APP_ENV` | Application environment (`local`, `staging`, `production`) | `local` |
| `APP_KEY` | Laravel encryption key | `base64:...` |
| `APP_DEBUG` | Enable verbose error debugging | `true` |
| `APP_URL` | Public API base URL | `http://localhost:8000` |
| `FRONTEND_URL` | Trusted frontend URL for CORS and redirect headers | `http://localhost:5173` |
| **Database (MySQL)** | | |
| `DB_CONNECTION` | Database driver | `mysql` |
| `DB_HOST` | Database host (`127.0.0.1` or `localhost`) | `127.0.0.1` |
| `DB_PORT` | Database port (Mac MAMP standard is `8889`) | `8889` |
| `DB_DATABASE` | Database name | `samplecap` |
| `DB_USERNAME` | Database username | `root` |
| `DB_PASSWORD` | Database password | `root` |
| `DB_SOCKET` | Optional Unix socket path for Mac MAMP | `/Applications/MAMP/tmp/mysql/mysql.sock` |
| **Queues & Cache** | | |
| `QUEUE_CONNECTION` | Job queue driver (`database`, `redis`, `sync`) | `database` |
| `CACHE_STORE` | Cache driver | `database` |
| `REDIS_HOST` | Redis host | `127.0.0.1` |
| `REDIS_PORT` | Redis port | `6379` |
| **Filesystem & Storage** | | |
| `FILESYSTEM_DISK` | Storage disk (`local`, `public`, `s3`) | `local` |
| **AI Transcription Engine** | | |
| `GEMINI_API_KEY` | Google AI Gemini API Key | *(Leave empty for intelligent demo mode)* |
| `GEMINI_MODEL` | Gemini model name | `gemini-1.5-flash` |
| **Video Processing Engine** | | |
| `FFMPEG_BINARY` | Path to FFmpeg executable | `ffmpeg` |
| `FFPROBE_BINARY` | Path to FFprobe executable | `ffprobe` |
| **Centralized Branding (Optional Overrides)** | | |
| `BRAND_NAME` | Global product name override | `SampleCap` (or `පේළිCap`) |
| `BRAND_TAGLINE` | Global tagline override | `AI-powered video captions` |

> ⚠️ **Security Notice:** Never commit your actual `GEMINI_API_KEY` or production database passwords to version control.

---

## Frontend Configuration (`frontend/.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_URL` | Full URL to the Laravel REST API endpoint | `http://localhost:8000/api` |

> ⚠️ **Important:** The frontend communicates strictly via the REST API. Never expose the `GEMINI_API_KEY` to Vite or client-side code.
