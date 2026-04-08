import { describe, it, expect } from 'vitest';
import { parseCSVWithHeaders, personalizeEmail } from '../services/emailPersonalization';

describe('Email Personalization', () => {
  describe('parseCSVWithHeaders', () => {
    it('should parse CSV with headers', () => {
      const csv = 'email,name,company\ntest@example.com,John,Acme\njane@example.com,Jane,Corp';
      const result = parseCSVWithHeaders(csv);
      
      expect(result.emails.length).toBeGreaterThanOrEqual(2);
      expect(result.emails).toContain('test@example.com');
      expect(result.emails).toContain('jane@example.com');
    });

    it('should handle plain email list', () => {
      const csv = 'test@example.com\njane@example.com';
      const result = parseCSVWithHeaders(csv);
      
      expect(result.emails.length).toBeGreaterThanOrEqual(2);
      expect(result.emails).toContain('test@example.com');
      expect(result.emails).toContain('jane@example.com');
    });

    it('should deduplicate emails', () => {
      const csv = 'email\ntest@example.com\ntest@example.com';
      const result = parseCSVWithHeaders(csv);
      
      expect(result.emails).toHaveLength(1);
      expect(result.emails[0]).toBe('test@example.com');
    });
  });

  describe('personalizeEmail', () => {
    it('should replace placeholders', () => {
      const template = 'Hello {{name}}, welcome to {{company}}!';
      const data = { name: 'John', company: 'Acme' };
      const result = personalizeEmail(template, data);
      
      expect(result).toBe('Hello John, welcome to Acme!');
    });

    it('should handle missing data', () => {
      const template = 'Hello {{name}}!';
      const data = {};
      const result = personalizeEmail(template, data);
      
      expect(result).toBe('Hello !');
    });

    it('should be case insensitive', () => {
      const template = 'Hello {{NAME}}!';
      const data = { name: 'John' };
      const result = personalizeEmail(template, data);
      
      expect(result).toBe('Hello John!');
    });
  });
});
