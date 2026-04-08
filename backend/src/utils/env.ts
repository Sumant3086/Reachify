import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface EnvConfig {
  DATABASE_URL: string;
  REDIS_HOST: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_CALLBACK_URL: string;
  SESSION_SECRET: string;
  FRONTEND_URL: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASS: string;
  NODE_ENV: string;
  PORT: string;
}

export function validateEnv(): EnvConfig {
  const required = [
    'DATABASE_URL',
    'REDIS_HOST',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALLBACK_URL',
    'FRONTEND_URL',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    process.exit(1);
  }

  // Generate session secret if not provided
  if (!process.env.SESSION_SECRET) {
    const secretPath = path.join(__dirname, '../../.session-secret');
    
    if (fs.existsSync(secretPath)) {
      process.env.SESSION_SECRET = fs.readFileSync(secretPath, 'utf-8').trim();
    } else {
      const secret = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(secretPath, secret);
      process.env.SESSION_SECRET = secret;
      console.log('✅ Generated new session secret');
    }
  }

  console.log('✅ Environment variables validated');

  return process.env as unknown as EnvConfig;
}
