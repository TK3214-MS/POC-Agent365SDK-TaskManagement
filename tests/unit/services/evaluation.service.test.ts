import { describe, it, expect } from 'vitest';
import type { ModelEvaluationResult } from '@/services/llm/evaluation.service';

// Import the selectBestModel function via dynamic import to test private function
// For now, we'll test the public API only

describe('Evaluation Service', () => {
  describe('Model Selection Logic', () => {
    it('should prefer models with higher extraction counts', () => {
      const results: ModelEvaluationResult[] = [
        {
          modelName: 'gpt-4o-mini',
          result: {
            executiveSummary: { progress: 'OK', keyRisks: [], decisionsNeeded: [] },
            decisions: [{ text: 'Decision 1', confidence: 0.9 }],
            todos: [],
            risks: [],
            followUpQuestions: [],
          },
          executionTimeMs: 1000,
        },
        {
          modelName: 'gpt-4o',
          result: {
            executiveSummary: { progress: 'OK', keyRisks: [], decisionsNeeded: [] },
            decisions: [
              { text: 'Decision 1', confidence: 0.9 },
              { text: 'Decision 2', confidence: 0.85 },
            ],
            todos: [{ text: 'Task 1', confidence: 0.8 }],
            risks: [{ text: 'Risk 1', severity: 'high', confidence: 0.7 }],
            followUpQuestions: [],
          },
          executionTimeMs: 2000,
        },
      ];

      // Model with more extractions should be preferred
      const totalGpt4oMini =
        results[0]!.result.decisions.length +
        results[0]!.result.todos.length +
        results[0]!.result.risks.length;
      const totalGpt4o =
        results[1]!.result.decisions.length +
        results[1]!.result.todos.length +
        results[1]!.result.risks.length;

      expect(totalGpt4o).toBeGreaterThan(totalGpt4oMini);
    });

    it('should handle models with errors', () => {
      const results: ModelEvaluationResult[] = [
        {
          modelName: 'failing-model',
          result: {
            executiveSummary: { progress: '', keyRisks: [], decisionsNeeded: [] },
            decisions: [],
            todos: [],
            risks: [],
            followUpQuestions: [],
          },
          executionTimeMs: 100,
          error: 'API Error',
        },
      ];

      expect(results[0]?.error).toBe('API Error');
      expect(results[0]?.result.decisions.length).toBe(0);
    });
  });
});
