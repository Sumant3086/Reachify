# 🚀 Quick Start - ReachInbox Email Scheduler

## ⚠️ IMPORTANT: Fix Redis First

Your Upstash Redis hit the 500,000 request limit. Choose one option:

### Option 1: New Upstash Redis (Recommended)
1. Go to https://console.upstash.com/ → Create Database
2. Copy endpoint, password, port
3. Update `backend/.env`:
   ```env
   REDIS_HOST=your-new-endpoint.upstash.io
   REDIS_PASSWORD=your-new-password
   REDIS_PORT=6379
   ```

### Option 2: Local Redis
- **Windows:** Download from https://github.com/microsoftarchive/redis/releases
- **macOS:** `brew install redis && brew services start redis`
- **Linux:** `sudo apt install redis-server && sudo systemctl start redis`

Then update `backend/.env`:
```env
REDIS_HOST=localhost
REDIS_PASSWORD=
REDIS_PORT=6379
```

---

## Run Locally

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Browser:** http://localhost:3000

---

## Test the App

1. Create `test.csv`:
   ```
   email,name
   test1@example.com,John
   test2@example.com,Jane
   ```
2. Login with Google
3. Upload CSV
4. Compose email with `{{name}}` placeholder
5. Set schedule time
6. Click "Schedule Emails"

---

## Troubleshooting

**Port in use:**
```bash
netstat -ano | findstr :10000
taskkill /PID <PID> /F
```

**Backend won't start:**
- Check Redis is fixed
- Wait 10-20 seconds for database

**OAuth fails:**
- Wait for backend to fully start
- Use `http://localhost:3000` (not 127.0.0.1)

---

## Features

✅ Google OAuth • CSV upload • Email personalization  
✅ BullMQ scheduling • Rate limiting • Real-time updates  
✅ Survives restarts • No duplicates • Production-ready

**Tech:** TypeScript, Express, React, BullMQ, PostgreSQL, Redis

See `README.md` for architecture details.
