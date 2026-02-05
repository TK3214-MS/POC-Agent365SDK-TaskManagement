import express, { Request, Response, NextFunction } from 'express';
import 'express-async-errors';
import helmet from 'helmet';
import { env } from './config/env.js';
import messagesRouter from './routes/messages.route.js';
import { telemetryMiddleware } from './middleware/telemetry.middleware.js';

/**
 * Create Express application with middleware
 */
export function createServer(): express.Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Telemetry middleware (before routes)
  app.use(telemetryMiddleware);

  // Health check endpoint (no auth required)
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: env.otelServiceName,
    });
  });

  // Main route: POST /api/messages
  app.use('/api/messages', messagesRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
    });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('❌ Unhandled error:', err);

    const statusCode = 'statusCode' in err ? (err.statusCode as number) : 500;
    const message = env.nodeEnv === 'production' ? 'Internal Server Error' : err.message;

    res.status(statusCode).json({
      error: err.name || 'Error',
      message,
      ...(env.nodeEnv === 'development' && { stack: err.stack }),
    });
  });

  return app;
}
