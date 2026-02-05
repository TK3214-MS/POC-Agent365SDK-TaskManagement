import { describe, it, expect } from 'vitest';
import {
  sanitizeTranscript,
  sanitizeAttendees,
  sanitizeText,
  sanitizeObject,
} from '@/utils/pii-filter.util';

// Mock env to enable PII filtering
import { vi } from 'vitest';
vi.mock('@/config/env', () => ({
  env: {
    piiFilterEnabled: true,
  },
}));

describe('PII Filter Utility', () => {
  describe('sanitizeTranscript', () => {
    it('should redact transcript with word and character count', () => {
      const transcript = 'This is a sensitive meeting transcript with personal information.';
      const result = sanitizeTranscript(transcript);

      expect(result).toContain('[REDACTED:');
      expect(result).toContain('words');
      expect(result).toContain('characters');
      expect(result).not.toContain('sensitive');
    });
  });

  describe('sanitizeAttendees', () => {
    it('should replace attendee names with placeholders', () => {
      const attendees = ['Alice Johnson', 'Bob Smith', 'Charlie Brown'];
      const result = sanitizeAttendees(attendees);

      expect(result).toEqual(['Attendee-1', 'Attendee-2', 'Attendee-3']);
    });
  });

  describe('sanitizeText', () => {
    it('should truncate long text', () => {
      const longText = 'a'.repeat(200);
      const result = sanitizeText(longText, 50);

      expect(result.length).toBeLessThan(longText.length);
      expect(result).toContain('[TRUNCATED]');
    });

    it('should not truncate short text', () => {
      const shortText = 'Short text';
      const result = sanitizeText(shortText, 50);

      expect(result).toBe(shortText);
    });
  });

  describe('sanitizeObject', () => {
    it('should redact sensitive keys', () => {
      const obj = {
        meetingTitle: 'Q1 Planning',
        meetingTranscript: 'Sensitive content here',
        password: 'secret123',
        normalField: 'Safe content',
      };

      const result = sanitizeObject(obj);

      expect(result.meetingTitle).toBe('Q1 Planning');
      expect(result.meetingTranscript).toBe('[REDACTED]');
      expect(result.password).toBe('[REDACTED]');
      expect(result.normalField).toBe('Safe content');
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          name: 'Alice',
          secret: 'hidden',
        },
        meetingTranscript: 'Sensitive',
      };

      const result = sanitizeObject(obj);

      expect((result.user as Record<string, unknown>).name).toBe('Alice');
      expect((result.user as Record<string, unknown>).secret).toBe('[REDACTED]');
      expect(result.meetingTranscript).toBe('[REDACTED]');
    });

    it('should handle arrays', () => {
      const obj = {
        items: [
          { text: 'Item 1', token: 'abc123' },
          { text: 'Item 2', token: 'xyz789' },
        ],
      };

      const result = sanitizeObject(obj);
      const items = result.items as Array<Record<string, unknown>>;

      expect(items[0]?.text).toBe('Item 1');
      expect(items[0]?.token).toBe('[REDACTED]');
      expect(items[1]?.text).toBe('Item 2');
      expect(items[1]?.token).toBe('[REDACTED]');
    });
  });
});
