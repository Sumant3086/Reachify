import { describe, it, expect } from 'vitest';
import { isValidEmail, sanitizeHtml } from '../utils/validation';

describe('Validation Utils', () => {
  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('<script>');
      expect(output).toContain('<p>Hello</p>');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert()">Click</div>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('onclick');
    });

    it('should remove javascript: protocol', () => {
      const input = '<a href="javascript:alert()">Link</a>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('javascript:');
    });
  });
});
