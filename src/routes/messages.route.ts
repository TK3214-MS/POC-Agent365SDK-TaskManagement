import { Router, Request, Response } from 'express';
import { Activity } from '@microsoft/agents-activity';
import { RequestPayloadSchema } from '../schemas/request.schema.js';
import { ResponsePayload, DraftAction } from '../schemas/response.schema.js';
import { trace } from '@opentelemetry/api';
import { authenticateJwt } from '../middleware/auth.middleware.js';
import { createGitHubModelsClient } from '../services/llm/github-models.service.js';
import { extractMeetingData, enrichTodos } from '../services/llm/extraction.service.js';
import { createGraphClient } from '../services/graph/graph.client.js';
import { createActionExecutor } from '../services/actions/action.executor.js';
import { Agent365MessageHandler } from '../services/agent365/message-handler.js';
import { logActivity } from '../services/agent365/observability.js';
import { sendMeetingSummaryNotification } from '../services/agent365/notifications.js';

const router = Router();

// Agent 365 Message Handler instance
const messageHandler = new Agent365MessageHandler();

/**
 * POST /api/messages
 * Main endpoint called by Copilot Studio / Microsoft 365
 * Supports both Activity format (Microsoft 365 Agent SDK) and direct JSON
 */
router.post('/', async (req: Request, res: Response) => {
  // Check if request is Microsoft 365 Agent Activity
  if (isActivity(req.body)) {
    // Microsoft 365 Agent SDK Activity format
    await handleActivityRequest(req, res);
    return;
  }

  // Standard JSON request (direct API mode)
  await handleJsonRequest(req, res);
});

/**
 * Check if request is a Microsoft 365 Agent Activity
 */
function isActivity(body: unknown): body is Activity {
  const activity = body as Activity;
  return !!(activity && activity.type && activity.id && activity.conversation);
}

/**
 * Handle Microsoft 365 Agent Activity request
 */
async function handleActivityRequest(req: Request, res: Response): Promise<void> {
  const activity = req.body as Activity;

  // Log incoming activity (Agent 365 observability)
  logActivity(activity, 'incoming');

  // Process activity
  const responseActivity = await messageHandler.handleActivity(activity);

  // Log outgoing activity
  logActivity(responseActivity, 'outgoing');

  // Send response
  res.status(200).json(responseActivity);
}

/**
 * Handle standard JSON request (original implementation)
 */
async function handleJsonRequest(req: Request, res: Response): Promise<void> {
  // Apply authentication (middleware will send error response if auth fails)
  let authFailed = false;
  await authenticateJwt(req, res, () => {
    // Auth successful, continue processing
  }).catch(() => {
    authFailed = true;
  });

  if (authFailed) {
    return; // Auth failed, response already sent by middleware
  }

  await trace.getTracer('messages-handler').startActiveSpan('POST /api/messages', async (span): Promise<void> => {
    try {
      // Validate request payload
      const validationResult = RequestPayloadSchema.safeParse(req.body);

      if (!validationResult.success) {
        span.setStatus({ code: 1, message: 'Invalid request payload' });
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid request payload',
          details: validationResult.error.format(),
        });
        span.end();
        return;
      }

      const payload = validationResult.data;
      span.setAttribute('meeting.title', payload.meetingTitle);
      span.setAttribute('meeting.approve', payload.approve);

      // Create GitHub Models client
      const client = createGitHubModelsClient();

      // Extract meeting data
      const extractionResult = await extractMeetingData(
        payload.meetingTitle,
        payload.meetingTranscript,
        payload.attendees,
        payload.outputLanguage,
        payload.policy.defaultDueDays,
        client
      );

      // Enrich todos with default due dates
      const enrichedTodos = enrichTodos(extractionResult.todos, payload.policy.defaultDueDays);

      // Generate draft actions
      const draftActions: DraftAction[] = [
        ...enrichedTodos.map((todo) => ({
          type: 'createTask' as const,
          payload: {
            text: todo.text,
            owner: todo.owner,
            dueDate: todo.dueDate,
            confidence: todo.confidence,
          },
        })),
        ...extractionResult.risks.map((risk) => ({
          type: 'createRisk' as const,
          payload: {
            text: risk.text,
            severity: risk.severity,
            owner: risk.owner,
            confidence: risk.confidence,
          },
        })),
      ];

      // Add notify action if allowed
      if (payload.policy.allowAutoNotify) {
        draftActions.push({
          type: 'notify',
          payload: {
            meetingTitle: payload.meetingTitle,
            decisionsCount: extractionResult.decisions.length,
            todosCount: enrichedTodos.length,
            risksCount: extractionResult.risks.length,
          },
        });
      }

      // Execute actions if approve=true
      let executionResults: unknown[] = [];
      if (payload.approve) {
        try {
          const graphClient = createGraphClient();
          const executor = createActionExecutor(graphClient);

          const results = await executor.executeAll(
            enrichedTodos,
            extractionResult.risks
          );

          executionResults = results;
          span.setAttribute('execution.results.count', results.length);
          span.setAttribute(
            'execution.success.count',
            results.filter((r) => r.success).length
          );
        } catch (error) {
          console.error('❌ Error executing actions:', error);
          span.setAttribute('execution.error', (error as Error).message);
        }

        // Send notification using Agent 365 SDK (only when actions are executed)
        if (payload.policy.allowAutoNotify) {
          void sendMeetingSummaryNotification(
            payload.meetingTitle,
            enrichedTodos.length,
            extractionResult.risks.length,
            extractionResult.decisions.length
          ).catch((error: unknown) => {
            console.error('❌ Failed to send notification:', error);
          });
        }
      }

      // Build response
      const response: ResponsePayload = {
        executiveSummary: extractionResult.executiveSummary,
        decisions: extractionResult.decisions,
        todos: enrichedTodos,
        risks: extractionResult.risks,
        followUpQuestions: extractionResult.followUpQuestions,
        draftActions: payload.approve ? [] : draftActions, // Only show draft actions if not approved
        traceId: span.spanContext().traceId,
        ...(payload.approve && { executionResults }), // Include execution results if approved
      };

      span.setStatus({ code: 0 });
      res.status(200).json(response);
    } catch (error) {
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  });
}

export default router;
