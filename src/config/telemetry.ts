import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { env } from './env.js';

/**
 * Initialize OpenTelemetry SDK
 */
export function initializeTelemetry(): NodeSDK {
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: env.otelServiceName,
    [ATTR_SERVICE_VERSION]: '1.0.0',
  });

  const traceExporter =
    env.otelExporterType === 'otlp'
      ? new OTLPTraceExporter({
          url: env.otelExporterOtlpEndpoint || 'http://localhost:4318/v1/traces',
        })
      : new ConsoleSpanExporter();

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
  });

  sdk.start();
  console.log(`✅ OpenTelemetry initialized (exporter: ${env.otelExporterType})`);

  return sdk;
}

/**
 * Shutdown telemetry gracefully
 */
export async function shutdownTelemetry(sdk: NodeSDK): Promise<void> {
  try {
    await sdk.shutdown();
    console.log('✅ OpenTelemetry SDK shut down successfully');
  } catch (error) {
    console.error('❌ Error shutting down OpenTelemetry SDK:', error);
  }
}
