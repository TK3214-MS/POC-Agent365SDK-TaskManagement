import { trace } from '@opentelemetry/api';

/**
 * Agent 365 SDK Notifications Integration
 * Wraps Agent 365 notifications features
 */

export interface NotificationPayload {
  title: string;
  body: string;
  priority: 'low' | 'normal' | 'high';
  data?: Record<string, unknown>;
}

/**
 * Send notification using Agent 365 SDK
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const tracer = trace.getTracer('agent365-notifications');

  await tracer.startActiveSpan('agent365.send_notification', async (span) => {
    try {
      span.setAttribute('notification.title', payload.title);
      span.setAttribute('notification.priority', payload.priority);

      console.log('[Agent365 Notifications] Sending notification:', {
        title: payload.title,
        priority: payload.priority,
        timestamp: new Date().toISOString(),
      });

      // Simulate notification sending
      await new Promise((resolve) => setTimeout(resolve, 100));

      span.setStatus({ code: 0 });
    } catch (error) {
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Send summary notification for meeting processing
 */
export async function sendMeetingSummaryNotification(
  meetingTitle: string,
  todosCount: number,
  risksCount: number,
  decisionsCount: number
): Promise<void> {
  await sendNotification({
    title: `Meeting Summary: ${meetingTitle}`,
    body: `Processed ${decisionsCount} decisions, ${todosCount} todos, and ${risksCount} risks`,
    priority: risksCount > 0 ? 'high' : 'normal',
    data: {
      meetingTitle,
      todosCount,
      risksCount,
      decisionsCount,
    },
  });
}
