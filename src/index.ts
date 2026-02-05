import { env } from './config/env.js';
import { initializeTelemetry, shutdownTelemetry } from './config/telemetry.js';
import { createServer } from './server.js';

/**
 * Main entry point for the external agent
 */
function main(): void {
  console.log('🚀 Starting External Agent for Copilot Studio...');

  // Initialize OpenTelemetry
  const sdk = initializeTelemetry();

  // Create Express server
  const app = createServer();

  // Start HTTP server
  const server = app.listen(env.port, () => {
    console.log(`✅ Server listening on http://localhost:${env.port}`);
    console.log(`📨 Messaging endpoint: http://localhost:${env.port}/api/messages`);
    console.log(`🏥 Health check: http://localhost:${env.port}/health`);
    console.log(`🌍 Environment: ${env.nodeEnv}`);
  });

  // Graceful shutdown
  const shutdown = (): void => {
    console.log('\n🛑 Shutting down gracefully...');
    server.close(() => {
      void shutdownTelemetry(sdk);
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

try {
  main();
} catch (error) {
  console.error('❌ Fatal error during startup:', error);
  process.exit(1);
}
