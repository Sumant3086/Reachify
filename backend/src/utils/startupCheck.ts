import { logger } from './logger';

export async function performStartupChecks(): Promise<boolean> {
  const requiredEnvVars = [
    'DATABASE_URL',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD',
    'SESSION_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALLBACK_URL',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'FRONTEND_URL'
  ];

  const missing: string[] = [];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    logger.fatal({ missing }, 'Missing required environment variables');
    console.error('\n❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease check your .env file and ensure all required variables are set.\n');
    return false;
  }

  // Validate numeric values
  const numericVars = ['REDIS_PORT', 'SMTP_PORT', 'PORT'];
  for (const envVar of numericVars) {
    const value = process.env[envVar];
    if (value && isNaN(parseInt(value))) {
      logger.fatal({ envVar, value }, 'Invalid numeric environment variable');
      console.error(`\n❌ ${envVar} must be a valid number, got: ${value}\n`);
      return false;
    }
  }

  // Validate URLs
  const urlVars = ['DATABASE_URL', 'FRONTEND_URL', 'GOOGLE_CALLBACK_URL'];
  for (const envVar of urlVars) {
    const value = process.env[envVar];
    if (value) {
      try {
        new URL(value);
      } catch {
        logger.fatal({ envVar, value }, 'Invalid URL format');
        console.error(`\n❌ ${envVar} must be a valid URL, got: ${value}\n`);
        return false;
      }
    }
  }

  logger.info('All startup checks passed');
  return true;
}
