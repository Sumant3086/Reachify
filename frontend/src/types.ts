export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

export interface ScheduledEmail {
  id: string;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  status: string;
}

export interface SentEmail {
  id: string;
  recipient_email: string;
  subject: string;
  body: string;
  sent_at: string;
  status: string;
  error_message?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
}
