import { z } from 'zod';

/**
 * Policy schema for meeting processing
 */
export const PolicySchema = z.object({
  defaultDueDays: z.number().int().positive().default(7),
  requireApproval: z.boolean().default(true),
  allowAutoNotify: z.boolean().default(false),
});

export type Policy = z.infer<typeof PolicySchema>;

/**
 * Request payload schema for POST /api/messages
 * Sent from Copilot Studio to the external agent
 */
export const RequestPayloadSchema = z.object({
  meetingTitle: z.string().min(1),
  meetingDateTime: z.string().optional(),
  attendees: z.array(z.string()).default([]),
  meetingTranscript: z.string().min(1),
  policy: PolicySchema.optional().default({}),
  outputLanguage: z.string().default('ja-JP'),
  approve: z.boolean().default(false),
});

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;
