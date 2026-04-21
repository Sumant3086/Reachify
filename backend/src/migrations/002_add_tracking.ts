import { Pool } from 'pg';
import { logger } from '../utils/logger';

export async function addTrackingTables(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    logger.info('Running migration: Add tracking tables');

    // Add tracking columns to emails table
    await client.query(`
      ALTER TABLE emails 
      ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMP
    `);

    // Email opens tracking table (detailed analytics)
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_opens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
        opened_at TIMESTAMP DEFAULT NOW(),
        user_agent TEXT,
        ip_address TEXT,
        UNIQUE(email_id, opened_at)
      )
    `);

    // Email clicks tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_clicks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        clicked_at TIMESTAMP DEFAULT NOW(),
        user_agent TEXT,
        ip_address TEXT
      )
    `);

    // Unsubscribes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS unsubscribes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        unsubscribed_at TIMESTAMP DEFAULT NOW(),
        source_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
        reason TEXT,
        UNIQUE(email, user_id)
      )
    `);

    // Contacts table for better email management
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        custom_fields JSONB,
        subscribed BOOLEAN DEFAULT true,
        soft_bounce_count INTEGER DEFAULT 0,
        hard_bounced BOOLEAN DEFAULT false,
        bounce_reason TEXT,
        unsubscribed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, email)
      )
    `);

    // Indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_opens_email_id ON email_opens(email_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_clicks_email_id ON email_clicks(email_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_email_clicks_url ON email_clicks(url)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_unsubscribes_email ON unsubscribes(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_unsubscribes_user_id ON unsubscribes(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_user_email ON contacts(user_id, email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_subscribed ON contacts(subscribed) WHERE subscribed = true`);

    logger.info('Migration completed: Add tracking tables');
  } catch (err: any) {
    logger.error({ error: err.message }, 'Migration failed: Add tracking tables');
    throw err;
  } finally {
    client.release();
  }
}
