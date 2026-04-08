# 🏗️ Reachify - System Architecture Documentation

## Table of Contents
1. [High-Level Architecture](#high-level-architecture)
2. [Component Design](#component-design)
3. [Data Flow](#data-flow)
4. [Scalability Strategy](#scalability-strategy)
5. [Security Architecture](#security-architecture)
6. [Monitoring & Observability](#monitoring--observability)

---

## High-Level Architecture

### System Overview
Reachify follows a **microservices-inspired monolithic architecture** with clear separation of concerns, designed for horizontal scalability and eventual service decomposition.

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Browser    │  │   Mobile     │  │  External    │     │
│  │   (React)    │  │   (Future)   │  │  API Clients │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   API GATEWAY LAYER                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Express.js + Middleware Stack                       │  │
│  │  • CORS • Helmet • Rate Limiting • Auth • RBAC       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Auth       │   │   Email      │   │   Payment    │
│   Service    │   │   Service    │   │   Service    │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATA LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ PostgreSQL   │  │    Redis     │  │   BullMQ     │     │
│  │  (Primary)   │  │ (Cache/Sess) │  │ (Job Queue)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 EXTERNAL SERVICES                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   SMTP       │  │   Google     │  │  Razorpay    │     │
│  │  (Resend)    │  │   OAuth      │  │  (Payments)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. Frontend Architecture (React SPA)

```
src/
├── pages/              # Route-level components
│   ├── Home.tsx        # Landing page
│   ├── Login.tsx       # OAuth login
│   └── Dashboard.tsx   # Main application
│
├── components/         # Reusable UI components
│   ├── ComposeModal.tsx        # Email composition
│   ├── TemplatesModal.tsx      # Template management
│   ├── AnalyticsDashboard.tsx  # Charts & metrics
│   ├── EmailPreviewModal.tsx   # Preview before send
│   └── PaymentModal.tsx        # Razorpay integration
│
├── hooks/              # Custom React hooks
│   ├── useWebSocket.ts         # Real-time updates
│   ├── useDarkMode.ts          # Theme management
│   ├── useNotification.ts      # Toast notifications
│   └── useOptimistic.ts        # Optimistic UI updates
│
├── utils/              # Helper functions
│   ├── errorBoundary.tsx       # Error handling
│   ├── lazyLoad.ts             # Code splitting
│   └── performance.ts          # Performance monitoring
│
└── api.ts              # Axios client with interceptors
```

**Key Design Patterns:**
- **Container/Presentational**: Dashboard (container) + Components (presentational)
- **Custom Hooks**: Encapsulate stateful logic (WebSocket, dark mode)
- **Error Boundaries**: Graceful error handling
- **Lazy Loading**: Code splitting for performance
- **Optimistic Updates**: Instant UI feedback

### 2. Backend Architecture (Express.js)

```
src/
├── config/             # Configuration modules
│   ├── database.ts     # PostgreSQL connection pool
│   ├── redis.ts        # Redis client with fallback
│   └── passport.ts     # OAuth strategy
│
├── middleware/         # Express middleware
│   ├── auth.ts         # Authentication check
│   ├── rbac.ts         # Role-based access control
│   ├── errorHandler.ts # Global error handling
│   ├── requestLogger.ts# Request logging
│   └── timeout.ts      # Request timeout
│
├── routes/             # API endpoints
│   ├── auth.ts         # /auth/* routes
│   ├── emails.ts       # /emails/* routes
│   └── payment.ts      # /payment/* routes
│
├── services/           # Business logic
│   ├── emailService.ts         # SMTP operations
│   ├── emailPersonalization.ts # Template processing
│   └── webhookService.ts       # Webhook delivery
│
├── queue/              # Async job processing
│   └── emailQueue.ts   # BullMQ worker
│
├── utils/              # Utilities
│   ├── logger.ts       # Pino structured logging
│   ├── metrics.ts      # Performance metrics
│   ├── healthCheck.ts  # Health endpoint
│   └── validation.ts   # Input validation
│
└── server.ts           # Application entry point
```

**Key Design Patterns:**
- **Layered Architecture**: Routes → Services → Data Access
- **Dependency Injection**: Pass dependencies explicitly
- **Repository Pattern**: Database access abstraction
- **Circuit Breaker**: Resilience for external services
- **Factory Pattern**: Redis client creation with fallback

---

## Data Flow

### Email Scheduling Flow

```
1. User uploads CSV file
   │
   ▼
2. Frontend validates file (size, format)
   │
   ▼
3. POST /emails/schedule with FormData
   │
   ▼
4. Backend middleware chain:
   ├─ Authentication (session check)
   ├─ RBAC (check canBulkSend permission)
   ├─ Rate limiting (global + user-specific)
   └─ Input validation (express-validator)
   │
   ▼
5. Parse CSV and extract recipients
   │
   ▼
6. Personalization service:
   ├─ Detect duplicate emails
   ├─ Validate email addresses
   └─ Replace {{variables}} with CSV data
   │
   ▼
7. Insert email records into PostgreSQL
   │
   ▼
8. Enqueue jobs to BullMQ
   │
   ▼
9. Return response to frontend
   │
   ▼
10. WebSocket emits real-time update
```

### Email Processing Flow (Worker)

```
1. BullMQ worker picks job from queue
   │
   ▼
2. Check per-user rate limit (Redis)
   │
   ├─ Limit exceeded → Delay job
   │
   └─ Limit OK → Continue
       │
       ▼
3. Send email via Nodemailer (SMTP)
   │
   ├─ Success → Update status to 'sent'
   │            Increment rate limit counter
   │            Trigger webhook (async)
   │            Emit WebSocket event
   │
   └─ Failure → Retry (3 attempts, exponential backoff)
                Update status to 'failed' after max retries
                Trigger webhook (async)
                Emit WebSocket event
```

### Authentication Flow (OAuth)

```
1. User clicks "Login with Google"
   │
   ▼
2. Redirect to /auth/google
   │
   ▼
3. Passport.js initiates OAuth flow
   │
   ▼
4. Google authorization page
   │
   ▼
5. User grants permission
   │
   ▼
6. Redirect to /auth/google/callback
   │
   ▼
7. Passport verifies OAuth token
   │
   ▼
8. Upsert user in PostgreSQL
   │
   ▼
9. Create session in Redis
   │
   ▼
10. Redirect to /dashboard
```

---

## Scalability Strategy

### Horizontal Scaling

**Current Architecture (Single Instance)**
```
┌─────────────────────────────────────┐
│  Express Server (Port 3001)         │
│  ├─ API Routes                      │
│  ├─ WebSocket Server                │
│  └─ BullMQ Worker (10 concurrent)   │
└─────────────────────────────────────┘
         │              │
         ▼              ▼
   PostgreSQL        Redis
```

**Scaled Architecture (Multiple Instances)**
```
┌──────────────┐
│ Load Balancer│ (Nginx/HAProxy)
└──────────────┘
       │
   ┌───┴───┬───────┬───────┐
   ▼       ▼       ▼       ▼
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ API │ │ API │ │ API │ │ API │  (Stateless)
│ Node│ │ Node│ │ Node│ │ Node│
└─────┘ └─────┘ └─────┘ └─────┘
   │       │       │       │
   └───────┴───────┴───────┘
           │
       ┌───┴───┐
       ▼       ▼
   ┌─────┐ ┌─────┐
   │ PG  │ │Redis│ (Shared state)
   └─────┘ └─────┘
       │
   ┌───┴───┬───────┬───────┐
   ▼       ▼       ▼       ▼
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│Work │ │Work │ │Work │ │Work │  (Dedicated workers)
│ er  │ │ er  │ │ er  │ │ er  │
└─────┘ └─────┘ └─────┘ └─────┘
```

### Scaling Strategies

**1. Database Scaling**
- **Read Replicas**: Separate read/write connections
- **Connection Pooling**: Already implemented (max 20)
- **Indexing**: Optimized indexes on user_id, status, scheduled_at
- **Partitioning**: Partition emails table by date (future)

**2. Cache Scaling**
- **Redis Cluster**: Distribute cache across nodes
- **Cache Warming**: Pre-populate frequently accessed data
- **TTL Strategy**: Aggressive expiration for stale data

**3. Queue Scaling**
- **Separate Workers**: Dedicated worker instances
- **Priority Queues**: High-priority emails first
- **Dead Letter Queue**: Handle failed jobs separately

**4. WebSocket Scaling**
- **Socket.io Redis Adapter**: Share connections across instances
- **Sticky Sessions**: Route users to same instance

---

## Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Network Security                              │
│ • HTTPS/TLS encryption                                 │
│ • CORS policies (whitelist origins)                    │
│ • Rate limiting (global: 100 req/15min)                │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Application Security                          │
│ • Helmet.js (CSP, HSTS, X-Frame-Options)               │
│ • Input validation (express-validator)                 │
│ • XSS prevention (DOMPurify)                           │
│ • SQL injection prevention (parameterized queries)     │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Authentication & Authorization                │
│ • OAuth 2.0 (Google)                                   │
│ • Session-based auth (Redis store)                     │
│ • RBAC (4 roles: FREE, PRO, ENTERPRISE, ADMIN)         │
│ • Permission-based access control                      │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Data Security                                 │
│ • Encrypted connections (PostgreSQL SSL)               │
│ • Webhook HMAC signatures (SHA-256)                    │
│ • Sensitive data in environment variables              │
│ • Data retention policies (90-day cleanup)             │
└─────────────────────────────────────────────────────────┘
```

### RBAC Implementation

```typescript
// Permission matrix
FREE:         1K emails/month,  50/hour,  No API
PROFESSIONAL: 50K emails/month, 500/hour, API + Webhooks
ENTERPRISE:   Unlimited,        Unlimited, White-label
ADMIN:        Full access to all features
```

---

## Monitoring & Observability

### Logging Strategy

```typescript
// Structured logging with Pino
{
  level: 'info',
  time: '2024-01-15T10:30:00.000Z',
  pid: 12345,
  hostname: 'server-1',
  reqId: 'uuid-v4',
  userId: 'user-123',
  msg: 'Email sent successfully',
  emailId: 'email-456',
  duration: 250
}
```

### Metrics Endpoints

**GET /health**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 86400,
  "services": {
    "database": "connected",
    "redis": "connected",
    "smtp": "connected"
  }
}
```

**GET /metrics**
```json
{
  "memory": {
    "used": "150MB",
    "total": "512MB",
    "percentage": 29.3
  },
  "queue": {
    "waiting": 45,
    "active": 10,
    "completed": 1250,
    "failed": 12
  },
  "uptime": 86400
}
```

### Observability Stack (Future)

```
┌──────────────┐
│ Application  │
└──────────────┘
       │
   ┌───┴───┬───────┬───────┐
   ▼       ▼       ▼       ▼
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│Logs │ │Trace│ │Metric│ │Alert│
└─────┘ └─────┘ └─────┘ └─────┘
   │       │       │       │
   └───────┴───────┴───────┘
           │
       ┌───┴───┐
       ▼       ▼
   ┌─────┐ ┌─────┐
   │ ELK │ │Grafana│
   └─────┘ └─────┘
```

---

## Performance Optimizations

### Frontend
- Code splitting with React.lazy()
- Virtual scrolling for large email lists
- Debounced search inputs
- Optimistic UI updates
- Service Worker for offline support (future)

### Backend
- Connection pooling (PostgreSQL)
- Redis caching (session, rate limits)
- Async job processing (BullMQ)
- Compression middleware (gzip)
- Query optimization with indexes

### Database
- Indexed columns: user_id, status, scheduled_at
- Composite indexes for common queries
- Automatic vacuum and analyze
- Connection pooling (max 20)

---

## Disaster Recovery

### Backup Strategy
- **Database**: Daily automated backups (7-day retention)
- **Redis**: AOF persistence enabled
- **Code**: Git version control

### Graceful Shutdown
```typescript
process.on('SIGTERM', async () => {
  // 1. Stop accepting new requests
  server.close();
  
  // 2. Close WebSocket connections
  io.close();
  
  // 3. Wait for active jobs to complete
  await emailWorker.close();
  
  // 4. Close database connections
  await pool.end();
  await redis.quit();
  
  // 5. Exit process
  process.exit(0);
});
```

---

**Last Updated**: January 2024  
**Version**: 1.0.0
