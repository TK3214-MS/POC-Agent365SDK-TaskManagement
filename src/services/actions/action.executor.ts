import { Client } from '@microsoft/microsoft-graph-client';
import { IActionExecutor, ActionResult } from './action.interface.js';
import { Todo, Risk } from '../../schemas/response.schema.js';
import { createPlannerTask } from '../graph/planner.service.js';
import {
  sendTeamsNotification,
  formatTeamsMessage,
  TeamsNotificationPayload,
} from '../graph/teams.service.js';
import { trace } from '@opentelemetry/api';

/**
 * Production action executor using Microsoft Graph API
 */
export class GraphActionExecutor implements IActionExecutor {
  constructor(private graphClient: Client) {}

  async executeNotify(
    meetingTitle: string,
    decisionsCount: number,
    todosCount: number,
    risksCount: number,
    channelId?: string,
    teamId?: string
  ): Promise<ActionResult> {
    const tracer = trace.getTracer('action-executor');

    return await tracer.startActiveSpan('executeNotify', async (span) => {
      try {
        if (!channelId || !teamId) {
          throw new Error('channelId and teamId are required for Teams notification');
        }

        const message = formatTeamsMessage(meetingTitle, decisionsCount, todosCount, risksCount);

        const payload: TeamsNotificationPayload = {
          channelId,
          teamId,
          message,
          subject: `Meeting Summary: ${meetingTitle}`,
        };

        const result = await sendTeamsNotification(this.graphClient, payload);

        span.setStatus({ code: 0 });
        return {
          type: 'notify' as const,
          success: true,
          details: result,
        };
      } catch (error) {
        span.setStatus({ code: 2, message: (error as Error).message });
        return {
          type: 'notify' as const,
          success: false,
          error: (error as Error).message,
        };
      } finally {
        span.end();
      }
    });
  }

  async executeCreateTask(todo: Todo, planId?: string, bucketId?: string): Promise<ActionResult> {
    const tracer = trace.getTracer('action-executor');

    return await tracer.startActiveSpan('executeCreateTask', async (span) => {
      try {
        const result = await createPlannerTask(this.graphClient, todo, planId, bucketId);

        span.setStatus({ code: 0 });
        return {
          type: 'createTask' as const,
          success: true,
          details: result,
        };
      } catch (error) {
        span.setStatus({ code: 2, message: (error as Error).message });
        return {
          type: 'createTask' as const,
          success: false,
          error: (error as Error).message,
        };
      } finally {
        span.end();
      }
    });
  }

  async executeCreateRisk(risk: Risk): Promise<ActionResult> {
    const tracer = trace.getTracer('action-executor');

    return await tracer.startActiveSpan('executeCreateRisk', async (span) => {
      try {
        // Create risk as a high-priority Planner task
        const riskTodo: Todo = {
          text: `⚠️ RISK (${risk.severity.toUpperCase()}): ${risk.text}`,
          owner: risk.owner,
          confidence: risk.confidence,
        };

        const result = await createPlannerTask(this.graphClient, riskTodo);

        span.setStatus({ code: 0 });
        return {
          type: 'createRisk' as const,
          success: true,
          details: result,
        };
      } catch (error) {
        span.setStatus({ code: 2, message: (error as Error).message });
        return {
          type: 'createRisk' as const,
          success: false,
          error: (error as Error).message,
        };
      } finally {
        span.end();
      }
    });
  }

  async executeAll(
    todos: Todo[],
    risks: Risk[],
    _meetingTitle: string,
    _decisionsCount: number,
    shouldNotify: boolean
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    // Create tasks
    for (const todo of todos) {
      const result = await this.executeCreateTask(todo);
      results.push(result);
    }

    // Create risks as high-priority tasks
    for (const risk of risks) {
      const result = await this.executeCreateRisk(risk);
      results.push(result);
    }

    // Send notification (if enabled)
    if (shouldNotify) {
      // Note: In production, channelId and teamId should be configured
      // For now, we skip notification if not configured
      console.log('ℹ️ Notification skipped: channelId/teamId not configured');
    }

    return results;
  }
}

/**
 * Mock action executor for testing
 */
export class MockActionExecutor implements IActionExecutor {
  async executeNotify(
    meetingTitle: string,
    decisionsCount: number,
    todosCount: number,
    risksCount: number
  ): Promise<ActionResult> {
    console.log(`[MOCK] Sending notification for: ${meetingTitle}`);
    console.log(`[MOCK] Decisions: ${decisionsCount}, Todos: ${todosCount}, Risks: ${risksCount}`);
    return {
      type: 'notify' as const,
      success: true,
      details: { mockMessageId: 'mock-123', mockChannelId: 'mock-channel' },
    };
  }

  async executeCreateTask(todo: Todo): Promise<ActionResult> {
    console.log(`[MOCK] Creating task: ${todo.text}`);
    return {
      type: 'createTask' as const,
      success: true,
      details: { mockTaskId: `mock-task-${Date.now()}`, taskTitle: todo.text },
    };
  }

  async executeCreateRisk(risk: Risk): Promise<ActionResult> {
    console.log(`[MOCK] Creating risk: ${risk.text} (${risk.severity})`);
    return {
      type: 'createRisk' as const,
      success: true,
      details: { mockRiskId: `mock-risk-${Date.now()}`, riskText: risk.text },
    };
  }

  async executeAll(
    todos: Todo[],
    risks: Risk[],
    meetingTitle: string,
    decisionsCount: number,
    shouldNotify: boolean
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const todo of todos) {
      results.push(await this.executeCreateTask(todo));
    }

    for (const risk of risks) {
      results.push(await this.executeCreateRisk(risk));
    }

    if (shouldNotify) {
      results.push(
        await this.executeNotify(meetingTitle, decisionsCount, todos.length, risks.length)
      );
    }

    return results;
  }
}

/**
 * Create action executor (production or mock based on environment)
 */
export function createActionExecutor(graphClient?: Client): IActionExecutor {
  if (graphClient) {
    return new GraphActionExecutor(graphClient);
  }
  return new MockActionExecutor();
}
