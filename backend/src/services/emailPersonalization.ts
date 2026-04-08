export interface EmailData {
  [key: string]: string;
}

export function parseCSVWithHeaders(content: string): { emails: string[]; data: EmailData[] } {
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return { emails: [], data: [] };
  }

  // Try to extract all emails using regex first (fallback)
  const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const allEmailsInContent = content.match(EMAIL_REGEX) || [];
  
  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const emailIndex = headers.findIndex(h => h === 'email' || h === 'e-mail' || h === 'mail' || h.includes('email'));

  if (emailIndex === -1) {
    // No headers, treat as plain email list or use regex extracted emails
    const emails = allEmailsInContent.length > 0 ? allEmailsInContent : lines.filter(line => isValidEmail(line.trim()));
    return {
      emails: [...new Set(emails.map(e => e.toLowerCase()))],
      data: emails.map(email => ({ email: email.toLowerCase() }))
    };
  }

  // Parse data rows
  const data: EmailData[] = [];
  const emails: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const email = values[emailIndex]?.toLowerCase().trim();

    if (email && isValidEmail(email)) {
      const row: EmailData = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx]?.trim() || '';
      });
      data.push(row);
      emails.push(email);
    }
  }

  // If no emails found with headers, use regex fallback
  if (emails.length === 0 && allEmailsInContent.length > 0) {
    return {
      emails: [...new Set(allEmailsInContent.map(e => e.toLowerCase()))],
      data: allEmailsInContent.map(email => ({ email: email.toLowerCase() }))
    };
  }

  return {
    emails: [...new Set(emails)],
    data
  };
}

export function personalizeEmail(template: string, data: EmailData): string {
  let result = template;
  
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    result = result.replace(regex, data[key] || '');
  });

  return result;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}
