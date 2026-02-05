import { Request, Response, NextFunction } from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { sanitizeObject } from '../utils/pii-filter.util.js';

/**
 * Telemetry middleware for request tracing
 */
export function telemetryMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tracer = trace.getTracer('telemetry-middleware');

  tracer.startActiveSpan('HTTP Request', (span) => {
    // Set basic HTTP attributes
    span.setAttribute('http.method', req.method);
    span.setAttribute('http.url', req.url);
    const route = req.route as { path?: string } | undefined;
    const routePath: string = route?.path ?? req.path;
    span.setAttribute('http.route', routePath);
    span.setAttribute('http.user_agent', req.headers['user-agent'] || 'unknown');

    // Attach trace context to request
    (req as Request & { traceId: string }).traceId = span.spanContext().traceId;

    // Log sanitized request body (only for debugging)
    if (req.body && Object.keys(req.body as object).length > 0) {
      const sanitizedBody = sanitizeObject(req.body as Record<string, unknown>);
      span.setAttribute('http.request.body_summary', JSON.stringify(sanitizedBody));
    }

    // Capture response
    const originalSend = res.send.bind(res);
    res.send = function (body: unknown): Response {
      span.setAttribute('http.status_code', res.statusCode);

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
      return originalSend(body);
    };

    // Handle errors
    res.on('error', (error: Error) => {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();
    });

    next();
  });
}
