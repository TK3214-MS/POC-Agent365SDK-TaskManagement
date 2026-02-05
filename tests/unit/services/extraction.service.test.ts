import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateDueDate, enrichTodos } from '@/services/llm/extraction.service';
import { Todo } from '@/schemas/response.schema';

describe('Extraction Service Utils', () => {
  describe('calculateDueDate', () => {
    it('should calculate correct due date from default days', () => {
      const defaultDays = 7;
      const result = calculateDueDate(defaultDays);

      const expected = new Date();
      expected.setDate(expected.getDate() + defaultDays);
      const expectedStr = expected.toISOString().split('T')[0];

      expect(result).toBe(expectedStr);
    });

    it('should handle different day values', () => {
      const result30 = calculateDueDate(30);
      const result1 = calculateDueDate(1);

      expect(result30).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result1).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('enrichTodos', () => {
    it('should add default due dates to todos without due dates', () => {
      const todos: Todo[] = [
        { text: 'Task 1', confidence: 0.9 },
        { text: 'Task 2', dueDate: '2026-03-01', confidence: 0.8 },
        { text: 'Task 3', confidence: 0.7 },
      ];

      const enriched = enrichTodos(todos, 7);

      expect(enriched[0]?.dueDate).toBeDefined();
      expect(enriched[1]?.dueDate).toBe('2026-03-01'); // Preserved
      expect(enriched[2]?.dueDate).toBeDefined();
    });

    it('should preserve existing todo properties', () => {
      const todos: Todo[] = [
        { text: 'Task with owner', owner: 'Alice', confidence: 0.9 },
      ];

      const enriched = enrichTodos(todos, 7);

      expect(enriched[0]?.text).toBe('Task with owner');
      expect(enriched[0]?.owner).toBe('Alice');
      expect(enriched[0]?.confidence).toBe(0.9);
    });
  });
});
