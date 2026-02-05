import { env } from '../config/env.js';

/**
 * PII (Personally Identifiable Information) filter utility
 */

/**
 * Sanitize meeting transcript for logging/tracing
 * Replaces the full transcript with a summary to avoid PII leakage
 */
export function sanitizeTranscript(transcript: string): string {
  if (!env.piiFilterEnabled) {
    return transcript;
  }

  const wordCount = transcript.split(/\s+/).length;
  const charCount = transcript.length;

  return `[REDACTED: ${wordCount} words, ${charCount} characters]`;
}

/**
 * Sanitize attendee names
 * Replaces names with placeholders
 */
export function sanitizeAttendees(attendees: string[]): string[] {
  if (!env.piiFilterEnabled) {
    return attendees;
  }

  return attendees.map((_, index) => `Attendee-${index + 1}`);
}

/**
 * Sanitize any arbitrary text that may contain PII
 */
export function sanitizeText(text: string, maxLength = 100): string {
  if (!env.piiFilterEnabled) {
    return text;
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.substring(0, maxLength)}... [TRUNCATED]`;
}

/**
 * Sanitize object for logging (recursively remove sensitive fields)
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  sensitiveKeys: string[] = ['transcript', 'meetingTranscript', 'password', 'secret', 'token']
): Record<string, unknown> {
  if (!env.piiFilterEnabled) {
    return obj;
  }

  const sanitized: Record<string, unknown> = {};
  const lowerSensitiveKeys = sensitiveKeys.map((k) => k.toLowerCase());

  for (const [key, value] of Object.entries(obj)) {
    if (lowerSensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, sensitiveKeys);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? sanitizeObject(item as Record<string, unknown>, sensitiveKeys)
          : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
