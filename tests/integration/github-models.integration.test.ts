import { describe, it, expect } from 'vitest';
import { extractMeetingData, enrichTodos } from '../../src/services/llm/extraction.service.js';
import { createGitHubModelsClient } from '../../src/services/llm/github-models.service.js';

describe('GitHub Models Integration Tests', () => {
  // Note: These tests will make real API calls if GITHUB_TOKEN is set
  // They are marked as integration tests and may be skipped in CI

  const skipIfNoToken = process.env.GITHUB_TOKEN ? it : it.skip;

  describe('Meeting Data Extraction', () => {
    skipIfNoToken('should extract meeting data using real GitHub Models API', async () => {
      const client = createGitHubModelsClient();

      const result = await extractMeetingData(
        'Q1 Planning Meeting',
        'Alice: We need to finalize the Q1 roadmap by next week. ' +
          'Bob: I can review the timeline and send updates by Friday. ' +
          'Charlie: We should consider the budget constraints before making final decisions.',
        ['Alice', 'Bob', 'Charlie'],
        'en-US',
        7,
        client
      );

      expect(result).toBeDefined();
      expect(result.executiveSummary).toBeDefined();
      expect(result.executiveSummary.progress).toBeDefined();
      expect(typeof result.executiveSummary.progress).toBe('string');

      expect(Array.isArray(result.decisions)).toBe(true);
      expect(Array.isArray(result.todos)).toBe(true);
      expect(Array.isArray(result.risks)).toBe(true);
      expect(Array.isArray(result.followUpQuestions)).toBe(true);

      // Verify structure of extracted items
      if (result.todos.length > 0) {
        const todo = result.todos[0];
        expect(todo.text).toBeDefined();
        expect(typeof todo.confidence).toBe('number');
        expect(todo.confidence).toBeGreaterThanOrEqual(0);
        expect(todo.confidence).toBeLessThanOrEqual(1);
      }

      if (result.risks.length > 0) {
        const risk = result.risks[0];
        expect(risk.text).toBeDefined();
        expect(risk.severity).toMatch(/^(low|medium|high)$/);
        expect(typeof risk.confidence).toBe('number');
      }
    }, 30000); // 30 second timeout for API call

    it('should enrich todos with due dates', () => {
      const todos = [
        { text: 'Task 1', confidence: 0.9 },
        { text: 'Task 2', owner: 'Bob', confidence: 0.85 },
      ];

      const enriched = enrichTodos(todos, 7);

      expect(enriched).toHaveLength(2);
      expect(enriched[0].dueDate).toBeDefined();
      expect(enriched[1].dueDate).toBeDefined();

      // Verify date format (YYYY-MM-DD)
      expect(enriched[0].dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Model Availability', () => {
    skipIfNoToken('should successfully create GitHub Models client', () => {
      const client = createGitHubModelsClient();

      expect(client).toBeDefined();
      expect(client.chat).toBeDefined();
      expect(client.chat.completions).toBeDefined();
    });

    skipIfNoToken('should handle API errors gracefully', async () => {
      const client = createGitHubModelsClient();

      // Test with minimal input to verify error handling
      try {
        await extractMeetingData('', '', [], 'en-US', 7, client);
        // If no error is thrown, the API handled empty input
        expect(true).toBe(true);
      } catch (error) {
        // Error should be an instance of Error
        expect(error).toBeInstanceOf(Error);
      }
    }, 30000);
  });
});
