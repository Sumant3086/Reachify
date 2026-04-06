# ReachInbox Email Scheduler

Production-grade email scheduler built for the ReachInbox hiring assignment.

**Live Demo:** https://reachinboxa.onrender.com  
**Backend API:** https://reachinbox-assignment-4fx6.onrender.com  
**GitHub:** https://github.com/Sumant3086/ReachInbox_Assignment

> Free tier services may take ~60 seconds to wake up on first request.

---

## ⚠️ Running Locally

**Redis Issue:** Upstash Redis free tier exceeded. See `START_HERE.md` for quick fix.

---

## Architecture

### How Scheduling Works
- User uploads a CSV/TXT file of email addresses via the frontend
- Backend parses emails, stores each one in PostgreSQL with a unique UUID
- Each email is added to BullMQ as a **delayed job** — delay calculated from `startTime + (index × delayBetweenEmails)`
- BullMQ stores jobs in Redis with the delay — no cron, no polling
- Worker picks up jobs when their delay expires and sends via Ethereal SMTP

### How Persistence on Restart Works
- Every email job uses `jobId = emailId` (UUID from PostgreSQL)
- On server startup, `reEnqueuePendingEmails()` queries all `status = 'scheduled'` rows from DB
- Each is re-added to BullMQ with `jobId = emailId` — BullMQ **silently ignores duplicates** if the job already exists in Redis
- This means: if the server restarts before a job fires, it gets re-queued with the correct remaining delay
- If Redis also lost the job (e.g. Redis restart), the DB is the source of truth and re-enqueues it
- Jobs already sent (`status = 'sent'`) are never re-queued — **no duplicates**

### How Rate Limiting Works
- Redis key: `rate:{YYYY-MM-DDTHH}:{senderEmail}` — one counter per sender per hour
- Before sending, worker calls `checkRateLimit()` — reads the counter, returns false if `>= limit`
- If limit exceeded: job is **rescheduled** to the start of the next hour (not dropped)
- After successful send: `incrementRateLimit()` atomically increments the counter with TTL aligned to hour boundary
- Safe across multiple workers — Redis atomic operations prevent race conditions
- Limit is configurable via `MAX_EMAILS_PER_HOUR` env var

### Behavior Under Load (1000+ emails)
- All 1000 emails are inserted into PostgreSQL in a single batch query
- All 1000 BullMQ jobs are queued with staggered delays (`i × delayMs`)
- Worker processes them with configurable concurrency (`WORKER_CONCURRENCY`)
- BullMQ limiter enforces `max: 1` job per `EMAIL_DELAY_MS` window across all workers
- When hourly limit is hit, excess jobs are rescheduled to next hour — order preserved as much as possible

### Delay Between Emails
- Minimum **2 seconds** between sends (`EMAIL_DELAY_MS=2000`)
- Enforced two ways: `setTimeout(EMAIL_DELAY_MS)` in worker + BullMQ `limiter: { max: 1, duration: EMAIL_DELAY_MS }`

---

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (or use Render's free PostgreSQL)
- Redis (or use Upstash free tier)

### 1. Clone
```bash
git clone https://github.com/Sumant3086/ReachInbox_Assignment.git
cd ReachInbox_Assignment
```

### 2. Backend
```bash
cd backend
npm install
```

Create `backend/.env`:
```env
DATABASE_URL=postgresql://user:pass@host/dbname
EMAIL_DELAY_MS=2000
FRONTEND_URL=http://localhost:3000
GOOGLE_CALLBACK_URL=http://localhost:10000/auth/google/callback
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MAX_EMAILS_PER_HOUR=200
NODE_ENV=development
PORT=10000
REDIS_HOST=your-redis-host
REDIS_PASSWORD=your-redis-password
REDIS_PORT=6379
SESSION_SECRET=any-random-string
SMTP_HOST=smtp.ethereal.email
SMTP_PASS=your-ethereal-pass
SMTP_PORT=587
SMTP_USER=your-ethereal-user
WORKER_CONCURRENCY=5
```

```bash
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### 4. Ethereal Email Setup
1. Go to https://ethereal.email/create
2. Copy the generated username and password into `SMTP_USER` and `SMTP_PASS`
3. View sent emails at https://ethereal.email/messages

### 5. Google OAuth Setup
1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `http://localhost:10000/auth/google/callback`
4. Copy Client ID and Secret into `.env`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /auth/google | Start Google OAuth |
| GET | /auth/google/callback | OAuth callback |
| GET | /auth/user | Get current user |
| POST | /auth/logout | Logout |
| POST | /api/emails/schedule | Schedule emails (multipart/form-data) |
| GET | /api/emails/scheduled | Get scheduled emails |
| GET | /api/emails/sent | Get sent/failed emails |
| GET | /health | Health check |

### POST /api/emails/schedule
```
Content-Type: multipart/form-data

subject          string   Email subject
body             string   Email body
file             File     CSV or TXT file with email addresses
startTime        string   ISO datetime for first email
delayBetweenEmails number Seconds between each email
hourlyLimit      number   Max emails per hour
```

---

## Features Implemented

### Backend
- ✅ BullMQ delayed jobs (no cron)
- ✅ PostgreSQL storage with batch inserts
- ✅ Persistence on restart via DB re-enqueue
- ✅ Idempotency via jobId = emailId
- ✅ Redis-backed rate limiting per sender per hour
- ✅ Rescheduling to next hour when limit exceeded (no drops)
- ✅ Configurable worker concurrency
- ✅ Configurable delay between sends
- ✅ BullMQ limiter for cross-worker throttling
- ✅ Exponential backoff on failure (3 retries)
- ✅ Stalled job detection and recovery
- ✅ Google OAuth via Passport.js
- ✅ Redis-backed session store (survives restarts)
- ✅ Ethereal Email SMTP

### Frontend
- ✅ Real Google OAuth login
- ✅ Header with name, email, avatar, logout
- ✅ Scheduled Emails tab with table + empty state
- ✅ Sent Emails tab with table + empty state
- ✅ Compose modal with CSV upload + email count
- ✅ Start time, delay, hourly limit inputs
- ✅ Loading states and error messages
- ✅ Auto-refresh every 10 seconds
- ✅ TypeScript throughout

---

## Project Structure

```
backend/src/
├── config/
│   ├── database.ts    # PostgreSQL pool + table init
│   ├── passport.ts    # Google OAuth strategy
│   └── redis.ts       # ioredis client
├── middleware/
│   └── auth.ts        # isAuthenticated guard
├── queue/
│   └── emailQueue.ts  # BullMQ queue + worker + rate limiting
├── routes/
│   ├── auth.ts        # OAuth routes
│   └── emails.ts      # Schedule/list endpoints
├── services/
│   └── emailService.ts # Nodemailer/Ethereal
└── server.ts          # Express app

frontend/src/
├── components/
│   ├── ComposeModal.tsx
│   └── Header.tsx
├── pages/
│   ├── Dashboard.tsx
│   └── Login.tsx
├── api.ts             # Axios client
├── types.ts           # TypeScript interfaces
└── App.tsx
```

---

## Assumptions & Trade-offs

- **Single global rate limit** (not per-sender) — sufficient for the assignment scope; per-sender would just change the Redis key
- **In-memory deduplication** of emails in uploaded file — prevents scheduling duplicates within a single batch
- **Ethereal SMTP** — emails are not actually delivered, viewable at ethereal.email/messages
- **Free tier cold starts** — Render free tier sleeps after 15min inactivity; keep-alive ping every 14min mitigates this
- **Session store in Redis** — sessions survive backend restarts, no re-login needed
