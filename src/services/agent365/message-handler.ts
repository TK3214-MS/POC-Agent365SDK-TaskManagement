import { Activity } from '@microsoft/agents-activity';
import { trace } from '@opentelemetry/api';
import { RequestPayloadSchema } from '../../schemas/request.schema.js';
import { ResponsePayload } from '../../schemas/response.schema.js';
import { createGitHubModelsClient } from '../llm/github-models.service.js';
import { extractMeetingData, enrichTodos } from '../llm/extraction.service.js';
import { createGraphClient } from '../graph/graph.client.js';
import { createActionExecutor } from '../actions/action.executor.js';

/**
 * Microsoft 365 Agent message handler
 * Processes incoming messages using Microsoft 365 Agent SDK patterns
 */
export class Agent365MessageHandler {
  /**
   * Handle incoming Activity
   */
  async handleActivity(activity: Activity): Promise<Activity> {
    const tracer = trace.getTracer('agent365-message-handler');

    return await tracer.startActiveSpan('handleActivity', async (span) => {
      try {
        span.setAttribute('activity.type', activity.type || 'unknown');
        span.setAttribute('activity.id', activity.id || 'unknown');

        // Parse message text as JSON payload
        const messageText = activity.text || '{}';
        let payload;

        try {
          payload = JSON.parse(messageText);
        } catch {
          // If not JSON, treat as plain text meeting transcript
          payload = {
            meetingTitle: 'Untitled Meeting',
            meetingTranscript: messageText,
            approve: false,
          };
        }

        // Validate payload
        const validationResult = RequestPayloadSchema.safeParse(payload);

        if (!validationResult.success) {
          span.setStatus({ code: 1, message: 'Invalid payload' });
          return this.createErrorResponse(
            activity,
            `Invalid request format: ${JSON.stringify(validationResult.error.format())}`
          );
        }

        const validatedPayload = validationResult.data;
        span.setAttribute('meeting.title', validatedPayload.meetingTitle);
        span.setAttribute('meeting.approve', validatedPayload.approve);

        // Extract meeting data
        const client = createGitHubModelsClient();
        const extractionResult = await extractMeetingData(
          validatedPayload.meetingTitle,
          validatedPayload.meetingTranscript,
          validatedPayload.attendees,
          validatedPayload.outputLanguage,
          validatedPayload.policy.defaultDueDays,
          client
        );

        // Enrich todos
        const enrichedTodos = enrichTodos(
          extractionResult.todos,
          validatedPayload.policy.defaultDueDays
        );

        // Execute actions if approved
        let executionResults: unknown[] = [];
        if (validatedPayload.approve) {
          try {
            const graphClient = createGraphClient();
            const executor = createActionExecutor(graphClient);

            const results = await executor.executeAll(
              enrichedTodos,
              extractionResult.risks,
              validatedPayload.meetingTitle,
              extractionResult.decisions.length,
              validatedPayload.policy.allowAutoNotify
            );

            executionResults = results;
            span.setAttribute('execution.results.count', results.length);
          } catch (error) {
            console.error('❌ Error executing actions:', error);
          }
        }

        // Build response
        const response: ResponsePayload = {
          executiveSummary: extractionResult.executiveSummary,
          decisions: extractionResult.decisions,
          todos: enrichedTodos,
          risks: extractionResult.risks,
          followUpQuestions: extractionResult.followUpQuestions,
          draftActions: validatedPayload.approve ? [] : [],
          traceId: span.spanContext().traceId,
          ...(validatedPayload.approve && { executionResults }),
        };

        span.setStatus({ code: 0 });
        return this.createSuccessResponse(activity, response);
      } catch (error) {
        span.setStatus({ code: 2, message: (error as Error).message });
        console.error('❌ Error handling activity:', error);
        return this.createErrorResponse(activity, `Error: ${(error as Error).message}`);
      } finally {
        span.end();
      }
    });
  }

  /**
   * Create success response Activity
   */
  private createSuccessResponse(incomingActivity: Activity, payload: ResponsePayload): Activity {
    const formattedText = this.formatResponseText(payload);

    return {
      type: 'message',
      from: incomingActivity.recipient,
      recipient: incomingActivity.from,
      conversation: incomingActivity.conversation,
      replyToId: incomingActivity.id,
      text: formattedText,
      attachments: [
        {
          contentType: 'application/json',
          content: payload,
        },
      ],
    } as Activity;
  }

  /**
   * Create error response Activity
   */
  private createErrorResponse(incomingActivity: Activity, errorMessage: string): Activity {
    return {
      type: 'message',
      from: incomingActivity.recipient,
      recipient: incomingActivity.from,
      conversation: incomingActivity.conversation,
      replyToId: incomingActivity.id,
      text: errorMessage,
    } as Activity;
  }

  /**
   * Format response as readable text
   */
  private formatResponseText(response: ResponsePayload): string {
    const lines: string[] = [];

    lines.push(`# 📋 Meeting Summary`);
    lines.push('');
    lines.push(`**Progress:** ${response.executiveSummary.progress}`);
    lines.push('');

    if (response.executiveSummary.keyRisks.length > 0) {
      lines.push(`**Key Risks:**`);
      response.executiveSummary.keyRisks.forEach((risk) => lines.push(`- ${risk}`));
      lines.push('');
    }

    if (response.decisions.length > 0) {
      lines.push(`## ✅ Decisions (${response.decisions.length})`);
      response.decisions.forEach((decision, i) => {
        lines.push(`${i + 1}. ${decision.text} (${Math.round(decision.confidence * 100)}%)`);
      });
      lines.push('');
    }

    if (response.todos.length > 0) {
      lines.push(`## 📝 Action Items (${response.todos.length})`);
      response.todos.forEach((todo, i) => {
        lines.push(
          `${i + 1}. ${todo.text}${todo.owner ? ` [@${todo.owner}]` : ''}${todo.dueDate ? ` (Due: ${todo.dueDate})` : ''}`
        );
      });
      lines.push('');
    }

    if (response.risks.length > 0) {
      lines.push(`## ⚠️ Risks (${response.risks.length})`);
      response.risks.forEach((risk, i) => {
        lines.push(`${i + 1}. [${risk.severity.toUpperCase()}] ${risk.text}`);
      });
      lines.push('');
    }

    lines.push(`---`);
    lines.push(`Trace ID: \`${response.traceId}\``);

    return lines.join('\n');
  }
}
