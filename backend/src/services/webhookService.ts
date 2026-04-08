import axios from 'axios';
import { logger } from '../utils/logger';
import { pool } from '../config/database';

interface WebhookPayload {
  event: 'email.sent' | 'email.failed' | 'email.scheduled';
  emailId: string;
  recipientEmail: string;
  status: string;
  timestamp: string;
  userId: string;
  error?: string;
}

export async function sendWebhook(payload: WebhookPayload): Promise<void> {
  try {
    // Get user's webhook URL from database
    const result = await pool.query(
      'SELECT webhook_url FROM users WHERE id = $1 AND webhook_url IS NOT NULL',
      [payload.userId]
    );

    if (result.rows.length === 0) {
      return; // No webhook configured
    }

    const webhookUrl = result.rows[0].webhook_url;

    // Send webhook with retry
    await axios.post(webhookUrl, payload, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-Reachify-Event': payload.event,
        'X-Reachify-Signature': generateSignature(payload)
      }
    });

    logger.info({ 
      userId: payload.userId, 
      event: payload.event, 
      emailId: payload.emailId 
    }, 'Webhook sent successfully');
  } catch (error: any) {
    logger.warn({ 
      error: error.message, 
      userId: payload.userId,
      event: payload.event 
    }, 'Webhook delivery failed');
  }
}

function generateSignature(payload: WebhookPayload): string {
  // In production, use HMAC-SHA256 with secret key
  const crypto = require('crypto');
  const secret = process.env.WEBHOOK_SECRET || 'default-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}
