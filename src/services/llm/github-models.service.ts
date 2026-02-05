import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { trace } from '@opentelemetry/api';

/**
 * GitHub Models client wrapper
 */
export class GitHubModelsClient {
  private client: OpenAI;
  private model: string;

  constructor(modelName?: string) {
    this.client = new OpenAI({
      apiKey: env.githubToken,
      baseURL: env.githubModelsEndpoint,
    });
    this.model = modelName || env.githubModelsDefault;
  }

  /**
   * Generate structured output with JSON schema
   */
  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: Record<string, unknown>,
    temperature = 0.3
  ): Promise<T> {
    const tracer = trace.getTracer('github-models-client');

    return await tracer.startActiveSpan('generateStructured', async (span) => {
      try {
        span.setAttribute('model', this.model);
        span.setAttribute('temperature', temperature);

        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'extraction_result',
              strict: true,
              schema,
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content in response from GitHub Models');
        }

        span.setStatus({ code: 0 });
        return JSON.parse(content) as T;
      } catch (error) {
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get model name
   */
  getModelName(): string {
    return this.model;
  }
}

/**
 * Create GitHub Models client instance
 */
export function createGitHubModelsClient(modelName?: string): GitHubModelsClient {
  return new GitHubModelsClient(modelName);
}
