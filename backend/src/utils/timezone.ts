/**
 * Convert user's local time to UTC for storage
 */
export function toUTC(localTime: string, timezone: string): Date {
  // In production, use a library like date-fns-tz or luxon
  // For now, simple implementation
  const date = new Date(localTime);
  return date;
}

/**
 * Convert UTC time to user's local timezone
 */
export function fromUTC(utcTime: Date, timezone: string): string {
  // In production, use proper timezone conversion
  return utcTime.toISOString();
}

/**
 * Get user's timezone from request or default to UTC
 */
export function getUserTimezone(req: any): string {
  return req.headers['x-timezone'] || 'UTC';
}

/**
 * Validate timezone string
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
