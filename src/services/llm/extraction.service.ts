import { GitHubModelsClient } from './github-models.service.js';
import { Decision, Todo, Risk, ExecutiveSummary } from '../../schemas/response.schema.js';
import { trace } from '@opentelemetry/api';
import { retryWithBackoff, circuitBreakers, AgentError, ErrorType } from '../../utils/error-handler.util.js';

/**
 * Extraction result from LLM
 */
export interface ExtractionResult {
  executiveSummary: ExecutiveSummary;
  decisions: Decision[];
  todos: Todo[];
  risks: Risk[];
  followUpQuestions: string[];
}

/**
 * JSON schema for LLM structured output
 */
const EXTRACTION_SCHEMA = {
  type: 'object',
  required: ['executiveSummary', 'decisions', 'todos', 'risks', 'followUpQuestions'],
  properties: {
    executiveSummary: {
      type: 'object',
      required: ['progress', 'keyRisks', 'decisionsNeeded'],
      properties: {
        progress: { type: 'string' },
        keyRisks: { type: 'array', items: { type: 'string' } },
        decisionsNeeded: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['text', 'confidence'],
        properties: {
          text: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        additionalProperties: false,
      },
    },
    todos: {
      type: 'array',
      items: {
        type: 'object',
        required: ['text', 'confidence'],
        properties: {
          text: { type: 'string' },
          owner: { type: 'string' },
          dueDate: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        additionalProperties: false,
      },
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['text', 'severity', 'confidence'],
        properties: {
          text: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          owner: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        additionalProperties: false,
      },
    },
    followUpQuestions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  additionalProperties: false,
};

/**
 * System prompt for extraction
 */
function getSystemPrompt(language: string): string {
  const langMap: Record<string, string> = {
    'ja-JP': '日本語',
    'en-US': 'English',
  };
  const outputLang = langMap[language] || langMap['ja-JP'];

  return `You are a meeting analysis assistant. Your task is to extract structured information from meeting transcripts.

Extract the following:
1. **Decisions**: Final decisions made during the meeting (not proposals or discussions)
2. **Todos**: Action items with clear owners and due dates if mentioned
3. **Risks**: Potential issues, blockers, or concerns raised
4. **Executive Summary**: Overall progress, key risks, and decisions needed

For each item, provide a confidence score (0.0-1.0) indicating how certain you are about the extraction.

Output language: ${outputLang}

Important:
- Only extract explicit information from the transcript
- Do not infer or assume information not present in the transcript
- Assign confidence scores conservatively
- Generate 2-3 relevant follow-up questions to clarify missing information`;
}

/**
 * User prompt for extraction
 */
function getUserPrompt(
  meetingTitle: string,
  meetingTranscript: string,
  attendees: string[],
  defaultDueDays: number
): string {
  return `Meeting Title: ${meetingTitle}
Attendees: ${attendees.join(', ') || 'Not specified'}
Default Due Date: ${defaultDueDays} days from today

Meeting Transcript:
"""
${meetingTranscript}
"""

Please extract decisions, todos, risks, executive summary, and generate follow-up questions.`;
}

/**
 * Extract structured data from meeting transcript using LLM
 * Includes retry logic and circuit breaker pattern
 */
export async function extractMeetingData(
  meetingTitle: string,
  meetingTranscript: string,
  attendees: string[],
  outputLanguage: string,
  defaultDueDays: number,
  client: GitHubModelsClient
): Promise<ExtractionResult> {
  const tracer = trace.getTracer('extraction-service');

  return await tracer.startActiveSpan('extractMeetingData', async (span) => {
    try {
      span.setAttribute('meeting.title', meetingTitle);
      span.setAttribute('meeting.attendees.count', attendees.length);
      span.setAttribute('output.language', outputLanguage);

      const systemPrompt = getSystemPrompt(outputLanguage);
      const userPrompt = getUserPrompt(meetingTitle, meetingTranscript, attendees, defaultDueDays);

      // Use circuit breaker and retry logic for GitHub Models API
      const result = await circuitBreakers.githubModels.execute(async () => {
        return await retryWithBackoff(
          async () => {
            try {
              return await client.generateStructured<ExtractionResult>(
                systemPrompt,
                userPrompt,
                EXTRACTION_SCHEMA
              );
            } catch (error) {
              const err = error as Error;
              // Wrap errors with AgentError for better context
              throw new AgentError(
                ErrorType.GITHUB_MODELS,
                `Failed to extract meeting data: ${err.message}`,
                500,
                { originalError: err.message },
                true // retryable
              );
            }
          },
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            maxDelayMs: 5000,
            backoffMultiplier: 2,
          },
          'GitHub Models extraction'
        );
      });

      span.setAttribute('extraction.decisions.count', result.decisions.length);
      span.setAttribute('extraction.todos.count', result.todos.length);
      span.setAttribute('extraction.risks.count', result.risks.length);
      span.setStatus({ code: 0 });

      return result;
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
 * Calculate due date from default days
 */
export function calculateDueDate(defaultDueDays: number): string {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + defaultDueDays);
  return dueDate.toISOString().split('T')[0]!; // YYYY-MM-DD
}

/**
 * Enrich todos with default due dates if not specified
 */
export function enrichTodos(todos: Todo[], defaultDueDays: number): Todo[] {
  return todos.map((todo) => ({
    ...todo,
    dueDate: todo.dueDate || calculateDueDate(defaultDueDays),
  }));
}
