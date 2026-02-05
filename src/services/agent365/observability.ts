import { Activity } from '@microsoft/agents-activity';
import { trace } from '@opentelemetry/api';

/**
 * Agent 365 SDK Observability Integration
 * Wraps Agent 365 observability features with existing OpenTelemetry
 */

/**
 * Trace activity processing
 */
export async function traceActivity<T>(
  activityType: string,
  operation: () => Promise<T>
): Promise<T> {
  const tracer = trace.getTracer('agent365-observability');

  return await tracer.startActiveSpan(`agent365.${activityType}`, async (span) => {
    try {
      span.setAttribute('agent365.activity_type', activityType);
      const result = await operation();
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
 * Log activity for Agent 365 observability
 */
export function logActivity(activity: Activity, direction: 'incoming' | 'outgoing'): void {
  const tracer = trace.getTracer('agent365-observability');
  const span = tracer.startSpan(`agent365.log_activity.${direction}`);

  try {
    span.setAttribute('activity.id', activity.id || 'unknown');
    span.setAttribute('activity.type', activity.type || 'unknown');
    span.setAttribute('activity.direction', direction);

    console.log(`[Agent365 Observability] ${direction.toUpperCase()} Activity:`, {
      id: activity.id,
      type: activity.type,
      timestamp: new Date().toISOString(),
    });

    span.setStatus({ code: 0 });
  } catch (error) {
    span.setStatus({ code: 2, message: (error as Error).message });
  } finally {
    span.end();
  }
}
