/**
 * Email Tracking Utilities
 * Adds open tracking pixels and click tracking to emails
 */

const BACKEND_URL = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'https://reachify-backend-jep1.onrender.com';

/**
 * Add tracking pixel to email body for open tracking
 */
export function addOpenTracking(body: string, emailId: string): string {
  const trackingPixel = `<img src="${BACKEND_URL}/track/open/${emailId}" width="1" height="1" style="display:none;border:0;" alt="" />`;
  
  // Add pixel at the end of the body
  return body + trackingPixel;
}

/**
 * Replace all links in email with tracking URLs for click tracking
 */
export function addClickTracking(body: string, emailId: string): string {
  // Match all href attributes in anchor tags
  const hrefRegex = /href=["']([^"']+)["']/gi;
  
  return body.replace(hrefRegex, (match, url) => {
    // Skip if it's already a tracking URL or an anchor link
    if (url.startsWith('#') || url.includes('/track/click/')) {
      return match;
    }
    
    // Create tracking URL
    const trackingUrl = `${BACKEND_URL}/track/click/${emailId}?url=${encodeURIComponent(url)}`;
    return `href="${trackingUrl}"`;
  });
}

/**
 * Add unsubscribe link to email footer
 */
export function addUnsubscribeLink(body: string, emailId: string): string {
  const unsubscribeUrl = `${BACKEND_URL}/track/unsubscribe/${emailId}`;
  
  const footer = `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <p style="color: #718096; font-size: 12px; margin: 0 0 8px 0;">
        You're receiving this email because you subscribed to our mailing list.
      </p>
      <p style="color: #718096; font-size: 12px; margin: 0;">
        Don't want these emails? <a href="${unsubscribeUrl}" style="color: #4299e1; text-decoration: underline;">Unsubscribe</a>
      </p>
    </div>
  `;
  
  return body + footer;
}

/**
 * Add all tracking features to email
 */
export function addEmailTracking(body: string, emailId: string, options: {
  trackOpens?: boolean;
  trackClicks?: boolean;
  addUnsubscribe?: boolean;
} = {}): string {
  const {
    trackOpens = true,
    trackClicks = true,
    addUnsubscribe = true
  } = options;
  
  let trackedBody = body;
  
  // Add click tracking first (modifies links)
  if (trackClicks) {
    trackedBody = addClickTracking(trackedBody, emailId);
  }
  
  // Add unsubscribe link
  if (addUnsubscribe) {
    trackedBody = addUnsubscribeLink(trackedBody, emailId);
  }
  
  // Add open tracking pixel last
  if (trackOpens) {
    trackedBody = addOpenTracking(trackedBody, emailId);
  }
  
  return trackedBody;
}

/**
 * Check if email is unsubscribed
 */
export async function isUnsubscribed(email: string, userId: string, pool: any): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT 1 FROM unsubscribes WHERE email = $1 AND user_id = $2',
      [email, userId]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Validate email before sending
 */
export function validateEmailFormat(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(email)) {
    return false;
  }
  
  // Check for disposable email domains
  const disposableDomains = [
    'tempmail.com', '10minutemail.com', 'guerrillamail.com',
    'mailinator.com', 'throwaway.email', 'temp-mail.org'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (disposableDomains.includes(domain)) {
    return false;
  }
  
  return true;
}
