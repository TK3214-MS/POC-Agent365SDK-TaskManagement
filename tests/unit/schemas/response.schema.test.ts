import { describe, it, expect } from 'vitest';
import { ResponsePayloadSchema } from '@/schemas/response.schema';

describe('ResponsePayloadSchema', () => {
  it('should validate a complete response payload', () => {
    const validResponse = {
      executiveSummary: {
        progress: 'Project is on track with 80% completion',
        keyRisks: ['Budget overrun', 'Resource shortage'],
        decisionsNeeded: ['Approve additional headcount'],
      },
      decisions: [
        {
          text: 'Approved Q1 budget allocation',
          confidence: 0.95,
        },
      ],
      todos: [
        {
          text: 'Update project timeline',
          owner: 'Alice',
          dueDate: '2026-02-15',
          confidence: 0.9,
        },
      ],
      risks: [
        {
          text: 'Third-party API dependency',
          severity: 'high',
          owner: 'Bob',
          confidence: 0.85,
        },
      ],
      followUpQuestions: ['Should we escalate to leadership?'],
      draftActions: [
        {
          type: 'createTask',
          payload: { title: 'Update timeline', assignee: 'Alice' },
        },
      ],
      traceId: '1234567890abcdef',
    };

    const result = ResponsePayloadSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it('should reject invalid risk severity', () => {
    const invalidResponse = {
      executiveSummary: {
        progress: 'OK',
        keyRisks: [],
        decisionsNeeded: [],
      },
      decisions: [],
      todos: [],
      risks: [
        {
          text: 'Test risk',
          severity: 'critical', // Invalid: must be 'low', 'medium', or 'high'
          confidence: 0.8,
        },
      ],
      followUpQuestions: [],
      draftActions: [],
      traceId: 'abc',
    };

    const result = ResponsePayloadSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });
});
