import { z } from 'zod';

/**
 * Executive summary schema
 */
export const ExecutiveSummarySchema = z.object({
  progress: z.string(),
  keyRisks: z.array(z.string()),
  decisionsNeeded: z.array(z.string()),
});

export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;

/**
 * Decision schema
 */
export const DecisionSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1),
});

export type Decision = z.infer<typeof DecisionSchema>;

/**
 * Todo schema
 */
export const TodoSchema = z.object({
  text: z.string(),
  owner: z.string().optional(),
  dueDate: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export type Todo = z.infer<typeof TodoSchema>;

/**
 * Risk severity enum
 */
export const RiskSeveritySchema = z.enum(['low', 'medium', 'high']);

export type RiskSeverity = z.infer<typeof RiskSeveritySchema>;

/**
 * Risk schema
 */
export const RiskSchema = z.object({
  text: z.string(),
  severity: RiskSeveritySchema,
  owner: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export type Risk = z.infer<typeof RiskSchema>;

/**
 * Draft action type enum
 */
export const DraftActionTypeSchema = z.enum(['notify', 'createTask', 'createRisk']);

export type DraftActionType = z.infer<typeof DraftActionTypeSchema>;

/**
 * Draft action schema
 */
export const DraftActionSchema = z.object({
  type: DraftActionTypeSchema,
  payload: z.record(z.unknown()),
});

export type DraftAction = z.infer<typeof DraftActionSchema>;

/**
 * Response payload schema returned from POST /api/messages
 */
export const ResponsePayloadSchema = z.object({
  executiveSummary: ExecutiveSummarySchema,
  decisions: z.array(DecisionSchema),
  todos: z.array(TodoSchema),
  risks: z.array(RiskSchema),
  followUpQuestions: z.array(z.string()),
  draftActions: z.array(DraftActionSchema),
  traceId: z.string(),
});

export type ResponsePayload = z.infer<typeof ResponsePayloadSchema>;
