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
        ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS bounced BOOLEAN DEFAULT FALSE
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_emails_opened 
        ON emails(opened_at) WHERE opened_at IS NOT NULL
      `);
    },
    down: async (pool: Pool) => {
      await pool.query(`
        ALTER TABLE emails 
        DROP COLUMN IF EXISTS opened_at,
        DROP COLUMN IF EXISTS clicked_at,
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
