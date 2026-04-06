import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,              // max pool connections
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 20_000  // Increased for remote DB
      }
    : {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000
      }
);

pool.on('error', (err) => console.error('Unexpected pool error:', err.message));

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS emails (
        id          VARCHAR(36)  PRIMARY KEY,
        user_email  VARCHAR(255) NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        subject     VARCHAR(500) NOT NULL,
        body        TEXT         NOT NULL,
        scheduled_at TIMESTAMP   NOT NULL,
        sent_at     TIMESTAMP    NULL,
        status      VARCHAR(20)  DEFAULT 'scheduled',
        error_message TEXT       NULL,
        created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Indexes for the three most common query patterns
    await client.query(`CREATE INDEX IF NOT EXISTS idx_emails_status        ON emails(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at  ON emails(scheduled_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_emails_user_status   ON emails(user_email, status)`);
  } finally {
    client.release();
  }
}
