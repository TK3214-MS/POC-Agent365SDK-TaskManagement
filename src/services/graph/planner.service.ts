import { Client } from '@microsoft/microsoft-graph-client';
import { env } from '../../config/env.js';
import { trace } from '@opentelemetry/api';
import { Todo } from '../../schemas/response.schema.js';

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
          assignments: {
            // Note: In production, resolve owner display name to user ID
            // For now, this is a placeholder
          },
        }),
      };

      const response = await graphClient.api('/planner/tasks').post(taskPayload);

      span.setAttribute('task.id', response.id as string);
      span.setStatus({ code: 0 });

      return {
        taskId: response.id as string,
        taskTitle: response.title as string,
        webUrl: response.webLink as string | undefined,
      };
    } catch (error) {
      span.setStatus({ code: 2, message: (error as Error).message });
      throw new Error(`Failed to create Planner task: ${(error as Error).message}`);
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
