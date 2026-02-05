import { Client } from '@microsoft/microsoft-graph-client';
import { trace } from '@opentelemetry/api';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
// Graph SDK responses are typed as 'any' - we use type assertions for safety

/**
 * Teams notification result
 */
export interface TeamsNotificationResult {
  messageId: string;
  channelId: string;
}

/**
 * Teams notification payload
 */
export interface TeamsNotificationPayload {
  channelId: string;
  teamId: string;
  message: string;
  subject?: string;
}

/**
 * Send a notification to a Teams channel
 */
export async function sendTeamsNotification(
  graphClient: Client,
  payload: TeamsNotificationPayload
): Promise<TeamsNotificationResult> {
  const tracer = trace.getTracer('teams-service');

  return await tracer.startActiveSpan('sendTeamsNotification', async (span) => {
    try {
      span.setAttribute('teams.team_id', payload.teamId);
      span.setAttribute('teams.channel_id', payload.channelId);

      const messagePayload = {
        body: {
          content: payload.message,
          contentType: 'html',
        },
        ...(payload.subject && { subject: payload.subject }),
      };

      const response = await graphClient
        .api(`/teams/${payload.teamId}/channels/${payload.channelId}/messages`)
        .post(messagePayload);

      span.setAttribute('message.id', response.id as string);
      span.setStatus({ code: 0 });

      return {
        messageId: response.id as string,
        channelId: payload.channelId,
      };
    } catch (error) {
      span.setStatus({ code: 2, message: (error as Error).message });
      throw new Error(`Failed to send Teams notification: ${(error as Error).message}`);
    } finally {
      span.end();
    }
  });
}

/**
 * Format meeting summary for Teams notification
 */
export function formatTeamsMessage(
  meetingTitle: string,
  decisionsCount: number,
  todosCount: number,
  risksCount: number
): string {
  return `
<h2>📝 Meeting Summary: ${meetingTitle}</h2>
<ul>
  <li><strong>Decisions:</strong> ${decisionsCount}</li>
  <li><strong>Action Items:</strong> ${todosCount}</li>
  <li><strong>Risks:</strong> ${risksCount}</li>
</ul>
<p><em>Processed by External Agent - Task Management</em></p>
  `.trim();
}
