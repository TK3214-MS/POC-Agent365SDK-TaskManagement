import { createGitHubModelsClient } from './github-models.service.js';
import { extractMeetingData, ExtractionResult } from './extraction.service.js';
import { env } from '../../config/env.js';
import { trace } from '@opentelemetry/api';

/**
 * Evaluation result for a single model
 */
export interface ModelEvaluationResult {
  modelName: string;
  result: ExtractionResult;
  executionTimeMs: number;
  error?: string;
}

/**
 * Aggregated evaluation results
 */
export interface EvaluationResults {
  results: ModelEvaluationResult[];
  recommendedModel?: string;
  totalTimeMs: number;
}

/**
 * Evaluate extraction across multiple models
 */
export async function evaluateMultipleModels(
  meetingTitle: string,
  meetingTranscript: string,
  attendees: string[],
  outputLanguage: string,
  defaultDueDays: number,
  modelNames?: string[]
): Promise<EvaluationResults> {
  const tracer = trace.getTracer('evaluation-service');

  return await tracer.startActiveSpan('evaluateMultipleModels', async (span) => {
    const models = modelNames || env.githubModelsList;
    const startTime = Date.now();
    const results: ModelEvaluationResult[] = [];

    try {
      span.setAttribute('evaluation.models.count', models.length);
      span.setAttribute('evaluation.models', models.join(', '));

      // Run extraction for each model
      for (const modelName of models) {
        const modelStartTime = Date.now();
        try {
          const client = createGitHubModelsClient(modelName);
          const result = await extractMeetingData(
            meetingTitle,
            meetingTranscript,
            attendees,
            outputLanguage,
            defaultDueDays,
            client
          );

          results.push({
            modelName,
            result,
            executionTimeMs: Date.now() - modelStartTime,
          });
        } catch (error) {
          results.push({
            modelName,
            result: {
              executiveSummary: { progress: '', keyRisks: [], decisionsNeeded: [] },
              decisions: [],
              todos: [],
              risks: [],
              followUpQuestions: [],
            },
            executionTimeMs: Date.now() - modelStartTime,
            error: (error as Error).message,
          });
        }
      }

      // Determine recommended model (based on total extractions and confidence)
      const recommendedModel = selectBestModel(results);

      const totalTimeMs = Date.now() - startTime;
      span.setAttribute('evaluation.total_time_ms', totalTimeMs);
      span.setAttribute('evaluation.recommended_model', recommendedModel || 'none');
      span.setStatus({ code: 0 });

      return {
        results,
        recommendedModel,
        totalTimeMs,
      };
    } catch (error) {
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Select the best model based on extraction quality
 */
function selectBestModel(results: ModelEvaluationResult[]): string | undefined {
  if (results.length === 0) return undefined;

  // Score each model based on:
  // - Number of extractions (decisions + todos + risks)
  // - Average confidence
  // - Execution time (bonus for faster models)
  const scores = results.map((result) => {
    if (result.error) return { modelName: result.modelName, score: 0 };

    const totalExtractions =
      result.result.decisions.length + result.result.todos.length + result.result.risks.length;

    const avgConfidence =
      totalExtractions > 0
        ? [
            ...result.result.decisions.map((d) => d.confidence),
            ...result.result.todos.map((t) => t.confidence),
            ...result.result.risks.map((r) => r.confidence),
          ].reduce((sum, c) => sum + c, 0) / totalExtractions
        : 0;

    // Lower execution time is better (normalize to 0-1 range, assume max 10s)
    const timeBonus = Math.max(0, 1 - result.executionTimeMs / 10000);

    const score = totalExtractions * 10 + avgConfidence * 50 + timeBonus * 5;

    return { modelName: result.modelName, score };
  });

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  return scores[0]?.modelName;
}
