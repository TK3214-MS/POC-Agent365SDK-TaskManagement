import { Client } from '@microsoft/microsoft-graph-client';
import { env } from '../../config/env.js';
import { trace } from '@opentelemetry/api';
import { Todo } from '../../schemas/response.schema.js';
import { retryWithBackoff, circuitBreakers, AgentError, ErrorType } from '../../utils/error-handler.util.js';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
// Graph SDK responses are typed as 'any' - we use type assertions for safety

/**
 * Planner task creation result
 */
export interface PlannerTaskResult {
  taskId: string;
  taskTitle: string;
  webUrl?: string;
}

/**
 * Create a task in Microsoft Planner
 */
export async function createPlannerTask(
  graphClient: Client,
  todo: Todo,
  planId?: string,
  bucketId?: string
): Promise<PlannerTaskResult> {
  const tracer = trace.getTracer('planner-service');

  return await tracer.startActiveSpan('createPlannerTask', async (span) => {
    try {
      const targetPlanId = planId || env.plannerPlanId;
      const targetBucketId = bucketId || env.plannerBucketId;

      span.setAttribute('planner.plan_id', targetPlanId);
      span.setAttribute('planner.bucket_id', targetBucketId);
      span.setAttribute('task.title', todo.text);

      const taskPayload = {
        planId: targetPlanId,
        bucketId: targetBucketId,
        title: todo.text,
        ...(todo.dueDate && { dueDateTime: `${todo.dueDate}T23:59:59Z` }),
        ...(todo.owner && {
          assignments: {},
        }),
      };

      // Use circuit breaker and retry logic for Graph API
      const response = await circuitBreakers.graphAPI.execute(async () => {
        return await retryWithBackoff(
          async () => {
            try {
              return await graphClient.api('/planner/tasks').post(taskPayload);
            } catch (error) {
              const err = error as Error;
              throw new AgentError(
                ErrorType.GRAPH_API,
                `Failed to create Planner task: ${err.message}`,
                500,
                { taskTitle: todo.text, originalError: err.message },
                true // retryable
              );
            }
          },
          {
            maxAttempts: 3,
            initialDelayMs: 500,
            maxDelayMs: 3000,
            backoffMultiplier: 2,
          },
          'Graph API - Create Planner Task'
        );
      });

      span.setAttribute('task.id', response.id as string);
      span.setStatus({ code: 0 });

      return {
        taskId: response.id as string,
        taskTitle: response.title as string,
        webUrl: response.webLink as string | undefined,
      };
    } catch (error) {
      span.setStatus({ code: 2, message: (error as Error).message });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Create multiple Planner tasks in batch
 */
export async function createPlannerTasksBatch(
  graphClient: Client,
  todos: Todo[],
  planId?: string,
  bucketId?: string
): Promise<PlannerTaskResult[]> {
  const results: PlannerTaskResult[] = [];

  for (const todo of todos) {
    try {
      const result = await createPlannerTask(graphClient, todo, planId, bucketId);
      results.push(result);
    } catch (error) {
      console.error(`❌ Failed to create task: ${todo.text}`, error);
      // Continue with other tasks even if one fails
    }
  }

  return results;
}
