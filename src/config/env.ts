import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import { EnvConfig } from '../types/index.js';

// Load .env file
dotenvConfig();

/**
 * Environment variable schema with validation
 */
const EnvSchema = z.object({
  PORT: z.string().default('3978').transform(Number),
  NODE_ENV: z.string().default('development'),
  TENANT_ID: z.string().uuid(),
  API_CLIENT_ID: z.string().uuid(),
  API_AUDIENCE: z.string().min(1),
  REQUIRED_SCOPES: z.string().transform((val) => val.split(',').map((s) => s.trim())),
  REQUIRED_ROLES: z
    .string()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()) : [])),
  ALLOWED_APPIDS: z.string().transform((val) => val.split(',').map((s) => s.trim())),
  GITHUB_TOKEN: z.string().min(1),
  GITHUB_MODELS_ENDPOINT: z.string().url().default('https://models.inference.ai.azure.com'),
  GITHUB_MODELS_LIST: z.string().transform((val) => val.split(',').map((s) => s.trim())),
  GITHUB_MODELS_DEFAULT: z.string().default('gpt-4o'),
  GRAPH_CLIENT_ID: z.string().uuid(),
  GRAPH_CLIENT_SECRET: z.string().min(1),
  GRAPH_TENANT_ID: z.string().uuid(),
  PLANNER_PLAN_ID: z.string().min(1),
  PLANNER_BUCKET_ID: z.string().min(1),
  OTEL_EXPORTER_TYPE: z.enum(['console', 'otlp']).default('console'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('external-agent-taskmanagement'),
  OTEL_LOG_LEVEL: z.string().default('info'),
  PII_FILTER_ENABLED: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),
});

/**
 * Parse and validate environment variables
 */
function parseEnv(): EnvConfig {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment variable validation failed:');
    console.error(result.error.format());
    throw new Error('Invalid environment configuration');
  }

  return {
    port: result.data.PORT,
    nodeEnv: result.data.NODE_ENV,
    tenantId: result.data.TENANT_ID,
    apiClientId: result.data.API_CLIENT_ID,
    apiAudience: result.data.API_AUDIENCE,
    requiredScopes: result.data.REQUIRED_SCOPES,
    requiredRoles: result.data.REQUIRED_ROLES,
    allowedAppIds: result.data.ALLOWED_APPIDS,
    githubToken: result.data.GITHUB_TOKEN,
    githubModelsEndpoint: result.data.GITHUB_MODELS_ENDPOINT,
    githubModelsList: result.data.GITHUB_MODELS_LIST,
    githubModelsDefault: result.data.GITHUB_MODELS_DEFAULT,
    graphClientId: result.data.GRAPH_CLIENT_ID,
    graphClientSecret: result.data.GRAPH_CLIENT_SECRET,
    graphTenantId: result.data.GRAPH_TENANT_ID,
    plannerPlanId: result.data.PLANNER_PLAN_ID,
    plannerBucketId: result.data.PLANNER_BUCKET_ID,
    otelExporterType: result.data.OTEL_EXPORTER_TYPE,
    otelExporterOtlpEndpoint: result.data.OTEL_EXPORTER_OTLP_ENDPOINT,
    otelServiceName: result.data.OTEL_SERVICE_NAME,
    otelLogLevel: result.data.OTEL_LOG_LEVEL,
    piiFilterEnabled: result.data.PII_FILTER_ENABLED,
  };
}

/**
 * Validated environment configuration
 */
export const env = parseEnv();
