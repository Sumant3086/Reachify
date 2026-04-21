import { Pool } from 'pg';
import { logger } from '../utils/logger';

interface Migration {
  version: number;
  name: string;
  up: (pool: Pool) => Promise<void>;
  down: (pool: Pool) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: async (pool: Pool) => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255),
          avatar TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    },
    down: async (pool: Pool) => {
      await pool.query('DROP TABLE IF EXISTS users CASCADE');
    }
  },
  {
    version: 2,
    name: 'add_webhook_support',
    up: async (pool: Pool) => {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS webhook_url TEXT,
        ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255)
      `);
    },
    down: async (pool: Pool) => {
      await pool.query(`
        ALTER TABLE users 
        DROP COLUMN IF EXISTS webhook_url,
        DROP COLUMN IF EXISTS webhook_secret
      `);
    }
  },
  {
    version: 3,
    name: 'add_email_tracking',
    up: async (pool: Pool) => {
      await pool.query(`
        ALTER TABLE emails 
        ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS bounced BOOLEAN DEFAULT FALSE
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_emails_opened 
        ON emails(opened_at) WHERE opened_at IS NOT NULL
      `);
      
      // Email opens tracking table
      await pool.query(`
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
      await pool.query(`
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
      await pool.query(`
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
      
      // Contacts table
      await pool.query(`
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
      
      // Indexes
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_opens_email_id ON email_opens(email_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_clicks_email_id ON email_clicks(email_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_clicks_url ON email_clicks(url)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_unsubscribes_email ON unsubscribes(email)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_unsubscribes_user_id ON unsubscribes(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_contacts_user_email ON contacts(user_id, email)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_contacts_subscribed ON contacts(subscribed) WHERE subscribed = true`);
    },
    down: async (pool: Pool) => {
      await pool.query('DROP TABLE IF EXISTS email_opens CASCADE');
      await pool.query('DROP TABLE IF EXISTS email_clicks CASCADE');
      await pool.query('DROP TABLE IF EXISTS unsubscribes CASCADE');
      await pool.query('DROP TABLE IF EXISTS contacts CASCADE');
      await pool.query(`
        ALTER TABLE emails 
        DROP COLUMN IF EXISTS opened_at,
        DROP COLUMN IF EXISTS open_count,
        DROP COLUMN IF EXISTS last_opened_at,
        DROP COLUMN IF EXISTS clicked_at,
        DROP COLUMN IF EXISTS click_count,
        DROP COLUMN IF EXISTS last_clicked_at,
        DROP COLUMN IF EXISTS bounced
      `);
    }
  }
];

export async function runMigrations(pool: Pool): Promise<void> {
  // Create migrations table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get current version
  const result = await pool.query(
    'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1'
  );
  
  const currentVersion = result.rows[0]?.version || 0;
  logger.info({ currentVersion }, 'Current database version');

  // Run pending migrations
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      logger.info({ 
        version: migration.version, 
        name: migration.name 
      }, 'Running migration');

      try {
        await migration.up(pool);
        await pool.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name]
        );
        logger.info({ 
          version: migration.version, 
          name: migration.name 
        }, 'Migration completed');
      } catch (error: any) {
        logger.error({ 
          error: error.message, 
          version: migration.version 
        }, 'Migration failed');
        throw error;
      }
    }
  }
}

export async function rollbackMigration(pool: Pool, targetVersion: number): Promise<void> {
  const result = await pool.query(
    'SELECT version FROM schema_migrations ORDER BY version DESC'
  );
  
  const versions = result.rows.map(r => r.version);
  
  for (const version of versions) {
    if (version > targetVersion) {
      const migration = migrations.find(m => m.version === version);
      if (migration) {
        logger.info({ version, name: migration.name }, 'Rolling back migration');
        await migration.down(pool);
        await pool.query('DELETE FROM schema_migrations WHERE version = $1', [version]);
      }
    }
  }
}
