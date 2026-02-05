import { describe, it, expect } from 'vitest';
import { RequestPayloadSchema } from '@/schemas/request.schema';

describe('RequestPayloadSchema', () => {
  it('should validate a valid payload', () => {
    const validPayload = {
      meetingTitle: 'Q1 Planning Meeting',
      meetingDateTime: '2026-02-05T10:00:00Z',
      attendees: ['Alice', 'Bob'],
      meetingTranscript: 'Alice: We need to finalize the Q1 roadmap...',
      policy: {
        defaultDueDays: 7,
        requireApproval: true,
        allowAutoNotify: false,
      },
      outputLanguage: 'ja-JP',
      approve: false,
    };

    const result = RequestPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should apply default values for optional fields', () => {
    const minimalPayload = {
      meetingTitle: 'Quick Sync',
      meetingTranscript: 'Short discussion.',
    };

    const result = RequestPayloadSchema.parse(minimalPayload);
    expect(result.attendees).toEqual([]);
    expect(result.outputLanguage).toBe('ja-JP');
    expect(result.approve).toBe(false);
    expect(result.policy.defaultDueDays).toBe(7);
  });

  it('should reject payload with missing required fields', () => {
    const invalidPayload = {
      meetingTitle: 'Test',
      // meetingTranscript is missing
    };

    const result = RequestPayloadSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });
});
