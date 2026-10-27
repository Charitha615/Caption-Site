# Setup & Installation Guide

This document provides complete instructions for setting up the **SampleCap** video captioning platform on your local development machine.

---

## 1. Prerequisites

Ensure your machine has the following tools installed:

- **PHP**: >= 8.3 (tested with PHP 8.5)
- **Composer**: >= 2.6
- **Node.js**: >= 18.0 (tested with Node 24)
- **npm**: >= 9.0
- **MySQL / MariaDB**: MySQL 8.x or MAMP (running on port `8889` or standard `3306`)
- **Redis** (optional for dev, required for queue processing): `127.0.0.1:6379`
- **FFmpeg & FFprobe**: For video probing and audio extraction

---

## 2. Database Preparation (Mac / MAMP)

The application requires a MySQL database configured with `utf8mb4` encoding for complete Unicode and Sinhala script support.

Run in your terminal or MySQL console:

```sql
CREATE DATABASE IF NOT EXISTS samplecap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 3. Backend Setup (Laravel)

### Step 3.1: Navigate to backend and configure environment

```bash
cd backend
cp .env.example .env
```

Verify the `.env` settings match your local MySQL configuration:

```ini
APP_NAME=SampleCap
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

# Database configuration (Mac MAMP standard)
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=8889
DB_DATABASE=samplecap
DB_USERNAME=root
DB_PASSWORD=root
DB_SOCKET=/Applications/MAMP/tmp/mysql/mysql.sock

# AI & Video processing
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
FFMPEG_BINARY=ffmpeg
FFPROBE_BINARY=ffprobe
```

### Step 3.2: Run migrations and seeders

```bash
php artisan migrate:fresh --seed
```

This will create all 10 domain tables and seed:
- **Demo User**: `demo@samplecap.com` (password: `password123`)
- **Sample Sinhala Project**: "සිංහල තාක්ෂණික සමාලෝචනය #1"
- **Sample English Project**: "AI Video Captioning Platform Overview"
- **Sample Processing Project**: "ඇල්ල සංචාරය - Travel Reel #4"

### Step 3.3: Verify backend test suite

```bash
php artisan test
```

Expected output:
```text
Pass: 16 passed, 49 assertions
```

### Step 3.4: Start the backend API server

```bash
php artisan serve --port=8000
```

The API will be accessible at `http://localhost:8000/api`.

---

## 4. Frontend Setup (React + Vite)

### Step 4.1: Install dependencies

```bash
cd frontend
cp .env.example .env
npm install
```

### Step 4.2: Start development server

```bash
npm run dev
```

The application will be accessible at:
👉 **http://localhost:5173**

### Step 4.3: Build for production

```bash
npm run build
```

This compiles TypeScript with strict verification and generates the optimized production bundle in `dist/`.

---

## 5. Renaming the Product (Rebranding to "පේළිCap")

To change the product name from **SampleCap** to **පේළිCap** (or any other name):

1. **Frontend**: Open `frontend/src/config/brand.ts`:
   ```typescript
   export const BRAND = {
     name: "පේළිCap",
     shortName: "පේළිCap",
     logoText: "පේළිCap",
     tagline: "AI මඟින් ක්‍රියාත්මක වන වීඩියෝ උපසිරැසි නිර්මාණය",
     description: "වීඩියෝ සඳහා නිවැරදි සිංහල උපසිරැසි පහසුවෙන් සාදාගන්න.",
     // ...
   };
   ```

2. **Backend**: Open `backend/config/brand.php` or set in `backend/.env`:
   ```ini
   BRAND_NAME="පේළිCap"
   BRAND_SHORT_NAME="පේළිCap"
   BRAND_LOGO_TEXT="පේළිCap"
   BRAND_TAGLINE="AI මඟින් ක්‍රියාත්මක වන වීඩියෝ උපසිරැසි"
   ```

All page titles, headers, navigation bars, buttons, empty states, and notifications will update across both applications immediately.
