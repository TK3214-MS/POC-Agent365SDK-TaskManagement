import { Todo, Risk } from '../../schemas/response.schema.js';

/**
 * Action types that can be executed
 */
export type ActionType = 'notify' | 'createTask' | 'createRisk';

/**
 * Action execution result
 */
export interface ActionResult {
  type: ActionType;
  success: boolean;
  details?: unknown;
  error?: string;
}

/**
 * Action executor interface
 */
export interface IActionExecutor {
  /**
   * Execute notify action (send Teams notification)
   */
  executeNotify(
    meetingTitle: string,
    decisionsCount: number,
    todosCount: number,
    risksCount: number,
    channelId?: string,
    teamId?: string
  ): Promise<ActionResult>;

  /**
   * Execute createTask action (create Planner task)
   */
  executeCreateTask(todo: Todo, planId?: string, bucketId?: string): Promise<ActionResult>;

  /**
   * Execute createRisk action (create risk item)
   * Note: Risks can be logged or created as high-priority tasks
   */
  executeCreateRisk(risk: Risk): Promise<ActionResult>;

  /**
   * Execute all actions in batch
   */
  executeAll(
    todos: Todo[],
    risks: Risk[],
    meetingTitle: string,
    decisionsCount: number,
    shouldNotify: boolean
  ): Promise<ActionResult[]>;
}
