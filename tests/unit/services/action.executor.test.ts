import { describe, it, expect, vi } from 'vitest';
import { Todo, Risk } from '@/schemas/response.schema';

// Mock env before importing services
vi.mock('@/config/env', () => ({
  env: {
    plannerPlanId: 'mock-plan-id',
    plannerBucketId: 'mock-bucket-id',
  },
}));

// Import after mocking
const { MockActionExecutor } = await import('@/services/actions/action.executor');

describe('Action Executor', () => {
  describe('MockActionExecutor', () => {
    it('should execute createTask action', async () => {
      const executor = new MockActionExecutor();
      const todo: Todo = {
        text: 'Update documentation',
        owner: 'Alice',
        dueDate: '2026-02-15',
        confidence: 0.9,
      };

      const result = await executor.executeCreateTask(todo);

      expect(result.success).toBe(true);
      expect(result.type).toBe('createTask');
      expect(result.details).toBeDefined();
    });

    it('should execute createRisk action', async () => {
      const executor = new MockActionExecutor();
      const risk: Risk = {
        text: 'API dependency issues',
        severity: 'high',
        owner: 'Bob',
        confidence: 0.85,
      };

      const result = await executor.executeCreateRisk(risk);

      expect(result.success).toBe(true);
      expect(result.type).toBe('createRisk');
    });

    it('should execute notify action', async () => {
      const executor = new MockActionExecutor();

      const result = await executor.executeNotify('Q1 Planning', 3, 5, 2);

      expect(result.success).toBe(true);
      expect(result.type).toBe('notify');
    });

    it('should execute all actions in batch', async () => {
      const executor = new MockActionExecutor();
      const todos: Todo[] = [
        { text: 'Task 1', confidence: 0.9 },
        { text: 'Task 2', confidence: 0.85 },
      ];
      const risks: Risk[] = [{ text: 'Risk 1', severity: 'medium', confidence: 0.8 }];

      const results = await executor.executeAll(todos, risks, 'Meeting', 2, true);

      // 2 todos + 1 risk + 1 notification = 4 results
      expect(results.length).toBe(4);
      expect(results.filter((r) => r.success).length).toBe(4);
    });

    it('should skip notification if shouldNotify is false', async () => {
      const executor = new MockActionExecutor();
      const todos: Todo[] = [{ text: 'Task 1', confidence: 0.9 }];
      const risks: Risk[] = [];

      const results = await executor.executeAll(todos, risks, 'Meeting', 1, false);

      // Only 1 task, no notification
      expect(results.length).toBe(1);
      expect(results[0]?.type).toBe('createTask');
    });
  });
});
