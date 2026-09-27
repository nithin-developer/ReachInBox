# ReachInbox Email Scheduler & Dashboard

An enterprise-grade, distributed cold email scheduling and delivery platform featuring **BullMQ delayed queues**, **hour-aligned sliding-window rate limiting**, **zero-loss worker restart reconciliation**, **real-time Slack Block Kit rate-limit alerting**, **Elasticsearch fuzzy full-text search with PostgreSQL fallback**, and an interactive dashboard built with **React 19, Tailwind CSS v4, shadcn/ui, TipTap rich-text editor, and WebGL 3D shader waves**.

---

## Key Features & System Capabilities

- **Zero-Drop Scheduled Email Engine**:
  - Millisecond-accurate delayed dispatches using BullMQ Redis sorted sets.
  - Granular delay intervals (e.g., 5 seconds between dispatches) and custom start dates.
  - Batch CSV lead importer with automatic email parsing and sample template downloads.
- **Distributed Hour-Aligned Rate Limiter**:
  - Atomic Redis Lua script (`check-and-increment`) evaluated against each sender's configured hourly quota.
  - Automatic zero-drop deferral: excess emails in a batch are atomically marked `RESCHEDULED` and queued for the exact next hour window (`HH:00:00`).
- **One-Time Slack Alert Window Locking**:
  - When rate limits are triggered, dispatches a single locked Slack Block Kit alert per hour window per sender (avoiding message floods).
  - Displays sender, hourly limit, sent count (`20/20`), queued pending emails, and resumption timestamp.
- **Self-Healing Worker Restart Resilience**:
  - Redis AOF disk persistence + deterministic `jobId` deduplication.
  - Boot-time PostgreSQL reconciler sweeps uncompleted jobs (`SCHEDULED` / `RESCHEDULED`) and enqueues missed jobs with `delay: 0` for immediate recovery.
- **Hybrid Search Architecture**:
  - Primary full-text fuzzy search powered by **Elasticsearch 8.15** indexing `recipientEmail^3`, `subject^2`, and `body`.
  - Automatic fallback to indexed PostgreSQL `ILIKE` queries if Elasticsearch is offline or unreachable.
- **Modern UI & Aesthetic Experience**:
  - WebGL 3D gradient shader waves background on login with mouse interactivity.
  - Split routes for Overview, Scheduled Emails (`/dashboard/scheduled`), Sent Emails (`/dashboard/sent`), and Email Inspection (`/dashboard/email/:id`).
  - Dark/Light mode theme switching, realtime metrics cards, and responsive sidebar navigation.
  - Bull-Board queue administration UI mounted at `/admin/queues`.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, TipTap, OGL WebGL, Tabler Icons |
| **Backend API** | Node.js (v20+ LTS), Express.js 5.x, TypeScript, Prisma ORM, Zod, Pino |
| **Job Queue & Worker** | BullMQ, Redis 7 (with AOF enabled), Bull-Board UI |
| **Database & Search** | PostgreSQL 16, Elasticsearch 8.15 |
| **Integrations & Mail** | Nodemailer (Ethereal SMTP), Slack Web API (OAuth 2.0 + Block Kit), Google OAuth 2.0 |

---

## Local Setup Guide

### 1. Prerequisites
Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (`v20.x` or higher recommended)
- [npm](https://www.npmjs.com/) (`v10.x` or higher)
- [Docker & Docker Compose](https://www.docker.com/)

---

### 2. Start Infrastructure Containers
From the root repository directory, start PostgreSQL, Redis, and Elasticsearch in detached mode:

```bash
docker compose up -d
```

Verify that all three containers are healthy and running:
```bash
docker compose ps
```

| Service | Container Name | Host Port | Credentials / Notes |
| :--- | :--- | :--- | :--- |
| **PostgreSQL 16** | `reachinbox_postgres` | `5432` | User: `reachinbox` / Pass: `reachinbox_password` / DB: `reachinbox_db` |
| **Redis 7** | `reachinbox_redis` | `6379` | AOF Persistence Enabled (`--appendonly yes`) |
| **Elasticsearch 8.15**| `reachinbox_elasticsearch` | `9200` | Security disabled for local dev (`xpack.security.enabled=false`) |

---

### 3. Backend API & Worker Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   *(The default `.env.example` is pre-configured to connect immediately to the local Docker containers).*

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Run database migrations and seed default user**:
   ```bash
   npm run prisma:migrate -- --name init
   npm run prisma:seed
   ```
   *This initializes the database schema and creates the default test account (**Oliver Brown** - `oliver.brown@example.com`).*

5. **Start the API Server (Terminal 1)**:
   ```bash
   npm run dev
   ```
   - API Server runs at: **`http://localhost:5000`**
   - Bull-Board Queue Dashboard runs at: **`http://localhost:5000/admin/queues`**

6. **Start the Dedicated Email Worker (Terminal 2)**:
   ```bash
   npm run dev:worker
   ```
   - Worker connects to Redis, executes boot-time reconciliation, initializes Elasticsearch indices, and starts processing delayed email jobs.

---

### 4. Frontend Application Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the Vite development server**:
   ```bash
   npm run dev
   ```
   - Access the dashboard at: **`http://localhost:5173`**

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description | Default Value | Required |
| :--- | :--- | :--- | :--- |
| `PORT` | Express API server port | `5000` | Yes |
| `NODE_ENV` | Environment mode (`development` / `production`) | `development` | Yes |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_db?schema=public` | Yes |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` | Yes |
| `ELASTICSEARCH_NODE` | Elasticsearch HTTP endpoint | `http://localhost:9200` | Yes |
| `JWT_SECRET` | Secret key for signed session cookies | `reachinbox_super_secret_jwt_key_2026_production_ready_32chars` | Yes |
| `ENCRYPTION_KEY` | 32-byte hexadecimal key for AES-256-GCM | `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID | `your_google_client_id.apps.googleusercontent.com` | Optional (Demo login available) |
| `GOOGLE_CLIENT_SECRET`| Google OAuth 2.0 Client Secret | `your_google_client_secret` | Optional |
| `GOOGLE_CALLBACK_URL` | Google OAuth redirect callback | `http://localhost:5000/api/auth/google/callback` | Yes |
| `SLACK_CLIENT_ID` | Slack App OAuth Client ID | `your_slack_client_id` | Optional for Slack alerts |
| `SLACK_CLIENT_SECRET`| Slack App OAuth Client Secret | `your_slack_client_secret` | Optional |
| `SLACK_REDIRECT_URI` | Slack App OAuth Redirect URI | `http://localhost:5000/api/slack/callback` | Optional |
| `WORKER_CONCURRENCY` | Concurrent jobs processed by worker | `5` | Yes |
| `DEFAULT_HOURLY_LIMIT`| Default emails per hour per sender | `20` | Yes |
| `ETHEREAL_USER` | Ethereal SMTP test username | *(Auto-generated on boot if omitted)* | No |
| `ETHEREAL_PASS` | Ethereal SMTP test password | *(Auto-generated on boot if omitted)* | No |

---

## API Endpoints Reference

### Authentication (`/api/auth`)
- `GET /api/auth/google` – Redirects to Google OAuth consent screen.
- `GET /api/auth/google/callback` – Handles Google OAuth code exchange and sets session cookie.
- `GET /api/auth/me` – Returns current authenticated user profile.
- `POST /api/auth/dev-login` – 1-Click developer login for local testing.
- `POST /api/auth/logout` – Clears session cookie.

### Campaigns & Scheduling (`/api/campaigns`)
- `POST /api/campaigns` – Creates campaign, parses CSV leads, calculates delayed offsets, and enqueues BullMQ jobs.
- `GET /api/campaigns` – Lists campaigns for current user.
- `GET /api/campaigns/metrics` – Fetches live aggregated dashboard counts, sent counts, and rate limit capacity.
- `GET /api/campaigns/scheduled` – Returns paginated scheduled and rescheduled email jobs.
- `GET /api/campaigns/sent` – Returns paginated sent email jobs.
- `GET /api/campaigns/email/:id` – Returns full metadata, rendered HTML body, and Ethereal preview URL for a single email.
- `POST /api/campaigns/email/:id/star` – Toggles star status on an email job.

### Search Engine (`/api/search`)
- `GET /api/search?q=:query` – Executes Elasticsearch multi-match fuzzy search with automatic fallback to PostgreSQL `ILIKE`.

### Slack Integration (`/api/slack`)
- `GET /api/slack/auth` – Generates Slack OAuth authorization URL.
- `GET /api/slack/callback` – Exchanges bot token, encrypts with AES-256-GCM, and connects workspace.
- `GET /api/slack/status` – Returns current Slack integration connection state.

---

## Resilience & Rate-Limit Testing Guide

### 1. Rate-Limit Simulation Script
Run the automated resilience demo script from the `backend` directory:
```bash
cd backend
npx tsx scripts/demo-resilience.ts
```
*This script schedules 5 leads with an hourly limit of 2, demonstrates atomic Lua script evaluation, triggers the single-lock Slack notification, and reschedules remaining emails to the next hourly window.*

### 2. Worker Restart Simulation (Zero-Loss Test)
1. Schedule a campaign with 20 emails and a 5-second delay between dispatches.
2. Observe emails sending in the worker terminal (`npm run dev:worker`).
3. Terminate the worker abruptly using `Ctrl + C` while jobs are in delayed queue state.
4. Verify in the dashboard that all scheduled emails remain intact in PostgreSQL.
5. Restart the worker (`npm run dev:worker`).
6. Notice the boot reconciliation log:
   ```text
   [Reconciliation] Running boot reconciliation for scheduled email jobs...
   [Reconciliation] Successfully reconciled jobs into BullMQ
   ```
7. All remaining emails resume dispatching accurately without loss or duplicate sends.

### 3. Search Failover Simulation
1. Perform a search in the top bar (results will return with badge `via elasticsearch`).
2. Stop the Elasticsearch container:
   ```bash
   docker stop reachinbox_elasticsearch
   ```
3. Perform the search again &rarr; results return instantly with badge `via postgresql_fallback` with zero UI downtime.
4. Restart Elasticsearch:
   ```bash
   docker start reachinbox_elasticsearch
   ```

---

## Docker Commands Cheat Sheet

```bash
# Start all containers in background
docker compose up -d

# View container status and health
docker compose ps

# View live container logs
docker compose logs -f

# Stop containers without losing data
docker compose down

# Stop and wipe database volumes (clean reset)
docker compose down -v
```

---

## Reviewer Access & Demo Account

- **1-Click Demo Login**: Click **"Quick 1-Click Demo Login (Oliver Brown)"** on the login page (`http://localhost:5173/login`) to enter the dashboard immediately with pre-seeded data.
- **Reviewer Access**: Repository access granted to:
  - `Mitrajit`
  - `Yadav036`
